import { cookies } from "next/headers";
import { getOidcConfig } from "../../../auth/lib/config";
import { objectRollupForSession } from "../../../domains/access/runtime";
import { parseRollupQuery } from "../../../domains/aggregation/object-rollup";
import { errorResponse } from "../../../platform/envelope";

export const dynamic = "force-dynamic";
function privateResponse(response: Response) {
  response.headers.set("cache-control", "no-store"); response.headers.set("x-content-type-options", "nosniff"); response.headers.set("vary", "Cookie");
  return response;
}
export async function GET(request: Request) {
  const cfg = getOidcConfig(), sid = (await cookies()).get(cfg.cookieName)?.value;
  if (!cfg.enabled || !sid) return privateResponse(errorResponse(401, "AUTH_REQUIRED", "Authentication required"));
  let query;
  try { query = parseRollupQuery(new URL(request.url).searchParams); }
  catch { return privateResponse(errorResponse(400, "ROLLUP_INVALID_FILTER", "Invalid filter")); }
  try {
    const result = await objectRollupForSession(sid).read(query);
    if (!result) return privateResponse(errorResponse(404, "ROLLUP_UNAVAILABLE", "Rollup unavailable"));
    return privateResponse(Response.json(result));
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (["identity_required", "access_expired"].includes(code)) return privateResponse(errorResponse(401, "AUTH_REQUIRED", "Authentication required"));
    if (["feature_denied", "permission_denied"].includes(code)) return privateResponse(errorResponse(403, "POLICY_DENIED", "Access denied"));
    if (["rollup_scope_denied", "rollup_atom_unavailable", "rollup_paused", "aggregate_scope_denied", "aggregate_dependency_scope_denied", "object_scope_denied"].includes(code))
      return privateResponse(errorResponse(404, "ROLLUP_UNAVAILABLE", "Rollup unavailable"));
    if (code === "rollup_period_boundary") return privateResponse(errorResponse(400, "ROLLUP_PERIOD_UNSUPPORTED", "Period crosses configuration validity"));
    return privateResponse(errorResponse(503, "ROLLUP_UNAVAILABLE", "Rollup query temporarily unavailable", { retryable: true }));
  }
}
