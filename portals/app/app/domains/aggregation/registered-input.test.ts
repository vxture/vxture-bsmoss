import { test } from "node:test";
import assert from "node:assert/strict";
import type { Pool } from "pg";
import type { AccessPorts } from "../access/resolve.ts";
import { inputRefreshSubscription, INPUT_REFRESH_VERSION, type InputRefreshRegistration } from "./input-refresh.ts";
import { fingerprintOf } from "./intervals.ts";
import { pendingRegisteredInputChanges, dispatchRegisteredInputChange, superviseRegisteredInputChange, runRegisteredInputStep, reopenRegisteredInputChange } from "./pg-registered-input.ts";
import { inputFailureCode } from "./input-dispatch-control.ts";

const ref = { code: "service.data.uplink_bytes", version: 1 }, policy = { outputs: [ref], grains: ["day" as const] };
const scope = { workspaceId: "w", sourceIds: ["s"], stationIds: ["st"], serviceIds: ["svc"], deviceIds: [], metricKeys: [ref.code + "@1"], allowSiteParameters: false };
const registration: InputRefreshRegistration = { partitionId: "p", revision: "1", configSha256: "a".repeat(64), partitionSha256: "b".repeat(64) };
test("registered input subscriptions isolate configuration identity while preserving unregistered fingerprints", () => {
  const legacy = inputRefreshSubscription(scope, policy), current = inputRefreshSubscription(scope, policy, registration);
  assert.equal(legacy.sha256, fingerprintOf({ version: INPUT_REFRESH_VERSION, scope, policy }));
  assert.notEqual(current.sha256, legacy.sha256); assert.deepEqual(current.registration, registration);
  assert.equal(inputRefreshSubscription({ ...scope, sourceIds: ["s", "s"] }, policy, registration).sha256, current.sha256);
  for (const patch of [{ partitionId: "p2" }, { revision: "2" }, { configSha256: "c".repeat(64) }, { partitionSha256: "d".repeat(64) }]) {
    assert.notEqual(inputRefreshSubscription(scope, policy, { ...registration, ...patch }).sha256, current.sha256);
  }
});
test("malformed registration evidence is rejected and authorization loss never becomes source quarantine", () => {
  for (const patch of [{ revision: "0" }, { revision: "01" }, { partitionId: "*" }, { configSha256: "short" }, { arbitrary: true }]) {
    assert.throws(() => inputRefreshSubscription(scope, policy, { ...registration, ...patch } as InputRefreshRegistration));
  }
  for (const message of ["registered_partition_paused", "registered_partition_subject_denied", "registered_partition_scope_denied"]) {
    assert.equal(inputFailureCode(Error(message)), null);
  }
});
test("registered input entry points require verified identity before any database access and reject supplied policy", async () => {
  const pool = { async connect() { throw Error("unexpected_database_access"); } } as unknown as Pool;
  const ports = { async readVerifiedIdentity() { return null; } } as AccessPorts;
  for (const call of [() => pendingRegisteredInputChanges(pool, ports, "p"), () => runRegisteredInputStep(pool, ports, "p"),
    () => dispatchRegisteredInputChange(pool, ports, "p", "c"), () => superviseRegisteredInputChange(pool, ports, "p", "c"),
    () => reopenRegisteredInputChange(pool, ports, "p", { changeId: "c", expectedRevision: "5", reasonRef: "review:fix" })]) {
    await assert.rejects(call, /identity_required/);
  }
  assert.throws(() => reopenRegisteredInputChange(pool, ports, "p", { changeId: "c", expectedRevision: "5", reasonRef: "review:fix", policy } as { changeId: string; expectedRevision: string; reasonRef: string }), /invalid_registered_reopen_request/);
});
