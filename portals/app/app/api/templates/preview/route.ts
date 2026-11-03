import { cookies } from "next/headers";
import { getOidcConfig } from "../../../auth/lib/config";
import { templatesForSession } from "../../../domains/access/runtime";
import { templatePreviewRequest } from "../../../domains/views/templates";
import { templateHttpError } from "../../../domains/views/templates-http";
import { reportCommand } from "../../../domains/reports/http";
export async function POST(request: Request) {
  const cfg = getOidcConfig(), sid = (await cookies()).get(cfg.cookieName)?.value;
  return reportCommand(request, { enabled: cfg.enabled, sid, appOrigin: cfg.appOrigin }, templatePreviewRequest,
    (id, command) => templatesForSession(id).preview(command.candidate), 200, templateHttpError);
}
