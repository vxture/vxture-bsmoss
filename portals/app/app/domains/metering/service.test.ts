import { test } from "node:test";
import assert from "node:assert/strict";
import { ingestUsage } from "./service.ts";
import { MemoryUsageStore } from "./store.ts";
import type { AccessContext, UsageRecord } from "../shared/model.ts";
const ctx: AccessContext = { workspaceId: "w1", sub: "human", features: new Set(["metering"]), permissions: new Set(["metering.ingest"]) };
const r: UsageRecord = { workspaceId: "w1", sourceId: "s", sourceEventId: "e", stationId: "st", operator: "mobile", usageType: "voice", quantity: 60n, unit: "second", periodStart: "2026-10-01T00:00:00+08:00", periodEnd: "2026-10-01T01:00:00+08:00", quality: "verified" };
test("replays are idempotent and conflicting evidence is rejected", async () => {
  const store = new MemoryUsageStore();
  assert.equal(await ingestUsage(ctx, store, r), "inserted");
  assert.equal(await ingestUsage(ctx, store, r), "duplicate");
  await assert.rejects(ingestUsage(ctx, store, { ...r, quantity: 61n }), /conflicting_replay/);
  assert.equal((await store.list("w2")).length, 0);
});
test("both gates and workspace isolation precede ingestion", async () => {
  const store = new MemoryUsageStore();
  await assert.rejects(ingestUsage({ ...ctx, features: new Set() }, store, r), /feature_denied/);
  await assert.rejects(ingestUsage({ ...ctx, permissions: new Set() }, store, r), /permission_denied/);
  await assert.rejects(ingestUsage(ctx, store, { ...r, workspaceId: "w2" }), /workspace_mismatch/);
  assert.equal((await store.list("w1")).length, 0);
});
test("unattributed, mixed units and invalid periods cannot be verified", async () => {
  for (const patch of [{ operator: null }, { unit: "byte" as const }, { quantity: -1n }, { periodEnd: r.periodStart }]) {
    await assert.rejects(ingestUsage(ctx, new MemoryUsageStore(), { ...r, ...patch }));
  }
});
