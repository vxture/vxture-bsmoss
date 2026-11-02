import { cookies } from "next/headers";
import { getOidcConfig } from "../../auth/lib/config";
import { reportJobsForSession } from "../../domains/access/runtime";
import { privateJobResponse, jobHttpError } from "../../domains/supervision/http";
import { reportJobListFromUrl } from "../../domains/supervision/report-http";
import { errorResponse } from "../../platform/envelope";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const cfg = getOidcConfig(), sid = (await cookies()).get(cfg.cookieName)?.value;
  if (!cfg.enabled || !sid) return privateJobResponse(errorResponse(401, "AUTH_REQUIRED", "Authentication required"));
  let query; try { query = reportJobListFromUrl(new URL(request.url)); } catch { return privateJobResponse(errorResponse(400, "JOB_INVALID_FILTER", "Invalid filter")); }
  try { return privateJobResponse(Response.json(await reportJobsForSession(sid).list(query))); } catch (error) { return jobHttpError(error); }
}
