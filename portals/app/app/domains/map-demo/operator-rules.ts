import {mapContextKey} from './geometry.ts';
import {DEMO_DATE,DEMO_VERSION,siteHour} from './rules.ts';
import {OPERATOR_CODES,type DemoSite,type MapQuery,type Operator} from './types.ts';

export type UsagePeriod='hour'|'day';
export const USAGE_RULE_VERSION='bsmoss-demo-usage-v1';
export interface UsageCounters {
  bytes:number;upBytes:number;downBytes:number;voiceSeconds:number;sms:number;
  attempts:number;connected:number;used:number;capacity:number;
}
export interface UsageRow extends UsageCounters {
  code:Operator;sites:number;samples:number;connectionRate:number|null;load:number|null;
}
export interface OperatorUsage {
  contextKey:string;mode:'demo';version:string;ruleVersion:string;period:UsagePeriod;
  window:{start:string;end:string;timezone:'Asia/Shanghai'};
  physicalSites:number;serviceRelations:number;sharedSites:number;samples:number;energyWh:number|null;
  totals:UsageCounters&{connectionRate:number|null;load:number|null};rows:UsageRow[];
  checks:{bytesDelta:number;voiceSecondsDelta:number;smsDelta:number};
  series:{hour:number;rows:{code:Operator;bytes:number;voiceSeconds:number;sms:number}[]}[];
}
export function parseUsagePeriod(value:string):UsagePeriod {
  if(value!=='hour'&&value!=='day')throw Error('invalid_period');
  return value;
}
export function usageContextKey(query:MapQuery,period:UsagePeriod):string {
  return JSON.stringify([mapContextKey({...query,topic:undefined}),period]);
}
const empty=():UsageCounters=>({bytes:0,upBytes:0,downBytes:0,voiceSeconds:0,sms:0,attempts:0,connected:0,used:0,capacity:0});
function add(target:UsageCounters,input:UsageCounters) {
  for(const key of Object.keys(target) as (keyof UsageCounters)[])target[key]+=input[key];
}
const rates=(v:UsageCounters)=>({connectionRate:v.attempts?v.connected/v.attempts:null,load:v.capacity?v.used/v.capacity:null});
// Input is the server-selected cohort, independent of camera bounds. No monetary or outage inference.
export function analyzeOperatorUsage(sites:readonly DemoSite[],query:MapQuery,period:UsagePeriod):OperatorUsage {
  parseUsagePeriod(period);
  const hours=period==='day'?Array.from({length:24},(_,h)=>h):[query.hour];
  const codes=OPERATOR_CODES.filter(code=>query.operator==='all'||query.operator===code);
  const applicable=codes.map(code=>({code,sites:sites.filter(site=>site.operators.includes(code))}));
  const rows=applicable.map(({code,sites:members})=>{
    const sums=empty();
    for(const site of members)for(const hour of hours)add(sums,siteHour(site,hour,code));
    return {...sums,...rates(sums),code,sites:members.length,samples:members.length*hours.length};
  });
  const totals=empty();let energyWh=0;
  for(const site of sites)for(const hour of hours){const m=siteHour(site,hour,query.operator);add(totals,m);energyWh+=m.energyWh??0;}
  const sum=(key:'bytes'|'voiceSeconds'|'sms')=>rows.reduce((n,row)=>n+row[key],0);
  const start=new Date(`${DEMO_DATE}T00:00:00+08:00`);
  start.setTime(start.getTime()+(period==='hour'?query.hour:0)*3600000);
  const iso=(date:Date)=>new Date(date.getTime()+8*3600000).toISOString().slice(0,19)+'+08:00';
  return {contextKey:usageContextKey(query,period),mode:'demo',version:DEMO_VERSION,ruleVersion:USAGE_RULE_VERSION,period,
    window:{start:iso(start),end:iso(new Date(start.getTime()+hours.length*3600000)),timezone:'Asia/Shanghai'},
    physicalSites:sites.length,serviceRelations:rows.reduce((n,r)=>n+r.sites,0),sharedSites:sites.filter(s=>s.operators.length>1).length,
    samples:rows.reduce((n,r)=>n+r.samples,0),energyWh:query.operator==='all'?energyWh:null,
    totals:{...totals,...rates(totals)},rows,
    checks:{bytesDelta:sum('bytes')-totals.bytes,voiceSecondsDelta:sum('voiceSeconds')-totals.voiceSeconds,smsDelta:sum('sms')-totals.sms},
    series:Array.from({length:24},(_,hour)=>({hour,rows:applicable.map(({code,sites:members})=>{
      let bytes=0,voiceSeconds=0,sms=0;
      for(const site of members){const m=siteHour(site,hour,code);bytes+=m.bytes;voiceSeconds+=m.voiceSeconds;sms+=m.sms;}
      return {code,bytes,voiceSeconds,sms};
    })})),
  };
}
