import {test} from 'node:test';
import assert from 'node:assert/strict';
import {energyAnalysis} from './energy';
import {previewInventory,previewAccess,previewSeed} from './preview';
import {generateHistory,materializeHistory,historyScope} from './history';
import {historyId} from './history-calendar';
import {OPERATORS} from './foundation';
import {evidenceFixture} from './evidence.fixture';
const base=previewInventory();base.rows=base.rows.slice(0,12);base.expectedSites=12;base.expectedDevices=base.rows.flatMap(r=>r.devices).length;
const history=generateHistory(base),scope=historyScope(history,previewAccess('energy-test'),Date.now()),region={city:'all',county:'all'};
const read=(grain:'hour'|'day'|'week'|'month'|'year',date:string,operators:readonly string[]=OPERATORS)=>{const scoped={...scope,operators},s=materializeHistory(history,historyId(grain,date),scoped);return energyAnalysis(s,region,operators,{history,scope:scoped});};
const n=(v:string|null)=>{assert.notEqual(v,null);return BigInt(v!);};
test('regional physical energy reconciles dedicated, common and all destinations exactly',()=>{
 const a=read('month','2026-10-01');
 assert.equal(n(a.physical),a.trend.reduce((v,r)=>v+n(r.dedicated)+n(r.common),0n));
 assert.equal(n(a.common),n(a.customerTotals.allocated)+a.entries.filter(r=>r.method==='allocated'&&r.state==='pending').reduce((v,r)=>v+n(r.observed),0n)+n(a.retained)+n(a.unallocated));
 assert.equal(n(a.physical),n(a.customerTotals.confirmed)+n(a.customerTotals.pending)+n(a.retained)+n(a.unallocated));
 assert.equal(n(a.remaining),n(a.customerTotals.pending)+n(a.unallocated));
 assert.equal(n(a.customerTotals.confirmed),a.operators.reduce((v,r)=>v+n(r.confirmed),0n));
 assert.ok(n(a.customerTotals.pending)>0n);assert.ok(n(a.unallocated)>0n);
});
test('hour/day/month/year totals use one additive model without materializing hourly history',()=>{
 const month=read('month','2026-10-01');let total=0n,common=0n;
 for(let d=1;d<=31;d++){const day=read('day','2026-10-'+String(d).padStart(2,'0'));total+=n(day.physical);common+=n(day.common);}
 assert.equal(total,n(month.physical));assert.equal(common,n(month.common));
 const day=read('day','2026-10-05');let hourly=0n;for(let h=0;h<24;h++)hourly+=n(read('hour','2026-10-05T'+String(h).padStart(2,'0')+':00:00+08:00').physical);
 assert.equal(hourly,n(day.physical));const year=read('year','2026-01-01');assert.equal(year.complete,false);assert.equal(year.period!.end,'2026-11-01T00:00:00+08:00');
});
test('fixed contract shares use effective customer windows and preserve unallocated shares',()=>{
 const a=read('month','2026-10-01');for(const r of a.entries.filter(r=>r.method==='allocated'))assert.equal(n(r.observed)*10000n,n(r.poolQuantity)*BigInt(r.shareBps!));
 assert.ok(a.entries.some(r=>r.method==='allocated'&&r.state==='pending'&&r.quantity===null));
 assert.ok(a.entries.some(r=>r.method==='allocated'&&r.state==='complete'&&r.ruleRef));
 const stock=history.daily.length;read('hour','2026-10-05T10:00:00+08:00');assert.equal(history.daily.length,stock);
});
test('daily rollups preserve customer shares, pending quantities and trend buckets',()=>{
 const month=read('month','2026-10-01'),days=Array.from({length:31},(_,i)=>read('day','2026-10-'+String(i+1).padStart(2,'0')));
 for(const key of ['physical','common','retained','unallocated','remaining'] as const)assert.equal(n(month[key]),days.reduce((v,a)=>v+n(a[key]),0n));
 for(const operator of month.operators)for(const key of ['measured','allocated','confirmed','pending'] as const)assert.equal(n(operator[key]),days.reduce((v,a)=>v+n(a.operators.find(r=>r.operator===operator.operator)?.[key]??'0'),0n));
 month.trend.forEach((bucket,i)=>{for(const key of ['physical','dedicated','common'] as const)assert.equal(n(bucket[key]),days[i].trend.reduce((v,r)=>v+n(r[key]),0n));});
 const year=read('year','2026-01-01'),months=Array.from({length:10},(_,i)=>read('month','2026-'+String(i+1).padStart(2,'0')+'-01'));
 for(const key of ['physical','common','retained','unallocated','remaining'] as const)assert.equal(n(year[key]),months.reduce((v,a)=>v+n(a[key]),0n));
 year.trend.forEach((bucket,i)=>assert.equal(n(bucket.physical),n(months[i].physical)));
 const week=read('week','2026-09-28'),weekDays=['2026-09-28','2026-09-29','2026-09-30','2026-10-01','2026-10-02','2026-10-03','2026-10-04'].map(date=>read('day',date));
 for(const key of ['physical','common','retained','unallocated','remaining'] as const)assert.equal(n(week[key]),weekDays.reduce((v,a)=>v+n(a[key]),0n));
});
test('regional filters apply before all totals and customer distribution',()=>{
 const snapshot=materializeHistory(history,historyId('month','2026-10-01'),scope),whole=energyAnalysis(snapshot,region,OPERATORS,{history,scope});
 const cities=[...new Set(snapshot.inventory.rows.map(r=>r.city))],byCity=cities.map(city=>energyAnalysis(snapshot,{city,county:'all'},OPERATORS,{history,scope}));
 assert.equal(byCity.reduce((v,a)=>v+n(a.physical),0n),n(whole.physical));
 for(const a of byCity)assert.equal(n(a.physical),n(a.customerTotals.confirmed)+n(a.customerTotals.pending)+n(a.retained)+n(a.unallocated));
});
test('restricted operators cannot read whole-site quantities, common pools or other customers',()=>{
 const a=read('month','2026-10-01',['mobile']);assert.equal(a.physical,null);assert.equal(a.common,null);assert.equal(a.retained,null);assert.equal(a.remaining,null);assert.equal(a.trend.length,0);
 assert.ok(a.entries.every(r=>r.operator==='mobile'));assert.ok(a.entries.filter(r=>r.method==='allocated').every(r=>r.poolQuantity===null&&r.shareBps===null));
});
test('legacy snapshots without a total never substitute summed customer meters for physical energy',()=>{
 const snapshot=previewSeed('energy-legacy').snapshots[0],fixture=evidenceFixture(snapshot.inventory.rows[0].id);snapshot.inventory.evidence=fixture.capture;snapshot.inventory.tenancy=fixture.tenancy;
 let a=energyAnalysis(snapshot,region,OPERATORS);assert.equal(a.physical,'1000');assert.equal(a.customerTotals.measured,'900');
 fixture.capture.items=fixture.capture.items.filter(r=>r.customerId!==null);a=energyAnalysis(snapshot,region,OPERATORS);assert.equal(a.physical,null);assert.equal(a.customerTotals.measured,'900');
 fixture.capture.records.find(r=>r.meterId==='sub-a')!.quantity=null;a=energyAnalysis(snapshot,region,OPERATORS);assert.equal(a.customerTotals.measured,'500');assert.equal(a.customerTotals.pending,null);
});
