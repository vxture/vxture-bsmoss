import {n} from "../sites/labels";
import {DEFAULT_CAPACITY_PARAMETERS,capacityMetricLevel,type CapacityParameters} from "../domains/capacity/parameters";
export function capacityMetricTone(value:number|null,metric:"load"|"connection",parameters:CapacityParameters=DEFAULT_CAPACITY_PARAMETERS){
 const level=capacityMetricLevel(value,metric,parameters);return level==="warning"||level==="critical"?level:undefined;
}
export function capacityMetricClass(value:number|null,metric:"load"|"connection",parameters:CapacityParameters=DEFAULT_CAPACITY_PARAMETERS){
 const tone=capacityMetricTone(value,metric,parameters);return tone?"site-analysis-tone-"+tone:value===null?"text-muted-foreground":"text-foreground";
}
export const capacityPercent=(value:number|null)=>value===null?"--":n(value*100,2)+"%";
export const capacityTitle="\u627f\u8f7d\u80fd\u529b";
export const capacityPeriodCaption=(period:{label:string;observed:number;expected:number;daily:boolean})=>period.label+" \u00b7 \u6709\u6548 "+period.observed+"/"+period.expected+(period.daily?" \u5929":" \u5c0f\u65f6");
export const capacityFilterNames:Record<string,string>={all:"\u5168\u90e8",high:"\u9ad8\u8d1f\u8f7d",connection:"\u4f4e\u63a5\u901a",both:"\u53cc\u547d\u4e2d",unknown:"\u7f3a\u6570"};
export const capacityLevelNames={normal:"\u6b63\u5e38",warning:"\u5173\u6ce8",critical:"\u4e25\u91cd",unknown:"\u4e0d\u53ef\u8bc4\u4f30"};
export const capacityLevelTones={normal:"success",warning:"warning",critical:"danger",unknown:"neutral"} as const;
export function capacityReason(row:{highLoad:boolean;lowConnection:boolean;load:number|null;connection:number|null}) {
 return [row.highLoad?"\u9ad8\u8d1f\u8f7d":null,row.lowConnection?"\u4f4e\u63a5\u901a":null,row.load===null?"\u5bb9\u91cf\u672a\u77e5":null,row.connection===null?"\u63a5\u901a\u672a\u77e5":null].filter(Boolean).join("\u3001")||"\u672a\u547d\u4e2d\u89c4\u5219";
}
