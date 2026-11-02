import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEMO_SITES} from './resources.ts';
import {parseMapQuery,queryMap,queryStation} from './service.ts';
import {parseBounds,inBounds,inSelection,rectangle,boundsPolygon,mapContextKey} from './geometry.ts';
import {siteHour} from './rules.ts';
const query=(s='')=>parseMapQuery(new URLSearchParams(s));
const text='selection=108.80,34.10,109.1,34.50&cityId=610100&hour=18';
test('selection intersects region, operator and search; viewport never changes area totals',()=>{
  const q=query(text),result=queryMap(q),b=q.selection!;
  const expected=DEMO_SITES.filter(s=>s.cityId===q.cityId&&inSelection(s.lng,s.lat,b));
  assert.ok(expected.length>0&&expected.length<240);assert.equal(result.summary.count,expected.length);
  assert.equal(result.summary.bytes,expected.reduce((v,s)=>v+siteHour(s,18).bytes,0));
  const moved=queryMap(query(text+'&bbox=105,32,106,33'));
  assert.deepEqual(moved.summary,result.summary);assert.deepEqual(moved.area,result.area);assert.equal(moved.points.length,0);
  assert.equal(moved.contextKey,result.contextKey);
  const other=queryMap(query(text+'&operator=other&search=SX-DEMO-006'));
  assert.equal(other.summary.count,1);assert.equal(other.ranking[0].id,'SX-DEMO-006');
  assert.equal(queryStation('SX-DEMO-004',q),null);assert.ok(queryStation('SX-DEMO-001',q));
});
test('operator counters conserve selected totals and station counts remain physical',()=>{
  const r=queryMap(query(text)),parts=r.area!.operators;
  for(const key of ['bytes','voiceSeconds','sms'] as const)assert.equal(parts.reduce((n,p)=>n+p[key],0),r.summary[key]);
  assert.ok(parts.reduce((n,p)=>n+p.sites,0)>r.summary.count);
  assert.ok(r.summary.energyWh!>0);
  const op=queryMap(query(text+'&operator=telecom'));
  assert.equal(op.area!.operators.length,1);assert.equal(op.area!.operators[0].code,'telecom');
  assert.equal(op.area!.operators[0].bytes,op.summary.bytes);assert.equal(op.summary.energyWh,null);assert.ok(op.area!.series.every(s=>s.energyWh===null));
});
test('hourly analysis uses summed ratio parts and current-hour counters match snapshot',()=>{
  const q=query(text),r=queryMap(q),area=r.area!;
  assert.equal(area.series.length,24);
  const sites=DEMO_SITES.filter(s=>s.cityId===q.cityId&&inSelection(s.lng,s.lat,q.selection!));
  for(const hour of [0,12,18,23]){
    const metrics=sites.map(s=>siteHour(s,hour));
    const sum=(key:'connected'|'attempts'|'used'|'capacity')=>metrics.reduce((n,m)=>n+m[key],0);
    assert.equal(area.series[hour].connectionRate,sum('connected')/sum('attempts'));
    assert.equal(area.series[hour].load,sum('used')/sum('capacity'));
  }
  for(const key of ['bytes','voiceSeconds','connectionRate','load','energyWh'] as const)assert.equal(area.series[q.hour][key],r.summary[key]);
});
test('empty selection returns no invented rates and excludes unrelated station drill-down',()=>{
  const q=query('selection=105,32,105.01,32.01&cityId=610100');
  const r=queryMap(q);assert.equal(r.summary.count,0);assert.equal(r.summary.connectionRate,null);assert.equal(r.summary.load,null);
  assert.ok(r.area!.series.every(h=>h.bytes===0&&h.connectionRate===null&&h.load===null));
  assert.equal(queryStation('SX-DEMO-001',q),null);assert.equal(r.ranking.length,0);
});
test('geometry is normalized, edge-inclusive and rejects malformed, degenerate or duplicate input',()=>{
  assert.deepEqual(rectangle([109,35],[108,34]),[108,34,109,35]);
  assert.equal(inBounds(108,34,[108,34,109,35]),true);assert.equal(inBounds(107.99,34,[108,34,109,35]),false);
  assert.equal(rectangle([108,34],[108,35]),null);assert.equal(rectangle([108,34],[108.000001,34.000001]),null);
  assert.deepEqual(boundsPolygon([108,34,109,35]).coordinates[0][0],boundsPolygon([108,34,109,35]).coordinates[0].at(-1));
  for(const value of ['1,2,1,3','1,2,3','1,2,,4','1,2,3,Infinity','-181,2,3,4','1,-86,3,4','1,2,181,4'])assert.throws(()=>parseBounds(value));
  assert.throws(()=>query('selection=1,2,3,4&selection=1,2,3,4'));
  assert.notEqual(mapContextKey(query(text)),mapContextKey(query(text+'&operator=mobile')));
  assert.equal(mapContextKey({...query(text),search:'  site  '}),mapContextKey({...query(text),search:'site'}));
});
