import { normalizeAuthorityRevisions, type AuthorityRevision } from "./authority-revisions.ts";
import { FIRST_METRICS } from "../catalog/first-metrics.ts";
import { refKey, type Grain, type MetricRef } from "../catalog/registry.ts";
import { integer } from "../measurements/rules.ts";
import { bounds, bucketFor, instant, type NativeGrain, type Period } from "./periods.ts";
import { fingerprintOf, mappingSetFingerprint, positiveRevision, type CompletionEvidence, type Quality } from "./intervals.ts";
import { aggregateGauge } from "./gauges.ts";
import { planMappingWindows, type EffectiveMapping } from "./applicability.ts";
import { jobIdentity } from "./refresh-jobs.ts";

export const GAUGE_PERIOD_VERSION = "bsmoss-gauge-period-v1";
export interface GaugePolicy { version: 1; authorityRef: string; mode: "sample_mean" | "time_weighted"; scale: number; durationRef?: string }
export interface GaugePlan {
  authorityRevisions?: readonly AuthorityRevision[];
  semantic: "gauge"; workspaceId: string; sourceId: string; subjectKey: string; authorityVersion: string;
  metric: MetricRef; grain: Grain; nativeGrain: NativeGrain; period: Period; policy: GaugePolicy;
  mappingPeriods: readonly EffectiveMapping[]; sourceComplete: boolean; watermark: string; completionEvidence?: CompletionEvidence;
}
export interface GaugeInput {
  workspaceId: string; sourceId: string; subjectKey: string; metric: MetricRef;
  eventId: string; componentKey: string; revision: string; qualityRevision: string; quality: Quality;
  payloadSha256: string; mappingId: string; mappingVersion: string; transformVersion: string;
  period: Period; unscaled: string; scale: number;
}
export function gaugePolicy(raw: unknown): GaugePolicy {
  const p = structuredClone(raw) as GaugePolicy;
  if (!p || typeof p !== "object" || Array.isArray(p) || Object.keys(p).some(k => !["version", "authorityRef", "mode", "scale", "durationRef"].includes(k)) ||
      p.version !== 1 || !["sample_mean", "time_weighted"].includes(p.mode) || !Number.isSafeInteger(p.scale) || p.scale < 0 || p.scale > 9) throw Error("gauge_policy_required");
  jobIdentity(p.authorityRef);
  if (p.mode === "time_weighted") {
    if (typeof p.durationRef !== "string" || !p.durationRef.trim()) throw Error("gauge_duration_required");
    jobIdentity(p.durationRef);
  }
  else if (p.durationRef !== undefined) throw Error("invalid_gauge_duration_policy");
  return p;
}
// One source and physical sensor. Fixed periodic samples are never added across
// sensors, attributed to operators, or held beyond a reviewed source window.
export function aggregateGaugePeriod(rawPlan: GaugePlan, rawInputs: readonly GaugeInput[]) {
  const plan = structuredClone(rawPlan), inputs = structuredClone(rawInputs);
  if (plan.authorityRevisions !== undefined) plan.authorityRevisions = normalizeAuthorityRevisions(plan.authorityRevisions);
  [plan.workspaceId, plan.sourceId, plan.subjectKey, plan.authorityVersion].forEach(jobIdentity);
  const metric = FIRST_METRICS.get(plan.metric);
  if (!Number.isSafeInteger(plan.metric.version) || plan.metric.version < 1 || !metric || metric.lifecycle === "retired" || metric.semantic !== "gauge" ||
      !metric.grains.includes(plan.grain) || plan.semantic !== "gauge") throw Error("unsupported_gauge_metric");
  const [start, end] = bounds(plan.period), period = bucketFor(plan.period.start, plan.grain);
  if (Date.parse(period.start) !== start || Date.parse(period.end) !== end) throw Error("unaligned_target_window");
  plan.period = period; plan.policy = gaugePolicy(plan.policy);
  if (!["5m", "15m", "hour", "day"].includes(plan.nativeGrain)) throw Error("unsupported_native_grain");
  const mappingPeriods = plan.mappingPeriods.map(m => {
    const [a, b] = bounds(m.period);
    return { ...m, period: { start: new Date(a).toISOString(), end: new Date(b).toISOString() } };
  }).sort((a, b) => a.mappingId.localeCompare(b.mappingId));
  const { mappingWindows } = planMappingWindows(period, plan.nativeGrain, mappingPeriods); plan.mappingPeriods = mappingPeriods;
  const owners = new Map(mappingWindows.map(w => [fingerprintOf(w.period), w]));
  if (!Array.isArray(inputs) || inputs.length > 100000) throw Error("input_bound_exceeded");
  const revisions = new Map<string, GaugeInput>(), qualityVersions = new Map<string, Quality>();
  for (const row of inputs) {
    if (row.workspaceId !== plan.workspaceId || row.sourceId !== plan.sourceId || row.subjectKey !== plan.subjectKey ||
        !Number.isSafeInteger(row.metric.version) || refKey(row.metric) !== refKey(plan.metric)) throw Error("aggregate_scope_mismatch");
    [row.eventId, row.componentKey, row.transformVersion, row.mappingId].forEach(jobIdentity);
    positiveRevision(row.revision); positiveRevision(row.qualityRevision); positiveRevision(row.mappingVersion); integer(row.unscaled, true);
    if (row.scale !== plan.policy.scale || !Number.isSafeInteger(row.scale)) throw Error("gauge_scale_mismatch");
    if (!/^[a-f0-9]{64}$/.test(row.payloadSha256) || !["verified", "pending", "rejected"].includes(row.quality)) throw Error("invalid_evidence");
    const [a, b] = bounds(row.period); row.period = { start: new Date(a).toISOString(), end: new Date(b).toISOString() };
    const key = JSON.stringify([row.eventId, row.componentKey, row.revision]), q = JSON.stringify([key, row.qualityRevision]);
    if (qualityVersions.has(q) && qualityVersions.get(q) !== row.quality) throw Error("conflicting_replay"); qualityVersions.set(q, row.quality);
    const prior = revisions.get(key), raw = (r: GaugeInput) => ({ ...r, quality: undefined, qualityRevision: undefined });
    if (prior && fingerprintOf(raw(prior)) !== fingerprintOf(raw(row))) throw Error("conflicting_replay");
    if (!prior || BigInt(row.qualityRevision) > BigInt(prior.qualityRevision)) revisions.set(key, row);
  }
  const logical = new Map<string, GaugeInput>();
  for (const row of revisions.values()) {
    const key = JSON.stringify([row.eventId, row.componentKey]), prior = logical.get(key);
    if (!prior || BigInt(row.revision) > BigInt(prior.revision)) logical.set(key, row);
  }
  const selected = [...logical.values()].sort((a, b) => fingerprintOf(a).localeCompare(fingerprintOf(b))), slots = new Set<string>();
  for (const row of selected) {
    const key = fingerprintOf(row.period), owner = owners.get(key);
    if (!owner) throw Error("unexpected_or_coarse_window");
    if (owner.mappingId !== row.mappingId || owner.mappingVersion !== row.mappingVersion) throw Error("measurement_mapping_mismatch");
    if (slots.has(key)) throw Error("overlapping_authority_evidence"); slots.add(key);
  }
  const valid = selected.filter(r => r.quality === "verified");
  const summary = aggregateGauge(period, plan.policy.scale, plan.policy.mode, valid.map(row => ({ at: row.period.start, unscaled: row.unscaled,
    ...(plan.policy.mode === "time_weighted" ? { validUntil: row.period.end } : {}) })));
  const basePlan = { ...plan, sourceComplete: false, watermark: period.start }; delete basePlan.completionEvidence;
  const baseFingerprint = fingerprintOf({ version: GAUGE_PERIOD_VERSION, plan: basePlan, selected }), reasons = new Set<string>();
  if (typeof plan.sourceComplete !== "boolean") throw Error("invalid_completion");
  plan.watermark = new Date(instant(plan.watermark)).toISOString();
  const e = plan.completionEvidence;
  if (e) {
    positiveRevision(e.revision); jobIdentity(e.evidenceRef);
    if (!["confirmed", "revoked"].includes(e.status) || !/^[a-f0-9]{64}$/.test(e.inputFingerprint) || !/^[a-f0-9]{64}$/.test(e.evidenceSha256) ||
        !e.mappingSet || e.mappingSet.version !== 1 || !/^[a-f0-9]{64}$/.test(e.mappingSet.sha256)) throw Error("invalid_completion_evidence");
    e.watermark = new Date(instant(e.watermark)).toISOString();
    if (Date.parse(e.watermark) < start || e.status === "confirmed" && Date.parse(e.watermark) < end) throw Error("invalid_completion_watermark");
    const matches = e.inputFingerprint === baseFingerprint && e.mappingSet.sha256 === mappingSetFingerprint(mappingWindows), confirmed = e.status === "confirmed" && matches;
    if (plan.sourceComplete !== confirmed || plan.watermark !== (confirmed ? e.watermark : period.start)) throw Error("completion_binding_mismatch");
    if (!matches) reasons.add("source_confirmation_stale");
    if (e.status === "revoked") reasons.add("source_confirmation_revoked");
  } else if (plan.sourceComplete || plan.watermark !== period.start) throw Error("completion_binding_mismatch");
  if (valid.length < mappingWindows.length) reasons.add("missing_windows");
  if (!plan.sourceComplete) reasons.add("source_unconfirmed");
  for (const row of selected) if (row.quality !== "verified") reasons.add(row.quality + "_quality");
  const value = summary.mean ? { kind: "gauge" as const, mode: plan.policy.mode, scale: plan.policy.scale, mean: summary.mean,
    minimum: summary.minimum!, maximum: summary.maximum! } : null;
  const completeness = !valid.length ? "missing" : valid.length < mappingWindows.length ? "partial" : plan.sourceComplete ? "complete" : "preliminary";
  return { aggregationVersion: GAUGE_PERIOD_VERSION, inputFingerprint: fingerprintOf({ version: GAUGE_PERIOD_VERSION, plan, selected }),
    workspaceId: plan.workspaceId, sourceId: plan.sourceId, subjectKey: plan.subjectKey, authorityVersion: plan.authorityVersion,
    ...(plan.authorityRevisions === undefined ? {} : { authorityRevisions: structuredClone(plan.authorityRevisions) }),
    metric: { ...plan.metric }, grain: plan.grain, nativeGrain: plan.nativeGrain, period, unit: metric.unit, category: metric.category,
    value, completeness, expectedWindows: mappingWindows.length, validWindows: valid.length, coveredMilliseconds: summary.coveredMilliseconds,
    expectedMilliseconds: String(end - start), watermark: plan.watermark, policy: plan.policy, mappingWindows, reasons: [...reasons].sort(),
    evidence: selected.map(row => ({ eventId: row.eventId, componentKey: row.componentKey, revision: row.revision, qualityRevision: row.qualityRevision,
      payloadSha256: row.payloadSha256, mappingId: row.mappingId, mappingVersion: row.mappingVersion, transformVersion: row.transformVersion })),
    ...(e ? { completionEvidence: structuredClone(e) } : {}) };
}
export function bindGaugeCompletion(raw: GaugePlan, inputs: readonly GaugeInput[], evidence?: CompletionEvidence): GaugePlan {
  const plan = structuredClone(raw); delete plan.completionEvidence; plan.sourceComplete = false;
  plan.watermark = new Date(instant(plan.period.start)).toISOString();
  const base = aggregateGaugePeriod(plan, inputs);
  if (evidence !== undefined) {
    const e = structuredClone(evidence); e.watermark = new Date(instant(e.watermark)).toISOString(); plan.completionEvidence = e;
    if (e.status === "confirmed" && e.inputFingerprint === base.inputFingerprint && e.mappingSet?.sha256 === mappingSetFingerprint(base.mappingWindows)) {
      plan.sourceComplete = true; plan.watermark = e.watermark;
    }
  }
  aggregateGaugePeriod(plan, inputs); return plan;
}
