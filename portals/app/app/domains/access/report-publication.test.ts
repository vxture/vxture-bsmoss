import { test } from "node:test";
import assert from "node:assert/strict";
import { createAuthorizedReportPublication } from "./report-publication.ts";
import type { AccessPorts } from "./resolve.ts";
import type { ReportPublicationStore } from "../reports/publication.ts";

function fixture() {
  let clock = 1000, change = () => {};
  const scope = { workspaceId: "w", sourceIds: ["src"], stationIds: ["st"], serviceIds: [], deviceIds: [], metricKeys: ["key"], allowSiteParameters: true }, required = structuredClone(scope);
  const grant = { workspaceId: "w", sub: "publisher", active: true, permissions: ["reports.publish", "metering.view"], scope, expiresAt: 5000 };
  const identity = { sub: "publisher", activeWorkspace: "w", accountStatus: "active", governanceRoles: ["workspace:owner"], expiresAt: 5000 };
  const ports: AccessPorts = { now: () => clock, async readVerifiedIdentity() { return identity; }, async readCoverage() { return { workspaceId: "w", product: "bsmoss", tier: "fixture", bundled: false, expiresAt: 5000 }; },
    async readLocalGrant() { return grant; }, featuresFor() { return ["metering"]; } };
  const stores = { create() { return { workspaceId: "w", async execute(_c, actor, revalidate) { assert.equal(actor, "publisher"); change(); await revalidate(required); throw Error("authorized_fixture"); }, async read(_q, revalidate) { change(); await revalidate(required); return null; } } as ReportPublicationStore; } };
  return { grant, identity, ports, scope, stores, expire() { clock = 5000; }, change(fn: () => void) { change = fn; } };
}
const command = { reportId: "report", reportRevision: "1", manifestSha256: "a".repeat(64), expectedEventRevision: null, commandId: "command", action: "published" as const, reasonRef: "fixture://review" };
test("publishing and withdrawing require explicit permission even for owners; readers never acquire it", async () => {
  const f = fixture(), api = createAuthorizedReportPublication(f.ports, f.stores, "interactive");
  await assert.rejects(api.execute(command), /authorized_fixture/); f.grant.permissions = ["metering.view", "reports.generate"];
  await assert.rejects(api.execute(command), /permission_denied/); await assert.rejects(api.execute({ ...command, action: "withdrawn" }), /permission_denied/);
  assert.equal(await api.read({ reportId: "report" }), null);
});
test("publication writes and reads revalidate full historical scope identity permission lifetime and entitlement", async () => {
  for (const operation of ["execute", "read"]) for (const mode of ["scope", "identity", "permission", "expiry", "coverage"]) {
    const f = fixture(); f.change(() => { if (mode === "scope") f.scope.stationIds = []; if (mode === "identity") f.identity.sub = "other"; if (mode === "permission") f.grant.active = false; if (mode === "expiry") f.expire(); if (mode === "coverage") f.ports.featuresFor = () => []; });
    const api = createAuthorizedReportPublication(f.ports, f.stores, "interactive");
    await assert.rejects(operation === "execute" ? api.execute(command) : api.read({ reportId: "report" }), /denied|expired/);
  }
});
test("publication rejects forged fields or missing identity before touching a store", async () => {
  const f = fixture(), api = createAuthorizedReportPublication({ ...f.ports, async readVerifiedIdentity() { return null; } }, f.stores, "interactive");
  await assert.rejects(api.execute(command), /identity_required/);
  await assert.rejects(api.execute({ ...command, workspaceId: "forged" } as typeof command), /invalid_report_fields/);
});
