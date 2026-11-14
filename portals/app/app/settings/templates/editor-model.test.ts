import { test } from "node:test";
import assert from "node:assert/strict";
import { EDITOR_METRICS, editableTemplate, editTemplate, editorViews, newTemplate } from "./editor-model.ts";
import { templateCandidate } from "../../domains/views/templates.ts";

const ref = (code: string) => EDITOR_METRICS.find(m => m.code === code)!;
function titled(kind: "page" | "report" = "page") { return editTemplate(newTemplate(kind), { type: "title", value: "Reviewed draft" }); }
test("new visual drafts contain all three categories without inventing data or source bindings", () => {
  for (const kind of ["page", "report"] as const) {
    const raw = newTemplate(kind); assert.equal(raw.definition.title, "");
    const c = titled(kind); assert.deepEqual(templateCandidate(c), c);
    assert.deepEqual(c.definition.panels.map(p => p.category), ["business_service", "operational_status", "runtime_parameter"]);
    assert.ok(c.definition.bindings.every(b => b.kind === "not_connected"));
    assert.deepEqual(editableTemplate(JSON.stringify(raw)), raw);
  }
});
test("metric changes clear old object bindings, keep stable IDs and never copy catalog metadata into references", () => {
  const c = editTemplate(titled(), { type: "binding", binding: { panelId: "panel-1", kind: "aggregate", sourceId: "source", mappingId: "voice-map" } });
  const before = structuredClone(c), changed = editTemplate(c, { type: "metric", id: "panel-1", ref: ref("runtime.device.state") });
  assert.deepEqual(c, before); assert.equal(changed.definition.panels[0]!.id, "panel-1");
  assert.deepEqual(changed.definition.panels[0]!.metricRef, { code: "runtime.device.state", version: 1 });
  assert.deepEqual(changed.definition.bindings[0], { panelId: "panel-1", kind: "not_connected" });
  assert.deepEqual(templateCandidate(changed), changed);
  assert.deepEqual(editTemplate(c, { type: "metric", id: "panel-1", ref: c.definition.panels[0]!.metricRef }), c);
});
test("report cycle changes every panel together while interactive pages retain independent grains", () => {
  const report = editTemplate(titled("report"), { type: "report-grain", value: "month" });
  assert.equal(report.kind === "report" && report.definition.grain, "month");
  assert.ok(report.definition.panels.every(p => p.grain === "month")); assert.deepEqual(templateCandidate(report), report);
  const forced = editTemplate(report, { type: "panel", id: "panel-1", patch: { grain: "hour" } }); assert.equal(forced.definition.panels[0]!.grain, "month");
  const page = editTemplate(titled(), { type: "panel", id: "panel-1", patch: { grain: "hour" } });
  assert.deepEqual(page.definition.panels.map(p => p.grain), ["hour", "day", "day"]);
  assert.throws(() => editTemplate(page, { type: "report-grain", value: "day" }), /invalid_editor_grain/);
});
test("state duration and device count cannot retain state cards or timelines", () => {
  for (const displayUnit of ["second", "device_count"]) {
    const c = editTemplate(titled(), { type: "panel", id: "panel-3", patch: { displayUnit } });
    assert.equal(c.definition.panels[2]!.view, "table"); assert.deepEqual(editorViews(c.definition.panels[2]!), ["table"]);
    assert.deepEqual(templateCandidate(c), c);
  }
  assert.throws(() => editTemplate(titled(), { type: "panel", id: "panel-3", patch: { displayUnit: "kWh" } }), /unsupported_unit/);
});
test("move remove and add keep bindings attached to stable IDs and respect both panel limits", () => {
  const base = titled(), moved = editTemplate(base, { type: "move", id: "panel-3", direction: -1 });
  assert.deepEqual(moved.definition.panels.map(p => p.id), ["panel-1", "panel-3", "panel-2"]);
  assert.deepEqual(moved.definition.panels.map(p => p.order), [0, 1, 2]);
  assert.deepEqual(moved.definition.bindings.map(b => b.panelId), moved.definition.panels.map(p => p.id));
  assert.deepEqual(editTemplate(base, { type: "move", id: "panel-1", direction: -1 }), base);
  let c = moved;
  while (c.definition.panels.length > 1) c = editTemplate(c, { type: "remove", id: c.definition.panels[0]!.id });
  assert.throws(() => editTemplate(c, { type: "remove", id: c.definition.panels[0]!.id }), /editor_panel_minimum/);
  while (c.definition.panels.length < 16) c = editTemplate(c, { type: "add", ref: ref("service.data.total_bytes") });
  assert.equal(new Set(c.definition.panels.map(p => p.id)).size, 16); assert.deepEqual(templateCandidate(c), c);
  assert.throws(() => editTemplate(c, { type: "add", ref: ref("service.sms.success_count") }), /editor_panel_limit/);
  assert.equal(base.definition.panels.length, 3);
});
test("incomplete binding fields stay editable and unsupported JSON stays unmodified instead of losing fields", () => {
  const c = editTemplate(titled(), { type: "binding", binding: { panelId: "panel-1", kind: "aggregate", sourceId: "", mappingId: "" } });
  assert.deepEqual(editableTemplate(JSON.stringify(c)), c); assert.throws(() => templateCandidate(c));
  for (const raw of ["{", JSON.stringify({ ...c, tenantId: "forbidden" }), JSON.stringify({ ...c, kind: ["page"] }),
    JSON.stringify({ ...c, definition: { ...c.definition, futureField: true } }),
    JSON.stringify({ ...c, definition: { ...c.definition, bindings: [c.definition.bindings[0]] } })]) {
    const original = raw; assert.equal(editableTemplate(raw), null); assert.equal(raw, original);
  }
});
