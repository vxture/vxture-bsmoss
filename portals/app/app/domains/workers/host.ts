import type { createWorkerLoop } from "./loop.ts";
import type { WorkerHostConfig } from "./host-config.ts";

export type HostedWorker = ReturnType<typeof createWorkerLoop>;
export interface WorkerHealth {
  schema: "bsmoss-worker-health-v1";
  status: "starting" | "running" | "degraded" | "stopping" | "stopped" | "failed";
  kind: WorkerHostConfig["kind"];
  configSha256: string;
  pid: number;
  gitSha: string;
  updatedAt: number;
  completedSteps: number;
  failedSteps: number;
}
// A host owns exactly one worker and pool. Business transactions remain inside
// the existing lanes; abort never turns a committed result into a false failure.
export async function runHostedWorker(config: WorkerHostConfig, worker: HostedWorker, options: {
  signal: AbortSignal; configSha256: string; pid: number; gitSha: string;
  writeHealth: (health: WorkerHealth) => Promise<void>;
  close: () => Promise<void>;
  log: (event: Readonly<Record<string, unknown>>) => void;
  now?: () => number;
}) {
  const now = options.now ?? Date.now;
  let writes = Promise.resolve(), failed = false;
  function publish(status: WorkerHealth["status"]) {
    const snapshot = worker.snapshot();
    const health: WorkerHealth = { schema: "bsmoss-worker-health-v1", status, kind: config.kind,
      configSha256: options.configSha256, pid: options.pid, gitSha: options.gitSha, updatedAt: now(),
      completedSteps: snapshot.lanes.reduce((sum, lane) => sum + lane.completedSteps, 0),
      failedSteps: snapshot.lanes.reduce((sum, lane) => sum + lane.failedSteps, 0) };
    writes = writes.then(() => options.writeHealth(health));
    // Signal callbacks cannot be awaited. Keep their rejected write observed
    // until the next cycle or finally awaits the same ordered write chain.
    void writes.catch(() => {});
    return writes;
  }
  const stopping = () => { options.log({ event: "worker_stopping" }); void publish("stopping"); };
  options.signal.addEventListener("abort", stopping, { once: true });
  try {
    await publish(options.signal.aborted ? "stopping" : "starting");
    options.log({ event: "worker_started", kind: config.kind, configSha256: options.configSha256 });
    await worker.run(options.signal, async cycle => {
      const snapshot = worker.snapshot(), degraded = snapshot.lanes.some(lane => (lane.lastEvent?.failure ?? null) !== null);
      const unvisited = snapshot.lanes.some(lane => lane.lastEvent === null);
      await publish(options.signal.aborted ? "stopping" : degraded ? "degraded" : unvisited ? "starting" : "running");
      if (cycle.events.some(event => event.failure || !["idle", "busy", "delayed", "duplicate"].includes(event.status))) {
        options.log({ event: "worker_cycle", outcomes: cycle.events.map(event => ({ lane: event.lane, status: event.status, failure: event.failure })) });
      }
    });
  } catch {
    failed = true; throw Error("worker_host_failed");
  } finally {
    options.signal.removeEventListener("abort", stopping);
    try { await options.close(); }
    catch { failed = true; throw Error("worker_host_failed"); }
    finally { await publish(failed ? "failed" : "stopped"); }
    options.log({ event: "worker_stopped" });
  }
}
