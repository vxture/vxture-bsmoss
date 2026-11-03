import { reportHttpError, privateReportResponse } from "../reports/http.ts";
import { errorResponse } from "../../platform/envelope.ts";
import { templateReadQuery } from "./templates.ts";

export function templateSearch(params: URLSearchParams) {
  if (params.toString().length > 1024 || [...params.keys()].some(k => !["code", "version"].includes(k)) || params.getAll("code").length !== 1 || params.getAll("version").length > 1) throw Error("invalid_template_query");
  const version = params.get("version");
  if (version !== null && !/^[1-9][0-9]*$/.test(version)) throw Error("invalid_template_version");
  return templateReadQuery({ code: params.get("code")!, ...(version === null ? {} : { version: Number(version) }) });
}
export function templateHttpError(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  if (["template_revision_conflict", "template_command_conflict", "template_validation_changed"].includes(code)) return privateReportResponse(errorResponse(409, "TEMPLATE_CONTEXT_CHANGED", "Reload and validate the current template"));
  if (code === "template_binding_unavailable") return privateReportResponse(errorResponse(404, "TEMPLATE_UNAVAILABLE", "Template binding unavailable"));
  if (code === "template_binding_mismatch") return privateReportResponse(errorResponse(400, "TEMPLATE_INVALID_BINDING", "Template binding does not match the metric object"));
  return reportHttpError(error);
}
