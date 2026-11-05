import {calendarSource} from './period-rules.ts';
import {DAY_MS,dateNumber,isoDay,monthEnd} from './history-calendar.ts';
import type {DemoSite,Operator,OperatorFilter} from './types.ts';
import type {HistoryAnalysis} from './history-rules.ts';
export const HISTORY_CONTEXT_VERSION='bsmoss-history-context-v1';
type Service={code:Operator;attempts:number;connected:number;used:number;capacity:number;samples:number};
export type Physical={energyWh:number;temperatureSumTenths:number;temperatureMinTenths:number|null;temperatureMaxTenths:number|null;physicalSamples:number;batterySamples:number};
export type Context={services:Service[];physical:Physical};
export const emptyPhysical=():Physical=>({energyWh:0,temperatureSumTenths:0,temperatureMinTenths:null,temperatureMaxTenths:null,physicalSamples:0,batterySamples:0});
export function addPhysical(a:Physical,b:Physical){
  for(const key of ['energyWh','temperatureSumTenths','physicalSamples','batterySamples'] as const){a[key]+=b[key];if(!Number.isSafeInteger(a[key]))throw Error('history_context_overflow');}
  if(b.temperatureMinTenths!==null)a.temperatureMinTenths=a.temperatureMinTenths===null?b.temperatureMinTenths:Math.min(a.temperatureMinTenths,b.temperatureMinTenths);
  if(b.temperatureMaxTenths!==null)a.temperatureMaxTenths=a.temperatureMaxTenths===null?b.temperatureMaxTenths:Math.max(a.temperatureMaxTenths,b.temperatureMaxTenths);
}
export function addService(a:Omit<Service,'code'>,b:Omit<Service,'code'>){
  for(const key of ['attempts','connected','used','capacity','samples'] as const){a[key]+=b[key];if(!Number.isSafeInteger(a[key]))throw Error('history_context_overflow');}
}
const emptyService=()=>({attempts:0,connected:0,used:0,capacity:0,samples:0});
export function readContextPeriod(site:DemoSite,start:string,end:string):Context {
  const source=calendarSource(site),physical=emptyPhysical(),services=site.operators.map(code=>({code,...emptyService()}));
  for(let t=dateNumber(start);t<dateNumber(end);t+=DAY_MS){
    const date=isoDay(t);addPhysical(physical,source.physicalDaily(date));
    for(const row of source.daily(date)){const target=services.find(s=>s.code===row.code)!;addService(target,{...row.counters,samples:24});}
  }
  return {physical,services};
}
export function summarizeContext(context:Context,operator:OperatorFilter,bytes:string){
  const service=emptyService();for(const s of context.services)if(operator==='all'||s.code===operator)addService(service,s);
  const p=context.physical,energyWh=operator==='all'&&p.physicalSamples>0?p.energyWh:null;
  return {...service,physical:{...p,energyWh},connectionRate:service.attempts?service.connected/service.attempts:null,load:service.capacity?service.used/service.capacity:null,
    temperatureMean:p.physicalSamples?p.temperatureSumTenths/(p.physicalSamples*10):null,
    energyPerGiB:energyWh!==null&&BigInt(bytes)>0n?energyWh/1000/(Number(bytes)/1073741824):null};
}
export function analyzeHistoryContext(sites:readonly DemoSite[],analysis:HistoryAnalysis,read=readContextPeriod){
  const whole:Context={physical:emptyPhysical(),services:[]},byId=new Map(analysis.siteRows.map(r=>[r.id,r]));
  const members=sites.map(site=>{
    const context:Context={physical:emptyPhysical(),services:[]};
    const merge=(value:Context)=>{addPhysical(context.physical,value.physical);for(const row of value.services){let target=context.services.find(r=>r.code===row.code);if(!target){target={code:row.code,...emptyService()};context.services.push(target);}addService(target,row);}};
    for(let cursor=analysis.scope.window.start;cursor<analysis.scope.window.end;){
      const limit=monthEnd(cursor.slice(0,7)),end=limit<analysis.scope.window.end?limit:analysis.scope.window.end;merge(read(site,cursor,end));cursor=end;
    }
    addPhysical(whole.physical,context.physical);for(const row of context.services){let target=whole.services.find(r=>r.code===row.code);if(!target){target={code:row.code,...emptyService()};whole.services.push(target);}addService(target,row);}
    const usage=byId.get(site.id)!;
    return {...usage,name:site.name,...summarizeContext(context,analysis.scope.query.operator,usage.values.bytes)};
  });
  return {version:HISTORY_CONTEXT_VERSION,window:analysis.scope.window,summary:summarizeContext(whole,analysis.scope.query.operator,analysis.totals.bytes),members};
}
export type HistoryContext=ReturnType<typeof analyzeHistoryContext>;
