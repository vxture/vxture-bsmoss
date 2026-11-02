import type { Pool } from "pg";
import type { AccessPorts } from "../access/resolve.ts";
import { enqueueRegisteredPeriodic } from "../aggregation/pg-registered-periodic.ts";
import { runRegisteredInputStep } from "../aggregation/pg-registered-input.ts";
import { runRefreshStep } from "../aggregation/refresh-supervision.ts";
import { createWorkerLoop, type WorkerLane } from "./loop.ts";
import { aggregateWorkerConfig, type AggregateWorkerConfig } from "./rules.ts";

// Trusted host configuration only. The real provider remains responsible for
// current machine identity, entitlement and explicit finite product grants.
export function createAggregateWorker(pool: Pool, ports: AccessPorts, raw: AggregateWorkerConfig) {
  const config = aggregateWorkerConfig(raw);
  const pinned: AccessPorts = { ...ports, async readVerifiedIdentity() {
    const identity = await ports.readVerifiedIdentity();
    return identity?.activeWorkspace === config.workspaceId && identity.sub === config.subject ? identity : null;
  } };
  const lanes: WorkerLane[] = config.partitionIds.flatMap(id => [
    { async step() { const result = await enqueueRegisteredPeriodic(pool, pinned, id); return { status: result.status }; } },
    { async step() {
      const result = await runRegisteredInputStep(pool, pinned, id);
      if (result.status === "failure_recorded") return { status: result.state === "quarantined" ? "dead" as const : "retry" as const };
      if (result.status === "quarantined") return { status: "dead" as const };
      if (result.status === "deferred") return { status: "delayed" as const };
      return { status: result.status === "dispatched" ? "enqueued" as const : result.status === "contended" ? "busy" as const : result.status };
    } },
  ]);
  if (config.executeResults) lanes.push({ async step(signal) {
    const result = await runRefreshStep(pool, pinned, signal);
    if (result.status === "failure_recorded") return { status: "failure_recorded" as const };
    return { status: result.status === "lease_lost" ? "busy" as const : result.status === "stopped" ? "idle" as const : result.status };
  } });
  return createWorkerLoop(lanes, { maxStepsPerTick: config.maxStepsPerTick, pollMilliseconds: config.pollMilliseconds });
}
