import { test } from "node:test";
import assert from "node:assert/strict";
import { fingerprintOf } from "../aggregation/intervals.ts";
import { reportManifest, type ReportTemplate } from "./rules.ts";
import { historyBindingUnavailable, reportHistoryManifest } from "./history.ts";
import type { StoredReport } from "./store.ts";
import type { ReportSchedule } from "./schedule.ts";

const at = "2026-07-05T16:00:00.000Z", clock = "2026-11-03T00:10:00.000Z", sha = "a".repeat(64);
const scope = { workspaceId: "w", sourceIds: [], stationIds: [], serviceIds: [], deviceIds: [], metricKeys: ["service.sms.success_count@1"], allowSiteParameters: false };
const definition: ReportTemplate = { schema: "periodic-report-template-v1", title: "SMS report", grain: "day",
  panels: [{ id: "sms", metricRef: { code: "service.sms.success_count", version: 1 }, category: "business_service", view: "card", grain: "day", displayUnit: "count", order: 0, precision: 0, visible: true }],
  bindings: [{ panelId: "sms", kind: "not_connected" }] };
const manifest = reportManifest("w", "sms", 1, definition, at, [{ panelId: "sms", data: { kind: "not_connected" }, dailyDependencies: [], requiredScope: scope }]);
const original: StoredReport = { reportId: "report", revision: "9007199254740993", currentRevision: "9007199254740993", manifest,
  manifestSha256: fingerprintOf(manifest), generatedBy: "worker", generatedAt: at };
const schedule: ReportSchedule = { workspaceId: "w", id: "schedule", revision: "1", subject: "worker", status: "active", scope,
  templateCode: "sms", templateVersion: 1, templateSha256: fingerprintOf(definition), grain: "day", notBefore: at, delayMinutes: 480, lookbackHours: 72 };
test("history checks pin the exact existing report and current reviewed registration beyond calendar lookback", () => {
  const snapshot = structuredClone(original), record = reportHistoryManifest(schedule, sha, clock, original, { freshness: "current", reasons: [] }, "unchanged", original);
  assert.equal(record.scanHour, "2026-11-03T00:00:00.000Z"); assert.equal(record.original.revision, "9007199254740993");
  assert.equal(record.outcome, "unchanged"); assert.equal(original.manifest.dataCompleteness, "incomplete"); assert.deepEqual(original, snapshot);
  assert.equal(record.failureCode, null); assert.deepEqual(record.requiredScope, scope);
});
test("regeneration receipts preserve exact revisions and normalize reasons without implying publication or completeness", () => {
  const next = { ...original, revision: "9007199254740994", currentRevision: "9007199254740994" };
  const r = reportHistoryManifest(schedule, sha, clock, original, { freshness: "stale", reasons: ["z", "a", "z"] }, "inserted", next);
  assert.equal(r.result.revision, next.revision); assert.deepEqual(r.before.reasons, ["a", "z"]); assert.equal(r.outcome, "inserted");
  assert.ok(!("published" in r)); assert.equal(next.manifest.dataCompleteness, "incomplete");
  assert.throws(() => reportHistoryManifest(schedule, sha, clock, original, r.before, "inserted", { ...next, revision: "9007199254740995" }), /history_outcome/);
});
test("an old duplicate result cannot masquerade as a head rollback or a new generated revision", () => {
  const old = { ...original, revision: "9007199254740992" }, before = { freshness: "stale" as const, reasons: ["template_definition_changed"] };
  const r = reportHistoryManifest(schedule, sha, clock, original, before, "duplicate", old);
  assert.equal(r.result.revision, old.revision); assert.equal(r.result.currentRevision, original.revision);
  assert.throws(() => reportHistoryManifest(schedule, sha, clock, original, before, "duplicate", { ...old, currentRevision: old.revision }), /history_outcome/);
});
test("unavailable bindings keep original evidence and cannot be recorded as unchanged", () => {
  const before = { freshness: "unavailable" as const, reasons: ["report_binding_unavailable"] };
  const r = reportHistoryManifest(schedule, sha, clock, original, before, "blocked", original); assert.equal(r.failureCode, "report_binding_unavailable");
  assert.throws(() => reportHistoryManifest(schedule, sha, clock, original, before, "unchanged", original), /history_outcome/);
  assert.throws(() => reportHistoryManifest(schedule, sha, clock, original, { freshness: "current", reasons: [] }, "blocked", original), /history_outcome/);
});
test("history checks reject mismatched templates tenants periods unpublished windows and malformed conclusions", () => {
  for (const patch of [{ workspaceId: "other" }, { templateCode: "other" }, { templateVersion: 2 }, { notBefore: "2026-07-06T16:00:00.000Z" }])
    assert.throws(() => reportHistoryManifest({ ...schedule, ...patch }, sha, clock, original, { freshness: "current", reasons: [] }, "unchanged", original));
  assert.throws(() => reportHistoryManifest(schedule, sha, at, original, { freshness: "current", reasons: [] }, "unchanged", original), /history_binding/);
  for (const before of [{ freshness: "current", reasons: ["bad"] }, { freshness: "stale", reasons: [] }, { freshness: "current", reasons: [], forged: true }])
    assert.throws(() => reportHistoryManifest(schedule, sha, clock, original, before as never, "unchanged", original));
  assert.throws(() => reportHistoryManifest(schedule, "bad", clock, original, { freshness: "current", reasons: [] }, "unchanged", original));
});

test("only reviewed binding availability failures become blocked history evidence", () => {
  for (const message of ["aggregate_mapping_unavailable", "report_rollup_unavailable", "rollup_paused", "rollup_atom_unavailable", "rollup_mapping_coverage_mismatch", "rollup_ratio_basis_mismatch"])
    assert.equal(historyBindingUnavailable(Error(message)), true);
  for (const error of [Error("report_scope_denied"), Error("invalid_report_record"), Error("private connector content"), { code: "42501" }, { code: "40001" }, { code: "42P01" }, null])
    assert.equal(historyBindingUnavailable(error), false);
});
