import { test } from "node:test";
import assert from "node:assert/strict";
import { FIRST_METRICS } from "../catalog/first-metrics.ts";
import { aggregateIntervals, fingerprintOf } from "../aggregation/intervals.ts";
import { bucketFor, nativeWindows } from "../aggregation/periods.ts";
import { reportManifest, normalizeReportTemplate, normalizeGenerateReport, normalizeReportQuery, validateReportManifest, assertReportScope,
  type ReportTemplate, type ReportObservation } from "./rules.ts";

const metric = { code: "service.data.uplink_bytes", version: 1 }, at = "2026-10-25T00:00:00Z", period = bucketFor(at, "day"), authority = "a".repeat(64);
const scope = { workspaceId: "w", sourceIds: ["src"], stationIds: ["st"], serviceIds: ["svc"], deviceIds: [], metricKeys: [metric.code + "@1"], allowSiteParameters: false };
function template(): ReportTemplate {
  return { schema: "periodic-report-template-v1", title: "Fixture report", grain: "day", panels: [{ id: "usage", category: "business_service", metricRef: metric, view: "card", grain: "day", displayUnit: "B", precision: 2, order: 0, visible: true }], bindings: [{ panelId: "usage", kind: "aggregate", sourceId: "src", mappingId: "map" }] };
}
function observation(): ReportObservation {
  const result = aggregateIntervals({ workspaceId: "w", sourceId: "src", subjectKey: "subject", authorityVersion: authority, metric,
    inputMode: "direct", grain: "day", nativeGrain: "day", period, sourceComplete: true, watermark: period.end }, [{ workspaceId: "w", sourceId: "src", subjectKey: "subject", metric, eventId: "event", componentKey: "value", revision: "1", qualityRevision: "1", quality: "verified", payloadSha256: authority, mappingVersion: "1", transformVersion: "v1", period, value: { kind: "integer_delta", value: "90071992547409931234567890" } }]);
  return { panelId: "usage", requiredScope: scope, dailyDependencies: [], data: { kind: "aggregate", authorityVersion: authority, query: { sourceId: "src", mappingId: "map", metric, grain: "day", at: period.start }, publication: { seriesId: "series", revision: "1", currentRevision: "1", publishedBy: "worker", createdAt: period.end, selection: "current", freshness: "current", currentInputFingerprint: result.inputFingerprint, reasons: [], result } } };
}
const build = (t = template(), o = observation()) => reportManifest("w", "report", 1, t, at, [o]);
test("report snapshot keeps exact source values, complete evidence and original template in a deterministic manifest", () => {
  const t = template(), o = observation(), m = build(t, o);
  assert.equal(m.status, "generated"); assert.equal(m.dataCompleteness, "complete"); assert.equal(m.watermark, period.end);
  assert.equal(m.items[0]!.data.kind, "aggregate"); assert.ok(JSON.stringify(m).includes("90071992547409931234567890"));
  assert.deepEqual(m.template.definition, t); assert.equal(m.template.definitionSha256, fingerprintOf(t));
  assert.deepEqual(validateReportManifest(m), m); assert.equal(fingerprintOf(build(t, o)), fingerprintOf(m));
  t.title = "Changed"; assert.equal(m.template.definition.title, "Fixture report");
  assert.deepEqual(m.sections.map(s => s.status), ["included", "not_configured", "not_configured"]);
});
test("report configured hidden panels retain their missing state and cannot hide completeness gaps", () => {
  const t = template(); t.panels = [{ ...t.panels[0]!, visible: false }];
  const o = observation(); if (o.data.kind === "aggregate") o.data.publication = null;
  const m = build(t, o); assert.equal(m.items[0]!.status, "not_published"); assert.equal(m.dataCompleteness, "incomplete"); assert.equal(m.watermark, period.start);
  t.bindings = [{ panelId: "usage", kind: "not_connected" }];
  const disconnected = build(t, { ...o, data: { kind: "not_connected" } }); assert.equal(disconnected.items[0]!.status, "not_connected");
});
test("a verified locator with unavailable source authority remains explicit without asserting that no publication exists", () => {
  const o = observation(); if (o.data.kind !== "aggregate") throw Error("fixture");
  o.data.authorityVersion = null; o.data.publication = null;
  const m = build(template(), o); assert.equal(m.items[0]!.status, "authority_unavailable"); assert.equal(m.dataCompleteness, "incomplete"); assert.equal(m.watermark, period.start);
  assert.deepEqual(validateReportManifest(m), m);
});
test("report templates validate metric semantics, units, source bindings, period and bounded version selectors", () => {
  const t = template();
  for (const patch of [{ grain: "hour" }, { scope: scope }, { panels: [] }, { bindings: [{ panelId: "usage", kind: "aggregate", sourceId: "src", mappingId: "map", value: "1" }] }]) assert.throws(() => normalizeReportTemplate({ ...t, ...patch } as ReportTemplate));
  for (const patch of [{ category: "runtime_parameter" }, { displayUnit: "kWh" }, { metricRef: { code: "runtime.device.state", version: 1 }, category: "runtime_parameter", view: "ranking", displayUnit: "state" }]) assert.throws(() => normalizeReportTemplate({ ...t, panels: [{ ...t.panels[0], ...patch }] } as ReportTemplate));
  assert.throws(() => build(t, { ...observation(), panelId: "other" }), /observation_mismatch/);
  const command = { templateCode: "report", templateVersion: 1, at, expectedRevision: null };
  assert.equal(normalizeGenerateReport(command).at, "2026-10-25T00:00:00.000Z");
  for (const patch of [{ templateVersion: Number.MAX_SAFE_INTEGER + 1 }, { expectedRevision: "0" }, { at: "bad" }, { workspaceId: "forged" }]) assert.throws(() => normalizeGenerateReport({ ...command, ...patch }));
  assert.throws(() => normalizeReportQuery({ reportId: "id", revision: "0" }));
});
test("report stale publications remain evidence and never imply a complete current report", () => {
  const o = observation(); if (o.data.kind === "aggregate") o.data.publication!.freshness = "stale";
  const m = build(template(), o); assert.equal(m.capturedFreshness, "stale"); assert.equal(m.dataCompleteness, "incomplete"); assert.equal(m.items[0]!.status, "stale");
  const corrupted = structuredClone(m); corrupted.items[0]!.status = "complete"; assert.throws(() => validateReportManifest(corrupted), /invalid_report_manifest/);
});
test("report scope is a full finite union and never admits wildcard or a partially authorized historic report", () => {
  assertReportScope({ ...scope, stationIds: ["st", "unused"] }, scope);
  for (const patch of [{ stationIds: [] }, { sourceIds: [] }, { serviceIds: [] }, { metricKeys: [] }, { workspaceId: "other" }]) assert.throws(() => assertReportScope({ ...scope, ...patch }, scope), /scope_denied/);
  assert.throws(() => assertReportScope({ ...scope, sourceIds: ["*"] }, scope));
});
test("weekly and monthly report manifests require every exact daily publication dependency", () => {
  for (const grain of ["week", "month"] as const) {
    const t = template(); t.grain = grain; t.panels = [{ ...t.panels[0]!, grain }];
    const o = observation(); if (o.data.kind !== "aggregate") throw Error("fixture");
    const window = bucketFor(at, grain); o.data.query = { ...o.data.query, grain, at: window.start }; o.data.publication = null;
    assert.throws(() => build(t, o), /daily_dependencies_required/);
    o.dailyDependencies = nativeWindows(window, "day").map(day => ({ ...structuredClone(o.data), query: { sourceId: "src", mappingId: "map", metric, grain: "day", at: day.start } } as typeof o.data));
    const m = build(t, o); assert.equal(m.items[0]!.dailyDependencies.length, grain === "week" ? 7 : 31); assert.equal(m.dataCompleteness, "incomplete");
    assert.deepEqual(validateReportManifest(m), m);
    assert.ok(FIRST_METRICS.get(metric));
  }
});
