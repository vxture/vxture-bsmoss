// Adapted from the yucer engineering reference for product bsmoss.
import { NextResponse } from "next/server";
import { getOidcConfig } from "../lib/config";
import { makePkce, randomToken } from "../lib/pkce";
import { putAuthState } from "../lib/session-store";
import { safeReturnTo } from "../lib/return-to";
import { ssoAttemptCookieName, ssoAttemptCookieOptions } from "../lib/sso";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const cfg = getOidcConfig();
  if (!cfg.enabled) return new Response(null, {status:404});
  const url = new URL(req.url);
  const returnTo = safeReturnTo(url.searchParams.get("returnTo"));
  const silent = url.searchParams.get("silent") === "1";

  if (silent && (!cfg.enabled || !cfg.redirectUri)) {
    return NextResponse.redirect(new URL(returnTo, cfg.appOrigin || url.origin).toString());
  }

  const { verifier, challenge } = makePkce();
  const state = randomToken();
  const nonce = randomToken();
  await putAuthState(cfg.clientId, state, { verifier, nonce, returnTo, ...(silent ? { silent: true } : {}) });

  const authorize = new URL(cfg.authorizeUrl);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("client_id", cfg.clientId);
  authorize.searchParams.set("redirect_uri", cfg.redirectUri);
  authorize.searchParams.set("scope", cfg.scopes);
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("nonce", nonce);
  authorize.searchParams.set("code_challenge", challenge);
  authorize.searchParams.set("code_challenge_method", "S256");

  if (url.searchParams.get("switch") === "1") authorize.searchParams.set("prompt", "login");
  else if (silent) authorize.searchParams.set("prompt", "none");
  const res = NextResponse.redirect(authorize.toString());

  if (silent) res.cookies.set(ssoAttemptCookieName(cfg.cookieName), "1", ssoAttemptCookieOptions(cfg.cookieName));
  return res;
}
