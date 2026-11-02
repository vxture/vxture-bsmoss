import { cookies } from "next/headers";
import { getOidcConfig } from "../../auth/lib/config";
import { reportsForSession } from "../../domains/access/runtime";
import { normalizeGenerateReport } from "../../domains/reports/rules";
import { normalizeReportListQuery } from "../../domains/reports/list";
import { privateReportResponse, reportCommand, reportHttpError } from "../../domains/reports/http";
import { errorResponse } from "../../platform/envelope";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const cfg = getOidcConfig(), sid = (await cookies()).get(cfg.cookieName)?.value;
  if (!cfg.enabled || !sid) return privateReportResponse(errorResponse(401, "AUTH_REQUIRED", "Authentication required"));
  let query;
  try {
    const p = new URL(request.url).searchParams;
    if (p.toString().length > 4096 || [...p.keys()].some(k => !["limit", "after"].includes(k)) || ["limit", "after"].some(k => p.getAll(k).length > 1) || p.has("limit") && !/^[1-9]\d?$/.test(p.get("limit")!)) throw Error("invalid_report_filter");
    query = normalizeReportListQuery({ limit: Number(p.get("limit") ?? "20"), ...(p.has("after") ? { after: p.get("after")! } : {}) });
  } catch { return privateReportResponse(errorResponse(400, "REPORT_INVALID_FILTER", "Invalid filter")); }
  try { return privateReportResponse(Response.json(await reportsForSession(sid).list(query))); } catch (error) { return reportHttpError(error); }
}
export async function POST(request: Request) {
  const cfg = getOidcConfig(), sid = (await cookies()).get(cfg.cookieName)?.value;
  return reportCommand(request, { enabled: cfg.enabled, sid, appOrigin: cfg.appOrigin }, normalizeGenerateReport, (id, command) => reportsForSession(id).generate(command));
}
