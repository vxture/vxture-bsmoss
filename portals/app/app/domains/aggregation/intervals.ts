import { createHash } from "node:crypto";
import { FIRST_METRICS } from "../catalog/first-metrics.ts";
import { refKey, type Grain, type MetricRef, type createRegistry } from "../catalog/registry.ts";
import { integer } from "../measurements/rules.ts";
import { bounds, bucketFor, instant, nativeWindows, type NativeGrain, type Period } from "./periods.ts";
import type { MappingWindow } from "./applicability.ts";

export const AGGREGATION_VERSION = "bsmoss-periodic-v2";
export type Quality = "verified" | "pending" | "rejected";
export interface IntervalInput {
  workspaceId: string;
  sourceId: string;
  subjectKey: string;
  metric: MetricRef;
  eventId: string;
  componentKey: string;
  revision: string;
  qualityRevision: string;
  quality: Quality;
  payloadSha256: string;
  mappingVersion: string;
  mappingId?: string;
  transformVersion: string;
  period: Period;
  value: { kind: "integer_delta"; value: string } | { kind: "ratio_parts"; numerator: string; denominator: string };
}
export interface AggregationPlan {
  workspaceId: string;
  sourceId: string;
  subjectKey: string;
  authorityVersion: string;
  metric: MetricRef;
  inputMode: "direct" | "dependencies";
  period: Period;
  grain: Grain;
  nativeGrain: NativeGrain;
  // Optional exact native-window manifest from trusted service/capability validity.
  applicablePeriods?: readonly Period[];
  mappingWindows?: readonly MappingWindow[];
  watermark: string;
  sourceComplete: boolean;
  completionEvidence?: CompletionEvidence;
}
export interface CompletionEvidence {
  revision: string;
  status: "confirmed" | "revoked";
  inputFingerprint: string;
  watermark: string;
  evidenceRef: string;
  evidenceSha256: string;
  mappingSet?: { version: 1; sha256: string };
}
export type AggregateValue = { kind: "integer"; value: string } | { kind: "ratio"; numerator: string; denominator: string };
const key = (value: unknown): string => {
  if (value !== null && typeof value === "object") {
    if (Array.isArray(value)) return "[" + value.map(key).join(",") + "]";
    const row = value as Record<string, unknown>;
    return "{" + Object.keys(row).sort().map(k => JSON.stringify(k) + ":" + key(row[k])).join(",") + "}";
  }
  return JSON.stringify(value) ?? "null";
};
export function fingerprintOf(value: unknown) { return createHash("sha256").update(key(value)).digest("hex"); }
export function mappingSetFingerprint(windows: readonly MappingWindow[]) {
  return fingerprintOf({ version: "mapping-set-v1", windows: [...windows].sort((a, b) => Date.parse(a.period.start) - Date.parse(b.period.start)) });
}
export function completionMatches(e: CompletionEvidence, inputFingerprint: string, windows?: readonly MappingWindow[]) {
  if (e.mappingSet === undefined && windows && new Set(windows.map(w => w.mappingId)).size > 1) return false;
  if (e.mappingSet !== undefined) {
    if (!e.mappingSet || e.mappingSet.version !== 1 || !/^[a-f0-9]{64}$/.test(e.mappingSet.sha256) || !windows) throw new Error("invalid_completion_mapping_set");
    if (e.mappingSet.sha256 !== mappingSetFingerprint(windows)) return false;
  }
  return e.inputFingerprint === inputFingerprint;
}
function identity(value: string) {
  if (typeof value !== "string" || !value.trim() || value.trim() !== value || value === "*" || value.includes("\0")) throw new Error("invalid_identity");
}
export function positiveRevision(value: string) { integer(value); if (value === "0") throw new Error("invalid_revision"); }
function bounded(value: bigint) { const text = value.toString(); integer(text); return text; }

// Pure internal kernel. Plans must be built by a trusted scope/capability layer.
export function aggregateIntervals(
  rawPlan: AggregationPlan,
  rawInputs: readonly IntervalInput[],
  registry: ReturnType<typeof createRegistry> = FIRST_METRICS,
) {
  const plan = structuredClone(rawPlan), inputs = structuredClone(rawInputs);
  for (const value of [plan.workspaceId, plan.sourceId, plan.subjectKey, plan.authorityVersion]) identity(value);
  const [start, end] = bounds(plan.period);
  const canonical = bucketFor(plan.period.start, plan.grain);
  if (Date.parse(canonical.start) !== start || Date.parse(canonical.end) !== end) throw new Error("unaligned_target_window");
  if (typeof plan.sourceComplete !== "boolean") throw new Error("invalid_completion");
  plan.period = canonical;
  plan.watermark = new Date(instant(plan.watermark)).toISOString();
  if (!Number.isSafeInteger(plan.metric.version) || plan.metric.version < 1) throw new Error("invalid_metric_version");
  const metric = registry.get(plan.metric);
  if (!metric || metric.lifecycle === "retired" || !metric.grains.includes(plan.grain) || metric.semantic === "state") throw new Error("unsupported_aggregate_metric");
  if (!["direct", "dependencies"].includes(plan.inputMode) ||
      metric.semantic === "derived" && plan.inputMode !== "dependencies" ||
      plan.inputMode === "dependencies" && metric.dependencies.length !== 2) throw new Error("invalid_input_mode");
  const allWindows = nativeWindows(plan.period, plan.nativeGrain);
  let expected = allWindows;
  if (plan.applicablePeriods !== undefined) {
    if (!Array.isArray(plan.applicablePeriods)) throw new Error("invalid_applicability");
    const allowedWindows = new Map(allWindows.map(p => [key(p), p]));
    const chosen = new Set<string>();
    for (const period of plan.applicablePeriods) {
      const [a, b] = bounds(period);
      const k = key({ start: new Date(a).toISOString(), end: new Date(b).toISOString() });
      if (!allowedWindows.has(k) || chosen.has(k)) throw new Error("invalid_applicability");
      chosen.add(k);
    }
    expected = allWindows.filter(p => chosen.has(key(p)));
    plan.applicablePeriods = expected;
  }
  const requiredWatermark = expected.at(-1)?.end ?? plan.period.end;
  const owners = new Map<string, MappingWindow>();
  if (plan.mappingWindows !== undefined) {
    if (!Array.isArray(plan.mappingWindows) || plan.mappingWindows.length !== expected.length) throw new Error("invalid_mapping_manifest");
    const allowed = new Set(expected.map(p => key(p)));
    for (const raw of plan.mappingWindows) {
      identity(raw.mappingId); positiveRevision(raw.mappingVersion);
      const [a, b] = bounds(raw.period);
      const owner = { mappingId: raw.mappingId, mappingVersion: raw.mappingVersion, period: { start: new Date(a).toISOString(), end: new Date(b).toISOString() } };
      const k = key(owner.period);
      if (!allowed.has(k) || owners.has(k)) throw new Error("invalid_mapping_manifest");
      owners.set(k, owner);
    }
    plan.mappingWindows = expected.map(p => owners.get(key(p))!);
  }
  const refs = plan.inputMode === "dependencies" ? metric.dependencies : [plan.metric];
  if (plan.inputMode === "dependencies" && refs.some(ref => registry.get(ref)?.semantic !== "interval_delta")) throw new Error("unsupported_dependency");
  const allowed = new Set(refs.map(refKey));
  const revisions = new Map<string, IntervalInput>();
  const qualityVersions = new Map<string, Quality>();
  const logical = new Map<string, IntervalInput>();
  if (inputs.length > 100000) throw new Error("input_bound_exceeded");
  for (const row of inputs) {
    if (!Number.isSafeInteger(row.metric.version) || row.metric.version < 1) throw new Error("invalid_metric_version");
    if (row.workspaceId !== plan.workspaceId || row.sourceId !== plan.sourceId || row.subjectKey !== plan.subjectKey || !allowed.has(refKey(row.metric))) throw new Error("aggregate_scope_mismatch");
    for (const v of [row.eventId, row.componentKey, row.mappingVersion, row.transformVersion]) identity(v);
    positiveRevision(row.revision); positiveRevision(row.qualityRevision);
    if (!["verified", "pending", "rejected"].includes(row.quality) || !/^[a-f0-9]{64}$/.test(row.payloadSha256)) throw new Error("invalid_evidence");
    const [rs, re] = bounds(row.period);
    row.period = { start: new Date(rs).toISOString(), end: new Date(re).toISOString() };
    if (row.value.kind === "integer_delta") {
      if (Object.keys(row.value).some(field => !["kind", "value"].includes(field))) throw new Error("invalid_value_fields");
      integer(row.value.value);
    }
    else if (row.value.kind === "ratio_parts") {
      if (Object.keys(row.value).some(field => !["kind", "numerator", "denominator"].includes(field))) throw new Error("invalid_value_fields");
      integer(row.value.numerator); integer(row.value.denominator);
      if (BigInt(row.value.numerator) > BigInt(row.value.denominator)) throw new Error("invalid_ratio");
    } else throw new Error("invalid_value_kind");
    const def = registry.get(row.metric)!;
    if (def.semantic === "ratio" ? row.value.kind !== "ratio_parts" : row.value.kind !== "integer_delta") throw new Error("metric_value_mismatch");
    const natural = key([row.eventId, row.componentKey, refKey(row.metric)]);
    const revisionKey = key([natural, row.revision]);
    const qualityKey = key([revisionKey, row.qualityRevision]);
    if (qualityVersions.has(qualityKey) && qualityVersions.get(qualityKey) !== row.quality) throw new Error("conflicting_replay");
    qualityVersions.set(qualityKey, row.quality);
    const same = revisions.get(revisionKey);
    if (same) {
      const raw = (r: IntervalInput) => ({ ...r, quality: undefined, qualityRevision: undefined });
      if (key(raw(same)) !== key(raw(row)) || same.qualityRevision === row.qualityRevision && same.quality !== row.quality) throw new Error("conflicting_replay");
    }
    if (!same || BigInt(row.qualityRevision) > BigInt(same.qualityRevision)) revisions.set(revisionKey, row);
  }
  for (const row of revisions.values()) {
    const natural = key([row.eventId, row.componentKey, refKey(row.metric)]);
    const old = logical.get(natural);
    if (!old || BigInt(row.revision) > BigInt(old.revision)) logical.set(natural, row);
  }
  const slots = new Map<string, Map<string, IntervalInput>>();
  const expectedKeys = new Set(expected.map(p => key(p)));
  for (const row of logical.values()) {
    const slotKey = key(row.period);
    if (!expectedKeys.has(slotKey)) throw new Error("unexpected_or_coarse_window");
    const owner = owners.get(slotKey);
    if (owner && (row.mappingId !== owner.mappingId || row.mappingVersion !== owner.mappingVersion)) throw new Error("measurement_mapping_mismatch");
    const slot = slots.get(slotKey) ?? new Map<string, IntervalInput>();
    if (slot.has(refKey(row.metric))) throw new Error("overlapping_authority_evidence");
    slot.set(refKey(row.metric), row); slots.set(slotKey, slot);
  }
  let total = 0n, numerator = 0n, denominator = 0n, validWindows = 0, validMilliseconds = 0;
  const reasons = new Set<string>();
  for (const period of expected) {
    const slot = slots.get(key(period));
    const parts = refs.map(ref => slot?.get(refKey(ref)));
    if (parts.some(row => !row || row.quality !== "verified")) {
      reasons.add("missing_windows");
      if (plan.inputMode === "dependencies") reasons.add("missing_dependency");
      for (const row of parts) if (row && row.quality !== "verified") reasons.add(row.quality + "_quality");
      continue;
    }
    validWindows++;
    validMilliseconds += Date.parse(period.end) - Date.parse(period.start);
    if (metric.semantic === "ratio") {
      if (plan.inputMode === "dependencies") {
        const [n, d] = parts.map(row => BigInt((row!.value as { value: string }).value));
        if (n > d) throw new Error("invalid_ratio");
        numerator += n; denominator += d;
      } else {
        const ratio = parts[0]!.value as { numerator: string; denominator: string };
        numerator += BigInt(ratio.numerator); denominator += BigInt(ratio.denominator);
      }
    } else total += parts.reduce((n, row) => n + BigInt((row!.value as { value: string }).value), 0n);
  }
  let knownValue: AggregateValue | null = null;
  if (validWindows) {
    if (metric.semantic === "ratio") {
      const n = bounded(numerator), d = bounded(denominator);
      if (denominator === 0n) reasons.add("zero_denominator");
      else knownValue = { kind: "ratio", numerator: n, denominator: d };
    } else knownValue = { kind: "integer", value: bounded(total) };
  }
  const selected = [...logical.values()].sort((a, b) => key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0);
  if (plan.completionEvidence !== undefined) {
    const e = plan.completionEvidence;
    positiveRevision(e.revision); identity(e.evidenceRef);
    if (!["confirmed", "revoked"].includes(e.status) || !/^[a-f0-9]{64}$/.test(e.inputFingerprint) || !/^[a-f0-9]{64}$/.test(e.evidenceSha256)) throw new Error("invalid_completion_evidence");
    e.watermark = new Date(instant(e.watermark)).toISOString();
    if (Date.parse(e.watermark) < start || e.status === "confirmed" && Date.parse(e.watermark) < end) throw new Error("invalid_completion_watermark");
    const basePlan = { ...plan, watermark: plan.period.start, sourceComplete: false };
    delete basePlan.completionEvidence;
    const matches = completionMatches(e, fingerprintOf({ version: AGGREGATION_VERSION, plan: basePlan, selected }), plan.mappingWindows);
    const confirmed = e.status === "confirmed" && matches;
    if (plan.sourceComplete !== confirmed || plan.watermark !== (confirmed ? e.watermark : plan.period.start)) throw new Error("completion_binding_mismatch");
    if (!matches) reasons.add("source_confirmation_stale");
    if (e.status === "revoked") reasons.add("source_confirmation_revoked");
  }
  if (!expected.length) reasons.add("no_applicable_windows");
  if (expected.length && !plan.sourceComplete) reasons.add("source_unconfirmed");
  if (expected.length && Date.parse(plan.watermark) < Date.parse(requiredWatermark)) reasons.add("watermark_behind");
  const completeness = !expected.length ? "not_applicable" : !validWindows ? "missing" : validWindows < expected.length ? "partial" :
    !plan.sourceComplete || Date.parse(plan.watermark) < Date.parse(requiredWatermark) ? "preliminary" : "complete";
  const fingerprint = fingerprintOf({ version: AGGREGATION_VERSION, plan, selected });
  return {
    aggregationVersion: AGGREGATION_VERSION, inputFingerprint: fingerprint,
    workspaceId: plan.workspaceId, sourceId: plan.sourceId, subjectKey: plan.subjectKey, authorityVersion: plan.authorityVersion,
    unit: metric.unit, category: metric.category,
    metric: { ...plan.metric }, period: { ...plan.period }, grain: plan.grain, nativeGrain: plan.nativeGrain,
    value: plan.inputMode === "dependencies" && validWindows < expected.length ? null : knownValue,
    knownValue, completeness, expectedWindows: expected.length, validWindows,
    periodMilliseconds: end - start,
    expectedMilliseconds: expected.reduce((n, p) => n + Date.parse(p.end) - Date.parse(p.start), 0),
    validMilliseconds, watermark: plan.watermark, requiredWatermark,
    reasons: [...reasons].sort(),
    ...(plan.mappingWindows === undefined ? {} : { mappingWindows: structuredClone(plan.mappingWindows) }),
    ...(plan.completionEvidence === undefined ? {} : { completionEvidence: structuredClone(plan.completionEvidence) }),
    evidence: selected.map(row => ({ sourceId: row.sourceId, eventId: row.eventId, componentKey: row.componentKey,
      revision: row.revision, qualityRevision: row.qualityRevision, payloadSha256: row.payloadSha256,
      mappingVersion: row.mappingVersion, ...(row.mappingId === undefined ? {} : { mappingId: row.mappingId }), transformVersion: row.transformVersion, metric: { ...row.metric } })),
  };
}
