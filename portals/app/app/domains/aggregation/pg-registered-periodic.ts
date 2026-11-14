import type { Pool } from "pg";
import { resolveMeasurementAccess, type AccessPorts } from "../access/resolve.ts";
import { partitionAccess } from "./registered-partitions.ts";
import { fingerprintOf } from "./intervals.ts";
import { bucketFor } from "./periods.ts";
import { planPeriodicBatch } from "./refresh-coordination.ts";
import { enqueueRefreshInTransaction } from "./refresh-enqueue.ts";
import { jobIdentity } from "./refresh-jobs.ts";
import { loadRegisteredPartition } from "./pg-registered-partition.ts";

// Internal composition only: the caller selects an ID, never a scope or seeds.
export async function enqueueRegisteredPeriodic(pool: Pool, ports: AccessPorts, partitionId: string) {
  jobIdentity(partitionId);
  const initial = await resolveMeasurementAccess(ports, "aggregate", "data"), now = ports.now ?? Date.now;
  const client = await pool.connect(); let discard = false;
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
    // Hold the configuration head until all work and its receipt commit. A
    // concurrent revision cannot pause/replace it halfway through a scan.
    const { partition, registration } = await loadRegisteredPartition(client, initial.context.workspaceId, partitionId);
    const access = partitionAccess(partition, initial, now());
    const scanAt = new Date(now()).toISOString(), scanHour = bucketFor(scanAt, "hour").start;
    const prior = (await client.query(`SELECT manifest,manifest_sha256 FROM bsmoss_analysis.refresh_scan_receipt
      WHERE workspace_id=$1 AND partition_id=$2 AND partition_revision=$3 AND scan_hour=$4`,
    [partition.workspaceId, partition.id, partition.revision, scanHour])).rows[0];
    let manifest;
    if (prior) {
      if (fingerprintOf(prior.manifest) !== prior.manifest_sha256 || prior.manifest.configSha256 !== registration.configSha256 ||
          prior.manifest.partitionSha256 !== registration.partitionSha256) throw Error("invalid_refresh_scan_receipt");
      manifest = prior.manifest;
    } else {
      // The transaction lock also serializes same-configuration scans without
      // holding a global worker lock or relying on a process-local cursor.
      const locked = (await client.query("SELECT pg_try_advisory_xact_lock(hashtextextended($1,0)) AS locked", [JSON.stringify(["registered-scan", partition.workspaceId, partition.id, partition.revision, scanHour])])).rows[0].locked;
      if (!locked) { await client.query("ROLLBACK"); return { status: "busy" as const }; }
      const batch = planPeriodicBatch(partition.seeds, scanAt);
      const triggerRef = "registered-calendar:" + fingerprintOf([partition.workspaceId, partition.id, partition.revision, registration.partitionSha256, scanHour]);
      const queued = await enqueueRefreshInTransaction(pool, client, access, now, batch.targets, triggerRef);
      manifest = { version: "registered-scan-v1", partitionId: partition.id, partitionRevision: partition.revision,
        configSha256: registration.configSha256, partitionSha256: registration.partitionSha256, scanHour, scanAt, triggerRef,
        targets: batch.targets, jobs: queued.jobs.map(job => ({ id: job.id })), queueManifestSha256: queued.manifestSha256 };
    }
    const current = await resolveMeasurementAccess(ports, "aggregate", "data");
    partitionAccess(partition, current, now());
    if (!prior) await client.query(`INSERT INTO bsmoss_analysis.refresh_scan_receipt(workspace_id,partition_id,partition_revision,scan_hour,manifest,manifest_sha256,recorded_by)
      VALUES($1,$2,$3,$4,$5,$6,$7)`, [partition.workspaceId, partition.id, partition.revision, scanHour, JSON.stringify(manifest), fingerprintOf(manifest), current.context.sub]);
    if (current.expiresAt <= now()) throw Error("access_expired");
    await client.query("COMMIT");
    return { status: prior ? "duplicate" as const : "enqueued" as const, manifest };
  } catch (error) { try { await client.query("ROLLBACK"); } catch { discard = true; } throw error; }
  finally { client.release(discard); }
}
