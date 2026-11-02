import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_REGION, DEMO_SITES } from './resources.ts';
import { siteHour } from './rules.ts';
import { parseMapQuery, queryMap, queryStation } from './service.ts';
const query=(text='')=>parseMapQuery(new URLSearchParams(text));
test('demo resources are unique physical sites in the configured province with multiple service relations',()=>{
  assert.equal(DEMO_SITES.length,1080);assert.equal(DEMO_REGION.cities.length,10);
  assert.equal(new Set(DEMO_SITES.map(s=>s.id)).size,DEMO_SITES.length);
  for(const site of DEMO_SITES){assert.equal(site.regionId,DEMO_REGION.id);assert.ok(DEMO_REGION.cities.some(c=>c.id===site.cityId));assert.ok(site.operators.length>=2);}
});
test('operator counter parts sum exactly to shared site counters without allocating shared energy',()=>{
  const site=DEMO_SITES[5];
  for(const hour of [0,12,18,23]) {
    const all=siteHour(site,hour),parts=site.operators.map(op=>siteHour(site,hour,op));
    for(const key of ['bytes','upBytes','downBytes','attempts','connected','voiceSeconds','sms','used','capacity'] as const)assert.equal(parts.reduce((a,p)=>a+p[key],0),all[key]);
    assert.equal(all.upBytes+all.downBytes,all.bytes);assert.ok(all.energyWh!>0);assert.ok(parts.every(p=>p.energyWh===null));
    assert.deepEqual(siteHour(site,hour),all);
  }
});
test('outage scenario has matching power, traffic reduction, state and explanation at the selected hour',()=>{
  const s=DEMO_SITES[3];const before=siteHour(s,10),outage=siteHour(s,12),recovered=siteHour(s,14);
  assert.equal(outage.power,'battery');assert.equal(outage.status,'critical');assert.ok(outage.bytes<before.bytes);assert.equal(recovered.power,'mains');assert.equal(recovered.status,'normal');
  const detail=queryStation(s.id,query('hour=12'))!;assert.deepEqual(detail.current,detail.series[12]);assert.equal(detail.findings[0].severity,'critical');
});
test('summary uses ratio parts and counts shared physical sites once',()=>{
  const request=query('cityId=610100&hour=18'),result=queryMap(request);
  const sites=DEMO_SITES.filter(s=>s.cityId==='610100'),metrics=sites.map(s=>siteHour(s,18));
  assert.equal(result.summary.count,240);assert.equal(result.summary.normal+result.summary.warning+result.summary.critical,240);
  assert.equal(result.summary.bytes,metrics.reduce((a,m)=>a+m.bytes,0));
  assert.equal(result.summary.connectionRate,metrics.reduce((a,m)=>a+m.connected,0)/metrics.reduce((a,m)=>a+m.attempts,0));
  assert.equal(result.summary.load,metrics.reduce((a,m)=>a+m.used,0)/metrics.reduce((a,m)=>a+m.capacity,0));
});
test('viewport limits points while province summary remains in its labelled regional scope',()=>{
  const result=queryMap(query('bbox=108.8,34.1,109.1,34.5'));
  assert.equal(result.summary.count,1080);assert.ok(result.points.length>0&&result.points.length<1080);
  assert.equal(result.visibleCount,result.points.length);assert.ok(result.points.every(p=>p.lng>=108.8&&p.lng<=109.1&&p.lat>=34.1&&p.lat<=34.5));
});
test('operator views exclude non-applicable resources and shared energy remains unavailable',()=>{
  const q=query('operator=other');const result=queryMap(q);
  assert.equal(result.summary.energyWh,null);assert.equal(result.summary.count,DEMO_SITES.filter(s=>s.operators.includes('other')).length);
  assert.ok(result.points.every(p=>p.energyKWh===null));assert.equal(queryStation('SX-DEMO-001',q),null);
});
test('foreign regions, forged fields, duplicate context and invalid geometry/hour are rejected',()=>{
  for(const params of ['regionId=110000','cityId=110100','workspaceId=forged','operator=unknown','hour=24','hour=1.5','hour=','hour=1&hour=2','bbox=1,2,0,4','bbox=1,2,3,Infinity','bbox=1,2,3','bbox=1,2,,4'])assert.throws(()=>query(params),params);
  assert.equal(queryStation('SX-DEMO-001',query('cityId=610300')),null);
});
test('empty search results stay empty rather than inventing zero performance',()=>{
  const result=queryMap(query('search=no-such-demo-site'));
  assert.equal(result.summary.count,0);assert.equal(result.summary.connectionRate,null);assert.equal(result.summary.load,null);assert.equal(result.points.length,0);
});

test('county partitions preserve city totals and every point has a valid county parent',()=>{
  for(const site of DEMO_SITES)assert.ok(DEMO_REGION.counties.some(c=>c.id===site.countyId&&c.cityId===site.cityId));
  for(const city of DEMO_REGION.cities){
    const totals=DEMO_REGION.counties.filter(c=>c.cityId===city.id).map(c=>queryMap(query('cityId='+city.id+'&countyId='+c.id)));
    const cityResult=queryMap(query('cityId='+city.id));
    for(const key of ['count','bytes','voiceSeconds','sms','energyWh'] as const)assert.equal(totals.reduce((sum,r)=>sum+(r.summary[key]??0),0),cityResult.summary[key]);
  }
  const site=DEMO_SITES[0],request=query('cityId='+site.cityId+'&countyId='+site.countyId);
  assert.equal(queryStation(site.id,request)?.site.id,site.id);
  assert.ok(queryMap(request).points.every(p=>p.countyId===site.countyId));
  const other=DEMO_REGION.counties.find(c=>c.cityId===site.cityId&&c.id!==site.countyId)!;
  assert.equal(queryStation(site.id,query('cityId='+site.cityId+'&countyId='+other.id)),null);
  for(const value of ['countyId='+site.countyId,'cityId=610300&countyId='+site.countyId,'cityId=610100&countyId=999999','countyId=all&countyId=all'])assert.throws(()=>query(value));
});
