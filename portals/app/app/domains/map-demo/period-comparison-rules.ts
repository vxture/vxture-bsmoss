import {mapContextKey} from './geometry.ts';
import {analyzeCalendarUsage,calendarWindow,periodContextKey,CALENDAR_RULE_VERSION,type CalendarUsage,type ReportPeriod} from './period-rules.ts';
import type {OperatorUsage} from './operator-rules.ts';
import type {DemoSite,MapQuery,RegionDefinition} from './types.ts';
import {contributionCollector,buildPeriodContribution,type BusinessCounters,type PeriodContribution} from './period-contribution-rules.ts';
export const PERIOD_COMPARISON_VERSION='bsmoss-demo-period-comparison-v2';
export type ChangeStatus='comparable'|'from_zero'|'both_zero'|'unavailable';
export interface CounterChange {
  current:string;previous:string;delta:string|null;rate:number|null;dailyRate:number|null;status:ChangeStatus;
}
export interface ComparisonBasis {
  window:CalendarUsage['window'];days:number;scopeKey:string;cohortKey:string;ruleVersion:string;
  physicalSites:number;serviceRelations:number;expectedSamples:number;observedSamples:number;
  expectedServiceSamples:number;observedServiceSamples:number;
  totals:CalendarUsage['totals'];energyWh:number|null;
}
export interface PeriodComparison {
  contextKey:string;mode:'demo';version:string;period:ReportPeriod;comparable:boolean;
  reason:'matched'|'empty_scope'|'scope_mismatch'|'cohort_mismatch'|'incomplete_samples'|'rule_mismatch'|'window_mismatch';
  current:Omit<ComparisonBasis,'scopeKey'|'cohortKey'>;previous:Omit<ComparisonBasis,'scopeKey'|'cohortKey'>;
  metrics:Record<'bytes'|'voiceSeconds'|'sms',CounterChange>;
  energy:CounterChange|null;
  contribution?:PeriodContribution;
  rates:{connection:{current:number|null;previous:number|null;points:number|null};load:{current:number|null;previous:number|null;points:number|null}};
}
export function periodComparisonContextKey(query:MapQuery,period:ReportPeriod):string {
  return JSON.stringify([periodContextKey(query,period),calendarWindow(period,'previous'),PERIOD_COMPARISON_VERSION]);
}
// Exact signed differences and exact rational scaling until the final display ratio.
export function counterChange(current:string,previous:string,currentDays:number,previousDays:number,available=true):CounterChange {
  if(!/^\d{1,100}$/.test(current)||!/^\d{1,100}$/.test(previous)||!Number.isSafeInteger(currentDays)||currentDays<1||currentDays>366||!Number.isSafeInteger(previousDays)||previousDays<1||previousDays>366)throw Error('invalid_comparison_counter');
  const c=BigInt(current),p=BigInt(previous),delta=c-p;
  if(!available)return {current,previous,delta:null,rate:null,dailyRate:null,status:'unavailable'};
  if(p===0n)return {current,previous,delta:String(delta),rate:null,dailyRate:null,status:c===0n?'both_zero':'from_zero'};
  return {current,previous,delta:String(delta),rate:Number(delta)/Number(p),dailyRate:Number(c*BigInt(previousDays)-p*BigInt(currentDays))/Number(p*BigInt(currentDays)),status:'comparable'};
}
export function comparePeriodBases(current:ComparisonBasis,previous:ComparisonBasis,period:ReportPeriod,contextKey:string):PeriodComparison {
  const expectedCurrent=calendarWindow(period),expectedPrevious=calendarWindow(period,'previous');
  const aligned=(b:ComparisonBasis,w:ReturnType<typeof calendarWindow>)=>b.window.start===w.start&&b.window.end===w.end&&b.window.timezone==='Asia/Shanghai'&&b.days===w.dates.length;
  const covered=(b:ComparisonBasis)=>b.expectedSamples===b.physicalSites*b.days*24&&b.observedSamples===b.expectedSamples&&b.expectedServiceSamples===b.serviceRelations*b.days*24&&b.observedServiceSamples===b.expectedServiceSamples;
  const reason=current.scopeKey!==previous.scopeKey?'scope_mismatch':current.cohortKey!==previous.cohortKey||current.physicalSites!==previous.physicalSites||current.serviceRelations!==previous.serviceRelations?'cohort_mismatch':current.ruleVersion!==previous.ruleVersion?'rule_mismatch':!aligned(current,expectedCurrent)||!aligned(previous,expectedPrevious)?'window_mismatch':!covered(current)||!covered(previous)?'incomplete_samples':!current.physicalSites?'empty_scope':'matched';
  const available=reason==='matched',change=(key:'bytes'|'voiceSeconds'|'sms')=>counterChange(String(current.totals[key]),String(previous.totals[key]),current.days,previous.days,available);
  const rate=(key:'connectionRate'|'load')=>({current:current.totals[key],previous:previous.totals[key],points:available&&current.totals[key]!==null&&previous.totals[key]!==null?(current.totals[key]!-previous.totals[key]!)*100:null});
  const evidence=({scopeKey:_,cohortKey:__,...basis}:ComparisonBasis)=>basis;
  return {contextKey,mode:'demo',version:PERIOD_COMPARISON_VERSION,period,comparable:available,reason,current:evidence(current),previous:evidence(previous),metrics:{bytes:change('bytes'),voiceSeconds:change('voiceSeconds'),sms:change('sms')},energy:current.energyWh===null||previous.energyWh===null?null:counterChange(String(current.energyWh),String(previous.energyWh),current.days,previous.days,available),rates:{connection:rate('connectionRate'),load:rate('load')}};
}
export function analyzePeriodComparison(sites:readonly DemoSite[],query:MapQuery,period:ReportPeriod,currentUsage?:CalendarUsage|OperatorUsage,currentCounters?:ReadonlyMap<string,BusinessCounters>,region?:RegionDefinition):PeriodComparison {
  const c=contributionCollector(sites),p=contributionCollector(sites);
  const computed=!currentUsage||!currentCounters?analyzeCalendarUsage(sites,query,period,(site,_date,_hour,m)=>c.observe(site,m)):undefined;
  const current=currentUsage??computed!,previous=analyzeCalendarUsage(sites,query,period,(site,_date,_hour,m)=>p.observe(site,m),'previous');
  const scopeKey=mapContextKey({...query,hour:0,topic:undefined});
  const cohortKey=JSON.stringify(sites.map(s=>[s.id,query.operator==='all'?[...s.operators].sort():[query.operator]]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))));
  const basis=(usage:CalendarUsage|OperatorUsage,role:'current'|'previous'):ComparisonBasis=>{
    const days=calendarWindow(period,role).dates.length;
    const totals={...usage.totals,bytes:String(usage.totals.bytes),upBytes:String(usage.totals.upBytes),downBytes:String(usage.totals.downBytes)};
    // The current legacy daily engine is byte-for-byte equivalent on DEMO_DATE;
    // normalize it into this comparison contract without changing its own version.
    return {window:usage.window,days,scopeKey,cohortKey,ruleVersion:CALENDAR_RULE_VERSION,physicalSites:usage.physicalSites,serviceRelations:usage.serviceRelations,expectedSamples:usage.physicalSites*days*24,observedSamples:'calendar' in usage?usage.calendar.observedPhysicalSamples:(usage.serviceRelations?usage.samples/usage.serviceRelations*usage.physicalSites:0),expectedServiceSamples:usage.serviceRelations*days*24,observedServiceSamples:usage.samples,totals,energyWh:usage.energyWh};
  };
  const comparison=comparePeriodBases(basis(current,'current'),basis(previous,'previous'),period,periodComparisonContextKey(query,period));
  return {...comparison,contribution:buildPeriodContribution(sites,currentCounters??c.counters,p.counters,comparison,region)};
}
