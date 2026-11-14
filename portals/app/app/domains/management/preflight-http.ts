import { boundedText } from "../../lib/http.ts";
import { errorResponse } from "../../platform/envelope.ts";
import { privateReportResponse } from "../reports/http.ts";
import { managementHttpError } from "./http.ts";
export async function preflightCommand(request: Request, session: { enabled: boolean; sid?: string; appOrigin: string }, execute: (sid: string, raw: unknown) => Promise<unknown>, kind: "mapping" | "source" = "mapping") {
  const reply = (status: number, code: string, message: string) => privateReportResponse(errorResponse(status, code, message));
  if (!session.enabled || !session.sid) return reply(401, "AUTH_REQUIRED", "Authentication required");
  let origin = false;
  try { const u = new URL(session.appOrigin); origin = ["http:", "https:"].includes(u.protocol) && u.origin === session.appOrigin && request.headers.get("origin") === session.appOrigin; } catch { /* closed */ }
  if (!origin) return reply(403, "ORIGIN_DENIED", "Same-origin request required");
  if (new URL(request.url).search) return reply(400, "PREFLIGHT_INVALID_COMMAND", "Invalid preflight command");
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get("content-type") ?? "")) return reply(415, "PREFLIGHT_JSON_REQUIRED", "JSON required");
  let raw;
  try { raw = JSON.parse(await boundedText(request, kind === "source" ? 65536 : 8192)); } catch (e) { return reply(e instanceof Error && e.message === "body_too_large" ? 413 : 400, "PREFLIGHT_INVALID_COMMAND", "Invalid preflight command"); }
  try { return privateReportResponse(Response.json(await execute(session.sid, raw))); }
  catch (e) {
    const code = e instanceof Error ? e.message : "";
    if (kind === "source" && ["invalid_source_proposal", "source_proposal_unchanged"].includes(code)) return reply(400, "PREFLIGHT_INVALID_COMMAND", "Propose changed source configuration and the next revision");
    if (kind === "source" && code === "source_context_changed") return reply(409, "SOURCE_CONTEXT_CHANGED", "Read the current source configuration again");
    if (code === "invalid_mapping_proposal" || code === "mapping_proposal_unchanged") return reply(400, "PREFLIGHT_INVALID_COMMAND", "Propose a changed interval and the next version");
    if (code === "mapping_context_changed") return reply(409, "MAPPING_CONTEXT_CHANGED", "Read the current mapping again");
    return managementHttpError(e);
  }
}
