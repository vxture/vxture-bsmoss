import { getPool } from "../../lib/db.ts";
import { getEntitlementResolver } from "../../entitlement/resolver.ts";
import { createWorkerIdentityProvider } from "../../platform/worker-identity.ts";
import { workerAccessPorts } from "../access/worker-access.ts";
import { createAggregateWorker } from "./aggregate-worker.ts";
import { createReportWorker } from "./report-worker.ts";
import type { AggregateWorkerConfig, ReportWorkerConfig } from "./rules.ts";

function ports(workspaceId: string) {
  return workerAccessPorts(workspaceId, createWorkerIdentityProvider(workspaceId), {
    pool: getPool, coverage: id => getEntitlementResolver().resolve(id),
    meteringEnabled: () => process.env.BSMOSS_METERING_ENABLED === "on",
  });
}
// Trusted host factories only. The separate process entry must explicitly run
// these loops; imports never start a daemon, route or implicit grant.
export function aggregateWorkerForWorkspace(config: AggregateWorkerConfig) {
  if (config.subject !== "s2s:bsmoss") throw Error("worker_identity_invalid");
  return createAggregateWorker(getPool(), ports(config.workspaceId), config);
}
export function reportWorkerForWorkspace(config: ReportWorkerConfig) {
  if (config.subject !== "s2s:bsmoss") throw Error("worker_identity_invalid");
  return createReportWorker(getPool(), ports(config.workspaceId), config);
}
