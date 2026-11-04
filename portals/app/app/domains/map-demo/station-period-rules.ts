import {analyzeCalendarUsage,calendarSampler,calendarWindow,periodContextKey,emptyExact,addExact,exactCounters,calendarRates,type CalendarCounters,type CalendarUsage,type ReportPeriod} from './period-rules.ts';
import {counterChange,type CounterChange} from './period-comparison-rules.ts';
import {BUSINESS_KEYS,type BusinessMetric} from './period-contribution-rules.ts';
import type {DemoSite,HourMetrics,MapQuery} from './types.ts';
import type {StationReportReference} from './station-report-rules.ts';
export const STATION_PERIOD_VERSION='bsmoss-demo-station-period-v2';
export const WAVE_POLICY={relativeBps:1500,minimum:{bytes:'1073741824',voiceSeconds:'300',sms:'20'},baselineWeeks:[1,2,3,4]} as const;
export interface WaveEvidence {
  current:string;references:string[];referenceNumerator:string|null;denominator:2;deltaNumerator:string|null;rate:number|null;
  status:'within'|'up'|'down'|'from_zero'|'both_zero'|'insufficient';flagged:boolean;
}
export interface StationPeriodHour {
  date:string;hour:number;counters:CalendarCounters;connectionRate:number|null;load:number|null;
  energyWh:number|null;temperature:number;power:HourMetrics['power'];baselineDates:string[];
  waves:Record<BusinessMetric,WaveEvidence>;
}
export interface StationPeriodDay {
  date:string;counters:CalendarCounters;connectionRate:number|null;load:number|null;energyWh:number|null;
  referenceNumerators:Record<BusinessMetric,string>;flaggedHours:Record<BusinessMetric,number>;
}
export interface StationPeriod {
  report?:StationReportReference;
  contextKey:string;mode:'demo';version:string;site:{id:string;name:string};operator:MapQuery['operator'];period:ReportPeriod;
  usage:CalendarUsage;previous:{window:CalendarUsage['window'];days:number};changes:Record<BusinessMetric,CounterChange>;
  policy:typeof WAVE_POLICY;days:StationPeriodDay[];hours:StationPeriodHour[];
  findings:Record<BusinessMetric,{count:number;days:number;up:number;down:number;largest:{date:string;hour:number;wave:WaveEvidence}|null;top:{date:string;hour:number;wave:WaveEvidence}[]}>;
}
export function stationPeriodContextKey(id:string,query:MapQuery,period:ReportPeriod):string {
  return JSON.stringify([id,periodContextKey(query,period),STATION_PERIOD_VERSION]);
}
export function baselineDates(date:string):string[] {
  if(!/^2026-10-(0[1-9]|[12][0-9]|3[01])$/.test(date))throw Error('invalid_station_period_date');
  const t=Date.parse(date+'T00:00:00Z');
  return WAVE_POLICY.baselineWeeks.map(weeks=>new Date(t-weeks*7*86400000).toISOString().slice(0,10));
}
// Three or four verified, comparable samples share an exact numerator over two.
// Callers retain unavailable reference slots and their reasons outside this helper.
export function evaluateWave(current:string,references:readonly string[],minimum:string,relativeBps:number=WAVE_POLICY.relativeBps):WaveEvidence {
  const valid=(s:string)=>/^\d{1,100}$/.test(s);
  if(!valid(current)||!valid(minimum)||BigInt(minimum)<1n||!Number.isSafeInteger(relativeBps)||relativeBps<1||relativeBps>10000||references.some(s=>!valid(s)))throw Error('invalid_wave_counter');
  const base={current,references:[...references],denominator:2 as const};
  if(references.length!==3&&references.length!==4)return {...base,referenceNumerator:null,deltaNumerator:null,rate:null,status:'insufficient',flagged:false};
  const sorted=references.map(BigInt).sort((a,b)=>a===b?0:a<b?-1:1),reference=references.length===3?2n*sorted[1]:sorted[1]+sorted[2],delta=2n*BigInt(current)-reference,absolute=delta<0n?-delta:delta;
  const flagged=absolute>=2n*BigInt(minimum)&&(reference===0n||absolute*10000n>=reference*BigInt(relativeBps));
  return {...base,referenceNumerator:String(reference),deltaNumerator:String(delta),rate:reference===0n?null:Number(delta)/Number(reference),status:reference===0n?(BigInt(current)===0n?'both_zero':'from_zero'):flagged?(delta>0n?'up':'down'):'within',flagged};
}
export function analyzeStationPeriod(site:DemoSite,query:MapQuery,period:ReportPeriod):StationPeriod {
  const sample=calendarSampler(site),hours:StationPeriodHour[]=[],window=calendarWindow(period),previous=analyzeCalendarUsage([site],query,period,undefined,'previous');
  const usage=analyzeCalendarUsage([site],query,period,(_site,date,hour,m)=>{
    const dates=baselineDates(date),references=dates.map(d=>sample(d,hour,query.operator));
    const sums=emptyExact();addExact(sums,m);
    const waves=Object.fromEntries(BUSINESS_KEYS.map(key=>[key,evaluateWave(String(m[key]),references.map(r=>String(r[key])),WAVE_POLICY.minimum[key])])) as Record<BusinessMetric,WaveEvidence>;
    hours.push({date,hour,counters:exactCounters(sums),...calendarRates(m),energyWh:m.energyWh,temperature:m.temperature,power:m.power,baselineDates:dates,waves});
  });
  const days=window.dates.map(date=>{
    const list=hours.filter(h=>h.date===date),sums=emptyExact();
    // The hour counters are already exact; keep every aggregate integer until display.
    for(const h of list)for(const key of Object.keys(sums) as (keyof typeof sums)[])sums[key]+=BigInt(h.counters[key]);
    const counters=exactCounters(sums),referenceNumerators=Object.fromEntries(BUSINESS_KEYS.map(key=>[key,String(list.reduce((n,h)=>n+BigInt(h.waves[key].referenceNumerator!),0n))])) as Record<BusinessMetric,string>;
    return {date,counters,...calendarRates(counters),energyWh:query.operator==='all'?list.reduce((n,h)=>n+(h.energyWh??0),0):null,referenceNumerators,flaggedHours:Object.fromEntries(BUSINESS_KEYS.map(key=>[key,list.filter(h=>h.waves[key].flagged).length])) as Record<BusinessMetric,number>};
  });
  const findings=Object.fromEntries(BUSINESS_KEYS.map(key=>{
    const ranked=hours.map(h=>({date:h.date,hour:h.hour,wave:h.waves[key]})).sort((a,b)=>{
      const aa=BigInt(a.wave.deltaNumerator!),bb=BigInt(b.wave.deltaNumerator!),ad=aa<0n?-aa:aa,bd=bb<0n?-bb:bb;
      // Rank relative deviation exactly; zero reference with nonzero activity comes first.
      const ar=BigInt(a.wave.referenceNumerator!),br=BigInt(b.wave.referenceNumerator!);
      const az=ar===0n&&ad>0n,bz=br===0n&&bd>0n;
      if(az!==bz)return az?-1:1;
      const left=ad*(br||1n),right=bd*(ar||1n);return left===right?a.date.localeCompare(b.date)||a.hour-b.hour:left>right?-1:1;
    });
    const flagged=ranked.filter(r=>r.wave.flagged);
    return [key,{count:flagged.length,days:new Set(flagged.map(h=>h.date)).size,up:flagged.filter(h=>BigInt(h.wave.deltaNumerator!)>0n).length,down:flagged.filter(h=>BigInt(h.wave.deltaNumerator!)<0n).length,largest:ranked[0]??null,top:flagged.slice(0,8)}];
  })) as StationPeriod['findings'];
  return {contextKey:stationPeriodContextKey(site.id,query,period),mode:'demo',version:STATION_PERIOD_VERSION,site:{id:site.id,name:site.name},operator:query.operator,period,usage,previous:{window:previous.window,days:previous.calendar.days},changes:Object.fromEntries(BUSINESS_KEYS.map(key=>[key,counterChange(String(usage.totals[key]),String(previous.totals[key]),window.dates.length,previous.calendar.days)])) as StationPeriod['changes'],policy:WAVE_POLICY,days,hours,findings};
}
