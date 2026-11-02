import {test} from 'node:test';
import assert from 'node:assert/strict';
import {queryDailyReport,queryOperatorUsage,queryMap,parseMapQuery} from './service.ts';
import {analyzeDailyReport,reportContextKey} from './report-rules.ts';
import {renderDailyReport} from './report-html.ts';
import {DEMO_SITES} from './resources.ts';
import {siteHour} from './rules.ts';
const read=(p='')=>queryDailyReport(new URLSearchParams(p));
test('daily report reuses operator totals and all hourly counters conserve daily totals',()=>{
 const p='cityId=610100&countyId=610113&selection=108.8,34.1,109.1,34.5';
 const r=read(p),u=queryOperatorUsage(new URLSearchParams(p+'&period=day&hour=0'));
 assert.deepEqual(r.usage,u);assert.equal(r.hours.length,24);assert.equal(r.status,'draft');assert.equal(r.mode,'demo');
 for(const key of ['bytes','voiceSeconds','sms','connected','attempts','used','capacity'] as const)assert.equal(r.hours.reduce((n,h)=>n+h[key],0),u.totals[key]);
 assert.equal(r.hours.reduce((n,h)=>n+h.energyWh!,0),u.energyWh);
 for(const h of r.hours){const map=queryMap(parseMapQuery(new URLSearchParams(p+'&hour='+h.hour)));assert.equal(h.bytes,map.summary.bytes);assert.equal(h.load,map.summary.load);assert.equal(h.connectionRate,map.summary.connectionRate);}
});
test('busy hour is a simultaneous cohort peak and ranking has stable daily counters',()=>{
 const r=read('cityId=610100'),max=Math.max(...r.hours.map(h=>h.bytes));
 assert.equal(r.busy!.bytes,max);assert.equal(r.busy!.hour,r.hours.find(h=>h.bytes===max)!.hour);assert.equal(r.busy!.share,max/r.usage.totals.bytes);
 assert.equal(r.highestLoad!.value,Math.max(...r.hours.map(h=>h.load!)));assert.equal(r.lowestConnection!.value,Math.min(...r.hours.map(h=>h.connectionRate!)));
 assert.equal(r.ranking.length,5);assert.ok(r.ranking.every((s,i,a)=>!i||a[i-1].bytes>=s.bytes));
 for(const entry of r.ranking){const site=DEMO_SITES.find(s=>s.id===entry.id)!;assert.equal(entry.bytes,Array.from({length:24},(_,h)=>siteHour(site,h)).reduce((n,m)=>n+m.bytes,0));}
});
test('report reference and daily content ignore camera, selected hour and topic but change by scope',()=>{
 const r=read('cityId=610100');assert.deepEqual(read('cityId=610100&hour=23&bbox=105,32,106,33&topic=power'),r);
 assert.notEqual(read('cityId=610100&operator=other').id,r.id);assert.notEqual(read('cityId=610300').id,r.id);
 assert.match(r.id,/^DEMO-DAY-[a-f0-9]{20}$/);
 assert.equal(reportContextKey(parseMapQuery(new URLSearchParams('hour=12'))),reportContextKey(parseMapQuery(new URLSearchParams('hour=0&topic=capacity'))));
});
test('runtime parameters count physical site samples once and do not infer service outage',()=>{
 const r=read('search=SX-DEMO-004'),op=read('search=SX-DEMO-004&operator=mobile');
 assert.equal(r.runtime.samples,24);assert.equal(r.runtime.batterySites,1);assert.equal(r.runtime.batterySiteHours,3);
 assert.deepEqual(op.runtime,r.runtime);assert.equal(op.usage.energyWh,null);assert.ok(op.hours.every(h=>h.energyWh===null));
 const site=DEMO_SITES.find(s=>s.id==='SX-DEMO-004')!,values=Array.from({length:24},(_,h)=>siteHour(site,h).temperature);
 assert.equal(r.runtime.temperatureMean,values.reduce((a,b)=>a+b,0)/24);assert.equal(r.runtime.temperatureMin,Math.min(...values));assert.equal(r.runtime.temperatureMax,Math.max(...values));
});
test('empty daily reports have unknown rates and no fabricated busy or temperature observations',()=>{
 const r=read('search=nonexistent');assert.equal(r.busy,null);assert.equal(r.highestLoad,null);assert.equal(r.lowestConnection,null);assert.equal(r.runtime.temperatureMean,null);assert.equal(r.runtime.temperatureMin,null);assert.equal(r.runtime.temperatureMax,null);assert.equal(r.ranking.length,0);
 assert.ok(r.hours.every(h=>h.bytes===0&&h.connectionRate===null&&h.load===null));assert.ok(!renderDailyReport(r).includes('NaN'));
});
test('report date and query boundaries reject unsupported periods, duplicates and forged fields',()=>{
 for(const p of ['date=2026-10-26','date=','date=2026-10-25&date=2026-10-25','period=week','format=pdf','workspaceId=forged','cityId=610300&countyId=610113'])assert.throws(()=>read(p));
 assert.equal(read('date=2026-10-25').date,'2026-10-25');
});
test('download is a self-contained escaped report with identical reference, window, sections and numeric evidence',()=>{
 const q=parseMapQuery(new URLSearchParams()),base=analyzeDailyReport([],q,'<img src=x onerror=alert(1)>');
 const html=renderDailyReport({id:'DEMO-DAY-safe',...base,ranking:[{id:'<script>',name:'</table><script>alert(1)</script>',bytes:0,voiceSeconds:0,sms:0,peakHour:0}]});
 assert.ok(html.includes('&lt;img'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img'));
 const r=read('search=SX-DEMO-006'),output=renderDailyReport(r);
 for(const value of [r.id,r.templateVersion,r.usage.ruleVersion,r.usage.window.start,r.usage.window.end,String(r.usage.totals.voiceSeconds.toLocaleString('zh-CN'))])assert.ok(output.includes(value));
 assert.equal((output.match(/<h2>/g)??[]).length,6);assert.ok(!/https?:\/\//.test(output));
});
