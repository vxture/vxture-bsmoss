import { cookies } from "next/headers";
import { getOidcConfig } from "../../../../auth/lib/config";
import { reportPublicationForSession } from "../../../../domains/access/runtime";
import { normalizePublicationQuery, normalizePublicationCommand } from "../../../../domains/reports/publication";
import { reportCommand } from "../../../../domains/reports/http";
import { errorResponse } from "../../../../platform/envelope";

export const dynamic = "force-dynamic";
function privateResponse(response: Response) {
  response.headers.set("cache-control", "no-store"); response.headers.set("x-content-type-options", "nosniff"); response.headers.set("vary", "Cookie");
  return response;
}
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const cfg = getOidcConfig(), sid = (await cookies()).get(cfg.cookieName)?.value;
  if (!cfg.enabled || !sid) return privateResponse(errorResponse(401, "AUTH_REQUIRED", "Authentication required"));
  let query;
  try {
    const params = new URL(request.url).searchParams;
    if (params.toString().length > 4096 || [...params.keys()].some(k => k !== "eventRevision") || params.getAll("eventRevision").length > 1) throw Error("invalid_publication_filter");
    query = normalizePublicationQuery({ reportId: (await context.params).id, ...(params.has("eventRevision") ? { eventRevision: params.get("eventRevision")! } : {}) });
  } catch { return privateResponse(errorResponse(400, "REPORT_INVALID_FILTER", "Invalid filter")); }
  try {
    const record = await reportPublicationForSession(sid).read(query);
    if (!record && query.eventRevision) return privateResponse(errorResponse(404, "REPORT_UNAVAILABLE", "Report unavailable"));
    return privateResponse(Response.json(record));
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (["identity_required", "access_expired"].includes(code)) return privateResponse(errorResponse(401, "AUTH_REQUIRED", "Authentication required"));
    if (["feature_denied", "permission_denied"].includes(code)) return privateResponse(errorResponse(403, "POLICY_DENIED", "Access denied"));
    if (["report_scope_denied", "aggregate_scope_denied", "aggregate_dependency_scope_denied", "object_scope_denied", "rollup_scope_denied"].includes(code))
      return privateResponse(errorResponse(404, "REPORT_UNAVAILABLE", "Report unavailable"));
    return privateResponse(errorResponse(503, "REPORT_UNAVAILABLE", "Report query temporarily unavailable", { retryable: true }));
  }
}
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const cfg = getOidcConfig(), sid = (await cookies()).get(cfg.cookieName)?.value, reportId = (await context.params).id;
  return reportCommand(request, { enabled: cfg.enabled, sid, appOrigin: cfg.appOrigin }, raw => {
    const command = normalizePublicationCommand(raw);
    if (command.reportId !== reportId) throw Error("invalid_publication_target");
    return command;
  }, (id, command) => reportPublicationForSession(id).execute(command));
}
