import { test } from "node:test";
import assert from "node:assert/strict";
import type { PoolClient } from "pg";
import { aggregateImpactRecord, reportMappingReferences, mappingSubject } from "./mapping-impact-rules.ts";
import { readMappingImpacts } from "./mapping-impact-reader.ts";
import { mappingPreflight } from "./preflight-service.ts";
import { mappingPreflightResult } from "./preflight-rules.ts";
import { resolveMeasurementAccess, type AccessPorts, type VerifiedIdentity } from "../access/resolve.ts";
import { bucketFor } from "../aggregation/periods.ts";
import { aggregateIntervals, type AggregationPlan } from "../aggregation/intervals.ts";
import type { ReportManifest } from "../reports/rules.ts";
import type { MappingRecord } from "./mapping-rules.ts";
const scope = { workspaceId: "w", sourceIds: ["src"], stationIds: ["st"], serviceIds: ["svc"], deviceIds: [] as string[], metricKeys: ["service.data.uplink_bytes@1"], allowSiteParameters: false };
const mapping: MappingRecord = { id: "map", sourceId: "src", stationId: "st", stationName: "Station", serviceId: "svc", networkObjectId: "cell", networkKind: "cell", deviceId: null, kind: "network", externalType: "cell", externalId: "cell", version: "1", validFrom: "2026-01-01T00:00:00.000000Z", validTo: "2027-01-01T00:00:00.000000Z", serviceFrom: "2026-01-01T00:00:00.000000Z", serviceTo: "2027-01-01T00:00:00.000000Z", serviceCoversMapping: true };
const proposal = { expected: { version: "1", validFrom: mapping.validFrom, validTo: mapping.validTo }, proposed: { version: "2", validFrom: mapping.validFrom, validTo: "2026-12-31T00:00:00.000000Z" }, basis: { reference: "fixture", sha256: "a".repeat(64) } };
const period = bucketFor("2026-01-01T00:00:00+08:00", "day");
const plan: AggregationPlan = { workspaceId: "w", sourceId: "src", subjectKey: mappingSubject(mapping), metric: { code: "service.data.uplink_bytes", version: 1 }, authorityVersion: "a".repeat(64), inputMode: "direct", grain: "day", period, nativeGrain: "day", mappingWindows: [{ mappingId: "map", mappingVersion: "9007199254740993", period }], sourceComplete: false, watermark: period.start };
test("mapping aggregate evidence is replayed exactly rather than trusting the stored value or fingerprint alone", () => {
  const result = aggregateIntervals(plan, []);
  const row = { workspace_id: "w", source_id: "src", subject_key: plan.subjectKey, metric_code: plan.metric.code, metric_version: "1", grain: "day", period_start: new Date(period.start), period_end: new Date(period.end), revision: "9007199254740993", series_id: "series", input_manifest: { plan, inputs: [] }, input_fingerprint: result.inputFingerprint, aggregation_version: result.aggregationVersion, result_payload: result };
  assert.equal(aggregateImpactRecord(row, mapping, scope).revision, "9007199254740993");
  for (const patch of [{ result_payload: { ...result, knownValue: { kind: "integer", value: "1000" } } }, { input_fingerprint: "0".repeat(64) }, { workspace_id: "other" }, { subject_key: "another-object" }, { metric_version: "2" }, { revision: "0" }]) assert.throws(() => aggregateImpactRecord({ ...row, ...patch }, mapping, scope), /invalid_mapping_aggregate_evidence/);
  assert.throws(() => aggregateImpactRecord(row, { ...mapping, id: "unreferenced" }, scope), /invalid_mapping_aggregate_evidence/);
});
test("report mapping references include daily publications, peer mappings and rollup authority but ignore incidental titles", () => {
  const m = (data: any, daily: any[] = []) => ({ items: [{ panel: { title: "map" }, data, dailyDependencies: daily.map(data => ({ data })) }] }) as unknown as ReportManifest;
  const direct = { kind: "aggregate", query: { mappingId: "map" }, publication: null };
  const other = { kind: "aggregate", query: { mappingId: "other" }, publication: null };
  assert.equal(reportMappingReferences(m(direct), "map"), true);
  assert.equal(reportMappingReferences(m(other, [direct]), "map"), true);
  assert.equal(reportMappingReferences(m({ ...other, publication: { result: { mappingWindows: [{ mappingId: "map" }], evidence: [] } } }), "map"), true);
  assert.equal(reportMappingReferences(m({ kind: "rollup", result: { members: [{ mappingId: "other", publication: { authorityRevisions: [{ kind: "source_mapping", id: "map", revision: "9" }] } }] } }), "map"), true);
  assert.equal(reportMappingReferences(m({ kind: "rollup", result: { members: [{ mappingId: "map", publication: null }] } }), "map"), true);
  assert.equal(reportMappingReferences(m(other), "map"), false);
  assert.equal(reportMappingReferences(m({ kind: "not_connected" }), "map"), false);
});
test("no dependency table is queried without its independent full mapping scope", async () => {
  let reads = 0; const c = { query: async () => { reads++; throw Error("must_not_query"); } } as unknown as PoolClient;
  const expected = { aggregates: { status: "not_authorized" }, reports: { status: "not_authorized" } };
  assert.deepEqual(await readMappingImpacts(c, mapping, "w"), expected);
  for (const s of [{ ...scope, workspaceId: "other" }, { ...scope, sourceIds: [] }, { ...scope, stationIds: [] }, { ...scope, serviceIds: [] }]) assert.deepEqual(await readMappingImpacts(c, mapping, "w", { aggregates: s, reports: s }), expected);
  assert.deepEqual(await readMappingImpacts(c, { ...mapping, serviceId: null, networkObjectId: null }, "w", { aggregates: scope, reports: scope }), expected);
  assert.equal(reads, 0);
});
function fixture() {
  let now = 1000, after = () => {}, failure = "", passed: any, identities: VerifiedIdentity | null = { sub: "u", activeWorkspace: "w", accountStatus: "active", governanceRoles: [], expiresAt: 5000 };
  const permissions = ["admin.mappings.preflight", "admin.mappings.aggregate_impact.view", "admin.mappings.report_impact.view"];
  const scopes = { aggregates: structuredClone(scope), reports: structuredClone(scope) };
  const ports: AccessPorts = { now: () => now, readVerifiedIdentity: async () => identities, readCoverage: async () => ({ workspaceId: "w", product: "bsmoss", tier: "test", bundled: false, expiresAt: 5000 }), readLocalGrant: async s => ({ workspaceId: "w", sub: "u", active: true, permissions, scope: s.operation === "mapping_aggregates_impact_view" ? scopes.aggregates : s.operation === "mapping_reports_impact_view" ? scopes.reports : scope, expiresAt: 5000 }), featuresFor: () => ["metering"] };
  const service = mappingPreflight(ports, { create: () => ({ workspaceId: "w", preview: async (_id, _p, impact) => { passed = impact; after(); if (failure) throw Error(failure); return mappingPreflightResult(mapping, proposal, false, "2026-11-07T00:00:00Z"); } }) });
  return { ports, service, permissions, scopes, get passed() { return passed; }, after: (f: () => void) => after = f, fail: (f: string) => failure = f, expire: () => now = 6000, identity: (i: VerifiedIdentity | null) => identities = i };
}
test("aggregate and report rights are optional, independent and never inherited by owner or machine", async () => {
  const f = fixture(); f.permissions.splice(1); await f.service.preview("map", proposal); assert.deepEqual(f.passed, { aggregates: undefined, reports: undefined });
  for (const k of ["aggregates", "reports"] as const) {
    const f = fixture(); f.permissions.splice(k === "aggregates" ? 2 : 1, 1); await f.service.preview("map", proposal);
    assert.deepEqual(f.passed[k], scope); assert.equal(f.passed[k === "aggregates" ? "reports" : "aggregates"], undefined);
  }
  const g = fixture(); g.permissions.splice(1); g.identity({ sub: "u", activeWorkspace: "w", accountStatus: "active", governanceRoles: ["workspace:owner"], expiresAt: 5000 });
  for (const operation of ["mapping_aggregates_impact_view", "mapping_reports_impact_view"] as const) await assert.rejects(resolveMeasurementAccess(g.ports, operation, "interactive"), /permission_denied/);
  const h = fixture(); h.identity({ kind: "service", sub: "s2s:bsmoss", callerProduct: "bsmoss", activeWorkspace: "w", expiresAt: 5000, tokenId: "test" });
  for (const operation of ["mapping_aggregates_impact_view", "mapping_reports_impact_view"] as const) for (const plane of ["interactive", "data"] as const) await assert.rejects(resolveMeasurementAccess(h.ports, operation, plane), /permission_denied/);
});
test("both impact rights are rechecked after success stale missing and storage failures", async () => {
  for (const k of ["aggregates", "reports"] as const) for (const failure of ["", "mapping_context_changed", "mapping_unavailable", "sql_failure"]) for (const mode of ["permission", "scope", "expiry"]) {
    const f = fixture(); f.fail(failure); f.after(() => { if (mode === "permission") f.permissions.splice(f.permissions.indexOf(k === "aggregates" ? "admin.mappings.aggregate_impact.view" : "admin.mappings.report_impact.view"), 1); if (mode === "scope") f.scopes[k].stationIds = []; if (mode === "expiry") f.expire(); });
    await assert.rejects(f.service.preview("map", proposal), /permission_denied|access_expired/);
  }
});
test("impact authorization backend failures are never downgraded to no impact", async () => {
  const f = fixture(), read = f.ports.readLocalGrant; f.ports.readLocalGrant = async s => { if (s.operation === "mapping_reports_impact_view") throw Error("authz_unavailable"); return read(s); };
  await assert.rejects(f.service.preview("map", proposal), /authz_unavailable/);
});
