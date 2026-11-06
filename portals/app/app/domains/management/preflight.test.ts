import { test } from "node:test";
import assert from "node:assert/strict";
import { assertMappingBaseline, mappingProposal, mappingPreflightResult } from "./preflight-rules.ts";
import { mappingPreflight } from "./preflight-service.ts";
import { preflightCommand } from "./preflight-http.ts";
import type { AccessPorts, VerifiedIdentity } from "../access/resolve.ts";
import type { MappingRecord } from "./mapping-rules.ts";
const at = (month: string) => `2026-${month}-01T00:00:00.123456Z`;
const record: MappingRecord = { id: "map", sourceId: "src", externalType: "cell", externalId: "external", stationId: "st", stationName: "Station", serviceId: "svc", networkObjectId: "cell", networkKind: "cell", deviceId: null, version: "9007199254740993", validFrom: at("02"), validTo: at("06"), kind: "network", serviceFrom: at("01"), serviceTo: at("12"), serviceCoversMapping: true };
const proposal = () => ({ expected: { version: record.version, validFrom: record.validFrom, validTo: record.validTo }, proposed: { version: "9007199254740994", validFrom: at("01"), validTo: at("07") }, basis: { reference: "review:fixture", sha256: "a".repeat(64) } });
function fixture() {
  let now = 1000, reads = 0, after = () => {}, failure = "";
  let identity: VerifiedIdentity | null = { sub: "u", activeWorkspace: "w", accountStatus: "active", governanceRoles: [], expiresAt: 5000 };
  const scope = { workspaceId: "w", sourceIds: ["src"], stationIds: ["st"], serviceIds: ["svc"], deviceIds: [] as string[], metricKeys: [] as string[], allowSiteParameters: false };
  const grant = { workspaceId: "w", sub: "u", active: true, permissions: ["admin.mappings.preflight"], scope, expiresAt: 5000 };
  const ports: AccessPorts = { now: () => now, readVerifiedIdentity: async () => identity, readCoverage: async () => ({ workspaceId: "w", product: "bsmoss", tier: "test", bundled: false, expiresAt: 5000 }), readLocalGrant: async () => grant, featuresFor: () => ["metering"] };
  const service = mappingPreflight(ports, { create: () => ({ workspaceId: "w", preview: async () => { reads++; after(); if (failure) throw Error(failure); return null; } }) });
  return { ports, grant, scope, service, get reads() { return reads; }, after: (f: () => void) => after = f, fail: (v: string) => failure = v, expire: () => now = 6000, identity: (v: VerifiedIdentity | null) => identity = v };
}
test("preflight rejects unknown identities, scope or approval fields and malformed exact intervals", () => {
  const p = proposal();
  for (const v of [{ ...p, workspaceId: "w" }, { ...p, approvedBy: "u" }, { ...p, proposed: { ...p.proposed, stationId: "other" } }, { ...p, expected: { ...p.expected, version: 1 } }, { ...p, proposed: { ...p.proposed, validFrom: "2026-02-30T00:00:00.000000Z" } }, { ...p, proposed: { ...p.proposed, validTo: p.proposed.validFrom } }, { ...p, proposed: { ...p.proposed, validFrom: "2026-01-01T00:00:00.123Z" } }, { ...p, basis: { ...p.basis, sha256: "A".repeat(64) } }, { ...p, basis: { ...p.basis, reference: "*" } }, null]) assert.throws(() => mappingProposal(v), /invalid_mapping_proposal/);
  assert.deepEqual(mappingProposal(p), p);
});
test("preflight baseline is exact and version governance requires a bounded numeric successor", () => {
  const p = proposal(); assertMappingBaseline(record, p);
  for (const key of ["version", "validFrom", "validTo"] as const) assert.throws(() => assertMappingBaseline(record, { ...p, expected: { ...p.expected, [key]: key === "version" ? "2" : at("03") } }), /mapping_context_changed/);
  for (const version of [record.version, "9007199254740995"]) assert.throws(() => assertMappingBaseline(record, { ...p, proposed: { ...p.proposed, version } }), /invalid_mapping_proposal/);
  assert.throws(() => mappingProposal({ ...p, proposed: { ...p.proposed, version: "1".repeat(31) } }), /invalid_mapping_proposal/);
  assert.throws(() => assertMappingBaseline(record, { ...p, proposed: { ...p.proposed, validFrom: record.validFrom, validTo: record.validTo } }), /mapping_proposal_unchanged/);
});
test("coverage differences preserve microseconds for extension contraction and disjoint moves", () => {
  const p = proposal(), r = mappingPreflightResult(record, p, false, at("11"));
  assert.deepEqual(r.changedWindows, [{ from: at("01"), to: at("02"), change: "added" }, { from: at("06"), to: at("07"), change: "added" }]);
  const narrow = mappingPreflightResult(record, { ...p, proposed: { ...p.proposed, validFrom: at("03"), validTo: at("05") } }, false, at("11"));
  assert.deepEqual(narrow.changedWindows, [{ from: at("02"), to: at("03"), change: "removed" }, { from: at("05"), to: at("06"), change: "removed" }]);
  const move = mappingPreflightResult(record, { ...p, proposed: { ...p.proposed, validFrom: at("08"), validTo: at("09") } }, false, at("11"));
  assert.deepEqual(move.changedWindows, [{ from: at("02"), to: at("06"), change: "removed" }, { from: at("08"), to: at("09"), change: "added" }]);
  const micro = mappingPreflightResult(record, { ...p, proposed: { ...p.proposed, validFrom: record.validFrom.replace("123456", "123457"), validTo: record.validTo } }, false, at("11"));
  assert.equal(micro.changedWindows[0].to, "2026-02-01T00:00:00.123457Z");
});
test("preflight never equates scoped checks with global safety or downstream zero impact", () => {
  const r = mappingPreflightResult(record, proposal(), false, at("11"));
  assert.equal(r.assessment, "needs_review"); assert.equal(r.checks.overlapCoverage, "authorized_scope_only"); assert.equal(r.basis.verification, "not_verified");
  assert.deepEqual(r.downstream, { aggregates: "not_assessed", reports: "not_assessed", intakeTasks: "not_assessed" });
  assert.equal(mappingPreflightResult(record, proposal(), true, at("11")).assessment, "blocked");
  const uncovered = mappingPreflightResult({ ...record, serviceTo: at("05") }, proposal(), false, at("11")); assert.equal(uncovered.assessment, "blocked");
  assert.equal(mappingPreflightResult({ ...record, serviceId: null, serviceFrom: null, serviceTo: null }, proposal(), false, at("11")).checks.serviceCoverage, "not_applicable");
  assert.equal(r.draftDigest.length, 64); assert.equal(r.draftDigest, mappingPreflightResult(record, proposal(), false, at("10")).draftDigest);
  assert.notEqual(r.draftDigest, mappingPreflightResult(record, { ...proposal(), basis: { reference: "other", sha256: "b".repeat(64) } }, false, at("11")).draftDigest);
});
test("preflight requires independent permission and denies owner or machine bypass before parsing", async () => {
  for (const permission of ["admin.mappings.view", "admin.sources.view", "metering.ingest"]) {
    const f = fixture(); f.grant.permissions = [permission]; f.identity({ sub: "u", activeWorkspace: "w", accountStatus: "active", governanceRoles: ["workspace:owner"], expiresAt: 5000 });
    await assert.rejects(f.service.preview("*", {}), /permission_denied/); assert.equal(f.reads, 0);
  }
  const f = fixture(); f.identity({ kind: "service", sub: "s2s:bsmoss", callerProduct: "bsmoss", activeWorkspace: "w", expiresAt: 5000, tokenId: "test" }); await assert.rejects(f.service.preview("map", proposal()), /permission_denied/);
  const g = fixture(); g.identity(null); await assert.rejects(g.service.preview("*", {}), /identity_required/);
  const h = fixture(); h.ports.featuresFor = () => []; await assert.rejects(h.service.preview("*", {}), /feature_denied/);
});
test("empty missing stale and SQL error preflight paths all revalidate access before disclosure", async () => {
  for (const failure of ["", "mapping_context_changed", "sql_failure"]) for (const mode of ["permission", "scope", "identity", "expiry"]) {
    const f = fixture(); f.fail(failure); f.after(() => {
      if (mode === "permission") f.grant.permissions = [];
      if (mode === "scope") f.scope.metricKeys.push("changed");
      if (mode === "identity") f.identity({ sub: "other", activeWorkspace: "w", accountStatus: "active", governanceRoles: [], expiresAt: 5000 });
      if (mode === "expiry") f.expire();
    });
    await assert.rejects(f.service.preview("map", proposal()), /permission_denied|access_expired/);
  }
  const f = fixture(); await assert.rejects(f.service.preview("missing", proposal()), /mapping_unavailable/);
  f.fail("sql_failure"); await assert.rejects(f.service.preview("map", proposal()), /sql_failure/);
});
test("preflight HTTP enforces identity origin JSON bounds query restrictions and private output", async () => {
  const session = { enabled: true, sid: "opaque", appOrigin: "http://localhost" }; let calls = 0;
  const execute = async () => { calls++; return { checked: true }; };
  const request = (headers: Record<string, string> = {}, body = "{}", query = "") => new Request("http://localhost/api/preflight" + query, { method: "POST", headers: { origin: "http://localhost", "content-type": "application/json", ...headers }, body });
  assert.equal((await preflightCommand(request(), { ...session, sid: undefined }, execute)).status, 401);
  assert.equal((await preflightCommand(request({ origin: "http://foreign" }), session, execute)).status, 403);
  assert.equal((await preflightCommand(request({ "content-type": "text/plain" }), session, execute)).status, 415);
  assert.equal((await preflightCommand(request({}, "{}", "?scope=x"), session, execute)).status, 400);
  assert.equal((await preflightCommand(request({}, "{"), session, execute)).status, 400);
  assert.equal((await preflightCommand(request({}, " ".repeat(8193)), session, execute)).status, 413); assert.equal(calls, 0);
  const r = await preflightCommand(request(), session, execute); assert.equal(r.status, 200); assert.equal(calls, 1); assert.equal(r.headers.get("cache-control"), "no-store"); assert.ok(r.headers.get("vary")?.includes("Cookie")); assert.equal(r.headers.get("x-content-type-options"), "nosniff");
});
test("preflight HTTP keeps stale invalid missing forbidden and infrastructure failures distinct", async () => {
  for (const [error, status] of [["mapping_context_changed", 409], ["invalid_mapping_proposal", 400], ["mapping_proposal_unchanged", 400], ["mapping_unavailable", 404], ["permission_denied", 403], ["sql_failure", 503]] as const) {
    const r = await preflightCommand(new Request("http://localhost/api/preflight", { method: "POST", headers: { origin: "http://localhost", "content-type": "application/json" }, body: "{}" }), { enabled: true, sid: "opaque", appOrigin: "http://localhost" }, async () => { throw Error(error); }); assert.equal(r.status, status); assert.ok(!(await r.text()).includes("sql_failure"));
  }
});
