import { test } from "node:test";
import assert from "node:assert/strict";
import type { Pool } from "pg";
import type { AccessContext } from "../shared/model.ts";
import { PgAggregateStore } from "./pg-store.ts";
import { publishIntervalAggregate, readIntervalAggregate } from "./service.ts";
import type { AggregateKey, AggregateStore } from "./store.ts";
import type { AggregationPlan } from "./intervals.ts";

const key: AggregateKey = { sourceId: "src", subjectKey: "st/svc/cell", metric: { code: "service.data.uplink_bytes", version: 1 },
  grain: "hour", period: { start: "2026-10-24T16:00:00Z", end: "2026-10-24T17:00:00Z" } };
const plan: AggregationPlan = { ...key, workspaceId: "w", authorityVersion: "v1", inputMode: "direct", nativeGrain: "15m", watermark: key.period.end, sourceComplete: true };
const ctx: AccessContext = { workspaceId: "w", sub: "trusted-worker", features: new Set(["metering"]), permissions: new Set(["metering.aggregate", "metering.view"]) };
function fixture() {
  const calls: unknown[][] = [];
  const store: AggregateStore = { workspaceId: "w", async publish(...args) { calls.push(args); return { status: "inserted", seriesId: "s", revision: "1", currentRevision: "1" }; },
    async current(...args) { calls.push(["current", ...args]); return null; }, async readRevision(...args) { calls.push(["revision", ...args]); return null; } };
  return { store, calls };
}
test("aggregate service requires entitlement and distinct publish/read permissions before store access", async () => {
  const { store, calls } = fixture();
  for (const c of [{ ...ctx, features: new Set<string>() }, { ...ctx, permissions: new Set(["metering.ingest"]) }, { ...ctx, sub: "" }]) {
    await assert.rejects(publishIntervalAggregate(c, store, plan, [], null), /denied|required/);
    await assert.rejects(readIntervalAggregate(c, store, key), /denied|required/);
  }
  await assert.rejects(publishIntervalAggregate({ ...ctx, permissions: new Set(["metering.view"]) }, store, plan, [], null), /permission_denied/);
  await assert.rejects(readIntervalAggregate({ ...ctx, permissions: new Set(["metering.aggregate"]) }, store, key), /permission_denied/);
  assert.equal(calls.length, 0);
});
test("aggregate service refuses context/store/plan workspace mismatch", async () => {
  const { store, calls } = fixture();
  await assert.rejects(publishIntervalAggregate(ctx, store, { ...plan, workspaceId: "other" }, [], null), /workspace_mismatch/);
  await assert.rejects(publishIntervalAggregate({ ...ctx, workspaceId: "other" }, store, plan, [], null), /workspace_mismatch/);
  await assert.rejects(readIntervalAggregate({ ...ctx, workspaceId: "other" }, store, key), /workspace_mismatch/);
  assert.equal(calls.length, 0);
});
test("aggregate service derives actor from identity and selects current or immutable historical revision", async () => {
  const { store, calls } = fixture();
  await publishIntervalAggregate(ctx, store, plan, [], "7");
  assert.deepEqual(calls[0], [plan, [], "7", "trusted-worker"]);
  await readIntervalAggregate(ctx, store, key);
  await readIntervalAggregate(ctx, store, key, "2");
  assert.deepEqual(calls.slice(1), [["current", key], ["revision", key, "2"]]);
});
test("aggregate adapter rejects Cartesian scope broadening and snapshots finite triples", async () => {
  let calls = 0;
  const pool = { query() { calls++; throw new Error("unexpected_query"); }, connect() { calls++; throw new Error("unexpected_query"); } } as unknown as Pool;
  const scope = { workspaceId: "w", series: [{ sourceId: "src", subjectKey: "a", metricKey: "service.data.uplink_bytes@1" }, { sourceId: "src2", subjectKey: "b", metricKey: "runtime.energy.site_wh@1" }] };
  const store = new PgAggregateStore(pool, scope);
  scope.series.push({ sourceId: "src", subjectKey: key.subjectKey, metricKey: "service.data.uplink_bytes@1" });
  await assert.rejects(store.current({ ...key, subjectKey: "b" }), /aggregate_scope_denied/);
  await assert.rejects(store.current(key), /aggregate_scope_denied/);
  await assert.rejects(store.publish(plan, [], null, ctx.sub), /aggregate_scope_denied/);
  assert.equal(calls, 0);
});
test("aggregate adapter validates target boundaries, revisions and computation before database access", async () => {
  let calls = 0;
  const pool = { query() { calls++; throw new Error("unexpected_query"); }, connect() { calls++; throw new Error("unexpected_query"); } } as unknown as Pool;
  const store = new PgAggregateStore(pool, { workspaceId: "w", series: [{ sourceId: "src", subjectKey: key.subjectKey, metricKey: "service.data.uplink_bytes@1" }] });
  await assert.rejects(store.current({ ...key, period: { ...key.period, end: "2026-10-24T16:30:00Z" } }), /unaligned_target_window/);
  await assert.rejects(store.readRevision(key, "0"), /invalid_revision/);
  await assert.rejects(store.publish(plan, [], "0", ctx.sub), /invalid_revision/);
  await assert.rejects(store.publish({ ...plan, workspaceId: "other" }, [], null, ctx.sub), /workspace_mismatch/);
  await assert.rejects(store.publish(plan, [], null, "*"), /invalid_aggregate_identity/);
  await assert.rejects(store.publish({ ...plan, nativeGrain: "day" }, [], null, ctx.sub), /coarse|native|grain/);
  assert.equal(calls, 0);
});
