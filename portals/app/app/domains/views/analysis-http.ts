import { privateReportResponse, reportHttpError } from "../reports/http.ts";
import { errorResponse } from "../../platform/envelope.ts";
import { analysisQuery } from "./analysis.ts";

export function analysisSearch(params: URLSearchParams) {
  if (params.toString().length > 256 || [...params.keys()].some(k => k !== "at") || params.getAll("at").length !== 1) throw Error("invalid_analysis_query");
  return analysisQuery({ at: params.get("at")! });
}
export function analysisHttpError(error: unknown) {
  if (error instanceof Error && error.message === "invalid_analysis_preferences") return privateReportResponse(errorResponse(400, "ANALYSIS_INVALID_PREFERENCE", "Invalid display preference"));
  if (error instanceof Error && ["analysis_template_changed", "analysis_preference_conflict"].includes(error.message)) {
    return privateReportResponse(errorResponse(409, "ANALYSIS_CONTEXT_CHANGED", "Refresh analysis and review the current configuration"));
  }
  return reportHttpError(error);
}
