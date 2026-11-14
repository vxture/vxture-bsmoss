import {test} from "node:test";
import assert from "node:assert/strict";
import {metricEvidence,monitoringSummary,type MonitoringEvidence} from "../domains/monitoring/rules";
import {monitoringModel,monitoringWindow} from "./model";
const evidence=(patch:Partial<MonitoringEvidence>={}):MonitoringEvidence=>({metric:"energy",connected:null,applicable:null,expected:null,samples:[],...patch});
test("records distinguish zero, missing, confirmed unconnected and unknown without claiming online",()=>{
 assert.equal(metricEvidence(evidence({samples:[{at:"2026-10-25T12:00:00+08:00",value:0}]})).state,"observed");
 assert.equal(metricEvidence(evidence()).state,"unknown");
 assert.equal(metricEvidence(evidence({connected:false})).state,"unconnected");
 assert.equal(metricEvidence(evidence({applicable:true,expected:true})).state,"missing");
 assert.equal(metricEvidence(evidence({applicable:true})).state,"unknown");
 assert.equal(metricEvidence(evidence({samples:[{at:"invalid",value:1},{at:"2026-10-25T12:00:00Z",value:NaN},{at:"2026-10-25T12:00:00Z",value:-1}]})).state,"unknown");
 assert.equal(metricEvidence(evidence({samples:[{at:"2026-10-25T12:00:00Z",value:0},{at:"2026-10-25T20:00:00+08:00",value:0}]})).records,1);
});
test("physical station evidence deduplicates observations, unknown applicability never becomes a coverage rate",()=>{
 const record=evidence({samples:[{at:"2026-10-25T12:00:00Z",value:0}]});
 const summary=monitoringSummary([{id:"A",evidence:[record]},{id:"A",evidence:[record]},{id:"B",evidence:[evidence({connected:false})]}]);
 assert.equal(summary.sites,2);assert.equal(summary.withRecords,1);assert.equal(summary.metrics.find(m=>m.metric==="energy")!.observed,1);
 assert.equal(summary.metrics.find(m=>m.metric==="energy")!.coverage,null);
 const known=monitoringSummary([{id:"A",evidence:[{...record,applicable:true}]},{id:"B",evidence:[evidence({applicable:true,expected:true})]}]);
 assert.equal(known.metrics.find(m=>m.metric==="energy")!.coverage,.5);
 assert.equal(monitoringSummary([]).metrics[0].coverage,null);
});
test("hours use actual observations and bounds; week/month reuse only available records and nearest dates",()=>{
 const hour=monitoringWindow("2026-10-25T11:00:00","hour");
 assert.equal(hour.times.length,1);assert.equal(hour.previousAsOf,"2026-10-25T10:00:00");assert.equal(hour.nextAsOf,"2026-10-25T12:00:00");
 assert.equal(monitoringWindow("2026-10-25T00:00:00","hour").previousAsOf,null);
 assert.equal(monitoringWindow("2026-10-25T23:00:00","hour").nextAsOf,null);
 for(const period of ["day","week","month"] as const){const data=monitoringWindow("2026-10-25T18:00:00",period);assert.equal(data.times.length,24);assert.equal(data.adjusted,false);assert.equal(data.nextAsOf,null);}
 const earlier=monitoringWindow("2026-01-01T00:00:00","hour");assert.equal(earlier.asOf,"2026-10-25T00:00:00");assert.equal(earlier.adjusted,true);
 const later=monitoringWindow("2026-12-01T00:00:00","day");assert.equal(later.times.length,24);assert.equal(later.adjusted,true);
});
test("cohort counts reconcile through regions, table search/state stays independent of overview",()=>{
 const province=monitoringModel({});assert.equal(province.monitoring.summary.sites,1080);
 assert.equal(province.monitoring.regions.reduce((sum,r)=>sum+r.withRecords,0),province.monitoring.summary.withRecords);
 const city=monitoringModel({city:"610100"});assert.equal(city.monitoring.summary.sites,240);
 const county=monitoringModel({city:"610100",county:"610116"});assert.equal(county.monitoring.summary.sites,62);
 const searched=monitoringModel({city:"610100",county:"610116",search:"DEMO-00009"});assert.equal(searched.rows.length,1);assert.deepEqual(searched.monitoring.summary,county.monitoring.summary);
 const empty=monitoringModel({recordState:"missing"});assert.equal(empty.rows.length,0);assert.deepEqual(empty.monitoring.summary,province.monitoring.summary);
 assert.equal(province.monitoring.facets.slice(1).reduce((sum,r)=>sum+r.count,0),province.rows.length);
 for(const input of [{recordState:"offline"},{recordState:["observed","missing"]},{asOf:"2026-02-30"},{pageSize:"0"}])assert.throws(()=>monitoringModel(input));
});
test("legacy tenancy filters do not limit physical monitoring; timestamps and measurements stay intact",()=>{
 const all=monitoringModel({city:"610100",county:"610116",period:"hour",asOf:"2026-10-25T12:00:00"});
 const mobile=monitoringModel({city:"610100",county:"610116",operator:"other",operatorCount:"5",sharing:"shared",period:"hour",asOf:"2026-10-25T12:00:00"});
 assert.deepEqual(mobile.monitoring.summary,all.monitoring.summary);
 assert.equal(mobile.query.operator,"all");assert.equal(mobile.query.operatorCount,"all");assert.deepEqual(mobile.rows.map(r=>r.id),all.rows.map(r=>r.id));
 assert.equal(mobile.monitoring.observations[0].latest,"2026-10-25T12:00:00+08:00");
 assert.equal(mobile.monitoring.observations[0].metrics.find(m=>m.metric==="energy")!.records,1);
 assert.equal(mobile.updatedThrough,"2026-10-25T16:00:00.000Z");
 assert.ok(mobile.monitoring.summary.metrics.every(m=>m.coverage===null));
});
test("unified runtime prioritizes current concerns and leaves scope summaries independent of detail filters",()=>{
 const all=monitoringModel({pageSize:"10"});
 const active=monitoringModel({runtimeFilter:"current",pageSize:"10"});
 const period=monitoringModel({runtimeFilter:"period"});
 assert.deepEqual(active.monitoring.runtimeSummary,all.monitoring.runtimeSummary);
 assert.equal(active.rows.length,all.monitoring.runtimeSummary.currentAbnormal);
 assert.equal(period.rows.length,all.monitoring.runtimeSummary.periodAbnormal);
 assert.equal(all.monitoring.runtimeRegions.reduce((sum,row)=>sum+row.periodAbnormal,0),all.monitoring.runtimeSummary.periodAbnormal);
 assert.equal(all.monitoring.runtimeSummary.alarmSites,null);
 const searched=monitoringModel({search:"DEMO-00009"});assert.deepEqual(searched.monitoring.runtimeSummary,all.monitoring.runtimeSummary);
 const rank={critical:0,warning:1,unknown:2,normal:3};
 for(let i=1;i<all.rows.length;i++)assert.ok(rank[all.rows[i-1].monitoring.runtime.level]<=rank[all.rows[i].monitoring.runtime.level]);
 const visible=new Set(all.rows.slice(0,10).map(row=>row.id));
 for(const row of all.monitoring.observations)assert.equal(row.runtime.context.length>0,visible.has(row.id));
 const physical=monitoringModel({operator:"mobile",pageSize:"10"});
 const id=all.rows[0].id;assert.deepEqual(physical.rows.find(row=>row.id===id)?.monitoring.runtime.current,all.rows[0].monitoring.runtime.current);
 assert.throws(()=>monitoringModel({runtimeFilter:"online"}));
});
test("regional severity and signal counts reconcile; every runtime facet returns its exact station set",()=>{
 const all=monitoringModel({});const {runtimeSummary:summary,runtimeRegions:regions}=all.monitoring;
 for(const level of ["warning","critical"] as const)assert.equal(regions.reduce((sum,r)=>sum+r.periodLevels[level],0),summary.periodLevels[level]);
 for(const signal of summary.signals)for(const key of ["warning","critical","period","current","monitored"] as const)assert.equal(regions.reduce((sum,r)=>sum+r.signals.find(s=>s.kind===signal.kind)![key],0),signal[key]);
 for(const region of regions)assert.equal(region.periodLevels.warning+region.periodLevels.critical,region.periodAbnormal);
 for(const facet of all.monitoring.runtimeFacets){
  const filtered=monitoringModel({runtimeFilter:facet.value,page:"54"});
  assert.equal(filtered.rows.length,facet.count);assert.deepEqual(filtered.monitoring.runtimeSummary,summary);
  if(facet.value==="current")assert.ok(filtered.rows.every(row=>["warning","critical"].includes(row.monitoring.runtime.level)));
  if(facet.value==="warning"||facet.value==="critical")assert.ok(filtered.rows.every(row=>row.monitoring.runtime.level===facet.value));
  if(facet.value==="period")assert.ok(filtered.rows.every(row=>row.monitoring.runtime.periodAbnormal));
  if(facet.value==="data")assert.ok(filtered.rows.every(row=>!row.monitoring.runtime.current?.complete));
 }
 const searched=monitoringModel({runtimeFilter:"current",search:"DEMO-00009"});assert.equal(searched.rows.length,1);
 assert.equal(searched.monitoring.runtimeFacets.find(f=>f.value==="current")!.count,1);
 const warning=all.monitoring.runtimeFacets.find(f=>f.value==="warning")!,critical=all.monitoring.runtimeFacets.find(f=>f.value==="critical")!;
 assert.equal(warning.count,summary.levels.warning);assert.equal(critical.count,summary.levels.critical);
 assert.equal(warning.count+critical.count,all.monitoring.runtimeFacets.find(f=>f.value==="current")!.count);
 const county=monitoringModel({city:"610100",county:"610116",period:"hour",asOf:"2026-10-25T22:00:00",runtimeFilter:"warning"});
 assert.equal(county.rows.length,county.monitoring.runtimeSummary.levels.warning);assert.ok(county.rows.every(row=>row.monitoring.runtime.level==="warning"));
});
