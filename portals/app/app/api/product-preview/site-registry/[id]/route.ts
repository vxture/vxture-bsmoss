import { demoDataEnabled } from "../../../../lib/demo-mode";
import { assetDetail } from "../../../../domains/site-registry/asset-model";
import { parseSiteQuery } from "../../../../domains/site-registry/rules";
import { DEMO_REGION } from "../../../../domains/map-demo/resources";
import { registryMaintenanceStore } from "../../../../domains/site-registry/maintenance-store";
import { canMaintainAssets } from "../../../../domains/site-registry/maintenance-access";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!demoDataEnabled()) return new Response(null, { status: 404 });
  if (request.url.length > 3000) return Response.json({ error: "request_too_large" }, { status: 413 });
  const headers = { "Cache-Control": "no-store" };
  try {
    const params = new URL(request.url).searchParams, input: Record<string, string> = Object.create(null);
    for (const [key, value] of params) {
      if (Object.hasOwn(input, key)) throw Error("duplicate_query");
      input[key] = value;
    }
    parseSiteQuery(input, DEMO_REGION);
  } catch { return Response.json({ error: "invalid_site_query" }, { status: 400, headers }); }
  try {
    const detail = assetDetail((await context.params).id, await registryMaintenanceStore().read(), canMaintainAssets());
    return detail ? Response.json(detail, { headers }) : Response.json({ error: "site_not_in_scope" }, { status: 404, headers });
  } catch { return Response.json({ error: "maintenance_unavailable" }, { status: 503, headers }); }
}
