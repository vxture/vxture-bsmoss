import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregateIntervals, type AggregationPlan, type CompletionEvidence, type IntervalInput } from "./intervals.ts";
import { bindSourceCompletion } from "./completion.ts";

const time = (m: number) => new Date(Date.parse("2026-10-25T00:00:00+08:00") + m * 60000).toISOString();
const plan: AggregationPlan = { workspaceId: "w", sourceId: "src", subjectKey: "st/svc/cell", authorityVersion: "authority-1",
  metric: { code: "service.data.uplink_bytes", version: 1 }, inputMode: "direct", grain: "hour", nativeGrain: "15m",
  period: { start: time(0), end: time(60) }, watermark: time(0), sourceComplete: false };
const rows: IntervalInput[] = Array.from({ length: 4 }, (_, i) => ({ workspaceId: "w", sourceId: "src", subjectKey: plan.subjectKey,
  metric: plan.metric, eventId: "e" + i, componentKey: "up", revision: "1", qualityRevision: "1", quality: "verified",
  payloadSha256: "a".repeat(64), mappingVersion: "1", transformVersion: "1", period: { start: time(i * 15), end: time((i + 1) * 15) }, value: { kind: "integer_delta", value: "10" } }));
const evidence = (p = plan, inputs = rows): CompletionEvidence => ({ revision: "1", status: "confirmed", inputFingerprint: aggregateIntervals(p, inputs).inputFingerprint,
  watermark: time(60), evidenceRef: "fixture://source-confirmation", evidenceSha256: "b".repeat(64) });
test("source completion requires matching evidence, sufficient watermark and all valid windows", () => {
  const e = evidence(); const bound = bindSourceCompletion(plan, rows, e), result = aggregateIntervals(bound, rows);
  assert.equal(result.completeness, "complete"); assert.equal(bound.watermark, time(60)); assert.deepEqual(result.completionEvidence, e);
  assert.equal(aggregateIntervals(bindSourceCompletion(plan, rows), rows).completeness, "preliminary");
  assert.notEqual(result.inputFingerprint, aggregateIntervals(plan, rows).inputFingerprint);
  assert.equal(plan.sourceComplete, false); assert.equal(plan.completionEvidence, undefined);
  assert.equal(e.watermark, time(60));
});
test("completion proof is stable under reordering/replay and retained in reproducible results", () => {
  const e = evidence(), duplicates = [...rows].reverse().concat(rows[0]!);
  const first = aggregateIntervals(bindSourceCompletion(plan, rows, e), rows);
  const replay = aggregateIntervals(bindSourceCompletion(plan, duplicates, e), duplicates);
  assert.deepEqual(first, replay);
});
test("measurement or quality revision invalidates earlier completion instead of approving new evidence", () => {
  for (const patch of [{ revision: "2", payloadSha256: "c".repeat(64) }, { qualityRevision: "2" }, { qualityRevision: "2", quality: "pending" as const }]) {
    const changed = rows.map((r, i) => i === 0 ? { ...r, ...patch } : r);
    const bound = bindSourceCompletion(plan, changed, evidence());
    const result = aggregateIntervals(bound, changed);
    assert.equal(bound.sourceComplete, false); assert.equal(bound.watermark, time(0));
    assert.ok(result.reasons.includes("source_confirmation_stale")); assert.notEqual(result.completeness, "complete");
  }
});
test("authority, transform and mapping changes invalidate source confirmation", () => {
  const e = evidence();
  const changedPlan = { ...plan, authorityVersion: "authority-2" };
  assert.ok(aggregateIntervals(bindSourceCompletion(changedPlan, rows, e), rows).reasons.includes("source_confirmation_stale"));
  for (const patch of [{ transformVersion: "2" }, { mappingVersion: "2" }]) {
    const changed = rows.map(r => ({ ...r, ...patch }));
    assert.equal(bindSourceCompletion(plan, changed, e).sourceComplete, false);
  }
});
test("confirmation cannot manufacture missing or pending windows", () => {
  for (const inputs of [rows.slice(0, 2), [] as IntervalInput[], rows.map(r => ({ ...r, quality: "pending" as const }))]) {
    const result = aggregateIntervals(bindSourceCompletion(plan, inputs, evidence(plan, inputs)), inputs);
    assert.notEqual(result.completeness, "complete"); assert.ok(["partial", "missing"].includes(result.completeness));
  }
});
test("revocation clears completion while preserving prior evidence reference", () => {
  const revoked = { ...evidence(), revision: "2", status: "revoked" as const, watermark: time(0) };
  const bound = bindSourceCompletion(plan, rows, revoked), result = aggregateIntervals(bound, rows);
  assert.equal(bound.sourceComplete, false); assert.equal(result.completeness, "preliminary");
  assert.ok(result.reasons.includes("source_confirmation_revoked")); assert.equal(result.completionEvidence?.revision, "2");
  assert.deepEqual(bindSourceCompletion(bindSourceCompletion(plan, rows, evidence()), rows, revoked), bound);
});
test("invalid completion evidence, insufficient watermarks and forged completed plans fail closed", () => {
  for (const patch of [{ revision: "0" }, { evidenceRef: "*" }, { evidenceSha256: "invalid" }, { inputFingerprint: "invalid" },
    { watermark: time(30) }, { status: "unknown" }, { status: "revoked", watermark: time(-15) }]) {
    assert.throws(() => bindSourceCompletion(plan, rows, { ...evidence(), ...patch } as CompletionEvidence));
  }
  const stale = { ...evidence(), inputFingerprint: "f".repeat(64) };
  assert.throws(() => aggregateIntervals({ ...plan, sourceComplete: true, watermark: time(60), completionEvidence: stale }, rows), /completion_binding_mismatch/);
  assert.throws(() => aggregateIntervals({ ...plan, completionEvidence: evidence() }, rows), /completion_binding_mismatch/);
});
