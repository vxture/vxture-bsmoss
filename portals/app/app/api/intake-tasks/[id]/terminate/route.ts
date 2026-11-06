import { cookies } from "next/headers";
import { getOidcConfig } from "../../../../auth/lib/config";
import { intakeTasksForSession } from "../../../../domains/access/runtime";
import { intakeTerminationHttp } from "../../../../domains/integration/intake-http";
export const dynamic = "force-dynamic";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const cfg = getOidcConfig(), sid = (await cookies()).get(cfg.cookieName)?.value;
  return intakeTerminationHttp(request, { enabled: cfg.enabled, sid, appOrigin: cfg.appOrigin }, (await context.params).id,
    (session, raw) => intakeTasksForSession(session).terminate(raw));
}
