// Adapted from the yucer engineering reference for product bsmoss.
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getOidcConfig } from "../lib/config";
import { getAuthUser } from "../lib/session";

export const dynamic = "force-dynamic";
const reply = (body: object) => NextResponse.json(body, { headers: { "cache-control": "no-store" } });

export async function GET(): Promise<Response> {
  const cfg = getOidcConfig();
  if (!cfg.enabled) return reply({ authenticated: false });
  const jar = await cookies();
  const rpsid = jar.get(cfg.cookieName)?.value;
  if (!rpsid) return reply({ authenticated: false });

  const user = await getAuthUser(cfg, rpsid).catch(() => null);
  if (!user) return reply({ authenticated: false });

  if (user.accountStatus !== "active") {
    return reply({ authenticated: false, reason: "account_inactive" });
  }
  return reply({ authenticated: true, user });
}
