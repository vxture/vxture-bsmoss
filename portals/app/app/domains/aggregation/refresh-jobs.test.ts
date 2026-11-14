import { test } from "node:test";
import assert from "node:assert/strict";
import { failureCode, leaseSeconds, maxAttempts, planRefreshJob, retrySeconds, validateRefreshJob } from "./refresh-jobs.ts";
import type { AggregateSnapshot, AggregateTarget } from "./snapshot.ts";
import { PgRefreshJobs } from "./pg-refresh-jobs.ts";
import type { Pool } from "pg";

const target: AggregateTarget = { sourceId: "s", mappingId: "old", metric: { code: "service.data.uplink_bytes", version: 1 }, grain: "day", at: "2026-10-25T18:00:00+08:00" };
const snapshot: AggregateSnapshot = { plan: { workspaceId: "w", sourceId: "s", subjectKey: "station/service/cell", authorityVersion: "v1", metric: target.metric,
  inputMode: "direct", grain: "day", nativeGrain: "hour", period: { start: "2026-10-24T16:00:00.000Z", end: "2026-10-25T16:00:00.000Z" }, watermark: "2026-10-24T16:00:00.000Z", sourceComplete: false }, inputs: [] };

test("refresh jobs canonicalize stable objects and dedupe mapping anchors within one trigger", () => {
  const job = planRefreshJob(snapshot, target, "quality:q1:2");
  assert.equal(job.target.at, snapshot.plan.period.start); assert.deepEqual(validateRefreshJob(job), job);
  const alternate = planRefreshJob(snapshot, { ...target, mappingId: "new", at: "2026-10-25T01:00:00+08:00" }, "quality:q1:2");
  assert.equal(alternate.dedupeKey, job.dedupeKey);
  assert.notEqual(planRefreshJob(snapshot, target, "quality:q1:3").dedupeKey, job.dedupeKey);
  assert.equal(target.at, "2026-10-25T18:00:00+08:00"); assert.equal(snapshot.plan.sourceComplete, false);
});
test("refresh jobs reject mismatched trusted snapshots, mutated identity and untrusted target fields", () => {
  for (const patch of [{ sourceId: "foreign" }, { grain: "week" as const }, { at: "2026-11-01T00:00:00Z" }, { metric: { ...target.metric, version: 2 } }]) {
    assert.throws(() => planRefreshJob(snapshot, { ...target, ...patch }, "trigger"), /refresh_snapshot_mismatch/);
  }
  const job = planRefreshJob(snapshot, target, "trigger");
  for (const patch of [{ dedupeKey: "0".repeat(64) }, { workspaceId: "foreign" }, { subjectKey: "foreign" }, { triggerRef: "new" }]) assert.throws(() => validateRefreshJob({ ...job, ...patch }), /invalid_refresh_dedupe/);
  assert.throws(() => validateRefreshJob({ ...job, metricKey: "foreign" }), /invalid_refresh_target/);
  assert.throws(() => planRefreshJob(snapshot, { ...target, watermark: "forged" } as AggregateTarget, "trigger"), /invalid_refresh_target/);
  assert.throws(() => planRefreshJob(snapshot, target, "*"), /invalid_refresh_identity/);
});
test("refresh lease, attempts and error evidence are bounded without raw failure messages", () => {
  assert.equal(leaseSeconds(5), 5); assert.equal(leaseSeconds(900), 900); assert.equal(maxAttempts(8), 8);
  for (const n of [0, 4, 901, 5.5, NaN]) assert.throws(() => leaseSeconds(n));
  for (const n of [0, 9, 1.5, NaN]) assert.throws(() => maxAttempts(n));
  assert.deepEqual(Array.from({ length: 8 }, (_, i) => retrySeconds(i + 1)), [5, 10, 20, 40, 80, 160, 320, 640]);
  assert.equal(failureCode("source_unavailable"), "source_unavailable");
  for (const code of ["", "Error: token=secret", "x".repeat(65), "bad\nmessage"]) assert.throws(() => failureCode(code));
});
test("queue snapshots finite scope and rejects unauthorized jobs before SQL", async () => {
  let calls = 0; const pool = { async connect() { calls++; throw Error("unexpected_sql"); } } as unknown as Pool;
  const job = planRefreshJob(snapshot, target, "trigger");
  const scope = { workspaceId: "w", series: [] as { sourceId: string; subjectKey: string; metricKey: string }[] };
  const queue = new PgRefreshJobs(pool, scope); scope.series.push({ sourceId: job.sourceId, subjectKey: job.subjectKey, metricKey: job.metricKey });
  await assert.rejects(queue.enqueue(job), /refresh_scope_denied/); assert.equal(await queue.claim(), null); assert.equal(calls, 0);
  assert.throws(() => new PgRefreshJobs(pool, { workspaceId: "*", series: [] }));
  await assert.rejects(queue.claim(1), /invalid_refresh_lease/); assert.equal(calls, 0);
});
