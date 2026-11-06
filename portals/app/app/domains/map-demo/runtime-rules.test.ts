import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analyzeRuntime,runtimeObservation,summarizeRuntime,runtimeResourceCoverage} from './runtime-rules';
import {GIB,DEMO_DATE,DEMO_VERSION,siteHour} from './rules';
import {DEMO_SITES} from './resources';
import {parseMapQuery,selectSites,queryMap} from './service';
import {businessDemo} from '../../business-analysis/model';
import {resourceGraph} from '../site-registry/resource-rules';
import {registryRecord,dossierDemo} from '../site-registry/demo-store';
const query=(s='')=>parseMapQuery(new URLSearchParams(s));
const sample=(energyWh:number|null,bytes:number,temperature:number|null=25,power:'mains'|'battery'|null='mains')=>({energyWh,bytes,temperature,power});
const graphs=(sites=DEMO_SITES)=>sites.map(s=>resourceGraph(registryRecord(s,12),DEMO_DATE,DEMO_VERSION));

test('energy intensity weights original Wh and bytes and includes zero-traffic energy in its numerator',()=>{
 const d=summarizeRuntime([sample(100,GIB),sample(100,9*GIB),sample(100,0)]);
 assert.equal(d.energyWh,300);assert.equal(d.intensity,0.03);assert.equal(d.efficiencyKnown,2);assert.equal(d.zeroTraffic,1);
 assert.equal(runtimeObservation(sample(100,0)).intensity,null);
 assert.equal(runtimeObservation(sample(0,GIB)).intensity,0);
 assert.equal(summarizeRuntime([sample(0,0)]).intensity,null);
 for(const [wh,level] of [[149,'normal'],[150,'warning'],[300,'critical']] as const)assert.equal(runtimeObservation(sample(wh,GIB)).efficiencyLevel,level);
});
test('missing, unallocated, zero-traffic and physical coverage are independent without invented normal states',()=>{
 const d=summarizeRuntime([sample(null,9*GIB,null,null),sample(100,GIB,40,'battery')]);
 assert.equal(d.energyWh,100);assert.equal(d.energyKnown,1);assert.equal(d.missingEnergy,1);assert.equal(d.intensity,0.1);assert.equal(d.pairedBytes,GIB);
 assert.equal(d.powerKnown,1);assert.equal(d.temperatureKnown,1);assert.equal(d.temperatureMax,40);assert.equal(d.battery,1);assert.equal(d.powerAttention,1);
 assert.equal(runtimeObservation(sample(null,GIB,null,null)).powerLevel,'unknown');
 assert.equal(runtimeObservation(sample(null,GIB,null,'battery')).powerLevel,'critical');
 assert.equal(runtimeObservation(sample(null,GIB,35,null)).powerLevel,'warning');
 const op=summarizeRuntime([sample(null,GIB)],false);assert.equal(op.energyWh,null);assert.equal(op.intensity,null);assert.equal(op.unallocated,1);assert.equal(op.missingEnergy,0);
 const empty=summarizeRuntime([]);assert.equal(empty.energyWh,null);assert.equal(empty.temperatureMax,null);assert.equal(empty.intensity,null);
});
test('regions conserve physical energy and sample counts, with map topic counts and weighted intensity',()=>{
 for(const topic of ['power','efficiency']){
  const q=query('topic='+topic+'&hour=12'),d=businessDemo('efficiency',{topic,hour:'12'}).runtime!,map=queryMap(q);
  assert.equal(d.total.sites,1080);assert.equal(d.total.energyWh,map.summary.energyWh);assert.equal(d.total.bytes,map.summary.bytes);
  assert.equal(d.total[topic==='power'?'powerAttention':'efficiencyAttention'],map.topic!.counts.warning+map.topic!.counts.critical);
  for(const key of ['energyWh','bytes','energyKnown','battery','mains','powerAttention','efficiencyAttention','efficiencyKnown','zeroTraffic'] as const)assert.equal(d.regions.reduce((n,r)=>n+(r[key]??0),0),d.total[key]);
  assert.ok(Math.abs(d.regions.reduce((n,r)=>n+r.energyShare!,0)-1)<1e-12);
  assert.equal(d.total.intensity,(d.total.energyWh!/1000)/(d.total.bytes/GIB));
  assert.deepEqual(d.priority.map(p=>p.id),map.topic!.priority.map(p=>p.id));
 }
});
test('resource coverage reuses deduplicated registry inventory and does not promote station observations to equipment telemetry',()=>{
 const all=graphs(),d=runtimeResourceCoverage([...all,...all],{operator:'all'});
 assert.equal(d.devices,9302);assert.equal(d.known,0);assert.equal(d.unknown,9302);
 const mobile=runtimeResourceCoverage(all,{operator:'mobile'});assert.equal(mobile.devices,6480);assert.equal(mobile.known,0);
 const s=DEMO_SITES.find(s=>s.id==='SX-DEMO-004')!,q=query('topic=power&hour=12&search=SX-DEMO-004');
 const result=analyzeRuntime([s],q,all);assert.equal(result.resources.devices,5+s.operators.length);assert.equal(result.total.battery,1);assert.equal(result.resources.known,0);
 const dossier=dossierDemo(s.id,{hour:'12'})!;assert.equal(result.resources.devices,dossier.devices.length);assert.ok(dossier.devices.every(d=>d.state==='unknown'));
});
test('operator energy stays unallocated, hierarchy and intersections preserve complete selected cohort',()=>{
 for(const input of [{topic:'power',city:'610100',county:'610113',operator:'mobile',hour:'12'},
  {topic:'efficiency',city:'610100',selection:'108.8,34.1,109.1,34.5',search:'SX-DEMO',operator:'telecom',hour:'3'},
  {topic:'efficiency',search:'not-found'}]){
  const d=businessDemo('efficiency',input),r=d.runtime!;assert.equal(r.total.sites,d.snapshot.summary.count);
  assert.equal(r.regions.reduce((n,x)=>n+x.sites,0),r.total.sites);
  if(d.scope.operator!=='all'){assert.equal(r.total.energyWh,null);assert.equal(r.total.intensity,null);assert.equal(r.total.unallocated,r.total.sites);assert.ok(r.series.every(x=>x.energyWh===null&&x.intensity===null));}
 }
 assert.equal(businessDemo('efficiency',{city:'610100'}).runtime!.regionLevel,'county');
 assert.equal(businessDemo('efficiency',{city:'610100',county:'610113'}).runtime!.regionLevel,'current');
 assert.equal(businessDemo('capacity',{}).runtime,null);assert.throws(()=>businessDemo('efficiency',{energy:'forged'}));
});
test('24 hourly original evidence and trends match the same map cohort and fixed snapshot',()=>{
 const q=query('topic=power&hour=12'),d=analyzeRuntime(DEMO_SITES,q,graphs());
 for(const r of d.series){const map=queryMap({...q,hour:r.hour});assert.equal(r.energyWh,map.summary.energyWh);assert.equal(r.powerAttention,map.topic!.counts.warning+map.topic!.counts.critical);}
 for(const p of d.priority){const site=DEMO_SITES.find(s=>s.id===p.id)!;assert.equal(p.series.length,24);assert.deepEqual(p.current,p.series[12]);
  for(const r of p.series){const m=siteHour(site,r.hour);for(const key of ['energyWh','bytes','temperature','power'] as const)assert.equal(r[key],m[key]);}}
 assert.equal(d.observedAt,'2026-10-25T12:00:00+08:00');
 assert.deepEqual(analyzeRuntime([...DEMO_SITES].reverse(),q,graphs()).priority,d.priority);
 const empty=analyzeRuntime([],q,graphs());assert.equal(empty.resources.devices,0);assert.equal(empty.total.energyWh,null);assert.equal(empty.regions.length,0);assert.equal(empty.priority.length,0);
 assert.equal(selectSites(q).length,1080);
});
