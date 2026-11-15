import { parseMapQuery } from "../domains/map-demo/service";
import generated from "./generated-home.json";

export interface HomeSummary {
 date: string; hour: number; occupiedSites: number; healthTotal: number; attentionSites: number;
 usage: { physicalSites: number; sharedSites: number };
 report: { energyWh: number; previousEnergyWh: number; days: number; previousDays: number; window: { start: string } };
}
export interface HomeGrowthSummary { net:number; entered:number; exited:number; current:number }
export function readHomeSummary(input: Record<string,string|string[]|undefined>) {
 if([input.city,input.county].some(value=>value!==undefined&&typeof value!=="string"))throw Error("invalid_home_scope");
 const query = parseMapQuery(new URLSearchParams({cityId:String(input.city??"all"),countyId:String(input.county??"all"),hour:"18"}));
 const key = query.cityId + ":" + query.countyId;
 if(generated.schema!=="bsmoss-home-v1")throw Error("home_summary_stale");
 const row = (generated.rows as Record<string,{demo:HomeSummary;growth:HomeGrowthSummary}>)[key];
 if(!row)throw Error("invalid_home_scope");
 return row;
}
