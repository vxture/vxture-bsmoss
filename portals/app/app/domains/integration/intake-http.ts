import { boundedText } from "../../lib/http.ts";
import { errorResponse } from "../../platform/envelope.ts";
import { jobHttpError, privateJobResponse } from "../supervision/http.ts";
import { intakeTerminationCommand } from "./intake-tasks.ts";
import type { IntakeReviewCommand } from "./intake-contracts.ts";
export function privateIntakeResponse(response: Response) {
  privateJobResponse(response); response.headers.set("cache-control", "private, no-store"); return response;
}
export function intakeHttpError(error: unknown) {
  const m = error instanceof Error ? error.message : "";
  if (["invalid_intake_task", "invalid_intake_query", "invalid_intake_command"].includes(m))
    return privateIntakeResponse(errorResponse(400, "INTAKE_INVALID_COMMAND", "Invalid intake command"));
  if (m === "intake_task_unavailable" || m.endsWith("scope_denied")) return privateIntakeResponse(errorResponse(404, "INTAKE_UNAVAILABLE", "Intake task unavailable"));
  if (["intake_task_busy", "intake_task_revision_conflict", "intake_task_not_terminable", "conflicting_intake_termination"].includes(m))
    return privateIntakeResponse(errorResponse(409, "INTAKE_CONTEXT_CHANGED", "Review the current intake task"));
  return privateIntakeResponse(jobHttpError(error));
}
export async function intakeTerminationHttp(request: Request, session: { enabled: boolean; sid?: string; appOrigin: string }, taskId: string,
  execute: (sid: string, command: IntakeReviewCommand) => Promise<unknown>) {
  const reply = (status: number, code: string, message: string) => privateIntakeResponse(errorResponse(status, code, message));
  if (!session.enabled || !session.sid) return reply(401, "AUTH_REQUIRED", "Authentication required");
  let origin = false;
  try { const u = new URL(session.appOrigin); origin = ["http:", "https:"].includes(u.protocol) && u.origin === session.appOrigin && request.headers.get("origin") === session.appOrigin; } catch { /* closed */ }
  if (!origin) return reply(403, "ORIGIN_DENIED", "Same-origin request required");
  const url = new URL(request.url);
  if (url.search || url.hash) return reply(400, "INTAKE_INVALID_COMMAND", "Invalid intake command");
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get("content-type") ?? "")) return reply(415, "INTAKE_JSON_REQUIRED", "JSON required");
  let command: IntakeReviewCommand;
  try {
    command = intakeTerminationCommand(JSON.parse(await boundedText(request, 4096)));
    if (command.taskId !== taskId) throw Error("invalid_intake_task");
  } catch (e) { return reply(e instanceof Error && e.message === "body_too_large" ? 413 : 400, "INTAKE_INVALID_COMMAND", "Invalid intake command"); }
  try { return privateIntakeResponse(Response.json(await execute(session.sid, command))); } catch (e) { return intakeHttpError(e); }
}
