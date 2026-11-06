import { test } from "node:test";
import assert from "node:assert/strict";
import { mappingRecord, mappingQuery } from "./mapping-rules.ts";
import { mappingManagement } from "./mapping-service.ts";
import { managementHttpError } from "./http.ts";
import type { AccessPorts, VerifiedIdentity } from "../access/resolve.ts";
import type { MappingReader } from "./mapping-reader.ts";
function fixture() {
  const scope = { workspaceId: "w", sourceIds: ["src"], stationIds: ["st"], serviceIds: ["svc"], deviceIds: ["dev"], metricKeys: ["m"], allowSiteParameters: true };
  let identity: VerifiedIdentity | null = { sub: "u", activeWorkspace: "w", accountStatus: "active", governanceRoles: [], expiresAt: 5000 }, clock = 1000, reads = 0, after = () => {};
  const grant = { workspaceId: "w", sub: "u", active: true, permissions: ["admin.mappings.view"], scope, expiresAt: 4000 };
  const ports: AccessPorts = { now: () => clock, readVerifiedIdentity: async () => identity, readCoverage: async () => ({ workspaceId: "w", product: "bsmoss", tier: "test", bundled: false, expiresAt: 5000 }), readLocalGrant: async () => grant, featuresFor: () => ["metering"] };
  const reader: MappingReader = { workspaceId: "w", list: async () => { reads++; after(); return { items: [], next: null, capturedAt: "2026-11-06T00:00:00Z" }; }, read: async () => { reads++; after(); return null; } };
  return { scope, grant, ports, reader, service: mappingManagement(ports, { create: () => reader }), get reads() { return reads; }, after: (f: () => void) => after = f, identity: (v: VerifiedIdentity | null) => identity = v, expire: () => clock = 6000 };
}
const row = () => ({ workspace_id: "w", id: "map", source_id: "src", external_type: "cell", external_id: "external", station_id: "st", station_name: "Station", linked_station: "st", service_id: "svc", network_object_id: "cell", device_id: null, version: "9007199254740993", valid_from: "2026-01-01T00:00:00.000001Z", valid_to: "2027-01-01T00:00:00.000001Z", service_from: "2026-01-01T00:00:00.000000Z", service_to: "2027-01-01T00:00:00.000001Z", service_station: "st", network_station: "st", network_service: "svc", network_kind: "cell", device_station: null });
test("mapping query rejects forged scope, duplicate fields and malformed pagination", () => {
  for (const q of ["workspace=w", "kind=station", "kind=all&kind=site", "search=*", "search=%00", "search=%20x", "limit=51", "limit=01", "after=", "after=*"]) assert.throws(() => mappingQuery(new URLSearchParams(q)), /invalid_management_query/);
  assert.deepEqual(mappingQuery(new URLSearchParams("search=%25&kind=network&limit=1&after=map")), { search: "%", kind: "network", limit: 1, after: "map" });
});
test("mapping projection preserves precision and detects uncovered service intervals", () => {
  const f = fixture(), r = row(), m = mappingRecord(r, f.scope);
  assert.equal(m.version, "9007199254740993"); assert.equal(m.validFrom, r.valid_from); assert.equal(m.kind, "network"); assert.equal(m.serviceCoversMapping, true);
  assert.equal(mappingRecord({ ...r, service_from: "2026-01-01T00:00:00.000002Z" }, f.scope).serviceCoversMapping, false);
  assert.equal(mappingRecord({ ...r, service_to: "2027-01-01T00:00:00.000000Z" }, f.scope).serviceCoversMapping, false);
});
test("mapping projection enforces every object scope and physical parameter permission", () => {
  const f = fixture(), r = row();
  for (const dim of ["sourceIds", "stationIds", "serviceIds"] as const) assert.throws(() => mappingRecord(r, { ...f.scope, [dim]: [] }), /invalid_mapping_record/);
  const device = { ...r, network_object_id: null, network_kind: null, device_id: "dev", device_station: "st" };
  assert.equal(mappingRecord(device, f.scope).kind, "device");
  assert.throws(() => mappingRecord(device, { ...f.scope, deviceIds: [] }), /invalid_mapping_record/);
  assert.throws(() => mappingRecord(device, { ...f.scope, serviceIds: [] }), /invalid_mapping_record/);
  const physical = { ...r, service_id: null, network_object_id: null, network_kind: null, service_from: null, service_to: null };
  assert.equal(mappingRecord(physical, f.scope).kind, "site"); assert.equal(mappingRecord(physical, f.scope).serviceCoversMapping, null);
  assert.throws(() => mappingRecord(physical, { ...f.scope, allowSiteParameters: false }), /invalid_mapping_record/);
});
test("malformed mappings and broken composite relations fail closed", () => {
  for (const patch of [{ workspace_id: "other" }, { version: "1".repeat(31) }, { valid_from: "2026-02-30T00:00:00.000000Z" }, { valid_to: row().valid_from }, { linked_station: "other" }, { network_station: "other" }, { network_service: "other" }, { network_kind: "unknown" }, { service_station: "other" }, { device_id: "dev", device_station: "st" }, { service_id: null }]) assert.throws(() => mappingRecord({ ...row(), ...patch }, fixture().scope), /invalid_mapping_record/);
});
test("mapping inspection is independent of source, ingest and owner rights; machines denied", async () => {
  for (const permission of ["metering.ingest", "admin.sources.view", "admin.configuration_audit.view"]) {
    const f = fixture(); f.grant.permissions = [permission]; f.identity({ sub: "u", activeWorkspace: "w", accountStatus: "active", governanceRoles: ["workspace:owner"], expiresAt: 5000 });
    await assert.rejects(f.service.list(new URLSearchParams()), /permission_denied/); assert.equal(f.reads, 0);
  }
  const f = fixture(); f.identity({ kind: "service", sub: "s2s:bsmoss", callerProduct: "bsmoss", activeWorkspace: "w", expiresAt: 5000, tokenId: "test" }); await assert.rejects(f.service.list(new URLSearchParams()), /permission_denied/);
});
test("mapping identity and platform gates precede parsing or database reads", async () => {
  const f = fixture(); f.identity(null); await assert.rejects(f.service.list(new URLSearchParams("scope=x")), /identity_required/); assert.equal(f.reads, 0);
  const g = fixture(); g.ports.featuresFor = () => []; await assert.rejects(g.service.read("*", new URLSearchParams()), /feature_denied/); assert.equal(g.reads, 0);
});
test("mapping empty and missing reads revalidate permission, scope, identity and expiry", async () => {
  for (const detail of [false, true]) for (const mutate of [(f: ReturnType<typeof fixture>) => { f.grant.permissions = []; }, (f: ReturnType<typeof fixture>) => f.scope.metricKeys.push("changed"), (f: ReturnType<typeof fixture>) => f.expire(), (f: ReturnType<typeof fixture>) => f.identity({ sub: "other", activeWorkspace: "w", accountStatus: "active", governanceRoles: [], expiresAt: 5000 })]) {
    const f = fixture(); f.after(() => mutate(f)); await assert.rejects(detail ? f.service.read("missing", new URLSearchParams()) : f.service.list(new URLSearchParams()), /permission_denied|access_expired/);
  }
  const f = fixture(); await assert.rejects(f.service.read("missing", new URLSearchParams()), /mapping_unavailable/); await assert.rejects(f.service.read("map", new URLSearchParams("revision=1")), /invalid_management_query/);
});
test("mapping SQL errors do not become empty results and shared errors keep stable 404 codes", async () => {
  const f = fixture(); f.reader.list = async () => { throw Error("sql_failure"); }; await assert.rejects(f.service.list(new URLSearchParams()), /sql_failure/);
  for (const [code, expected] of [["mapping_unavailable", "MAPPING_UNAVAILABLE"], ["member_unavailable", "MEMBER_UNAVAILABLE"], ["source_configuration_unavailable", "SOURCE_CONFIGURATION_UNAVAILABLE"]]) { const r = managementHttpError(Error(code)); assert.equal(r.status, 404); assert.match(await r.text(), new RegExp(expected)); }
});
