import { FIRST_METRICS } from "../catalog/first-metrics.ts";
import { refKey, type Grain, type MetricRef } from "../catalog/registry.ts";
import { bounds, bucketFor, instant, type Period } from "./periods.ts";
import { fingerprintOf, mappingSetFingerprint, positiveRevision, type CompletionEvidence, type Quality } from "./intervals.ts";
import { aggregateStateTimeline, type DeviceState } from "./states.ts";
import type { EffectiveMapping } from "./applicability.ts";
import { jobIdentity } from "./refresh-jobs.ts";

export const STATE_PERIOD_VERSION = "bsmoss-state-period-v1";
export interface StatePlan {
  semantic: "state";
  workspaceId: string; sourceId: string; subjectKey: string; authorityVersion: string;
  metric: MetricRef; grain: Grain; nativeGrain: "event"; period: Period;
  maxHoldMilliseconds: number; mappingPeriods: readonly EffectiveMapping[];
  watermark: string; sourceComplete: boolean; completionEvidence?: CompletionEvidence;
}
export interface StateInput {
  workspaceId: string; sourceId: string; subjectKey: string; metric: MetricRef;
  eventId: string; componentKey: string; revision: string; qualityRevision: string; quality: Quality;
  payloadSha256: string; mappingId: string; mappingVersion: string; transformVersion: string;
  at: string; validUntil: string; state: DeviceState;
}
export function stateHoldMilliseconds(value: number) {
  if (!Number.isSafeInteger(value) || value < 1000 || value > 86400000) throw Error("invalid_state_hold_policy");
  return value;
}
export function stateMappingManifest(period: Period, raw: readonly EffectiveMapping[]) {
  const [start, end] = bounds(period);
  if (!Array.isArray(raw) || raw.length > 10000) throw Error("mapping_bound_exceeded");
  const ids = new Set<string>();
  const mappings = raw.map(row => {
    jobIdentity(row.mappingId); positiveRevision(row.mappingVersion);
    if (ids.has(row.mappingId)) throw Error("invalid_effective_mapping"); ids.add(row.mappingId);
    const [a, b] = bounds(row.period);
    return { mappingId: row.mappingId, mappingVersion: row.mappingVersion, period: { start: new Date(a).toISOString(), end: new Date(b).toISOString() } };
  }).sort((a, b) => a.period.start.localeCompare(b.period.start) || a.mappingId.localeCompare(b.mappingId));
  for (let i = 1; i < mappings.length; i++) if (mappings[i - 1]!.period.end > mappings[i]!.period.start) throw Error("aggregate_subject_mapping_ambiguous");
  const windows = mappings.filter(m => Date.parse(m.period.start) < end && Date.parse(m.period.end) > start).map(m => ({ ...m,
    period: { start: new Date(Math.max(start, Date.parse(m.period.start))).toISOString(), end: new Date(Math.min(end, Date.parse(m.period.end))).toISOString() } }));
  let cursor = start;
  for (const window of windows) { if (Date.parse(window.period.start) !== cursor) throw Error("aggregate_mapping_gap"); cursor = Date.parse(window.period.end); }
  if (cursor !== end) throw Error("aggregate_mapping_gap");
  return { mappings, windows };
}

// One trusted device/source, event validity supplied by a reviewed capability.
export function aggregateStatePeriod(rawPlan: StatePlan, rawInputs: readonly StateInput[]) {
  const plan = structuredClone(rawPlan), inputs = structuredClone(rawInputs);
  [plan.workspaceId, plan.sourceId, plan.subjectKey, plan.authorityVersion].forEach(jobIdentity);
  const metric = FIRST_METRICS.get(plan.metric);
  if (!Number.isSafeInteger(plan.metric.version) || plan.metric.version < 1 || !metric || metric.lifecycle === "retired" || metric.semantic !== "state" || !metric.grains.includes(plan.grain) || plan.semantic !== "state" || plan.nativeGrain !== "event") throw Error("unsupported_state_metric");
  const [start, end] = bounds(plan.period), canonical = bucketFor(plan.period.start, plan.grain);
  if (Date.parse(canonical.start) !== start || Date.parse(canonical.end) !== end) throw Error("unaligned_target_window");
  plan.period = canonical; stateHoldMilliseconds(plan.maxHoldMilliseconds);
  if (typeof plan.sourceComplete !== "boolean") throw Error("invalid_completion");
  plan.watermark = new Date(instant(plan.watermark)).toISOString();
  const { mappings, windows } = stateMappingManifest(plan.period, plan.mappingPeriods);
  plan.mappingPeriods = mappings;
  const owners = new Map(mappings.map(m => [m.mappingId, m]));
  if (!Array.isArray(inputs) || inputs.length > 100000) throw Error("input_bound_exceeded");
  const revisions = new Map<string, StateInput>(), qualityVersions = new Map<string, Quality>();
  for (const row of inputs) {
    if (!Number.isSafeInteger(row.metric.version) || row.workspaceId !== plan.workspaceId || row.sourceId !== plan.sourceId || row.subjectKey !== plan.subjectKey || refKey(row.metric) !== refKey(plan.metric)) throw Error("aggregate_scope_mismatch");
    [row.eventId, row.componentKey, row.transformVersion, row.mappingId].forEach(jobIdentity);
    positiveRevision(row.revision); positiveRevision(row.qualityRevision); positiveRevision(row.mappingVersion);
    if (!/^[a-f0-9]{64}$/.test(row.payloadSha256) || !["verified", "pending", "rejected"].includes(row.quality)) throw Error("invalid_evidence");
    row.at = new Date(instant(row.at)).toISOString(); row.validUntil = new Date(instant(row.validUntil)).toISOString();
    if (Date.parse(row.at) < start - plan.maxHoldMilliseconds || Date.parse(row.at) >= end || row.validUntil <= row.at || Date.parse(row.validUntil) - Date.parse(row.at) > plan.maxHoldMilliseconds) throw Error("invalid_state_validity");
    const owner = owners.get(row.mappingId);
    if (!owner || owner.mappingVersion !== row.mappingVersion || row.at < owner.period.start || row.validUntil > owner.period.end) throw Error("measurement_mapping_mismatch");
    const k = JSON.stringify([row.eventId, row.componentKey, row.revision]), q = JSON.stringify([k, row.qualityRevision]);
    if (qualityVersions.has(q) && qualityVersions.get(q) !== row.quality) throw Error("conflicting_replay"); qualityVersions.set(q, row.quality);
    const old = revisions.get(k);
    const raw = (r: StateInput) => ({ ...r, quality: undefined, qualityRevision: undefined });
    if (old && fingerprintOf(raw(old)) !== fingerprintOf(raw(row))) throw Error("conflicting_replay");
    if (!old || BigInt(row.qualityRevision) > BigInt(old.qualityRevision)) revisions.set(k, row);
  }
  const logical = new Map<string, StateInput>();
  for (const row of revisions.values()) {
    const k = JSON.stringify([row.eventId, row.componentKey]), old = logical.get(k);
    if (!old || BigInt(row.revision) > BigInt(old.revision)) logical.set(k, row);
  }
  const selected = [...logical.values()].sort((a, b) => fingerprintOf(a).localeCompare(fingerprintOf(b)));
  const timeline = aggregateStateTimeline(plan.period, selected.map(row => ({ eventId: JSON.stringify([row.eventId, row.componentKey]),
    revision: row.revision, qualityRevision: row.qualityRevision, quality: row.quality, at: row.at, validUntil: row.validUntil, state: row.state })));
  const basePlan = { ...plan, sourceComplete: false, watermark: plan.period.start }; delete basePlan.completionEvidence;
  const baseFingerprint = fingerprintOf({ version: STATE_PERIOD_VERSION, plan: basePlan, selected });
  const reasons = new Set<string>();
  const e = plan.completionEvidence;
  if (e) {
    positiveRevision(e.revision); jobIdentity(e.evidenceRef);
    if (!["confirmed", "revoked"].includes(e.status) || !/^[a-f0-9]{64}$/.test(e.inputFingerprint) || !/^[a-f0-9]{64}$/.test(e.evidenceSha256) ||
        !e.mappingSet || e.mappingSet.version !== 1 || !/^[a-f0-9]{64}$/.test(e.mappingSet.sha256)) throw Error("invalid_completion_evidence");
    e.watermark = new Date(instant(e.watermark)).toISOString();
    if (Date.parse(e.watermark) < start || e.status === "confirmed" && Date.parse(e.watermark) < end) throw Error("invalid_completion_watermark");
    const matches = e.inputFingerprint === baseFingerprint && e.mappingSet.sha256 === mappingSetFingerprint(windows);
    const confirmed = e.status === "confirmed" && matches;
    if (plan.sourceComplete !== confirmed || plan.watermark !== (confirmed ? e.watermark : plan.period.start)) throw Error("completion_binding_mismatch");
    if (!matches) reasons.add("source_confirmation_stale");
    if (e.status === "revoked") reasons.add("source_confirmation_revoked");
  } else if (plan.sourceComplete || plan.watermark !== plan.period.start) throw Error("completion_binding_mismatch");
  if (!plan.sourceComplete) reasons.add("source_unconfirmed");
  const unknown = BigInt(timeline.durationMilliseconds.unknown), expected = BigInt(end - start), known = expected - unknown;
  if (unknown > 0n) reasons.add("unknown_state_time");
  if (timeline.conflictCount) reasons.add("conflicting_state_events");
  for (const row of selected) if (row.quality !== "verified") reasons.add(row.quality + "_quality");
  const completeness = !known ? "missing" : unknown > 0n ? "partial" : plan.sourceComplete ? "complete" : "preliminary";
  const value = { kind: "state" as const, durationMilliseconds: timeline.durationMilliseconds,
    knownTransitions: timeline.knownTransitions, gapTransitions: timeline.gapTransitions, endState: timeline.endState };
  return { aggregationVersion: STATE_PERIOD_VERSION, inputFingerprint: fingerprintOf({ version: STATE_PERIOD_VERSION, plan, selected }),
    workspaceId: plan.workspaceId, sourceId: plan.sourceId, subjectKey: plan.subjectKey, authorityVersion: plan.authorityVersion,
    metric: { ...plan.metric }, grain: plan.grain, nativeGrain: plan.nativeGrain, period: plan.period,
    unit: metric.unit, category: metric.category, value, completeness,
    expectedMilliseconds: expected.toString(), knownMilliseconds: known.toString(), watermark: plan.watermark,
    maxHoldMilliseconds: plan.maxHoldMilliseconds, mappingWindows: windows, reasons: [...reasons].sort(),
    segments: timeline.segments, conflictCount: timeline.conflictCount,
    evidence: selected.map(row => ({ eventId: row.eventId, componentKey: row.componentKey, revision: row.revision, qualityRevision: row.qualityRevision,
      mappingId: row.mappingId, mappingVersion: row.mappingVersion, transformVersion: row.transformVersion, payloadSha256: row.payloadSha256 })),
    ...(e ? { completionEvidence: structuredClone(e) } : {}) };
}
export function bindStateCompletion(raw: StatePlan, inputs: readonly StateInput[], evidence?: CompletionEvidence): StatePlan {
  const plan = structuredClone(raw); delete plan.completionEvidence;
  aggregateStatePeriod({ ...plan, sourceComplete: false, watermark: new Date(instant(plan.period.start)).toISOString() }, inputs);
  plan.sourceComplete = false; plan.period = bucketFor(raw.period.start, raw.grain); plan.watermark = plan.period.start;
  if (Date.parse(raw.period.end) !== Date.parse(plan.period.end)) throw Error("unaligned_target_window");
  const base = aggregateStatePeriod(plan, inputs);
  if (evidence !== undefined) {
    const e = structuredClone(evidence); e.watermark = new Date(instant(e.watermark)).toISOString(); plan.completionEvidence = e;
    if (e.status === "confirmed" && e.inputFingerprint === base.inputFingerprint && e.mappingSet?.sha256 === mappingSetFingerprint(base.mappingWindows)) {
      plan.sourceComplete = true; plan.watermark = e.watermark;
    }
  }
  aggregateStatePeriod(plan, inputs); return plan;
}
