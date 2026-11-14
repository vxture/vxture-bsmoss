import type { PoolClient } from "pg";
import { registeredPartition, type RegisteredPartition } from "./registered-partitions.ts";
import type { InputRefreshRegistration } from "./input-refresh.ts";
import { jobIdentity } from "./refresh-jobs.ts";

export interface InputPartitionBinding { partition: RegisteredPartition; registration: InputRefreshRegistration }
// Caller owns the RR transaction. The lock survives work SAVEPOINT rollbacks.
export async function loadRegisteredPartition(client: PoolClient, workspaceId: string, partitionId: string): Promise<InputPartitionBinding> {
  jobIdentity(workspaceId); jobIdentity(partitionId);
  const head = (await client.query("SELECT bsmoss_integration.lock_refresh_partition($1,$2)::text AS revision", [workspaceId, partitionId])).rows[0];
  if (!head?.revision) throw Error("registered_partition_unavailable");
  const row = (await client.query(`SELECT *,config_sha256=encode(sha256(convert_to(config::text,'UTF8')),'hex') AS valid
    FROM bsmoss_integration.refresh_partition_revision WHERE workspace_id=$1 AND id=$2 AND revision=$3`,
  [workspaceId, partitionId, head.revision])).rows[0];
  if (!row || !row.valid) throw Error("invalid_registered_partition_evidence");
  const normalized = registeredPartition({ ...row.config, workspaceId: row.workspace_id, id: row.id, revision: row.revision });
  return { partition: normalized.partition, registration: { partitionId, revision: row.revision, configSha256: row.config_sha256, partitionSha256: normalized.sha256 } };
}
