import { test } from "node:test";
import assert from "node:assert/strict";
import { createAuthorizedReportExports } from "./report-exports.ts";
import type { AccessPorts } from "./resolve.ts";
import type { ReportExportStore } from "../reports/exports.ts";
function fixture() {
  let clock = 1000, change = () => {};
  const scope = { workspaceId: "w", sourceIds: ["src"], stationIds: ["st"], serviceIds: [], deviceIds: [], metricKeys: ["key"], allowSiteParameters: true }, required = structuredClone(scope);
  const grant = { workspaceId: "w", sub: "exporter", active: true, permissions: ["reports.export", "reports.export.execute"], scope, expiresAt: 5000 };
  const identity = { sub: "exporter", activeWorkspace: "w", accountStatus: "active", governanceRoles: ["workspace:owner"], expiresAt: 5000 };
  const ports: AccessPorts = { now: () => clock, async readVerifiedIdentity() { return identity; }, async readCoverage() { return { workspaceId: "w", product: "bsmoss", tier: "fixture", bundled: false, expiresAt: 5000 }; }, async readLocalGrant() { return grant; }, featuresFor() { return ["metering"]; } };
  const execute = async (_query: unknown, _actor: string, revalidate: (scope: typeof required) => Promise<void>) => { assert.equal(_actor, "exporter"); change(); await revalidate(required); throw Error("authorized_export_fixture"); };
  const read = async (_query: unknown, revalidate: (scope: typeof required) => Promise<void>) => { change(); await revalidate(required); return null; };
  const stores = { create() { return { workspaceId: "w", request: execute, run: execute, status: read, download: read, pending: async (_query, revalidate) => { change(); await revalidate(required); return { jobIds: ["job"] }; } } as ReportExportStore; } };
  return { grant, scope, identity, ports, stores, change(fn: () => void) { change = fn; }, expire() { clock = 5000; } };
}
const command = { reportId: "report", publicationRevision: "1", commandId: "export" };
test("export delivery and background execution use separate explicit grants and owner inherits neither", async () => {
  const f = fixture(), api = createAuthorizedReportExports(f.ports, f.stores, "interactive");
  await assert.rejects(api.request(command), /authorized_export_fixture/); await assert.rejects(api.run({ jobId: "id" }), /authorized_export_fixture/);
  f.grant.permissions = ["reports.export"]; await assert.rejects(api.run({ jobId: "id" }), /permission_denied/);
  await assert.rejects(api.pending({ limit: 1 }), /permission_denied/);
  f.grant.permissions = ["reports.export.execute"]; await assert.rejects(api.download({ jobId: "id" }), /permission_denied/);
  assert.deepEqual(await api.pending({ limit: 1 }), { jobIds: ["job"] });
  f.grant.permissions = ["metering.view", "reports.publish", "reports.generate"]; await assert.rejects(api.request(command), /permission_denied/);
});
test("all export stages recheck identity entitlement permission full historical scope and lifetime", async () => {
  for (const method of ["request", "run", "status", "download", "pending"] as const) for (const mode of ["identity", "scope", "permission", "coverage", "expiry"]) {
    const f = fixture(); f.change(() => { if (mode === "identity") f.identity.sub = "other"; if (mode === "scope") f.scope.stationIds = []; if (mode === "permission") f.grant.active = false; if (mode === "coverage") f.ports.featuresFor = () => []; if (mode === "expiry") f.expire(); });
    const api = createAuthorizedReportExports(f.ports, f.stores, "interactive");
    await assert.rejects(method === "request" ? api.request(command) : method === "pending" ? api.pending({ limit: 1 }) : api[method]({ jobId: "id" }), /denied|expired/);
  }
});
