import { test } from "node:test";
import assert from "node:assert/strict";
import { fingerprintOf } from "../aggregation/intervals.ts";
import { sourceProposal, proposedSourceBinding, sourcePreflightResult } from "./source-preflight-rules.ts";
import { sourcePreflight } from "./source-preflight-service.ts";
import { preflightCommand } from "./preflight-http.ts";
import type { AccessPorts, VerifiedIdentity } from "../access/resolve.ts";
import type { MeasurementScope } from "../measurements/store.ts";
import type { SourceRecord } from "./source-rules.ts";
const scope: MeasurementScope = { workspaceId: "w", sourceIds: ["src"], stationIds: ["A", "B"], serviceIds: ["sa", "sb"], deviceIds: ["da", "db"], metricKeys: ["service.data.uplink_bytes@1", "service.data.downlink_bytes@1"], allowSiteParameters: true };
const binding = { id: "binding", revision: "9007199254740993", sourceId: "src", adapterVersion: "a1", transformVersion: "t1", coverageStart: "2026-01-01T00:00:00.000Z", scope: { ...scope, stationIds: ["A"], serviceIds: ["sa"], deviceIds: ["da"], metricKeys: ["service.data.uplink_bytes@1"], allowSiteParameters: false } };
const record: SourceRecord = { ...binding, status: "active", recordedAt: "2026-11-06T00:00:00.000001Z", counts: { stations: 1, services: 1, devices: 1, metrics: 1 }, binding, digest: fingerprintOf(binding), reviewRef: "registered-review", databaseActor: "db-service" };
const draft = () => ({ expected: { revision: record.revision, digest: record.digest }, proposed: { revision: "9007199254740994", status: "paused" as const, adapterVersion: "a1", transformVersion: "t1", coverageStart: binding.coverageStart, scope: { stationIds: ["A"], serviceIds: ["sa"], deviceIds: ["da"], metricKeys: ["service.data.uplink_bytes@1"], allowSiteParameters: false } }, basis: { reference: "review:fixture", sha256: "a".repeat(64) } });
function fixture() {
  let now = 1000, reads = 0, failure = "", after = () => {};
  let identity: VerifiedIdentity | null = { sub: "u", activeWorkspace: "w", accountStatus: "active", governanceRoles: [], expiresAt: 5000 };
  const grant = { workspaceId: "w", sub: "u", active: true, permissions: ["admin.sources.preflight"], scope: structuredClone(scope), expiresAt: 5000 };
  const ports: AccessPorts = { now: () => now, readVerifiedIdentity: async () => identity, readCoverage: async () => ({ workspaceId: "w", product: "bsmoss", tier: "test", bundled: false, expiresAt: 5000 }), readLocalGrant: async () => grant, featuresFor: () => ["metering"] };
  const service = sourcePreflight(ports, { create: () => ({ workspaceId: "w", preview: async () => { reads++; after(); if (failure) throw Error(failure); return null; } }) });
  return { ports, grant, service, get reads() { return reads; }, fail: (v: string) => failure = v, after: (f: () => void) => after = f, expire: () => now = 6000, identity: (v: VerifiedIdentity | null) => identity = v };
}
test("source proposal rejects tenant identity approval injection and malformed scope or evidence", () => {
  const p = draft();
  for (const v of [null, { ...p, workspaceId: "w" }, { ...p, approvedBy: "agent" }, { ...p, proposed: { ...p.proposed, sourceId: "other" } }, { ...p, proposed: { ...p.proposed, status: "enabled" } }, { ...p, expected: { ...p.expected, revision: 1 } }, { ...p, expected: { ...p.expected, digest: "A".repeat(64) } }, { ...p, proposed: { ...p.proposed, revision: "1".repeat(31) } }, { ...p, proposed: { ...p.proposed, scope: { ...p.proposed.scope, workspaceId: "other" } } }, { ...p, proposed: { ...p.proposed, scope: { ...p.proposed.scope, stationIds: [] } } }, { ...p, proposed: { ...p.proposed, scope: { ...p.proposed.scope, stationIds: ["A", "A"] } } }, { ...p, proposed: { ...p.proposed, scope: { ...p.proposed.scope, deviceIds: ["*"] } } }, { ...p, proposed: { ...p.proposed, scope: { ...p.proposed.scope, serviceIds: "sa" } } }, { ...p, proposed: { ...p.proposed, adapterVersion: "a\n1" } }, { ...p, basis: { ...p.basis, sha256: "f".repeat(63) } }]) assert.throws(() => sourceProposal(v), /invalid_source_proposal/);
  assert.deepEqual(sourceProposal(p), p);
});
test("source coverage start is a real canonical UTC hour rather than an analysis cutoff", () => {
  for (const coverageStart of ["2026-02-30T00:00:00.000Z", "2026-01-01T01:01:00.000Z", "2026-01-01T01:00:00.000001Z", "2026-01-01T00:00:00+08:00", "0000-01-01T00:00:00.000Z", "2026-01-01T24:00:00.000Z"]) assert.throws(() => sourceProposal({ ...draft(), proposed: { ...draft().proposed, coverageStart } }), /invalid_source_proposal/);
  assert.equal(sourceProposal(draft()).proposed.coverageStart, binding.coverageStart);
});
test("source baseline pins exact revision and digest and requires the next numeric revision and a material change", () => {
  const p = sourceProposal(draft());
  assert.equal(proposedSourceBinding(record, p, scope).revision, "9007199254740994");
  for (const expected of [{ ...p.expected, revision: "1" }, { ...p.expected, digest: "b".repeat(64) }]) assert.throws(() => proposedSourceBinding(record, { ...p, expected }, scope), /source_context_changed/);
  for (const revision of [record.revision, "9007199254740995"]) assert.throws(() => proposedSourceBinding(record, { ...p, proposed: { ...p.proposed, revision } }, scope), /invalid_source_proposal/);
  assert.throws(() => proposedSourceBinding(record, { ...p, proposed: { ...p.proposed, status: "active" } }, scope), /source_proposal_unchanged/);
  const reorder = { ...p, proposed: { ...p.proposed, scope: { ...p.proposed.scope, stationIds: ["B", "A"] } } };
  assert.deepEqual(proposedSourceBinding(record, reorder, scope).scope.stationIds, ["A", "B"]);
});
test("source preflight requires complete old and new scope including physical parameter permission", () => {
  const p = sourceProposal(draft());
  for (const key of ["sourceIds", "stationIds", "serviceIds", "deviceIds", "metricKeys"] as const) assert.throws(() => proposedSourceBinding(record, p, { ...scope, [key]: [] }), /permission_denied/);
  for (const key of ["stationIds", "serviceIds", "deviceIds", "metricKeys"] as const) assert.throws(() => proposedSourceBinding(record, { ...p, proposed: { ...p.proposed, scope: { ...p.proposed.scope, [key]: ["outside"] } } }, scope), /permission_denied/);
  assert.throws(() => proposedSourceBinding(record, { ...p, proposed: { ...p.proposed, scope: { ...p.proposed.scope, allowSiteParameters: true } } }, { ...scope, allowSiteParameters: false }), /permission_denied/);
  assert.throws(() => proposedSourceBinding(record, p, { ...scope, workspaceId: "other" }), /permission_denied/);
});
test("source preview reports exact scope additions removals and never claims verified evidence or zero downstream impact", () => {
  const p = sourceProposal({ ...draft(), proposed: { ...draft().proposed, scope: { stationIds: ["B"], serviceIds: ["sb"], deviceIds: ["db"], metricKeys: ["service.data.downlink_bytes@1"], allowSiteParameters: true } } });
  const r = sourcePreflightResult(record, p, scope, [], "2026-11-06T00:00:00Z");
  assert.deepEqual(r.scopeChanges.find(c => c.dimension === "stationIds"), { dimension: "stationIds", added: ["B"], removed: ["A"] });
  assert.ok(r.changedFields.includes("scope.allowSiteParameters")); assert.equal(r.assessment, "needs_review"); assert.equal(r.basis.verification, "not_verified");
  assert.equal(r.checks.adapterCompatibility, "not_verified"); assert.equal(r.checks.sourceCapabilities, "not_assessed"); assert.deepEqual(r.downstream, { aggregates: "not_assessed", reports: "not_assessed" });
  assert.equal(r.intake.oldPositionReuse, "requires_reviewed_rebaseline"); assert.equal(r.intake.existingReceipts, "not_assessed"); assert.equal(r.intake.existingTasks, "not_assessed");
  assert.notEqual(r.proposed.digest, record.digest); assert.equal(r.proposed.binding.scope.workspaceId, "w"); assert.equal(r.proposed.binding.sourceId, record.sourceId);
  const blocked = sourcePreflightResult(record, p, scope, [{ dimension: "serviceIds", id: "sb" }], "2026-11-06T00:00:00Z"); assert.equal(blocked.assessment, "blocked");
  assert.equal(r.draftDigest, sourcePreflightResult(record, p, scope, [], "2026-11-07T00:00:00Z").draftDigest);
});
test("status only source revision still changes digest and cannot inherit the old intake position", () => {
  const r = sourcePreflightResult(record, sourceProposal(draft()), scope, [], "2026-11-06T00:00:00Z");
  assert.deepEqual(r.changedFields, ["status"]); assert.notEqual(r.proposed.digest, record.digest); assert.equal(r.intake.proposedState, "paused");
  const resume = sourcePreflightResult({ ...record, status: "paused" }, { ...sourceProposal(draft()), proposed: { ...sourceProposal(draft()).proposed, status: "active" } }, scope, [], "2026-11-06T00:00:00Z"); assert.equal(resume.intake.proposedState, "requires_verification");
});
test("source preflight has independent interactive rights and denies owner machine or identity bypass", async () => {
  for (const permission of ["admin.sources.view", "admin.configuration_audit.view", "admin.mappings.preflight", "metering.ingest"]) {
    const f = fixture(); f.grant.permissions = [permission]; f.identity({ sub: "u", activeWorkspace: "w", accountStatus: "active", governanceRoles: ["workspace:owner"], expiresAt: 5000 });
    await assert.rejects(f.service.preview("*", {}), /permission_denied/); assert.equal(f.reads, 0);
  }
  const f = fixture(); f.identity({ kind: "service", sub: "s2s:bsmoss", callerProduct: "bsmoss", activeWorkspace: "w", expiresAt: 5000, tokenId: "test" }); await assert.rejects(f.service.preview("x", draft()), /permission_denied/);
  const g = fixture(); g.identity(null); await assert.rejects(g.service.preview("*", {}), /identity_required/);
  const h = fixture(); h.ports.featuresFor = () => []; await assert.rejects(h.service.preview("*", {}), /feature_denied/);
});
test("source preflight revalidates missing stale and failed reads before errors can disclose records", async () => {
  for (const failure of ["", "source_context_changed", "sql_failure"]) for (const mode of ["permission", "scope", "identity", "expiry"]) {
    const f = fixture(); f.fail(failure); f.after(() => {
      if (mode === "permission") f.grant.permissions = [];
      if (mode === "scope") f.grant.scope.metricKeys = [];
      if (mode === "identity") f.identity({ sub: "other", activeWorkspace: "w", accountStatus: "active", governanceRoles: [], expiresAt: 5000 });
      if (mode === "expiry") f.expire();
    }); await assert.rejects(f.service.preview("binding", draft()), /permission_denied|access_expired/);
  }
  const f = fixture(); await assert.rejects(f.service.preview("missing", draft()), /source_configuration_unavailable/);
  f.fail("sql_failure"); await assert.rejects(f.service.preview("binding", draft()), /sql_failure/);
});
test("source preflight HTTP keeps source errors distinct and bounds source bodies separately from mappings", async () => {
  const session = { enabled: true, sid: "opaque", appOrigin: "http://localhost" };
  const request = (body = "{}", headers: Record<string, string> = {}, query = "") => new Request("http://localhost/preflight" + query, { method: "POST", headers: { origin: "http://localhost", "content-type": "application/json", ...headers }, body });
  let calls = 0; const ok = async () => { calls++; return { preview: true }; };
  for (const [req, status] of [[request("{}", { origin: "http://foreign" }), 403], [request("{}", { "content-type": "text/plain" }), 415], [request("{broken"), 400], [request("{}", {}, "?scope=x"), 400], [request(" ".repeat(65537)), 413]] as const) assert.equal((await preflightCommand(req, session, ok, "source")).status, status);
  assert.equal(calls, 0); assert.equal((await preflightCommand(request('"' + "a".repeat(10000) + '"'), session, ok, "source")).status, 200);
  for (const [code, status] of [["source_context_changed", 409], ["invalid_source_proposal", 400], ["source_proposal_unchanged", 400], ["source_configuration_unavailable", 404], ["permission_denied", 403], ["sql_failure", 503]] as const) {
    const r = await preflightCommand(request(), session, async () => { throw Error(code); }, "source"); assert.equal(r.status, status); assert.equal(r.headers.get("cache-control"), "no-store"); assert.ok(r.headers.get("vary")?.includes("Cookie")); assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  }
});
