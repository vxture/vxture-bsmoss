import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseSelection,serializeSelection,distanceMeters,inSelection,inBounds,selectionBounds,selectionPolygon,circleFromPoints,mapContextKey} from './geometry.ts';
import {parseMapQuery,queryMap,queryStation,queryComparison,queryOperatorUsage,queryDailyReport} from './service.ts';
import {renderDailyReport} from './report-html.ts';
import {useWorkbench} from './workbench-store.ts';
import {DEMO_SITES} from './resources.ts';
import {siteHour} from './rules.ts';
const query=(s:string)=>parseMapQuery(new URLSearchParams(s));
const scope='selection=circle:108.95,34.26,10000&cityId=610100&hour=18';

test('circle distance uses meters on the sphere and includes its boundary, not bounding-box corners',()=>{
  assert.ok(Math.abs(distanceMeters([0,0],[0,1])-111195.0802)<0.001);
  const s=parseSelection('circle:0,0,111195.0802335329');
  assert.equal(inSelection(0,1,s),true);assert.equal(inSelection(1,0,s),true);
  assert.equal(inSelection(0,1.001,s),false);assert.equal(inSelection(0.9,0.9,s),false);
  assert.equal(inBounds(0.9,0.9,selectionBounds(s)),true);
  assert.equal(inSelection(0,0,s),true);
});
test('circle parsing preserves rectangular URLs and canonicalizes equivalent circle inputs',()=>{
  assert.deepEqual(parseSelection('108,34,109,35'),[108,34,109,35]);
  const a=parseSelection('circle:108.950,34.2600,10000.0');
  assert.equal(serializeSelection(a),'circle:108.95,34.26,10000');
  assert.deepEqual(parseSelection(serializeSelection(a)),a);
  assert.equal(mapContextKey(query(scope)),mapContextKey(query(scope.replace('108.95,34.26,10000','108.950,34.2600,10000.0'))));
  assert.notEqual(mapContextKey(query(scope)),mapContextKey(query(scope.replace('10000','10001'))));
  for(const value of ['circle:1,2,0','circle:1,2,9','circle:1,2,-1','circle:1,2,500001','circle:1,2,Infinity','circle:1,2,NaN','circle:1,,100','circle:1,2,100,4','circle:181,2,100','circle:1,86,100','circle:179.99,0,10000','circle:0,84.99,500000','polygon:1,2,3'])assert.throws(()=>parseSelection(value),value);
  assert.ok(parseSelection('circle:108,34,10'));assert.ok(parseSelection('circle:108,34,500000'));
  assert.throws(()=>query(scope+'&selection=108,34,109,35'));
});
test('drawn circles are valid, render a closed spherical outline and reject invalid radii',()=>{
  const c=circleFromPoints([108.95,34.26],[108.96,34.26]);assert.ok(c);
  assert.ok(c.radiusMeters>900&&c.radiusMeters<930);
  assert.equal(circleFromPoints([108,34],[108,34]),null);
  assert.equal(circleFromPoints([108,34],[120,34]),null);
  const ring=selectionPolygon(c).coordinates[0];assert.equal(ring.length,97);assert.deepEqual(ring[0],ring.at(-1));
  assert.ok(ring.every(p=>Math.abs(distanceMeters(c.center,p as [number,number])-c.radiusMeters)<0.00001));
});
test('circle intersects county, operator and search; viewport cannot change area totals or station scope',()=>{
  const q=query(scope+'&countyId=610113&operator=other&search=SX-DEMO-006'),r=queryMap(q);
  assert.equal(r.summary.count,1);assert.equal(r.points[0].id,'SX-DEMO-006');assert.equal(r.summary.energyWh,null);
  assert.ok(queryStation('SX-DEMO-006',q));assert.equal(queryStation('SX-DEMO-004',q),null);
  const base=queryMap(query(scope)),moved=queryMap(query(scope+'&bbox=105,32,106,33'));
  assert.ok(base.summary.count>0&&base.summary.count<240);assert.deepEqual(moved.summary,base.summary);assert.deepEqual(moved.area,base.area);assert.equal(moved.points.length,0);
  const rect=queryMap(query('cityId=610100&selection='+selectionBounds(query(scope).selection!).join(',')));
  assert.ok(rect.summary.count>base.summary.count);
  const empty=queryMap(query('selection=circle:105,32,10'));assert.equal(empty.summary.count,0);assert.equal(empty.summary.connectionRate,null);
});
test('circle totals, ratios and physical energy match the selected station set; operators conserve counters',()=>{
  const q=query(scope),r=queryMap(q);
  const metrics=DEMO_SITES.filter(s=>r.points.some(p=>p.id===s.id)).map(s=>siteHour(s,18));
  const sum=(key:'bytes'|'voiceSeconds'|'sms'|'used'|'capacity'|'connected'|'attempts')=>metrics.reduce((v,m)=>v+m[key],0);
  assert.equal(r.summary.bytes,sum('bytes'));assert.equal(r.summary.load,sum('used')/sum('capacity'));assert.equal(r.summary.connectionRate,sum('connected')/sum('attempts'));
  assert.equal(r.summary.energyWh,metrics.reduce((v,m)=>v+m.energyWh!,0));
  for(const key of ['bytes','voiceSeconds','sms'] as const)assert.equal(r.area!.operators.reduce((v,p)=>v+p[key],0),r.summary[key]);
  const op=queryOperatorUsage(new URLSearchParams(scope));assert.equal(op.physicalSites,r.summary.count);assert.equal(op.totals.bytes,r.summary.bytes);
  const topic=queryMap(query(scope+'&topic=capacity'));assert.equal(topic.topic!.counts.total,r.summary.count);
  const cmp=queryComparison(['SX-DEMO-001','SX-DEMO-004'],q);assert.ok(cmp.entries[0].detail);assert.equal(cmp.entries[1].detail,null);
});
test('daily circle reports keep full-day scope and stable references, include radius and geometry in HTML',()=>{
  const r=queryDailyReport(new URLSearchParams(scope));
  assert.equal(r.usage.physicalSites,queryMap(query(scope)).summary.count);
  assert.equal(r.id,queryDailyReport(new URLSearchParams(scope.replace('hour=18','hour=3')+'&bbox=105,32,106,33')).id);
  assert.notEqual(r.id,queryDailyReport(new URLSearchParams(scope.replace('10000','10001'))).id);
  const usage=queryOperatorUsage(new URLSearchParams(scope+'&period=day'));assert.deepEqual(r.usage.totals,usage.totals);
  const html=renderDailyReport(r);assert.ok(html.includes('circle:108.95,34.26,10000'));assert.ok(html.includes('R 10 km'));
});
test('circle selection lifecycle cancels to previous geometry, retains scope on analysis changes, clears on city switch',()=>{
  const state=()=>useWorkbench.getState(),circle=parseSelection('circle:108.95,34.26,3000');
  state().set({cityId:'all',countyId:'all',selection:null});state().beginSelection('circle');assert.equal(state().drawMode,'circle');
  state().finishSelection(circle);assert.deepEqual(state().selection,circle);assert.ok(state().selectionOpen&&!state().drawing);
  state().beginSelection('rectangle');state().cancelSelection();assert.deepEqual(state().selection,circle);
  state().set({topicOpen:true,hour:12,operator:'mobile'});assert.deepEqual(state().selection,circle);
  assert.throws(()=>state().finishSelection({kind:'circle',center:[108,34],radiusMeters:-1}));assert.deepEqual(state().selection,circle);
  state().set({cityId:'610100'});assert.equal(state().selection,null);state().clearSelection();
});
