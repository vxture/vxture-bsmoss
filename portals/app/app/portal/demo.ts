import { DEMO_DATE } from "../domains/map-demo/rules";
import { DEMO_REGION } from "../domains/map-demo/resources";
import { parseMapQuery, queryMap, queryOperatorUsage } from "../domains/map-demo/service";

// No measurement store, credentials, permissions or mutable records belong here.
export function portalDemoSummary() {
  const query = parseMapQuery(new URLSearchParams({ hour: "18" }));
  const snapshot = queryMap(query);
  const usage = queryOperatorUsage(new URLSearchParams({ period: "day", hour: "18" }));
  return {
    date: DEMO_DATE, hour: query.hour, version: snapshot.version,
    status: snapshot.summary, usage,
    cities: DEMO_REGION.cities.map(city => ({ id: city.id, name: city.name, ...queryMap({ ...query, cityId: city.id }).summary }))
      .sort((a, b) => b.bytes - a.bytes || a.id.localeCompare(b.id)),
    priorities: snapshot.ranking.map(site => ({ ...site, city: DEMO_REGION.cities.find(city => city.id === site.cityId)!.name })),
  };
}
export type PortalDemo = ReturnType<typeof portalDemoSummary>;
