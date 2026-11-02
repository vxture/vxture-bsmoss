import type { Pool } from "pg";
import { resolveMeasurementAccess, type AccessPorts } from "../access/resolve.ts";
import { refKey } from "../catalog/registry.ts";
import { PgAggregateSnapshotReader } from "./pg-snapshot.ts";
import { PgAggregateStore } from "./pg-store.ts";
import type { RefreshLease } from "./pg-refresh-jobs.ts";
import { validateRefreshJob } from "./refresh-jobs.ts";
import { publishIntervalAggregate } from "./service.ts";

// One internal worker step. No timer, identity fabrication or retry loop here.
// Composition must supply a verified machine identity and product data scope.
export async function executeRefreshLease(pool: Pool, ports: AccessPorts, raw: RefreshLease) {
  const lease = structuredClone(raw); validateRefreshJob(lease.job);
  const now = ports.now ?? Date.now;
  const access = await resolveMeasurementAccess(ports, "aggregate", "data");
  if (access.context.workspaceId !== lease.job.workspaceId) throw Error("workspace_mismatch");
  if (access.expiresAt <= now()) throw Error("access_expired");
  const snapshot = await new PgAggregateSnapshotReader(pool, access.scope).load(lease.job.target);
  const plan = snapshot.plan;
  if (plan.subjectKey !== lease.job.subjectKey || plan.sourceId !== lease.job.sourceId || refKey(plan.metric) !== lease.job.metricKey) throw Error("refresh_snapshot_mismatch");
  const store = new PgAggregateStore(pool, { workspaceId: access.context.workspaceId, series: [{ sourceId: plan.sourceId, subjectKey: plan.subjectKey, metricKey: refKey(plan.metric) }] }, lease);
  const head = await store.current(plan);
  if (access.expiresAt <= now()) throw Error("access_expired");
  // Queue acknowledgment commits in the same DB transaction as result/outbox.
  // Expected-head conflict leaves the lease unacknowledged for bounded retry.
  return publishIntervalAggregate(access.context, store, plan, snapshot.inputs, head?.revision ?? null);
}
