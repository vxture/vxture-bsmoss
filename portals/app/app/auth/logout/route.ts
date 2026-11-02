// Adapted from the yucer engineering reference for product bsmoss.
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getOidcConfig } from "../lib/config";
import { deleteSession, getSession } from "../lib/session-store";
import { clearCookieOptions } from "../lib/cookie";
import { randomToken } from "../lib/pkce";
import { SIGNED_OUT_COOKIE, SIGNED_OUT_MAX_AGE_SECONDS } from "../lib/signed-out-marker";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const cfg = getOidcConfig();
  if (!cfg.enabled) return new Response(null, {status:404});
  if (req.headers.get("origin") !== cfg.appOrigin) return new Response(null,{status:403});
  const jar = await cookies();
  const rpsid = jar.get(cfg.cookieName)?.value;

  const record = rpsid ? await getSession(cfg.clientId, rpsid).catch(() => null) : null;
  if (rpsid) await deleteSession(cfg.clientId, rpsid).catch(() => {});

  const endSession = new URL(cfg.endSessionUrl);
  if (record?.idToken) endSession.searchParams.set("id_token_hint", record.idToken);
  endSession.searchParams.set("client_id", cfg.clientId);
  if (cfg.postLogoutRedirectUri) {
    endSession.searchParams.set("post_logout_redirect_uri", cfg.postLogoutRedirectUri);
  }
  endSession.searchParams.set("state", randomToken(16));

  const res = NextResponse.redirect(endSession.toString(), 303);
  res.cookies.set(cfg.cookieName, "", clearCookieOptions(cfg));

  res.cookies.set(SIGNED_OUT_COOKIE, "1", {
    httpOnly: false,
    secure: cfg.cookieName.startsWith("__Host-"),
    sameSite: "lax",
    path: "/",
    maxAge: SIGNED_OUT_MAX_AGE_SECONDS,
  });
  return res;
}
