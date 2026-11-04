import { serializeSelection } from "../domains/map-demo/geometry";
import type { MapQuery } from "../domains/map-demo/types";
export const BUSINESS_ROUTES = { capacity: "/capacity", efficiency: "/efficiency", "operator-usage": "/operator-usage", "usage-reports": "/usage-reports" } as const;
export type BusinessKind = keyof typeof BUSINESS_ROUTES;
export type BusinessScope = Pick<MapQuery, "cityId" | "countyId" | "operator" | "hour" | "selection" | "search"> & { period: "hour" | "day" | "week" | "month"; topic: "capacity" | "power" | "efficiency" };
export function scopeParams(q: BusinessScope) {
  const p = new URLSearchParams({ city: q.cityId, county: q.countyId, operator: q.operator, hour: String(q.hour), period: q.period });
  if (q.selection) p.set("selection", serializeSelection(q.selection));
  if (q.search) p.set("search", q.search);
  return p;
}
export function businessHref(kind: BusinessKind, q: BusinessScope) {
  const p = scopeParams(q);
  if (kind === "efficiency") p.set("topic", q.topic === "power" ? "power" : "efficiency");
  if (kind === "capacity") p.delete("period");
  if (kind === "efficiency") p.delete("period");
  if (kind === "usage-reports" && q.period === "hour") p.set("period", "day");
  return BUSINESS_ROUTES[kind] + "?" + p;
}
export function businessMapHref(kind: BusinessKind, q: BusinessScope, site?: string) {
  const p = scopeParams(q); p.delete("period");
  if (kind === "capacity" || kind === "efficiency") p.set("topic", kind === "capacity" ? "capacity" : q.topic);
  else p.set(kind === "operator-usage" ? "usage" : "report", kind === "usage-reports" && q.period === "hour" ? "day" : q.period);
  if (site) p.set("site", site);
  return "/product-preview?" + p;
}
