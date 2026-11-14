import {test} from "node:test";
import assert from "node:assert/strict";
import {capacityModel} from "./model";
import {businessDemo} from "../business-analysis/model";
import {DEMO_SITES} from "../domains/map-demo/resources";
import {siteHour} from "../domains/map-demo/rules";
import {evaluateCapacity} from "../domains/map-demo/topic-rules";

test("migrated capacity matches legacy counters, weighted ratios and hourly source",()=>{
 for(const input of [{hour:"18"},{city:"610100",county:"610116",hour:"12",operator:"mobile"}]){
  const d=capacityModel(input),old=businessDemo("capacity",input).capacity!;
  for(const key of ["sites","used","capacity","attempts","connected","failed","load","connection","highLoad","lowConnection","both","attention","unknown"] as const)assert.equal(d.bearing.total[key],old.total[key],key);
  assert.equal(d.query.period,"hour");assert.equal(d.snapshotAt.slice(11,13),input.hour);
  assert.equal(d.bearing.series.length,1);
  for(const r of d.bearing.series){assert.equal(r.load,old.series[r.hour].load);assert.equal(r.connection,old.series[r.hour].connection);assert.equal(r.attention,old.series[r.hour].attention);}
 }
});

test("period selection governs weighted totals, severity, facets, regional/provider slices and visible detail evidence",()=>{
 for(const input of [{},{city:"610100",county:"610116",operator:"mobile"}])for(const period of ["hour","day","week","month"]){
  const d=capacityModel({...input,period,asOf:"2026-10-25T08:00:00"}),t=d.bearing.total;
  const hours=period==="hour"?[8]:Array.from({length:24},(_,h)=>h);
  const raw=d.rows.map(row=>{const site=DEMO_SITES.find(s=>s.id===row.id)!;const samples=hours.map(h=>siteHour(site,h,d.query.operator));return {row,counters:{used:samples.reduce((v,m)=>v+m.used,0),capacity:samples.reduce((v,m)=>v+m.capacity,0),attempts:samples.reduce((v,m)=>v+m.attempts,0),connected:samples.reduce((v,m)=>v+m.connected,0)}};});
  for(const key of ["used","capacity","attempts","connected"] as const)assert.equal(t[key],raw.reduce((sum,r)=>sum+r.counters[key],0));
  for(const {row,counters} of raw){assert.equal(row.capacity.load,counters.capacity?counters.used/counters.capacity:null);assert.equal(row.capacity.connection,counters.attempts?counters.connected/counters.attempts:null);assert.equal(row.capacity.level,evaluateCapacity(counters).level);}
  for(const key of ["highLoad","lowConnection","both","attention"] as const){assert.equal(d.bearing.regions.length?d.bearing.regions.reduce((sum,r)=>sum+r[key],0):t[key],t[key]);assert.equal(t.levels[key].warning+t.levels[key].critical,t[key]);}
  assert.equal(d.bearing.facets.find(f=>f.value==="connection")!.count,d.rows.filter(r=>r.capacity.lowConnection).length);
  const expectedPoints=period==="day"?24:1;assert.equal(d.bearing.series.length,expectedPoints);
  d.rows.forEach((row,i)=>{assert.equal(row.capacity.series.length,i<20?expectedPoints:0);assert.equal(row.capacity.samples.length,i<20?hours.length:0);if(i<20)assert.deepEqual(row.capacity.samples.map(s=>s.hour),hours);});
  assert.equal(d.bearing.period.observed,period==="day"?24:1);assert.equal(d.bearing.period.expected,period==="hour"?1:period==="day"?24:period==="week"?7:31);
  for(const key of ["used","capacity","attempts","connected"] as const)assert.equal(d.bearing.operators.reduce((sum,r)=>sum+r[key],0),t[key]);
 }
 const day=capacityModel({period:"day"}),last=capacityModel({hour:"23"});assert.notEqual(day.bearing.total.load,last.bearing.total.load);assert.notEqual(day.bearing.total.lowConnection,last.bearing.total.lowConnection);
 const searched=capacityModel({period:"day",search:"SX-DEMO-001"});assert.equal(searched.rows.length,1);assert.deepEqual(searched.bearing.total,day.bearing.total);
 const filtered=capacityModel({period:"day",capacityFilter:"connection"});assert.equal(filtered.rows.length,day.bearing.total.lowConnection);assert.ok(filtered.rows.every(r=>r.capacity.lowConnection));assert.deepEqual(filtered.bearing.total,day.bearing.total);
});

test("regional counters reconcile, providers retain distinct station denominators",()=>{
 const d=capacityModel({});const t=d.bearing.total;
 assert.equal(t.sites,1080);assert.equal(d.bearing.regions.length,10);
 for(const key of ["sites","used","capacity","attempts","connected","failed","highLoad","lowConnection","both","attention"] as const)assert.equal(d.bearing.regions.reduce((sum,r)=>sum+r[key],0),t[key],key);
 assert.equal(t.attention,t.highLoad+t.lowConnection-t.both);
 for(const key of ["highLoad","lowConnection","both","attention"] as const){
  assert.equal(t.levels[key].warning+t.levels[key].critical,t[key]);
  for(const level of ["warning","critical"] as const)assert.equal(d.bearing.regions.reduce((sum,r)=>sum+r.levels[key][level],0),t.levels[key][level]);
 }
 assert.equal(t.load,t.used/t.capacity);assert.equal(t.connection,t.connected/t.attempts);
 for(const key of ["used","capacity","attempts","connected","failed"] as const)assert.equal(d.bearing.operators.reduce((sum,r)=>sum+r[key],0),t[key]);
 assert.ok(d.bearing.operators.reduce((sum,r)=>sum+r.sites,0)>t.sites);
 assert.equal(capacityModel({city:"610100"}).bearing.total.sites,240);
 assert.equal(capacityModel({city:"610100",county:"610116"}).bearing.total.sites,62);
 assert.deepEqual(d.bearing.regions.map(r=>r.id),[...d.bearing.regions.map(r=>r.id)].sort());
});

test("facets select exact row sets; search and table facets never change overview",()=>{
 const all=capacityModel({hour:"18"});
 for(const facet of all.bearing.facets){
  const d=capacityModel({hour:"18",capacityFilter:facet.value,page:"54"});
  assert.equal(d.rows.length,facet.count);assert.deepEqual(d.bearing.total,all.bearing.total);
  assert.deepEqual(d.bearing.regions,all.bearing.regions);
  if(facet.value==="high")assert.ok(d.rows.every(r=>r.capacity.highLoad));
  if(facet.value==="connection")assert.ok(d.rows.every(r=>r.capacity.lowConnection));
  if(facet.value==="both")assert.ok(d.rows.every(r=>r.capacity.highLoad&&r.capacity.lowConnection));
  if(facet.value==="unknown")assert.ok(d.rows.every(r=>r.capacity.load===null||r.capacity.connection===null));
 }
 const searched=capacityModel({hour:"18",search:"SX-DEMO-001"});assert.equal(searched.rows.length,1);assert.deepEqual(searched.bearing.total,all.bearing.total);
 const empty=capacityModel({search:"no-match"});assert.equal(empty.rows.length,0);assert.equal(empty.bearing.total.sites,1080);
 const visible=capacityModel({pageSize:"10",page:"2"});
 visible.rows.forEach((row,i)=>assert.equal(row.capacity.series.length,i>=10&&i<20?24:0));
});

test("time changes source values; day/week/month retain actual observations and legacy hour validation",()=>{
 const early=capacityModel({period:"hour",asOf:"2026-10-25T00:00:00"});
 assert.equal(early.previousAsOf,null);assert.equal(early.nextAsOf,"2026-10-25T01:00:00");
 const later=capacityModel({hour:"18"});assert.notEqual(early.bearing.total.load,later.bearing.total.load);
 for(const period of ["day","week","month"]){const d=capacityModel({period,asOf:"2026-12-01"});assert.equal(d.snapshotAt,"2026-10-25T23:00:00");assert.equal(d.adjusted,true);assert.equal(d.bearing.window.times.length,24);}
 for(const input of [{capacityFilter:"offline"},{capacityFilter:["all"]},{hour:"24"},{pageSize:"5"},{topic:"power"},{asOf:"2026-02-30"}])assert.throws(()=>capacityModel(input));
 const provider=capacityModel({operator:"other",hour:"18"});assert.ok(provider.rows.every(r=>r.operators.includes("other")));assert.equal(provider.bearing.operators.length,1);
});
