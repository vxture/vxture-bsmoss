import {mapContextKey} from './geometry.ts';
import {DEMO_DATE,DEMO_VERSION,siteHour} from './rules.ts';
import {OPERATOR_CODES,type DemoSite,type HourMetrics,type MapQuery,type OperatorFilter} from './types.ts';
import type {UsageCounters} from './operator-rules.ts';
import type {Operator} from './types.ts';
import {historicalDate} from './history-calendar.ts';
export type CalendarCounters=Omit<UsageCounters,'bytes'|'upBytes'|'downBytes'>&{bytes:string;upBytes:string;downBytes:string};
export interface CalendarUsage {
  contextKey:string;mode:'demo';version:string;ruleVersion:string;period:ReportPeriod;
  window:{start:string;end:string;timezone:'Asia/Shanghai'};
  physicalSites:number;serviceRelations:number;sharedSites:number;samples:number;energyWh:number|null;
  totals:CalendarCounters&{connectionRate:number|null;load:number|null};
  rows:(CalendarCounters&{code:Operator;sites:number;samples:number;connectionRate:number|null;load:number|null})[];
  checks:{bytesDelta:string;voiceSecondsDelta:number;smsDelta:number};
  dailySeries:{date:string;rows:{code:Operator;bytes:string;voiceSeconds:number;sms:number}[]}[];
  calendar:{anchorDate:string;days:number;granularity:'hour'|'day';sampleCutoff:string;sampleStatus:'complete_synthetic';expectedPhysicalSamples:number;observedPhysicalSamples:number};
}
export type ReportPeriod='day'|'week'|'month';
export const CALENDAR_RULE_VERSION='bsmoss-demo-calendar-v3';
export const SAMPLE_CUTOFF='2026-11-01T00:00:00+08:00';
const DAY=86400000;
export function parseReportPeriod(value:string):ReportPeriod {
  if(value!=='day'&&value!=='week'&&value!=='month')throw Error('invalid_period');
  return value;
}
export function calendarWindow(period:ReportPeriod,basis:'current'|'previous'='current') {
  parseReportPeriod(period);
  // Fixed, historical, fully populated synthetic windows. No wall-clock dependency.
  const start=basis==='previous'?(period==='day'?'2026-10-24':period==='week'?'2026-10-12':'2026-09-01'):(period==='day'?DEMO_DATE:period==='week'?'2026-10-19':'2026-10-01');
  const end=basis==='previous'?(period==='day'?DEMO_DATE:period==='week'?'2026-10-19':'2026-10-01'):(period==='month'?'2026-11-01':'2026-10-26');
  const dates:string[]=[];
  for(let t=Date.parse(start+'T00:00:00Z');t<Date.parse(end+'T00:00:00Z');t+=DAY)dates.push(new Date(t).toISOString().slice(0,10));
  return {start:start+'T00:00:00+08:00',end:end+'T00:00:00+08:00',timezone:'Asia/Shanghai' as const,dates};
}
export const PERIOD_NAMES:Record<ReportPeriod,string>={day:'\u65e5\u62a5',week:'\u5468\u62a5',month:'\u6708\u62a5'};
export function calendarLabel(period:ReportPeriod):string {
  const w=calendarWindow(period);return w.dates[0]+' \u2014 '+w.dates[w.dates.length-1];
}
export function periodContextKey(query:MapQuery,period:ReportPeriod,basis:'current'|'previous'='current'):string {
  return JSON.stringify([mapContextKey({...query,hour:0,topic:undefined}),period,calendarWindow(period,basis),CALENDAR_RULE_VERSION]);
}
export const emptyCounters=():UsageCounters=>({bytes:0,upBytes:0,downBytes:0,voiceSeconds:0,sms:0,attempts:0,connected:0,used:0,capacity:0});
export function addCounters(target:UsageCounters,input:UsageCounters) {
  for(const key of Object.keys(target) as (keyof UsageCounters)[])target[key]+=input[key];
}
type ExactCounters={ [K in keyof UsageCounters]:bigint };
export const emptyExact=():ExactCounters=>({bytes:0n,upBytes:0n,downBytes:0n,voiceSeconds:0n,sms:0n,attempts:0n,connected:0n,used:0n,capacity:0n});
export function addExact(target:ExactCounters,input:UsageCounters) {
  for(const key of Object.keys(target) as (keyof UsageCounters)[]){
    if(!Number.isSafeInteger(input[key])||input[key]<0)throw Error('invalid_counter');
    target[key]+=BigInt(input[key]);
  }
}
export function exactCounters(s:ExactCounters):CalendarCounters {
  const safe=(v:bigint)=>{const n=Number(v);if(!Number.isSafeInteger(n))throw Error('counter_overflow');return n;};
  return {bytes:String(s.bytes),upBytes:String(s.upBytes),downBytes:String(s.downBytes),voiceSeconds:safe(s.voiceSeconds),sms:safe(s.sms),attempts:safe(s.attempts),connected:safe(s.connected),used:safe(s.used),capacity:safe(s.capacity)};
}
export const calendarRates=(v:Pick<UsageCounters,'attempts'|'connected'|'used'|'capacity'>)=>({connectionRate:v.attempts?v.connected/v.attempts:null,load:v.capacity?v.used/v.capacity:null});

// Per-request, per-site cache: never stores mutable tenant or global evidence.
export function calendarSource(site:DemoSite) {
  const bases=Array.from({length:24},(_,hour)=>({physical:siteHour(site,hour),operators:site.operators.map(code=>({code,base:siteHour(site,hour,code)}))}));
  function profile(date:string) {
    const parsed=historicalDate(date),day=parsed.getUTCDate(),weekday=parsed.getUTCDay(),weekend=weekday===0||weekday===6;
    const shape=site.profile==='industrial'?(weekend?0.72:1.08):site.profile==='hub'?(weekend?0.9:1.1):weekend?1.09:0.96;
    const legacy=date>='2026-09-01';
    const month=parsed.getUTCMonth(),age=(parsed.getUTCFullYear()-2026)*12+month-9;
    const season=1+0.14*Math.sin((month+(site.profile==='mountain'?3:0))*Math.PI/6);
    const growth=Math.pow(1+((Number(site.cityId.slice(2,4))+site.seed%7)%9-3)*0.004,age);
    const demand=shape*(0.9+day*0.003)*(1+((day*7+site.seed)%13-6)*0.009)*(legacy?(date.startsWith('2026-09')?0.94:1):season*growth);
    return {day,demand,age,legacy};
  }
  const factorFor=(p:ReturnType<typeof profile>,code:Operator)=>p.demand*(1+((p.day+OPERATOR_CODES.indexOf(code))%5-2)*0.007)*(p.legacy?1:Math.pow(1+(OPERATOR_CODES.indexOf(code)-1)*0.002,p.age));
  const days=new Map<string,ReturnType<typeof profile>&{hours:({all:HourMetrics;operators:Map<Operator,HourMetrics>}|undefined)[]}>();
  const sample=(date:string,hour:number,operator:OperatorFilter='all'):HourMetrics=>{
    if(!Number.isInteger(hour)||hour<0||hour>23)throw Error('invalid_calendar_sample');
    if(operator!=='all'&&!site.operators.includes(operator))throw Error('operator_not_applicable');
    let dayData=days.get(date);
    if(!dayData){
      const p=profile(date);
      dayData={...p,hours:[]};days.set(date,dayData);
    }
    let cached=dayData.hours[hour];
    if(!cached){
      const {physical,operators}=bases[hour],{day,demand}=dayData;
      if(date===DEMO_DATE)cached={all:physical,operators:new Map(operators.map(p=>[p.code,p.base]))};
      else {
        const sums=emptyCounters(),metrics=new Map<Operator,HourMetrics>();
        const environment={...physical,energyWh:Math.round(physical.energyWh!*(0.88+0.12*demand)),temperature:Math.round((physical.temperature+(day%7-3)*0.3)*10)/10};
        for(const {code,base} of operators){
          const factor=factorFor(dayData,code);
          const bytes=Math.round(base.bytes*factor),upBytes=Math.round(base.upBytes*factor),attempts=Math.round(base.attempts*factor);
          const connected=base.attempts?Math.min(attempts,Math.floor(attempts*base.connected/base.attempts)):0;
          const counters={bytes,upBytes,downBytes:bytes-upBytes,attempts,connected,voiceSeconds:connected*(base.connected?base.voiceSeconds/base.connected:0),sms:Math.round(base.sms*factor),used:Math.min(base.capacity,Math.round(base.used*factor)),capacity:base.capacity};
          addCounters(sums,counters);metrics.set(code,{...environment,...counters,energyWh:null});
        }
        cached={all:{...environment,...sums},operators:metrics};
      }
      dayData.hours[hour]=cached;
    }
    return operator==='all'?cached.all:cached.operators.get(operator)!;
  };
  // Roll up the exact same hourly integer formula without allocating hourly
  // objects or retaining a full year of sample caches.
  const daily=(date:string):{code:Operator;counters:UsageCounters}[]=>{
    const p=profile(date);
    return site.operators.map((code,index)=>{
      const counters=emptyCounters(),factor=factorFor(p,code);
      for(let h=0;h<24;h++){
        const b=bases[h].operators[index].base;
        if(date===DEMO_DATE){addCounters(counters,b);continue;}
        const bytes=Math.round(b.bytes*factor),upBytes=Math.round(b.upBytes*factor),attempts=Math.round(b.attempts*factor);
        const connected=b.attempts?Math.min(attempts,Math.floor(attempts*b.connected/b.attempts)):0;
        counters.bytes+=bytes;counters.upBytes+=upBytes;counters.downBytes+=bytes-upBytes;
        counters.attempts+=attempts;counters.connected+=connected;counters.voiceSeconds+=connected*(b.connected?b.voiceSeconds/b.connected:0);
        counters.sms+=Math.round(b.sms*factor);counters.used+=Math.min(b.capacity,Math.round(b.used*factor));counters.capacity+=b.capacity;
      }
      return {code,counters};
    });
  };
  return {sample,daily};
}
export function calendarSampler(site:DemoSite) {
  return calendarSource(site).sample;
}
export function analyzeCalendarUsage(sites:readonly DemoSite[],query:MapQuery,period:ReportPeriod,observe?:(site:DemoSite,date:string,hour:number,metrics:HourMetrics)=>void,basis:'current'|'previous'='current'):CalendarUsage {
  const window=calendarWindow(period,basis),codes=OPERATOR_CODES.filter(code=>query.operator==='all'||code===query.operator);
  const rows=codes.map(code=>({sums:emptyExact(),code,sites:sites.filter(s=>s.operators.includes(code)).length,samples:0}));
  const dailySeries=window.dates.map(date=>({date,rows:codes.map(code=>({code,bytes:0n,voiceSeconds:0,sms:0}))}));
  const totals=emptyExact();let energyWh=0;
  for(const site of sites){
    const sample=calendarSampler(site);
    for(const [d,date] of window.dates.entries())for(let hour=0;hour<24;hour++){
      const whole=sample(date,hour,query.operator);addExact(totals,whole);energyWh+=whole.energyWh??0;
      observe?.(site,date,hour,whole);
      for(const row of rows){
        if(!site.operators.includes(row.code))continue;
        const m=sample(date,hour,row.code);
        addExact(row.sums,m);
        row.samples++;
        const target=dailySeries[d].rows.find(r=>r.code===row.code)!;
        target.bytes+=BigInt(m.bytes);target.voiceSeconds+=m.voiceSeconds;target.sms+=m.sms;
      }
    }
  }
  const output=rows.map(({sums,...row})=>{const counters=exactCounters(sums);return {...row,...counters,...calendarRates(counters)};});
  const sum=(key:'bytes'|'voiceSeconds'|'sms')=>rows.reduce((n,row)=>n+row.sums[key],0n);
  const counters=exactCounters(totals);
  return {contextKey:periodContextKey(query,period,basis),mode:'demo',version:DEMO_VERSION,ruleVersion:CALENDAR_RULE_VERSION,period,
    window:{start:window.start,end:window.end,timezone:window.timezone},physicalSites:sites.length,serviceRelations:rows.reduce((n,r)=>n+r.sites,0),sharedSites:sites.filter(s=>s.operators.length>1).length,samples:rows.reduce((n,r)=>n+r.samples,0),energyWh:query.operator==='all'?energyWh:null,
    totals:{...counters,...calendarRates(counters)},rows:output,checks:{bytesDelta:String(sum('bytes')-totals.bytes),voiceSecondsDelta:Number(sum('voiceSeconds')-totals.voiceSeconds),smsDelta:Number(sum('sms')-totals.sms)},dailySeries:dailySeries.map(d=>({...d,rows:d.rows.map(r=>({...r,bytes:String(r.bytes)}))})),
    calendar:{anchorDate:DEMO_DATE,days:window.dates.length,granularity:period==='day'?'hour':'day',sampleCutoff:SAMPLE_CUTOFF,sampleStatus:'complete_synthetic',expectedPhysicalSamples:sites.length*window.dates.length*24,observedPhysicalSamples:sites.length*window.dates.length*24}};
}
