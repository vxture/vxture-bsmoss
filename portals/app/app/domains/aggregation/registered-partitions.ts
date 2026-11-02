import type { MeasurementScope } from "../measurements/store.ts";
import type { MeasurementAccess } from "../access/resolve.ts";
import { FIRST_METRICS } from "../catalog/first-metrics.ts";
import { refKey } from "../catalog/registry.ts";
import { inputRefreshSubscription, type InputRefreshPolicy } from "./input-refresh.ts";
import { fingerprintOf, positiveRevision } from "./intervals.ts";
import { jobIdentity } from "./refresh-jobs.ts";
import { planPeriodicBatch, type RefreshSeed } from "./refresh-coordination.ts";
import { instant } from "./periods.ts";

export interface RegisteredPartition {
  workspaceId: string; id: string; revision: string; subject: string; status: "active" | "paused";
  scope: MeasurementScope; policy: InputRefreshPolicy; seeds: readonly RefreshSeed[];
}
export function registeredPartition(raw: RegisteredPartition) {
  const p = structuredClone(raw);
  if (!p || typeof p !== "object" || Array.isArray(p) || Object.keys(p).some(k => !["workspaceId", "id", "revision", "subject", "status", "scope", "policy", "seeds"].includes(k))) throw Error("invalid_registered_partition");
  [p.workspaceId, p.id, p.subject].forEach(jobIdentity); positiveRevision(p.revision);
  if (!["active", "paused"].includes(p.status) || !p.scope || p.scope.workspaceId !== p.workspaceId ||
      Object.keys(p.scope).some(k => !["workspaceId", "sourceIds", "stationIds", "serviceIds", "deviceIds", "metricKeys", "allowSiteParameters"].includes(k))) throw Error("invalid_registered_partition");
  const { policy } = inputRefreshSubscription(p.scope, p.policy);
  const list = (values: readonly string[]) => [...new Set(values)].sort();
  p.scope = { workspaceId: p.workspaceId, sourceIds: list(p.scope.sourceIds), stationIds: list(p.scope.stationIds),
    serviceIds: list(p.scope.serviceIds), deviceIds: list(p.scope.deviceIds), metricKeys: list(p.scope.metricKeys), allowSiteParameters: p.scope.allowSiteParameters };
  p.policy = policy;
  for (const output of policy.outputs) for (const dependency of FIRST_METRICS.get(output)!.semantic === "derived" ? FIRST_METRICS.get(output)!.dependencies : []) {
    if (!p.scope.metricKeys.includes(refKey(dependency))) throw Error("aggregate_dependency_scope_denied");
  }
  if (!Array.isArray(p.seeds) || !p.seeds.length || p.seeds.length > 12) throw Error("invalid_registered_seeds");
  const seeds = p.seeds.map((seed: RefreshSeed) => {
    if (!seed || typeof seed !== "object" || Array.isArray(seed) || Object.keys(seed).some(k => !["sourceId", "mappingId", "metric", "notBefore", "grains"].includes(k))) throw Error("invalid_registered_seeds");
    // Existing pure validators reject malformed refs and unsupported grains.
    planPeriodicBatch([seed], seed.notBefore);
    if (!p.scope.sourceIds.includes(seed.sourceId) || !policy.outputs.some(m => refKey(m) === refKey(seed.metric)) ||
        !seed.grains.every(g => policy.grains.includes(g))) throw Error("registered_seed_scope_denied");
    return { ...seed, metric: { ...seed.metric }, grains: [...seed.grains].sort(), notBefore: new Date(instant(seed.notBefore)).toISOString() };
  }).sort((a, b) => fingerprintOf(a).localeCompare(fingerprintOf(b)));
  const keys = seeds.map(seed => fingerprintOf([seed.sourceId, seed.mappingId, seed.metric]));
  if (new Set(keys).size !== keys.length) throw Error("duplicate_registered_seed");
  p.seeds = seeds;
  return { partition: p, sha256: fingerprintOf({ version: "registered-partition-v1", partition: p }) };
}
export function partitionAccess(raw: RegisteredPartition, access: MeasurementAccess, now: number): MeasurementAccess {
  const { partition: p } = registeredPartition(raw);
  if (p.status !== "active") throw Error("registered_partition_paused");
  if (access.context.workspaceId !== p.workspaceId || access.context.sub !== p.subject) throw Error("registered_partition_subject_denied");
  if (access.expiresAt <= now) throw Error("access_expired");
  const s = access.scope;
  if (s.workspaceId !== p.workspaceId || (["sourceIds", "stationIds", "serviceIds", "deviceIds", "metricKeys"] as const)
    .some(key => p.scope[key].some(id => !s[key].includes(id))) || p.scope.allowSiteParameters && !s.allowSiteParameters) throw Error("registered_partition_scope_denied");
  return { ...access, scope: structuredClone(p.scope) };
}
