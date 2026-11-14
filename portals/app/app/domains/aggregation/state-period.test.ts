import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregateStatePeriod, bindStateCompletion, type StatePlan, type StateInput } from "./state-period.ts";
import { mappingSetFingerprint, type CompletionEvidence } from "./intervals.ts";
import { publishStateAggregate, readStateAggregate } from "./state-service.ts";
import type { StateAggregateStore } from "./state-store.ts";
import type { Pool } from "pg";
import { PgStateSnapshotReader } from "./pg-state-snapshot.ts";
import { PgStateAggregateStore } from "./pg-state-store.ts";
import { PgAggregateStore } from "./pg-store.ts";

const time = (m: number) => new Date(Date.parse("2026-10-25T00:00:00+08:00") + m * 60000).toISOString();
const plan: StatePlan = { semantic: "state", workspaceId: "w", sourceId: "s", subjectKey: "device", authorityVersion: "v1",
  metric: { code: "runtime.device.state", version: 1 }, grain: "hour", nativeGrain: "event", period: { start: time(0), end: time(60) },
  maxHoldMilliseconds: 3600000, mappingPeriods: [{ mappingId: "map", mappingVersion: "1", period: { start: time(-120), end: time(120) } }],
  sourceComplete: false, watermark: time(0) };
const row = (id: string, at: number, until: number, state: StateInput["state"], patch: Partial<StateInput> = {}): StateInput => ({
  workspaceId: "w", sourceId: "s", subjectKey: "device", metric: plan.metric, eventId: id, componentKey: "status", revision: "1", qualityRevision: "1", quality: "verified",
  payloadSha256: "a".repeat(64), mappingId: "map", mappingVersion: "1", transformVersion: "1", at: time(at), validUntil: time(until), state, ...patch });
function proof(p: StatePlan, inputs: StateInput[]): CompletionEvidence {
  const base = aggregateStatePeriod(p, inputs);
  return { revision: "1", status: "confirmed", inputFingerprint: base.inputFingerprint, watermark: p.period.end,
    mappingSet: { version: 1, sha256: mappingSetFingerprint(base.mappingWindows) }, evidenceRef: "fixture://state-completion", evidenceSha256: "b".repeat(64) };
}
test("state periods retain bounded carry-in, unknown expiry and exact duration conservation", () => {
  const inputs = [row("before", -10, 20, "running"), row("fault", 10, 35, "fault"), row("back", 45, 60, "running")];
  const result = aggregateStatePeriod(plan, inputs);
  assert.equal(result.value.durationMilliseconds.running, "1500000"); assert.equal(result.value.durationMilliseconds.fault, "1500000");
  assert.equal(result.value.durationMilliseconds.unknown, "600000"); assert.equal(result.value.knownTransitions, 1); assert.equal(result.value.gapTransitions, 2);
  assert.equal(result.completeness, "partial"); assert.equal(result.knownMilliseconds, "3000000");
  assert.equal(Object.values(result.value.durationMilliseconds).reduce((n, v) => n + BigInt(v), 0n), 3600000n);
  assert.deepEqual(aggregateStatePeriod(plan, [...inputs].reverse().concat(inputs[0]!)), result);
});
test("state source confirmation is exact, cannot fill unknown time, and latest revocation is reproducible", () => {
  const inputs = [row("whole", 0, 60, "running")], e = proof(plan, inputs);
  assert.equal(aggregateStatePeriod(plan, inputs).completeness, "preliminary");
  const bound = bindStateCompletion(plan, inputs, e); assert.equal(aggregateStatePeriod(bound, inputs).completeness, "complete");
  const revoked = { ...e, revision: "2", status: "revoked" as const, watermark: time(0) };
  const result = aggregateStatePeriod(bindStateCompletion(bound, inputs, revoked), inputs);
  assert.equal(result.completeness, "preliminary"); assert.ok(result.reasons.includes("source_confirmation_revoked"));
  for (const partial of [[], [row("short", 0, 20, "running")], [row("unknown", 0, 60, "unknown")]]) {
    const r = aggregateStatePeriod(bindStateCompletion(plan, partial, proof(plan, partial)), partial);
    assert.notEqual(r.completeness, "complete"); assert.ok(r.reasons.includes("unknown_state_time"));
  }
  assert.throws(() => aggregateStatePeriod({ ...plan, sourceComplete: true, watermark: time(60) }, inputs), /completion_binding_mismatch/);
});
test("state latest quality and revisions invalidate proof while preserving rich provenance", () => {
  const inputs = [row("whole", 0, 60, "running")], e = proof(plan, inputs);
  for (const changed of [[...inputs, row("whole", 0, 60, "running", { qualityRevision: "2", quality: "pending" })],
    [row("whole", 0, 60, "fault", { revision: "2", payloadSha256: "c".repeat(64) })]]) {
    const result = aggregateStatePeriod(bindStateCompletion(plan, changed, e), changed);
    assert.notEqual(result.completeness, "complete"); assert.ok(result.reasons.includes("source_confirmation_stale")); assert.equal(result.evidence.length, 1);
    assert.equal(result.evidence[0]!.mappingId, "map"); assert.equal(result.evidence[0]!.componentKey, "status");
  }
  assert.throws(() => aggregateStatePeriod(plan, [...inputs, row("whole", 0, 60, "fault")]), /conflicting_replay/);
});
test("event mapping boundaries need no interval grid and proof binds the entire mapping set", () => {
  const p: StatePlan = { ...plan, mappingPeriods: [{ mappingId: "a", mappingVersion: "1", period: { start: time(-60), end: time(17) } },
    { mappingId: "b", mappingVersion: "2", period: { start: time(17), end: time(120) } }] };
  const inputs = [row("a", 0, 17, "running", { mappingId: "a" }), row("b", 17, 60, "standby", { mappingId: "b", mappingVersion: "2" })];
  const e = proof(p, inputs), result = aggregateStatePeriod(bindStateCompletion(p, inputs, e), inputs);
  assert.equal(result.completeness, "complete"); assert.equal(result.value.durationMilliseconds.standby, String(43 * 60000));
  const missing = aggregateStatePeriod(p, inputs.slice(0, 1)); assert.equal(missing.value.durationMilliseconds.unknown, String(43 * 60000));
  const wrong = { ...e, mappingSet: { version: 1 as const, sha256: "0".repeat(64) } };
  assert.equal(bindStateCompletion(p, inputs, wrong).sourceComplete, false);
  assert.throws(() => aggregateStatePeriod(p, [row("cross", 0, 30, "running", { mappingId: "a" })]), /measurement_mapping_mismatch/);
});
test("state conflicts and expired or pending superseding events never revive older running state", () => {
  const base = row("base", -30, 30, "running");
  const superseded = aggregateStatePeriod(plan, [base, row("later", -10, -5, "fault")]);
  assert.equal(superseded.value.durationMilliseconds.unknown, "3600000");
  const pending = aggregateStatePeriod(plan, [row("base", 0, 60, "running"), row("later", 10, 20, "fault", { quality: "pending" })]);
  assert.equal(pending.value.durationMilliseconds.unknown, String(50 * 60000));
  const conflict = aggregateStatePeriod(plan, [row("one", 0, 60, "running"), row("two", 0, 60, "fault")]);
  assert.equal(conflict.conflictCount, 1); assert.equal(conflict.completeness, "missing"); assert.ok(conflict.reasons.includes("conflicting_state_events"));
});
test("state boundaries, trusted policy and proof fields fail closed", () => {
  for (const patch of [{ maxHoldMilliseconds: 0 }, { maxHoldMilliseconds: 86400001 }, { metric: { code: "service.data.uplink_bytes", version: 1 } },
    { period: { start: time(1), end: time(61) } }, { authorityVersion: "*" }]) assert.throws(() => aggregateStatePeriod({ ...plan, ...patch }, []));
  for (const event of [row("long", 0, 61, "running"), row("old", -61, -2, "running"), row("end", 60, 61, "running"), row("foreign", 0, 60, "running", { sourceId: "foreign" })]) assert.throws(() => aggregateStatePeriod(plan, [event]));
  const inputs = [row("whole", 0, 60, "running")], e = proof(plan, inputs);
  for (const patch of [{ revision: "0" }, { watermark: time(30) }, { mappingSet: undefined }, { evidenceSha256: "bad" }]) assert.throws(() => bindStateCompletion(plan, inputs, { ...e, ...patch }));
  assert.throws(() => bindStateCompletion({ ...plan, period: { start: time(1), end: time(60) } }, [], e), /unaligned_target_window/);
});
test("state services and adapters check feature, permission and scope before I/O", async () => {
  let calls = 0; const pool = { async connect() { calls++; throw Error("unexpected_io"); }, async query() { calls++; throw Error("unexpected_io"); } } as unknown as Pool;
  const scope = { workspaceId: "w", sourceIds: ["s"], stationIds: ["station"], serviceIds: [], deviceIds: ["dev"], metricKeys: ["runtime.device.state@1"], allowSiteParameters: false };
  const reader = new PgStateSnapshotReader(pool, scope), store = new PgStateAggregateStore(pool, { workspaceId: "w", series: [] });
  await assert.rejects(reader.load({ sourceId: "foreign", mappingId: "map", metric: plan.metric, at: time(0), grain: "hour" }), /aggregate_scope_denied/);
  await assert.rejects(store.publish(plan, [], null, "actor"), /aggregate_scope_denied/);
  const allowed = { workspaceId: "w", series: [{ sourceId: "s", subjectKey: "device", metricKey: "runtime.device.state@1" },
    { sourceId: "s", subjectKey: "device", metricKey: "service.data.uplink_bytes@1" }] };
  await assert.rejects(new PgAggregateStore(pool, allowed).current(plan), /unsupported_aggregate_metric/);
  await assert.rejects(new PgStateAggregateStore(pool, allowed).current({ ...plan, metric: { code: "service.data.uplink_bytes", version: 1 } }), /unsupported_state_metric/);
  const stub = { workspaceId: "w", async publish() { calls++; throw Error("unexpected_io"); }, async current() { calls++; return null; }, async readRevision() { calls++; return null; } } as StateAggregateStore;
  const ctx = { workspaceId: "w", sub: "worker", features: new Set(["metering"]), permissions: new Set(["metering.view"]) };
  await assert.rejects(publishStateAggregate(ctx, stub, plan, [], null), /permission_denied/);
  await assert.rejects(readStateAggregate({ ...ctx, features: new Set<string>() }, stub, plan), /feature_denied/);
  await assert.rejects(readStateAggregate({ ...ctx, workspaceId: "foreign" }, stub, plan), /workspace_mismatch/);
  assert.equal(calls, 0);
});
