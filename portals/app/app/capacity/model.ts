import {siteAnalysisModel} from "../site-analysis/model";
import {defaultCapacityConfiguration,readCapacityConfiguration,capacityConfigurationPolicy,type CapacityConfiguration} from "../domains/capacity/parameters";
import {analysisWindow} from "../site-analysis/time-window";
import {DEMO_SITES} from "../domains/map-demo/resources";
import {DEMO_DATE,siteHour} from "../domains/map-demo/rules";
import {capacityObservation,summarizeCapacity} from "../domains/map-demo/capacity-rules";
import {evaluateCapacity,TOPIC_POLICY} from "../domains/map-demo/topic-rules";
import {sumCapacityCounters,capacityTimeBuckets} from "../domains/capacity/period";
import type {OperatorFilter,DemoSite,HourMetrics} from "../domains/map-demo/types";
export const capacityFilters=["all","high","connection","both","unknown"] as const;
export function capacityModel(input:Record<string,string|string[]|undefined>,rawConfiguration:CapacityConfiguration=defaultCapacityConfiguration()) {
 const configuration=readCapacityConfiguration(rawConfiguration),parameters=configuration.parameters;
 const {capacityFilter="all",topic,...base}=input;
 if(typeof capacityFilter!=="string"||!capacityFilters.includes(capacityFilter as typeof capacityFilters[number]))throw Error("invalid_capacity_filter");
 if(topic!==undefined&&topic!=="capacity")throw Error("invalid_capacity_topic");
 // An explicit legacy hour denotes an hourly snapshot, preserving incoming links.
 const normalized={...base,operatorCount:"all",sharing:"all",period:base.period??(base.hour!==undefined?"hour":"day"),asOf:base.asOf??(base.hour!==undefined?DEMO_DATE+"T"+String(base.hour).padStart(2,"0")+":00:00":DEMO_DATE+"T23:00:00")};
 const details=siteAnalysisModel(normalized),scope=siteAnalysisModel({...normalized,search:""});
 const window=analysisWindow(details.requestedAsOf,details.query.period),hour=Number(window.asOf.slice(11,13));
 const operator=details.query.operator as OperatorFilter,catalog=new Map(DEMO_SITES.map(s=>[s.id,s]));
 const cache=new Map<string,HourMetrics>();
 const sample=(site:DemoSite,at:string,code:OperatorFilter)=>{const key=site.id+":"+code+":"+at;let m=cache.get(key);if(!m){m=siteHour(site,Number(at.slice(11,13)),code);cache.set(key,m);}return m;};
 const counters=(site:DemoSite,times:readonly string[],code:OperatorFilter)=>sumCapacityCounters(times.map(at=>sample(site,at,code)));
 const observation=(site:DemoSite,times:readonly string[],code:OperatorFilter)=>{const value=counters(site,times,code);return {...capacityObservation(value,parameters),level:evaluateCapacity(value,parameters).level};};
 const observations=scope.rows.map(row=>({id:row.id,...observation(catalog.get(row.id)!,window.times,operator)}));
 const byId=new Map(observations.map(row=>[row.id,row]));
 const matches=(r:typeof observations[number],filter:string)=>filter==="all"||filter==="high"&&r.highLoad||filter==="connection"&&r.lowConnection||filter==="both"&&r.highLoad&&r.lowConnection||filter==="unknown"&&(r.load===null||r.connection===null);
 const searched=details.rows.map(row=>({...row,capacity:byId.get(row.id)!}));
 const facets=capacityFilters.map(value=>({value,count:searched.filter(r=>matches(r.capacity,value)).length}));
 const rank={critical:0,warning:1,unknown:2,normal:3};
 const rows=searched.filter(r=>matches(r.capacity,capacityFilter)).sort((a,b)=>rank[a.capacity.level]-rank[b.capacity.level]||(b.capacity.load??-1)-(a.capacity.load??-1)||(a.capacity.connection??1)-(b.capacity.connection??1)||a.id.localeCompare(b.id));
 const members=scope.rows.map(row=>catalog.get(row.id)!);
 const aggregate=(sites:typeof members,code:OperatorFilter=operator,times:readonly string[]=window.times)=>summarizeCapacity(sites.map(site=>counters(site,times,code)),parameters);
 const total={...aggregate(members),dataUnknown:observations.filter(r=>r.load===null||r.connection===null).length};
 const regions=scope.regions.map(region=>({...region,...aggregate(members.filter(s=>scope.query.city==="all"?s.cityId===region.id:s.countyId===region.id))}));
 const operators=scope.operators.map(row=>({code:row.code,...aggregate(members.filter(s=>s.operators.includes(row.code as Exclude<OperatorFilter,"all">)),row.code as OperatorFilter)}));
 const buckets=capacityTimeBuckets(window.times,details.query.period);
 const series=buckets.map(bucket=>({key:bucket.key,label:bucket.label,hour:bucket.hour,...aggregate(members,operator,bucket.times)}));
 const page=Math.min(details.query.page,Math.max(1,Math.ceil(rows.length/details.query.pageSize)));
 const visible=new Set(rows.slice((page-1)*details.query.pageSize,page*details.query.pageSize).map(row=>row.id));
 const clientRows=rows.map(row=>{const site=catalog.get(row.id)!;return {...row,capacity:{...row.capacity,
  series:visible.has(row.id)?buckets.map(bucket=>({key:bucket.key,label:bucket.label,hour:bucket.hour,...observation(site,bucket.times,operator)})):[],
  samples:visible.has(row.id)?window.times.map(at=>({at,hour:Number(at.slice(11,13)),...observation(site,[at],operator)})):[]}};});
 const localStart=new Date(Date.parse(window.start)+8*3600000).toISOString().slice(0,19),localEnd=new Date(Date.parse(window.end)+8*3600000-1).toISOString().slice(0,19);
 const daily=details.query.period==="week"||details.query.period==="month";
 const period={label:details.query.period==="hour"?window.asOf.replace("T"," ").slice(0,16):details.query.period==="day"?localStart.slice(0,10):details.query.period==="month"?localStart.slice(0,7):localStart.slice(0,10)+" ~ "+localEnd.slice(5,10),
  daily,observed:daily?new Set(window.times.map(at=>at.slice(0,10))).size:window.times.length,expected:(Date.parse(window.end)-Date.parse(window.start))/(daily?86400000:3600000)};
 return {...details,query:{...details.query,operator,asOf:window.asOf,hour},snapshotAt:window.asOf,adjusted:window.adjusted,previousAsOf:window.previousAsOf,nextAsOf:window.nextAsOf,rows:clientRows,summary:scope.summary,
  bearing:{configuration,total,regions,operators,series,observations,window,period,facets,filter:capacityFilter,policy:capacityConfigurationPolicy(configuration),sourcePolicy:TOPIC_POLICY}};
}
export type CapacityModel=ReturnType<typeof capacityModel>;
