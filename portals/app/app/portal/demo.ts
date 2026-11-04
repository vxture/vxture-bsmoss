import { DEMO_DATE, siteHour } from "../domains/map-demo/rules";
import { DEMO_REGION, DEMO_SITES } from "../domains/map-demo/resources";
import { parseMapQuery, queryMap, queryOperatorUsage } from "../domains/map-demo/service";

// No measurement store, credentials, permissions or mutable records belong here.
export function portalDemoSummary(input: Record<string, string | string[] | undefined> = {}) {
  const params = new URLSearchParams({ hour: "18" });
  for (const [key, value] of Object.entries(input)) {
    if (!["city", "county"].includes(key) || typeof value !== "string") throw Error("invalid_overview_scope");
    params.set(key === "city" ? "cityId" : "countyId", value);
  }
  const query = parseMapQuery(params);
  const snapshot = queryMap(query);
  const usage = queryOperatorUsage(new URLSearchParams({ period: "day", hour: String(query.hour), cityId: query.cityId, countyId: query.countyId }));
  // Aggregate the whole selected cohort, independently of the map rendering limit.
  const current = DEMO_SITES.filter(site => site.regionId === query.regionId && (query.cityId === "all" || site.cityId === query.cityId)
    && (query.countyId === "all" || site.countyId === query.countyId)).map(site => siteHour(site, query.hour));
  return {
    date: DEMO_DATE, hour: query.hour, version: snapshot.version,
    query, region: DEMO_REGION, status: snapshot.summary, usage,
    runtime: { battery: current.filter(m => m.power === "battery").length, hot: current.filter(m => m.temperature >= 35).length },
    cities: DEMO_REGION.cities.filter(city => query.cityId === "all" || city.id === query.cityId)
      .map(city => ({ id: city.id, name: city.name, ...queryMap({ ...query, cityId: city.id }).summary }))
      .sort((a, b) => b.bytes - a.bytes || a.id.localeCompare(b.id)),
    priorities: snapshot.ranking.filter(site => site.status !== "normal")
      .map(site => ({ ...site, city: DEMO_REGION.cities.find(city => city.id === site.cityId)!.name })),
  };
}
export type PortalDemo = ReturnType<typeof portalDemoSummary>;
