import { FIRST_METRICS } from "../catalog/first-metrics.ts";
import { refKey, type Grain } from "../catalog/registry.ts";
import { integer } from "../measurements/rules.ts";
import { fingerprintOf, positiveRevision } from "./intervals.ts";
import { jobIdentity } from "./refresh-jobs.ts";
import { DEVICE_STATES, type DeviceState } from "./states.ts";
import type { Period } from "./periods.ts";
import type { RollupConfig, RollupObservation } from "./object-rollup.ts";

export interface DeviceMeanBasis {
  kind: "device_mean_bins"; ref: string; mode: "sample_mean" | "time_weighted"; scale: number; thresholds: readonly string[];
}
export function normalizeDeviceBasis(semantic: string, raw: RollupConfig["basis"]) {
  if (semantic === "state") { if (raw !== null) throw Error("unexpected_rollup_basis"); return; }
  const b = raw as DeviceMeanBasis;
  if (!b || typeof b !== "object" || Array.isArray(b) || Object.keys(b).some(k => !["kind", "ref", "mode", "scale", "thresholds"].includes(k)) ||
      b.kind !== "device_mean_bins" || !["sample_mean", "time_weighted"].includes(b.mode) || !Number.isSafeInteger(b.scale) || b.scale < 0 || b.scale > 9 ||
      !Array.isArray(b.thresholds) || !b.thresholds.length || b.thresholds.length > 12) throw Error("rollup_gauge_basis_required");
  jobIdentity(b.ref);
  b.thresholds.forEach((v, i) => { integer(v, true); if (i && BigInt(v) <= BigInt(b.thresholds[i - 1]!)) throw Error("invalid_rollup_thresholds"); });
}
export type DeviceDistribution = {
  kind: "device_states"; endCounts: Record<DeviceState, string>; deviceMilliseconds: Record<DeviceState, string>; expectedDeviceMilliseconds: string;
} | {
  kind: "device_mean_bins"; mode: "sample_mean" | "time_weighted"; scale: number;
  bins: readonly { lowerInclusive: string | null; upperExclusive: string | null; deviceCount: string }[]; unknownDevices: string;
};
function computedInteger(value: string, signed = false) {
  // Source values are 30 digits; exact mean numerators can grow while summing
  // samples or multiplying by their reviewed duration within one device.
  if (typeof value !== "string" || !(signed ? /^(0|-?[1-9][0-9]{0,63})$/ : /^(0|[1-9][0-9]{0,63})$/).test(value)) throw Error("invalid_rollup_device_mean");
}

// Internal only: one reviewed physical-device population and current trusted
// publications from the same authorized database snapshot. No station-outage
// inference, sensor averaging, temperature summation or operator allocation.
export function aggregateDeviceDistribution(c: RollupConfig, grain: Grain, period: Period, observations: readonly RollupObservation[]) {
  const def = FIRST_METRICS.get(c.metric)!, byId = new Map(observations.map(o => [o.memberId, o]));
  if (byId.size !== observations.length || byId.size !== c.members.length || c.members.some(m => !byId.has(m.id))) throw Error("rollup_observation_mismatch");
  const covered = new Set(c.members.flatMap(m => [...m.atomKeys]));
  // Device atoms always carry the fourth tuple element; normalization already
  // rejected duplicate devices and any member covering multiple devices.
  const keys = c.atoms.map(a => JSON.stringify([a.stationId, a.serviceId, a.networkObjectId, a.deviceId]));
  const uncovered = keys.filter(k => !covered.has(k)), duration = BigInt(Date.parse(period.end) - Date.parse(period.start));
  const endCounts = Object.fromEntries(DEVICE_STATES.map(s => [s, 0n])) as Record<DeviceState, bigint>;
  const deviceMs = Object.fromEntries(DEVICE_STATES.map(s => [s, 0n])) as Record<DeviceState, bigint>;
  const basis = def.semantic === "gauge" ? c.basis as DeviceMeanBasis : null, bins = Array.from({ length: (basis?.thresholds.length ?? 0) + 1 }, () => 0n);
  let unknown = BigInt(uncovered.length), known = 0, complete = 0, preliminary = 0;
  endCounts.unknown = unknown; deviceMs.unknown = unknown * duration;
  const members = c.members.map(m => {
    const o = byId.get(m.id)!, p = o.publication, reasons: string[] = [];
    if (o.unavailable) reasons.push("authority_unavailable");
    else if (o.currentAuthorityVersion !== m.authorityVersion) reasons.push("reviewed_authority_changed");
    if (!p && !o.unavailable) reasons.push("not_published");
    if (p) {
      const r = p.result;
      if (refKey(r.metric) !== refKey(c.metric) || r.sourceId !== m.sourceId || r.grain !== grain || fingerprintOf(r.period) !== fingerprintOf(period) ||
          r.unit !== def.unit || "knownValue" in r || !["missing", "partial", "preliminary", "complete"].includes(r.completeness)) throw Error("rollup_publication_mismatch");
      positiveRevision(p.revision); positiveRevision(p.currentRevision);
      if (p.freshness !== "current") reasons.push("publication_stale");
      if (r.authorityVersion !== m.authorityVersion) reasons.push("publication_authority_changed");
    }
    let deviceValue = null as NonNullable<RollupObservation["publication"]>["result"]["value"];
    if (!reasons.length && p) {
      const r = p.result, v = r.value;
      if (def.semantic === "state") {
        if (!v || v.kind !== "state" || !DEVICE_STATES.includes(v.endState) ||
            Object.keys(v.durationMilliseconds).length !== DEVICE_STATES.length || DEVICE_STATES.some(s => !(s in v.durationMilliseconds))) throw Error("rollup_value_kind_mismatch");
        let sum = 0n;
        for (const s of DEVICE_STATES) { integer(v.durationMilliseconds[s]); sum += BigInt(v.durationMilliseconds[s]); }
        if (sum !== duration || (r.completeness === "complete" && BigInt(v.durationMilliseconds.unknown) !== 0n)) throw Error("invalid_rollup_device_duration");
        for (const s of DEVICE_STATES) deviceMs[s] += BigInt(v.durationMilliseconds[s]);
        endCounts[v.endState]++; deviceValue = v;
        if (BigInt(v.durationMilliseconds.unknown) < duration) known++;
      } else if (v !== null) {
        if (v.kind !== "gauge" || !basis || v.mode !== basis.mode || v.scale !== basis.scale) throw Error("rollup_gauge_basis_mismatch");
        computedInteger(v.mean.numerator, true); computedInteger(v.mean.denominator);
        const n = BigInt(v.mean.numerator), d = BigInt(v.mean.denominator);
        if (d <= 0n) throw Error("invalid_rollup_device_mean");
        let i = basis.thresholds.findIndex(t => n < BigInt(t) * d); if (i < 0) i = bins.length - 1;
        bins[i]!++; deviceValue = v; known++;
      } else if (r.completeness !== "missing") throw Error("rollup_value_kind_mismatch");
      if (r.completeness === "complete") complete++;
      if (r.completeness === "preliminary") preliminary++;
      if (r.completeness !== "complete") reasons.push(r.completeness);
    }
    if (deviceValue === null) { unknown++; endCounts.unknown++; deviceMs.unknown += duration; }
    return { ...m, currentAuthorityVersion: o.currentAuthorityVersion, reasons, contribution: null,
      deviceValue,
      publication: p ? { seriesId: p.seriesId, revision: p.revision, currentRevision: p.currentRevision, inputFingerprint: p.result.inputFingerprint,
        currentInputFingerprint: p.currentInputFingerprint, freshness: p.freshness, authorityVersion: p.result.authorityVersion,
        completeness: p.result.completeness, watermark: p.result.watermark, authorityRevisions: [...(p.result.authorityRevisions ?? [])],
        reasons: [...p.reasons], inputReasons: [...p.result.reasons] } : null };
  });
  const completeness = !uncovered.length && complete === c.members.length ? "complete" : !known ? "missing"
    : !uncovered.length && complete + preliminary === c.members.length ? "preliminary" : "partial";
  const stale = members.some(m => m.reasons.some(r => ["authority_unavailable", "reviewed_authority_changed", "publication_stale", "publication_authority_changed"].includes(r)));
  const strings = (input: Record<DeviceState, bigint>) => Object.fromEntries(DEVICE_STATES.map(s => [s, input[s].toString()])) as Record<DeviceState, string>;
  const distribution: DeviceDistribution = basis ? { kind: "device_mean_bins", mode: basis.mode, scale: basis.scale,
    bins: bins.map((count, i) => ({ lowerInclusive: i ? basis.thresholds[i - 1]! : null, upperExclusive: basis.thresholds[i] ?? null, deviceCount: count.toString() })), unknownDevices: unknown.toString() }
    : { kind: "device_states", endCounts: strings(endCounts), deviceMilliseconds: strings(deviceMs), expectedDeviceMilliseconds: (duration * BigInt(c.atoms.length)).toString() };
  const body = { version: "device-distribution-v1", metric: c.metric, unit: def.unit, grain, period, basis: c.basis,
    value: null, knownValue: null, ratioParts: null, distribution, completeness, freshness: stale ? "stale" : "current",
    watermark: !uncovered.length && members.length && members.every(m => m.publication && !m.reasons.some(r => r.includes("authority") || r === "publication_stale"))
      ? members.map(m => m.publication!.watermark).sort()[0]! : period.start,
    physicalStationCount: new Set(c.atoms.map(a => a.stationId)).size, serviceCount: 0,
    coverage: { expectedAtoms: c.atoms.length, selectedAtoms: covered.size, uncoveredAtomKeys: uncovered, selectedMembers: c.members.length,
      knownMembers: known, completeMembers: complete, notApplicableMembers: 0 }, members };
  return { ...body, fingerprint: fingerprintOf(body) };
}
