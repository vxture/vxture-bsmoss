import { test } from "node:test";
import assert from "node:assert/strict";
import { FIRST_METRICS } from "../catalog/first-metrics.ts";
import { integer, normalizeDraft, normalizeFilter, timestamp } from "./rules.ts";
import { persistMeasurement, listMeasurements } from "./service.ts";
import type { MeasurementDraft, MeasurementStore } from "./store.ts";

const r: MeasurementDraft = {workspaceId:"w",sourceId:"src",eventId:"e",revision:"1",previousRevision:null,
  payloadSha256:"a".repeat(64),payloadUri:"fixture://payload",occurredAt:"2026-02-01T08:00:00+08:00",
  metric:{code:"service.data.uplink_bytes",version:1},componentKey:"ul",stationId:"st",mappingId:"map",transformVersion:"1",
  periodStart:"2026-02-01T00:00:00Z",periodEnd:"2026-02-01T00:15:00Z",value:{kind:"integer_delta",value:"100"},
  quality:{status:"verified",ruleVersion:"1",reason:"fixture",decidedBy:"worker"}};
test("ingestion rejects fractional, exponential, overflow and noncanonical integers before SQL",()=>{
  integer("9".repeat(30));
  for (const value of ["0.5","1e3","01","-1","1"+"0".repeat(30)]) {
    assert.throws(()=>normalizeDraft({...r,value:{kind:"integer_delta",value}},FIRST_METRICS),/invalid_integer/);
  }
});
test("timestamps normalize for replay but reject ambiguous dates and microsecond truncation",()=>{
  assert.equal(normalizeDraft(r,FIRST_METRICS).occurredAt,"2026-02-01T00:00:00.000Z");
  for (const value of ["2026-02-30T00:00:00Z","2026-02-01T24:00:00Z","2026-02-01T00:00:00.000001Z","2026-02-01T00:00:00"]) assert.throws(()=>timestamp(value),/invalid_timestamp/);
});
test("metric semantic, ratio bounds and event expiry are checked before storage",()=>{
  assert.throws(()=>normalizeDraft({...r,value:{kind:"ratio_parts",numerator:"1",denominator:"2"}},FIRST_METRICS),/metric_value_mismatch/);
  assert.throws(()=>normalizeDraft({...r,metric:{code:"status.voice.connection_rate",version:1},value:{kind:"ratio_parts",numerator:"2",denominator:"1"}},FIRST_METRICS),/invalid_ratio/);
  assert.throws(()=>normalizeDraft({...r,metric:{code:"runtime.device.state",version:1},value:{kind:"state_event",state:"running",validUntil:r.periodStart}},FIRST_METRICS),/invalid_state_expiry/);
  assert.throws(()=>normalizeDraft({...r,metric:{code:"service.data.total_bytes",version:1}},FIRST_METRICS),/unavailable_metric/);
  const copy=normalizeDraft(r,FIRST_METRICS); copy.metric.version=2;
  assert.equal(r.metric.version,1);
});
test("evidence drill-down is bounded by time window and page size",()=>{
  const f={stationId:"st",metric:r.metric,from:r.periodStart,to:r.periodEnd,limit:50};
  assert.equal(normalizeFilter(f).limit,50);
  for (const patch of [{limit:0},{limit:201},{to:"2026-04-01T00:00:00Z"},{afterId:"' OR true"}]) assert.throws(()=>normalizeFilter({...f,...patch}));
});
test("both gates, decision identity and store workspace binding precede any IO",async()=>{
  let calls=0;
  const store: MeasurementStore={workspaceId:"w",append:async()=>{calls++;return {id:"id",status:"inserted"};},list:async()=>{calls++;return {items:[],nextAfterId:null};}};
  const ctx={workspaceId:"w",sub:"worker",features:new Set(["metering"]),permissions:new Set(["metering.ingest","metering.view"])};
  await assert.rejects(persistMeasurement({...ctx,features:new Set()},store,r),/feature_denied/);
  await assert.rejects(persistMeasurement({...ctx,permissions:new Set()},store,r),/permission_denied/);
  await assert.rejects(persistMeasurement({...ctx,sub:"different"},store,r),/decision_identity_mismatch/);
  await assert.rejects(listMeasurements({...ctx,workspaceId:"other"},store,{stationId:"st",metric:r.metric,from:r.periodStart,to:r.periodEnd,limit:10}),/workspace_mismatch/);
  assert.equal(calls,0);
});
