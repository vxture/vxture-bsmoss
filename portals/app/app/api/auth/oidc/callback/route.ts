// Adapted from yucer; registration for bsmoss remains an environment prerequisite.
import { NextResponse } from "next/server";
import { getOidcConfig } from "../../../../auth/lib/config";
import { accessExpiry, exchangeCode, verifyToken } from "../../../../auth/lib/oidc";
import { takeAuthState, putSession, type RpSession } from "../../../../auth/lib/session-store";
import { sessionCookieOptions } from "../../../../auth/lib/cookie";
import { randomToken } from "../../../../auth/lib/pkce";
import type { AccessClaims } from "../../../../auth/lib/claims";
import {
  silentErrorOutcome,
  SSO_FRESH_TTL_SECONDS,
  ssoAttemptCookieName,
  ssoAttemptCookieOptions,
} from "../../../../auth/lib/sso";

export const dynamic = "force-dynamic";

function reject(msg: string): Response {
  
  return new NextResponse(`auth callback rejected: ${msg}`, { status: 400 });
}

export async function GET(req: Request): Promise<Response> {
  const cfg = getOidcConfig();
  if (!cfg.enabled) return new Response(null,{status:404});
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  // An authorize ERROR is read before the code. The IdP's answer to a silent
  // attempt (prompt=none, auth/lib/sso.ts) with nobody signed in is
  // `error=login_required` - information, not a failure: send the visitor
  // where they were going and let the front door render. The state is
  // consumed either way, so a failed handshake cannot be replayed.
  if (error) {
    const errored = state ? await takeAuthState(cfg.clientId, state) : null;
    if (errored && silentErrorOutcome(error, errored) === "return") {
      return NextResponse.redirect(new URL(errored.returnTo, cfg.appOrigin || url.origin).toString());
    }
    return reject("authorization error");
  }
  if (!code || !state) return reject("missing code/state");

  const authState = await takeAuthState(cfg.clientId, state);
  if (!authState) return reject("unknown or replayed state");

  let tokens;
  try {
    tokens = await exchangeCode(cfg, code, authState.verifier);
  } catch {
    return reject("code exchange failed");
  }
  if (!tokens.id_token) return reject("no id_token");

  let idClaims;
  try {
    idClaims = await verifyToken(tokens.id_token, cfg);
  } catch {
    return reject("id_token invalid");
  }
  if (idClaims.nonce !== authState.nonce) return reject("nonce mismatch");

  let accessClaims;
  try {
    accessClaims = await verifyToken(tokens.access_token, cfg);
  } catch {
    return reject("access_token invalid");
  }
  if (accessClaims.sub !== idClaims.sub) return reject("sub mismatch");

  const rpsid = randomToken();
  const accessExpiresAt = accessExpiry(tokens.access_token, tokens.expires_in, Math.floor(Date.now() / 1000));
  const session: RpSession = {
    idToken: tokens.id_token,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    accessExpiresAt,
    sid: typeof idClaims.sid === "string" ? idClaims.sid : undefined,
    sub: String(idClaims.sub),
    // The product's one copy of the person (auth/lib/login-state.ts), and when
    // accounts is next asked about this login - from accounts' own token.
    claims: accessClaims as AccessClaims,
    nextCheckAt: accessExpiresAt,
  };
  await putSession(cfg.clientId, rpsid, session, cfg.sessionTtlSeconds);

  // returnTo is a whitelisted relative path; anchor it to the app origin.
  const dest = new URL(authState.returnTo, cfg.appOrigin || url.origin);
  const res = NextResponse.redirect(dest.toString());
  res.cookies.set(cfg.cookieName, rpsid, sessionCookieOptions(cfg));
  // Signed in: shorten the silent-attempt marker to a few seconds rather than
  // clearing it. Cleared, a session the layout cannot use (no workspace, no
  // role) would be resumed, signed in and bounced forever; a few seconds stops
  // that and still lets the next signed-out visit, or a session that dies
  // minutes later, get its own attempt (auth/lib/sso.ts SSO_FRESH_TTL_SECONDS).
  res.cookies.set(
    ssoAttemptCookieName(cfg.cookieName),
    "1",
    ssoAttemptCookieOptions(cfg.cookieName, SSO_FRESH_TTL_SECONDS),
  );
  return res;
}
