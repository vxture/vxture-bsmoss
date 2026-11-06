import { test } from "node:test";
import assert from "node:assert/strict";
import type { PoolClient } from "pg";
import { positionPreview } from "./source-position-rules.ts";
import { readSourcePositionPreview } from "./source-position-reader.ts";
import { sourcePreflight } from "./source-preflight-service.ts";
import { resolveMeasurementAccess, type AccessPorts } from "../access/resolve.ts";
import { fingerprintOf } from "../aggregation/intervals.ts";
const scope = { workspaceId: "w", sourceIds: ["src"], stationIds: ["A", "B"], serviceIds: [], deviceIds: [], metricKeys: ["service.data.uplink_bytes@1"], allowSiteParameters: false };
const binding = { id: "b", sourceId: "src", revision: "9007199254740993", adapterVersion: "a1", transformVersion: "t1", coverageStart: "2026-01-01T00:00:00.000Z", scope };
const current = { ...binding, revision: "9007199254740994", scope: { ...scope, stationIds: ["A"] } };
const proposed = { ...current, revision: "9007199254740995", transformVersion: "t2", scope };
const receipt = { id: "a".repeat(64), sequence: "9007199254740996", binding, manifest: { position: { bindingSha256: fingerprintOf(binding), through: "2026-02-02T00:00:00.000Z", dataRevision: "private", changeCursor: "opaque" } } };
test("cross revision preview keeps precise versions and differences without emitting a cursor or executable position", () => {
  const result = positionPreview(receipt, current, proposed);
  assert.equal(result.status, "assessed"); if (result.status !== "assessed") throw Error();
  assert.equal(result.receipt.bindingRevision, binding.revision); assert.equal(result.receipt.sequence, receipt.sequence);
  assert.equal(result.receipt.relation, "earlier_revision");
  assert.deepEqual(result.receivedToCurrent.scopeChanges[0], { dimension: "stationIds", added: 0, removed: 1 });
  assert.equal(result.receivedToProposed.transformChanged, true);
  assert.equal(result.reviewWindow?.exceedsPullWindow, true); assert.equal(result.cursorReuse, "not_verified");
  assert.doesNotMatch(JSON.stringify(result), /opaque|private|bindingSha256|manifest|records|dataRevision|changeCursor/);
  assert.equal(positionPreview(receipt, current, { ...proposed, coverageStart: receipt.manifest.position.through }).status, "assessed");
  const later = positionPreview(receipt, current, { ...proposed, coverageStart: "2026-03-01T00:00:00.000Z" });
  assert.equal(later.status === "assessed" && later.reviewWindow, null);
  const same = positionPreview({ ...receipt, binding: current, manifest: { position: { ...receipt.manifest.position, bindingSha256: fingerprintOf(current) } } }, current, proposed);
  assert.equal(same.status === "assessed" && same.receipt.relation, "current_revision");
});
test("position preview rejects inconsistent identities digest ordering and invalid received boundaries", () => {
  for (const old of [{ ...binding, id: "other" }, { ...binding, sourceId: "different", scope: { ...scope, sourceIds: ["different"] } }, { ...binding, revision: proposed.revision }, { ...binding, scope: { ...scope, workspaceId: "other" } }]) {
    assert.throws(() => positionPreview({ ...receipt, binding: old, manifest: { position: { ...receipt.manifest.position, bindingSha256: fingerprintOf(old) } } }, current, proposed), /invalid_source_position_evidence/);
  }
  assert.throws(() => positionPreview({ ...receipt, manifest: { position: { ...receipt.manifest.position, bindingSha256: "b".repeat(64) } } }, current, proposed), /invalid_source_position_evidence/);
  assert.throws(() => positionPreview(receipt, current, { ...proposed, revision: current.revision }), /invalid_source_position_evidence/);
  const conflicting = { ...binding, revision: current.revision };
  assert.throws(() => positionPreview({ ...receipt, binding: conflicting, manifest: { position: { ...receipt.manifest.position, bindingSha256: fingerprintOf(conflicting) } } }, current, proposed), /invalid_source_position_evidence/);
  assert.throws(() => positionPreview({ ...receipt, manifest: { position: { ...receipt.manifest.position, through: binding.coverageStart } } }, current, proposed), /invalid_source_position_evidence/);
});
test("no position query without independent complete current and proposed scope; no candidate is ambiguous", async () => {
  let queries = 0; const c = { query: async () => { queries++; return { rows: [] }; } } as unknown as PoolClient;
  for (const s of [undefined, { ...scope, stationIds: ["A"] }, { ...scope, metricKeys: [] }, { ...scope, workspaceId: "other" }]) assert.deepEqual(await readSourcePositionPreview(c, current, proposed, s), { status: "not_authorized" });
  assert.equal(queries, 0); assert.deepEqual(await readSourcePositionPreview(c, current, proposed, scope), { status: "unavailable" }); assert.equal(queries, 1);
});
function fixture() {
  let after = () => {}, failure = "", passed: unknown, now = 1000;
  const permissions = ["admin.sources.preflight", "admin.sources.position.preview"], positionScope = structuredClone(scope);
  const ports: AccessPorts = { now: () => now, readVerifiedIdentity: async () => ({ sub: "u", activeWorkspace: "w", accountStatus: "active", governanceRoles: [], expiresAt: 5000 }), readCoverage: async () => ({ workspaceId: "w", product: "bsmoss", tier: "test", bundled: false, expiresAt: 5000 }), readLocalGrant: async s => ({ workspaceId: "w", sub: "u", active: true, permissions, scope: s.operation === "source_position_preview" ? positionScope : scope, expiresAt: 5000 }), featuresFor: () => ["metering"] };
  const service = sourcePreflight(ports, { create: () => ({ workspaceId: "w", preview: async (_id, _p, _impact, position) => { passed = position; after(); if (failure) throw Error(failure); return null; } }) });
  const { workspaceId: _w, sourceIds: _s, ...newScope } = proposed.scope;
  const proposal = { expected: { revision: current.revision, digest: fingerprintOf(current) }, proposed: { revision: proposed.revision, status: "paused", adapterVersion: proposed.adapterVersion, transformVersion: proposed.transformVersion, coverageStart: proposed.coverageStart, scope: newScope }, basis: { reference: "test", sha256: "a".repeat(64) } };
  return { ports, service, proposal, permissions, positionScope, get passed() { return passed; }, after: (f: () => void) => after = f, fail: (s: string) => failure = s, expire: () => now = 6000 };
}
test("position right is independent of current impact owner and machine rights", async () => {
  const f = fixture(); await assert.rejects(f.service.preview("b", f.proposal), /source_configuration_unavailable/); assert.deepEqual(f.passed, scope);
  f.permissions.splice(1); f.permissions.push("admin.sources.intake_impact.view"); await assert.rejects(f.service.preview("b", f.proposal), /source_configuration_unavailable/); assert.equal(f.passed, undefined);
  f.ports.readVerifiedIdentity = async () => ({ sub: "u", activeWorkspace: "w", accountStatus: "active", governanceRoles: ["workspace:owner"], expiresAt: 5000 }); await assert.rejects(resolveMeasurementAccess(f.ports, "source_position_preview", "interactive"), /permission_denied/);
  f.permissions.push("admin.sources.position.preview"); f.ports.readVerifiedIdentity = async () => ({ kind: "service", sub: "s2s:bsmoss", callerProduct: "bsmoss", activeWorkspace: "w", tokenId: "test", expiresAt: 5000 });
  for (const plane of ["interactive", "data"] as const) await assert.rejects(resolveMeasurementAccess(f.ports, "source_position_preview", plane), /permission_denied/);
});
test("position right and full scope are rechecked before missing stale and SQL error responses", async () => {
  for (const failure of ["", "source_context_changed", "sql_failure"]) for (const mode of ["permission", "scope", "expiry"]) {
    const f = fixture(); f.fail(failure); f.after(() => { if (mode === "permission") f.permissions.splice(1); if (mode === "scope") f.positionScope.stationIds = []; if (mode === "expiry") f.expire(); });
    await assert.rejects(f.service.preview("b", f.proposal), /permission_denied|access_expired/);
  }
  const f = fixture(), read = f.ports.readLocalGrant; f.ports.readLocalGrant = async s => { if (s.operation === "source_position_preview") throw Error("authz_unavailable"); return read(s); };
  await assert.rejects(f.service.preview("b", f.proposal), /authz_unavailable/);
});
