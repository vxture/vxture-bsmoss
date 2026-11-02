import { cookies } from "next/headers";
import { getOidcConfig } from "../../auth/lib/config";
import { aggregateQueryForSession } from "../../domains/access/runtime";
import { parseAggregateQuery } from "../../domains/aggregation/query";
import { errorResponse } from "../../platform/envelope";

export const dynamic = "force-dynamic";
function privateResponse(response: Response) {
  response.headers.set("cache-control", "no-store"); response.headers.set("x-content-type-options", "nosniff"); response.headers.set("vary", "Cookie");
  return response;
}
export async function GET(request: Request) {
  const cfg = getOidcConfig(), sid = (await cookies()).get(cfg.cookieName)?.value;
  if (!cfg.enabled || !sid) return privateResponse(errorResponse(401, "AUTH_REQUIRED", "Authentication required"));
  let filter;
  try { filter = parseAggregateQuery(new URL(request.url).searchParams); }
  catch { return privateResponse(errorResponse(400, "AGGREGATE_INVALID_FILTER", "Invalid filter")); }
  try {
    const result = await aggregateQueryForSession(sid).read(filter);
    if (!result) return privateResponse(errorResponse(404, "AGGREGATE_NOT_PUBLISHED", "Aggregate revision not published"));
    return privateResponse(Response.json(result));
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (["identity_required", "access_expired"].includes(code)) return privateResponse(errorResponse(401, "AUTH_REQUIRED", "Authentication required"));
    if (["feature_denied", "permission_denied"].includes(code)) return privateResponse(errorResponse(403, "POLICY_DENIED", "Access denied"));
    // A selector outside current scope must not reveal whether a series exists.
    if (["aggregate_scope_denied", "aggregate_dependency_scope_denied", "object_scope_denied", "aggregate_mapping_unavailable"].includes(code))
      return privateResponse(errorResponse(404, "AGGREGATE_UNAVAILABLE", "Aggregate selector unavailable"));
    return privateResponse(errorResponse(503, "AGGREGATE_UNAVAILABLE", "Aggregate query temporarily unavailable", { retryable: true }));
  }
}
