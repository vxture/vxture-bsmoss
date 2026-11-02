import { boundedText } from "../../lib/http.ts";
import { errorResponse } from "../../platform/envelope.ts";

export function privateReportResponse(response: Response): Response {
  response.headers.set("cache-control", "no-store"); response.headers.set("x-content-type-options", "nosniff"); response.headers.set("vary", "Cookie");
  return response;
}
export function reportHttpError(error: unknown): Response {
  const code = error instanceof Error ? error.message : "";
  const sql = error && typeof error === "object" && "code" in error ? error.code : null;
  let response: Response;
  if (["identity_required", "access_expired"].includes(code)) response = errorResponse(401, "AUTH_REQUIRED", "Authentication required");
  else if (["feature_denied", "permission_denied"].includes(code)) response = errorResponse(403, "POLICY_DENIED", "Access denied");
  else if (code.endsWith("scope_denied") || ["report_unavailable", "report_template_unavailable", "report_rollup_unavailable"].includes(code)) response = errorResponse(404, "REPORT_UNAVAILABLE", "Report unavailable");
  else if (sql === "40001" || sql === "40P01" || ["report_revision_conflict", "publication_revision_conflict", "conflicting_publication_replay", "conflicting_export_replay",
    "report_stale", "report_incomplete", "report_not_active", "report_already_published", "publication_withdrawal_conflict", "publication_report_mismatch"].includes(code))
    response = errorResponse(409, "REPORT_CONTEXT_CHANGED", "Refresh the report and review its current state");
  else response = errorResponse(503, "REPORT_UNAVAILABLE", "Report operation temporarily unavailable", { retryable: true });
  return privateReportResponse(response);
}
export interface ReportHttpSession { enabled: boolean; sid?: string; appOrigin: string }
export async function reportCommand<T>(request: Request, session: ReportHttpSession,
  normalize: (raw: any) => T, execute: (sid: string, command: T) => Promise<unknown>, accepted = 200, onError = reportHttpError): Promise<Response> {
  const reply = (status: number, code: string, message: string) => privateReportResponse(errorResponse(status, code, message));
  if (!session.enabled || !session.sid) return reply(401, "AUTH_REQUIRED", "Authentication required");
  // Bind to the configured public origin. Host, forwarded headers and request
  // URL are not trusted sources of an origin for a cookie-authenticated write.
  let validOrigin = false;
  try { const url = new URL(session.appOrigin); validOrigin = ["http:", "https:"].includes(url.protocol) && url.origin === session.appOrigin && request.headers.get("origin") === session.appOrigin; } catch { /* closed */ }
  if (!validOrigin) return reply(403, "ORIGIN_DENIED", "Same-origin request required");
  const url = new URL(request.url);
  if (url.search || url.hash) return reply(400, "REPORT_INVALID_COMMAND", "Invalid command");
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get("content-type") ?? "")) return reply(415, "REPORT_JSON_REQUIRED", "JSON required");
  let command: T;
  try { command = normalize(JSON.parse(await boundedText(request, 16384))); }
  catch (error) { return error instanceof Error && error.message === "body_too_large" ? reply(413, "REPORT_BODY_TOO_LARGE", "Command too large") : reply(400, "REPORT_INVALID_COMMAND", "Invalid command"); }
  try { return privateReportResponse(Response.json(await execute(session.sid, command), { status: accepted })); }
  catch (error) { return onError(error); }
}
