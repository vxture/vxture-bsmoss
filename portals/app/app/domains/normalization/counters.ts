import { FIRST_METRICS } from "../catalog/first-metrics.ts";
import { type MetricRef, type createRegistry } from "../catalog/registry.ts";
import { integer, timestamp } from "../measurements/rules.ts";
import { bucketFor, type NativeGrain, type Period } from "../aggregation/periods.ts";
import { fingerprintOf } from "../aggregation/intervals.ts";

export const COUNTER_RULE_VERSION = "bsmoss-counter-v1";
export type ReadingQuality = "verified" | "pending" | "rejected";
export interface CounterReading {
  workspaceId: string; sourceId: string; subjectKey: string; metric: MetricRef;
  eventId: string; revision: string; qualityRevision: string; quality: ReadingQuality;
  at: string; rawValue: string; rawUnit: string; counterEpoch: string;
  payloadSha256: string; mappingVersion: string;
}
export interface CounterPolicy {
  workspaceId: string; sourceId: string; subjectKey: string; metric: MetricRef;
  version: string; capabilityEvidenceRef: string; mappingVersion: string; transformVersion: string;
  validFrom: string; validTo: string; nativeGrain: NativeGrain;
  rawUnit: string; canonicalUnit: "second" | "count" | "byte" | "Wh";
  conversion: { numerator: string; denominator: string };
  // Modulus is the exclusive upper bound, e.g. 2^32, not the largest reading.
  modulus: string | null;
  // A capability-declared physical bound, in raw counter units per second.
  maxRawPerSecond: string | null;
}
export interface ReadingRef { eventId: string; revision: string; qualityRevision: string }
interface EvidenceBase { evidenceRef: string; from: ReadingRef; to: ReadingRef }
export type CounterTransitionEvidence = EvidenceBase & (
  | { kind: "wraps"; count: string }
  | { kind: "resets"; resets: readonly { at: string; terminalRaw: string; initialRaw: string }[] }
);
export interface CounterDecision {
  status: "baseline" | "eligible" | "pending";
  reasons: string[]; period: Period | null;
  rawDelta: string | null; value: { kind: "integer_delta"; value: string } | null;
  from: ReadingRef | null; to: ReadingRef; evidenceRef: string | null;
  inputFingerprint: string;
}

function identity(value: string) {
  if (typeof value !== "string" || !value.trim() || value.trim() !== value || value === "*" || value.includes("\0")) throw new Error("invalid_counter_identity");
}
function positive(value: string) { integer(value); if (value === "0") throw new Error("invalid_counter_positive"); }
const reference = (r: CounterReading): ReadingRef => ({ eventId: r.eventId, revision: r.revision, qualityRevision: r.qualityRevision });
const refEqual = (a: ReadingRef, b: ReadingRef) => a.eventId === b.eventId && a.revision === b.revision && a.qualityRevision === b.qualityRevision;
const pairKey = (from: string, to: string) => JSON.stringify([from, to]);
const MAX = 10n ** 30n - 1n;

// Internal pure rules only: eligibility is not a persisted quality approval.
// Callers must resolve capabilities, ownership and evidence authority server-side.
export function normalizeCounterSeries(
  rawPolicy: CounterPolicy,
  rawReadings: readonly CounterReading[],
  rawEvidence: readonly CounterTransitionEvidence[] = [],
  registry: ReturnType<typeof createRegistry> = FIRST_METRICS,
): { ruleVersion: string; policyVersion: string; capabilityEvidenceRef: string;
  workspaceId: string; sourceId: string; subjectKey: string; metric: MetricRef;
  canonicalUnit: CounterPolicy["canonicalUnit"]; mappingVersion: string; transformVersion: string;
  decisions: CounterDecision[]; inputFingerprint: string } {
  const policy = structuredClone(rawPolicy), readings = structuredClone(rawReadings), evidence = structuredClone(rawEvidence);
  for (const v of [policy.workspaceId, policy.sourceId, policy.subjectKey, policy.version, policy.capabilityEvidenceRef,
    policy.mappingVersion, policy.transformVersion, policy.rawUnit]) identity(v);
  policy.validFrom = timestamp(policy.validFrom); policy.validTo = timestamp(policy.validTo);
  if (policy.validTo <= policy.validFrom) throw new Error("invalid_counter_validity");
  const metric = registry.get(policy.metric);
  if (!Number.isSafeInteger(policy.metric.version) || !metric || metric.lifecycle === "retired" ||
      metric.semantic !== "interval_delta" || metric.unit !== policy.canonicalUnit) throw new Error("invalid_counter_metric");
  bucketFor(policy.validFrom, policy.nativeGrain);
  positive(policy.conversion.numerator); positive(policy.conversion.denominator);
  const modulus = policy.modulus === null ? null : (positive(policy.modulus), BigInt(policy.modulus));
  if (modulus !== null && modulus < 2n) throw new Error("invalid_counter_modulus");
  const rate = policy.maxRawPerSecond === null ? null : (integer(policy.maxRawPerSecond), BigInt(policy.maxRawPerSecond));
  if (readings.length > 100000 || evidence.length > 100000) throw new Error("counter_input_bound");
  const revisions = new Map<string, CounterReading>();
  const immutable = new Map<string, string>(), qualities = new Map<string, ReadingQuality>();
  for (const row of readings) {
    if (row.workspaceId !== policy.workspaceId || row.sourceId !== policy.sourceId || row.subjectKey !== policy.subjectKey ||
        row.metric.code !== policy.metric.code || row.metric.version !== policy.metric.version) throw new Error("counter_scope_mismatch");
    for (const v of [row.eventId, row.counterEpoch, row.mappingVersion]) identity(v);
    positive(row.revision); positive(row.qualityRevision); integer(row.rawValue);
    if (row.rawUnit !== policy.rawUnit) throw new Error("counter_unit_mismatch");
    if (modulus !== null && BigInt(row.rawValue) >= modulus) throw new Error("counter_out_of_range");
    if (!/^[a-f0-9]{64}$/.test(row.payloadSha256) || !["verified", "pending", "rejected"].includes(row.quality)) throw new Error("invalid_counter_evidence");
    row.at = timestamp(row.at);
    const rawKey = pairKey(row.eventId, row.revision);
    const payload = fingerprintOf({ ...row, quality: null, qualityRevision: null });
    if (immutable.has(rawKey) && immutable.get(rawKey) !== payload) throw new Error("conflicting_counter_replay");
    immutable.set(rawKey, payload);
    const qualityKey = pairKey(rawKey, row.qualityRevision);
    if (qualities.has(qualityKey) && qualities.get(qualityKey) !== row.quality) throw new Error("conflicting_counter_replay");
    qualities.set(qualityKey, row.quality);
    const old = revisions.get(row.eventId);
    if (!old || BigInt(row.revision) > BigInt(old.revision) || row.revision === old.revision && BigInt(row.qualityRevision) > BigInt(old.qualityRevision)) revisions.set(row.eventId, row);
  }
  const selected = [...revisions.values()].sort((a, b) => a.at < b.at ? -1 : a.at > b.at ? 1 : a.eventId < b.eventId ? -1 : a.eventId > b.eventId ? 1 : 0);
  // Conflicting timestamps must be resolved using source sequence/authority first.
  for (let i = 1; i < selected.length; i++) if (selected[i - 1].at === selected[i].at) throw new Error("counter_timestamp_conflict");
  const proofs = new Map<string, CounterTransitionEvidence>();
  for (const proof of evidence) {
    identity(proof.evidenceRef);
    for (const r of [proof.from, proof.to]) { identity(r.eventId); positive(r.revision); positive(r.qualityRevision); }
    if (proof.kind === "wraps") integer(proof.count);
    else if (proof.kind === "resets") {
      if (!Array.isArray(proof.resets) || !proof.resets.length || proof.resets.length > 1000) throw new Error("invalid_reset_evidence");
      for (const reset of proof.resets) { reset.at = timestamp(reset.at); integer(reset.terminalRaw); integer(reset.initialRaw); }
    } else throw new Error("invalid_transition_evidence");
    const k = pairKey(proof.from.eventId, proof.to.eventId), old = proofs.get(k);
    if (old && fingerprintOf(old) !== fingerprintOf(proof)) throw new Error("conflicting_transition_evidence");
    proofs.set(k, proof);
  }
  const used = new Set<string>();
  const decisions: CounterDecision[] = selected.map((to, i) => {
    const from = selected[i - 1] ?? null;
    const k = from ? pairKey(from.eventId, to.eventId) : "";
    const proof = proofs.get(k) ?? null;
    if (proof) used.add(k);
    const reasons = new Set<string>();
    const period = from ? { start: from.at, end: to.at } : null;
    let rawDelta: bigint | null = null, normalized: bigint | null = null;
    if (from) {
      const native = bucketFor(from.at, policy.nativeGrain);
      if (native.start !== from.at || native.end !== to.at) reasons.add("native_window_gap_or_misalignment");
      if (from.at < policy.validFrom || to.at > policy.validTo) reasons.add("capability_out_of_validity");
      if (from.mappingVersion !== policy.mappingVersion || to.mappingVersion !== policy.mappingVersion) reasons.add("mapping_version_mismatch");
      if (from.counterEpoch !== to.counterEpoch) reasons.add("counter_epoch_changed");
      if (from.quality !== "verified" || to.quality !== "verified") reasons.add("unverified_endpoint");
      if (proof && (!refEqual(proof.from, reference(from)) || !refEqual(proof.to, reference(to)))) reasons.add("stale_transition_evidence");
      const p = BigInt(from.rawValue), c = BigInt(to.rawValue);
      const elapsed = BigInt(Date.parse(to.at) - Date.parse(from.at));
      const validateSegment = (delta: bigint, ms: bigint, explicitWraps: boolean) => {
        if (delta < 0n) reasons.add("counter_decreased_without_evidence");
        if (ms === 0n) {
          if (delta !== 0n) reasons.add("instantaneous_counter_change");
          return;
        }
        if (rate !== null && delta * 1000n > rate * ms) reasons.add("counter_rate_exceeded");
        if (modulus !== null && !explicitWraps && (rate === null || (delta + modulus) * 1000n <= rate * ms)) reasons.add("wrap_count_ambiguous");
      };
      if (proof?.kind === "wraps") {
        if (modulus === null) reasons.add("modulus_not_declared");
        else { rawDelta = c - p + BigInt(proof.count) * modulus; validateSegment(rawDelta, elapsed, true); }
      } else if (proof?.kind === "resets") {
        let previous = p, previousAt = from.at, sum = 0n;
        for (const reset of proof.resets) {
          if (reset.at <= previousAt || reset.at > to.at) { reasons.add("reset_time_invalid"); break; }
          const terminal = BigInt(reset.terminalRaw), initial = BigInt(reset.initialRaw);
          if (modulus !== null && (terminal >= modulus || initial >= modulus)) reasons.add("reset_value_out_of_range");
          const delta = terminal - previous;
          validateSegment(delta, BigInt(Date.parse(reset.at) - Date.parse(previousAt)), false);
          sum += delta; previous = initial; previousAt = reset.at;
        }
        const delta = c - previous;
        validateSegment(delta, BigInt(Date.parse(to.at) - Date.parse(previousAt)), false);
        rawDelta = sum + delta;
      } else { rawDelta = c - p; validateSegment(rawDelta, elapsed, false); }
      if (rawDelta !== null && rawDelta >= 0n) {
        const scaled = rawDelta * BigInt(policy.conversion.numerator), divisor = BigInt(policy.conversion.denominator);
        if (scaled % divisor !== 0n) reasons.add("fractional_canonical_counter");
        else { normalized = scaled / divisor; if (normalized > MAX) reasons.add("canonical_counter_overflow"); }
      }
    } else reasons.add("first_reading_baseline");
    const status = !from ? "baseline" : reasons.size ? "pending" : "eligible";
    return {
      status, reasons: [...reasons].sort(), period,
      rawDelta: rawDelta === null || rawDelta < 0n ? null : rawDelta.toString(),
      value: status === "eligible" && normalized !== null ? { kind: "integer_delta", value: normalized.toString() } : null,
      from: from ? reference(from) : null, to: reference(to), evidenceRef: proof?.evidenceRef ?? null,
      inputFingerprint: fingerprintOf({ version: COUNTER_RULE_VERSION, policy, from, to, proof }),
    };
  });
  if ([...proofs.keys()].some(k => !used.has(k))) throw new Error("orphan_transition_evidence");
  return { ruleVersion: COUNTER_RULE_VERSION, policyVersion: policy.version, capabilityEvidenceRef: policy.capabilityEvidenceRef,
    workspaceId: policy.workspaceId, sourceId: policy.sourceId, subjectKey: policy.subjectKey, metric: { ...policy.metric },
    canonicalUnit: policy.canonicalUnit, mappingVersion: policy.mappingVersion, transformVersion: policy.transformVersion, decisions,
    inputFingerprint: fingerprintOf({ version: COUNTER_RULE_VERSION, policy, decisions: decisions.map(d => d.inputFingerprint) }) };
}
