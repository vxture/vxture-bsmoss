import { fields } from "../reports/rules.ts";
import { jobIdentity } from "../aggregation/refresh-jobs.ts";

export interface WorkerOptions { maxStepsPerTick: number; pollMilliseconds: number }
export interface ReportWorkerConfig extends WorkerOptions {
  workspaceId: string; subject: string; scheduleIds: readonly string[]; executeExports: boolean;
  reconcileHistory?: boolean;
}
export interface AggregateWorkerConfig extends WorkerOptions {
  workspaceId: string; subject: string; partitionIds: readonly string[]; executeResults: boolean;
}
export function aggregateWorkerConfig(raw: AggregateWorkerConfig): AggregateWorkerConfig {
  fields(raw, ["workspaceId", "subject", "partitionIds", "executeResults", "maxStepsPerTick", "pollMilliseconds"]);
  jobIdentity(raw.workspaceId); jobIdentity(raw.subject);
  // Each partition has separate calendar and change lanes, plus one result lane.
  if (!Array.isArray(raw.partitionIds) || raw.partitionIds.length > 32 || typeof raw.executeResults !== "boolean" ||
    new Set(raw.partitionIds).size !== raw.partitionIds.length || (!raw.partitionIds.length && !raw.executeResults)) throw Error("invalid_aggregate_worker_config");
  raw.partitionIds.forEach(jobIdentity);
  return { ...structuredClone(raw), ...workerOptions({ maxStepsPerTick: raw.maxStepsPerTick, pollMilliseconds: raw.pollMilliseconds }) };
}
export function workerOptions(raw: WorkerOptions): WorkerOptions {
  fields(raw, ["maxStepsPerTick", "pollMilliseconds"]);
  if (!Number.isSafeInteger(raw.maxStepsPerTick) || raw.maxStepsPerTick < 1 || raw.maxStepsPerTick > 25 ||
    !Number.isSafeInteger(raw.pollMilliseconds) || raw.pollMilliseconds < 1000 || raw.pollMilliseconds > 60000) throw Error("invalid_worker_options");
  return structuredClone(raw);
}
export function reportWorkerConfig(raw: ReportWorkerConfig): ReportWorkerConfig {
  fields(raw, ["workspaceId", "subject", "scheduleIds", "executeExports", "reconcileHistory", "maxStepsPerTick", "pollMilliseconds"]);
  jobIdentity(raw.workspaceId); jobIdentity(raw.subject);
  if (raw.reconcileHistory !== undefined && typeof raw.reconcileHistory !== "boolean") throw Error("invalid_report_worker_config");
  if (!Array.isArray(raw.scheduleIds) || raw.scheduleIds.length > (raw.reconcileHistory ? 32 : 64) || typeof raw.executeExports !== "boolean" ||
    new Set(raw.scheduleIds).size !== raw.scheduleIds.length || (!raw.scheduleIds.length && !raw.executeExports)) throw Error("invalid_report_worker_config");
  raw.scheduleIds.forEach(jobIdentity);
  return { ...structuredClone(raw), ...workerOptions({ maxStepsPerTick: raw.maxStepsPerTick, pollMilliseconds: raw.pollMilliseconds }) };
}
export type WorkerFailure = "authorization_denied" | "configuration_unavailable" | "storage_unavailable" | "serialization_conflict" | "execution_failed";
export function workerFailure(error: unknown): WorkerFailure {
  const message = error instanceof Error ? error.message : "", code = error && typeof error === "object" && "code" in error ? error.code : null;
  if (["worker_identity_invalid", "worker_identity_unconfigured", "worker_identity_unavailable"].includes(message)) return "authorization_denied";
  if (["40001", "40P01"].includes(String(code)) || ["report_revision_conflict", "aggregate_revision_conflict"].includes(message)) return "serialization_conflict";
  if (["identity_required", "feature_denied", "permission_denied", "access_expired", "invalid_coverage", "report_scope_denied", "report_schedule_subject_denied", "workspace_mismatch", "aggregate_scope_denied", "aggregate_dependency_scope_denied", "object_scope_denied", "registered_partition_subject_denied", "registered_partition_scope_denied"].includes(message) || code === "42501") return "authorization_denied";
  if (["report_schedule_unavailable", "report_schedule_paused", "report_schedule_template_changed", "registered_partition_unavailable", "registered_partition_paused"].includes(message)) return "configuration_unavailable";
  if (["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "57P01", "53300"].includes(String(code))) return "storage_unavailable";
  return "execution_failed";
}
export function workerRetryMilliseconds(failures: number): number {
  if (!Number.isSafeInteger(failures) || failures < 1) throw Error("invalid_worker_failures");
  return Math.min(60000, 5000 * 2 ** Math.min(failures - 1, 4));
}
