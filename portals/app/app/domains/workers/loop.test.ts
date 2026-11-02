import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkerLoop } from "./loop.ts";
import { reportWorkerConfig, workerFailure, workerRetryMilliseconds } from "./rules.ts";
const options = { maxStepsPerTick: 1, pollMilliseconds: 1000 };

test("report worker configuration cannot inject scope tokens runtime identity or unbounded scheduling", () => {
  const config = { ...options, workspaceId: "w", subject: "worker", scheduleIds: ["one"], executeExports: true };
  assert.deepEqual(reportWorkerConfig(config), config);
  for (const patch of [{ scope: {} }, { token: "private" }, { scheduleIds: ["one", "one"] }, { scheduleIds: ["*"] }, { scheduleIds: Array.from({ length: 65 }, (_, i) => String(i)) }, { scheduleIds: [], executeExports: false }, { maxStepsPerTick: 26 }, { pollMilliseconds: 999 }, { pollMilliseconds: 60001 }]) assert.throws(() => reportWorkerConfig({ ...config, ...patch }));
});
test("worker cycles rotate a bounded fair subset and never mutate returned health snapshots", async () => {
  const calls: number[] = [], loop = createWorkerLoop([0, 1, 2].map(id => ({ async step() { calls.push(id); return { status: "succeeded" as const }; } })), options);
  for (let n = 0; n < 7; n++) assert.equal((await loop.tick()).events.length, 1);
  assert.deepEqual(calls, [0, 1, 2, 0, 1, 2, 0]);
  const snapshot = loop.snapshot(); snapshot.lanes[0]!.lastEvent!.status = "failed"; assert.equal(loop.snapshot().lanes[0]!.lastEvent!.status, "succeeded");
});
test("blocked worker lanes back off independently without starving healthy work or exposing exception content", async () => {
  let clock = 0, badCalls = 0, goodCalls = 0, fail = true;
  const loop = createWorkerLoop([{ async step() { badCalls++; if (fail) throw Error("secret-bearing unknown error"); return { status: "idle" as const }; } }, { async step() { goodCalls++; return { status: "succeeded" as const }; } }], { ...options, maxStepsPerTick: 2 }, { now: () => clock });
  for (let n = 1; n <= 6; n++) {
    const cycle = await loop.tick(), failed = cycle.events.find(e => e.status === "failed")!;
    assert.equal(failed.failure, "execution_failed"); assert.equal(failed.retryAfterMilliseconds, [5000, 10000, 20000, 40000, 60000, 60000][n - 1]);
    assert.ok(!JSON.stringify(cycle).includes("secret-bearing")); const calls = badCalls;
    clock += failed.retryAfterMilliseconds - 1; await loop.tick(); assert.equal(badCalls, calls); clock++;
  }
  assert.equal(badCalls, 6); assert.equal(goodCalls, 12); fail = false; await loop.tick();
  assert.equal(loop.snapshot().lanes[0]!.consecutiveFailures, 0); assert.equal(loop.snapshot().lanes[0]!.lastEvent!.retryAfterMilliseconds, 0);
  assert.deepEqual([1, 2, 3, 4, 5, 1000].map(workerRetryMilliseconds), [5000, 10000, 20000, 40000, 60000, 60000]);
  assert.equal(workerFailure(Object.assign(Error("SQL private"), { code: "42501" })), "authorization_denied");
  assert.equal(workerFailure({ code: "40001" }), "serialization_conflict"); assert.equal(workerFailure({ code: "ECONNRESET" }), "storage_unavailable"); assert.equal(workerFailure(Error("report_schedule_paused")), "configuration_unavailable");
});
test("overlapping ticks cannot duplicate a transaction and shutdown waits for in-flight work before dispatching another lane", async () => {
  let entered!: () => void, release!: () => void, next = 0;
  const ready = new Promise<void>(r => { entered = r; }), gate = new Promise<void>(r => { release = r; });
  const loop = createWorkerLoop([{ async step() { entered(); await gate; return { status: "succeeded" as const }; } }, { async step() { next++; return { status: "idle" as const }; } }], { ...options, maxStepsPerTick: 2 });
  const controller = new AbortController(), pending = loop.tick(controller.signal); await ready;
  assert.deepEqual(await loop.tick(), { status: "busy", events: [] }); controller.abort();
  assert.equal(loop.snapshot().ticking, true); assert.equal(next, 0); release();
  const stopped = await pending; assert.equal(stopped.status, "stopped"); assert.equal(stopped.events[0]!.status, "succeeded"); assert.equal(stopped.events.length, 1); assert.equal(next, 0);
});
test("the long-running loop stops its idle timer promptly and cannot be started twice", async () => {
  const controller = new AbortController(); let cycles = 0, entered!: () => void;
  const ready = new Promise<void>(r => { entered = r; });
  const loop = createWorkerLoop([{ async step() { return { status: "idle" as const }; } }], { ...options, pollMilliseconds: 60000 });
  const running = loop.run(controller.signal, () => { cycles++; entered(); }); await ready;
  await assert.rejects(loop.run(controller.signal), /worker_already_running/); assert.deepEqual(await loop.tick(), { status: "busy", events: [] }); await new Promise(resolve => setImmediate(resolve)); controller.abort();
  await Promise.race([running, new Promise((_, reject) => { const timer = setTimeout(() => reject(Error("shutdown_timeout")), 500); timer.unref(); })]);
  assert.equal(loop.snapshot().running, false); assert.equal(cycles, 1); assert.deepEqual(await loop.tick(controller.signal), { status: "stopped", events: [] });
});
test("observer failures terminate the host loop explicitly and malformed statuses are fixed-code failures", async () => {
  const loop = createWorkerLoop([{ async step() { return { status: "idle" as const }; } }], options);
  await assert.rejects(loop.run(new AbortController().signal, () => { throw Error("observer_unavailable"); }), /observer_unavailable/); assert.equal(loop.snapshot().running, false);
  const malformed = createWorkerLoop([{ async step() { return { status: "untrusted secret" as "idle" }; } }], options);
  assert.equal((await malformed.tick()).events[0]!.failure, "execution_failed");
});
test("worker backoff rejects a reversed or invalid monotonic clock and releases its tick guard", async () => {
  let time = 100;
  const loop = createWorkerLoop([{ async step() { return { status: "idle" as const }; } }], options, { now: () => time });
  await loop.tick(); time = 99; await assert.rejects(loop.tick(), /invalid_worker_clock/); assert.equal(loop.snapshot().ticking, false);
  time = NaN; await assert.rejects(loop.tick(), /invalid_worker_clock/); time = 101; assert.equal((await loop.tick()).events[0]!.status, "idle");
});
