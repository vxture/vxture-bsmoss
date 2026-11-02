import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calendarWindow,calendarSampler,analyzeCalendarUsage,periodContextKey} from './period-rules.ts';
import {queryCalendarUsage,queryCalendarReport,queryOperatorUsage,queryDailyReport,parseMapQuery} from './service.ts';
import {renderCalendarReport} from './period-report-html.ts';
import {analyzeCalendarReport} from './period-report-rules.ts';
import {DEMO_SITES} from './resources.ts';
import {siteHour} from './rules.ts';
import {useWorkbench} from './workbench-store.ts';
const read=(s='period=week&search=SX-DEMO-006')=>queryCalendarUsage(new URLSearchParams(s));
const report=(s='period=week&search=SX-DEMO-006')=>queryCalendarReport(new URLSearchParams(s));
const q=parseMapQuery(new URLSearchParams()),site=DEMO_SITES.find(s=>s.id==='SX-DEMO-006')!;

test('calendar windows use Shanghai complete days, Monday weeks and natural month with half-open end',()=>{
  const day=calendarWindow('day'),week=calendarWindow('week'),month=calendarWindow('month');
  assert.equal(day.start,'2026-10-25T00:00:00+08:00');assert.equal(day.end,'2026-10-26T00:00:00+08:00');assert.equal(day.dates.length,1);
  assert.equal(week.start,'2026-10-19T00:00:00+08:00');assert.equal(week.end,day.end);assert.equal(week.dates.length,7);
  assert.equal(month.start,'2026-10-01T00:00:00+08:00');assert.equal(month.end,'2026-11-01T00:00:00+08:00');assert.equal(month.dates.length,31);assert.equal(month.dates.at(-1),'2026-10-31');
  assert.ok(month.dates.every((date,i)=>!i||Date.parse(date)-Date.parse(month.dates[i-1])===86400000));
});
test('dated samples preserve existing demo day, vary by date and conserve operator integer counters',()=>{
  const sample=calendarSampler(site);
  for(const code of ['all',...site.operators] as const)assert.deepEqual(sample('2026-10-25',18,code),siteHour(site,18,code));
  assert.notEqual(sample('2026-10-19',18).bytes,sample('2026-10-20',18).bytes);
  for(const date of ['2026-10-01','2026-10-19','2026-10-25','2026-10-31'])for(const hour of [0,12,18,23]){
    const all=sample(date,hour),ops=site.operators.map(code=>sample(date,hour,code));
    for(const key of ['bytes','upBytes','downBytes','voiceSeconds','sms','attempts','connected','used','capacity'] as const){
      assert.equal(all[key],ops.reduce((v,m)=>v+m[key],0));assert.ok(Number.isSafeInteger(all[key]));
    }
    assert.equal(all.bytes,all.upBytes+all.downBytes);assert.ok(all.used<=all.capacity);assert.ok(all.connected<=all.attempts);assert.ok(ops.every(m=>m.energyWh===null));
  }
  for(const date of ['2026-08-31','2026-09-31','2026-11-01','2026-10-32','2026-10-00'])assert.throws(()=>sample(date,1));assert.throws(()=>sample('2026-10-25',24));
});
test('calendar day exactly matches legacy daily counters and physical parameters',()=>{
  const dated=analyzeCalendarUsage([site],q,'day'),daily=queryOperatorUsage(new URLSearchParams('period=day&search=SX-DEMO-006'));
  for(const key of ['bytes','upBytes','downBytes'] as const)assert.equal(dated.totals[key],String(daily.totals[key]));
  for(const key of ['voiceSeconds','sms','connected','attempts','used','capacity','load','connectionRate'] as const)assert.equal(dated.totals[key],daily.totals[key]);
  assert.equal(dated.energyWh,daily.energyWh);assert.equal(dated.samples,daily.samples);
});
test('weekly counts preserve station identities, daily conservation and pooled ratios rather than multiplying a day',()=>{
  const u=read(),day=queryOperatorUsage(new URLSearchParams('search=SX-DEMO-006&period=day'));
  assert.equal(u.physicalSites,1);assert.equal(u.serviceRelations,5);assert.equal(u.sharedSites,1);assert.equal(u.samples,5*7*24);assert.equal(u.calendar.expectedPhysicalSamples,7*24);
  assert.notEqual(BigInt(u.totals.bytes),BigInt(day.totals.bytes)*7n);
  assert.equal(BigInt(u.totals.bytes),u.dailySeries.reduce((sum,d)=>sum+d.rows.reduce((v,r)=>v+BigInt(r.bytes),0n),0n));
  assert.equal(BigInt(u.totals.bytes),u.rows.reduce((v,r)=>v+BigInt(r.bytes),0n));assert.equal(BigInt(u.totals.bytes),BigInt(u.totals.upBytes)+BigInt(u.totals.downBytes));
  assert.equal(u.totals.connectionRate,u.rows.reduce((v,r)=>v+r.connected,0)/u.rows.reduce((v,r)=>v+r.attempts,0));
  assert.equal(u.totals.load,u.rows.reduce((v,r)=>v+r.used,0)/u.rows.reduce((v,r)=>v+r.capacity,0));
  assert.deepEqual(u.checks,{bytesDelta:'0',voiceSecondsDelta:0,smsDelta:0});
});
test('province month byte totals exceed 53 bits without rounding and survive JSON round-trip',()=>{
  const u=read('period=month');assert.ok(BigInt(u.totals.bytes)>BigInt(Number.MAX_SAFE_INTEGER));
  for(const key of ['bytes','upBytes','downBytes'] as const)assert.equal(BigInt(u.totals[key]),u.rows.reduce((v,r)=>v+BigInt(r[key]),0n));
  assert.equal(BigInt(u.totals.bytes),u.dailySeries.reduce((v,d)=>v+d.rows.reduce((n,r)=>n+BigInt(r.bytes),0n),0n));
  assert.equal(JSON.parse(JSON.stringify(u)).totals.bytes,u.totals.bytes);assert.equal(u.calendar.days,31);assert.equal(u.physicalSites,1080);assert.equal(u.calendar.observedPhysicalSamples,1080*31*24);
});
test('calendar operator scope uses same row, retains unknown energy and never applies camera bounds',()=>{
  const u=read(),one=read('period=week&search=SX-DEMO-006&operator=other');assert.deepEqual(one.rows[0],u.rows.find(r=>r.code==='other'));assert.equal(one.energyWh,null);assert.equal(one.samples,7*24);
  assert.deepEqual(read('period=week&search=SX-DEMO-006&bbox=105,32,106,33&hour=2&topic=power'),u);
  const scope='period=month&cityId=610100&countyId=610113&operator=other&selection=polygon:108.8,34.1;109.1,34.1;108.95,34.5&search=SX-DEMO-006';
  assert.equal(read(scope).physicalSites,1);assert.equal(read(scope.replace('SX-DEMO-006','SX-DEMO-004')).physicalSites,0);
});
test('calendar report daily rows, operator rows and runtime observations agree with usage',()=>{
  const r=report(),u=read();assert.deepEqual(r.usage,u);assert.equal(r.days.length,7);assert.equal(r.runtime.samples,7*24);assert.equal(r.status,'draft');assert.equal(r.mode,'demo');
  for(const key of ['bytes','upBytes','downBytes'] as const)assert.equal(BigInt(u.totals[key]),r.days.reduce((v,d)=>v+BigInt(d[key]),0n));
  for(const key of ['voiceSeconds','sms','attempts','connected','used','capacity'] as const)assert.equal(u.totals[key],r.days.reduce((v,d)=>v+d[key],0));
  assert.equal(u.energyWh,r.days.reduce((v,d)=>v+d.energyWh!,0));
  const daily=queryDailyReport(new URLSearchParams('search=SX-DEMO-006')),d=r.days.find(d=>d.date==='2026-10-25')!;assert.equal(d.bytes,String(daily.usage.totals.bytes));assert.equal(d.load,daily.usage.totals.load);
});
test('period peaks use simultaneous cohort timestamps and ranking keeps original site totals',()=>{
  const r=report('period=week&cityId=610100&search=SX-DEMO-00'),sites=DEMO_SITES.filter(s=>s.cityId==='610100'&&s.id.includes('SX-DEMO-00'));
  const slots=calendarWindow('week').dates.flatMap(date=>Array.from({length:24},(_,hour)=>({date,hour,bytes:sites.reduce((v,s)=>v+BigInt(calendarSampler(s)(date,hour).bytes),0n)})));
  const peak=slots.reduce((a,b)=>b.bytes>a.bytes?b:a);assert.equal(r.busy!.bytes,String(peak.bytes));assert.equal(r.busy!.date,peak.date);assert.equal(r.busy!.hour,peak.hour);
  const s=r.ranking.find(s=>s.id==='SX-DEMO-006')!;assert.ok(s);assert.equal(s.bytes,report().ranking[0].bytes);
});
test('calendar report identity ignores playback, topic and camera while retaining period, geometry and operator',()=>{
  const a=report();assert.deepEqual(report('period=week&search=SX-DEMO-006&hour=23&bbox=105,32,106,33&topic=power'),a);
  assert.notEqual(report('period=month&search=SX-DEMO-006').id,a.id);assert.notEqual(report('period=week&search=SX-DEMO-006&operator=mobile').id,a.id);
  assert.match(a.id,/^DEMO-WEEK-[a-f0-9]{20}$/);assert.equal(periodContextKey(q,'week'),periodContextKey({...q,hour:2,bbox:[105,32,106,33],topic:'power'},'week'));
});
test('empty calendar reports keep unknown rates, no fabricated peaks and no non-finite display',()=>{
  const r=report('period=month&search=not-found');assert.equal(r.usage.totals.bytes,'0');assert.equal(r.usage.totals.connectionRate,null);assert.equal(r.busy,null);assert.equal(r.highestLoad,null);assert.equal(r.lowestConnection,null);assert.equal(r.runtime.temperatureMean,null);assert.equal(r.ranking.length,0);
  assert.equal(r.days.length,31);assert.ok(r.days.every(d=>d.bytes==='0'&&d.load===null));assert.ok(!/NaN|Infinity/.test(renderCalendarReport(r)));
});
test('calendar request boundaries reject duplicate, unsupported and forged query fields',()=>{
  for(const params of ['','period=day','period=year','period=month&period=week','period=week&date=2026-10-25','period=week&workspaceId=forged','period=week&hour=24','period=week&countyId=610113'])assert.throws(()=>read(params));
  for(const params of ['period=week&date=2026-10-26','period=week&date=2026-10-25&date=2026-10-25','period=month&format=html'])assert.throws(()=>report(params));
});
test('calendar HTML contains full-day evidence, exact counters, escaped text and no remote dependencies',()=>{
  const r=report('period=month&search=SX-DEMO-006'),html=renderCalendarReport(r);
  for(const text of [r.id,r.templateVersion,r.usage.ruleVersion,r.usage.window.start,r.usage.window.end,BigInt(r.usage.totals.bytes).toLocaleString('zh-CN'),'2026-10-31'])assert.ok(html.includes(text));
  assert.equal((html.match(/<h2>/g)??[]).length,6);assert.ok(!/https?:\/\//.test(html));
  const unsafe=analyzeCalendarReport([],q,'week','<img onerror=alert(1)>');const escaped=renderCalendarReport({id:'safe',...unsafe,ranking:[{id:'<script>',name:'</table><script>',bytes:'0',voiceSeconds:0,sms:0,peakDate:'2026-10-19',peakHour:0}]});assert.ok(escaped.includes('&lt;img'));assert.ok(!escaped.includes('<script>'));assert.ok(!escaped.includes('<img'));
});
test('period switches retain geometry, preserve independent panel periods and pause playback',()=>{
  const state=()=>useWorkbench.getState();state().set({cityId:'all',selection:[108,34,109,35],reportOpen:true,playing:true});
  state().set({reportPeriod:'month',playing:false});assert.equal(state().playing,false);assert.deepEqual(state().selection,[108,34,109,35]);
  state().set({usageOpen:true,usagePeriod:'week'});assert.equal(state().reportOpen,false);assert.equal(state().reportPeriod,'month');assert.equal(state().usagePeriod,'week');
  state().set({reportOpen:true});assert.equal(state().usageOpen,false);assert.equal(state().reportPeriod,'month');state().clearSelection();
});
