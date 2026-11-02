import { test } from "node:test";
import assert from "node:assert/strict";
import type { Pool } from "pg";
import type { AccessPorts } from "../access/resolve.ts";
import { inputFailureCode, nextInputFailure } from "./input-dispatch-control.ts";
import { reopenInputChange, runInputRefreshStep, superviseInputChange } from "./pg-input-refresh.ts";

test("input failures use bounded increasing backoff, quarantine at five and restart after explicit reopen", () => {
  let last = null as { revision: string; attempt: number; state: string } | null;
  for (let attempt = 1; attempt <= 5; attempt++) {
    const next = nextInputFailure(last); assert.equal(next.attempt, attempt); assert.equal(next.revision, String(attempt));
    assert.equal(next.state, attempt === 5 ? "quarantined" : "retry"); assert.equal(next.delaySeconds, attempt === 5 ? 0 : 5 * 2 ** (attempt - 1)); last = next;
  }
  assert.throws(() => nextInputFailure(last), /invalid_input_dispatch_state/);
  assert.deepEqual(nextInputFailure({ revision: "6", attempt: 0, state: "reopened" }), { revision: "7", attempt: 1, state: "retry", delaySeconds: 5 });
});
test("input retry state rejects invalid counters and precision overflow", () => {
  for (const value of [{ revision: "0", attempt: 1, state: "retry" }, { revision: "1", attempt: 0, state: "retry" },
    { revision: "1", attempt: 1, state: "reopened" }, { revision: "1", attempt: 1.5, state: "retry" },
    { revision: "1", attempt: 6, state: "retry" }, { revision: "9".repeat(30), attempt: 1, state: "retry" }]) assert.throws(() => nextInputFailure(value));
});
test("input failure classification persists only fixed redacted codes and excludes authorization failures", () => {
  for (const code of ["40001", "40P01"]) assert.equal(inputFailureCode({ code, message: "private data" }), "serialization_conflict");
  assert.equal(inputFailureCode({ code: "ECONNRESET", message: "private endpoint" }), "database_unavailable");
  assert.equal(inputFailureCode(Error("input_history_bound_exceeded")), "capacity_limit");
  assert.equal(inputFailureCode(Error("aggregate_capability_unavailable_or_ambiguous")), "source_unavailable");
  assert.equal(inputFailureCode(Error("private customer payload")), "evidence_invalid");
  for (const message of ["permission_denied", "access_expired", "object_scope_denied", "aggregate_dependency_scope_denied", "input_change_unavailable"]) assert.equal(inputFailureCode(Error(message)), null);
});
test("retry supervision and reopen require current authority before database access", async () => {
  let calls = 0;
  const pool = { async connect() { calls++; throw Error("unexpected_io"); }, async query() { calls++; throw Error("unexpected_io"); } } as unknown as Pool;
  const ports = { async readVerifiedIdentity() { return null; } } as unknown as AccessPorts;
  const policy = { outputs: [{ code: "service.data.uplink_bytes", version: 1 }], grains: ["day" as const] };
  await assert.rejects(superviseInputChange(pool, ports, "change", policy), /identity_required/);
  await assert.rejects(runInputRefreshStep(pool, ports, policy), /identity_required/);
  await assert.rejects(reopenInputChange(pool, ports, { changeId: "change", expectedRevision: "5", reasonRef: "review:fixed", policy }), /identity_required/);
  await assert.rejects(reopenInputChange(pool, ports, { changeId: "change", expectedRevision: "0", reasonRef: "review:fixed", policy }), /invalid_revision/);
  assert.equal(calls, 0);
});
