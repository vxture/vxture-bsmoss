import {readInvestigation} from '../portal/investigation-server';
import {InvestigationProvider} from '../portal/investigation';
import { notFound } from "next/navigation";
import { initialWorkbench, parseMapQuery, queryMap } from "../domains/map-demo/service.ts";
import Workbench from "./workbench/workbench.tsx";
import { getRegionPreference } from "../portal/region-preference";
import { inheritRegionInput } from "../portal/region-scope";
import { normalizeRegion } from "../portal/region-selection";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.BSMOSS_PRODUCT_PREVIEW !== "on") notFound();
  const initial=initialWorkbench();
  const { preference } = await getRegionPreference();
  let extracted;try{extracted=readInvestigation(await searchParams);}catch{notFound();}
  const input = inheritRegionInput(extracted.input, preference.selection);
  const scope = normalizeRegion(initial.region, { cityId: typeof input.city === "string" ? input.city : "all", countyId: typeof input.county === "string" ? input.county : "all" });
  const hour = Number(input.hour ?? 18), operator = typeof input.operator === "string" && ["all", "mobile", "telecom", "unicom", "broadcast", "other"].includes(input.operator) ? input.operator : "all";
  const query = parseMapQuery(new URLSearchParams({ cityId: scope.cityId, countyId: scope.countyId, operator, hour: String(Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : 18) }));
  const snapshot = { ...queryMap(query), points: [] };
  return <InvestigationProvider journey={extracted.journey}><Workbench scenes={initial.scenes} region={initial.region} initialSnapshot={snapshot} regionPreference={preference}/></InvestigationProvider>;
}
