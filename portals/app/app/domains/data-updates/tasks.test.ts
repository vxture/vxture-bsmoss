import { test } from "node:test";
import assert from "node:assert/strict";
import { updateKey, updateManifest, updateProgress, type UpdateManifest } from "./tasks.ts";
import { updateCommand, updateHttpError } from "./http.ts";
const base: UpdateManifest = { version: "received-data-update-v1", partitionId: "partition", partitionRevision: "1", subscriptionSha256: "a".repeat(64), changeIds: ["c2", "c1"],
  scope: { workspaceId: "w", sourceIds: ["src"], stationIds: ["s"], serviceIds: [], deviceIds: [], metricKeys: ["metric@1"], allowSiteParameters: true } };
test("received update identity pins tenant, registration, scope and exact changes", () => {
  assert.equal(updateKey("w", base), updateKey("w", { ...base, changeIds: ["c1", "c2"] }));
  for (const altered of [{ ...base, partitionRevision: "2" }, { ...base, changeIds: ["c1"] }, { ...base, subscriptionSha256: "b".repeat(64) }, { ...base, scope: { ...base.scope, stationIds: ["other"] } }]) assert.notEqual(updateKey("w", base), updateKey("w", altered));
  assert.throws(() => updateKey("other", base), /workspace_mismatch/);
});
test("received manifest rejects untrusted command fields, duplicates and unbounded input", () => {
  for (const patch of [{ actor: "x" }, { changeIds: [] }, { changeIds: ["c", "c"] }, { changeIds: Array.from({ length: 65 }, (_, i) => "c" + i) }, { partitionRevision: "01" }, { subscriptionSha256: "unknown" }]) assert.throws(() => updateManifest({ ...base, ...patch }));
  const m = updateManifest(base); m.changeIds.push("changed"); assert.equal(base.changeIds.length, 2);
});
const input = { id: "c", dispatched: false, state: null, failureCode: null };
test("progress waits for dispatch receipts and real successful result jobs", () => {
  assert.equal(updateProgress([input], []).phase, "dispatching");
  assert.equal(updateProgress([{ ...input, dispatched: true }], [{ id: "j", status: "pending", failureCode: null }]).phase, "recomputing");
  const complete = updateProgress([{ ...input, dispatched: true }], [{ id: "j", status: "succeeded", failureCode: null }]);
  assert.equal(complete.phase, "processed"); assert.deepEqual(complete.results, { total: 1, succeeded: 1, failed: 0, running: 0, waiting: 0 });
  assert.equal(updateProgress([{ ...input, dispatched: true }], []).phase, "processed");
});
test("quarantine blocks success; reopening and reviewed result replacement can resume", () => {
  assert.equal(updateProgress([{ ...input, state: "quarantined", failureCode: "evidence_invalid" }], []).phase, "failed");
  assert.equal(updateProgress([{ ...input, state: "reopened" }], []).phase, "dispatching");
  assert.equal(updateProgress([{ ...input, dispatched: true }], [{ id: "j", status: "dead", failureCode: "capacity_limit" }]).phase, "failed");
  assert.throws(() => updateProgress([input, input], []));
  const retry = updateProgress([{ ...input, state: "quarantined", failureCode: "evidence_invalid", revision: "5" }], []).failures[0];
  assert.equal(retry.canRetry, true); assert.equal("expectedRevision" in retry && retry.expectedRevision, "5");
  const expired = updateProgress([{ ...input, dispatched: true }], [{ id: "j", status: "leased", failureCode: null, leaseExpired: true }]);
  assert.equal(expired.results.running, 0); assert.equal(expired.results.waiting, 1);
});
test("update HTTP denies anonymous, cross origin, oversized and non-JSON commands", async () => {
  const session = { enabled: true, sid: "sid", appOrigin: "http://localhost" }; let calls = 0;
  const execute = async () => { calls++; return { id: "task" }; };
  const req = (body = "{}", patch: RequestInit = {}) => new Request("http://localhost/api/data-updates", { method: "POST", headers: { origin: "http://localhost", "content-type": "application/json" }, body, ...patch });
  assert.equal((await updateCommand(req(), { ...session, sid: undefined }, execute)).status, 401);
  assert.equal((await updateCommand(req("{}", { headers: { origin: "http://other", "content-type": "application/json" } }), session, execute)).status, 403);
  assert.equal((await updateCommand(req("{}", { headers: { origin: "http://localhost", "content-type": "text/plain" } }), session, execute)).status, 415);
  assert.equal((await updateCommand(req("x".repeat(4097)), session, execute)).status, 413);
  assert.equal(calls, 0);
  const response = await updateCommand(req(), session, execute); assert.equal(response.status, 202); assert.match(response.headers.get("cache-control")!, /no-store/);
});
test("HTTP reports conflicts and bounded failures without exposing database errors", async () => {
  assert.equal(updateHttpError(Error("update_request_busy")).status, 409);
  assert.equal(updateHttpError(Error("update_input_bound_exceeded")).status, 409);
  assert.equal(updateHttpError(Error("registered_partition_unavailable")).status, 404);
  const response = updateHttpError(Error("password=private")); assert.equal(response.status, 503); assert.doesNotMatch(await response.text(), /private/);
});
