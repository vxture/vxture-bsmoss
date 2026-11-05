import { DEMO_DATE } from "../domains/map-demo/rules";
import { DEMO_REGION } from "../domains/map-demo/resources";
import { parseMapQuery, queryMap, queryOperatorUsage } from "../domains/map-demo/service";

export function parseBoardQuery(input: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (!["city", "county", "hour"].includes(key) || typeof value !== "string") throw Error("invalid_board_query");
    params.set(key === "city" ? "cityId" : key === "county" ? "countyId" : key, value);
  }
  return parseMapQuery(params);
}
// Reuse the same synthetic rules as the workbench; never read formal stores.
export function boardDemo(input: Record<string, string | string[] | undefined>) {
  const query = parseBoardQuery(input);
  const snapshot = queryMap(query);
  return {
    date: DEMO_DATE, hour: query.hour, cityId: query.cityId, countyId: query.countyId, snapshot,
    region: { id: DEMO_REGION.id, name: DEMO_REGION.name, counties: DEMO_REGION.counties, center: DEMO_REGION.center, bounds: DEMO_REGION.bounds, boundaryUrl: DEMO_REGION.boundaryUrl,
      cities: DEMO_REGION.cities },
    cities: DEMO_REGION.cities.map(city => ({
      id: city.id, name: city.name, ...queryMap({ ...query, cityId: city.id, countyId: "all" }).summary,
    })).sort((a, b) => b.bytes - a.bytes || a.id.localeCompare(b.id)),
    series: Array.from({ length: 24 }, (_, hour) => ({ hour, ...queryMap({ ...query, hour }).summary })),
    usage: queryOperatorUsage(new URLSearchParams({ cityId: query.cityId, countyId: query.countyId, hour: String(query.hour), period: "hour" })),
  };
}
export type BoardDemo = ReturnType<typeof boardDemo>;
