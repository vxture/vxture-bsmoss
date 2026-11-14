import { cookies } from "next/headers";
import { getOidcConfig } from "../../../auth/lib/config";
import { reportExportsForSession } from "../../../domains/access/runtime";
import { normalizeExportQuery } from "../../../domains/reports/exports";
import { errorResponse } from "../../../platform/envelope";

export const dynamic = "force-dynamic";
function privateResponse(response: Response) {
  response.headers.set("cache-control", "no-store"); response.headers.set("x-content-type-options", "nosniff"); response.headers.set("vary", "Cookie");
  return response;
}
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const cfg = getOidcConfig(), sid = (await cookies()).get(cfg.cookieName)?.value;
  if (!cfg.enabled || !sid) return privateResponse(errorResponse(401, "AUTH_REQUIRED", "Authentication required"));
  let query, html: boolean;
  try {
    const params = new URL(request.url).searchParams;
    if (params.toString().length > 4096 || [...params.keys()].some(k => k !== "format") || params.getAll("format").length > 1 || params.has("format") && params.get("format") !== "html") throw Error("invalid_export_filter");
    query = normalizeExportQuery({ jobId: (await context.params).id }); html = params.get("format") === "html";
  } catch { return privateResponse(errorResponse(400, "REPORT_EXPORT_INVALID", "Invalid filter")); }
  try {
    const api = reportExportsForSession(sid);
    if (!html) {
      const record = await api.status(query);
      return privateResponse(record ? Response.json(record) : errorResponse(404, "REPORT_EXPORT_UNAVAILABLE", "Export unavailable"));
    }
    const download = await api.download(query);
    if (!download) return privateResponse(errorResponse(404, "REPORT_EXPORT_UNAVAILABLE", "Export unavailable"));
    return privateResponse(new Response(download.html, { headers: {
      "content-type": "text/html; charset=utf-8", "content-disposition": 'attachment; filename="' + download.filename + '"',
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; sandbox",
      "x-report-content-sha256": download.sha256,
    } }));
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (["identity_required", "access_expired"].includes(code)) return privateResponse(errorResponse(401, "AUTH_REQUIRED", "Authentication required"));
    if (["feature_denied", "permission_denied"].includes(code)) return privateResponse(errorResponse(403, "POLICY_DENIED", "Access denied"));
    if (["report_scope_denied", "aggregate_scope_denied", "aggregate_dependency_scope_denied", "object_scope_denied", "rollup_scope_denied", "report_not_active"].includes(code)) return privateResponse(errorResponse(404, "REPORT_EXPORT_UNAVAILABLE", "Export unavailable"));
    if (["report_stale", "report_incomplete"].includes(code)) return privateResponse(errorResponse(409, "REPORT_EXPORT_STALE", "Report evidence changed"));
    return privateResponse(errorResponse(503, "REPORT_EXPORT_UNAVAILABLE", "Export temporarily unavailable", { retryable: true }));
  }
}
