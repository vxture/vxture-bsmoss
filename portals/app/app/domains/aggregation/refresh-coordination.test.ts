import { test } from "node:test";
import assert from "node:assert/strict";
import type { Pool } from "pg";
import { planPeriodicBatch, planRevisionBatch, refreshTargets, type RefreshSeed } from "./refresh-coordination.ts";
import { enqueueAuthorizedRefresh } from "./refresh-enqueue.ts";
import type { AccessPorts } from "../access/resolve.ts";

const seed: RefreshSeed = { sourceId: "src", mappingId: "map", metric: { code: "service.data.uplink_bytes", version: 1 },
  notBefore: "2026-10-01T00:00:00+08:00", grains: ["day", "week", "month"] };
const now = "2026-11-02T18:05:00+08:00";
test("periodic batches have replayable hourly triggers and only closed natural windows", () => {
  const batch = planPeriodicBatch([seed], now);
  assert.equal(batch.targets.length, 5);
  assert.equal(batch.targets.filter(t => t.grain === "month").length, 1);
  assert.equal(batch.targets.find(t => t.grain === "month")!.at, "2026-09-30T16:00:00.000Z");
  assert.deepEqual(planPeriodicBatch([seed], "2026-11-02T18:59:59+08:00"), batch);
  assert.notEqual(planPeriodicBatch([seed], "2026-11-02T19:00:00+08:00").triggerRef, batch.triggerRef);
  assert.deepEqual(planPeriodicBatch([{ ...seed, notBefore: now }], now).targets, []);
});
test("trusted revision batches include historical old and new windows without truncating to 72 hours", () => {
  const impact = { sourceId: seed.sourceId, mappingId: seed.mappingId, metric: seed.metric, grains: ["day", "month"] as const,
    affected: [{ start: "2026-07-31T23:45:00+08:00", end: "2026-08-01T00:00:00+08:00" }, { start: "2026-10-20T00:00:00+08:00", end: "2026-10-20T00:15:00+08:00" }] };
  const batch = planRevisionBatch([impact], "measurement:m:2");
  assert.equal(batch.targets.length, 4);
  assert.ok(batch.targets.some(t => t.grain === "month" && t.at === "2026-06-30T16:00:00.000Z"));
  assert.ok(!batch.targets.some(t => t.at === "2026-07-31T16:00:00.000Z"));
  assert.deepEqual(planRevisionBatch([impact, impact], "measurement:m:2"), batch);
  assert.notEqual(planRevisionBatch([impact], "measurement:m:3").triggerRef, batch.triggerRef);
});
test("batch targets normalize, dedupe and reject identity injection and unbounded products", () => {
  const t = { sourceId: seed.sourceId, mappingId: seed.mappingId, metric: seed.metric, grain: "day" as const, at: now };
  assert.equal(refreshTargets([t, { ...t, at: "2026-11-02T01:00:00+08:00" }]).length, 1);
  assert.throws(() => refreshTargets([{ ...t, workspaceId: "foreign" } as typeof t]), /invalid_refresh_target/);
  assert.throws(() => refreshTargets([{ ...t, metric: { ...t.metric, version: 0 } }]), /invalid_refresh_target/);
  assert.throws(() => planPeriodicBatch(Array.from({ length: 14 }, (_, i) => ({ ...seed, mappingId: "m" + i })), now), /refresh_batch_bound_exceeded/);
  assert.throws(() => planRevisionBatch([{ ...seed, notBefore: undefined, affected: [] } as never], "ref"), /invalid_refresh_seed/);
  assert.throws(() => planPeriodicBatch([{ ...seed, sourceId: "*", notBefore: now }], now), /invalid_refresh_identity/);
  assert.throws(() => refreshTargets(Array.from({ length: 65 }, () => t)), /refresh_batch_bound_exceeded/);
});
test("authorized enqueue denies missing platform or product grants before database access", async () => {
  let calls = 0; const pool = { async connect() { calls++; throw Error("unexpected_sql"); } } as unknown as Pool;
  const ports: AccessPorts = { async readVerifiedIdentity() { return null; }, async readCoverage() { throw Error("unexpected_coverage"); },
    async readLocalGrant() { throw Error("unexpected_grant"); }, featuresFor() { return []; } };
  const t = { sourceId: seed.sourceId, mappingId: seed.mappingId, metric: seed.metric, grain: "day" as const, at: now };
  await assert.rejects(enqueueAuthorizedRefresh(pool, ports, { targets: [t], triggerRef: "trigger" }), /identity_required/);
  await assert.rejects(enqueueAuthorizedRefresh(pool, ports, { targets: [t], triggerRef: "trigger", scope: "forged" } as never), /untrusted_refresh_request_field/);
  const denied: AccessPorts = { now: () => 1000,
    async readVerifiedIdentity() { return { sub: "worker", activeWorkspace: "w", accountStatus: "active", governanceRoles: [], expiresAt: 9000 }; },
    async readCoverage() { return { workspaceId: "w", product: "bsmoss", tier: "fixture", bundled: false, expiresAt: 9000 }; },
    async readLocalGrant() { return { workspaceId: "w", sub: "worker", active: true, permissions: [], expiresAt: 9000,
      scope: { workspaceId: "w", sourceIds: ["src"], stationIds: ["station"], metricKeys: ["service.data.uplink_bytes@1"], serviceIds: [], deviceIds: [], allowSiteParameters: true } }; },
    featuresFor() { return ["metering"]; } };
  await assert.rejects(enqueueAuthorizedRefresh(pool, denied, { targets: [t], triggerRef: "trigger" }), /permission_denied/);
  await assert.rejects(enqueueAuthorizedRefresh(pool, { ...denied, featuresFor() { return []; } }, { targets: [t], triggerRef: "trigger" }), /feature_denied/);
  assert.equal(calls, 0);
});
