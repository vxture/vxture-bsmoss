import { test } from "node:test";
import assert from "node:assert/strict";
import { FIRST_METRICS } from "../catalog/first-metrics.ts";
import { refKey } from "../catalog/registry.ts";
import { resolvePanels, type Panel, type ResolveInput, type Preference } from "./resolve.ts";
const p: Panel = {id:"traffic",category:"business_service",metricRef:{code:"service.data.uplink_bytes",version:1},view:"trend",grain:"hour",displayUnit:"GiB",precision:2,order:1,visible:true};
const base: ResolveInput = {workspaceId:"w",template:{workspaceId:"w",code:"default",version:1,panels:[p]},mode:"interactive",allowedMetricKeys:new Set(FIRST_METRICS.list().map(refKey)),capabilities:[{metricRef:p.metricRef,grains:["hour","day"]}]};
const resolve = (patch: Partial<ResolveInput> = {}) => resolvePanels(FIRST_METRICS,{...base,...patch});
test("role, page and personal layers merge without mutating published template", () => {
  const result = resolve({roles:[{priority:1,panels:[{id:p.id,precision:3}]}],page:[{id:p.id,displayUnit:"GB"}],preferences:[{id:p.id,order:0}]});
  assert.equal(result.panels[0].precision,3); assert.equal(result.panels[0].displayUnit,"GB");
  assert.equal(result.panels[0].availability,"supported"); assert.equal(p.displayUnit,"GiB");
  assert.throws(() => { (result.panels as unknown[]).push(p); });
});
test("report ignores preferences and keeps version and required context", () => {
  const result = resolve({mode:"report",preferences:[{id:p.id,visible:false}]});
  assert.equal(result.panels.length,1); assert.equal(result.templateVersion,1);
  assert.deepEqual(result.panels[0].requiredContext,["quality","freshness","revision","definition"]);
  assert.equal(resolve({preferences:[{id:p.id,visible:false}]}).panels.length,0);
});
test("revoked access and preferences never restore restricted metrics", () => {
  assert.equal(resolve({allowedMetricKeys:new Set(),preferences:[{id:p.id,visible:true}]}).panels.length,0);
  const total = {...p,metricRef:{code:"service.data.total_bytes",version:1}};
  assert.equal(resolve({template:{...base.template,panels:[total]},allowedMetricKeys:new Set([refKey(total.metricRef)])}).panels.length,0);
});
test("unsupported source grain does not manufacture fine-grained data", () => {
  assert.equal(resolve({preferences:[{id:p.id,grain:"15m"}]}).panels[0].availability,"not_connected");
  assert.equal(resolve({capabilities:[]}).panels[0].availability,"not_connected");
});
test("invalid units, unknown fields, duplicate ids and role conflicts are rejected", () => {
  assert.throws(() => resolve({preferences:[{id:p.id,displayUnit:"kWh"}]}),/unsupported_unit/);
  assert.throws(() => resolve({preferences:[{id:p.id,metricRef:p.metricRef} as unknown as Preference]}),/unknown_field/);
  assert.throws(() => resolve({page:[{id:"missing",visible:true}]}),/unknown_panel/);
  assert.throws(() => resolve({template:{...base.template,panels:[p,p]}}),/duplicate_panel/);
  assert.throws(() => resolve({roles:[{priority:1,panels:[{id:p.id,visible:true}]},{priority:1,panels:[{id:p.id,visible:false}]}]}),/role_priority_conflict/);
  assert.throws(() => resolve({workspaceId:"other"}),/workspace_mismatch/);
});
test("device state cannot be plotted as a numeric trend", () => {
  const state: Panel = {...p,category:"runtime_parameter",metricRef:{code:"runtime.device.state",version:1},displayUnit:"state",view:"timeline"};
  assert.equal(resolve({template:{...base.template,panels:[state]}}).panels[0].view,"timeline");
  assert.throws(() => resolve({template:{...base.template,panels:[{...state,view:"trend"}]}}),/unsupported_view/);
});
