import type { MetricRef } from "../catalog/registry.ts";
import { fingerprintOf } from "./intervals.ts";
import { bounds, bucketFor, instant, type Period } from "./periods.ts";
import { jobIdentity } from "./refresh-jobs.ts";
import { planPeriodicRefresh, planRevisionRefresh, type RefreshGrain } from "./refresh-planning.ts";
import type { AggregateTarget } from "./snapshot.ts";

export const REFRESH_COORDINATION_VERSION = "bsmoss-refresh-coordination-v1";
export interface RefreshSeed { sourceId: string; mappingId: string; metric: MetricRef; notBefore: string; grains: readonly RefreshGrain[] }
export interface RevisionImpact { sourceId: string; mappingId: string; metric: MetricRef; affected: readonly Period[]; grains: readonly RefreshGrain[] }
export function refreshTargets(raw: readonly AggregateTarget[]) {
  if (!Array.isArray(raw) || raw.length > 64) throw Error("refresh_batch_bound_exceeded");
  const targets = raw.map(input => {
    const t = structuredClone(input);
    if (!t || typeof t !== "object" || Array.isArray(t) || Object.keys(t).some(k => !["sourceId", "mappingId", "metric", "grain", "at"].includes(k)) ||
      !t.metric || typeof t.metric !== "object" || Array.isArray(t.metric) || Object.keys(t.metric).some(k => !["code", "version"].includes(k))) throw Error("invalid_refresh_target");
    [t.sourceId, t.mappingId, t.metric.code].forEach(jobIdentity);
    if (!Number.isSafeInteger(t.metric.version) || t.metric.version < 1) throw Error("invalid_refresh_target");
    t.at = bucketFor(t.at, t.grain).start;
    return t;
  });
  return [...new Map(targets.map(t => [fingerprintOf(t), t])).values()].sort((a, b) => fingerprintOf(a).localeCompare(fingerprintOf(b)));
}
function selectors(raw: unknown, allowed: readonly string[]) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || Object.keys(raw).some(k => !allowed.includes(k))) throw Error("invalid_refresh_seed");
}
// Seeds and revision impacts are internal, trusted catalog/evidence inputs.
// A later dispatcher must derive both old/new impacts from persisted evidence.
export function planPeriodicBatch(raw: readonly RefreshSeed[], now: string) {
  if (!Array.isArray(raw) || raw.length > 64) throw Error("refresh_batch_bound_exceeded");
  instant(now);
  const targets: AggregateTarget[] = [];
  for (const seed of structuredClone(raw)) {
    selectors(seed, ["sourceId", "mappingId", "metric", "notBefore", "grains"]);
    refreshTargets([{ sourceId: seed.sourceId, mappingId: seed.mappingId, metric: seed.metric, grain: "day", at: seed.notBefore }]);
    for (const window of planPeriodicRefresh({ now, notBefore: seed.notBefore, grains: seed.grains, limit: 64 }).windows) {
      targets.push({ sourceId: seed.sourceId, mappingId: seed.mappingId, metric: seed.metric, grain: window.grain, at: window.period.start });
      if (targets.length > 64) throw Error("refresh_batch_bound_exceeded");
    }
  }
  const scanHour = bucketFor(now, "hour").start;
  return { version: REFRESH_COORDINATION_VERSION, triggerRef: "calendar:" + REFRESH_COORDINATION_VERSION + ":" + scanHour, targets: refreshTargets(targets) };
}
export function planRevisionBatch(raw: readonly RevisionImpact[], evidenceRef: string) {
  if (!Array.isArray(raw) || raw.length > 64) throw Error("refresh_batch_bound_exceeded");
  jobIdentity(evidenceRef);
  const targets: AggregateTarget[] = [];
  for (const impact of structuredClone(raw)) {
    selectors(impact, ["sourceId", "mappingId", "metric", "affected", "grains"]);
    refreshTargets([{ sourceId: impact.sourceId, mappingId: impact.mappingId, metric: impact.metric, grain: "day", at: "2000-01-01T00:00:00Z" }]);
    if (!Array.isArray(impact.affected) || impact.affected.length > 64) throw Error("refresh_batch_bound_exceeded");
    impact.affected.forEach(bounds);
    for (const window of planRevisionRefresh({ affected: impact.affected, grains: impact.grains, limit: 64 }).windows) {
      targets.push({ sourceId: impact.sourceId, mappingId: impact.mappingId, metric: impact.metric, grain: window.grain, at: window.period.start });
      if (targets.length > 64) throw Error("refresh_batch_bound_exceeded");
    }
  }
  return { version: REFRESH_COORDINATION_VERSION, triggerRef: "revision:" + REFRESH_COORDINATION_VERSION + ":" + fingerprintOf(evidenceRef), targets: refreshTargets(targets) };
}
