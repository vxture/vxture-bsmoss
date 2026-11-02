import { FIRST_METRICS } from "../catalog/first-metrics.ts";
import { GRAINS, refKey, type Grain, type MetricRef } from "../catalog/registry.ts";
import { integer } from "../measurements/rules.ts";
import { fingerprintOf, positiveRevision, type AggregateValue } from "./intervals.ts";
import { jobIdentity } from "./refresh-jobs.ts";
import { bounds, bucketFor, type Period } from "./periods.ts";
import type { AggregateQueryResult } from "./query.ts";
import type { IntervalAggregate } from "./store.ts";

export interface RollupAtom { stationId: string; serviceId: string | null; networkObjectId: string | null }
export interface RollupMember {
  id: string; sourceId: string; mappingId: string; authorityVersion: string; atomKeys: readonly string[]; coverageRef: string;
}
export interface RollupConfig {
  status: "active" | "paused"; metric: MetricRef; validPeriod: Period;
  basis: { kind: "voice_attempts" | "prb_capacity_time"; ref: string } | null;
  atoms: readonly RollupAtom[]; members: readonly RollupMember[];
}
export interface RollupQuery { rollupId: string; grain: Grain; at: string }
export interface RollupObservation {
  memberId: string; currentAuthorityVersion: string | null; publication: AggregateQueryResult | null;
  unavailable: boolean;
}
function fields(value: unknown, allowed: readonly string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(k => !allowed.includes(k))) throw Error("invalid_rollup_config");
}
export function atomKey(atom: RollupAtom) { return JSON.stringify([atom.stationId, atom.serviceId, atom.networkObjectId]); }
export function normalizeRollupConfig(raw: RollupConfig) {
  const c = structuredClone(raw);
  fields(c, ["status", "metric", "validPeriod", "basis", "atoms", "members"]);
  fields(c.metric, ["code", "version"]); fields(c.validPeriod, ["start", "end"]);
  const def = FIRST_METRICS.get(c.metric);
  if (!Number.isSafeInteger(c.metric.version) || !def || def.lifecycle === "retired" ||
      !["disjoint_sum", "ratio_parts"].includes(def.objectAggregation) || !["active", "paused"].includes(c.status)) throw Error("unsupported_rollup_metric");
  const [start, end] = bounds(c.validPeriod);
  c.validPeriod = { start: new Date(start).toISOString(), end: new Date(end).toISOString() };
  if (def.objectAggregation === "ratio_parts") {
    fields(c.basis, ["kind", "ref"]);
    const kind = c.metric.code === "status.voice.connection_rate" ? "voice_attempts" : "prb_capacity_time";
    if (!c.basis || c.basis.kind !== kind) throw Error("rollup_ratio_basis_required");
    jobIdentity(c.basis.ref);
  } else if (c.basis !== null) throw Error("unexpected_rollup_basis");
  if (!Array.isArray(c.atoms) || !c.atoms.length || c.atoms.length > 256 || !Array.isArray(c.members) || c.members.length > 64) throw Error("rollup_bound_exceeded");
  for (const atom of c.atoms) {
    fields(atom, ["stationId", "serviceId", "networkObjectId"]); jobIdentity(atom.stationId);
    if (def.attribution === "service_required") { jobIdentity(atom.serviceId!); jobIdentity(atom.networkObjectId!); }
    else if (atom.serviceId !== null || atom.networkObjectId !== null || def.object !== "station_meter") throw Error("rollup_physical_attribution_mismatch");
  }
  const atoms = new Set(c.atoms.map(atomKey));
  if (atoms.size !== c.atoms.length) throw Error("duplicate_rollup_atom");
  const ids = new Set<string>(), mappings = new Set<string>(), used = new Set<string>();
  for (const m of c.members) {
    fields(m, ["id", "sourceId", "mappingId", "authorityVersion", "atomKeys", "coverageRef"]);
    [m.id, m.sourceId, m.mappingId, m.coverageRef].forEach(jobIdentity);
    if (typeof m.authorityVersion !== "string" || !/^[a-f0-9]{64}$/.test(m.authorityVersion)) throw Error("invalid_rollup_authority");
    const mapping = JSON.stringify([m.sourceId, m.mappingId]);
    if (ids.has(m.id) || mappings.has(mapping)) throw Error("duplicate_rollup_member");
    ids.add(m.id); mappings.add(mapping);
    if (!Array.isArray(m.atomKeys) || !m.atomKeys.length || m.atomKeys.length > 256) throw Error("invalid_rollup_coverage");
    for (const key of m.atomKeys) {
      if (!atoms.has(key) || used.has(key)) throw Error("overlapping_or_unknown_rollup_coverage");
      used.add(key);
    }
    const group = c.atoms.filter(a => m.atomKeys.includes(atomKey(a)));
    if (group.some(a => a.stationId !== group[0]!.stationId || a.serviceId !== group[0]!.serviceId)) throw Error("rollup_cross_service_coverage");
    m.atomKeys = [...m.atomKeys].sort();
  }
  c.atoms = [...c.atoms].sort((a, b) => atomKey(a).localeCompare(atomKey(b)));
  c.members = [...c.members].sort((a, b) => a.id.localeCompare(b.id));
  return { config: c, sha256: fingerprintOf({ version: "object-rollup-config-v1", config: c }) };
}
export function normalizeRollupQuery(raw: RollupQuery): RollupQuery {
  fields(raw, ["rollupId", "grain", "at"]); jobIdentity(raw.rollupId);
  if (!GRAINS.includes(raw.grain)) throw Error("invalid_rollup_filter");
  return { rollupId: raw.rollupId, grain: raw.grain, at: bucketFor(raw.at, raw.grain).start };
}
export function parseRollupQuery(params: URLSearchParams) {
  const keys = ["rollupId", "grain", "at"];
  if (params.toString().length > 4096 || [...params.keys()].some(k => !keys.includes(k)) || keys.some(k => params.getAll(k).length !== 1)) throw Error("invalid_rollup_filter");
  return normalizeRollupQuery({ rollupId: params.get("rollupId")!, grain: params.get("grain") as Grain, at: params.get("at")! });
}

// Internal trusted kernel. Configuration and observations come from one scoped
// database snapshot, never from a request body or arbitrary client values.
export function aggregateObjectRollup(raw: RollupConfig, grain: Grain, at: string, observations: readonly RollupObservation[]) {
  const { config: c } = normalizeRollupConfig(raw), period = bucketFor(at, grain), def = FIRST_METRICS.get(c.metric)!;
  if (c.status !== "active") throw Error("rollup_paused");
  if (!def.grains.includes(grain) || period.start < c.validPeriod.start || period.end > c.validPeriod.end) throw Error("rollup_period_boundary");
  const byId = new Map(observations.map(o => [o.memberId, o]));
  if (byId.size !== observations.length || byId.size !== c.members.length || c.members.some(m => !byId.has(m.id))) throw Error("rollup_observation_mismatch");
  let total = 0n, numerator = 0n, denominator = 0n, known = 0, complete = 0, preliminary = 0, inactive = 0;
  const covered = new Set(c.members.flatMap(m => [...m.atomKeys])), uncovered = c.atoms.map(atomKey).filter(k => !covered.has(k));
  const members = c.members.map(m => {
    const o = byId.get(m.id)!, p = o.publication, reasons: string[] = [];
    if (o.unavailable) reasons.push("authority_unavailable");
    else if (o.currentAuthorityVersion !== m.authorityVersion) reasons.push("reviewed_authority_changed");
    if (!p && !o.unavailable) reasons.push("not_published");
    if (p) {
      const r = p.result;
      if (refKey(r.metric) !== refKey(c.metric) || r.sourceId !== m.sourceId || r.grain !== grain || fingerprintOf(r.period) !== fingerprintOf(period) ||
          r.unit !== def.unit || !("knownValue" in r)) throw Error("rollup_publication_mismatch");
      positiveRevision(p.revision); positiveRevision(p.currentRevision);
      if (p.freshness !== "current") reasons.push("publication_stale");
      if (r.authorityVersion !== m.authorityVersion) reasons.push("publication_authority_changed");
    }
    let contribution: AggregateValue | null = null;
    if (!reasons.length && p) {
      const r = p.result as IntervalAggregate;
      contribution = r.knownValue;
      // Verified zero-attempt windows carry 0/0, not a made-up 0 percent.
      if (!contribution && def.objectAggregation === "ratio_parts" && r.validWindows > 0 && r.reasons.includes("zero_denominator")) contribution = { kind: "ratio", numerator: "0", denominator: "0" };
      if (contribution) {
        if (contribution.kind === "integer" && def.objectAggregation === "disjoint_sum") { integer(contribution.value); total += BigInt(contribution.value); }
        else if (contribution.kind === "ratio" && def.objectAggregation === "ratio_parts") {
          integer(contribution.numerator); integer(contribution.denominator);
          if (BigInt(contribution.numerator) > BigInt(contribution.denominator)) throw Error("invalid_rollup_ratio");
          numerator += BigInt(contribution.numerator); denominator += BigInt(contribution.denominator);
        } else throw Error("rollup_value_kind_mismatch");
        known++;
      }
      if (r.completeness === "complete") complete++;
      if (r.completeness === "preliminary") preliminary++;
      if (r.completeness === "not_applicable") inactive++;
      if (r.completeness !== "complete" && r.completeness !== "not_applicable") reasons.push(r.completeness);
    }
    return { ...m, currentAuthorityVersion: o.currentAuthorityVersion, reasons,
      publication: p ? { seriesId: p.seriesId, revision: p.revision, currentRevision: p.currentRevision,
        inputFingerprint: p.result.inputFingerprint, currentInputFingerprint: p.currentInputFingerprint, freshness: p.freshness,
        authorityVersion: p.result.authorityVersion, completeness: p.result.completeness, watermark: p.result.watermark,
        authorityRevisions: [...(p.result.authorityRevisions ?? [])],
        reasons: [...p.reasons], inputReasons: [...p.result.reasons] } : null, contribution };
  });
  const allCovered = !uncovered.length, n = c.members.length;
  const completeness = allCovered && inactive === n ? "not_applicable" : allCovered && complete + inactive === n ? "complete" : !known ? "missing"
    : allCovered && complete + preliminary + inactive === n ? "preliminary" : "partial";
  const knownValue: AggregateValue | null = !known ? null : def.objectAggregation === "disjoint_sum" ? { kind: "integer", value: total.toString() }
    : denominator === 0n ? null : { kind: "ratio", numerator: numerator.toString(), denominator: denominator.toString() };
  const stale = members.some(m => m.reasons.some(r => ["authority_unavailable", "reviewed_authority_changed", "publication_stale", "publication_authority_changed"].includes(r)));
  const activeMembers = members.filter(m => m.publication?.completeness !== "not_applicable");
  const body = { version: "object-rollup-v1", metric: c.metric, unit: def.unit, grain, period, basis: c.basis,
    value: completeness === "complete" ? knownValue : null, knownValue, completeness, freshness: stale ? "stale" : "current",
    ratioParts: def.objectAggregation === "ratio_parts" && known ? { numerator: numerator.toString(), denominator: denominator.toString() } : null,
    watermark: members.length && allCovered && members.every(m => m.publication && !m.reasons.some(r => r.includes("authority") || r === "publication_stale"))
      ? activeMembers.map(m => m.publication!.watermark).sort()[0] ?? period.end : period.start,
    physicalStationCount: new Set(c.atoms.map(a => a.stationId)).size,
    serviceCount: new Set(c.atoms.flatMap(a => a.serviceId === null ? [] : [a.serviceId])).size,
    coverage: { expectedAtoms: c.atoms.length, selectedAtoms: covered.size, uncoveredAtomKeys: uncovered, selectedMembers: n, knownMembers: known, completeMembers: complete, notApplicableMembers: inactive },
    members };
  return { ...body, fingerprint: fingerprintOf(body) };
}

export type ObjectRollupResult = ReturnType<typeof aggregateObjectRollup> & {
  workspaceId: string; rollupId: string; configRevision: string; configSha256: string; semanticSha256: string; reviewRef: string;
  applicableServiceCount: number; calculationFingerprint: string; requiredMetricKeys: readonly string[];
  attribution: readonly (RollupAtom & { key: string; operatorEntityId: string | null; serviceApplicable: boolean | null })[];
};
export interface ObjectRollupReader { readonly workspaceId: string; read(query: RollupQuery): Promise<ObjectRollupResult | null> }
