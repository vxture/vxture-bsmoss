import type { DemoSite, HourMetrics, Operator, Profile, RegionDefinition } from "../map-demo/types";
export const SITE_TABS = ["overview", "resources", "services", "runtime", "business", "sources"] as const;
export type SiteTab = typeof SITE_TABS[number];
export type SiteType = "ground" | "rooftop";
export type SiteQuery = {
  siteType: "all" | SiteType;
  city: string; county: string; operator: string; status: string; sharing: string; scene: string;
  search: string; view: "sites" | "relations"; sort: "name" | "operators" | "load"; direction: "asc" | "desc";
  page: number; hour: number; tab: SiteTab; period: "day" | "week" | "month";
};
export interface SiteRecord extends DemoSite {
  siteType: SiteType;
  cityName: string; countyName: string; towerType: string; heightMeters: number;
  roomType: string; commissioned: string; assetCode: string; address: string; current: HourMetrics;
}
export const DEFAULT_SITE_QUERY: SiteQuery = { siteType: "all", city: "all", county: "all", operator: "all", status: "all", sharing: "all", scene: "all",
  search: "", view: "sites", sort: "name", direction: "asc", page: 1, hour: 18, tab: "overview", period: "day" };
export function parseSiteQuery(input: Record<string, string | string[] | undefined>, region: RegionDefinition): SiteQuery {
  const q = { ...DEFAULT_SITE_QUERY };
  for (const [key, value] of Object.entries(input)) {
    if (!Object.hasOwn(q, key) || typeof value !== "string") throw Error("invalid_site_query");
    if (["page", "hour"].includes(key)) {
      if (!/^(0|[1-9]\d*)$/.test(value)) throw Error("invalid_site_number");
      Object.assign(q, { [key]: Number(value) });
    } else Object.assign(q, { [key]: value });
  }
  if (q.city !== "all" && !region.cities.some(c => c.id === q.city)) throw Error("invalid_site_city");
  if (q.county !== "all" && !region.counties.some(c => c.id === q.county && c.cityId === q.city)) throw Error("invalid_site_county");
  const valid = (value: string, values: readonly string[]) => { if (!values.includes(value)) throw Error("invalid_site_filter"); };
  valid(q.operator, ["all", "mobile", "telecom", "unicom", "broadcast", "other"]);
  valid(q.siteType, ["all", "ground", "rooftop"]);
  valid(q.status, ["all", "normal", "warning", "critical"]); valid(q.sharing, ["all", "single", "shared", "multi"]);
  valid(q.scene, ["all", "urban", "hub", "industrial", "mountain", "efficient", "shared"]);
  valid(q.view, ["sites", "relations"]); valid(q.sort, ["name", "operators", "load"]); valid(q.direction, ["asc", "desc"]);
  valid(q.tab, SITE_TABS); valid(q.period, ["day", "week", "month"]);
  q.search = q.search.trim();
  if (q.search.length > 80 || !Number.isSafeInteger(q.page) || q.page < 1 || q.page > 100000 ||
    !Number.isInteger(q.hour) || q.hour < 0 || q.hour > 23) throw Error("invalid_site_range");
  return q;
}
export function siteQueryString(q: SiteQuery, patch: Partial<SiteQuery> = {}) {
  const params = new URLSearchParams(), next = { ...q, ...patch };
  for (const key of Object.keys(DEFAULT_SITE_QUERY) as (keyof SiteQuery)[])
    if (next[key] !== DEFAULT_SITE_QUERY[key]) params.set(key, String(next[key]));
  return params.toString();
}
export function siteListHref(q: SiteQuery, patch: Partial<SiteQuery> = {}) {
  const query = siteQueryString(q, { ...patch, tab: "overview", period: "day" }); return "/sites" + (query ? "?" + query : "");
}
export function siteDetailHref(id: string, q: SiteQuery, patch: Partial<SiteQuery> = {}) {
  const query = siteQueryString(q, patch); return "/sites/" + encodeURIComponent(id) + (query ? "?" + query : "");
}
export function filterSites(records: readonly SiteRecord[], q: SiteQuery) {
  const text = q.search.toLocaleLowerCase();
  return records.filter(s => (q.city === "all" || s.cityId === q.city) && (q.county === "all" || s.countyId === q.county)
    && (q.siteType === "all" || s.siteType === q.siteType)
    && (q.operator === "all" || s.operators.includes(q.operator as Operator)) && (q.status === "all" || s.current.status === q.status)
    && (q.scene === "all" || s.profile === q.scene as Profile)
    && (q.sharing === "all" || (q.sharing === "single" ? s.operators.length === 1 : q.sharing === "multi" ? s.operators.length >= 3 : s.operators.length >= 2))
    && (!text || [s.id, s.name, s.address, s.assetCode].some(v => v.toLocaleLowerCase().includes(text))));
}
export function sortSites(records: readonly SiteRecord[], q: SiteQuery) {
  return [...records].sort((a, b) => {
    const delta = q.sort === "operators" ? a.operators.length - b.operators.length :
      q.sort === "load" ? a.current.used / a.current.capacity - b.current.used / b.current.capacity : a.name.localeCompare(b.name, "zh-CN");
    return (q.direction === "asc" ? delta : -delta) || a.id.localeCompare(b.id);
  });
}
