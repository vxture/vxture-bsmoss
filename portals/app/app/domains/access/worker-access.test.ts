import { test } from "node:test";
import assert from "node:assert/strict";
import type { Pool } from "pg";
import { productionAccessPorts } from "./production-ports.ts";
import { workerAccessPorts } from "./worker-access.ts";
import { resolveMeasurementAccess, type MeasurementOperation } from "./resolve.ts";
import { workerFailure } from "../workers/rules.ts";

function fixture() {
  const scope = { workspaceId: "w", sourceIds: ["src"], stationIds: ["st"], metricKeys: ["metric@1"], serviceIds: [], deviceIds: [], allowSiteParameters: false };
  const state = { active: true, ready: true, enabled: true, bundled: true, permissions: ["metering.aggregate", "reports.generate", "reports.export.execute"], reads: 0 };
  const pool = { async query(sql: string, args: unknown[]) {
    state.reads++;
    if (sql.includes("vx_provision.app_instance")) return { rows: [{ status: state.ready ? "provisioned" : "archived" }] };
    assert.deepEqual(args, ["w", "s2s:bsmoss"]);
    return { rows: [{ status: state.active ? "active" : "inactive", scope, permissions: state.permissions, expires_at: new Date(Date.now() + 60000) }] };
  } } as unknown as Pool;
  const dependencies = { pool: () => pool, coverage: async () => ({ tier: null, bundled: state.bundled }), meteringEnabled: () => state.enabled };
  const ports = workerAccessPorts("w", async () => ({ callerProduct: "bsmoss", workspaceId: "w", tokenId: "ticket", expiresAt: Date.now() + 300000 }), dependencies);
  return { state, ports, dependencies, scope };
}
test("service identity has no owner baseline and is confined to three background data operations", async () => {
  const f = fixture();
  for (const op of ["aggregate", "report_generate", "report_export_execute"] as const) {
    const result = await resolveMeasurementAccess(f.ports, op, "data");
    assert.equal(result.context.sub, "s2s:bsmoss"); assert.deepEqual(result.scope.stationIds, ["st"]);
    await assert.rejects(resolveMeasurementAccess(f.ports, op, "interactive"), /permission_denied/);
  }
  for (const op of ["view", "ingest", "job_view", "job_recover", "report_jobs_view", "report_jobs_recover", "report_publish", "report_export", "template_view", "template_publish", "template_select"] as MeasurementOperation[])
    await assert.rejects(resolveMeasurementAccess(f.ports, op, "data"), /permission_denied/);
  f.state.permissions = [];
  await assert.rejects(resolveMeasurementAccess(f.ports, "aggregate", "data"), /permission_denied/);
});
test("cached service proof never caches archive coverage feature grant or finite scope", async () => {
  for (const field of ["active", "ready", "enabled", "bundled"] as const) {
    const f = fixture(); await resolveMeasurementAccess(f.ports, "aggregate", "data"); f.state[field] = false;
    await assert.rejects(resolveMeasurementAccess(f.ports, "aggregate", "data"), /permission_denied|feature_denied/);
  }
  const f = fixture(); f.scope.stationIds = ["*"];
  await assert.rejects(resolveMeasurementAccess(f.ports, "aggregate", "data"), /invalid_scope/);
  const bad = workerAccessPorts("foreign", async () => ({ callerProduct: "bsmoss", workspaceId: "w", tokenId: "t", expiresAt: Date.now() + 300000 }), f.dependencies);
  await assert.rejects(resolveMeasurementAccess(bad, "aggregate", "data"), /worker_identity_invalid/);
  assert.equal(f.state.reads, 2);
});
test("absent users and reserved machine-key users cannot touch database or acquire service authority", async () => {
  let reads = 0;
  const dependencies = { pool: () => { reads++; throw Error("unexpected_database"); }, coverage: async () => ({ tier: null, bundled: true }), meteringEnabled: () => true };
  for (const identity of [null, { sub: "s2s:bsmoss", activeWorkspace: "w", accountStatus: "active", governanceRoles: ["workspace:owner"], expiresAt: Date.now() + 60000 }]) {
    const ports = productionAccessPorts(async () => identity, dependencies);
    await assert.rejects(resolveMeasurementAccess(ports, "aggregate", "data"), /identity_required/);
  }
  assert.equal(reads, 0);
  for (const reason of ["invalid", "unconfigured", "unavailable"]) assert.equal(workerFailure(Error("worker_identity_" + reason)), "authorization_denied");
});
