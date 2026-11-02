import { cookies } from "next/headers";
import { getOidcConfig } from "../../../../auth/lib/config";
import { reportRecoveryForSession } from "../../../../domains/access/runtime";
import { exportRecoveryCommand } from "../../../../domains/supervision/http";

export const dynamic = "force-dynamic";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const cfg = getOidcConfig(), sid = (await cookies()).get(cfg.cookieName)?.value;
  return exportRecoveryCommand(request, { enabled: cfg.enabled, sid, appOrigin: cfg.appOrigin }, (await context.params).id, (sid, command) => reportRecoveryForSession(sid).recover(command));
}
