import { cookies } from "next/headers";
import { getOidcConfig } from "../../auth/lib/config";
import { reportExportsForSession } from "../../domains/access/runtime";
import { normalizeExportRequest } from "../../domains/reports/exports";
import { reportCommand } from "../../domains/reports/http";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const cfg = getOidcConfig(), sid = (await cookies()).get(cfg.cookieName)?.value;
  return reportCommand(request, { enabled: cfg.enabled, sid, appOrigin: cfg.appOrigin }, normalizeExportRequest, (id, command) => reportExportsForSession(id).request(command), 202);
}
