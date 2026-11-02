import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseComparisonIds,comparisonContextKey,comparisonValue} from './comparison-rules.ts';
import {parseComparisonQuery,queryComparison,parseMapQuery,queryStation} from './service.ts';
const q=(value='')=>parseMapQuery(new URLSearchParams(value));
test('comparison validates bounded unique station IDs and rejects forged query scope',()=>{
  assert.deepEqual(parseComparisonIds('SX-DEMO-001,SX-DEMO-004'),['SX-DEMO-001','SX-DEMO-004']);
  for(const ids of ['',',','a,a','a,b,c,d,e','a/..','a, b'])assert.throws(()=>parseComparisonIds(ids));
  for(const text of ['hour=18','sites=a&sites=b','sites=a&workspaceId=forged','sites=a&countyId=610113','sites=a&operator=invalid','sites=a&hour=24'])assert.throws(()=>parseComparisonQuery(new URLSearchParams(text)));
});
test('comparison preserves order and identical station counters in a common hour and operator',()=>{
  const query=q('hour=12&operator=mobile'),ids=['SX-DEMO-004','SX-DEMO-001'];
  const result=queryComparison(ids,query);
  assert.deepEqual(result.entries.map(e=>e.id),ids);assert.equal(result.hour,12);
  for(const entry of result.entries){assert.deepEqual(entry.detail,queryStation(entry.id,query));assert.equal(entry.detail!.series.length,24);assert.equal(entry.detail!.current.energyWh,null);}
  assert.equal(result.entries[0].detail!.current.power,'battery');assert.ok(result.entries[0].detail!.current.connected<result.entries[0].detail!.current.attempts);
});
test('comparison applies city, county and selection, returning unavailable without leaking site metadata',()=>{
  const selected=queryComparison(['SX-DEMO-001','SX-DEMO-004'],q('selection=108.8,34.1,109.1,34.5&cityId=610100'));
  assert.ok(selected.entries[0].detail);assert.deepEqual(selected.entries[1],{id:'SX-DEMO-004',detail:null});
  const other=queryComparison(['SX-DEMO-001','missing'],q('cityId=610300'));assert.ok(other.entries.every(e=>e.detail===null));
  const site=queryStation('SX-DEMO-004',q())!.site;
  assert.equal(queryComparison(['SX-DEMO-001'],q('cityId='+site.cityId+'&countyId='+site.countyId)).entries[0].detail,null);
});
test('operator without service remains unavailable; search and camera cannot hide pinned stations',()=>{
  const ids=['SX-DEMO-004','SX-DEMO-006'];
  const r=queryComparison(ids,q('operator=other&search=unmatched&bbox=105,32,106,33'));
  assert.equal(r.entries[0].detail,null);assert.ok(r.entries[1].detail);
  assert.equal(comparisonContextKey(q('search=a'),ids),comparisonContextKey(q('search=b&bbox=105,32,106,33'),ids));
  assert.notEqual(comparisonContextKey(q(),ids),comparisonContextKey(q('hour=12'),ids));
  assert.notEqual(comparisonContextKey(q(),ids),comparisonContextKey(q(),[...ids].reverse()));
});
test('comparison display units retain true zero and unknown ratios or shared energy',()=>{
  const m=queryStation('SX-DEMO-001',q())!.current;
  assert.equal(comparisonValue('traffic',m),m.bytes/1073741824);assert.equal(comparisonValue('voice',m),m.voiceSeconds/3600);
  assert.equal(comparisonValue('connection',m),m.connected/m.attempts*100);
  assert.equal(comparisonValue('energy',{...m,energyWh:null}),null);
  assert.equal(comparisonValue('energy',{...m,energyWh:0}),0);
  assert.equal(comparisonValue('connection',{...m,attempts:0,connected:0}),null);
  assert.equal(comparisonValue('load',{...m,capacity:0,used:0}),null);
  assert.equal(comparisonValue('sms',{...m,sms:0}),0);
});
