import {test} from 'node:test';
import assert from 'node:assert/strict';
import {counterChange,comparePeriodBases,analyzePeriodComparison,periodComparisonContextKey,type ComparisonBasis} from './period-comparison-rules.ts';
import {calendarWindow,calendarSampler,analyzeCalendarUsage} from './period-rules.ts';
import {changeLabel,signed,windowLabel} from './period-comparison-display.ts';
import {renderPeriodComparison} from './period-comparison-html.ts';
import {queryPeriodComparison,queryDailyReport,queryCalendarReport,parseMapQuery} from './service.ts';
import {renderDailyReport} from './report-html.ts';
import {renderCalendarReport} from './period-report-html.ts';
import {DEMO_SITES} from './resources.ts';
const read=(p='period=month&search=SX-DEMO-006')=>queryPeriodComparison(new URLSearchParams(p));
const query=parseMapQuery(new URLSearchParams()),site=DEMO_SITES.find(s=>s.id==='SX-DEMO-006')!;
function basis(role:'current'|'previous'):ComparisonBasis {
  const w=calendarWindow('month',role),days=w.dates.length;
  return {window:{start:w.start,end:w.end,timezone:w.timezone},days,scopeKey:'same-scope',cohortKey:'same-roster',ruleVersion:'same-rule',physicalSites:1,serviceRelations:1,expectedSamples:days*24,observedSamples:days*24,expectedServiceSamples:days*24,observedServiceSamples:days*24,totals:{bytes:'3100',upBytes:'100',downBytes:'3000',voiceSeconds:3100,sms:31,connected:99,attempts:100,used:50,capacity:100,connectionRate:0.99,load:0.5},energyWh:3100};
}
test('previous windows are exactly adjacent complete day, Monday week and 30-day September month',()=>{
  for(const period of ['day','week','month'] as const){const c=calendarWindow(period),p=calendarWindow(period,'previous');assert.equal(p.end,c.start);assert.equal(p.dates.length,period==='month'?30:period==='week'?7:1);}
  assert.equal(calendarWindow('day','previous').dates[0],'2026-10-24');assert.equal(calendarWindow('week','previous').dates[0],'2026-10-12');assert.equal(calendarWindow('month','previous').start,'2026-09-01T00:00:00+08:00');
  assert.equal(windowLabel(calendarWindow('month','previous')),'2026-09-01 \u2014 2026-09-30');
});
test('counter changes keep exact signed deltas beyond 53 bits and separate total and per-day change',()=>{
  const c=counterChange('9300000000000000001','9000000000000000000',31,30);assert.equal(c.delta,'300000000000000001');assert.equal(c.status,'comparable');assert.ok(c.rate!>0);assert.ok(Math.abs(c.dailyRate!)<1e-15);
  const equalDaily=counterChange('3100','3000',31,30);assert.equal(equalDaily.delta,'100');assert.equal(equalDaily.dailyRate,0);assert.ok(equalDaily.rate!>0);
  assert.equal(counterChange('1','3',1,1).delta,'-2');assert.equal(counterChange('0','3',1,1).rate,-1);assert.equal(changeLabel(counterChange('0','3',1,1)),'-100%');
  assert.equal(signed(-0.00001),'0');
});
test('zero and unavailable baselines never fabricate finite growth rates or Infinity',()=>{
  for(const [c,p,status,label] of [['0','0','both_zero','\u53cc\u671f\u5747\u96f6'],['10','0','from_zero','\u4ece\u96f6\u65b0\u589e']] as const){const r=counterChange(c,p,31,30);assert.equal(r.status,status);assert.equal(r.rate,null);assert.equal(r.dailyRate,null);assert.equal(changeLabel(r),label);}
  const r=counterChange('10','1',1,1,false);assert.equal(r.status,'unavailable');assert.equal(r.delta,null);assert.equal(r.rate,null);
  for(const [c,p,d] of [['NaN','1',1],['-1','1',1],['1','Infinity',1],['1','0',0],['1','0',1.5]] as const)assert.throws(()=>counterChange(c,p,d,1));
});
test('scope, exact roster, rule, aligned window and both physical/service sample coverage gate comparisons',()=>{
  const c=basis('current'),p=basis('previous');assert.equal(comparePeriodBases(c,p,'month','key').reason,'matched');
  const cases:[Partial<ComparisonBasis>,string][]=[
    [{scopeKey:'other'},'scope_mismatch'],[{cohortKey:'other'},'cohort_mismatch'],[{physicalSites:2},'cohort_mismatch'],[{serviceRelations:2},'cohort_mismatch'],[{ruleVersion:'other'},'rule_mismatch'],
    [{days:29},'window_mismatch'],[{window:{...p.window,end:'2026-09-30T00:00:00+08:00'}},'window_mismatch'],[{observedSamples:1},'incomplete_samples'],[{expectedSamples:1},'incomplete_samples'],[{observedServiceSamples:1},'incomplete_samples'],
  ];
  for(const [patch,reason] of cases){const r=comparePeriodBases(c,{...p,...patch},'month','key');assert.equal(r.reason,reason);assert.equal(r.comparable,false);assert.equal(r.metrics.bytes.rate,null);assert.equal(r.metrics.bytes.delta,null);assert.equal(r.rates.connection.points,null);}
});
test('comparison rates are percentage-point differences of pooled ratios rather than percent growth',()=>{
  const c=basis('current'),p=basis('previous');p.totals={...p.totals,connectionRate:0.95,load:0.6};
  const r=comparePeriodBases(c,p,'month','key');assert.ok(Math.abs(r.rates.connection.points!-4)<1e-10);assert.ok(Math.abs(r.rates.load.points!+10)<1e-10);
  const missing=comparePeriodBases({...c,totals:{...c.totals,connectionRate:null}},p,'month','key');assert.equal(missing.rates.connection.points,null);
});
test('actual month comparison is backed by all dated samples with exact byte evidence',()=>{
  const r=read(),c=analyzeCalendarUsage([site],query,'month'),p=analyzeCalendarUsage([site],query,'month',undefined,'previous');assert.equal(r.reason,'matched');assert.equal(r.current.days,31);assert.equal(r.previous.days,30);
  assert.deepEqual(r.current.totals,c.totals);assert.deepEqual(r.previous.totals,p.totals);assert.equal(r.current.observedSamples,31*24);assert.equal(r.previous.observedServiceSamples,30*24*5);
  assert.equal(r.metrics.bytes.delta,String(BigInt(c.totals.bytes)-BigInt(p.totals.bytes)));assert.notEqual(r.metrics.bytes.rate,r.metrics.bytes.dailyRate);
  const sample=calendarSampler(site),sum=calendarWindow('month','previous').dates.reduce((v,date)=>v+Array.from({length:24},(_,h)=>sample(date,h).bytes).reduce((n,b)=>n+BigInt(b),0n),0n);assert.equal(r.previous.totals.bytes,String(sum));
});
test('daily and weekly comparisons use same selected cohort and match report payloads and identifiers',()=>{
  const daily=queryDailyReport(new URLSearchParams('search=SX-DEMO-006')),day=read('period=day&search=SX-DEMO-006');assert.deepEqual(daily.comparison,day);assert.equal(day.metrics.bytes.current,String(daily.usage.totals.bytes));
  const week=queryCalendarReport(new URLSearchParams('period=week&search=SX-DEMO-006')),r=read('period=week&search=SX-DEMO-006');assert.deepEqual(week.comparison,r);assert.deepEqual(week.usage.totals,r.current.totals);
  assert.ok(renderDailyReport(daily).includes(day.metrics.bytes.previous));assert.ok(renderCalendarReport(week).includes(r.metrics.bytes.previous));
});
test('geometry, administrative and operator scopes intersect; camera/hour/topic cannot change comparison',()=>{
  const scope='period=month&cityId=610100&countyId=610113&selection=polygon:108.8,34.1;109.1,34.1;108.95,34.5&search=SX-DEMO-006';
  const a=read(scope),b=read(scope+'&operator=other');assert.equal(a.current.physicalSites,1);assert.equal(b.current.physicalSites,1);assert.equal(b.energy,null);assert.equal(b.previous.energyWh,null);
  assert.deepEqual(read(scope+'&hour=1&bbox=105,32,106,33&topic=power'),a);assert.equal(read(scope.replace('SX-DEMO-006','SX-DEMO-004')).reason,'empty_scope');
  assert.notEqual(a.contextKey,b.contextKey);assert.notEqual(a.contextKey,read(scope.replace('34.5','34.50001')).contextKey);
  assert.equal(periodComparisonContextKey(query,'month'),periodComparisonContextKey({...query,hour:2,bbox:[105,32,106,33],topic:'capacity'},'month'));
});
test('operator byte comparisons sum exactly to the all-operator current, previous and signed difference',()=>{
  const all=read(),ops=site.operators.map(code=>read('period=month&search=SX-DEMO-006&operator='+code));
  for(const key of ['current','previous','delta'] as const)assert.equal(BigInt(all.metrics.bytes[key]!),ops.reduce((v,r)=>v+BigInt(r.metrics.bytes[key]!),0n));
});
test('province month comparison keeps both large periods and signed changes exact through JSON',()=>{
  const r=analyzePeriodComparison(DEMO_SITES,query,'month');
  assert.equal(r.current.totals.bytes,'17693161582452974');
  assert.ok(BigInt(r.previous.totals.bytes)>BigInt(Number.MAX_SAFE_INTEGER));
  assert.equal(BigInt(r.previous.totals.bytes),BigInt(r.previous.totals.upBytes)+BigInt(r.previous.totals.downBytes));
  assert.equal(r.metrics.bytes.delta,String(BigInt(r.current.totals.bytes)-BigInt(r.previous.totals.bytes)));
  assert.equal(JSON.parse(JSON.stringify(r)).metrics.bytes.previous,r.previous.totals.bytes);assert.equal(r.reason,'matched');
});
test('empty cohort emits unavailable comparisons and no fabricated zero baseline growth',()=>{
  const r=read('period=week&search=not-found');assert.equal(r.reason,'empty_scope');assert.equal(r.comparable,false);assert.equal(r.metrics.bytes.status,'unavailable');assert.equal(r.metrics.bytes.rate,null);assert.equal(r.rates.load.points,null);assert.ok(!/NaN|Infinity/.test(renderPeriodComparison(r)));
});
test('comparison endpoint domain rejects forged baseline windows, duplicate periods and invalid geometry',()=>{
  for(const p of ['period=hour','period=year','period=week&period=month','period=week&baseline=2026-01-01','period=day&date=2026-10-25','period=day&workspaceId=forged','period=week&selection=polygon:0,0;2,2;0,2;2,0'])assert.throws(()=>read(p));
});
test('comparison HTML includes both total and daily evidence and escapes dynamic values',()=>{
  const r=read('period=day&search=SX-DEMO-006'),html=renderPeriodComparison(r);for(const s of [r.metrics.bytes.previous,r.metrics.bytes.current,r.previous.window.start,r.previous.window.end,r.version])assert.ok(html.includes(s));assert.ok(html.includes('\u65e5\u5747\u73af\u6bd4'));assert.ok(!/https?:\/\//.test(html));
  const bad=structuredClone(r);bad.version='<img src=x onerror=1>';assert.ok(renderPeriodComparison(bad).includes('&lt;img'));assert.ok(!renderPeriodComparison(bad).includes('<img'));assert.equal(renderPeriodComparison(undefined),'');
});
