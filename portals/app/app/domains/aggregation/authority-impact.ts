import { FIRST_METRICS } from "../catalog/first-metrics.ts";
import { refKey, type MetricRef, type Grain } from "../catalog/registry.ts";
import type { MeasurementScope } from "../measurements/store.ts";
import { fingerprintOf, positiveRevision } from "./intervals.ts";
import { bounds, type Period } from "./periods.ts";
import { jobIdentity } from "./refresh-jobs.ts";
import { mappedSubject } from "./subjects.ts";
import { planRevisionRefresh } from "./refresh-planning.ts";
import type { InputRefreshPolicy } from "./input-refresh.ts";

export interface AuthorityObject { sourceId: string; mappingId: string; stationId: string; serviceId: string | null; networkObjectId: string | null; deviceId: string | null }
export interface AuthorityChange {
  id: string; entityId: string; kind: "source_mapping" | "source_capability" | "station_service"; revision: string;
  operation: string; snapshots: readonly Record<string, unknown>[]; evidenceSha256: string;
}
const identityFields = { source_mapping: ["source_id", "external_type", "external_id", "station_id", "service_id", "network_object_id", "device_id"],
  source_capability: ["source_id", "metric_code", "metric_version"], station_service: ["station_id", "operator_entity_id"] };
export function authorityChange(row: Record<string, unknown>, scope: MeasurementScope): AuthorityChange {
  if (row.workspace_id !== scope.workspaceId) throw Error("input_change_unavailable");
  const kind = row.entity_kind as AuthorityChange["kind"];
  if (!Object.hasOwn(identityFields, kind)) throw Error("invalid_authority_evidence");
  const snapshots = [row.before_snapshot, row.after_snapshot].filter(s => s !== null) as Record<string, unknown>[];
  if (!snapshots.length || snapshots.some(s => !s || Array.isArray(s) || s.workspace_id !== scope.workspaceId || s.id !== row.entity_id)) throw Error("invalid_authority_evidence");
  for (const snapshot of snapshots) {
    jobIdentity(snapshot.id as string); bounds({ start: snapshot.valid_from as string, end: snapshot.valid_to as string });
    if (kind === "source_capability") {
      if (!scope.sourceIds.includes(snapshot.source_id as string) || !scope.metricKeys.includes(snapshot.metric_code + "@" + snapshot.metric_version)) throw Error("aggregate_scope_denied");
    } else {
      if (!scope.stationIds.includes(snapshot.station_id as string)) throw Error("object_scope_denied");
      if (kind === "station_service") { if (!scope.serviceIds.includes(snapshot.id as string)) throw Error("object_scope_denied"); }
      else if (!scope.sourceIds.includes(snapshot.source_id as string) || !authorityObjectAllowed(objectFromMapping(snapshot), scope)) throw Error("object_scope_denied");
    }
  }
  if (snapshots.length === 2 && identityFields[kind].some(key => snapshots[0]![key] !== snapshots[1]![key])) throw Error("authority_object_immutable");
  jobIdentity(row.id as string); positiveRevision(row.revision as string);
  if (!/^[a-f0-9]{64}$/.test(row.evidence_sha256 as string)) throw Error("invalid_authority_evidence");
  return { id: row.id as string, entityId: row.entity_id as string, kind, revision: row.revision as string, operation: row.operation as string, snapshots, evidenceSha256: row.evidence_sha256 as string };
}
export function objectFromMapping(row: Record<string, unknown>): AuthorityObject {
  const o = { sourceId: row.source_id as string, mappingId: row.id as string, stationId: row.station_id as string,
    serviceId: row.service_id as string | null, networkObjectId: row.network_object_id as string | null, deviceId: row.device_id as string | null };
  [o.sourceId, o.mappingId, o.stationId].forEach(jobIdentity);
  for (const id of [o.serviceId, o.networkObjectId, o.deviceId]) if (id !== null) jobIdentity(id);
  return o;
}
export function authorityObjectAllowed(o: AuthorityObject, s: MeasurementScope) {
  return s.sourceIds.includes(o.sourceId) && s.stationIds.includes(o.stationId) && (!o.serviceId || s.serviceIds.includes(o.serviceId)) &&
    (!o.deviceId || s.deviceIds.includes(o.deviceId)) && (!!o.serviceId || !!o.deviceId || s.allowSiteParameters);
}
export const authoritySubject = (o: AuthorityObject) => mappedSubject(o.stationId, o.serviceId, o.networkObjectId, o.deviceId);
export function authorityOutputRelevant(change: AuthorityChange, output: MetricRef) {
  if (change.kind !== "source_capability") return true;
  const keys = change.snapshots.map(s => s.metric_code + "@" + s.metric_version), definition = FIRST_METRICS.get(output);
  return keys.includes(refKey(output)) || !!definition?.dependencies.some(ref => keys.includes(refKey(ref)));
}
export interface AuthorityCandidate {
  object: AuthorityObject; metric: MetricRef; grain: Grain; period: Period;
  published?: { seriesId: string; revision: string; inputFingerprint: string };
}
export function planAuthorityImpact(change: AuthorityChange, objects: readonly AuthorityObject[], facts: readonly { mappingId: string; metric: MetricRef; period: Period }[],
  publications: readonly AuthorityCandidate[], policy: InputRefreshPolicy) {
  if (objects.length > 1000 || facts.length > 1000 || publications.length > 64) throw Error("authority_bound_exceeded");
  const windows = change.snapshots.map(s => bounds({ start: s.valid_from as string, end: s.valid_to as string }));
  const overlap = (p: Period) => { const [a, b] = bounds(p); return windows.some(([x, y]) => a < y && b > x); };
  const candidates = new Map<string, AuthorityCandidate>(), byMapping = new Map(objects.map(o => [o.mappingId, o]));
  const add = (c: AuthorityCandidate) => {
    const key = fingerprintOf([c.object.sourceId, authoritySubject(c.object), refKey(c.metric), c.grain, c.period]);
    const prior = candidates.get(key); if (!prior || c.published) candidates.set(key, structuredClone(c));
    if (candidates.size > 64) throw Error("authority_bound_exceeded");
  };
  for (const c of publications) if (policy.grains.some(g => g === c.grain) && policy.outputs.some(m => refKey(m) === refKey(c.metric)) && authorityOutputRelevant(change, c.metric) && overlap(c.period)) add(c);
  for (const fact of facts) {
    const object = byMapping.get(fact.mappingId); if (!object) throw Error("invalid_authority_impact");
    const [start, end] = bounds(fact.period), effectEnd = FIRST_METRICS.get(fact.metric)?.semantic === "state" ? Math.max(end, start + 86400000) : end;
    for (const [a, b] of windows) {
      const from = Math.max(start, a), to = Math.min(effectEnd, b); if (from >= to) continue;
      const periods = planRevisionRefresh({ affected: [{ start: new Date(from).toISOString(), end: new Date(to).toISOString() }], grains: policy.grains, limit: 64 }).windows;
      for (const output of policy.outputs) {
        const def = FIRST_METRICS.get(output);
        if (!authorityOutputRelevant(change, output) || refKey(output) !== refKey(fact.metric) && !def?.dependencies.some(m => refKey(m) === refKey(fact.metric))) continue;
        for (const p of periods) add({ object, metric: output, grain: p.grain, period: p.period });
      }
    }
  }
  return [...candidates.values()].sort((a, b) => fingerprintOf(a).localeCompare(fingerprintOf(b)));
}
