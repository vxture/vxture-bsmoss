import { normalizeRegion, type RegionCatalog, type RegionSelection } from "./region-selection";

export type RegionInput = Record<string, string | string[] | undefined>;
export interface RegionPreference {
  catalog: RegionCatalog | null;
  selection: RegionSelection;
  cookieName: string;
}
export const PROVINCE_SCOPE: RegionSelection = { cityId: "all", countyId: "all" };
export function decodeRegionPreference(catalog: RegionCatalog, text?: string): RegionSelection | null {
  const parts = text?.split(".");
  if (!parts || parts.length !== 4 || parts[0] !== "v1" || parts[1] !== catalog.id) return null;
  const value = { cityId: parts[2], countyId: parts[3] }, valid = normalizeRegion(catalog, value);
  return valid.cityId === value.cityId && valid.countyId === value.countyId ? valid : null;
}
export function encodeRegionPreference(catalog: RegionCatalog, value: RegionSelection): string {
  const valid = normalizeRegion(catalog, value);
  return ["v1", catalog.id, valid.cityId, valid.countyId].join(".");
}
export function inheritRegionInput(input: RegionInput, value: RegionSelection): RegionInput {
  // Explicit links, including province/all and invalid parameters, own the page.
  // Never combine a remembered county with a newly specified city.
  return input.city !== undefined || input.county !== undefined ? input : { ...input, city: value.cityId, county: value.countyId };
}
export const REGION_PAGES = ["/", "/board", "/sites", "/capacity", "/efficiency", "/operator-usage", "/usage-reports", "/usage-review", "/review-history", "/analysis", "/reports", "/product-preview"];
export function isRegionPage(path: string): boolean {
  return REGION_PAGES.includes(path) || /^\/(sites|usage-review)\/[^/]+$/.test(path) || path === "/analysis/report";
}
export function regionLink(href: string, value: RegionSelection): string {
  const [path, query = ""] = href.split("?");
  if (!REGION_PAGES.includes(path)) return href;
  const params = new URLSearchParams(query);
  params.set("city", value.cityId); params.set("county", value.countyId);
  return path + "?" + params;
}
export function changedRegionHref(path: string, query: string, value: RegionSelection): string {
  const detail = /^\/(sites|usage-review)\/[^/]+$/.exec(path);
  const target = path==="/analysis/report"?"/analysis":detail ? "/" + detail[1] : path, params = new URLSearchParams(detail||path==="/analysis/report" ? "" : query);
  for (const key of ["page", "site", "selection", "compare", "bbox", "search", "report", "revision", "evidence", "slot", "peerLevel", "recordSession", "event", "investigation", "saved"]) params.delete(key);
  params.set("city", value.cityId); params.set("county", value.countyId);
  return target + "?" + params;
}
