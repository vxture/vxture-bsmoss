import { test } from "node:test";
import assert from "node:assert/strict";
import { workerHostConfig } from "./host-config.ts";
import { runHostedWorker, type WorkerHealth } from "./host.ts";
import { createWorkerLoop } from "./loop.ts";
import { readHostConfiguration, writeHostHealth, checkHostHealth } from "./process.ts";
import { mkdtemp, writeFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const raw = { version: 1, kind: "aggregate", workspaceId: "10000000-0000-0000-0000-000000000001", partitionIds: [], executeResults: true, maxStepsPerTick: 1, pollMilliseconds: 1000 };
const loopOptions = { maxStepsPerTick: 1, pollMilliseconds: 1000 };
test("host configuration pins the machine principal and strictly validates host and existing lane bounds", () => {
  const config = workerHostConfig(raw); assert.equal(config.worker.subject, "s2s:bsmoss");
  for (const patch of [{ subject: "human" }, { workspaceId: "w" }, { workspaceId: "00000000-0000-0000-0000-000000000000" }, { version: 2 }, { kind: "human" },
    { partitionIds: ["a", "a"] }, { executeResults: false }, { maxStepsPerTick: 26 }, { pollMilliseconds: 0 },
    { healthTimeoutMilliseconds: 1000 }, { shutdownMilliseconds: 90001 }, { unexpected: true }]) assert.throws(() => workerHostConfig({ ...raw, ...patch }));
  const report = { version: 1, kind: "report", workspaceId: raw.workspaceId, scheduleIds: ["reviewed"], executeExports: false, reconcileHistory: true, maxStepsPerTick: 1, pollMilliseconds: 1000 };
  assert.equal(workerHostConfig(report).kind, "report");
  assert.throws(() => workerHostConfig({ ...report, scheduleIds: Array.from({ length: 33 }, (_, i) => "reviewed" + i) }));
});
function options(controller: AbortController, states: WorkerHealth[], close: () => Promise<void>, write?: (value: WorkerHealth) => void) {
  return { signal: controller.signal, configSha256: "a".repeat(64), pid: process.pid, gitSha: "test", close, log: () => {},
    writeHealth: async (value: WorkerHealth) => { states.push(structuredClone(value)); write?.(value); } };
}
test("host shutdown waits for its in-flight lane before pool close and publishes ordered stopping then stopped", async () => {
  const controller = new AbortController(), states: WorkerHealth[] = []; let enter!: () => void, release!: () => void, committed = false, closed = false, steps = 0;
  const entered = new Promise<void>(resolve => { enter = resolve; }), gate = new Promise<void>(resolve => { release = resolve; });
  const loop = createWorkerLoop([{ async step() { steps++; enter(); await gate; committed = true; return { status: "succeeded" as const }; } }], loopOptions);
  const running = runHostedWorker(workerHostConfig(raw), loop, options(controller, states, async () => { assert.equal(committed, true); closed = true; }));
  await entered; controller.abort(); await new Promise(resolve => setTimeout(resolve, 5)); assert.equal(closed, false); release(); await running;
  assert.equal(closed, true); assert.equal(steps, 1); assert.equal(states[0].status, "starting"); assert.equal(states.at(-1)?.status, "stopped");
  const stopped = states.findIndex(s => s.status === "stopping"); assert.ok(stopped >= 0); assert.ok(states.slice(stopped).every(s => s.status === "stopping" || s.status === "stopped"));
});
test("health stays degraded through authorization backoff and recovers only after the failed lane succeeds", async () => {
  const controller = new AbortController(), states: WorkerHealth[] = []; let clock = 0, steps = 0, waits = 0;
  const loop = createWorkerLoop([{ async step() { if (++steps === 1) throw Error("worker_identity_unavailable"); return { status: "idle" as const }; } }], loopOptions,
    { now: () => clock, wait: async () => { clock += ++waits === 1 ? 1000 : 5000; } });
  await runHostedWorker(workerHostConfig(raw), loop, options(controller, states, async () => {}, value => { if (value.status === "running") controller.abort(); }));
  assert.deepEqual(states.filter(s => s.status === "degraded").map(s => s.failedSteps), [1, 1]); assert.equal(steps, 2);
  assert.equal(states.at(-1)?.status, "stopped");
});
test("host closes owned resources after health writer failure and never leaks the underlying error through its entry point contract", async () => {
  let closed = 0;
  const controller = new AbortController(), loop = createWorkerLoop([{ async step() { return { status: "idle" as const }; } }], loopOptions);
  await assert.rejects(runHostedWorker(workerHostConfig(raw), loop, { ...options(controller, [], async () => { closed++; }), writeHealth: async () => { throw Error("fixture_health_failure"); } }));
  assert.equal(closed, 1); assert.equal(loop.snapshot().running, false);
});
test("host readiness waits until every configured lane has been observed", async () => {
  const controller = new AbortController(), states: WorkerHealth[] = [];
  const loop = createWorkerLoop(Array.from({ length: 3 }, () => ({ async step() { return { status: "idle" as const }; } })), loopOptions, { wait: async () => {} });
  await runHostedWorker(workerHostConfig(raw), loop, options(controller, states, async () => {}, value => { if (value.status === "running") controller.abort(); }));
  assert.deepEqual(states.slice(0, 4).map(value => value.status), ["starting", "starting", "starting", "running"]);
});
test("health command checks the actual file bytes, normalized config digest, running PID, version and freshness", async () => {
  const root = await mkdtemp(join(tmpdir(), "bsmoss-host-")), path = join(root, "worker.json"), healthPath = join(root, "health.json");
  try {
    await writeFile(path, JSON.stringify(raw)); const loaded = await readHostConfiguration(path);
    const env = { BSMOSS_WORKER_CONFIG_FILE: path, BSMOSS_WORKER_HEALTH_FILE: healthPath, GIT_SHA: "test" };
    const health: WorkerHealth = { schema: "bsmoss-worker-health-v1", status: "running", kind: "aggregate", configSha256: loaded.configSha256, pid: process.pid, gitSha: "test", updatedAt: Date.now(), completedSteps: 1, failedSteps: 0 };
    await writeHostHealth(healthPath, health); await checkHostHealth(env);
    for (const patch of [{ status: "degraded" as const }, { status: "stopped" as const }, { configSha256: "b".repeat(64) }, { updatedAt: Date.now() - 180001 }, { updatedAt: Date.now() + 60000 }, { pid: 0 }, { gitSha: "foreign" }]) {
      await writeHostHealth(healthPath, { ...health, ...patch }); await assert.rejects(checkHostHealth(env));
    }
    await writeHostHealth(healthPath, health); await writeFile(path, JSON.stringify({ ...raw, pollMilliseconds: 2000 })); await assert.rejects(checkHostHealth(env));
    await writeFile(path, " ".repeat(32769)); await assert.rejects(readHostConfiguration(path), /worker_file_too_large/);
    await assert.rejects(readHostConfiguration("relative.json"), /worker_host_config_required/);
    const serialized = await readFile(healthPath, "utf8"); assert.ok(!serialized.includes(raw.workspaceId));
  } finally { await rm(root, { recursive: true, force: true }); }
});
