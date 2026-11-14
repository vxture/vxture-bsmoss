import {test} from 'node:test';
import assert from 'node:assert/strict';
import {efficiencyModel} from './model';
import {DEMO_SITES} from '../domains/map-demo/resources';
import {siteHour,GIB} from '../domains/map-demo/rules';
import {defaultMonitoringConfiguration} from '../domains/monitoring/parameters';
test('whole-page periods preserve physical sites, weighted totals and exact local evidence',()=>{
 for(const input of [{},{city:'610100'},{city:'610100',county:'610116'}])for(const period of ['hour','day','week','month']){
  const d=efficiencyModel({...input,period,asOf:'2026-10-25T08:00:00'}),b=d.efficiency,t=b.total,hours=period==='hour'?[8]:Array.from({length:24},(_,h)=>h);
  const raw=d.rows.map(row=>{const site=DEMO_SITES.find(s=>s.id===row.id)!;return hours.map(h=>siteHour(site,h,'all'));}).flat();
  const energy=raw.reduce((v,m)=>v+(m.energyWh??0),0),bytes=raw.reduce((v,m)=>v+(m.energyWh===null?0:m.bytes),0);
  assert.equal(t.sites,d.rows.length);assert.equal(t.energyWh,energy);assert.equal(t.pairedBytes,bytes);assert.equal(t.intensity,energy/1000/(bytes/GIB));assert.equal(t.observed,raw.length);
  for(const key of ['sites','energyWh','pairedBytes','warning','critical','missing','zeroTraffic'] as const)if(b.regions.length)assert.equal(b.regions.reduce((v,r)=>v+(r[key]??0),0),t[key]);
  assert.equal(t.warning+t.critical,t.attention);assert.equal(b.series.length,period==='day'?24:1);
  assert.equal(b.period.expected,period==='hour'?1:period==='day'?24:period==='week'?7:31);assert.equal(b.period.observed,period==='day'?24:1);
  d.rows.forEach((row,i)=>{assert.equal(row.energy.samples.length,i<20?hours.length:0);assert.equal(row.energy.series.length,i<20?b.series.length:0);if(i<20){assert.deepEqual(row.energy.samples.map(s=>Number(s.at.slice(11,13))),hours);assert.equal(row.energy.energyWh,row.energy.samples.reduce((v,s)=>v+(s.energyWh??0),0));}});
 }
 assert.notEqual(efficiencyModel({hour:'8'}).efficiency.total.energyWh,efficiencyModel({period:'day'}).efficiency.total.energyWh);
});
test('facets/search scope only table, page evidence is lazy, regional drilldown conserves scope',()=>{
 const all=efficiencyModel({});assert.equal(all.efficiency.total.sites,1080);
 for(const f of all.efficiency.facets){const d=efficiencyModel({energyFilter:f.value});assert.equal(d.rows.length,f.count);assert.deepEqual(d.efficiency.total,all.efficiency.total);assert.deepEqual(d.efficiency.regions,all.efficiency.regions);if(f.value==='normal'||f.value==='warning'||f.value==='critical')assert.ok(d.rows.every(r=>r.energy.level===f.value));if(f.value==='zero')assert.ok(d.rows.every(r=>r.energy.zeroTraffic));if(f.value==='unknown')assert.ok(d.rows.every(r=>r.energy.missing>0));}
 const searched=efficiencyModel({search:'SX-DEMO-001'});assert.equal(searched.rows.length,1);assert.deepEqual(searched.efficiency.total,all.efficiency.total);
 const page=efficiencyModel({pageSize:'10',page:'2'});page.rows.forEach((r,i)=>assert.equal(r.energy.samples.length,i>=10&&i<20?24:0));
 assert.equal(efficiencyModel({city:'610100'}).efficiency.total.sites,240);assert.equal(efficiencyModel({city:'610100',county:'610116'}).efficiency.total.sites,62);
 assert.deepEqual(all.efficiency.regions.map(r=>r.id),[...all.efficiency.regions.map(r=>r.id)].sort());
 assert.deepEqual(efficiencyModel({operator:'mobile'}).efficiency.total,all.efficiency.total);
});
test('saved common parameters recalculate all severities without changing observations; dates find actual data',()=>{
 const defaults=efficiencyModel({}),configuration=defaultMonitoringConfiguration();configuration.revision=7;configuration.parameters.intensityWarning=100;configuration.parameters.intensityCritical=101;
 const custom=efficiencyModel({},configuration);assert.equal(custom.efficiency.total.attention,0);assert.ok(defaults.efficiency.total.attention>0);assert.equal(custom.efficiency.total.energyWh,defaults.efficiency.total.energyWh);assert.equal(custom.efficiency.total.intensity,defaults.efficiency.total.intensity);
 assert.equal(custom.efficiency.facets.find(f=>f.value==='critical')!.count,0);assert.ok(custom.efficiency.regions.every(r=>r.attention===0));assert.ok(custom.rows.every(r=>r.energy.level==='normal'));assert.ok(custom.efficiency.series.every(s=>s.attention===0));
 for(const period of ['hour','day','week','month']){const d=efficiencyModel({period,asOf:'2026-12-01'});assert.equal(d.adjusted,true);assert.equal(d.snapshotAt,'2026-10-25T23:00:00');}
 const h=efficiencyModel({hour:'8'});assert.equal(h.previousAsOf,'2026-10-25T07:00:00');assert.equal(h.nextAsOf,'2026-10-25T09:00:00');
 for(const input of [{energyFilter:'bad'},{energyFilter:['all']},{asOf:'2026-02-30'},{hour:'24'},{pageSize:'5'},{topic:'capacity'}])assert.throws(()=>efficiencyModel(input));
 assert.throws(()=>efficiencyModel({}, {...configuration,parameters:{...configuration.parameters,intensityWarning:Infinity}}));
});

test('ring categories are exclusive evaluable sites and remain independent from detail filters',()=>{
 for(const input of [{},{hour:'8'},{city:'610100',county:'610116'}]){
  const all=efficiencyModel(input),t=all.efficiency.total;
  const selected=['normal','warning','critical'].map(energyFilter=>efficiencyModel({...input,energyFilter}));
  assert.equal(selected.reduce((sum,d)=>sum+d.rows.length,0),t.evaluable);
  const ids=selected.flatMap(d=>d.rows.map(r=>r.id));assert.equal(new Set(ids).size,ids.length);
  assert.equal(selected[0].rows.length,t.evaluable-t.warning-t.critical);
  selected.forEach(d=>assert.deepEqual(d.efficiency.total,t));
 }
});
