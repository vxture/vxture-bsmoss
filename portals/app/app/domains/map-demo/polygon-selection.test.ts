import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseSelection,serializeSelection,polygonFromPoints,inSelection,inBounds,selectionBounds,selectionPolygon,mapContextKey,POLYGON_VERTEX_LIMIT} from './geometry.ts';
import {parseMapQuery,queryMap,queryStation,queryComparison,queryOperatorUsage,queryDailyReport} from './service.ts';
import {renderDailyReport} from './report-html.ts';
import {useWorkbench} from './workbench-store.ts';
import {DEMO_SITES} from './resources.ts';
import {siteHour} from './rules.ts';
const shape='polygon:108.8,34.1;109.1,34.1;108.95,34.5';
const scope='cityId=610100&hour=18&selection='+shape;
const query=(s:string)=>parseMapQuery(new URLSearchParams(s));

test('polygon membership supports concavity, includes edges and excludes empty bounding-box corners',()=>{
  const triangle=parseSelection('polygon:0,0;4,0;0,4');
  for(const point of [[0,0],[2,2],[0,2],[2,0],[1,1]])assert.ok(inSelection(point[0],point[1],triangle));
  assert.ok(inBounds(3,3,selectionBounds(triangle)));assert.equal(inSelection(3,3,triangle),false);
  assert.equal(inSelection(-0.01,0,triangle),false);
  const concave=parseSelection('polygon:0,0;4,0;4,1;1,1;1,4;0,4');
  assert.ok(inSelection(0.5,3,concave));assert.ok(inSelection(3,0.5,concave));assert.ok(inSelection(1,2,concave));
  assert.equal(inSelection(2,2,concave),false);
});
test('polygon rings normalize winding, start, explicit closure and coordinate precision to stable identity',()=>{
  const a=parseSelection(shape),b=parseSelection('polygon:108.95000001,34.50000001;109.1000,34.100;108.800,34.100;108.95000001,34.50000001');
  assert.deepEqual(a,b);assert.equal(serializeSelection(a),shape);assert.deepEqual(parseSelection(serializeSelection(a)),a);
  assert.equal(mapContextKey(query(scope)),mapContextKey(query('cityId=610100&hour=18&selection='+serializeSelection(b))));
  const ring=selectionPolygon(a).coordinates[0];assert.equal(ring.length,4);assert.deepEqual(ring[0],ring.at(-1));
  assert.deepEqual(polygonFromPoints([[108.8,34.1],[109.1,34.1],[108.95,34.5]]),a);
});
test('polygon validation rejects malformed, collapsed, self-touching and self-intersecting shapes',()=>{
  for(const value of [
    'polygon:','polygon:1,2,3','polygon:0,0;1,1','polygon:0,0;1,1;2,2',
    'polygon:0,0;2,2;0,2;2,0','polygon:0,0;2,0;2,2;1,0;0,2',
    'polygon:0,0;2,0;2,2;0,0;0,2','polygon:0,0;1,0;2,0;2,2;0,2',
    'polygon:0,0;0.000001,0;0,0.000001','polygon:0,0;0.00000001,0;0,1',
    'polygon:0,0;181,0;0,1','polygon:0,0;1,86;0,1','polygon:-179,0;179,0;179,1',
    'polygon:0,0;Infinity,0;0,1','polygon:0,0;NaN,0;0,1','polygon:0,0;1,;0,1',
    'polygon:0,0;1,0;0,1;','polygon:0,0;1,0,5;0,1','polygon:'+('0'.repeat(2100)),
  ])assert.throws(()=>parseSelection(value),value);
  assert.equal(polygonFromPoints([[0,0],[1,1],[2,2]]),null);
  const many=Array.from({length:POLYGON_VERTEX_LIMIT+1},(_,i)=>[Math.cos(i*2*Math.PI/(POLYGON_VERTEX_LIMIT+1)),Math.sin(i*2*Math.PI/(POLYGON_VERTEX_LIMIT+1))] as [number,number]);
  assert.equal(polygonFromPoints(many),null);assert.ok(polygonFromPoints(many.slice(0,-1)));
});
test('polygon intersects administrative/operator/search scope while camera bounds never alter analysis',()=>{
  const q=query(scope),r=queryMap(q),moved=queryMap(query(scope+'&bbox=105,32,106,33'));
  assert.ok(r.summary.count>0&&r.summary.count<240);assert.equal(moved.points.length,0);assert.deepEqual(moved.summary,r.summary);assert.deepEqual(moved.area,r.area);
  const rect=queryMap(query('cityId=610100&selection='+selectionBounds(q.selection!).join(',')));
  assert.ok(rect.summary.count>r.summary.count);assert.ok(queryStation('SX-DEMO-001',q));assert.equal(queryStation('SX-DEMO-004',q),null);
  const filtered=queryMap(query(scope+'&countyId=610113&operator=other&search=SX-DEMO-006'));
  assert.equal(filtered.summary.count,1);assert.equal(filtered.points[0].id,'SX-DEMO-006');assert.equal(filtered.summary.energyWh,null);
  const empty=queryMap(query('selection=polygon:0,0;1,0;0,1'));assert.equal(empty.summary.count,0);assert.equal(empty.summary.connectionRate,null);
});
test('polygon services conserve physical totals, weighted ratios and operator counters across analysis panels',()=>{
  const q=query(scope),r=queryMap(q),metrics=DEMO_SITES.filter(s=>r.points.some(p=>p.id===s.id)).map(s=>siteHour(s,18));
  const sum=(key:'bytes'|'used'|'capacity'|'connected'|'attempts')=>metrics.reduce((v,m)=>v+m[key],0);
  assert.equal(r.summary.bytes,sum('bytes'));assert.equal(r.summary.load,sum('used')/sum('capacity'));assert.equal(r.summary.connectionRate,sum('connected')/sum('attempts'));
  assert.equal(r.summary.energyWh,metrics.reduce((v,m)=>v+m.energyWh!,0));
  for(const key of ['bytes','voiceSeconds','sms'] as const)assert.equal(r.area!.operators.reduce((v,p)=>v+p[key],0),r.summary[key]);
  const usage=queryOperatorUsage(new URLSearchParams(scope));assert.equal(usage.physicalSites,r.summary.count);assert.equal(usage.totals.bytes,r.summary.bytes);
  assert.equal(queryMap(query(scope+'&topic=capacity')).topic!.counts.total,r.summary.count);
  const comparison=queryComparison(['SX-DEMO-001','SX-DEMO-004'],q);assert.ok(comparison.entries[0].detail);assert.equal(comparison.entries[1].detail,null);
});
test('polygon report references ignore camera/hour and equivalent rings but retain actual geometry',()=>{
  const report=queryDailyReport(new URLSearchParams(scope));
  assert.equal(report.usage.physicalSites,queryMap(query(scope)).summary.count);
  assert.equal(report.id,queryDailyReport(new URLSearchParams(scope.replace('hour=18','hour=3')+'&bbox=105,32,106,33')).id);
  assert.equal(report.id,queryDailyReport(new URLSearchParams(scope.replace(shape,'polygon:108.95,34.5;109.1,34.1;108.8,34.1'))).id);
  assert.notEqual(report.id,queryDailyReport(new URLSearchParams(scope.replace('34.5','34.50001'))).id);
  assert.deepEqual(report.usage.totals,queryOperatorUsage(new URLSearchParams(scope+'&period=day')).totals);
  assert.ok(renderDailyReport(report).includes(shape));
});
test('polygon store lifecycle preserves committed geometry on cancel and rejects invalid commits atomically',()=>{
  const state=()=>useWorkbench.getState(),polygon=parseSelection(shape);
  state().set({cityId:'all',countyId:'all',selection:null});state().beginSelection('polygon');assert.ok(state().drawing);assert.equal(state().drawMode,'polygon');
  state().finishSelection(polygon);assert.deepEqual(state().selection,polygon);assert.ok(state().selectionOpen&&!state().drawing);
  state().addComparison('SX-DEMO-001');state().beginSelection('circle');state().cancelSelection();assert.deepEqual(state().selection,polygon);
  state().set({hour:12,operator:'mobile',topicOpen:true});assert.deepEqual(state().selection,polygon);
  assert.throws(()=>state().finishSelection({kind:'polygon',vertices:[[0,0],[1,1],[2,2]]}));assert.deepEqual(state().selection,polygon);
  state().finishSelection(parseSelection(shape.replace('34.5','34.6')));assert.deepEqual(state().compareIds,[]);
  state().set({cityId:'610100'});assert.equal(state().selection,null);state().clearSelection();
});
