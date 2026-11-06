import {resourceGraph} from './resource-rules';
import { DEMO_REGION, DEMO_SITES } from "../map-demo/resources";
import { DEMO_DATE, DEMO_VERSION, siteHour, findingsFor } from "../map-demo/rules";
import { analyzeCalendarUsage } from "../map-demo/period-rules";
import { queryStationPeriod } from "../map-demo/service";
import type { DemoSite } from "../map-demo/types";
import { syntheticSiteType } from "../map-demo/site-attributes";
import { filterSites, parseSiteQuery, sortSites, type SiteQuery, type SiteRecord } from "./rules";
export const SITE_DEMO_VERSION = "bsmoss-site-registry-demo-v1";
export const SITE_PAGE_SIZE = 20;
function record(site: DemoSite, hour: number): SiteRecord {
  const cityName = DEMO_REGION.cities.find(c => c.id === site.cityId)!.name;
  const countyName = DEMO_REGION.counties.find(c => c.id === site.countyId)!.name;
  return { ...site, cityName, countyName, current: siteHour(site, hour),
    siteType: syntheticSiteType(site),
    towerType: site.profile === "urban" ? "\u697c\u9762\u62b1\u6746" : site.profile === "mountain" ? "\u89d2\u94a2\u5854" : "\u5355\u7ba1\u5854",
    heightMeters: site.profile === "urban" ? 18 + site.seed % 8 : 30 + site.seed % 26,
    roomType: site.seed % 3 === 0 ? "\u4e00\u4f53\u5316\u673a\u67dc" : "\u6807\u51c6\u673a\u623f",
    commissioned: (2016 + site.seed % 9) + "-" + String(1 + site.seed % 12).padStart(2, "0") + "-01",
    assetCode: "TT-" + site.id, address: cityName + countyName + " \u00b7 " + site.name + " \u00b7 \u4f4d\u7f6e\u5f85\u6838\u9a8c",
  };
}
// Synthetic adapter only. No identity, production records or mutable evidence.
export function registryDemo(input: Record<string, string | string[] | undefined>) {
  const q = parseSiteQuery(input, DEMO_REGION), all = DEMO_SITES.map(site => record(site, q.hour));
  const filtered = filterSites(all, q), ordered = sortSites(filtered, q);
  const relationRows = ordered.flatMap(site => {
    const graph=resourceGraph(site,DEMO_DATE,DEMO_VERSION);
    return graph.relations.filter(r=>q.operator==='all'||r.code===q.operator).map(resource=>({
      id:resource.id,site,code:resource.code,current:siteHour(site,q.hour,resource.code),resource,
      sharedResourceCount:graph.devices.filter(d=>d.relationId===null).length,
    }));
  });
  const count = q.view === "sites" ? ordered.length : relationRows.length;
  const pages = Math.max(1, Math.ceil(count / SITE_PAGE_SIZE)), page = Math.min(q.page, pages);
  const start = (page - 1) * SITE_PAGE_SIZE;
  return { mode: "demo" as const, version: SITE_DEMO_VERSION, date: DEMO_DATE, query: { ...q, page }, pageSize: SITE_PAGE_SIZE, pages, count,
    rows: ordered.slice(start, start + SITE_PAGE_SIZE), relations: relationRows.slice(start, start + SITE_PAGE_SIZE),
    operatorLoads: Object.fromEntries(ordered.slice(start, start + SITE_PAGE_SIZE).map(site => [site.id, site.operators.map(code => {
      const current = siteHour(site, q.hour, code);
      return { code, load: current.used / current.capacity };
    })])),
    summary: { sites: filtered.length, relations: relationRows.length, shared: filtered.filter(s => s.operators.length >= 2).length,
      multi: filtered.filter(s => s.operators.length >= 3).length, attention: filtered.filter(s => s.current.status !== "normal").length },
    regions: { id: DEMO_REGION.id, name: DEMO_REGION.name, cities: DEMO_REGION.cities.map(c => ({ id: c.id, name: c.name, count: all.filter(s => s.cityId === c.id).length })),
      counties: DEMO_REGION.counties.map(c => ({ id: c.id, cityId: c.cityId, name: c.name, count: all.filter(s => s.countyId === c.id).length })) },
  };
}
export function dossierDemo(id: string, input: Record<string, string | string[] | undefined>) {
  const q = parseSiteQuery(input, DEMO_REGION), raw = DEMO_SITES.find(s => s.id === id);
  if (!raw) return null;
  const site = record(raw, q.hour), series = Array.from({ length: 24 }, (_, h) => siteHour(site, h));
  const query = { regionId: site.regionId, cityId: "all", countyId: "all", operator: "all" as const, hour: q.hour, search: "" };
  // A dossier always shows all tenants of this physical site, independently of the list filter.
  const resources = resourceGraph(site, DEMO_DATE, DEMO_VERSION);
  const relations = site.operators.map(code => ({ id: site.id + "-" + code, code, resource:resources.relations.find(r=>r.code===code)!, current: siteHour(site, q.hour, code),
    usage: analyzeCalendarUsage([site], { ...query, operator: code }, q.period) }));
  const period = queryStationPeriod(id, new URLSearchParams({ period: q.period, hour: String(q.hour) }))!;
  return { mode: "demo" as const, version: SITE_DEMO_VERSION, sourceVersion: DEMO_VERSION, date: DEMO_DATE, query: q,
    site, series, relations, devices: resources.devices, resources, findings: findingsFor(site, site.current),
    period: { usage: period.usage, previous: period.previous, days: period.days, changes: period.changes, findings: period.findings },
  };
}
export type RegistryDemo = ReturnType<typeof registryDemo>;
export type DossierDemo = NonNullable<ReturnType<typeof dossierDemo>>;
