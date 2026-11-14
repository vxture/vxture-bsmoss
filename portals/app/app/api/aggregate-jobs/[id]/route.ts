import { cookies } from "next/headers";
import { getOidcConfig } from "../../../auth/lib/config";
import { aggregateJobsForSession } from "../../../domains/access/runtime";
import { normalizeJobQuery } from "../../../domains/supervision/jobs";
import { privateJobResponse, jobHttpError } from "../../../domains/supervision/http";
import { errorResponse } from "../../../platform/envelope";

export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const cfg = getOidcConfig(), sid = (await cookies()).get(cfg.cookieName)?.value;
  if (!cfg.enabled || !sid) return privateJobResponse(errorResponse(401, "AUTH_REQUIRED", "Authentication required"));
  let query; try { if (new URL(request.url).search) throw Error("invalid_filter"); query = normalizeJobQuery({ jobId: (await context.params).id }); }
  catch { return privateJobResponse(errorResponse(400, "JOB_INVALID_FILTER", "Invalid filter")); }
  try { const result = await aggregateJobsForSession(sid).read(query); return privateJobResponse(result ? Response.json(result) : errorResponse(404, "JOB_UNAVAILABLE", "Job unavailable")); }
  catch (error) { return jobHttpError(error); }
}
