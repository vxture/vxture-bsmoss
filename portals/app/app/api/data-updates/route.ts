import { cookies } from "next/headers";
import { getOidcConfig } from "../../auth/lib/config";
import { dataUpdatesForSession } from "../../domains/access/runtime";
import { updateCommand } from "../../domains/data-updates/http";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const cfg = getOidcConfig(), sid = (await cookies()).get(cfg.cookieName)?.value;
  return updateCommand(request, { enabled: cfg.enabled, sid, appOrigin: cfg.appOrigin }, (session, raw) => dataUpdatesForSession(session).request(raw));
}
