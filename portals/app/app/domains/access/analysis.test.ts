import { test } from "node:test";
import assert from "node:assert/strict";
import { createAuthorizedAnalysis } from "./analysis.ts";
import type { AccessPorts } from "./resolve.ts";
import type { AnalysisStore } from "../views/analysis-store.ts";

function fixture() {
  const scope = { workspaceId: "w", sourceIds: ["s"], stationIds: ["st"], serviceIds: [], deviceIds: [], metricKeys: ["runtime.energy.site_wh@1"], allowSiteParameters: true };
  let clock = 1000, calls = 0;
  const identity = { sub: "analyst", activeWorkspace: "w", accountStatus: "active", governanceRoles: [] as string[], expiresAt: 5000 };
  const grant = { workspaceId: "w", sub: "analyst", active: true, permissions: ["metering.view"], scope, expiresAt: 5000 };
  const coverage = { workspaceId: "w", product: "bsmoss", tier: "fixture", bundled: false, expiresAt: 5000 };
  const ports: AccessPorts = { now: () => clock, async readVerifiedIdentity() { return identity; }, async readCoverage() { return coverage; }, async readLocalGrant() { return grant; }, featuresFor() { return ["metering"]; } };
  let change = () => {};
  const required = structuredClone(scope);
  const store = { workspaceId: "w", async read(_q, revalidate) { calls++; change(); await revalidate(required); return { template: null, preferenceRevision: null, at: "2026-11-03T00:00:00.000Z", panels: [] }; },
    async save(_c, revalidate) { calls++; change(); await revalidate(required); return { status: "inserted", revision: "1", currentRevision: "1", commandId: "cmd" }; } } as AnalysisStore;
  const api = createAuthorizedAnalysis(ports, { create(s, sub) { assert.equal(sub, "analyst"); assert.equal(s.workspaceId, "w"); return store; } }, "interactive");
  return { api, identity, grant, coverage, setChange(f: () => void) { change = f; }, expire() { clock = 6000; }, calls: () => calls };
}
const command = { commandId: "cmd", templateCode: "page", templateVersion: 1, templateSha256: "a".repeat(64), expectedRevision: null, preferences: [] };
test("analysis resolves real view access and trusted personal subject for reads and preference saves", async () => {
  const f = fixture(); assert.equal((await f.api.read({ at: "2026-11-03T00:00:00Z" })).template, null); assert.equal((await f.api.save(command)).revision, "1"); assert.equal(f.calls(), 2);
  f.grant.permissions = []; await assert.rejects(f.api.save(command), /permission_denied/); assert.equal(f.calls(), 2);
});
test("analysis revalidates identity, actual scope, coverage and original expiry before a store can commit or return", async () => {
  for (const mutation of [(f: ReturnType<typeof fixture>) => f.identity.sub = "other", (f: ReturnType<typeof fixture>) => f.grant.scope.allowSiteParameters = false,
    (f: ReturnType<typeof fixture>) => f.coverage.tier = null as any, (f: ReturnType<typeof fixture>) => f.expire()]) {
    const f = fixture(); f.setChange(() => mutation(f)); await assert.rejects(f.api.save(command));
  }
  const f = fixture(); f.setChange(() => f.grant.permissions = []); await assert.rejects(f.api.read({ at: "2026-11-03T00:00:00Z" }), /permission_denied/);
});
