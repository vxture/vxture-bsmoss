import type { Pool } from "pg";
import { resolveMeasurementAccess, type AccessPorts, type MeasurementAccess } from "../access/resolve.ts";
import { PgRefreshJobs, type RefreshLease } from "./pg-refresh-jobs.ts";
import { executeRefreshLease } from "./refresh-execution.ts";
import { mappedSubject } from "./subjects.ts";

async function scopedQueue(pool: Pool, access: MeasurementAccess, id?: string) {
  const s = access.scope;
  const rows = (await pool.query(`SELECT j.id,j.source_id,j.subject_key,j.metric_key,m.station_id,m.service_id,m.network_object_id,m.device_id
    FROM bsmoss_analysis.refresh_job j JOIN bsmoss_integration.source_mapping m ON (m.workspace_id,m.id,m.source_id)=(j.workspace_id,j.mapping_id,j.source_id)
    WHERE j.workspace_id=$1 AND j.source_id=ANY($2::text[]) AND j.metric_key=ANY($3::text[]) AND m.station_id=ANY($4::text[])
    AND (m.service_id IS NULL OR m.service_id=ANY($5::text[])) AND (m.device_id IS NULL OR m.device_id=ANY($6::text[]))
    AND (m.service_id IS NOT NULL OR m.device_id IS NOT NULL OR $7::boolean)
    AND ($8::text IS NULL OR j.id=$8)
    AND (($8::text IS NOT NULL AND j.status='leased') OR (j.status='pending' AND j.available_at<=clock_timestamp()) OR (j.status='leased' AND j.lease_until<=clock_timestamp()))
    ORDER BY j.available_at,j.created_at,j.id LIMIT 64`,
  [access.context.workspaceId, s.sourceIds, s.metricKeys, s.stationIds, s.serviceIds, s.deviceIds, s.allowSiteParameters, id ?? null])).rows;
  const series = rows.map(row => {
    if (row.subject_key !== mappedSubject(row.station_id, row.service_id, row.network_object_id, row.device_id)) throw Error("refresh_job_subject_mismatch");
    return { sourceId: row.source_id as string, subjectKey: row.subject_key as string, metricKey: row.metric_key as string };
  });
  return { queue: new PgRefreshJobs(pool, { workspaceId: access.context.workspaceId, series }), ids: rows.map(r => r.id as string), found: rows.length > 0 };
}
// Resolve permissions again at claim; jobs never manufacture an object grant.
export async function claimAuthorizedRefresh(pool: Pool, ports: AccessPorts, ttlSeconds = 60) {
  const access = await resolveMeasurementAccess(ports, "aggregate", "data"), now = ports.now ?? Date.now;
  const { queue, ids } = await scopedQueue(pool, access);
  if (access.expiresAt <= now()) throw Error("access_expired");
  const lease = await queue.claim(ttlSeconds, ids);
  if (access.expiresAt <= now()) throw Error("access_expired");
  return lease;
}
function classified(error: unknown) {
  const e = error as { code?: string; message?: string };
  if (e?.code === "40001" || e?.code === "40P01" || e?.message === "aggregate_revision_conflict") return "serialization_conflict";
  if (["ECONNRESET", "ETIMEDOUT", "57P01", "53300"].includes(e?.code ?? "")) return "database_unavailable";
  if (e?.code === "42501" || ["identity_required", "permission_denied", "feature_denied", "invalid_coverage", "access_expired", "workspace_mismatch", "aggregate_scope_denied", "aggregate_dependency_scope_denied", "object_scope_denied"].includes(e?.message ?? "")) return "authorization_denied";
  return "execution_failed";
}
async function recordFailure(pool: Pool, ports: AccessPorts, lease: RefreshLease, code: string) {
  const access = await resolveMeasurementAccess(ports, "aggregate", "data");
  if (access.context.workspaceId !== lease.job.workspaceId) throw Error("workspace_mismatch");
  const { queue, found } = await scopedQueue(pool, access, lease.id);
  if (!found) throw Error("permission_denied");
  if (access.expiresAt <= (ports.now ?? Date.now)()) throw Error("access_expired");
  await queue.fail(lease, code);
}
// A bounded supervisor step, intended for a future verified worker composition.
// Success is already acknowledged in executeRefreshLease's result transaction.
export async function runRefreshStep(pool: Pool, ports: AccessPorts, signal?: AbortSignal) {
  if (signal?.aborted) return { status: "stopped" as const };
  const lease = await claimAuthorizedRefresh(pool, ports);
  if (!lease) return { status: "idle" as const };
  // Claim is independently durable. A stop here leaves its fenced lease for
  // expiry/recovery; it must not start another transaction during shutdown.
  if (signal?.aborted) return { status: "stopped" as const };
  try {
    const result = await executeRefreshLease(pool, ports, lease);
    return { status: "succeeded" as const, jobId: lease.id, result };
  } catch (error) {
    if ((error as Error)?.message === "refresh_lease_lost") return { status: "lease_lost" as const, jobId: lease.id };
    const code = classified(error);
    if (code === "authorization_denied") throw error;
    try { await recordFailure(pool, ports, lease, code); }
    catch (failure) { if ((failure as Error)?.message === "refresh_lease_lost") return { status: "lease_lost" as const, jobId: lease.id }; throw failure; }
    return { status: "failure_recorded" as const, jobId: lease.id, attempt: lease.attempt, code };
  }
}
