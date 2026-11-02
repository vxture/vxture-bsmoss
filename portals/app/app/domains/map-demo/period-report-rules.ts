import {analyzeCalendarUsage,calendarWindow,periodContextKey,emptyExact,addExact,exactCounters,calendarRates,type CalendarUsage,type CalendarCounters,type ReportPeriod} from './period-rules.ts';
import {DEMO_DATE} from './rules.ts';
import type {DemoSite,MapQuery,HourMetrics} from './types.ts';
import type {DailyReport} from './report-rules.ts';
import type {PeriodComparison} from './period-comparison-rules.ts';
export const CALENDAR_TEMPLATE_VERSION='bsmoss-demo-period-report-v3';
export interface CalendarReport {
  id:string;contextKey:string;mode:'demo';status:'draft';date:string;period:ReportPeriod;templateVersion:string;
  comparison?:PeriodComparison;
  scope:DailyReport['scope'];usage:CalendarUsage;
  days:(CalendarCounters&{date:string;connectionRate:number|null;load:number|null;energyWh:number|null})[];
  busy:{date:string;hour:number;bytes:string;share:number}|null;
  highestLoad:{date:string;hour:number;value:number}|null;lowestConnection:{date:string;hour:number;value:number}|null;
  runtime:DailyReport['runtime'];
  ranking:{id:string;name:string;bytes:string;voiceSeconds:number;sms:number;peakDate:string;peakHour:number}[];
}
export function calendarReportContextKey(query:MapQuery,period:ReportPeriod):string {
  return JSON.stringify([periodContextKey(query,period),CALENDAR_TEMPLATE_VERSION]);
}
export function analyzeCalendarReport(sites:readonly DemoSite[],query:MapQuery,period:ReportPeriod,scopeName:string,observe?:(site:DemoSite,m:HourMetrics)=>void):Omit<CalendarReport,'id'> {
  const window=calendarWindow(period);
  const slots=window.dates.map(date=>({date,hours:Array.from({length:24},(_,hour)=>({hour,sums:emptyExact(),energyWh:query.operator==='all'?0:null as number|null}))}));
  let samples=0,temperatureSum=0,temperatureMin=Infinity,temperatureMax=-Infinity,batterySiteHours=0;
  const batterySites=new Set<string>();
  const perSite=new Map(sites.map(site=>[site.id,{site,sums:emptyExact(),peakBytes:-1,peakHour:0,peakDate:window.dates[0]}]));
  const dateIndex=new Map(window.dates.map((date,i)=>[date,i]));
  const usage=analyzeCalendarUsage(sites,query,period,(site,date,hour,m)=>{
    observe?.(site,m);
    const entry=perSite.get(site.id)!,h=slots[dateIndex.get(date)!].hours[hour];
    addExact(entry.sums,m);addExact(h.sums,m);if(h.energyWh!==null)h.energyWh+=m.energyWh??0;
    if(m.bytes>entry.peakBytes){entry.peakBytes=m.bytes;entry.peakHour=hour;entry.peakDate=date;}
    samples++;temperatureSum+=m.temperature;temperatureMin=Math.min(temperatureMin,m.temperature);temperatureMax=Math.max(temperatureMax,m.temperature);
    if(m.power==='battery'){batterySiteHours++;batterySites.add(site.id);}
  });
  const ranking=[...perSite.values()].map(({site,sums,peakDate,peakHour})=>{
    const counters=exactCounters(sums);return {id:site.id,name:site.name,bytes:counters.bytes,voiceSeconds:counters.voiceSeconds,sms:counters.sms,peakDate,peakHour};
  }).sort((a,b)=>BigInt(a.bytes)===BigInt(b.bytes)?a.id.localeCompare(b.id):BigInt(a.bytes)>BigInt(b.bytes)?-1:1).slice(0,5);
  let busy:CalendarReport['busy']=null,highestLoad:CalendarReport['highestLoad']=null,lowestConnection:CalendarReport['lowestConnection']=null;
  const days=slots.map(day=>{
    const sums=emptyExact();let energyWh=query.operator==='all'?0:null;
    for(const h of day.hours){
      for(const key of Object.keys(sums) as (keyof typeof sums)[])sums[key]+=h.sums[key];
      if(energyWh!==null)energyWh+=h.energyWh??0;
      const counters=exactCounters(h.sums),rates=calendarRates(counters);
      if(BigInt(counters.bytes)>0n&&(!busy||BigInt(counters.bytes)>BigInt(busy.bytes)))busy={date:day.date,hour:h.hour,bytes:counters.bytes,share:Number(counters.bytes)/Number(usage.totals.bytes)};
      if(rates.load!==null&&(!highestLoad||rates.load>highestLoad.value))highestLoad={date:day.date,hour:h.hour,value:rates.load};
      if(rates.connectionRate!==null&&(!lowestConnection||rates.connectionRate<lowestConnection.value))lowestConnection={date:day.date,hour:h.hour,value:rates.connectionRate};
    }
    const counters=exactCounters(sums);return {date:day.date,...counters,...calendarRates(counters),energyWh};
  });
  return {contextKey:calendarReportContextKey(query,period),mode:'demo',status:'draft',date:DEMO_DATE,period,templateVersion:CALENDAR_TEMPLATE_VERSION,
    scope:{regionId:query.regionId,cityId:query.cityId,countyId:query.countyId,operator:query.operator,selection:query.selection??null,search:query.search.trim(),name:scopeName},usage,days,busy,highestLoad,lowestConnection,
    runtime:{samples,temperatureMean:samples?temperatureSum/samples:null,temperatureMin:samples?temperatureMin:null,temperatureMax:samples?temperatureMax:null,batterySiteHours,batterySites:batterySites.size},ranking};
}
