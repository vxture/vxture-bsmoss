import { refKey } from "../catalog/registry.ts";
import { fingerprintOf } from "./intervals.ts";
import { bucketFor } from "./periods.ts";
import type { AggregateTarget } from "./snapshot.ts";
import type { AggregateKey } from "./store.ts";

export const REFRESH_JOB_VERSION = "bsmoss-refresh-job-v1";
export interface RefreshJob {
  workspaceId: string;
  sourceId: string;
  subjectKey: string;
  metricKey: string;
  target: AggregateTarget;
  triggerRef: string;
  dedupeKey: string;
}
export function jobIdentity(value: string) {
  if (typeof value !== "string" || !value.trim() || value.trim() !== value || value.length > 2048 || value === "*" || value.includes("\0")) throw Error("invalid_refresh_identity");
}
function targetFields(target: AggregateTarget) {
  if (!target || typeof target !== "object" || Array.isArray(target) || Object.keys(target).some(k => !["sourceId", "mappingId", "metric", "grain", "at"].includes(k)) ||
      !target.metric || typeof target.metric !== "object" || Array.isArray(target.metric) || Object.keys(target.metric).some(k => !["code", "version"].includes(k))) throw Error("invalid_refresh_target");
}
// Only trusted, already-authorized snapshots may construct queue requests.
// The mapping anchor is a locator, not part of stable-object job identity.
export function planRefreshJob(snapshot: { plan: AggregateKey & { workspaceId: string } }, rawTarget: AggregateTarget, triggerRef: string): RefreshJob {
  const plan = structuredClone(snapshot.plan), target = structuredClone(rawTarget);
  targetFields(target);
  for (const value of [plan.workspaceId, plan.sourceId, plan.subjectKey, target.mappingId, triggerRef]) jobIdentity(value);
  const period = bucketFor(target.at, target.grain);
  if (plan.sourceId !== target.sourceId || refKey(plan.metric) !== refKey(target.metric) || plan.grain !== target.grain ||
      plan.period.start !== period.start || plan.period.end !== period.end) throw Error("refresh_snapshot_mismatch");
  target.at = period.start;
  const metricKey = refKey(plan.metric);
  const dedupeKey = fingerprintOf({ version: REFRESH_JOB_VERSION, workspaceId: plan.workspaceId, sourceId: plan.sourceId,
    subjectKey: plan.subjectKey, metric: plan.metric, grain: plan.grain, period, triggerRef });
  return { workspaceId: plan.workspaceId, sourceId: plan.sourceId, subjectKey: plan.subjectKey, metricKey, target, triggerRef, dedupeKey };
}
export function validateRefreshJob(raw: RefreshJob): RefreshJob {
  const job = structuredClone(raw);
  targetFields(job.target);
  for (const value of [job.workspaceId, job.sourceId, job.subjectKey, job.metricKey, job.triggerRef]) jobIdentity(value);
  if (job.target.sourceId !== job.sourceId || refKey(job.target.metric) !== job.metricKey || !Number.isSafeInteger(job.target.metric.version) || job.target.metric.version < 1) throw Error("invalid_refresh_target");
  jobIdentity(job.target.mappingId);
  const period = bucketFor(job.target.at, job.target.grain);
  if (period.start !== job.target.at) throw Error("unaligned_refresh_target");
  const expected = fingerprintOf({ version: REFRESH_JOB_VERSION, workspaceId: job.workspaceId, sourceId: job.sourceId,
    subjectKey: job.subjectKey, metric: job.target.metric, grain: job.target.grain, period, triggerRef: job.triggerRef });
  if (job.dedupeKey !== expected) throw Error("invalid_refresh_dedupe");
  return job;
}
export function leaseSeconds(value: number) {
  if (!Number.isSafeInteger(value) || value < 5 || value > 900) throw Error("invalid_refresh_lease");
  return value;
}
export function maxAttempts(value: number) {
  if (!Number.isSafeInteger(value) || value < 1 || value > 8) throw Error("invalid_refresh_attempts");
  return value;
}
export function retrySeconds(attempt: number) { maxAttempts(attempt); return Math.min(900, 5 * 2 ** (attempt - 1)); }
export function failureCode(value: string) {
  if (typeof value !== "string" || !/^[a-z][a-z0-9_]{0,63}$/.test(value)) throw Error("invalid_refresh_failure_code");
  return value;
}
