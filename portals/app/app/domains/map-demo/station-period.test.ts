import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evaluateWave,baselineDates,analyzeStationPeriod,stationPeriodContextKey,WAVE_POLICY} from './station-period-rules.ts';
import {DEMO_SITES} from './resources.ts';
import {calendarWindow,calendarSampler,analyzeCalendarUsage} from './period-rules.ts';
import {parseMapQuery,queryStationPeriod} from './service.ts';
import {siteHour} from './rules.ts';
import {BUSINESS_KEYS} from './period-contribution-rules.ts';
const site=DEMO_SITES.find(s=>s.id==='SX-DEMO-003')!,q=parseMapQuery(new URLSearchParams());
test('same-weekday references are strictly earlier four weeks and supported across October edges',()=>{
  for(const date of calendarWindow('month').dates){const days=baselineDates(date);assert.equal(days.length,4);for(const [i,d] of days.entries()){assert.equal((Date.parse(date)-Date.parse(d))/86400000,(i+1)*7);assert.equal(new Date(date).getUTCDay(),new Date(d).getUTCDay());assert.ok(d<date);}}
  assert.equal(baselineDates('2026-10-01')[3],'2026-09-03');assert.equal(baselineDates('2026-10-31')[0],'2026-10-24');assert.throws(()=>baselineDates('2026-10-32'));
});
test('four-value median retains half counters and requires both relative and absolute thresholds',()=>{
  const input=['200','50','0','51'],copy=[...input],v=evaluateWave('60',input,'9');assert.equal(v.referenceNumerator,'101');assert.equal(v.deltaNumerator,'19');assert.equal(v.rate,19/101);assert.equal(v.flagged,true);assert.equal(v.status,'up');assert.deepEqual(input,copy);assert.deepEqual(v.references,input);
  assert.equal(evaluateWave('60',input,'10').flagged,false);assert.equal(evaluateWave('114',['100','100','100','100'],'1').flagged,false);assert.equal(evaluateWave('115',['100','100','100','100'],'1').flagged,true);assert.equal(evaluateWave('85',['100','100','100','100'],'1').status,'down');
});
test('zero reference and missing baseline never manufacture a finite percentage change',()=>{
  const zero=['0','0','0','0'];assert.equal(evaluateWave('0',zero,'1').status,'both_zero');assert.equal(evaluateWave('0',zero,'1').flagged,false);assert.equal(evaluateWave('0',zero,'1').rate,null);
  assert.equal(evaluateWave('10',zero,'20').status,'from_zero');assert.equal(evaluateWave('10',zero,'20').flagged,false);assert.equal(evaluateWave('20',zero,'20').flagged,true);assert.equal(evaluateWave('20',zero,'20').rate,null);
  const missing=evaluateWave('100',['10','10','10'],'1');assert.equal(missing.status,'insufficient');assert.equal(missing.rate,null);assert.equal(missing.referenceNumerator,null);assert.equal(missing.flagged,false);
});
test('wave arithmetic keeps >53-bit signed differences exact and rejects invalid counters and policy',()=>{
  const n=9007199254740993n,v=evaluateWave(String(n+123n),Array(4).fill(String(n)),'1');assert.equal(v.deltaNumerator,'246');assert.equal(v.referenceNumerator,String(2n*n));
  for(const args of [['-1',['1','1','1','1'],'1'],['1',['NaN'],'1'],['1',[],'0'],['1',[],'1',0],['1',[],'1',1.5]] as [string,string[],string,number?][])assert.throws(()=>evaluateWave(...args));
});
test('period day/hour/total counters reconcile exactly and preserve legacy October 25 samples',()=>{
  const r=analyzeStationPeriod(site,q,'month');assert.equal(r.hours.length,744);assert.equal(r.days.length,31);assert.equal(r.usage.calendar.observedPhysicalSamples,744);
  for(const metric of BUSINESS_KEYS){assert.equal(r.days.reduce((n,d)=>n+BigInt(d.counters[metric]),0n),BigInt(r.usage.totals[metric]));assert.equal(r.hours.reduce((n,h)=>n+BigInt(h.counters[metric]),0n),BigInt(r.usage.totals[metric]));}
  for(const h of r.hours.filter(h=>h.date==='2026-10-25'))assert.equal(h.counters.bytes,String(siteHour(site,h.hour).bytes));
  assert.deepEqual(r.usage,analyzeCalendarUsage([site],q,'month'));
  const d=r.days[0],list=r.hours.filter(h=>h.date===d.date);assert.equal(d.connectionRate,d.counters.connected/d.counters.attempts);assert.equal(d.load,d.counters.used/d.counters.capacity);assert.equal(d.energyWh,list.reduce((n,h)=>n+h.energyWh!,0));
});
test('reference values and daily reference lines are reconstructable from independent dated samples',()=>{
  const r=analyzeStationPeriod(site,q,'week'),sample=calendarSampler(site);
  for(const h of r.hours)for(const metric of BUSINESS_KEYS){assert.deepEqual(h.waves[metric].references,h.baselineDates.map(d=>String(sample(d,h.hour)[metric])));const refs=h.waves[metric].references.map(BigInt).sort((a,b)=>a<b?-1:a>b?1:0);assert.equal(h.waves[metric].referenceNumerator,String(refs[1]+refs[2]));}
  for(const d of r.days)for(const metric of BUSINESS_KEYS)assert.equal(d.referenceNumerators[metric],String(r.hours.filter(h=>h.date===d.date).reduce((n,h)=>n+BigInt(h.waves[metric].referenceNumerator!),0n)));
});
test('flags, directional counts, affected dates and top-eight evidence use the same source rules',()=>{
  const r=analyzeStationPeriod(site,q,'month');assert.ok(r.findings.bytes.count>0);
  for(const metric of BUSINESS_KEYS){const f=r.findings[metric],flagged=r.hours.filter(h=>h.waves[metric].flagged);assert.equal(f.count,flagged.length);assert.equal(f.up+f.down,f.count);assert.equal(f.days,new Set(flagged.map(h=>h.date)).size);assert.equal(f.top.length,Math.min(8,f.count));for(const item of f.top)assert.deepEqual(item.wave,r.hours.find(h=>h.date===item.date&&h.hour===item.hour)!.waves[metric]);}
  assert.equal(r.policy.relativeBps,1500);assert.deepEqual(r.policy,WAVE_POLICY);
});
test('single-operator current usage conserves business totals while physical energy stays unallocated',()=>{
  const s=DEMO_SITES.find(s=>s.id==='SX-DEMO-006')!,all=analyzeStationPeriod(s,q,'day'),operators=s.operators.map(operator=>analyzeStationPeriod(s,{...q,operator},'day'));
  for(const metric of BUSINESS_KEYS)assert.equal(BigInt(all.usage.totals[metric]),operators.reduce((n,r)=>n+BigInt(r.usage.totals[metric]),0n));
  for(const r of operators){assert.equal(r.usage.energyWh,null);assert.ok(r.days.every(d=>d.energyWh===null));assert.ok(r.hours.every(h=>h.energyWh===null));}
});
test('site period shares administrative, operator and exact geometry scope and ignores map clock/camera',()=>{
  const s=DEMO_SITES.find(s=>s.id==='SX-DEMO-006')!,base='cityId='+s.cityId+'&countyId='+s.countyId+'&period=week&operator=other';
  const scope=base+'&selection=circle:'+s.lng+','+s.lat+',1000',a=queryStationPeriod(s.id,new URLSearchParams(scope))!;assert.ok(a);assert.deepEqual(queryStationPeriod(s.id,new URLSearchParams(scope+'&hour=2&bbox=105,32,106,33&topic=power')),a);
  assert.equal(queryStationPeriod(s.id,new URLSearchParams(base+'&selection=circle:105,32,1000')),null);assert.equal(queryStationPeriod(s.id,new URLSearchParams(base+'&search=missing')),null);assert.equal(queryStationPeriod(s.id,new URLSearchParams('cityId=610300')),null);
  assert.equal(stationPeriodContextKey(s.id,q,'week'),stationPeriodContextKey(s.id,{...q,hour:1,bbox:[105,32,106,33],topic:'power'},'week'));assert.notEqual(stationPeriodContextKey(s.id,q,'week'),stationPeriodContextKey(site.id,q,'week'));
});
test('station period accepts only fixed server-owned windows and baseline/threshold policies',()=>{
  assert.equal(queryStationPeriod(site.id,new URLSearchParams())!.period,'day');assert.equal(queryStationPeriod('not-found',new URLSearchParams()),null);
  for(const p of ['period=year','period=hour','period=week&period=month','period=day&date=2026-10-24','baseline=2026-10-01','relativeBps=1','workspaceId=forged','countyId=610113'])assert.throws(()=>queryStationPeriod(site.id,new URLSearchParams(p)));
  assert.throws(()=>queryStationPeriod('../invalid',new URLSearchParams()));
});
