import { test } from "node:test";
import assert from "node:assert/strict";
import type { Pool } from "pg";
import { createAuthorizedAggregates, type AggregateRequest, type AggregatePorts } from "./aggregates.ts";
import { resolveMeasurementAccess, type AccessPorts, type LocalGrant, type VerifiedIdentity } from "./resolve.ts";
import { PgAggregateSnapshotReader } from "../aggregation/pg-snapshot.ts";
import type { AggregateSnapshot } from "../aggregation/snapshot.ts";
import type { AggregateScope } from "../aggregation/store.ts";

const request: AggregateRequest = { sourceId: "src", mappingId: "map", metric: { code: "service.data.uplink_bytes", version: 1 }, grain: "hour", at: "2026-10-25T00:30:00+08:00", expectedRevision: null };
function fixture() {
  let clock = 1000;
  const identity: VerifiedIdentity = { sub: "worker", activeWorkspace: "w", accountStatus: "active", governanceRoles: [], expiresAt: 9000 };
  const grant: LocalGrant = { workspaceId: "w", sub: "worker", active: true, expiresAt: 5000, permissions: ["metering.aggregate"],
    scope: { workspaceId: "w", sourceIds: ["src"], stationIds: ["st"], serviceIds: ["svc"], deviceIds: [], allowSiteParameters: false, metricKeys: ["service.data.uplink_bytes@1"] } };
  const snapshot: AggregateSnapshot = { plan: { workspaceId: "w", sourceId: "src", subjectKey: "trusted-subject", authorityVersion: "reviewed-authority",
    metric: request.metric, inputMode: "direct", period: { start: "2026-10-24T16:00:00.000Z", end: "2026-10-24T17:00:00.000Z" }, grain: "hour", nativeGrain: "15m", watermark: "2026-10-24T16:00:00.000Z", sourceComplete: false }, inputs: [] };
  const calls: unknown[] = [];
  const ports: AccessPorts = { now: () => clock, async readVerifiedIdentity() { calls.push("identity"); return identity; },
    async readCoverage() { calls.push("coverage"); return { workspaceId: "w", product: "bsmoss", tier: "fixture", bundled: false, expiresAt: 8000 }; },
    featuresFor() { return ["metering"]; }, async readLocalGrant(subject) { calls.push(subject.operation); return grant; } };
  let readerWorkspace = "w", storeWorkspace = "w", onLoad = () => {};
  const adapters: AggregatePorts = { reader(scope) { calls.push(["reader", scope]); return { workspaceId: readerWorkspace, async load(target) { calls.push(["load", target]); onLoad(); return snapshot; } }; },
    store(scope: AggregateScope) { calls.push(["store", scope]); return { workspaceId: storeWorkspace,
      async publish(...args) { calls.push(["publish", ...args]); return { status: "inserted", seriesId: "s", revision: "1", currentRevision: "1" }; },
      async current() { return null; }, async readRevision() { return null; } }; } };
  return { ports, adapters, identity, grant, snapshot, calls, api: createAuthorizedAggregates(ports, adapters, "interactive"),
    advance: (value: number) => { clock = value; }, afterLoad: (fn: () => void) => { onLoad = fn; },
    readerWorkspace: (v: string) => { readerWorkspace = v; }, storeWorkspace: (v: string) => { storeWorkspace = v; } };
}
test("authorized recompute resolves gates before scoped input and pins publication to one server-derived triple", async () => {
  const f = fixture();
  const result = await f.api.recompute(request);
  assert.equal(result.revision, "1");
  assert.deepEqual(f.calls.slice(0, 3), ["identity", "coverage", "aggregate"]);
  assert.deepEqual(f.calls[4], ["load", { sourceId: request.sourceId, mappingId: request.mappingId, metric: request.metric, grain: request.grain, at: request.at }]);
  assert.deepEqual(f.calls[5], ["store", { workspaceId: "w", series: [{ sourceId: "src", subjectKey: "trusted-subject", metricKey: "service.data.uplink_bytes@1" }] }]);
  assert.deepEqual(f.calls[6], ["publish", f.snapshot.plan, [], null, "worker"]);
});
test("aggregate requires an explicit permission even for workspace owner", async () => {
  const f = fixture(); f.identity.governanceRoles = ["workspace:owner"]; f.grant.permissions = ["metering.view", "metering.ingest"];
  await assert.rejects(f.api.recompute(request), /permission_denied/);
  assert.equal(f.calls.length, 3);
  f.grant.permissions = ["metering.aggregate"];
  const access = await resolveMeasurementAccess(f.ports, "aggregate", "interactive");
  assert.deepEqual([...access.context.permissions], ["metering.aggregate"]);
});
test("aggregate re-resolves grants each invocation and denies revoked membership", async () => {
  const f = fixture(); await f.api.recompute(request);
  f.grant.active = false;
  await assert.rejects(f.api.recompute(request), /permission_denied/);
  assert.equal(f.calls.filter(c => c === "identity").length, 2);
  assert.equal(f.calls.filter(c => Array.isArray(c) && c[0] === "publish").length, 1);
});
test("aggregate request cannot inject identity, evidence, scope, watermarks or authority", async () => {
  for (const key of ["workspaceId", "sub", "scope", "inputs", "plan", "watermark", "authorityVersion", "subjectKey"]) {
    const f = fixture();
    await assert.rejects(f.api.recompute({ ...request, [key]: "injected" }), /untrusted_request_field/);
    assert.deepEqual(f.calls, []);
  }
  const f = fixture();
  await assert.rejects(f.api.recompute({ ...request, metric: { ...request.metric, unit: "byte" } } as AggregateRequest), /untrusted_request_field/);
  await assert.rejects(f.api.recompute({ ...request, expectedRevision: "0" }), /invalid_revision/);
  assert.deepEqual(f.calls, []);
});
test("aggregate rejects expired authorization after snapshot and refuses cross-workspace adapters", async () => {
  const f = fixture(); f.afterLoad(() => f.advance(5000));
  await assert.rejects(f.api.recompute(request), /access_expired/);
  assert.equal(f.calls.filter(c => Array.isArray(c) && c[0] === "store").length, 0);
  const reader = fixture(); reader.readerWorkspace("other");
  await assert.rejects(reader.api.recompute(request), /workspace_mismatch/);
  const snapshot = fixture(); snapshot.snapshot.plan.workspaceId = "other";
  await assert.rejects(snapshot.api.recompute(request), /workspace_mismatch/);
  const store = fixture(); store.storeWorkspace("other");
  await assert.rejects(store.api.recompute(request), /workspace_mismatch/);
});
test("aggregate snapshots request selectors before awaiting identity resolution", async () => {
  const f = fixture(), mutable = structuredClone(request);
  const recompute = f.api.recompute(mutable);
  mutable.mappingId = "other"; mutable.metric.code = "runtime.energy.site_wh"; mutable.expectedRevision = "99";
  await recompute;
  const load = f.calls.find(c => Array.isArray(c) && c[0] === "load") as unknown[];
  assert.equal((load[1] as AggregateRequest).mappingId, "map");
  assert.equal((load[1] as AggregateRequest).metric.code, request.metric.code);
  assert.equal((f.calls.at(-1) as unknown[])[3], null);
});
test("snapshot reader validates finite scopes and rejects unauthorized or unsupported selectors before SQL", async () => {
  const f = fixture(); let calls = 0;
  const pool = { connect() { calls++; throw new Error("unexpected_query"); } } as unknown as Pool;
  const reader = new PgAggregateSnapshotReader(pool, f.grant.scope);
  (f.grant.scope.sourceIds as string[]).push("foreign");
  await assert.rejects(reader.load({ ...request, sourceId: "foreign" }), /aggregate_scope_denied/);
  await assert.rejects(reader.load({ ...request, metric: { code: "service.sms.success_count", version: 1 } }), /aggregate_scope_denied/);
  await assert.rejects(reader.load({ ...request, at: "invalid" }), /invalid_timestamp/);
  await assert.rejects(reader.load({ ...request, mappingId: "*" }), /invalid_aggregate_identity/);
  const scope = { ...f.grant.scope, metricKeys: ["service.data.total_bytes@1"] };
  await assert.rejects(new PgAggregateSnapshotReader(pool, scope).load({ ...request, metric: { code: "service.data.total_bytes", version: 1 } }), /aggregate_dependency_scope_denied/);
  await assert.rejects(new PgAggregateSnapshotReader(pool,{...scope,metricKeys:['runtime.device.state@1']}).load({...request,metric:{code:'runtime.device.state',version:1}}),/unsupported_aggregate_metric/);
  assert.throws(() => new PgAggregateSnapshotReader(pool, { ...f.grant.scope, stationIds: ["*"] }), /invalid_aggregate_identity/);
  assert.equal(calls, 0);
});
