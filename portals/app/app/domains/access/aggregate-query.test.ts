import { test } from "node:test";
import assert from "node:assert/strict";
import type { Pool } from "pg";
import { createAuthorizedAggregateQuery } from "./aggregate-query.ts";
import type { AccessPorts } from "./resolve.ts";
import { normalizeAggregateQuery, parseAggregateQuery, type AggregateQuery } from "../aggregation/query.ts";
import { PgAggregateQueryReader } from "../aggregation/pg-query.ts";

const input: AggregateQuery = { sourceId: "src", mappingId: "map", metric: { code: "service.data.uplink_bytes", version: 1 }, grain: "day", at: "2026-10-25T18:00:00+08:00" };
function fixture() {
  let clock = 1000, reads = 0, queries = 0;
  const scope = { workspaceId: "w", sourceIds: ["src"], stationIds: ["st"], serviceIds: ["svc"], deviceIds: [], metricKeys: ["service.data.uplink_bytes@1"], allowSiteParameters: false };
  const grant = { workspaceId: "w", sub: "viewer", active: true, permissions: ["metering.view"], scope, expiresAt: 5000 };
  const ports: AccessPorts = { now: () => clock,
    async readVerifiedIdentity() { return { sub: "viewer", activeWorkspace: "w", accountStatus: "active", governanceRoles: [], expiresAt: 5000 }; },
    async readCoverage() { return { workspaceId: "w", product: "bsmoss", tier: "fixture", bundled: false, expiresAt: 5000 }; },
    async readLocalGrant() { reads++; return grant; }, featuresFor() { return ["metering"]; } };
  const readers = { create(finite: typeof scope) { assert.deepEqual(finite, scope); return { workspaceId: "w", async read(request: AggregateQuery) {
    queries++; assert.equal(request.at, "2026-10-24T16:00:00.000Z"); return null;
  } }; } };
  return { ports, readers, grant, scope, get queries() { return queries; }, get reads() { return reads; }, advance() { clock = 6000; } };
}
test("aggregate query accepts view permission and canonical periods and rechecks authority after read", async () => {
  const f = fixture(); assert.equal(await createAuthorizedAggregateQuery(f.ports, f.readers, "interactive").read(input), null);
  assert.equal(f.queries, 1); assert.equal(f.reads, 2); assert.deepEqual(f.grant.permissions, ["metering.view"]);
});
test("aggregate query refuses absent authority before constructing a database reader", async () => {
  const f = fixture();
  for (const denied of [{ ...f.ports, async readVerifiedIdentity() { return null; } },
    { ...f.ports, async readLocalGrant() { return null; } }, { ...f.ports, featuresFor() { return []; } }])
    await assert.rejects(createAuthorizedAggregateQuery(denied, { create() { throw Error("unexpected_io"); } }, "interactive").read(input), /required|denied/);
  assert.equal(f.queries, 0);
});
test("aggregate query drops a completed read when the scope changes, identity expires or permission is revoked", async () => {
  for (const changed of ["scope", "expiry", "permission"] as const) {
    const f = fixture(), readers = { create() { return { workspaceId: "w", async read() {
      if (changed === "scope") f.scope.serviceIds.push("other");
      if (changed === "expiry") f.advance();
      if (changed === "permission") f.grant.active = false;
      return null;
    } }; } };
    await assert.rejects(createAuthorizedAggregateQuery(f.ports, readers, "interactive").read(input), /permission_denied|access_expired/);
  }
  const f = fixture(); await assert.rejects(createAuthorizedAggregateQuery(f.ports, { create() { return { workspaceId: "other", async read() { throw Error("unexpected_io"); } }; } }, "interactive").read(input), /workspace_mismatch/);
});
test("aggregate query rejects authority injection, duplicate selectors, invalid revisions and oversized input before I/O", async () => {
  const query = new URLSearchParams({ sourceId: "src", mappingId: "map", metricCode: input.metric.code, metricVersion: "1", grain: "day", at: input.at });
  assert.equal(parseAggregateQuery(query).at, "2026-10-24T16:00:00.000Z");
  for (const [key, value] of [["workspaceId", "forged"], ["subjectKey", "forged"], ["revision", "0"], ["revision", "9".repeat(31)], ["metricVersion", "1e0"], ["grain", "5m"], ["at", "bad"]]) {
    const params = new URLSearchParams(query); params.set(key!, value!); assert.throws(() => parseAggregateQuery(params));
  }
  const twice = new URLSearchParams(query); twice.append("sourceId", "other"); assert.throws(() => parseAggregateQuery(twice));
  const huge = new URLSearchParams(query); huge.set("mappingId", "x".repeat(4097)); assert.throws(() => parseAggregateQuery(huge));
  assert.throws(() => normalizeAggregateQuery({ ...input, workspaceId: "forged" } as AggregateQuery));
  let calls = 0; const pool = { async connect() { calls++; throw Error("unexpected_io"); } } as unknown as Pool;
  const reader = new PgAggregateQueryReader(pool, fixture().scope);
  await assert.rejects(reader.read({ ...input, revision: "0" })); assert.equal(calls, 0);
});
