import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveMeasurementAccess,
  type AccessPorts,
  type VerifiedIdentity,
  type Coverage,
  type LocalGrant,
} from "./resolve.ts";
import {
  createAuthorizedMeasurements,
  type UnattributedDraft,
} from "./measurements.ts";
import type {
  MeasurementScope,
  MeasurementDraft,
  MeasurementStore,
} from "../measurements/store.ts";

const key = "service.data.uplink_bytes@1";
function fixture() {
  let clock = 1000;
  const calls: string[] = [];
  const identity: VerifiedIdentity = {
    sub: "usr_member",
    activeWorkspace: "w1",
    accountStatus: "active",
    governanceRoles: ["workspace:member"],
    expiresAt: 5000,
  };
  const coverage: Coverage = {
    workspaceId: "w1",
    product: "bsmoss",
    tier: "fixture-tier",
    bundled: false,
    expiresAt: 4000,
  };
  const scope: MeasurementScope = {
    workspaceId: "w1",
    sourceIds: ["source-a"],
    stationIds: ["station-a"],
    metricKeys: [key],
    serviceIds: ["service-mobile"],
    deviceIds: [],
    allowSiteParameters: false,
  };
  const grant: LocalGrant = {
    workspaceId: "w1",
    sub: "usr_member",
    active: true,
    permissions: ["metering.view"],
    scope,
    expiresAt: 3000,
  };
  const ports: AccessPorts = {
    now: () => clock,
    readVerifiedIdentity: async () => {
      calls.push("identity");
      return identity;
    },
    readCoverage: async (workspace) => {
      calls.push("coverage:" + workspace);
      return coverage;
    },
    featuresFor: () => ["metering"],
    readLocalGrant: async (subject) => {
      calls.push(
        "grant:" +
          subject.workspaceId +
          ":" +
          subject.sub +
          ":" +
          subject.operation +
          ":" +
          subject.workspaceOwner,
      );
      return grant;
    },
  };
  return {
    ports,
    calls,
    identity,
    coverage,
    grant,
    scope,
    advance: (n: number) => {
      clock = n;
    },
  };
}
test("trusted identity, C2 gate and local permission resolve in order with finite scope", async () => {
  const f = fixture();
  const access = await resolveMeasurementAccess(f.ports, "view", "interactive");
  assert.deepEqual(f.calls, [
    "identity",
    "coverage:w1",
    "grant:w1:usr_member:view:false",
  ]);
  assert.equal(access.context.sub, "usr_member");
  assert.equal(access.expiresAt, 3000);
  assert.deepEqual(access.scope.serviceIds, ["service-mobile"]);
  assert.deepEqual(access.scope.deviceIds, []);
  assert.equal(access.scope.allowSiteParameters, false);
  assert.deepEqual([...access.context.permissions], ["metering.view"]);
});
test("absent, inactive, incomplete or expired sessions stop before C2", async () => {
  const bad: Partial<VerifiedIdentity>[] = [
    { activeWorkspace: null },
    { sub: "" },
    { accountStatus: "disabled" },
    { accountStatus: null },
    { expiresAt: 1000 },
    { expiresAt: NaN },
    { activeWorkspace: "*" },
  ];
  for (const patch of bad) {
    const f = fixture();
    Object.assign(f.identity, patch);
    await assert.rejects(
      resolveMeasurementAccess(f.ports, "view", "data"),
      /identity_required/,
    );
    assert.deepEqual(f.calls, ["identity"]);
  }
  const f = fixture();
  f.ports.readVerifiedIdentity = async () => null;
  await assert.rejects(
    resolveMeasurementAccess(f.ports, "view", "data"),
    /identity_required/,
  );
  assert.deepEqual(f.calls, []);
});
test("cross-workspace/product, stale and malformed coverage never reaches local grants", async () => {
  for (const patch of [
    { workspaceId: "w2" },
    { product: "yucer" },
    { expiresAt: 999 },
    { tier: "" },
    { bundled: "true" },
  ]) {
    const f = fixture();
    Object.assign(f.coverage, patch);
    await assert.rejects(
      resolveMeasurementAccess(f.ports, "view", "data"),
      /invalid_coverage/,
    );
    assert.equal(f.calls.length, 2);
  }
});
test("bundled coverage enables data only and still needs product feature policy", async () => {
  const f = fixture();
  f.coverage.tier = null;
  f.coverage.bundled = true;
  await assert.rejects(
    resolveMeasurementAccess(f.ports, "view", "interactive"),
    /feature_denied/,
  );
  assert.equal(f.calls.length, 2);
  assert.equal(
    (
      await resolveMeasurementAccess(f.ports, "view", "data")
    ).context.features.has("metering"),
    true,
  );
  f.ports.featuresFor = () => [];
  await assert.rejects(
    resolveMeasurementAccess(f.ports, "view", "data"),
    /feature_denied/,
  );
  f.coverage.bundled = false;
  await assert.rejects(
    resolveMeasurementAccess(f.ports, "view", "data"),
    /feature_denied/,
  );
});
test("unknown tier with conservative product policy and missing features grant nothing", async () => {
  const f = fixture();
  f.coverage.tier = "future-unknown";
  f.ports.featuresFor = (coverage) =>
    coverage.tier === "fixture-tier" ? ["metering"] : [];
  await assert.rejects(
    resolveMeasurementAccess(f.ports, "view", "data"),
    /feature_denied/,
  );
  assert.equal(f.calls.length, 2);
});
test("org owner, workspace manager, bare owner and token business roles cannot bypass local grants", async () => {
  for (const role of [
    "org:owner",
    "workspace:manager",
    "owner",
    "admin",
    "metering.ingest",
  ]) {
    const f = fixture();
    f.identity.governanceRoles = [role];
    f.grant.permissions = [];
    await assert.rejects(
      resolveMeasurementAccess(f.ports, "view", "data"),
      /permission_denied/,
    );
  }
});
test("workspace owner receives operation baseline but no implicit physical or wildcard scope", async () => {
  const f = fixture();
  f.identity.governanceRoles = ["workspace:owner"];
  f.grant.permissions = [];
  const access = await resolveMeasurementAccess(f.ports, "ingest", "data");
  assert.deepEqual([...access.context.permissions], ["metering.ingest"]);
  assert.equal(access.scope.allowSiteParameters, false);
  assert.deepEqual(access.scope.deviceIds, []);
  f.scope.stationIds = ["*"];
  await assert.rejects(
    resolveMeasurementAccess(f.ports, "view", "data"),
    /invalid_scope/,
  );
});
test("stale, disabled and misbound local grants and scope are refused", async () => {
  for (const patch of [
    { workspaceId: "w2" },
    { sub: "usr_else" },
    { active: false },
    { expiresAt: 999 },
  ]) {
    const f = fixture();
    Object.assign(f.grant, patch);
    await assert.rejects(
      resolveMeasurementAccess(f.ports, "view", "data"),
      /permission_denied/,
    );
  }
  const f = fixture();
  f.scope.workspaceId = "w2";
  await assert.rejects(
    resolveMeasurementAccess(f.ports, "view", "data"),
    /scope_workspace_mismatch/,
  );
  const missing = fixture();
  missing.ports.readLocalGrant = async () => null;
  await assert.rejects(
    resolveMeasurementAccess(missing.ports, "view", "data"),
    /permission_denied/,
  );
});
test("access snapshots cannot be expanded through original arrays or frozen Set mutation", async () => {
  const f = fixture();
  const features = ["metering"];
  f.ports.featuresFor = () => features;
  const access = await resolveMeasurementAccess(f.ports, "view", "data");
  features.push("settlement");
  (f.scope.stationIds as string[]).push("station-b");
  (f.grant.permissions as string[]).push("metering.ingest");
  assert.equal(access.context.features.has("settlement"), false);
  assert.deepEqual(access.scope.stationIds, ["station-a"]);
  assert.equal(access.context.permissions.has("metering.ingest"), false);
  assert.equal("add" in access.context.permissions, false);
  assert.throws(() => {
    (access.scope.stationIds as string[]).push("station-c");
  }, TypeError);
});
test("each request rereads identity, workspace and revocation instead of retaining access", async () => {
  const f = fixture();
  await resolveMeasurementAccess(f.ports, "view", "data");
  f.grant.permissions = [];
  await assert.rejects(
    resolveMeasurementAccess(f.ports, "view", "data"),
    /permission_denied/,
  );
  f.identity.activeWorkspace = "w2";
  await assert.rejects(
    resolveMeasurementAccess(f.ports, "view", "data"),
    /invalid_coverage/,
  );
  assert.deepEqual(f.calls.slice(-2), ["identity", "coverage:w2"]);
});
test("session expiry during async authorization is rechecked before access is returned", async () => {
  const f = fixture();
  f.ports.readLocalGrant = async () => {
    f.advance(6000);
    return f.grant;
  };
  await assert.rejects(
    resolveMeasurementAccess(f.ports, "view", "data"),
    /permission_denied/,
  );
  const slow = fixture();
  slow.identity.expiresAt = 1500;
  slow.ports.readLocalGrant = async () => {
    slow.advance(2000);
    return slow.grant;
  };
  await assert.rejects(
    resolveMeasurementAccess(slow.ports, "view", "data"),
    /access_expired/,
  );
});

const draft: UnattributedDraft = {
  sourceId: "source-a",
  eventId: "event-1",
  revision: "1",
  previousRevision: null,
  payloadSha256: "a".repeat(64),
  payloadUri: "fixture://payload",
  occurredAt: "2026-10-25T00:00:00Z",
  metric: { code: "service.data.uplink_bytes", version: 1 },
  componentKey: "uplink",
  stationId: "station-a",
  mappingId: "mapping-a",
  transformVersion: "1",
  periodStart: "2026-10-25T00:00:00Z",
  periodEnd: "2026-10-25T01:00:00Z",
  value: { kind: "integer_delta", value: "100" },
  quality: { status: "verified", ruleVersion: "fixture", reason: "fixture" },
};
const filter = {
  stationId: "station-a",
  metric: draft.metric,
  from: draft.periodStart,
  to: draft.periodEnd,
  limit: 10,
};
function factory() {
  const scopes: MeasurementScope[] = [];
  const rows: MeasurementDraft[] = [];
  const stores = {
    create(scope: MeasurementScope): MeasurementStore {
      scopes.push(scope);
      return {
        workspaceId: scope.workspaceId,
        append: async (row) => {
          rows.push(row);
          return { id: "row", status: "inserted" };
        },
        list: async () => ({ items: [], nextAfterId: null }),
      };
    },
  };
  return { stores, scopes, rows };
}
test("authorized facade derives workspace and author and creates a fresh scoped store per operation", async () => {
  const f = fixture(),
    s = factory();
  f.grant.permissions = ["metering.view", "metering.ingest"];
  const api = createAuthorizedMeasurements(f.ports, s.stores, "data");
  await api.append(draft);
  await api.list(filter);
  assert.equal(s.rows[0].workspaceId, "w1");
  assert.equal(s.rows[0].quality.decidedBy, "usr_member");
  assert.equal(s.scopes.length, 2);
  assert.notEqual(s.scopes[0], s.scopes[1]);
  assert.deepEqual(s.scopes[0].serviceIds, ["service-mobile"]);
});
test("request-supplied identity is refused before any identity or store access", async () => {
  for (const input of [
    { ...draft, workspaceId: "victim" },
    { ...draft, quality: { ...draft.quality, decidedBy: "admin" } },
  ]) {
    const f = fixture(),
      s = factory();
    await assert.rejects(
      createAuthorizedMeasurements(f.ports, s.stores, "data").append(input),
      /untrusted_identity_field/,
    );
    assert.equal(f.calls.length, 0);
    assert.equal(s.scopes.length, 0);
  }
});
test("request-supplied scopes and grants are rejected rather than forwarded to a store", async () => {
  const f = fixture(),
    s = factory(),
    api = createAuthorizedMeasurements(f.ports, s.stores, "data");
  for (const extra of [
    { scope: f.scope },
    { features: ["metering"] },
    { permissions: ["metering.ingest"] },
    { workspaceId: "other" },
  ]) {
    await assert.rejects(
      api.list({ ...filter, ...extra }),
      /untrusted_request_field/,
    );
  }
  await assert.rejects(
    api.append({ ...draft, ...{ scope: f.scope } }),
    /untrusted_request_field/,
  );
  assert.equal(f.calls.length, 0);
  assert.equal(s.scopes.length, 0);
});
test("request payload is snapshotted before asynchronous identity resolution", async () => {
  const f = fixture(),
    s = factory();
  f.grant.permissions = ["metering.ingest"];
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  f.ports.readVerifiedIdentity = async () => {
    await pending;
    return f.identity;
  };
  const input = structuredClone(draft);
  const write = createAuthorizedMeasurements(f.ports, s.stores, "data").append(
    input,
  );
  input.sourceId = "forbidden-source";
  input.quality.reason = "changed";
  release();
  await write;
  assert.equal(s.rows[0].sourceId, "source-a");
  assert.equal(s.rows[0].quality.reason, "fixture");
});
test("denied permissions and unavailable providers do not construct stores or reuse earlier access", async () => {
  const f = fixture(),
    s = factory(),
    api = createAuthorizedMeasurements(f.ports, s.stores, "data");
  await assert.rejects(api.append(draft), /permission_denied/);
  await api.list(filter);
  assert.equal(s.scopes.length, 1);
  f.ports.readCoverage = async () => {
    throw Error("coverage_unavailable");
  };
  await assert.rejects(api.list(filter), /coverage_unavailable/);
  assert.equal(s.scopes.length, 1);
  assert.equal(s.rows.length, 0);
});
test("store workspace mismatch and expiry at construction stop measurement IO", async () => {
  const f = fixture(),
    s = factory();
  const wrong = {
    create: (scope: MeasurementScope) => ({
      ...s.stores.create(scope),
      workspaceId: "other",
    }),
  };
  await assert.rejects(
    createAuthorizedMeasurements(f.ports, wrong, "data").list(filter),
    /workspace_mismatch/,
  );
  const expired = {
    create: (scope: MeasurementScope) => {
      f.advance(5000);
      return s.stores.create(scope);
    },
  };
  await assert.rejects(
    createAuthorizedMeasurements(f.ports, expired, "data").list(filter),
    /access_expired/,
  );
  assert.equal(s.rows.length, 0);
});
