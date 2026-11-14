import { test } from "node:test";
import assert from "node:assert/strict";
import { registeredPartition, partitionAccess, type RegisteredPartition } from "./registered-partitions.ts";
import type { MeasurementAccess } from "../access/resolve.ts";

const up = { code: "service.data.uplink_bytes", version: 1 };
const partition: RegisteredPartition = { workspaceId: "w", id: "p", revision: "1", subject: "worker", status: "active",
  scope: { workspaceId: "w", sourceIds: ["src"], stationIds: ["st"], serviceIds: ["svc"], deviceIds: [], metricKeys: [up.code + "@1"], allowSiteParameters: false },
  policy: { outputs: [up], grains: ["day"] }, seeds: [{ sourceId: "src", mappingId: "map", metric: up, notBefore: "2026-06-01T00:00:00+08:00", grains: ["day"] }] };
const access: MeasurementAccess = { context: { workspaceId: "w", sub: "worker", features: new Set(["metering"]), permissions: new Set(["metering.aggregate"]) },
  scope: { ...partition.scope, sourceIds: ["src", "other"] }, expiresAt: 2000 };
test("registered partition normalizes evidence while narrowing the current grant without manufacturing authority", () => {
  const p = registeredPartition(partition), same = registeredPartition({ ...partition, scope: { ...partition.scope, sourceIds: ["src", "src"] } });
  assert.equal(p.sha256, same.sha256); assert.equal(p.partition.seeds[0]!.notBefore, "2026-05-31T16:00:00.000Z");
  assert.deepEqual(partitionAccess(partition, access, 1000).scope, partition.scope);
  assert.notEqual(registeredPartition({ ...partition, revision: "2" }).sha256, p.sha256);
});
test("registered partitions reject unreviewed keys, foreign seed scopes, duplicate seeds and derived missing dependencies", () => {
  assert.throws(() => registeredPartition({ ...partition, grants: ["*"] } as RegisteredPartition), /invalid_registered/);
  assert.throws(() => registeredPartition({ ...partition, seeds: [...partition.seeds, ...partition.seeds] }), /duplicate_registered_seed/);
  assert.throws(() => registeredPartition({ ...partition, seeds: partition.seeds.map(s => ({ ...s, sourceId: "foreign" })) }), /registered_seed_scope_denied/);
  assert.throws(() => registeredPartition({ ...partition, seeds: Array(13).fill(partition.seeds[0]) }), /invalid_registered_seeds/);
  const total = { code: "service.data.total_bytes", version: 1 };
  assert.throws(() => registeredPartition({ ...partition, scope: { ...partition.scope, metricKeys: [total.code + "@1"] },
    policy: { outputs: [total], grains: ["day"] } }), /aggregate_dependency_scope_denied/);
});
test("registered work requires the bound active subject and every registered object in the current unexpired grant", () => {
  for (const patch of [{ status: "paused" }, { subject: "another" }, { workspaceId: "other", scope: { ...partition.scope, workspaceId: "other" } }]) {
    assert.throws(() => partitionAccess({ ...partition, ...patch } as RegisteredPartition, access, 1000));
  }
  for (const key of ["sourceIds", "stationIds", "serviceIds", "metricKeys"] as const) {
    assert.throws(() => partitionAccess(partition, { ...access, scope: { ...access.scope, [key]: [] } }, 1000), /registered_partition_scope_denied/);
  }
  assert.throws(() => partitionAccess(partition, access, 2000), /access_expired/);
  assert.throws(() => partitionAccess({ ...partition, scope: { ...partition.scope, allowSiteParameters: true } }, access, 1000), /registered_partition_scope_denied/);
});
