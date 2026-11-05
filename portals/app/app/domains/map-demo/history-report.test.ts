import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calendarSource} from './period-rules.ts';
import {DEMO_SITES} from './resources.ts';
import {parseHistoryQuery,queryHistory} from './history-service.ts';
import {queryHistoryContext} from './history-context-service.ts';
import {readContextPeriod,summarizeContext,analyzeHistoryContext} from './history-context-rules.ts';
import {buildHistoryReport,assertHistorySnapshot} from '../../analysis/history-report-service.ts';
import {renderHistoryReport} from '../../analysis/history-report-html.ts';
import {historyHref,historyContextHref,historyReportHref} from '../../analysis/history-links.ts';
import {changedRegionHref} from '../../portal/region-scope.ts';
const site=DEMO_SITES[0],single={site:site.id,city:site.cityId,county:site.countyId,range:'month',month:'2026-10',evidence:'2026-10-25',slot:'18'};
test('physical daily context exactly conserves existing hourly samples at coverage, calendar and anchor dates',()=>{
 for(const date of ['2024-11-01','2025-02-28','2025-12-31','2026-09-01','2026-10-25','2026-10-31']){
  const s=calendarSource(site),p=s.physicalDaily(date),rows=Array.from({length:24},(_,h)=>s.sample(date,h));
  assert.equal(p.energyWh,rows.reduce((n,r)=>n+r.energyWh!,0));
  assert.equal(p.temperatureSumTenths,rows.reduce((n,r)=>n+Math.round(r.temperature*10),0));
  assert.equal(p.temperatureMinTenths,Math.min(...rows.map(r=>Math.round(r.temperature*10))));
  assert.equal(p.temperatureMaxTenths,Math.max(...rows.map(r=>Math.round(r.temperature*10))));
  assert.equal(p.batterySamples,rows.filter(r=>r.power==='battery').length);
 }
});
test('context rates use exact denominators and operator scope does not duplicate or allocate physical energy',()=>{
 const c=readContextPeriod(site,'2026-10-25','2026-10-26'),s=calendarSource(site),all=summarizeContext(c,'all','100');
 for(const key of ['attempts','connected','used','capacity'] as const)assert.equal(all[key],Array.from({length:24},(_,h)=>s.sample('2026-10-25',h)[key]).reduce((a,b)=>a+b,0));
 assert.equal(all.load,all.used/all.capacity);assert.equal(all.connectionRate,all.connected/all.attempts);
 assert.equal(all.physical.energyWh,s.physicalDaily('2026-10-25').energyWh);assert.equal(all.physical.physicalSamples,24);assert.equal(all.samples,24*site.operators.length);
 for(const code of site.operators){const op=summarizeContext(c,code,'100');assert.equal(op.physical.energyWh,null);assert.equal(op.energyPerGiB,null);assert.equal(op.samples,24);}
 assert.equal(summarizeContext(c,'all','0').energyPerGiB,null);
});
test('historical context joins exactly the selected station rows and sums across month/year boundaries',()=>{
 const q=parseHistoryQuery({site:site.id,city:site.cityId,county:site.countyId,range:'custom',from:'2025-12-31',to:'2026-01-01'}),a=queryHistory(q),c=queryHistoryContext(a);
 const expected=readContextPeriod(site,'2025-12-31','2026-01-02');
 assert.equal(c.summary.physical.energyWh,expected.physical.energyWh);assert.equal(c.members.length,1);
 assert.deepEqual(c.members[0].values,a.totals);assert.equal(c.summary.samples,48*site.operators.length);
});
test('context aggregation is weighted, handles empty scopes and rejects forged station geography',()=>{
 const a=queryHistory(parseHistoryQuery({site:site.id,city:site.cityId,county:site.countyId,range:'custom',from:'2026-10-25',to:'2026-10-25'}));
 const sites=DEMO_SITES.slice(0,2),analysis={...a,siteRows:sites.map(s=>({id:s.id,values:a.totals,previous:null}))};
 const p=calendarSource(site).physicalDaily('2026-10-25');
 const c=analyzeHistoryContext(sites,analysis,s=>({physical:p,services:[{code:'mobile',attempts:s.id===site.id?10:90,connected:s.id===site.id?5:90,used:s.id===site.id?10:90,capacity:s.id===site.id?100:900,samples:24}]}));
 assert.equal(c.summary.connectionRate,.95);assert.equal(c.summary.load,.1);
 const empty=queryHistoryContext(queryHistory(parseHistoryQuery({...single,scene:'mountain'})));
 assert.equal(empty.members.length,0);assert.equal(empty.summary.connectionRate,null);assert.equal(empty.summary.physical.energyWh,null);assert.equal(empty.summary.temperatureMean,null);
 assert.throws(()=>queryHistoryContext(queryHistory(parseHistoryQuery({...single,city:'610300',county:'all'}))));
});
test('history report captures all resource members instead of only the selected band or visible page',()=>{
 const q={city:'610100',range:'custom',from:'2026-10-25',to:'2026-10-25',view:'cohorts',band:'upper',page:'2'},r=buildHistoryReport(q),d=r.payload.data;
 assert.ok(d.cross.members.length>20);assert.equal(d.cross.members.length,d.physicalSites);assert.ok(d.cohorts.members.length<=20);
 for(const key of ['bytes','voiceSeconds','sms'] as const)assert.equal(d.cross.members.reduce((n,s)=>n+BigInt(s.values[key]),0n),BigInt(d.totals[key]));
 assert.equal(d.cross.summary.physical.energyWh,d.cross.members.reduce((n,s)=>n+s.physical.energyWh!,0));
 assert.equal(d.cross.summary.connected,d.cross.members.reduce((n,s)=>n+s.connected,0));
 assert.equal(d.cross.summary.attempts,d.cross.members.reduce((n,s)=>n+s.attempts,0));
});
test('report digest pins full provenance and evidence while repeated reads are deterministic',()=>{
 const a=buildHistoryReport(single),b=buildHistoryReport(single);assert.equal(a.digest,b.digest);assert.equal(a.payload.data.station?.evidence?.referenceId,b.payload.data.station?.evidence?.referenceId);
 assert.equal(a.payload.sourceVersion,'bsmoss-demo-calendar-v3');assert.equal(a.payload.data.version,'bsmoss-history-v4');
 assert.doesNotThrow(()=>assertHistorySnapshot(a.digest,b.digest));assert.throws(()=>assertHistorySnapshot('0'.repeat(64),a.digest),/history_snapshot_changed/);
 assert.throws(()=>assertHistorySnapshot('bad',a.digest),/invalid_history_snapshot/);
 assert.notEqual(a.digest,buildHistoryReport({...single,operator:'mobile'}).digest);assert.notEqual(a.digest,buildHistoryReport({...single,metric:'sms'}).digest);
 assert.equal(new URL(a.downloadHref,'http://localhost').searchParams.get('snapshot'),a.digest);
});
test('offline HTML embeds the exact report JSON with integer counters and no executable data or external assets',()=>{
 const r=buildHistoryReport(single),html=renderHistoryReport(r);
 const raw=html.match(/<script id="bsmoss-history-snapshot" type="application\/json">([\s\S]*?)<\/script>/)![1];
 assert.deepEqual(JSON.parse(raw),JSON.parse(JSON.stringify(r)));
 assert.ok(html.includes(r.digest));assert.ok(html.includes(r.payload.data.totals.bytes));
 assert.ok(!/<(?:link|img|iframe)[ >]/.test(html));assert.ok(!/<script(?![^>]*application\/json)/.test(html));
 assert.ok(!html.includes('@import'));assert.ok(!html.includes('@theme'));assert.ok(html.includes('--body-font-size'));assert.ok(html.includes('var(--space-lg)'));
 const poisoned=structuredClone(r);poisoned.payload.data.cross.members[0].name='<script>alert(1)</script>';
 const safe=renderHistoryReport(poisoned);assert.ok(!safe.includes('<script>alert(1)'));assert.ok(safe.includes('&lt;script&gt;'));assert.ok(safe.includes('\\u003cscript\\u003e'));
});
test('cross-domain and report routes preserve canonical context and report region changes discard stale snapshot',()=>{
 const q=parseHistoryQuery({...single,peerLevel:'province',metric:'sms',view:'operators'});
 for(const href of [historyContextHref(q,'capacity'),historyContextHref(q,'efficiency'),historyReportHref(q)]){
  const p=new URL(href,'http://localhost').searchParams;p.delete('history');assert.deepEqual(parseHistoryQuery(Object.fromEntries(p)),q);
 }
 assert.equal(historyHref(q).split('?')[1],historyReportHref(q).split('?')[1]);
 const changed=changedRegionHref('/analysis/report','snapshot='+'a'.repeat(64)+'&site='+site.id,{cityId:'610300',countyId:'all'});
 assert.ok(changed.startsWith('/analysis?'));assert.ok(!changed.includes('snapshot'));assert.ok(!changed.includes('site'));
});
