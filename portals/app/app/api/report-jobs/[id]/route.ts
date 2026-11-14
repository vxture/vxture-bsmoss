import { cookies } from "next/headers";
import { getOidcConfig } from "../../../auth/lib/config";
import { reportJobsForSession } from "../../../domains/access/runtime";
import { privateJobResponse, jobHttpError } from "../../../domains/supervision/http";
import { reportJobQueryFromUrl } from "../../../domains/supervision/report-http";
import { errorResponse } from "../../../platform/envelope";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const cfg = getOidcConfig(), sid = (await cookies()).get(cfg.cookieName)?.value;
  if (!cfg.enabled || !sid) return privateJobResponse(errorResponse(401, "AUTH_REQUIRED", "Authentication required"));
  let query; try { query = reportJobQueryFromUrl(new URL(request.url), (await context.params).id); } catch { return privateJobResponse(errorResponse(400, "JOB_INVALID_FILTER", "Invalid filter")); }
  try {
    const result = await reportJobsForSession(sid).read(query);
    return privateJobResponse(result ? Response.json(result) : errorResponse(404, "JOB_UNAVAILABLE", "Job unavailable"));
  } catch (error) { return jobHttpError(error); }
}
