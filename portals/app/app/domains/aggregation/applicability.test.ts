import { test } from "node:test";
import assert from "node:assert/strict";
import { planMappingWindows, type EffectiveMapping } from "./applicability.ts";
import { aggregateIntervals, type AggregationPlan, type IntervalInput } from "./intervals.ts";
import { bindSourceCompletion } from "./completion.ts";

const time = (m: number) => new Date(Date.parse("2026-10-25T00:00:00+08:00") + m * 60000).toISOString();
const period = { start: time(0), end: time(60) };
const mapping = (id: string, start: number, end: number, version = "1"): EffectiveMapping => ({ mappingId: id, mappingVersion: version, period: { start: time(start), end: time(end) } });
const maps = [mapping("old", 0, 30), mapping("new", 30, 60, "2")];
const base: AggregationPlan = { workspaceId: "w", sourceId: "src", subjectKey: "one-subject", authorityVersion: "authority", metric: { code: "service.data.uplink_bytes", version: 1 },
  inputMode: "direct", period, grain: "hour", nativeGrain: "15m", watermark: time(0), sourceComplete: false };
function inputs(windows: ReturnType<typeof planMappingWindows>["mappingWindows"]): IntervalInput[] {
  return windows.map((w, i) => ({ workspaceId: "w", sourceId: "src", subjectKey: base.subjectKey, metric: base.metric, eventId: "e" + i, componentKey: "up", revision: "1",
    qualityRevision: "1", quality: "verified", payloadSha256: "a".repeat(64), mappingId: w.mappingId, mappingVersion: w.mappingVersion, transformVersion: "1", period: w.period, value: { kind: "integer_delta", value: "10" } }));
}
test("adjacent mapping versions own exactly one whole native window each", () => {
  const result = planMappingWindows(period, "15m", maps);
  assert.deepEqual(result.mappingWindows.map(w => w.mappingId), ["old", "old", "new", "new"]);
  assert.deepEqual(planMappingWindows(period, "15m", [...maps].reverse()), result);
  const plan = { ...base, ...result }, rows = inputs(result.mappingWindows), value = aggregateIntervals(plan, rows);
  assert.deepEqual(value.value, { kind: "integer", value: "40" }); assert.equal(value.expectedWindows, 4);
  assert.deepEqual(value.mappingWindows, result.mappingWindows); assert.equal(value.evidence[2]?.mappingId, "new");
});
test("service activation and retirement define expected coverage independently of missing samples", () => {
  const applicability = planMappingWindows(period, "15m", maps, { start: time(15), end: time(45) });
  assert.equal(applicability.mappingWindows.length, 2);
  const result = aggregateIntervals({ ...base, ...applicability }, inputs(applicability.mappingWindows));
  assert.equal(result.expectedWindows, 2); assert.equal(result.expectedMilliseconds, 1800000); assert.equal(result.periodMilliseconds, 3600000);
  assert.equal(result.completeness, "preliminary"); assert.ok(!result.reasons.includes("missing_windows"));
  const partial = aggregateIntervals({ ...base, ...applicability }, inputs(applicability.mappingWindows).slice(0, 1));
  assert.equal(partial.completeness, "partial"); assert.equal(partial.expectedWindows, 2);
});
test("inactive services have no applicable windows or fabricated zero totals", () => {
  for (const service of [{ start: time(-60), end: time(0) }, { start: time(60), end: time(120) }]) {
    const applicability = planMappingWindows(period, "15m", [], service);
    const result = aggregateIntervals({ ...base, ...applicability }, []);
    assert.equal(result.completeness, "not_applicable"); assert.equal(result.value, null); assert.equal(result.expectedWindows, 0);
  }
});
test("mapping gaps remain configuration failures rather than shrinking expected coverage", () => {
  assert.throws(() => planMappingWindows(period, "15m", [mapping("a", 0, 15), mapping("b", 30, 60)]), /aggregate_mapping_gap/);
  assert.throws(() => planMappingWindows(period, "15m", []), /aggregate_mapping_gap/);
  // A gap outside service lifetime does not create expected measurements.
  assert.equal(planMappingWindows(period, "15m", [mapping("a", 15, 45)], { start: time(15), end: time(45) }).mappingWindows.length, 2);
});
test("overlapping mappings and off-grid switches never cause interval apportionment", () => {
  assert.throws(() => planMappingWindows(period, "15m", [mapping("a", 0, 45), mapping("b", 30, 60)]), /aggregate_subject_mapping_ambiguous/);
  assert.throws(() => planMappingWindows(period, "15m", [mapping("a", 0, 20), mapping("b", 20, 60)]), /mapping_ambiguous|unaligned_mapping/);
  assert.throws(() => planMappingWindows(period, "15m", [mapping("a", 0, 20)]), /unaligned_mapping_boundary/);
  assert.throws(() => planMappingWindows(period, "15m", maps, { start: time(5), end: time(60) }), /unaligned_service_boundary/);
  assert.throws(() => planMappingWindows(period, "15m", maps, { start: time(0), end: time(55) }), /unaligned_service_boundary/);
});
test("mapping manifests enforce mapping identity and revision for each selected measurement", () => {
  const applicability = planMappingWindows(period, "15m", maps), rows = inputs(applicability.mappingWindows), plan = { ...base, ...applicability };
  for (const patch of [{ mappingId: "wrong" }, { mappingId: undefined }, { mappingVersion: "9" }]) {
    assert.throws(() => aggregateIntervals(plan, rows.map((r, i) => i === 2 ? { ...r, ...patch } : r)), /measurement_mapping_mismatch/);
  }
  assert.throws(() => aggregateIntervals({ ...plan, mappingWindows: applicability.mappingWindows.slice(0, 2) }, rows), /invalid_mapping_manifest/);
  assert.throws(() => aggregateIntervals({ ...plan, mappingWindows: [applicability.mappingWindows[0]!, ...applicability.mappingWindows.slice(0, 3)] }, rows), /invalid_mapping_manifest/);
});
test("manifest order and timezone spelling canonicalize, while mapping switches invalidate confirmation", () => {
  const applicability = planMappingWindows(period, "15m", maps), plan = { ...base, ...applicability }, rows = inputs(applicability.mappingWindows);
  const first = aggregateIntervals(plan, rows);
  const reordered = aggregateIntervals({ ...plan, mappingWindows: [...applicability.mappingWindows].reverse() }, rows);
  assert.equal(first.inputFingerprint, reordered.inputFingerprint);
  const evidence = { revision: "1", status: "confirmed" as const, inputFingerprint: first.inputFingerprint, watermark: time(60), evidenceRef: "fixture://completion", evidenceSha256: "b".repeat(64) };
  assert.equal(bindSourceCompletion(plan, rows, evidence).sourceComplete, true);
  const changed = planMappingWindows(period, "15m", [mapping("old", 0, 15), mapping("new", 15, 60, "2")]);
  assert.equal(bindSourceCompletion({ ...base, ...changed }, inputs(changed.mappingWindows), evidence).sourceComplete, false);
});
test("planner bounds and invalid mapping revisions fail before producing coverage", () => {
  assert.throws(() => planMappingWindows(period, "15m", [mapping("a", 0, 60, "0")]), /invalid_effective_mapping/);
  assert.throws(() => planMappingWindows(period, "15m", [mapping("a", 0, 30), mapping("a", 30, 60)]), /invalid_effective_mapping/);
  assert.throws(() => planMappingWindows(period, "hour", maps), /mapping_ambiguous|unaligned_mapping/);
  assert.throws(() => planMappingWindows(period, "15m", Array.from({ length: 10001 }, (_, i) => mapping("m" + i, 0, 60))), /mapping_bound_exceeded/);
});
