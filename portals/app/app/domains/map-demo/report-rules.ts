import {mapContextKey} from './geometry.ts';
import {analyzeOperatorUsage,type OperatorUsage} from './operator-rules.ts';
import {DEMO_DATE,siteHour} from './rules.ts';
import type {DemoSite,MapQuery,HourMetrics} from './types.ts';
import type {PeriodComparison} from './period-comparison-rules.ts';

export const REPORT_TEMPLATE_VERSION='bsmoss-demo-daily-v3';
export interface DailyReport {
  id:string;contextKey:string;mode:'demo';status:'draft';date:string;templateVersion:string;
  comparison?:PeriodComparison;
  scope:{regionId:string;cityId:string;countyId:string;operator:MapQuery['operator'];selection:MapQuery['selection']|null;search:string;name:string};
  usage:OperatorUsage;
  hours:{hour:number;bytes:number;voiceSeconds:number;sms:number;connected:number;attempts:number;used:number;capacity:number;connectionRate:number|null;load:number|null;energyWh:number|null}[];
  busy:{hour:number;bytes:number;share:number}|null;
  highestLoad:{hour:number;value:number}|null;lowestConnection:{hour:number;value:number}|null;
  runtime:{samples:number;temperatureMean:number|null;temperatureMin:number|null;temperatureMax:number|null;batterySiteHours:number;batterySites:number};
  ranking:{id:string;name:string;bytes:number;voiceSeconds:number;sms:number;peakHour:number}[];
}
// Daily report identity is independent of the map camera, selected hour and topic.
export function reportContextKey(query:MapQuery,date=DEMO_DATE):string {
  return JSON.stringify([mapContextKey({...query,hour:0,topic:undefined}),date,REPORT_TEMPLATE_VERSION]);
}
export function analyzeDailyReport(sites:readonly DemoSite[],query:MapQuery,scopeName:string,observe?:(site:DemoSite,m:HourMetrics)=>void):Omit<DailyReport,'id'> {
  const dailyQuery={...query,hour:0,topic:undefined};
  const usage=analyzeOperatorUsage(sites,dailyQuery,'day');
  const hours=Array.from({length:24},(_,hour)=>({hour,bytes:0,voiceSeconds:0,sms:0,connected:0,attempts:0,used:0,capacity:0,connectionRate:null as number|null,load:null as number|null,energyWh:query.operator==='all'?0:null as number|null}));
  let samples=0,temperatureSum=0,temperatureMin=Infinity,temperatureMax=-Infinity,batterySiteHours=0;
  const batterySites=new Set<string>();
  const ranking=sites.map(site=>{
    let bytes=0,voiceSeconds=0,sms=0,peakHour=0,peakBytes=-1;
    for(const h of hours){
      const m=siteHour(site,h.hour,query.operator);
      observe?.(site,m);
      for(const key of ['bytes','voiceSeconds','sms','connected','attempts','used','capacity'] as const)h[key]+=m[key];
      if(h.energyWh!==null)h.energyWh+=m.energyWh??0;
      bytes+=m.bytes;voiceSeconds+=m.voiceSeconds;sms+=m.sms;
      if(m.bytes>peakBytes){peakBytes=m.bytes;peakHour=h.hour;}
      samples++;temperatureSum+=m.temperature;temperatureMin=Math.min(temperatureMin,m.temperature);temperatureMax=Math.max(temperatureMax,m.temperature);
      if(m.power==='battery'){batterySiteHours++;batterySites.add(site.id);}
    }
    return {id:site.id,name:site.name,bytes,voiceSeconds,sms,peakHour};
  }).sort((a,b)=>b.bytes-a.bytes||a.id.localeCompare(b.id)).slice(0,5);
  for(const h of hours){h.connectionRate=h.attempts?h.connected/h.attempts:null;h.load=h.capacity?h.used/h.capacity:null;}
  const peak=hours.reduce((a,b)=>b.bytes>a.bytes?b:a);
  const load=hours.filter(h=>h.load!==null).sort((a,b)=>b.load!-a.load!||a.hour-b.hour)[0];
  const connection=hours.filter(h=>h.connectionRate!==null).sort((a,b)=>a.connectionRate!-b.connectionRate!||a.hour-b.hour)[0];
  return {contextKey:reportContextKey(query),mode:'demo',status:'draft',date:DEMO_DATE,templateVersion:REPORT_TEMPLATE_VERSION,
    scope:{regionId:query.regionId,cityId:query.cityId,countyId:query.countyId,operator:query.operator,selection:query.selection??null,search:query.search.trim(),name:scopeName},
    usage,hours,busy:usage.totals.bytes>0?{hour:peak.hour,bytes:peak.bytes,share:peak.bytes/usage.totals.bytes}:null,
    highestLoad:load?{hour:load.hour,value:load.load!}:null,lowestConnection:connection?{hour:connection.hour,value:connection.connectionRate!}:null,
    runtime:{samples,temperatureMean:samples?temperatureSum/samples:null,temperatureMin:samples?temperatureMin:null,temperatureMax:samples?temperatureMax:null,batterySiteHours,batterySites:batterySites.size},ranking};
}
