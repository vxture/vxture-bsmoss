import { cookies } from "next/headers";
import { getOidcConfig } from "../../../../auth/lib/config";
import { dataUpdatesForSession } from "../../../../domains/access/runtime";
import { updateCommand } from "../../../../domains/data-updates/http";
export const dynamic = "force-dynamic";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const cfg = getOidcConfig(), sid = (await cookies()).get(cfg.cookieName)?.value, { id } = await context.params;
  return updateCommand(request, { enabled: cfg.enabled, sid, appOrigin: cfg.appOrigin }, (session, raw) => {
    if (raw?.id !== id) throw Error("invalid_update_command");
    return dataUpdatesForSession(session).retryInput(raw);
  });
}
