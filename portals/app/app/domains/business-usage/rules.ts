import {HISTORY_START,HISTORY_END,DAY_MS} from '../map-demo/history-calendar';
import {calendarSource} from '../map-demo/period-rules';
import type {DemoSite,OperatorFilter} from '../map-demo/types';
export type BusinessPeriod='hour'|'day'|'week'|'month';
export const usageMetrics=['bytes','voiceSeconds','connected','sms'] as const;
export type UsageMetric=typeof usageMetrics[number];
export interface BusinessCounters {bytes:string;upBytes:string;downBytes:string;voiceSeconds:number;attempts:number;connected:number;sms:number}
const keys=['bytes','upBytes','downBytes','voiceSeconds','attempts','connected','sms'] as const;
type Sums=Record<typeof keys[number],bigint>;
const empty=():Sums=>({bytes:0n,upBytes:0n,downBytes:0n,voiceSeconds:0n,attempts:0n,connected:0n,sms:0n});
function add(target:Sums,input:{[K in keyof BusinessCounters]:number|string}){for(const key of keys){const value=input[key];if(typeof value==='number'&&(!Number.isSafeInteger(value)||value<0)||typeof value==='string'&&!/^\d+$/.test(value))throw Error('invalid_usage_counter');target[key]+=BigInt(value);}}
function output(s:Sums):BusinessCounters {const safe=(value:bigint)=>{const n=Number(value);if(!Number.isSafeInteger(n))throw Error('usage_counter_overflow');return n;};return {bytes:String(s.bytes),upBytes:String(s.upBytes),downBytes:String(s.downBytes),voiceSeconds:safe(s.voiceSeconds),attempts:safe(s.attempts),connected:safe(s.connected),sms:safe(s.sms)};}
export function sumUsage(rows:readonly BusinessCounters[]){const sums=empty();for(const row of rows)add(sums,row);return output(sums);}
export function usageShare(row:BusinessCounters,total:BusinessCounters,metric:UsageMetric){const denominator=Number(total[metric]);return denominator?Number(row[metric])/denominator:null;}
export function compareUsage(a:BusinessCounters,b:BusinessCounters,metric:UsageMetric){const x=BigInt(a[metric]),y=BigInt(b[metric]);return x===y?0:x>y?-1:1;}
// UTC carries local calendar arithmetic; source timestamps explicitly use +08:00.
export function businessWindow(requested:string,period:BusinessPeriod){
 const lower=Date.parse(HISTORY_START+'T00:00:00Z'),upper=Date.parse(HISTORY_END+'T00:00:00Z'),raw=Date.parse(requested+'Z');
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:00:00$/.test(requested)||!Number.isFinite(raw)||new Date(raw).toISOString().slice(0,19)!==requested||!['hour','day','week','month'].includes(period))throw Error('invalid_usage_window');
 const point=Math.max(lower,Math.min(upper-3600000,raw)),asOf=new Date(point).toISOString().slice(0,19);
 const bounds=(at:number)=>{const d=new Date(at);d.setUTCMinutes(0,0,0);if(period!=='hour')d.setUTCHours(0);if(period==='week')d.setUTCDate(d.getUTCDate()-(d.getUTCDay()||7)+1);if(period==='month')d.setUTCDate(1);const start=d.getTime();if(period==='month')d.setUTCMonth(d.getUTCMonth()+1);else d.setTime(start+(period==='hour'?3600000:period==='week'?7*DAY_MS:DAY_MS));return {start,end:d.getTime()};};
 const range=bounds(point),times:string[]=[],dates:string[]=[];
 for(let at=Math.max(lower,range.start);at<Math.min(upper,range.end);at+=3600000){const value=new Date(at).toISOString().slice(0,19);times.push(value);if(!dates.includes(value.slice(0,10)))dates.push(value.slice(0,10));}
 const previous=range.start-3600000,next=range.end;
 const previousAsOf=previous>=lower?new Date(Math.max(lower,bounds(previous).start)).toISOString().slice(0,19):null,nextAsOf=next<upper?new Date(next).toISOString().slice(0,19):null;
 return {asOf,adjusted:point!==raw,start:new Date(range.start).toISOString().slice(0,19)+'+08:00',end:new Date(range.end).toISOString().slice(0,19)+'+08:00',times,dates,previousAsOf,nextAsOf};
}
export type BusinessWindow=ReturnType<typeof businessWindow>;
export function usageBuckets(window:BusinessWindow,period:BusinessPeriod){return period==='week'||period==='month'?window.dates.map(date=>({key:date,label:date.slice(5),times:window.times.filter(at=>at.startsWith(date))})):window.times.map(at=>({key:at,label:at.slice(11,13),times:[at]}));}
export function aggregateBusinessUsage(sites:readonly DemoSite[],operator:OperatorFilter,window:BusinessWindow,period:BusinessPeriod){
 const buckets=usageBuckets(window,period),daily=period==='week'||period==='month',series=buckets.map(bucket=>({...bucket,sums:empty()}));
 const rows=sites.map(site=>{
  const source=calendarSource(site),codes=site.operators.filter(code=>operator==='all'||code===operator),providers=codes.map(code=>({code,sums:empty()}));
  for(const [index,bucket] of buckets.entries()){
   const observations=daily?source.daily(bucket.key).filter(row=>codes.includes(row.code)):codes.map(code=>({code,counters:source.sample(bucket.key.slice(0,10),Number(bucket.key.slice(11,13)),code)}));
   for(const observation of observations){add(providers.find(p=>p.code===observation.code)!.sums,observation.counters);add(series[index].sums,observation.counters);}
  }
  const operators=providers.map(({code,sums})=>({code,...output(sums)}));return {id:site.id,operators,...sumUsage(operators)};
 });
 const codes=[...new Set(rows.flatMap(row=>row.operators.map(p=>p.code)))];
 const operators=codes.map(code=>{const members=rows.filter(row=>row.operators.some(p=>p.code===code));return {code,sites:members.length,...sumUsage(members.map(row=>row.operators.find(p=>p.code===code)!))};});
 return {total:sumUsage(rows),sites:rows.length,rows,operators,series:series.map(({sums,times,...bucket})=>({...bucket,...output(sums)}))};
}
export function usageEvidence(site:DemoSite,operator:OperatorFilter,window:BusinessWindow,period:BusinessPeriod){
 const source=calendarSource(site),daily=period==='week'||period==='month';
 return usageBuckets(window,period).map(bucket=>{const counters=daily?sumUsage(source.daily(bucket.key).filter(row=>operator==='all'||row.code===operator).map(row=>{const value=row.counters;return {...value,bytes:String(value.bytes),upBytes:String(value.upBytes),downBytes:String(value.downBytes)};})):sumUsage(bucket.times.map(at=>{const value=source.sample(at.slice(0,10),Number(at.slice(11,13)),operator);return {...value,bytes:String(value.bytes),upBytes:String(value.upBytes),downBytes:String(value.downBytes)};}));return {key:bucket.key,label:bucket.label,...counters};});
}
