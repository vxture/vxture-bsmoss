import { test } from "node:test";
import assert from "node:assert/strict";
import { createAuthorizedReports } from "./reports.ts";
import type { AccessPorts } from "./resolve.ts";
import type { ReportStore } from "../reports/store.ts";
const query = { templateCode: "report", templateVersion: 1, at: "2026-10-25T00:00:00Z", expectedRevision: null };
function fixture() {
  let clock = 1000, calls = 0;
  const scope = { workspaceId: "w", sourceIds: ["src"], stationIds: ["st"], serviceIds: ["svc"], deviceIds: [], metricKeys: ["service.data.uplink_bytes@1"], allowSiteParameters: false };
  const required = structuredClone(scope), grant = { workspaceId: "w", sub: "generator", active: true, permissions: ["reports.generate", "metering.view"], scope, expiresAt: 5000 };
  const identity = { sub: "generator", activeWorkspace: "w", accountStatus: "active", governanceRoles: [] as string[], expiresAt: 5000 };
  const ports: AccessPorts = { now: () => clock, async readVerifiedIdentity() { return identity; },
    async readCoverage() { return { workspaceId: "w", product: "bsmoss", tier: "fixture", bundled: false, expiresAt: 5000 }; },
    async readLocalGrant() { return grant; }, featuresFor() { return ["metering"]; } };
  let change = () => {};
  const stores = { create() { return { workspaceId: "w", async generate(_q, actor, revalidate) { calls++; assert.equal(actor, "generator"); change(); await revalidate(required); throw Error("fixture_revalidated"); },
    async read(_q, revalidate) { calls++; change(); await revalidate(required); return null; } } as ReportStore; } };
  return { scope, required, grant, identity, ports, stores, expire() { clock = 6000; }, onRead(fn: () => void) { change = fn; }, get calls() { return calls; } };
}
test("report generation requires an explicit local permission even for workspace owners and view never grants generation", async () => {
  const f = fixture(), api = createAuthorizedReports(f.ports, f.stores, "interactive");
  await assert.rejects(api.generate(query), /fixture_revalidated/); f.grant.permissions = ["metering.view"]; f.identity.governanceRoles = ["workspace:owner"];
  await assert.rejects(api.generate(query), /permission_denied/); assert.equal(f.calls, 1); assert.equal(await api.read({ reportId: "id" }), null);
});
test("reports fail closed before storage for absent identity, entitlement, permission and forged selectors", async () => {
  const f = fixture();
  for (const ports of [{ ...f.ports, async readVerifiedIdentity() { return null; } }, { ...f.ports, featuresFor() { return []; } }, { ...f.ports, async readLocalGrant() { return { ...f.grant, active: false }; } }]) await assert.rejects(createAuthorizedReports(ports, f.stores, "interactive").generate(query), /required|denied/);
  await assert.rejects(createAuthorizedReports(f.ports, f.stores, "interactive").generate({ ...query, scope: f.scope } as typeof query)); assert.equal(f.calls, 0);
});
test("reports revalidate exact required scope and discard writes or reads on final identity authority or lifetime changes", async () => {
  for (const mode of ["permission", "scope", "identity", "expiry"]) for (const operation of ["generate", "read"]) {
    const f = fixture(); f.onRead(() => { if (mode === "permission") f.grant.active = false; if (mode === "scope") f.scope.stationIds = []; if (mode === "identity") f.identity.sub = "other"; if (mode === "expiry") f.expire(); });
    const api = createAuthorizedReports(f.ports, f.stores, "interactive"); await assert.rejects(operation === "generate" ? api.generate(query) : api.read({ reportId: "id" }), /denied|expired/);
  }
});
test("removing unrelated parent scope leaves a fully authorized report visible", async () => {
  const f = fixture(); f.scope.stationIds.push("unused"); f.onRead(() => { f.scope.stationIds = ["st"]; });
  assert.equal(await createAuthorizedReports(f.ports, f.stores, "interactive").read({ reportId: "id" }), null);
});
