import { fingerprintOf } from "../aggregation/intervals.ts";
import { jobIdentity } from "../aggregation/refresh-jobs.ts";
import { reportScope } from "../reports/rules.ts";
import type { MeasurementScope } from "../measurements/store.ts";
import type { UpdateDetail } from "./contracts.ts";

export interface UpdateManifest {
  version: "received-data-update-v1";
  partitionId: string;
  partitionRevision: string;
  subscriptionSha256: string;
  changeIds: string[];
  scope: MeasurementScope;
}
export function updateManifest(raw: UpdateManifest): UpdateManifest {
  if (!raw || Array.isArray(raw) || Object.keys(raw).sort().join() !== "changeIds,partitionId,partitionRevision,scope,subscriptionSha256,version" ||
      raw.version !== "received-data-update-v1" || typeof raw.partitionRevision !== "string" || !/^[1-9]\d{0,29}$/.test(raw.partitionRevision) ||
      typeof raw.subscriptionSha256 !== "string" || !/^[a-f0-9]{64}$/.test(raw.subscriptionSha256) || !Array.isArray(raw.changeIds) || !raw.changeIds.length || raw.changeIds.length > 64) throw Error("invalid_update_manifest");
  jobIdentity(raw.partitionId); raw.changeIds.forEach(jobIdentity);
  if (new Set(raw.changeIds).size !== raw.changeIds.length) throw Error("invalid_update_manifest");
  return { ...raw, scope: reportScope(raw.scope), changeIds: [...raw.changeIds].sort() };
}
export function updateKey(workspaceId: string, raw: UpdateManifest) {
  jobIdentity(workspaceId); const m = updateManifest(raw);
  if (workspaceId !== m.scope.workspaceId) throw Error("workspace_mismatch");
  return fingerprintOf([workspaceId, m]);
}
export interface InputProgress { id: string; dispatched: boolean; state: "retry" | "quarantined" | "reopened" | null; failureCode: string | null; revision?: string; retryAt?: string | null }
export interface ResultProgress { id: string; status: "pending" | "leased" | "succeeded" | "dead"; failureCode: string | null; attempt?: number; leaseExpired?: boolean }
// Counts describe actual ledger entries and jobs, never an estimated percentage.
// "processed" does not publish a cross-domain usable version (a separate step).
export function updateProgress(inputs: readonly InputProgress[], jobs: readonly ResultProgress[]): UpdateDetail["progress"] {
  if (!inputs.length || inputs.length > 64 || jobs.length > 4096 || new Set(inputs.map(x => x.id)).size !== inputs.length || new Set(jobs.map(x => x.id)).size !== jobs.length ||
      inputs.some(x => ![null, "retry", "quarantined", "reopened"].includes(x.state) || typeof x.dispatched !== "boolean") ||
      jobs.some(x => !["pending", "leased", "succeeded", "dead"].includes(x.status))) throw Error("invalid_update_progress");
  const dispatched = inputs.filter(x => x.dispatched).length;
  const blocked = inputs.filter(x => !x.dispatched && x.state === "quarantined").length;
  const succeeded = jobs.filter(x => x.status === "succeeded").length, failed = jobs.filter(x => x.status === "dead").length;
  const phase = blocked || failed ? "failed" : dispatched < inputs.length ? "dispatching" : succeeded < jobs.length ? "recomputing" : "processed";
  return { phase, inputs: { total: inputs.length, dispatched, blocked }, results: { total: jobs.length, succeeded, failed,
      running: jobs.filter(x => x.status === "leased" && !x.leaseExpired).length, waiting: jobs.filter(x => x.status === "pending" || x.status === "leased" && x.leaseExpired).length },
    failures: [...inputs.filter(x => !x.dispatched && x.failureCode).map(x => ({ kind: "input" as const, id: x.id, code: x.failureCode!,
        expectedRevision: x.revision ?? null, retryAt: x.state === "retry" ? x.retryAt ?? null : null, canRetry: x.state === "quarantined" })),
      ...jobs.filter(x => x.status !== "succeeded" && x.failureCode).map(x => ({ kind: "result" as const, id: x.id, code: x.failureCode!, expectedAttempt: x.attempt ?? null, canRetry: x.status === "dead" }))] };
}
