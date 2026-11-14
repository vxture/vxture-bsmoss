import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregateObjectRollup, atomKey, normalizeRollupConfig, parseRollupQuery, type RollupConfig, type RollupObservation } from "./object-rollup.ts";
import { aggregateIntervals } from "./intervals.ts";
import type { AggregationPlan } from "./intervals.ts";
import { mappedSubject } from "./subjects.ts";

const metric = { code: "service.data.uplink_bytes", version: 1 }, authority = "a".repeat(64);
const period = { start: "2026-10-24T16:00:00.000Z", end: "2026-10-25T16:00:00.000Z" };
const atoms = ["a", "b"].map(id => ({ stationId: "st", serviceId: "svc", networkObjectId: id }));
function config(): RollupConfig {
  return { status: "active", metric, validPeriod: period, basis: null, atoms,
    members: atoms.map((a, i) => ({ id: String(i), sourceId: "src", mappingId: "map" + i, authorityVersion: authority, atomKeys: [atomKey(a)], coverageRef: "fixture://review" })) };
}
function observation(c: RollupConfig, i: number, value: string | [string, string] = "1", options: { complete?: boolean; missing?: boolean; inactive?: boolean } = {}): RollupObservation {
  const m = c.members[i]!, plan: AggregationPlan = { workspaceId: "w", sourceId: m.sourceId,
    subjectKey: mappedSubject("st", "svc", atoms[i]!.networkObjectId, null), authorityVersion: authority, metric: c.metric,
    inputMode: "direct", period, grain: "day", nativeGrain: "day", sourceComplete: options.complete !== false,
    watermark: options.complete === false ? period.start : period.end, ...(options.inactive ? { applicablePeriods: [] } : {}) };
  const result = aggregateIntervals(plan, options.missing || options.inactive ? [] : [{ workspaceId: "w", sourceId: "src", subjectKey: plan.subjectKey,
    metric: c.metric, eventId: m.id, componentKey: "value", revision: "1", qualityRevision: "1", quality: "verified", payloadSha256: authority,
    mappingVersion: "1", transformVersion: "v1", period, value: Array.isArray(value) ? { kind: "ratio_parts", numerator: value[0], denominator: value[1] } : { kind: "integer_delta", value } }]);
  return { memberId: m.id, currentAuthorityVersion: authority, unavailable: false, publication: { seriesId: "series" + i, revision: "1", currentRevision: "1",
    publishedBy: "fixture", createdAt: period.end, result, selection: "current", freshness: "current", currentInputFingerprint: result.inputFingerprint, reasons: [] } };
}
const read = (c: RollupConfig, obs: RollupObservation[]) => aggregateObjectRollup(c, "day", period.start, obs);

test("object rollup preserves large integer sums and counts physical stations independently of service atoms", () => {
  const c = config(), r = read(c, [observation(c, 0, "999999999999999999999999999999"), observation(c, 1, "999999999999999999999999999999")]);
  assert.deepEqual(r.value, { kind: "integer", value: "1999999999999999999999999999998" });
  assert.equal(r.physicalStationCount, 1); assert.equal(r.serviceCount, 1); assert.equal(r.completeness, "complete");
});
test("object rollup forbids total-detail and cross-source overlap and canonical atomic aliases", () => {
  const c = config(); c.members = [...c.members, { ...c.members[0]!, id: "total", mappingId: "total", sourceId: "other", atomKeys: atoms.map(atomKey) }];
  assert.throws(() => normalizeRollupConfig(c), /overlapping/);
  const duplicate = config(); duplicate.atoms = [...atoms, atoms[0]!]; assert.throws(() => normalizeRollupConfig(duplicate), /duplicate_rollup_atom/);
  const cross = config(); cross.atoms = [atoms[0]!, { ...atoms[1]!, serviceId: "other" }];
  cross.members = [{ ...cross.members[0]!, atomKeys: cross.atoms.map(atomKey) }]; assert.throws(() => normalizeRollupConfig(cross), /cross_service/);
});
test("object rollup separates uncovered, unpublished, preliminary, unknown and verified zero", () => {
  const c = config(), one = observation(c, 0, "0"), absent: RollupObservation = { memberId: "1", currentAuthorityVersion: authority, publication: null, unavailable: false };
  const r = read(c, [one, absent]); assert.equal(r.value, null); assert.deepEqual(r.knownValue, { kind: "integer", value: "0" }); assert.equal(r.completeness, "partial");
  const uncovered = { ...c, members: [c.members[0]!] }; assert.equal(read(uncovered, [one]).coverage.uncoveredAtomKeys.length, 1);
  assert.equal(read(c, [{ ...absent, memberId: "0" }, absent]).knownValue, null);
  const preliminary = read(c, [observation(c, 0, "1", { complete: false }), observation(c, 1, "2")]);
  assert.equal(preliminary.completeness, "preliminary"); assert.equal(preliminary.value, null); assert.deepEqual(preliminary.knownValue, { kind: "integer", value: "3" });
  assert.equal(read(c, [observation(c, 0, "1", { inactive: true }), observation(c, 1, "1", { inactive: true })]).completeness, "not_applicable");
  assert.equal(read(c, [observation(c, 0, "1", { missing: true }), observation(c, 1, "1", { missing: true })]).completeness, "missing");
});
test("object rollup excludes stale publications and changed review generations from trusted subtotals", () => {
  const c = config(), a = observation(c, 0, "100"), b = observation(c, 1, "2");
  a.publication!.freshness = "stale"; let r = read(c, [a, b]);
  assert.deepEqual(r.knownValue, { kind: "integer", value: "2" }); assert.equal(r.freshness, "stale"); assert.equal(r.watermark, period.start);
  a.publication!.freshness = "current"; a.currentAuthorityVersion = "b".repeat(64); r = read(c, [a, b]); assert.deepEqual(r.knownValue, { kind: "integer", value: "2" });
  a.currentAuthorityVersion = authority; a.unavailable = true; assert.equal(read(c, [a, b]).members[0]!.contribution, null);
});
test("object rollup adds ratio parts instead of percentages and retains zero denominator evidence", () => {
  const c = { ...config(), metric: { code: "status.voice.connection_rate", version: 1 }, basis: { kind: "voice_attempts" as const, ref: "fixture://attempts" } };
  assert.deepEqual(read(c, [observation(c, 0, ["1", "2"]), observation(c, 1, ["9", "10"])]).value, { kind: "ratio", numerator: "10", denominator: "12" });
  assert.deepEqual(read(c, [observation(c, 0, ["0", "0"]), observation(c, 1, ["1", "2"])]).value, { kind: "ratio", numerator: "1", denominator: "2" });
  const zero = read(c, [observation(c, 0, ["0", "0"]), observation(c, 1, ["0", "0"])]);
  assert.equal(zero.value, null); assert.equal(zero.completeness, "complete"); assert.deepEqual(zero.ratioParts, { numerator: "0", denominator: "0" });
  assert.throws(() => normalizeRollupConfig({ ...c, metric: { code: "status.radio.prb_utilization", version: 1 } }), /basis_required/);
});
test("object rollup requires explicit physical device coverage and refuses service-attributed energy", () => {
  for (const code of ["runtime.environment.temperature_c", "runtime.device.state"]) assert.throws(() => normalizeRollupConfig({ ...config(), metric: { code, version: 1 } }));
  assert.throws(() => normalizeRollupConfig({ ...config(), metric: { code: "runtime.energy.site_wh", version: 1 } }), /physical_attribution/);
});
test("object rollup rejects unknown fields, missing observations, mixed periods and unsupported selectors", () => {
  const c = config(); assert.throws(() => read(c, []), /observation_mismatch/);
  assert.throws(() => normalizeRollupConfig({ ...c, workspaceId: "forged" } as RollupConfig), /invalid_rollup_config/);
  assert.throws(() => read({ ...c, status: "paused" }, [observation(c, 0), observation(c, 1)]), /paused/);
  assert.throws(() => aggregateObjectRollup(c, "week", period.start, []), /period_boundary/);
  const a = observation(c, 0); a.publication!.result.period = { ...period, end: "2026-10-26T16:00:00.000Z" };
  assert.throws(() => read(c, [a, observation(c, 1)]), /publication_mismatch/);
  const p = new URLSearchParams({ rollupId: "r", grain: "day", at: period.start }); assert.equal(parseRollupQuery(p).at, period.start);
  for (const [key, value] of [["workspaceId", "w"], ["grain", "5m"], ["members", "forged"], ["at", "bad"]]) { const q = new URLSearchParams(p); q.set(key!, value!); assert.throws(() => parseRollupQuery(q)); }
  p.append("rollupId", "other"); assert.throws(() => parseRollupQuery(p));
});
