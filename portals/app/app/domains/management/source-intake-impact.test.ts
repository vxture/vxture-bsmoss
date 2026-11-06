import { test } from "node:test";
import assert from "node:assert/strict";
import type { PoolClient } from "pg";
import { readSourceIntakeImpact } from "./source-intake-impact.ts";
import { sourcePreflightResult, sourceProposal } from "./source-preflight-rules.ts";
import { resolveMeasurementAccess } from "../access/resolve.ts";
import { sourcePreflight } from "./source-preflight-service.ts";
import { fingerprintOf } from "../aggregation/intervals.ts";
import type { AccessPorts } from "../access/resolve.ts";
import type { SourceRecord } from "./source-rules.ts";
const scope = { workspaceId: "w", sourceIds: ["src"], stationIds: ["A"], serviceIds: ["sa"], deviceIds: ["da"], metricKeys: ["service.data.uplink_bytes@1"], allowSiteParameters: true };
const binding = { id: "binding", revision: "1", sourceId: "src", adapterVersion: "a1", transformVersion: "t1", coverageStart: "2026-01-01T00:00:00.000Z", scope };
const record: SourceRecord = { ...binding, binding, digest: fingerprintOf(binding), status: "active", recordedAt: "2026-01-01T00:00:00.000000Z", counts: { stations: 1, services: 1, devices: 1, metrics: 1 }, reviewRef: "test", databaseActor: "test" };
const proposal = { expected: { revision: "1", digest: record.digest }, proposed: { revision: "2", status: "paused", adapterVersion: "a1", transformVersion: "t1", coverageStart: binding.coverageStart, scope: { stationIds: ["A"], serviceIds: ["sa"], deviceIds: ["da"], metricKeys: scope.metricKeys, allowSiteParameters: true } }, basis: { reference: "fixture", sha256: "a".repeat(64) } };
test("intake impact performs no query without independent complete original scope", async () => {
  let queries = 0;
  const c = { query: async () => { queries++; throw Error("must_not_query"); } } as unknown as PoolClient;
  assert.deepEqual(await readSourceIntakeImpact(c, record), { status: "not_authorized" });
  for (const key of ["sourceIds", "stationIds", "serviceIds", "deviceIds", "metricKeys"] as const) assert.deepEqual(await readSourceIntakeImpact(c, record, { ...scope, [key]: [] }), { status: "not_authorized" });
  assert.deepEqual(await readSourceIntakeImpact(c, record, { ...scope, workspaceId: "other" }), { status: "not_authorized" });
  assert.deepEqual(await readSourceIntakeImpact(c, record, { ...scope, allowSiteParameters: false }), { status: "not_authorized" });
  assert.equal(queries, 0);
});
function fixture() {
  let now = 1000, denied = false, reads = 0, passed: unknown;
  let after = () => {}, failure = "";
  let impactScope = structuredClone(scope);
  let permissions = ["admin.sources.preflight", "admin.sources.intake_impact.view"];
  const ports: AccessPorts = {
    now: () => now, readVerifiedIdentity: async () => ({ sub: "u", activeWorkspace: "w", accountStatus: "active", governanceRoles: [], expiresAt: 5000 }),
    readCoverage: async () => ({ workspaceId: "w", product: "bsmoss", tier: "test", bundled: false, expiresAt: 5000 }),
    readLocalGrant: async s => ({ workspaceId: "w", sub: "u", active: true, permissions: denied && s.operation === "source_intake_impact_view" ? [] : permissions, scope: s.operation === "source_intake_impact_view" ? impactScope : scope, expiresAt: 5000 }),
    featuresFor: () => ["metering"]
  };
  const service = sourcePreflight(ports, { create: () => ({ workspaceId: "w", preview: async (_id, _p, s) => { reads++; passed = s; after(); if (failure) throw Error(failure); return null; } }) });
  return { service, ports, get reads() { return reads; }, get passed() { return passed; }, permissions: (p: string[]) => permissions = p, after: (f: () => void) => after = f, revoke: () => denied = true, narrow: () => impactScope = { ...impactScope, deviceIds: [] }, expire: () => now = 6000, fail: (f: string) => failure = f };
}
test("preflight alone does not pass impact scope while impact permission alone cannot preview", async () => {
  const f = fixture(); f.permissions(["admin.sources.preflight"]);
  await assert.rejects(f.service.preview("binding", proposal), /source_configuration_unavailable/); assert.equal(f.passed, undefined);
  for (const p of ["admin.sources.intake_impact.view", "metering.jobs.view", "admin.sources.view"]) {
    const f = fixture(); f.permissions([p]); await assert.rejects(f.service.preview("binding", proposal), /permission_denied/); assert.equal(f.reads, 0);
  }
});
test("impact scope is passed only under its own permission and rechecked on missing stale and SQL failures", async () => {
  for (const failure of ["", "source_context_changed", "sql_failure"]) for (const mode of ["revoke", "narrow", "expire"] as const) {
    const f = fixture(); f.fail(failure); f.after(() => f[mode]());
    await assert.rejects(f.service.preview("binding", proposal), /permission_denied|access_expired/); assert.deepEqual(f.passed, scope);
  }
});
test("an independent impact authorization service failure is not swallowed as zero impact", async () => {
  const f = fixture(), read = f.ports.readLocalGrant;
  f.ports.readLocalGrant = async s => { if (s.operation === "source_intake_impact_view") throw Error("authorization_backend_unavailable"); return read(s); };
  await assert.rejects(f.service.preview("binding", proposal), /authorization_backend_unavailable/); assert.equal(f.reads, 0);
});

test("impact permissions never inherit an owner baseline or permit machine access", async () => {
  const f = fixture(); f.permissions(["admin.sources.preflight", "metering.jobs.view"]);
  f.ports.readVerifiedIdentity = async () => ({ sub: "u", activeWorkspace: "w", accountStatus: "active", governanceRoles: ["workspace:owner"], expiresAt: 5000 });
  await assert.rejects(resolveMeasurementAccess(f.ports, "source_intake_impact_view", "interactive"), /permission_denied/);
  f.permissions(["admin.sources.intake_impact.view"]);
  f.ports.readVerifiedIdentity = async () => ({ kind: "service", sub: "s2s:bsmoss", callerProduct: "bsmoss", activeWorkspace: "w", expiresAt: 5000, tokenId: "fixture" });
  for (const plane of ["interactive", "data"] as const) await assert.rejects(resolveMeasurementAccess(f.ports, "source_intake_impact_view", plane), /permission_denied/);
});
test("a successful authorized preview keeps its bound evidence and revalidates both permissions", async () => {
  const f = fixture(), operations: string[] = [], read = f.ports.readLocalGrant;
  f.ports.readLocalGrant = async s => { operations.push(s.operation); return read(s); };
  const expected = sourcePreflightResult(record, sourceProposal(proposal), scope, [], "2026-11-07T00:00:00Z");
  const service = sourcePreflight(f.ports, { create: s => ({ workspaceId: s.workspaceId, preview: async (_id, _proposal, impactScope) => { assert.deepEqual(impactScope, scope); return expected; } }) });
  assert.equal(await service.preview("binding", proposal), expected);
  assert.deepEqual(operations, ["sources_preflight", "source_intake_impact_view", "sources_preflight", "source_intake_impact_view"]);
});
