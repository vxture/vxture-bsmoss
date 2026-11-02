// Adapted from the yucer engineering reference for product bsmoss.
import { getOidcConfig } from "../lib/config";
import { verifyToken } from "../lib/oidc";
import { sessionsForSid, deleteSession, claimBclogoutJti } from "../lib/session-store";

export const dynamic = "force-dynamic";

const BACKCHANNEL_EVENT = "http://schemas.openid.net/event/backchannel-logout";

export async function POST(req: Request): Promise<Response> {
  const cfg = getOidcConfig();
  if (!cfg.enabled) return new Response(null, {status:404});
  const form = await req.formData().catch(() => null);
  const logoutToken = form?.get("logout_token");

  if (typeof logoutToken !== "string") return new Response("bad request", { status: 400 });

  let claims;
  try {
    claims = await verifyToken(logoutToken, cfg, { requiredClaims: ["iat", "jti"] });
  } catch {
    return new Response("invalid logout_token", { status: 400 });
  }

  if (claims.nonce !== undefined) return new Response("nonce forbidden", { status: 400 });
  const events = claims.events as Record<string, unknown> | undefined;
  if (!events || typeof events !== "object" || Array.isArray(events) || !(BACKCHANNEL_EVENT in events)) {
    return new Response("missing backchannel event", { status: 400 });
  }
  const sid = typeof claims.sid === "string" ? claims.sid : undefined;
  if (!sid) return new Response("missing sid", { status: 400 });
  if (typeof claims.jti !== "string" || !claims.jti || typeof claims.iat !== "number" ||
      Math.abs(Date.now()/1000-claims.iat)>300) return new Response("invalid logout claims",{status:400});

  if (typeof claims.jti === "string") {
    const fresh = await claimBclogoutJti(cfg.clientId, claims.jti);
    if (!fresh) return new Response("", { status: 200 });
  }

  const rpsids = await sessionsForSid(cfg.clientId, sid);
  await Promise.all(rpsids.map((rp) => deleteSession(cfg.clientId, rp).catch(() => {})));
  return new Response("", { status: 200 });
}
