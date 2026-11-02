import { test } from "node:test";
import assert from "node:assert/strict";
import type { Pool } from "pg";
import { aggregateGaugePeriod, bindGaugeCompletion, gaugePolicy, type GaugePlan, type GaugeInput } from "./gauge-period.ts";
import { mappingSetFingerprint } from "./intervals.ts";
import { PgGaugeAggregateStore } from "./pg-gauge-store.ts";
import { publishGaugeAggregate } from "./gauge-service.ts";
import { createRegistry } from "../catalog/registry.ts";
import { FIRST_METRICS } from "../catalog/first-metrics.ts";
import { normalizeDraft } from "../measurements/rules.ts";
import type { MeasurementDraft } from "../measurements/store.ts";

const metric = { code: "runtime.environment.temperature_c", version: 1 }, start = Date.parse("2026-10-24T16:00:00Z");
const at = (n: number) => new Date(start + n * 60000).toISOString();
const plan: GaugePlan = { semantic: "gauge", workspaceId: "w", sourceId: "src", subjectKey: "physical-sensor", authorityVersion: "reviewed-v1", metric,
  grain: "hour", nativeGrain: "15m", period: { start: at(0), end: at(60) }, policy: { version: 1, mode: "sample_mean", authorityRef: "fixture:reviewed", scale: 3 },
  mappingPeriods: [{ mappingId: "map", mappingVersion: "1", period: { start: at(0), end: at(60) } }], sourceComplete: false, watermark: at(0) };
const row = (slot: number, unscaled = "25000", patch: Partial<GaugeInput> = {}): GaugeInput => ({ workspaceId: "w", sourceId: "src", subjectKey: "physical-sensor", metric,
  eventId: "sample:" + slot, componentKey: "temperature", revision: "1", qualityRevision: "1", quality: "verified", payloadSha256: "a".repeat(64),
  mappingId: "map", mappingVersion: "1", transformVersion: "v1", period: { start: at(slot * 15), end: at((slot + 1) * 15) }, unscaled, scale: 3, ...patch });
const rows = [row(0, "-9007199254740993"), row(1, "9007199254740995"), row(2, "100"), row(3, "-100")];
test("gauge summaries preserve signed fixed precision, extrema times and sample-mean semantics", () => {
  const r = aggregateGaugePeriod(plan, rows); assert.equal(r.completeness, "preliminary"); assert.equal(r.validWindows, 4);
  assert.deepEqual(r.value!.mean, { numerator: "2", denominator: "4" }); assert.equal(r.value!.scale, 3); assert.equal(r.coveredMilliseconds, null);
  assert.deepEqual(r.value!.minimum, { unscaled: "-9007199254740993", observedAt: at(0) }); assert.equal(r.value!.maximum.observedAt, at(15));
  assert.equal(aggregateGaugePeriod(plan, [...rows].reverse()).inputFingerprint, r.inputFingerprint);
  const offsetPlan = { ...plan, mappingPeriods: [{ ...plan.mappingPeriods[0]!, period: { start: "2026-10-25T00:00:00+08:00", end: "2026-10-25T01:00:00+08:00" } }] };
  assert.equal(aggregateGaugePeriod(offsetPlan, rows).inputFingerprint, r.inputFingerprint);
});
test("time-weighted gauges require reviewed duration evidence and never infer it from sample frequency", () => {
  assert.throws(() => gaugePolicy({ ...plan.policy, mode: "time_weighted" }));
  assert.throws(() => gaugePolicy({ ...plan.policy, durationRef: "unnecessary" }));
  const r = aggregateGaugePeriod({ ...plan, policy: { ...plan.policy, mode: "time_weighted", durationRef: "fixture:explicit-window-validity" } }, rows);
  assert.deepEqual(r.value!.mean, { numerator: "1800000", denominator: "3600000" }); assert.equal(r.coveredMilliseconds, "3600000");
  assert.equal(aggregateGaugePeriod(plan, []).value, null); assert.equal(aggregateGaugePeriod(plan, []).completeness, "missing");
});
test("gauge fact and quality revisions replace old samples and cannot revive rejected evidence", () => {
  const corrected = row(0, "1000", { revision: "2" }), rejected = { ...corrected, qualityRevision: "2", quality: "rejected" as const };
  const result = aggregateGaugePeriod(plan, [...rows, corrected, rejected]); assert.equal(result.validWindows, 3); assert.equal(result.completeness, "partial");
  assert.ok(result.reasons.includes("rejected_quality")); assert.equal(result.evidence.find(e => e.eventId === row(0).eventId)!.revision, "2");
  assert.throws(() => aggregateGaugePeriod(plan, [row(0), row(0, "1")]), /conflicting_replay/);
  assert.throws(() => aggregateGaugePeriod(plan, [row(0), row(0, "1", { eventId: "other" })]), /overlapping_authority_evidence/);
});
test("gauge scope, scale, mapping ownership, native grid and coarse inputs are independently enforced", () => {
  for (const patch of [{ sourceId: "foreign" }, { subjectKey: "foreign" }, { scale: 2 }, { mappingVersion: "2" }, { unscaled: "1e3" }])
    assert.throws(() => aggregateGaugePeriod(plan, [row(0, "1", patch)]));
  assert.throws(() => aggregateGaugePeriod(plan, [row(0, "1", { period: { start: at(0), end: at(60) } })]), /unexpected_or_coarse_window/);
  assert.throws(() => aggregateGaugePeriod({ ...plan, mappingPeriods: [{ ...plan.mappingPeriods[0]!, period: { start: at(5), end: at(60) } }] }, []), /mapping_boundary/);
  const switched = { ...plan, mappingPeriods: [{ ...plan.mappingPeriods[0]!, period: { start: at(0), end: at(30) } }, { mappingId: "next", mappingVersion: "2", period: { start: at(30), end: at(60) } }] };
  assert.equal(aggregateGaugePeriod(switched, rows.map((r, i) => i < 2 ? r : { ...r, mappingId: "next", mappingVersion: "2" })).validWindows, 4);
});
test("gauge completion binds all windows, policy and quality while never filling missing samples", () => {
  const base = aggregateGaugePeriod(plan, rows), proof = { revision: "1", status: "confirmed" as const, inputFingerprint: base.inputFingerprint,
    mappingSet: { version: 1 as const, sha256: mappingSetFingerprint(base.mappingWindows) }, watermark: at(60), evidenceRef: "fixture:proof", evidenceSha256: "b".repeat(64) };
  assert.equal(aggregateGaugePeriod(bindGaugeCompletion(plan, rows, proof), rows).completeness, "complete");
  assert.equal(aggregateGaugePeriod(bindGaugeCompletion(plan, rows, { ...proof, revision: "2", status: "revoked", watermark: at(0) }), rows).completeness, "preliminary");
  const partial = rows.slice(1), p = aggregateGaugePeriod(plan, partial), pProof = { ...proof, inputFingerprint: p.inputFingerprint };
  assert.equal(aggregateGaugePeriod(bindGaugeCompletion(plan, partial, pProof), partial).completeness, "partial");
  assert.equal(aggregateGaugePeriod(bindGaugeCompletion({ ...plan, policy: { ...plan.policy, authorityRef: "changed" } }, rows, proof), rows).completeness, "preliminary");
});
test("gauge dictionaries and ingestion reject unsafe sums, false attribution and lossy decimal values", () => {
  const definition = FIRST_METRICS.get(metric)!;
  for (const patch of [{ objectAggregation: "disjoint_sum" as const }, { timeAggregation: "sum" as const }, { attribution: "service_required" as const }])
    assert.throws(() => createRegistry([{ ...definition, ...patch }]));
  const draft: MeasurementDraft = { workspaceId: "w", sourceId: "src", eventId: "e", revision: "1", previousRevision: null, payloadSha256: "a".repeat(64), payloadUri: "fixture:payload", occurredAt: at(0), metric,
    componentKey: "temperature", stationId: "st", mappingId: "map", transformVersion: "1", periodStart: at(0), periodEnd: at(15), value: { kind: "fixed_point", unscaled: "-9007199254740993", scale: 3 },
    quality: { status: "verified", ruleVersion: "1", reason: "fixture", decidedBy: "worker" } };
  assert.deepEqual(normalizeDraft(draft, FIRST_METRICS).value, draft.value);
  for (const value of [{ kind: "fixed_point", unscaled: "1.5", scale: 1 }, { kind: "fixed_point", unscaled: "1", scale: 10 }, { kind: "integer_delta", value: "25" }])
    assert.throws(() => normalizeDraft({ ...draft, value } as MeasurementDraft, FIRST_METRICS));
});
test("gauge publication requires explicit write permission and rejects other metric semantics before database I/O", async () => {
  let calls = 0; const pool = { async connect() { calls++; throw Error("unexpected_io"); }, async query() { calls++; throw Error("unexpected_io"); } } as unknown as Pool;
  const store = new PgGaugeAggregateStore(pool, { workspaceId: "w", series: [{ sourceId: "src", subjectKey: plan.subjectKey, metricKey: metric.code + "@1" }] });
  const context = { workspaceId: "w", sub: "worker", features: new Set(["metering"]), permissions: new Set(["metering.view"]) };
  await assert.rejects(publishGaugeAggregate(context, store, plan, [], null), /permission_denied/);
  await assert.rejects(store.publish({ ...plan, metric: { code: "runtime.device.state", version: 1 } }, [], null, "worker"), /scope_denied|unsupported/);
  assert.equal(calls, 0);
});
