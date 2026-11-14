import { test } from "node:test";
import assert from "node:assert/strict";
import { createAuthorizedObjectRollup } from "./object-rollup.ts";
import type { AccessPorts } from "./resolve.ts";
const query = { rollupId: "r", grain: "day" as const, at: "2026-10-25T00:00:00Z" };
function fixture() {
  let clock = 1000, reads = 0;
  const scope = { workspaceId: "w", sourceIds: ["src"], stationIds: ["st"], serviceIds: ["svc"], deviceIds: [], metricKeys: ["service.data.uplink_bytes@1"], allowSiteParameters: false };
  const grant = { workspaceId: "w", sub: "viewer", active: true, permissions: ["metering.view"], scope, expiresAt: 5000 };
  const ports: AccessPorts = { now: () => clock,
    async readVerifiedIdentity() { return { sub: "viewer", activeWorkspace: "w", accountStatus: "active", governanceRoles: [], expiresAt: 5000 }; },
    async readCoverage() { return { workspaceId: "w", product: "bsmoss", tier: "fixture", bundled: false, expiresAt: 5000 }; },
    async readLocalGrant() { reads++; return grant; }, featuresFor() { return ["metering"]; } };
  return { ports, grant, scope, get reads() { return reads; }, expire() { clock = 6000; } };
}
test("reviewed rollup requires view authority before I/O and rechecks full scope after read", async () => {
  const f = fixture(); let calls = 0;
  const readers = { create() { return { workspaceId: "w", async read() { calls++; return null; } }; } };
  const api = createAuthorizedObjectRollup(f.ports, readers, "interactive"); assert.equal(await api.read(query), null); assert.equal(f.reads, 2);
  f.grant.permissions = []; await assert.rejects(api.read(query), /permission_denied/); assert.equal(calls, 1);
  await assert.rejects(createAuthorizedObjectRollup({ ...f.ports, async readVerifiedIdentity() { return null; } }, readers, "interactive").read(query), /identity_required/);
  const other = fixture(); await assert.rejects(createAuthorizedObjectRollup({ ...other.ports, featuresFor() { return []; } }, readers, "interactive").read(query), /feature_denied/);
});
test("reviewed rollup drops results after permission, identity, expiry or scope changes", async () => {
  for (const change of ["permission", "expiry", "scope", "identity"]) {
    const f = fixture(), api = createAuthorizedObjectRollup(f.ports, { create() { return { workspaceId: "w", async read() {
      if (change === "permission") f.grant.active = false;
      if (change === "expiry") f.expire();
      if (change === "scope") f.scope.serviceIds.push("new");
      if (change === "identity") f.ports.readVerifiedIdentity = async () => ({ sub: "other", activeWorkspace: "w", accountStatus: "active", governanceRoles: [], expiresAt: 5000 });
      return null;
    } }; } }, "interactive");
    await assert.rejects(api.read(query), /permission_denied|access_expired/);
  }
  const f = fixture(); await assert.rejects(createAuthorizedObjectRollup(f.ports, { create() { return { workspaceId: "other", async read() { throw Error("unexpected_io"); } }; } }, "interactive").read(query), /workspace_mismatch/);
});
