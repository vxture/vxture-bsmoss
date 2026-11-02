import { cookies } from "next/headers";
import { getOidcConfig } from "../../auth/lib/config";
import { measurementsForSession } from "../../domains/access/runtime";
import { errorResponse } from "../../platform/envelope";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const cfg = getOidcConfig();
  const sid = (await cookies()).get(cfg.cookieName)?.value;
  if (!cfg.enabled || !sid) return errorResponse(401, "AUTH_REQUIRED", "Authentication required");
  const params = new URL(request.url).searchParams;
  const allowed = ["stationId", "metricCode", "metricVersion", "from", "to", "limit", "afterId"];
  if ([...params.keys()].some(key => !allowed.includes(key)) || allowed.some(key => params.getAll(key).length > 1)) return errorResponse(400, "MEASUREMENT_INVALID_FILTER", "Invalid filter");
  const filter = {
    stationId: params.get("stationId") ?? "", metric: { code: params.get("metricCode") ?? "", version: Number(params.get("metricVersion")) },
    from: params.get("from") ?? "", to: params.get("to") ?? "", limit: Number(params.get("limit") ?? "50"),
    ...(params.has("afterId") ? { afterId: params.get("afterId")! } : {}),
  };
  try {
    const result = await measurementsForSession(sid).list(filter);
    return Response.json(result, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (["identity_required", "access_expired"].includes(code)) return errorResponse(401, "AUTH_REQUIRED", "Authentication required");
    if (["feature_denied", "permission_denied"].includes(code)) return errorResponse(403, "POLICY_DENIED", "Access denied");
    if (/^(invalid_|unknown_|scope_)/.test(code)) return errorResponse(400, "MEASUREMENT_INVALID_FILTER", "Invalid or unavailable filter");
    return errorResponse(503, "MEASUREMENT_UNAVAILABLE", "Measurement query temporarily unavailable", { retryable: true });
  }
}
