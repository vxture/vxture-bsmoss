import { FIRST_METRICS } from "../catalog/first-metrics.ts";
import { refKey, type MetricRef, type Grain } from "../catalog/registry.ts";
import type { MeasurementScope } from "../measurements/store.ts";
import { fingerprintOf, positiveRevision } from "./intervals.ts";
import { bounds, bucketFor, type Period } from "./periods.ts";
import { refreshTargets } from "./refresh-coordination.ts";
import { jobIdentity } from "./refresh-jobs.ts";
import { planRevisionRefresh, type RefreshGrain } from "./refresh-planning.ts";

export const INPUT_REFRESH_VERSION = "bsmoss-input-refresh-v1";
// Server-owned output subscription, never a request-supplied authorization scope.
export interface InputRefreshPolicy { outputs: readonly MetricRef[]; grains: readonly RefreshGrain[] }
export interface InputRefreshRegistration { partitionId: string; revision: string; configSha256: string; partitionSha256: string }
export interface InputImpact { sourceId: string; mappingId: string; metric: MetricRef; period: Period; mappingEnd: string }
export interface CompletionImpact { sourceId: string; mappingId: string; metric: MetricRef; grain: Grain; period: Period }
export function planCompletionRefresh(impact: CompletionImpact, policy: InputRefreshPolicy) {
  const row = structuredClone(impact), canonical = bucketFor(row.period.start, row.grain), [start, end] = bounds(row.period);
  if (Date.parse(canonical.start) !== start || Date.parse(canonical.end) !== end) throw Error("unaligned_completion_period");
  const metric = FIRST_METRICS.get(row.metric);
  if (!Number.isSafeInteger(row.metric.version) || !metric || metric.lifecycle === "retired" || !metric.grains.includes(row.grain)) throw Error("unsupported_aggregate_metric");
  // Proofs confirm one exact target. They do not make coarser periods or
  // dependency outputs complete and cannot be treated as fresh measurements.
  if (!policy.grains.some(g => g === row.grain) || !policy.outputs.some(ref => refKey(ref) === refKey(row.metric))) return [];
  return refreshTargets([{ sourceId: row.sourceId, mappingId: row.mappingId, metric: row.metric, grain: row.grain, at: canonical.start }]);
}
export function inputRefreshSubscription(scope: MeasurementScope, raw: InputRefreshPolicy, rawRegistration?: InputRefreshRegistration) {
  const policy = structuredClone(raw);
  if (!policy || Object.keys(policy).some(k => !["outputs", "grains"].includes(k)) || !Array.isArray(policy.outputs) || !policy.outputs.length || policy.outputs.length > 16) throw Error("invalid_input_refresh_policy");
  planRevisionRefresh({ affected: [], grains: policy.grains });
  const outputs = policy.outputs.map(ref => {
    if (!ref || Object.keys(ref).some(k => !["code", "version"].includes(k)) || !Number.isSafeInteger(ref.version)) throw Error("invalid_input_refresh_policy");
    const metric = FIRST_METRICS.get(ref);
    if (!metric || metric.lifecycle === "retired" || !policy.grains.every(g => metric.grains.includes(g))) throw Error("unsupported_aggregate_metric");
    if (!scope.metricKeys.includes(refKey(ref))) throw Error("aggregate_scope_denied");
    return { ...ref };
  }).sort((a, b) => refKey(a).localeCompare(refKey(b)));
  if (new Set(outputs.map(refKey)).size !== outputs.length) throw Error("invalid_input_refresh_policy");
  const list = (values: readonly string[]) => { if (!Array.isArray(values) || values.length > 10000) throw Error("invalid_aggregate_scope"); values.forEach(jobIdentity); return [...new Set(values)].sort(); };
  jobIdentity(scope.workspaceId);
  if (typeof scope.allowSiteParameters !== "boolean") throw Error("invalid_aggregate_scope");
  const normalized = { ...scope, sourceIds: list(scope.sourceIds), stationIds: list(scope.stationIds), metricKeys: list(scope.metricKeys),
    serviceIds: list(scope.serviceIds), deviceIds: list(scope.deviceIds) };
  const result = { outputs, grains: [...policy.grains].sort() };
  const registration = rawRegistration === undefined ? undefined : structuredClone(rawRegistration);
  if (registration !== undefined) {
    if (!registration || typeof registration !== "object" || Array.isArray(registration) ||
        Object.keys(registration).some(k => !["partitionId", "revision", "configSha256", "partitionSha256"].includes(k))) throw Error("invalid_input_registration");
    jobIdentity(registration.partitionId); positiveRevision(registration.revision);
    if (![registration.configSha256, registration.partitionSha256].every(v => typeof v === "string" && /^[a-f0-9]{64}$/.test(v))) throw Error("invalid_input_registration");
  }
  const binding = registration === undefined ? {} : { registration };
  return { policy: result, ...binding, sha256: fingerprintOf({ version: INPUT_REFRESH_VERSION, scope: normalized, policy: result, ...binding }) };
}
export function planInputRefresh(raw: readonly InputImpact[], policy: InputRefreshPolicy) {
  if (!Array.isArray(raw) || raw.length > 1000) throw Error("input_history_bound_exceeded");
  const targets = [];
  for (const row of structuredClone(raw)) {
    const [start, end] = bounds(row.period), metric = FIRST_METRICS.get(row.metric);
    if (!metric) throw Error("unsupported_aggregate_metric");
    // A short/expired/pending state event can suppress an older heartbeat until
    // its hold ends. Use the product's maximum reviewed hold, not its own TTL.
    const effectEnd = metric.semantic === "state" ? Math.min(Math.max(end, start + 86400000), Date.parse(row.mappingEnd)) : end;
    if (!Number.isFinite(effectEnd) || effectEnd < end) throw Error("invalid_input_impact");
    const windows = planRevisionRefresh({ affected: [{ start: row.period.start, end: new Date(effectEnd).toISOString() }], grains: policy.grains, limit: 64 }).windows;
    for (const output of policy.outputs) {
      const target = FIRST_METRICS.get(output);
      if (!target || target.lifecycle === "retired") throw Error("unsupported_aggregate_metric");
      if (refKey(output) !== refKey(row.metric) && !target.dependencies.some(ref => refKey(ref) === refKey(row.metric))) continue;
      for (const window of windows) targets.push({ sourceId: row.sourceId, mappingId: row.mappingId, metric: output, grain: window.grain, at: window.period.start });
    }
  }
  // Deduplicate before bounding; repeated revisions of one object/window are
  // evidence, not separate tasks. No silent truncation or success on overflow.
  const unique = [...new Map(targets.map(t => [fingerprintOf(t), t])).values()];
  return refreshTargets(unique);
}
