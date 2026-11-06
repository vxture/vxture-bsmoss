import { cookies } from "next/headers";
import { getOidcConfig } from "../../../../../auth/lib/config";
import { sourcePreflightForSession } from "../../../../../domains/access/runtime";
import { preflightCommand } from "../../../../../domains/management/preflight-http";
export const dynamic = "force-dynamic";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const cfg = getOidcConfig(), sid = (await cookies()).get(cfg.cookieName)?.value;
  return preflightCommand(request, { enabled: cfg.enabled, sid, appOrigin: cfg.appOrigin }, async (session, raw) => sourcePreflightForSession(session).preview((await context.params).id, raw), "source");
}
