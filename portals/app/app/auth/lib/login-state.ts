// Adapted from the yucer engineering reference for product bsmoss.
import type { OidcConfig } from "./config";
import { accessExpiry, refreshTokens, verifyToken } from "./oidc";
import {
  acquireCheckLock,
  deleteSession,
  getSession,
  putSession,
  releaseCheckLock,
  type RpSession,
} from "./session-store";
import type { AccessClaims } from "./claims";
import { describeError, noteLoginState } from "./auth-failures";

export type CheckResult =
  | { readonly kind: "valid"; readonly session: RpSession }
  | { readonly kind: "ended"; readonly detail: string }
  | { readonly kind: "unavailable"; readonly detail: string };

export interface LoginAuthority {

  check(cfg: OidcConfig, session: RpSession, activity: boolean): Promise<CheckResult>;

  freshToken(cfg: OidcConfig, session: RpSession): Promise<CheckResult>;
}

export interface LoginStateDeps {
  getSession: typeof getSession;
  putSession: typeof putSession;
  deleteSession: typeof deleteSession;
  acquireCheckLock: typeof acquireCheckLock;
  releaseCheckLock: typeof releaseCheckLock;
  authority: LoginAuthority;
  now: () => number;
}

const LOCK_HOLD_SECONDS = 20;

const EARLY_SECONDS = 30;

const RETRY_SECONDS = 30;

const nowSeconds = () => Math.floor(Date.now() / 1000);

function scheduleFrom(session: RpSession, accountsNextCheckAt: number | undefined, now: number): number {
  const deadline = accountsNextCheckAt ?? session.accessExpiresAt;
  return Math.max(now, deadline - EARLY_SECONDS);
}

function isRefusal(err: unknown): boolean {
  return /^token endpoint 4\d\d/.test(err instanceof Error ? err.message : "");
}

async function renewGrant(
  cfg: OidcConfig,
  session: RpSession,
  deps: { refreshTokens: typeof refreshTokens; verifyToken: typeof verifyToken },
  now: number,
): Promise<CheckResult> {
  if (!session.refreshToken) return { kind: "ended", detail: "no refresh token to renew with" };
  let tokens;
  try {
    tokens = await deps.refreshTokens(cfg, session.refreshToken);
  } catch (err) {
    return isRefusal(err)
      ? { kind: "ended", detail: describeError(err) }
      : { kind: "unavailable", detail: describeError(err) };
  }
  let claims: AccessClaims;
  try {
    claims = (await deps.verifyToken(tokens.access_token, cfg)) as AccessClaims;
    if (claims.sub !== session.sub) return { kind: "ended", detail: "renewed subject mismatch" };
  } catch (err) {
    return { kind: "unavailable", detail: `renewed token did not verify: ${describeError(err)}` };
  }
  const accessExpiresAt = accessExpiry(tokens.access_token, tokens.expires_in, now);
  return {
    kind: "valid",
    session: {
      ...session,
      accessToken: tokens.access_token,
      idToken: tokens.id_token ?? session.idToken,
      // rotation: the IdP returns a fresh refresh token; store it, drop the old
      refreshToken: tokens.refresh_token ?? session.refreshToken,
      accessExpiresAt,
      claims,
      nextCheckAt: accessExpiresAt,
    },
  };
}

/** The interim adapter: renewing the grant IS the question. */
export function grantAuthority(
  deps: { refreshTokens: typeof refreshTokens; verifyToken: typeof verifyToken } = { refreshTokens, verifyToken },
  now: () => number = nowSeconds,
): LoginAuthority {
  return {
    check: (cfg, session) => renewGrant(cfg, session, deps, now()),
    freshToken: (cfg, session) => renewGrant(cfg, session, deps, now()),
  };
}

export function defaultAuthority(): LoginAuthority {
  return grantAuthority();
}

const defaultDeps = (): LoginStateDeps => ({
  getSession,
  putSession,
  deleteSession,
  acquireCheckLock,
  releaseCheckLock,
  authority: defaultAuthority(),
  now: nowSeconds,
});

// --- the one checker ------------------------------------------------------------

export interface LoginState {
  readonly session: RpSession;
  readonly claims: AccessClaims;
}

function due(session: RpSession, now: number): boolean {
  return !session.claims || scheduleFrom(session, session.nextCheckAt, now) <= now;
}

/**
 * Run one check under the lock, and apply what accounts said. Returns the
 * record as it stands afterwards, or null when the login has ended. When
 * another request holds the lock, returns the record unchanged - that request
 * is doing the asking.
 */
async function checkOnce(
  cfg: OidcConfig,
  rpsid: string,
  activity: boolean,
  deps: LoginStateDeps,
  ask: (session: RpSession) => Promise<CheckResult>,
  onlyIf: (session: RpSession) => boolean,
): Promise<RpSession | null | "busy"> {
  if (!(await deps.acquireCheckLock(cfg.clientId, rpsid, LOCK_HOLD_SECONDS))) return "busy";
  try {
    // RE-READ INSIDE THE LOCK: whoever held it last may already have asked.
    const current = await deps.getSession(cfg.clientId, rpsid);
    if (!current) return null;
    if (!onlyIf(current)) return current;
    const result = await ask(current);
    if (result.kind === "valid") {
      await deps.putSession(cfg.clientId, rpsid, result.session, cfg.sessionTtlSeconds);
      return result.session;
    }
    if (result.kind === "ended") {
      noteLoginState("ended_by_accounts", result.detail);
      await deps.deleteSession(cfg.clientId, rpsid).catch(() => undefined);
      return null;
    }
    noteLoginState(activity ? "check_unavailable" : "token_unavailable", result.detail);
    const kept = { ...current, nextCheckAt: deps.now() + RETRY_SECONDS + EARLY_SECONDS };
    await deps.putSession(cfg.clientId, rpsid, kept, cfg.sessionTtlSeconds);
    return kept;
  } finally {
    await deps.releaseCheckLock(cfg.clientId, rpsid).catch(() => undefined);
  }
}

/**
 * The login state behind a cookie. `activity`: the member is actually doing
 * something (a page they opened, an action they took). Only then is accounts
 * asked, and only when accounts' own schedule says it is time.
 */
export async function resolveLoginState(
  cfg: OidcConfig,
  rpsid: string,
  opts: { activity: boolean },
  deps: LoginStateDeps = defaultDeps(),
): Promise<LoginState | null> {
  let session = await deps.getSession(cfg.clientId, rpsid);
  if (!session) {
    noteLoginState("no_record");
    return null;
  }

  // A record from before this module has no claims: it must be asked once,
  // activity or not, or it has nothing to show.
  if (due(session, deps.now()) && (opts.activity || !session.claims)) {
    const after = await checkOnce(
      cfg, rpsid, true, deps,
      (s) => deps.authority.check(cfg, s, opts.activity),
      (s) => due(s, deps.now()),
    );
    if (after === null) return null;
    if (after !== "busy") session = after;
  }

  if (!session.claims) return null; // pre-existing record, check in flight elsewhere
  return { session, claims: session.claims };
}

/**
 * An access token for calling the platform on the member's behalf (OBO), or
 * null. Renews under the same lock when the stored one has run out. A null
 * here affects the call, never the login state.
 */
export async function accessTokenFor(
  cfg: OidcConfig,
  rpsid: string,
  deps: LoginStateDeps = defaultDeps(),
): Promise<string | null> {
  const fresh = (s: RpSession) => s.accessExpiresAt - deps.now() > EARLY_SECONDS;
  const session = await deps.getSession(cfg.clientId, rpsid);
  if (!session) return null;
  if (fresh(session)) return session.accessToken;

  for (let attempt = 0; attempt < 10; attempt++) {
    const after = await checkOnce(
      cfg, rpsid, false, deps,
      (s) => deps.authority.freshToken(cfg, s),
      (s) => !fresh(s),
    );
    if (after === null) return null;
    if (after !== "busy") return fresh(after) ? after.accessToken : null;
    // Somebody else is renewing: wait for their result rather than racing it.
    await new Promise((r) => setTimeout(r, 300));
    const now = await deps.getSession(cfg.clientId, rpsid);
    if (now && fresh(now)) return now.accessToken;
  }
  noteLoginState("token_unavailable", "renewal busy too long");
  return null;
}
