// Adapted from the yucer engineering reference for product bsmoss.
const SSO_ATTEMPT_BASE = "bsmoss_sso_tried";

export const SSO_ATTEMPT_TTL_SECONDS = 600;

export const SSO_FRESH_TTL_SECONDS = 30;

export function ssoAttemptCookieName(sessionCookieName: string): string {
  return sessionCookieName.startsWith("__Host-") ? `__Host-${SSO_ATTEMPT_BASE}` : SSO_ATTEMPT_BASE;
}

export function ssoAttemptCookieOptions(sessionCookieName: string, maxAge = SSO_ATTEMPT_TTL_SECONDS) {
  return {
    httpOnly: true as const,
    secure: sessionCookieName.startsWith("__Host-"),
    sameSite: "lax" as const,
    path: "/" as const,
    maxAge,
  };
}

/**
 * Whether a page that found NO USABLE SESSION should try to get one back
 * silently, rather than show the front door.
 *
 * A stale cookie may survive after its server session has ended. The initial
 * silent SSO check only
 * fires for a visit with NO session cookie. A member whose session died SERVER
 * side - refresh refused, Redis lost it - still holds the cookie, so they were
 * shown the door and asked to click through something the IdP already knows.
 * Same person, same IdP session, same answer as a silent attempt - it just
 * never got asked.
 *
 * Only when there IS a cookie: no cookie is shouldTrySilentSso's case and the
 * middleware has already had its turn. And the same marker keeps it from
 * looping - the login route sets it on the attempt, so an IdP that answers
 * login_required costs one redirect and then the door renders as before.
 */
export function shouldResumeSilently(r: {
  enabled: boolean;
  hasCookie: boolean;
  triedRecently: boolean;
  justSignedOut: boolean;
}): boolean {
  return r.enabled && r.hasCookie && !r.triedRecently && !r.justSignedOut;
}

/**
 * The authorize errors that mean "nobody is signed in here, and I was told not
 * to ask" (OIDC core 3.1.2.6) - the EXPECTED answer to prompt=none, not a
 * failure. Every other error is a real one and still rejects.
 */
const INTERACTION_REQUIRED = new Set([
  "login_required",
  "interaction_required",
  "consent_required",
  "account_selection_required",
]);

export function isInteractionRequired(error: string): boolean {
  return INTERACTION_REQUIRED.has(error);
}

/** What the callback does with an authorize error: a silent attempt the IdP
 *  declined goes back to where the visitor was going; anything else rejects. */
export function silentErrorOutcome(error: string, authState: { silent?: boolean } | null): "return" | "reject" {
  return authState?.silent === true && isInteractionRequired(error) ? "return" : "reject";
}

/**
 * Whether this request should start a silent attempt. Only a top-level page
 * navigation, with sign-in configured, no session cookie, no attempt already
 * made, and not straight after a sign-out (the sign-out confirmation must
 * render, and the IdP session is gone anyway).
 */
export function shouldTrySilentSso(r: {
  method: string;
  pathname: string;
  enabled: boolean;
  hasSession: boolean;
  triedRecently: boolean;
  justSignedOut: boolean;
  /** Sec-Fetch-Mode, when the browser sends it. */
  fetchMode: string | null;
  /** Next's RSC / prefetch requests are fetches, not navigations. */
  isRscOrPrefetch: boolean;
}): boolean {
  if (!r.enabled || r.method !== "GET") return false;
  if (r.hasSession || r.triedRecently || r.justSignedOut) return false;
  if (r.isRscOrPrefetch) return false;
  if (r.fetchMode !== null && r.fetchMode !== "navigate") return false;
  // The login round trip itself, route handlers, build output, and any file.
  if (/^\/(auth|api|_next)(\/|$)/.test(r.pathname)) return false;
  if (/\.[a-z0-9]+$/i.test(r.pathname)) return false;
  return true;
}
