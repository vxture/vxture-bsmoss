import type { Pool } from "pg";
import { resolveMeasurementAccess, type AccessPorts, type MeasurementAccess } from "../access/resolve.ts";
import { fingerprintOf } from "./intervals.ts";
import { planPeriodicBatch, planRevisionBatch, refreshTargets, type RefreshSeed, type RevisionImpact } from "./refresh-coordination.ts";
import { PgRefreshJobs } from "./pg-refresh-jobs.ts";
import { PgAggregateSnapshotReader } from "./pg-snapshot.ts";
import { jobIdentity, planRefreshJob } from "./refresh-jobs.ts";
import type { AggregateTarget } from "./snapshot.ts";

// Internal finite-batch orchestration. No client-supplied identity/scope or
// external event acknowledgment; every target is resolved under current grants.
async function enqueueResolved(pool: Pool, access: MeasurementAccess, now: () => number, targets: readonly AggregateTarget[], triggerRef: string) {
  if (access.expiresAt <= now()) throw Error("access_expired");
  const client = await pool.connect(); let discard = false;
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
    const reader = new PgAggregateSnapshotReader(pool, access.scope), jobs = [];
    for (const target of targets) {
      if (access.expiresAt <= now()) throw Error("access_expired");
      const snapshot = await reader.load(target, client);
      jobs.push(planRefreshJob(snapshot, target, triggerRef));
    }
    const unique = [...new Map(jobs.map(job => [job.dedupeKey, job])).values()].sort((a, b) => a.dedupeKey.localeCompare(b.dedupeKey));
    const queue = new PgRefreshJobs(pool, { workspaceId: access.context.workspaceId,
      series: unique.map(job => ({ sourceId: job.sourceId, subjectKey: job.subjectKey, metricKey: job.metricKey })) }, client);
    const results = await queue.enqueueBatch(unique);
    if (access.expiresAt <= now()) throw Error("access_expired");
    await client.query("COMMIT");
    return { triggerRef, requestedTargets: targets.length, jobs: results,
      manifestSha256: fingerprintOf({ version: "refresh-enqueue-v1", workspaceId: access.context.workspaceId, keys: unique.map(job => job.dedupeKey) }) };
  } catch (error) { try { await client.query("ROLLBACK"); } catch { discard = true; } throw error; }
  finally { client.release(discard); }
}
export async function enqueueAuthorizedRefresh(pool: Pool, ports: AccessPorts, raw: { targets: readonly AggregateTarget[]; triggerRef: string }) {
  const input = structuredClone(raw);
  if (!input || Object.keys(input).some(k => !["targets", "triggerRef"].includes(k))) throw Error("untrusted_refresh_request_field");
  jobIdentity(input.triggerRef); const targets = refreshTargets(input.targets);
  const access = await resolveMeasurementAccess(ports, "aggregate", "data");
  return enqueueResolved(pool, access, ports.now ?? Date.now, targets, input.triggerRef);
}
export async function enqueuePeriodicRefresh(pool: Pool, ports: AccessPorts, raw: readonly RefreshSeed[]) {
  const seeds = structuredClone(raw), now = ports.now ?? Date.now;
  const access = await resolveMeasurementAccess(ports, "aggregate", "data");
  const batch = planPeriodicBatch(seeds, new Date(now()).toISOString());
  return enqueueResolved(pool, access, now, batch.targets, batch.triggerRef);
}
export async function enqueueRevisionRefresh(pool: Pool, ports: AccessPorts, raw: readonly RevisionImpact[], evidenceRef: string) {
  const impacts = structuredClone(raw);
  const access = await resolveMeasurementAccess(ports, "aggregate", "data");
  const batch = planRevisionBatch(impacts, evidenceRef);
  return enqueueResolved(pool, access, ports.now ?? Date.now, batch.targets, batch.triggerRef);
}
