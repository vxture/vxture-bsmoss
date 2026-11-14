import { cookies } from "next/headers";
import { getOidcConfig } from "../../auth/lib/config";
import { analysisForSession } from "../../domains/access/runtime";
import { analysisSearch, analysisHttpError } from "../../domains/views/analysis-http";
import { saveAnalysisPreference } from "../../domains/views/analysis";
import { privateReportResponse, reportCommand } from "../../domains/reports/http";
import { errorResponse } from "../../platform/envelope";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const cfg = getOidcConfig(), sid = (await cookies()).get(cfg.cookieName)?.value;
  if (!cfg.enabled || !sid) return privateReportResponse(errorResponse(401, "AUTH_REQUIRED", "Authentication required"));
  let query;
  try { query = analysisSearch(new URL(request.url).searchParams); }
  catch { return privateReportResponse(errorResponse(400, "ANALYSIS_INVALID_FILTER", "Invalid analysis filter")); }
  try { return privateReportResponse(Response.json(await analysisForSession(sid).read(query))); }
  catch (error) { return analysisHttpError(error); }
}
export async function POST(request: Request) {
  const cfg = getOidcConfig(), sid = (await cookies()).get(cfg.cookieName)?.value;
  return reportCommand(request, { enabled: cfg.enabled, sid, appOrigin: cfg.appOrigin }, saveAnalysisPreference,
    (id, command) => analysisForSession(id).save(command), 200, analysisHttpError);
}
