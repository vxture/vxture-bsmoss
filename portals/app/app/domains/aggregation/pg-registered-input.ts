import type { Pool, PoolClient } from "pg";
import { resolveMeasurementAccess, type AccessPorts, type MeasurementAccess } from "../access/resolve.ts";
import { partitionAccess } from "./registered-partitions.ts";
import { loadRegisteredPartition, type InputPartitionBinding } from "./pg-registered-partition.ts";
import { dispatchInputChangeInTransaction, pendingInputChangesInTransaction, reopenInputChangeInTransaction, revalidateInputRefreshAccess } from "./pg-input-refresh.ts";
import { jobIdentity } from "./refresh-jobs.ts";
import { positiveRevision } from "./intervals.ts";

// The registration lock, input work/savepoint and all acknowledgments belong to
// this one transaction. Runtime identity still comes only from trusted ports.
async function inRegisteredTransaction<T extends object>(pool: Pool, ports: AccessPorts, partitionId: string,
  work: (client: PoolClient, access: MeasurementAccess, binding: InputPartitionBinding) => Promise<T>) {
  jobIdentity(partitionId);
  const initial = await resolveMeasurementAccess(ports, "aggregate", "data"), client = await pool.connect(); let discard = false;
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
    const binding = await loadRegisteredPartition(client, initial.context.workspaceId, partitionId);
    const access = partitionAccess(binding.partition, initial, (ports.now ?? Date.now)());
    const result = await work(client, access, binding);
    await revalidateInputRefreshAccess(ports, access, binding.partition.policy, binding);
    await client.query("COMMIT"); return { ...result, registration: binding.registration };
  } catch (error) { try { await client.query("ROLLBACK"); } catch { discard = true; } throw error; }
  finally { client.release(discard); }
}
export function pendingRegisteredInputChanges(pool: Pool, ports: AccessPorts, partitionId: string) {
  return inRegisteredTransaction(pool, ports, partitionId, (client, access, binding) =>
    pendingInputChangesInTransaction(client, access, binding.partition.policy, binding.registration));
}
export function dispatchRegisteredInputChange(pool: Pool, ports: AccessPorts, partitionId: string, changeId: string) {
  jobIdentity(changeId);
  return inRegisteredTransaction(pool, ports, partitionId, (client, access, binding) =>
    dispatchInputChangeInTransaction(pool, client, ports, access, changeId, binding.partition.policy, false, binding));
}
export function superviseRegisteredInputChange(pool: Pool, ports: AccessPorts, partitionId: string, changeId: string) {
  jobIdentity(changeId);
  return inRegisteredTransaction(pool, ports, partitionId, (client, access, binding) =>
    dispatchInputChangeInTransaction(pool, client, ports, access, changeId, binding.partition.policy, true, binding));
}
export function runRegisteredInputStep(pool: Pool, ports: AccessPorts, partitionId: string) {
  return inRegisteredTransaction(pool, ports, partitionId, async (client, access, binding) => {
    const pending = await pendingInputChangesInTransaction(client, access, binding.partition.policy, binding.registration);
    for (const changeId of pending.changeIds) {
      const result = await dispatchInputChangeInTransaction(pool, client, ports, access, changeId, binding.partition.policy, true, binding);
      if (["busy", "deferred", "quarantined"].includes(result.status)) continue;
      return { ...result, changeId };
    }
    return { status: pending.changeIds.length ? "contended" as const : "idle" as const };
  });
}
export function reopenRegisteredInputChange(pool: Pool, ports: AccessPorts, partitionId: string,
  raw: { changeId: string; expectedRevision: string; reasonRef: string }) {
  const input = structuredClone(raw);
  if (!input || Object.keys(input).some(k => !["changeId", "expectedRevision", "reasonRef"].includes(k))) throw Error("invalid_registered_reopen_request");
  jobIdentity(input.changeId); jobIdentity(input.reasonRef); positiveRevision(input.expectedRevision);
  return inRegisteredTransaction(pool, ports, partitionId, (client, access, binding) =>
    reopenInputChangeInTransaction(client, ports, access, { ...input, policy: binding.partition.policy }, binding));
}
