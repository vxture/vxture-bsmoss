import {test} from 'node:test';
import assert from 'node:assert/strict';
import {businessUsageModel} from './model';
import {businessWindow,sumUsage,compareUsage,usageShare,usageMetrics} from '../domains/business-usage/rules';
import {DEMO_SITES} from '../domains/map-demo/resources';
import {calendarSampler,analyzeCalendarUsage} from '../domains/map-demo/period-rules';
import {analyzeOperatorUsage} from '../domains/map-demo/operator-rules';
import {parseMapQuery} from '../domains/map-demo/service';

test('all periods conserve exact totals across physical sites, operators, regions and trend buckets',()=>{
 for(const period of ['hour','day','week','month'] as const){
  const d=businessUsageModel({period,asOf:'2026-10-25T08:00:00'}),b=d.usage;
  assert.equal(b.sites,1080);assert.equal(b.series.length,period==='hour'?1:period==='day'?24:period==='week'?7:31);
  assert.deepEqual(sumUsage(d.rows.map(r=>r.usage)),b.total);assert.deepEqual(sumUsage(b.operators),b.total);assert.deepEqual(sumUsage(b.regions),b.total);assert.deepEqual(sumUsage(b.series),b.total);
  assert.equal(BigInt(b.total.bytes),BigInt(b.total.upBytes)+BigInt(b.total.downBytes));assert.ok(b.total.connected<=b.total.attempts);
  const q=parseMapQuery(new URLSearchParams({hour:'8'}));
  const previous=period==='hour'||period==='day'?analyzeOperatorUsage(DEMO_SITES,q,period):analyzeCalendarUsage(DEMO_SITES,q,period);
  for(const key of ['bytes','upBytes','downBytes','voiceSeconds','attempts','connected','sms'] as const)assert.equal(String(b.total[key]),String(previous.totals[key]));
  d.rows.forEach((r,index)=>{assert.equal(r.usage.series.length,index<20?b.series.length:0);if(index<20){assert.deepEqual(sumUsage(r.usage.operators),sumUsage([r.usage]));assert.deepEqual(sumUsage(r.usage.series),sumUsage([r.usage]));}});
 }
});
test('arbitrary history dates aggregate original hourly integers and provider selection affects all views',()=>{
 for(const period of ['hour','day','week','month'] as const)for(const operator of ['all','unicom']){
  const d=businessUsageModel({city:'610100',county:'610116',operator,period,asOf:'2025-02-12T07:00:00'}),b=d.usage;
  const raw=d.rows.flatMap(row=>{const sample=calendarSampler(DEMO_SITES.find(s=>s.id===row.id)!);return b.window.times.map(at=>{const m=sample(at.slice(0,10),Number(at.slice(11,13)),operator as 'all'|'unicom');return {...m,bytes:String(m.bytes),upBytes:String(m.upBytes),downBytes:String(m.downBytes)};});});
  assert.deepEqual(sumUsage(raw),b.total);assert.deepEqual(sumUsage(b.operators),b.total);assert.deepEqual(sumUsage(b.series),b.total);assert.equal(b.sites,d.rows.length);assert.ok(d.rows.every(r=>operator==='all'||r.operators.includes('unicom')));if(operator!=='all')assert.deepEqual(b.operators.map(r=>r.code),['unicom']);
 }
});
test('search and metric ordering affect table only; exact contributions, paging and drills retain scope',()=>{
 const all=businessUsageModel({});
 for(const usageSort of usageMetrics){const d=businessUsageModel({usageSort});assert.deepEqual(d.usage.total,all.usage.total);assert.deepEqual(d.usage.series,all.usage.series);assert.ok(d.rows.every((row,i)=>i===0||compareUsage(d.rows[i-1].usage,row.usage,usageSort)<=0));assert.ok(Math.abs(d.rows.reduce((sum,row)=>sum+(usageShare(row.usage,d.usage.total,usageSort)??0),0)-1)<1e-10);}
 const searched=businessUsageModel({search:'SX-DEMO-001'});assert.equal(searched.rows.length,1);assert.deepEqual(searched.usage.total,all.usage.total);
 const empty=businessUsageModel({search:'no-match'});assert.equal(empty.rows.length,0);assert.deepEqual(empty.usage.total,all.usage.total);
 for(const page of ['2','100000']){const d=businessUsageModel({page,pageSize:'10'}),start=page==='2'?10:1070;d.rows.forEach((r,i)=>assert.equal(r.usage.series.length,i>=start&&i<start+10?24:0));}
 assert.equal(businessUsageModel({city:'610100'}).usage.sites,240);assert.equal(businessUsageModel({city:'610100',county:'610116'}).usage.sites,62);
});
test('calendar navigation crosses days, weeks and months, clamps coverage and validates inputs',()=>{
 const hour=businessWindow('2026-10-25T23:00:00','hour');assert.equal(hour.nextAsOf,'2026-10-26T00:00:00');
 const week=businessWindow('2025-02-12T07:00:00','week');assert.equal(week.start,'2025-02-10T00:00:00+08:00');assert.equal(week.previousAsOf,'2025-02-03T00:00:00');assert.equal(week.nextAsOf,'2025-02-17T00:00:00');
 const month=businessWindow('2025-02-12T07:00:00','month');assert.equal(month.times.length,28*24);assert.equal(month.previousAsOf,'2025-01-01T00:00:00');assert.equal(month.nextAsOf,'2025-03-01T00:00:00');
 for(const period of ['hour','day','week','month'] as const){const first=businessWindow('2024-01-01T00:00:00',period),last=businessWindow('2027-01-01T00:00:00',period);assert.equal(first.asOf,'2024-11-01T00:00:00');assert.equal(last.asOf,'2026-10-31T23:00:00');assert.equal(first.previousAsOf,null);assert.equal(last.nextAsOf,null);assert.ok(first.adjusted&&last.adjusted);assert.ok(first.times.length&&last.times.length);}
 for(const input of [{usageSort:'bad'},{usageSort:['bytes']},{period:'year'},{asOf:'2026-02-30'},{hour:'24'},{operator:'unknown'},{pageSize:'5'}])assert.throws(()=>businessUsageModel(input));
 const huge={bytes:'90071992547409931234',upBytes:'1',downBytes:'90071992547409931233',voiceSeconds:0,attempts:0,connected:0,sms:0};assert.equal(sumUsage([huge,huge]).bytes,'180143985094819862468');assert.equal(compareUsage(huge,{...huge,bytes:'90071992547409931235'},'bytes'),1);
 assert.equal(usageShare({...huge,bytes:'0'},{...huge,bytes:'0'},'bytes'),null);
});
