import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEMO_SITES} from '../map-demo/resources';
import {DEMO_DATE,DEMO_VERSION,siteHour} from '../map-demo/rules';
import {resourceGraph,resourceScope} from './resource-rules';
import {dossierDemo,registryDemo} from './demo-store';

test('every resource belongs to exactly one physical site with closed bidirectional service references',()=>{
 const ids=new Set<string>();let devices=0,relations=0;
 for(const s of DEMO_SITES){
  const graph=resourceGraph({...s,assetCode:'TT-'+s.id,towerType:'tower',heightMeters:40,current:siteHour(s,18)},DEMO_DATE,DEMO_VERSION);
  assert.equal(graph.physical.id,s.id);assert.equal(graph.devices.length,5+s.operators.length);
  for(const d of graph.devices){assert.equal(d.siteId,s.id);assert.ok(!ids.has(d.id));ids.add(d.id);
   assert.ok(d.relationIds.length);assert.equal(d.relationIds.length,d.relationId===null?s.operators.length:1);
   for(const id of d.relationIds){const r=graph.relations.find(r=>r.id===id)!;assert.ok(r);assert.ok(r.deviceIds.includes(d.id));if(d.relationId!==null)assert.equal(d.owner,r.code);}
  }
  for(const r of graph.relations){assert.equal(r.siteId,s.id);assert.equal(r.deviceIds.length,6);assert.equal(new Set(r.deviceIds).size,6);
   for(const id of r.deviceIds)assert.ok(graph.devices.find(d=>d.id===id)!.relationIds.includes(r.id));
  }
  devices+=graph.devices.length;relations+=graph.relations.length;
 }
 assert.equal(relations,3902);assert.equal(devices,1080*5+3902);assert.equal(ids.size,devices);
});

test('operator scope deduplicates shared assets without reallocating energy or changing the full graph',()=>{
 const graph=dossierDemo('SX-DEMO-001',{})!.resources,before=JSON.stringify(graph),all=resourceScope(graph,'all'),mobile=resourceScope(graph,'mobile');
 assert.equal(all.devices.length,9);assert.equal(all.relations.length,4);assert.equal(mobile.devices.length,6);assert.equal(mobile.relations.length,1);
 assert.equal(mobile.devices.filter(d=>d.relationId===null).length,5);assert.equal(mobile.devices.filter(d=>d.owner==='mobile').length,1);
 assert.equal(mobile.devices.filter(d=>d.observation.kind==='energy').length,1);
 assert.deepEqual(mobile.devices.find(d=>d.observation.kind==='energy'),all.devices.find(d=>d.observation.kind==='energy'));
 assert.deepEqual(resourceScope(graph,'other'),{relations:[],devices:[]});assert.equal(JSON.stringify(graph),before);
});

test('outage and temperature are site observations, never invented equipment states or lifecycle dates',()=>{
 const s=DEMO_SITES.find(s=>s.profile==='mountain')!,a=dossierDemo(s.id,{hour:'12'})!,b=dossierDemo(s.id,{hour:'18'})!;
 assert.equal(a.site.current.status,'critical');assert.equal(a.resources.observedAt,DEMO_DATE+'T12:00:00+08:00');
 assert.equal(b.resources.observedAt,DEMO_DATE+'T18:00:00+08:00');assert.deepEqual(a.devices.map(d=>d.id),b.devices.map(d=>d.id));
 assert.equal(a.devices.find(d=>d.observation.kind==='power')!.observation.value,'battery');assert.equal(b.devices.find(d=>d.observation.kind==='power')!.observation.value,'mains');
 for(const d of a.devices){assert.equal(d.state,'unknown');assert.deepEqual(d.validity,{from:null,to:null,basis:'unknown'});}
 for(const r of a.resources.relations)assert.deepEqual(r.validity,{from:null,to:null,basis:'unknown'});
 assert.deepEqual(a.resources.physical.validity,{from:null,to:null,basis:'unknown'});assert.ok(a.site.commissioned);
 assert.ok(a.devices.filter(d=>d.relationId!==null).every(d=>d.observation.value===null));
 assert.equal(a.devices.find(d=>d.observation.kind==='energy')!.observation.value,a.site.current.energyWh);
});

test('registry and dossier share relation IDs, bearing assets and snapshot measurements across filters',()=>{
 const rows=registryDemo({view:'relations',city:'610100',operator:'telecom',hour:'12',page:'2'}).relations;
 assert.equal(rows.length,20);
 for(const row of rows){const d=dossierDemo(row.site.id,{hour:'12',operator:'telecom'})!,r=d.relations.find(r=>r.code===row.code)!;
  assert.deepEqual(row.resource,r.resource);assert.equal(row.sharedResourceCount,5);assert.deepEqual(row.current,r.current);
  assert.deepEqual(d.resources,resourceGraph(d.site,DEMO_DATE,DEMO_VERSION));
 }
});
