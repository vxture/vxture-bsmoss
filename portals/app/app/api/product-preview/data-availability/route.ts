import { previewAvailability } from "../../../domains/data-updates/preview.ts";
import { UPDATE_FAMILIES, type UpdateFamily } from "../../../domains/data-updates/rules.ts";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
  if (process.env.BSMOSS_PRODUCT_PREVIEW !== "on") return new Response(null, { status: 404, headers });
  if (request.url.length > 1000) return Response.json({ error: "request_too_large" }, { status: 413, headers });
  const query = new URL(request.url).searchParams, family = query.get("family");
  if (query.size !== 1 || query.getAll("family").length !== 1 || !UPDATE_FAMILIES.includes(family as UpdateFamily)) return Response.json({ error: "invalid_data_family" }, { status: 400, headers });
  return Response.json(previewAvailability(family as UpdateFamily), { headers });
}
