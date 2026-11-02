import type { Pool } from "pg";
import { resolveMeasurementAccess, type AccessPorts } from "../access/resolve.ts";
import { registeredPartition, partitionAccess } from "./registered-partitions.ts";
import { fingerprintOf } from "./intervals.ts";
import { bucketFor } from "./periods.ts";
import { planPeriodicBatch } from "./refresh-coordination.ts";
import { enqueueRefreshInTransaction } from "./refresh-enqueue.ts";
import { jobIdentity } from "./refresh-jobs.ts";

// Internal composition only: the caller selects an ID, never a scope or seeds.
export async function enqueueRegisteredPeriodic(pool: Pool, ports: AccessPorts, partitionId: string) {
  jobIdentity(partitionId);
  const initial = await resolveMeasurementAccess(ports, "aggregate", "data"), now = ports.now ?? Date.now;
  const client = await pool.connect(); let discard = false;
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
    // Hold the configuration head until all work and its receipt commit. A
    // concurrent revision cannot pause/replace it halfway through a scan.
    const head = (await client.query("SELECT bsmoss_integration.lock_refresh_partition($1,$2)::text AS revision", [initial.context.workspaceId, partitionId])).rows[0];
    if (!head?.revision) throw Error("registered_partition_unavailable");
    const row = (await client.query(`SELECT *,config_sha256=encode(sha256(convert_to(config::text,'UTF8')),'hex') AS valid
      FROM bsmoss_integration.refresh_partition_revision WHERE workspace_id=$1 AND id=$2 AND revision=$3`,
    [initial.context.workspaceId, partitionId, head.revision])).rows[0];
    if (!row || !row.valid) throw Error("invalid_registered_partition_evidence");
    const normalized = registeredPartition({ ...row.config, workspaceId: row.workspace_id, id: row.id, revision: row.revision });
    const { partition } = normalized, access = partitionAccess(partition, initial, now());
    const scanAt = new Date(now()).toISOString(), scanHour = bucketFor(scanAt, "hour").start;
    const prior = (await client.query(`SELECT manifest,manifest_sha256 FROM bsmoss_analysis.refresh_scan_receipt
      WHERE workspace_id=$1 AND partition_id=$2 AND partition_revision=$3 AND scan_hour=$4`,
    [partition.workspaceId, partition.id, partition.revision, scanHour])).rows[0];
    let manifest;
    if (prior) {
      if (fingerprintOf(prior.manifest) !== prior.manifest_sha256 || prior.manifest.configSha256 !== row.config_sha256 ||
          prior.manifest.partitionSha256 !== normalized.sha256) throw Error("invalid_refresh_scan_receipt");
      manifest = prior.manifest;
    } else {
      // The transaction lock also serializes same-configuration scans without
      // holding a global worker lock or relying on a process-local cursor.
      const locked = (await client.query("SELECT pg_try_advisory_xact_lock(hashtextextended($1,0)) AS locked", [JSON.stringify(["registered-scan", partition.workspaceId, partition.id, partition.revision, scanHour])])).rows[0].locked;
      if (!locked) { await client.query("ROLLBACK"); return { status: "busy" as const }; }
      const batch = planPeriodicBatch(partition.seeds, scanAt);
      const triggerRef = "registered-calendar:" + fingerprintOf([partition.workspaceId, partition.id, partition.revision, normalized.sha256, scanHour]);
      const queued = await enqueueRefreshInTransaction(pool, client, access, now, batch.targets, triggerRef);
      manifest = { version: "registered-scan-v1", partitionId: partition.id, partitionRevision: partition.revision,
        configSha256: row.config_sha256, partitionSha256: normalized.sha256, scanHour, scanAt, triggerRef,
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
