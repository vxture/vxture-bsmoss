import { serializeSelection } from "../map-demo/geometry";
import type { ReviewQuery } from "./query";
export function reviewParams(q: ReviewQuery) {
  const p = new URLSearchParams({ city: q.scope.cityId, county: q.scope.countyId, operator: q.scope.operator, period: q.period, metric: q.metric, category: q.category, status: q.status, page: String(q.page) });
  if (q.scope.search) p.set("search", q.scope.search);
  if (q.scope.selection) p.set("selection", serializeSelection(q.scope.selection));
  return p;
}
export function reviewHref(q: ReviewQuery, id?: string) {
  if (id !== undefined && !/^UV-[a-f0-9]{24}$/.test(id)) throw Error("invalid_review_id");
  return "/usage-review" + (id ? "/" + id : "") + "?" + reviewParams(q);
}
export function reviewMapHref(q: ReviewQuery, site?: string) {
  const p = new URLSearchParams({ city: q.scope.cityId, county: q.scope.countyId, operator: q.scope.operator, hour: String(q.scope.hour) });
  if (q.scope.selection) p.set("selection", serializeSelection(q.scope.selection));
  if (q.scope.search) p.set("search", q.scope.search);
  if (site) p.set("site", site);
  return "/product-preview?" + p;
}
