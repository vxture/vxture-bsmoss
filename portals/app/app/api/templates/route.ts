import { cookies } from "next/headers";
import { getOidcConfig } from "../../auth/lib/config";
import { templatesForSession } from "../../domains/access/runtime";
import { templatePublication } from "../../domains/views/templates";
import { templateSearch, templateHttpError } from "../../domains/views/templates-http";
import { privateReportResponse, reportCommand } from "../../domains/reports/http";
import { errorResponse } from "../../platform/envelope";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const cfg = getOidcConfig(), sid = (await cookies()).get(cfg.cookieName)?.value;
  if (!cfg.enabled || !sid) return privateReportResponse(errorResponse(401, "AUTH_REQUIRED", "Authentication required"));
  let query; try { query = templateSearch(new URL(request.url).searchParams); }
  catch { return privateReportResponse(errorResponse(400, "TEMPLATE_INVALID_QUERY", "Invalid template query")); }
  try { return privateReportResponse(Response.json(await templatesForSession(sid).read(query))); } catch (error) { return templateHttpError(error); }
}
export async function POST(request: Request) {
  const cfg = getOidcConfig(), sid = (await cookies()).get(cfg.cookieName)?.value;
  return reportCommand(request, { enabled: cfg.enabled, sid, appOrigin: cfg.appOrigin }, templatePublication,
    (id, command) => templatesForSession(id).publish(command), 200, templateHttpError);
}
