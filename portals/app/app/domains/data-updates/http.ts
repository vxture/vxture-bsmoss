import { boundedText } from "../../lib/http.ts";
import { errorResponse } from "../../platform/envelope.ts";
import { privateJobResponse, jobHttpError } from "../supervision/http.ts";
export function updateHttpError(error: unknown) {
  const m = error instanceof Error ? error.message : "";
  if (m.startsWith("invalid_update_") && m !== "invalid_update_evidence") return privateJobResponse(errorResponse(400, "UPDATE_INVALID_COMMAND", "Invalid update command"));
  if (["update_request_busy", "update_configuration_changed", "registered_partition_paused", "input_dispatch_revision_conflict", "conflicting_input_reopen_replay", "input_already_dispatched"].includes(m)) return privateJobResponse(errorResponse(409, "UPDATE_CONTEXT_CHANGED", "Check the current update task", { retryable: true }));
  if (["update_input_bound_exceeded", "update_recovery_bound_exceeded"].includes(m)) return privateJobResponse(errorResponse(409, "UPDATE_CAPACITY_LIMIT", "Registered update capacity exceeded"));
  if (["update_unavailable", "registered_partition_unavailable"].includes(m)) return privateJobResponse(errorResponse(404, "UPDATE_UNAVAILABLE", "Update unavailable"));
  return jobHttpError(error);
}
export async function updateCommand(request: Request, session: { enabled: boolean; sid?: string; appOrigin: string }, execute: (sid: string, raw: any) => Promise<unknown>) {
  const reply = (status: number, code: string, message: string) => privateJobResponse(errorResponse(status, code, message));
  if (!session.enabled || !session.sid) return reply(401, "AUTH_REQUIRED", "Authentication required");
  let origin = false;
  try { const u = new URL(session.appOrigin); origin = ["http:", "https:"].includes(u.protocol) && u.origin === session.appOrigin && request.headers.get("origin") === session.appOrigin; } catch { /* closed */ }
  if (!origin) return reply(403, "ORIGIN_DENIED", "Same-origin request required");
  if (new URL(request.url).search) return reply(400, "UPDATE_INVALID_COMMAND", "Invalid update command");
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get("content-type") ?? "")) return reply(415, "UPDATE_JSON_REQUIRED", "JSON required");
  let raw;
  try { raw = JSON.parse(await boundedText(request, 4096)); }
  catch (e) { return reply(e instanceof Error && e.message === "body_too_large" ? 413 : 400, "UPDATE_INVALID_COMMAND", "Invalid update command"); }
  try { return privateJobResponse(Response.json(await execute(session.sid, raw), { status: 202 })); } catch (e) { return updateHttpError(e); }
}
