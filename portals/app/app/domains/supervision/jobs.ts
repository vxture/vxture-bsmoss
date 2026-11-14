import { jobIdentity, maxAttempts, validateRefreshJob, type RefreshJob } from "../aggregation/refresh-jobs.ts";
import { fields, reportScope } from "../reports/rules.ts";
import { mappedSubject } from "../aggregation/subjects.ts";
import type { MeasurementScope } from "../measurements/store.ts";
import { refKey } from "../catalog/registry.ts";
import { resolveIntervalInputPolicy } from "../aggregation/input-policy.ts";
import type { readRefreshSnapshot } from "../aggregation/refresh-snapshot.ts";
import { FIRST_METRICS } from "../catalog/first-metrics.ts";

export const JOB_STATES = ["all", "pending", "leased", "succeeded", "dead"] as const;
export type JobStateFilter = typeof JOB_STATES[number];
export interface JobListQuery { status: JobStateFilter; limit: number; after?: string }
export interface JobCursor { createdAt: string; jobId: string; status: JobStateFilter }
export interface JobQuery { jobId: string }
export interface RecoverJob extends JobQuery { expectedAttempt: number; commandId: string; reasonRef: string }
export interface JobAttempt { attempt: number; outcome: "succeeded" | "retry" | "dead" | "expired"; failureCode: string | null; resultRef: string | null; recordedAt: string }
export interface RecoveryRecord {
  commandId: string; originalJobId: string; replacementJobId: string; originalAttempt: number; reasonRef: string; requestedBy: string; recordedAt: string;
}
export interface JobSummary {
  id: string; status: Exclude<JobStateFilter, "all">; attempt: number; maxAttempts: number;
  target: RefreshJob["target"]; createdAt: string; availableAt: string; updatedAt: string; leaseUntil: string | null;
  readiness: "ready" | "delayed" | "running" | "lease_expired" | "terminal";
}
export interface JobDetail { job: JobSummary; attempts: JobAttempt[]; recoveredFrom: RecoveryRecord | null; recovery: RecoveryRecord | null }
export interface JobListPage { items: JobSummary[]; next: string | null }
export interface RecoveryResult { status: "inserted" | "duplicate"; record: RecoveryRecord }
export type RevalidateJob = (required: MeasurementScope) => Promise<void>;
export interface AggregateJobStore {
  readonly workspaceId: string;
  list(query: JobListQuery, revalidate: RevalidateJob): Promise<JobListPage>;
  read(query: JobQuery, revalidate: RevalidateJob): Promise<JobDetail | null>;
  recover(command: RecoverJob, actor: string, revalidate: RevalidateJob): Promise<RecoveryResult>;
}
export function normalizeJobQuery(raw: JobQuery): JobQuery { fields(raw, ["jobId"]); jobIdentity(raw.jobId); return structuredClone(raw); }
export function normalizeRecoverJob(raw: RecoverJob): RecoverJob {
  fields(raw, ["jobId", "expectedAttempt", "commandId", "reasonRef"]);
  [raw.jobId, raw.commandId, raw.reasonRef].forEach(jobIdentity); maxAttempts(raw.expectedAttempt);
  return structuredClone(raw);
}
export function decodeJobCursor(value: string): JobCursor {
  if (typeof value !== "string" || value.length > 8192 || !/^[A-Za-z0-9_-]+$/.test(value)) throw Error("invalid_job_cursor");
  const text = Buffer.from(value, "base64url").toString("utf8");
  if (Buffer.from(text).toString("base64url") !== value) throw Error("invalid_job_cursor");
  let cursor: JobCursor; try { cursor = JSON.parse(text); } catch { throw Error("invalid_job_cursor"); }
  fields(cursor, ["createdAt", "jobId", "status"]); jobIdentity(cursor.jobId);
  if (!JOB_STATES.includes(cursor.status) || typeof cursor.createdAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(cursor.createdAt) ||
    !Number.isFinite(Date.parse(cursor.createdAt)) || new Date(cursor.createdAt).toISOString() !== cursor.createdAt.slice(0, 23) + "Z") throw Error("invalid_job_cursor");
  return cursor;
}
export function encodeJobCursor(cursor: JobCursor) { const value = Buffer.from(JSON.stringify(cursor)).toString("base64url"); decodeJobCursor(value); return value; }
export function normalizeJobList(raw: JobListQuery): JobListQuery {
  fields(raw, ["status", "limit", "after"]);
  if (!JOB_STATES.includes(raw.status) || !Number.isSafeInteger(raw.limit) || raw.limit < 1 || raw.limit > 25) throw Error("invalid_job_filter");
  if (raw.after !== undefined && decodeJobCursor(raw.after).status !== raw.status) throw Error("invalid_job_cursor");
  return structuredClone(raw);
}
// Lifecycle visibility uses the exact mapped object and output, not unrelated
// grants or a guessed dependency policy from a currently unavailable source.
export function jobScope(raw: RefreshJob): MeasurementScope {
  const job = validateRefreshJob(raw), ids: unknown = JSON.parse(job.subjectKey);
  if (!Array.isArray(ids) || ids.length !== 5 || ids[0] !== "mapped-object-v1" || typeof ids[1] !== "string" ||
    ids.slice(2).some(id => id !== null && typeof id !== "string") || mappedSubject(ids[1], ids[2], ids[3], ids[4]) !== job.subjectKey) throw Error("invalid_job_evidence");
  return reportScope({ workspaceId: job.workspaceId, sourceIds: [job.sourceId], stationIds: [ids[1]], serviceIds: ids[2] === null ? [] : [ids[2]],
    deviceIds: ids[4] === null ? [] : [ids[4]], metricKeys: [job.metricKey], allowSiteParameters: ids[2] === null && ids[4] === null });
}
export interface RecoveryInputPolicy { kind: "interval" | "state" | "gauge"; inputMode: "direct" | "dependencies" | null }
export function reviewedRecoveryScope(job: RefreshJob, policy: RecoveryInputPolicy, availableMetricKeys: readonly string[]) {
  fields(policy, ["kind", "inputMode"]); const needed = jobScope(job), metric = FIRST_METRICS.get(job.target.metric);
  const kind = metric?.semantic === "state" ? "state" : metric?.semantic === "gauge" ? "gauge" : metric && ["interval_delta", "ratio", "derived"].includes(metric.semantic) ? "interval" : null;
  if (policy.kind !== kind || kind !== "interval" && policy.inputMode !== null) throw Error("invalid_job_recovery_policy");
  return reportScope({ ...needed, metricKeys: kind === "interval" ? [...new Set([job.metricKey,
    ...resolveIntervalInputPolicy(job.target.metric, job.target.grain, policy.inputMode, availableMetricKeys).refs.map(refKey)])] : needed.metricKeys });
}
export function recoveryScope(job: RefreshJob, snapshot: Awaited<ReturnType<typeof readRefreshSnapshot>>, scope: MeasurementScope) {
  const needed = jobScope(job), plan = snapshot.plan;
  if (plan.workspaceId !== job.workspaceId || plan.subjectKey !== job.subjectKey || plan.sourceId !== job.sourceId || refKey(plan.metric) !== job.metricKey) throw Error("refresh_snapshot_mismatch");
  return reviewedRecoveryScope(job, { kind: snapshot.kind, inputMode: snapshot.kind === "interval" ? snapshot.plan.inputMode : null }, scope.metricKeys);
}
