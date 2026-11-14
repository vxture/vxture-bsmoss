import {aggregateBusinessUsage,businessWindow,sumUsage,usageMetrics,type BusinessCounters} from '../domains/business-usage/rules';
import {calendarSource,calendarRates} from '../domains/map-demo/period-rules';
import {counterChange,type CounterChange} from '../domains/map-demo/period-comparison-rules';
import {DAY_MS,HISTORY_START,HISTORY_END,dateNumber,isoDay,yearBefore} from '../domains/map-demo/history-calendar';
import {emptyPhysical,addPhysical} from '../domains/map-demo/history-context-rules';
import {syntheticSharing,syntheticSiteType} from '../domains/map-demo/site-attributes';
import type {DemoSite,OperatorFilter} from '../domains/map-demo/types';
import type {BusinessReport} from './business-snapshot';
type Rates={used:number;capacity:number;connectionRate:number|null;load:number|null};
export type ReportComparison={start:string;end:string;days:number;available:boolean;total:BusinessCounters|null;metrics:Record<typeof usageMetrics[number],CounterChange>;increase:{id:string;name:string;delta:string}[];decrease:{id:string;name:string;delta:string}[];positive:string;negative:string};
export interface ReportAnalysis {
 version:'business-report-analysis-v1';days:number;serviceRelations:number;sharedSites:number;
 operations:Rates&{energyWh:number|null;energyPerGiB:number|null;temperatureMean:number|null;temperatureMin:number|null;temperatureMax:number|null;physicalSamples:number;serviceSamples:number;batterySamples:number;batterySites:number};
 operators:({code:string}&Rates)[];
 timeline:({key:string}&Rates&{energyWh:number|null})[];
 busy:{key:string;bytes:string;share:number}|null;highestLoad:{key:string;value:number}|null;lowestConnection:{key:string;value:number}|null;
 ranking:{id:string;name:string;bytes:string;peakKey:string;peakBytes:string}[];
 cohorts:(BusinessCounters&{kind:'scene'|'siteType'|'sharing';code:string;sites:number})[];
 comparisons:{previous:ReportComparison;year:ReportComparison};
}
// Restore the original report chapters against the exact same cohort/calendar as P5.
// A new report freezes these observations; no configuration or source record is mutated.
export function analyzeBusinessReport(r:BusinessReport,sites:readonly DemoSite[]):ReportAnalysis{
 const operator=r.scope.operator as OperatorFilter,window=businessWindow(r.scope.date+'T23:00:00',r.scope.period),days=window.dates.length;
 const physical=emptyPhysical(),batteries=new Set<string>(),providers=new Map<string,{code:string;used:number;capacity:number;attempts:number;connected:number}>();
 const hours=new Map(window.times.map(key=>[key,{key,bytes:0n,used:0,capacity:0,attempts:0,connected:0,energyWh:operator==='all'?0:null as number|null}]));
 const ranking:ReportAnalysis['ranking']=[],stationTotals=new Map(r.stations.map(s=>[s.id,s]));
 let serviceSamples=0;
 for(const site of sites){
  const source=calendarSource(site),codes=site.operators.filter(code=>operator==='all'||code===operator);let peakKey='',peakBytes=-1n;
  for(const date of window.dates){const p=source.physicalDaily(date);addPhysical(physical,p);if(p.batterySamples)batteries.add(site.id);}
  for(const key of window.times){const date=key.slice(0,10),hour=Number(key.slice(11,13)),h=hours.get(key)!,m=source.sample(date,hour,operator);
   h.bytes+=BigInt(m.bytes);h.used+=m.used;h.capacity+=m.capacity;h.attempts+=m.attempts;h.connected+=m.connected;if(h.energyWh!==null)h.energyWh+=m.energyWh??0;
   if(BigInt(m.bytes)>peakBytes){peakBytes=BigInt(m.bytes);peakKey=key;}
   for(const code of codes){const s=source.sample(date,hour,code);let p=providers.get(code);if(!p){p={code,used:0,capacity:0,attempts:0,connected:0};providers.set(code,p);}p.used+=s.used;p.capacity+=s.capacity;p.attempts+=s.attempts;p.connected+=s.connected;serviceSamples++;}
  }
  ranking.push({id:site.id,name:site.name,bytes:stationTotals.get(site.id)!.bytes,peakKey,peakBytes:String(peakBytes<0n?0n:peakBytes)});
 }
 const raw=[...hours.values()],used=raw.reduce((n,h)=>n+h.used,0),capacity=raw.reduce((n,h)=>n+h.capacity,0);
 const energyWh=operator==='all'&&physical.physicalSamples?physical.energyWh:null;
 const peak=raw.filter(h=>h.bytes>0n).sort((a,b)=>a.bytes===b.bytes?a.key.localeCompare(b.key):a.bytes>b.bytes?-1:1)[0];
 const load=raw.filter(h=>h.capacity).sort((a,b)=>b.used/b.capacity-a.used/a.capacity||a.key.localeCompare(b.key))[0],connection=raw.filter(h=>h.attempts).sort((a,b)=>a.connected/a.attempts-b.connected/b.attempts||a.key.localeCompare(b.key))[0];
 const timeline=r.series.map(bucket=>{const members=raw.filter(h=>r.coverage.daily?h.key.startsWith(bucket.key):h.key===bucket.key),sums={used:0,capacity:0,attempts:0,connected:0};let energyWh=operator==='all'?0:null as number|null;for(const h of members){for(const key of ['used','capacity','attempts','connected'] as const)sums[key]+=h[key];if(energyWh!==null)energyWh+=h.energyWh??0;}return {key:bucket.key,used:sums.used,capacity:sums.capacity,...calendarRates(sums),energyWh};});
 const cohorts:ReportAnalysis['cohorts']=[];
 for(const kind of ['scene','siteType','sharing'] as const){const groups=new Map<string,DemoSite[]>();for(const site of sites){const code=kind==='scene'?site.profile:kind==='siteType'?syntheticSiteType(site):syntheticSharing(site);groups.set(code,[...(groups.get(code)??[]),site]);}for(const [code,members]of groups)cohorts.push({kind,code,sites:members.length,...sumUsage(members.map(s=>stationTotals.get(s.id)!))});}
 function comparison(start:string,end:string):ReportComparison{
  const count=(dateNumber(end)-dateNumber(start))/DAY_MS,available=!!sites.length&&start>=HISTORY_START&&end<=HISTORY_END&&window.dates[0]===r.window.start.slice(0,10)&&window.dates.length===(dateNumber(r.window.end.slice(0,10))-dateNumber(r.window.start.slice(0,10)))/DAY_MS;
  const reference=available?aggregateBusinessUsage(sites,operator,{...window,dates:Array.from({length:count},(_,i)=>isoDay(dateNumber(start)+i*DAY_MS)),times:Array.from({length:count*24},(_,i)=>isoDay(dateNumber(start)+Math.floor(i/24)*DAY_MS)+'T'+String(i%24).padStart(2,'0')+':00:00')},'month'):null;
  const byId=new Map(reference?.rows.map(row=>[row.id,row])??[]),movements=reference?r.stations.map(s=>({id:s.id,name:s.name,delta:String(BigInt(s.bytes)-BigInt(byId.get(s.id)!.bytes))})):[];
  const increase=movements.filter(s=>BigInt(s.delta)>0n).sort((a,b)=>BigInt(a.delta)===BigInt(b.delta)?a.id.localeCompare(b.id):BigInt(a.delta)>BigInt(b.delta)?-1:1),decrease=movements.filter(s=>BigInt(s.delta)<0n).sort((a,b)=>BigInt(a.delta)===BigInt(b.delta)?a.id.localeCompare(b.id):BigInt(a.delta)<BigInt(b.delta)?-1:1);
  return {start,end,days:count,available,total:reference?.total??null,metrics:Object.fromEntries(usageMetrics.map(key=>[key,counterChange(String(r.total[key]),String(reference?.total[key]??0),Math.max(1,days),count,available)])) as ReportComparison['metrics'],increase:increase.slice(0,5),decrease:decrease.slice(0,5),positive:String(increase.reduce((n,s)=>n+BigInt(s.delta),0n)),negative:String(decrease.reduce((n,s)=>n+BigInt(s.delta),0n))};
 }
 const start=r.window.start.slice(0,10),end=r.window.end.slice(0,10),previousStart=r.scope.period==='month'?isoDay(Date.UTC(Number(start.slice(0,4)),Number(start.slice(5,7))-2,1)):isoDay(dateNumber(start)-(r.scope.period==='week'?7:1)*DAY_MS);
 return {version:'business-report-analysis-v1',days,serviceRelations:r.operators.reduce((n,s)=>n+s.sites,0),sharedSites:sites.filter(s=>s.operators.length>1).length,
 operations:{used,capacity,...calendarRates({...r.total,used,capacity}),energyWh,energyPerGiB:energyWh!==null&&BigInt(r.total.bytes)>0n?energyWh/1000/(Number(r.total.bytes)/1073741824):null,temperatureMean:physical.physicalSamples?physical.temperatureSumTenths/(physical.physicalSamples*10):null,temperatureMin:physical.temperatureMinTenths===null?null:physical.temperatureMinTenths/10,temperatureMax:physical.temperatureMaxTenths===null?null:physical.temperatureMaxTenths/10,physicalSamples:physical.physicalSamples,serviceSamples,batterySamples:physical.batterySamples,batterySites:batteries.size},
 operators:[...providers.values()].map(p=>({code:p.code,used:p.used,capacity:p.capacity,...calendarRates(p)})),timeline,busy:peak?{key:peak.key,bytes:String(peak.bytes),share:Number(peak.bytes)/Number(r.total.bytes)}:null,highestLoad:load?{key:load.key,value:load.used/load.capacity}:null,lowestConnection:connection?{key:connection.key,value:connection.connected/connection.attempts}:null,
 ranking:ranking.sort((a,b)=>BigInt(a.bytes)===BigInt(b.bytes)?a.id.localeCompare(b.id):BigInt(a.bytes)>BigInt(b.bytes)?-1:1).slice(0,5),cohorts,comparisons:{previous:comparison(previousStart,start),year:comparison(yearBefore(start),yearBefore(end))}};
}
