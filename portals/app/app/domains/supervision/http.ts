import { boundedText } from "../../lib/http.ts";
import { errorResponse } from "../../platform/envelope.ts";
import { privateReportResponse } from "../reports/http.ts";
import { normalizeJobList, type JobListQuery, normalizeRecoverJob, type RecoverJob } from "./jobs.ts";
import { normalizeRecoverExportJob, type RecoverExportJob } from "./report-jobs.ts";

export const privateJobResponse = privateReportResponse;
export function jobHttpError(error: unknown): Response {
  const message = error instanceof Error ? error.message : "", sql = error && typeof error === "object" && "code" in error ? error.code : null;
  let response: Response;
  if (["identity_required", "access_expired"].includes(message)) response = errorResponse(401, "AUTH_REQUIRED", "Authentication required");
  else if (["permission_denied", "feature_denied"].includes(message)) response = errorResponse(403, "POLICY_DENIED", "Access denied");
  else if (message.endsWith("scope_denied") || message === "job_unavailable") response = errorResponse(404, "JOB_UNAVAILABLE", "Job unavailable");
  else if (["40001", "40P01", "23505"].includes(String(sql)) || ["job_recovery_conflict", "conflicting_job_recovery", "report_not_active", "report_stale", "report_incomplete", "export_renderer_unavailable"].includes(message)) response = errorResponse(409, "JOB_CONTEXT_CHANGED", "Refresh and review the current job");
  else response = errorResponse(503, "JOB_UNAVAILABLE", "Job operation temporarily unavailable", { retryable: true });
  return privateJobResponse(response);
}
export function jobListFromUrl(url: URL): JobListQuery {
  const p = url.searchParams;
  if (url.search.length > 10000 || [...p.keys()].some(k => !["limit", "status", "after"].includes(k)) ||
    ["limit", "status", "after"].some(k => p.getAll(k).length > 1) || p.has("limit") && !/^[1-9]\d?$/.test(p.get("limit")!)) throw Error("invalid_job_filter");
  return normalizeJobList({ limit: Number(p.get("limit") ?? "20"), status: (p.get("status") ?? "all") as JobListQuery["status"], ...(p.has("after") ? { after: p.get("after")! } : {}) });
}
export async function recoveryCommand(request: Request, session: { enabled: boolean; sid?: string; appOrigin: string }, jobId: string,
  execute: (sid: string, command: RecoverJob) => Promise<unknown>): Promise<Response> {
  return reviewedCommand(request, session, jobId, normalizeRecoverJob, execute);
}
export async function exportRecoveryCommand(request: Request, session: { enabled: boolean; sid?: string; appOrigin: string }, jobId: string,
  execute: (sid: string, command: RecoverExportJob) => Promise<unknown>): Promise<Response> {
  return reviewedCommand(request, session, jobId, normalizeRecoverExportJob, execute);
}
async function reviewedCommand<T extends { jobId: string }>(request: Request, session: { enabled: boolean; sid?: string; appOrigin: string }, jobId: string,
  normalize: (raw: T) => T, execute: (sid: string, command: T) => Promise<unknown>): Promise<Response> {
  const reply = (status: number, code: string, message: string) => privateJobResponse(errorResponse(status, code, message));
  if (!session.enabled || !session.sid) return reply(401, "AUTH_REQUIRED", "Authentication required");
  let sameOrigin = false;
  try { const u = new URL(session.appOrigin); sameOrigin = ["http:", "https:"].includes(u.protocol) && u.origin === session.appOrigin && request.headers.get("origin") === session.appOrigin; } catch { /* closed */ }
  if (!sameOrigin) return reply(403, "ORIGIN_DENIED", "Same-origin request required");
  const url = new URL(request.url); if (url.search || url.hash) return reply(400, "JOB_INVALID_COMMAND", "Invalid command");
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get("content-type") ?? "")) return reply(415, "JOB_JSON_REQUIRED", "JSON required");
  let command: T;
  try { command = normalize(JSON.parse(await boundedText(request, 16384))); if (command.jobId !== jobId) throw Error("job_path_mismatch"); }
  catch (error) { return error instanceof Error && error.message === "body_too_large" ? reply(413, "JOB_BODY_TOO_LARGE", "Command too large") : reply(400, "JOB_INVALID_COMMAND", "Invalid command"); }
  try { return privateJobResponse(Response.json(await execute(session.sid, command), { status: 202 })); } catch (error) { return jobHttpError(error); }
}
