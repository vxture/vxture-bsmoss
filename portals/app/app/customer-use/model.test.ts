import {test} from 'node:test';
import assert from 'node:assert/strict';
import {customerUseModel} from './model';
import {sumUsage,compareUsage} from '../domains/business-usage/rules';
import {customerUseDestination} from './links';
const all=customerUseModel({});
test('physical sites, devices, sharing and business counters reconcile',()=>{
 assert.equal(all.regions.reduce((n,r)=>n+r.count,0),all.summary.sites);
 assert.equal(all.operators.reduce((n,r)=>n+r.sites,0),all.summary.relations);
 assert.equal(new Set(all.rows.flatMap(r=>r.devices.map(d=>d.id))).size,all.summary.resources);
 assert.deepEqual(sumUsage(all.rows.map(r=>r.usage)),all.usage.total);
 assert.deepEqual(sumUsage(all.regions),all.usage.total);
 assert.deepEqual(sumUsage(all.usage.series),all.usage.total);
 assert.equal(all.sharing.distribution.reduce((n,r)=>n+r.sites,0),all.summary.sites);
 assert.equal(all.sharing.sharedSites,all.sharing.distribution.slice(1).reduce((n,r)=>n+r.sites,0));
});
test('operator filter preserves full tenancy and scopes business and shared devices',()=>{
 const mobile=customerUseModel({operator:'unicom'});
 assert.ok(mobile.rows.every(r=>r.allOperators.includes('unicom')&&r.operators.length===1&&r.operators[0]==='unicom'));
 assert.equal(mobile.sharing.sharedSites,mobile.rows.filter(r=>r.allOperators.length>=2).length);
 assert.deepEqual(sumUsage(mobile.rows.map(r=>r.usage)),mobile.usage.total);
 assert.deepEqual(mobile.usage.total,all.usage.operators.find(r=>r.code==='unicom')&&sumUsage([all.usage.operators.find(r=>r.code==='unicom')!]));
 for(const row of mobile.rows)assert.equal(new Set(row.devices.map(d=>d.id)).size,row.resources);
 assert.equal(mobile.summary.resources,all.operators.find(r=>r.code==='unicom')!.resources);
});
test('table count, structure and search never change headline or comparison denominators',()=>{
 for(const filters of [{operatorCount:'4'},{tenancy:'double'},{search:'NO_MATCH_123456'},{sharing:'shared'}]){
 const filtered=customerUseModel(filters);
 assert.deepEqual(filtered.summary,all.summary);assert.deepEqual(filtered.sharing,all.sharing);assert.deepEqual(filtered.regions,all.regions);assert.deepEqual(filtered.usage.total,all.usage.total);
 if(filters.operatorCount)assert.ok(filtered.rows.every(r=>r.allOperators.length===4));
 if(filters.tenancy)assert.ok(filtered.rows.every(r=>r.allOperators.length===2));
 if(filters.search)assert.equal(filtered.rows.length,0);
 }
 const two=customerUseModel({tenancy:'double'});assert.equal(two.occupancyCounts[0].count,two.rows.length);assert.equal(two.occupancyCounts[1].count,0);
});
test('city and county drill conserve sites and exact business counters',()=>{
 const city=customerUseModel({city:all.regions[0].id});assert.equal(city.regions.reduce((n,r)=>n+r.count,0),city.summary.sites);assert.deepEqual(sumUsage(city.regions),city.usage.total);
 const region=city.regions[0],county=customerUseModel({city:city.query.city,county:region.id});assert.equal(county.regions.length,0);assert.equal(county.summary.sites,region.count);assert.deepEqual(county.usage.total,sumUsage([region]));
});
test('business period and date affect the entire usage scope but retain explicit resource snapshot',()=>{
 for(const period of ['hour','week','month']){const result=customerUseModel({period,asOf:'2026-02-15T12:00:00',city:'610100'});assert.equal(result.query.asOf,'2026-02-15T12:00:00');assert.equal(result.resourceAt,all.resourceAt);assert.equal(result.available,true);assert.ok(result.previousAsOf);assert.ok(result.nextAsOf);assert.notDeepEqual(result.usage.total,all.usage.total);assert.deepEqual(sumUsage(result.rows.map(r=>r.usage)),result.usage.total);assert.deepEqual(sumUsage(result.usage.series),result.usage.total);}
 const before=customerUseModel({asOf:'2020-01-01'});assert.equal(before.query.asOf,'2024-11-01T00:00:00');assert.equal(before.previousAsOf,null);
 const after=customerUseModel({asOf:'2030-01-01',period:'month'});assert.equal(after.query.asOf,'2026-10-31T23:00:00');assert.equal(after.nextAsOf,null);
});
test('selected metric sorts exactly and only visible page rows carry business evidence',()=>{
 const data=customerUseModel({usageSort:'sms',page:'2',pageSize:'10',city:'610100'});
 for(let i=1;i<data.rows.length;i++)assert.ok(compareUsage(data.rows[i-1].usage,data.rows[i].usage,'sms')<=0);
 data.rows.forEach((row,index)=>{assert.equal(row.usage.series.length>0,index>=10&&index<20);if(index>=10&&index<20){assert.deepEqual(sumUsage(row.usage.series),sumUsage([row.usage]));assert.deepEqual(sumUsage(row.usage.operators),sumUsage([row.usage]));}assert.equal(row.resources,row.devices.length);});
});
test('page sizes and exact tenancy facets remain supported',()=>{
 const input={city:'610100',county:'610116'};const baseline=customerUseModel(input);
 for(const pageSize of ['10','20','50','100'])assert.deepEqual(customerUseModel({...input,pageSize}).summary,baseline.summary);
 for(const count of ['1','2','3','4','5']){const selected=customerUseModel({...input,operatorCount:count});assert.equal(selected.rows.length,baseline.occupancyCounts.find(r=>r.value===count)!.count);}
});
test('invalid and duplicate parameters are rejected, aliases preserve validation and journey',()=>{
 for(const input of [{city:'invalid'},{operatorCount:'6'},{pageSize:['20','50']},{usageSort:['bytes','sms']},{compare:'invalid'},{tenancy:'6'},{sharing:['all','shared']},{asOf:'2026-02-30'},{unknown:'x'}])assert.throws(()=>customerUseModel(input));
 const input={city:['610100','610200'],period:'month',usageSort:'sms',investigation:'{"v":1,"href":"/sites"}'};const dest=new URL(customerUseDestination(input),'http://localhost');assert.deepEqual(dest.searchParams.getAll('city'),input.city);assert.equal(dest.searchParams.get('investigation'),input.investigation);assert.equal(dest.searchParams.get('usageSort'),'sms');
});
