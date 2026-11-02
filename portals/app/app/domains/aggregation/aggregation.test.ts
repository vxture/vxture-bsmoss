import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregateIntervals, type AggregationPlan, type IntervalInput } from "./intervals.ts";
import { bucketFor, nativeWindows } from "./periods.ts";
import { aggregateGauge } from "./gauges.ts";
import { aggregateStateTimeline, type StateEvent } from "./states.ts";

const time = (minutes: number) => new Date(Date.parse("2026-10-25T00:00:00+08:00") + minutes * 60000).toISOString();
const hour = { start: time(0), end: time(60) };
const ref = (code: string) => ({ code, version: 1 });
const voice = "service.voice.connected_seconds", up = "service.data.uplink_bytes", down = "service.data.downlink_bytes";
function plan(code = voice, patch: Partial<AggregationPlan> = {}): AggregationPlan {
  return { workspaceId: "w", sourceId: "source", subjectKey: "station/service/cell/direction", authorityVersion: "authority-v1",
    metric: ref(code), inputMode: "direct", period: hour, grain: "hour", nativeGrain: "15m", watermark: time(60), sourceComplete: true, ...patch };
}
function row(slot: number, value: string, code = voice, patch: Partial<IntervalInput> = {}): IntervalInput {
  return { workspaceId: "w", sourceId: "source", subjectKey: "station/service/cell/direction", metric: ref(code), eventId: code + ":" + slot,
    componentKey: code, revision: "1", qualityRevision: "1", quality: "verified", payloadSha256: "a".repeat(64),
    mappingVersion: "1", transformVersion: "1", period: { start: time(slot * 15), end: time((slot + 1) * 15) },
    value: { kind: "integer_delta", value }, ...patch };
}
const ratio = (slot: number, n: string, d: string, code = "status.voice.connection_rate") =>
  row(slot, "0", code, { value: { kind: "ratio_parts", numerator: n, denominator: d } });
const full = (code = voice, value = "0") => Array.from({ length: 4 }, (_, i) => row(i, value, code));

test("A01: partial voice totals retain missing windows; zero and absence differ", () => {
  const result = aggregateIntervals(plan(), [row(0, "120"), row(1, "180")]);
  assert.deepEqual(result.value, { kind: "integer", value: "300" });
  assert.equal(result.completeness, "partial");
  assert.equal(result.validWindows, 2); assert.equal(result.expectedWindows, 4);
  assert.equal(result.validMilliseconds, 1800000);
  const empty = aggregateIntervals(plan(), []);
  assert.equal(empty.value, null); assert.equal(empty.completeness, "missing");
  const zero = aggregateIntervals(plan(), full());
  assert.deepEqual(zero.value, { kind: "integer", value: "0" }); assert.equal(zero.completeness, "complete");
});

test("A02/A03: total traffic requires aligned valid direction pairs", () => {
  const p = plan("service.data.total_bytes", { inputMode: "dependencies" });
  const values = [row(0, "100", up), row(1, "200", up), row(0, "300", down), row(1, "400", down), ...[2, 3].flatMap(i => [row(i, "0", up), row(i, "0", down)])];
  assert.deepEqual(aggregateIntervals(p, values).value, { kind: "integer", value: "1000" });
  const missing = aggregateIntervals(p, values.filter(r => r.eventId !== down + ":1"));
  assert.equal(missing.value, null);
  assert.deepEqual(missing.knownValue, { kind: "integer", value: "400" });
  assert.ok(missing.reasons.includes("missing_dependency")); assert.equal(missing.validWindows, 3);
});

test("A04/A05: connection and PRB rates combine their parts, never percentages", () => {
  const voiceResult = aggregateIntervals(plan("status.voice.connection_rate"), [ratio(0, "90", "100"), ratio(1, "1", "10")]);
  assert.deepEqual(voiceResult.value, { kind: "ratio", numerator: "91", denominator: "110" });
  const prb = "status.radio.prb_utilization";
  assert.deepEqual(aggregateIntervals(plan(prb), [ratio(0, "50", "100", prb), ratio(1, "9", "10", prb)]).value,
    { kind: "ratio", numerator: "59", denominator: "110" });
});

test("connection rate can derive from the same-window connected and attempted counters", () => {
  const connected = "service.voice.connected_count", attempted = "service.voice.attempt_count";
  const result = aggregateIntervals(plan("status.voice.connection_rate", { inputMode: "dependencies" }),
    [0, 1, 2, 3].flatMap(i => [row(i, "9", connected), row(i, "10", attempted)]));
  assert.deepEqual(result.value, { kind: "ratio", numerator: "36", denominator: "40" });
  assert.equal(result.completeness, "complete");
});

test("A06/A07: zero denominator has a reason; negative counters and impossible ratios are rejected", () => {
  const result = aggregateIntervals(plan("status.voice.connection_rate"), Array.from({ length: 4 }, (_, i) => ratio(i, "0", "0")));
  assert.equal(result.value, null); assert.equal(result.completeness, "complete"); assert.deepEqual(result.reasons, ["zero_denominator"]);
  assert.throws(() => aggregateIntervals(plan(), [row(0, "-1")]), /invalid_integer/);
  assert.throws(() => aggregateIntervals(plan("status.voice.connection_rate"), [ratio(0, "11", "10")]), /invalid_ratio/);
});

test("A12: replays and out-of-order revisions count once with deterministic fingerprints", () => {
  const old = row(0, "100"), corrected = row(0, "150", voice, { revision: "2", payloadSha256: "b".repeat(64) });
  const first = aggregateIntervals(plan(), [old, corrected, old, corrected]);
  const reordered = aggregateIntervals(plan(), [corrected, old]);
  assert.deepEqual(first.value, { kind: "integer", value: "150" });
  assert.equal(first.evidence.length, 1); assert.equal(first.evidence[0].revision, "2");
  assert.equal(first.inputFingerprint, reordered.inputFingerprint);
  assert.throws(() => aggregateIntervals(plan(), [old, { ...old, payloadSha256: "c".repeat(64) }]), /conflicting_replay/);
});

test("a pending latest revision or revoked quality never falls back to older verified evidence", () => {
  const old = row(0, "100"), newer = row(0, "150", voice, { revision: "2", quality: "pending" });
  const result = aggregateIntervals(plan(), [newer, old]);
  assert.equal(result.value, null); assert.equal(result.validWindows, 0); assert.ok(result.reasons.includes("pending_quality"));
  const revoked = aggregateIntervals(plan(), [old, { ...old, qualityRevision: "2", quality: "rejected" }]);
  assert.equal(revoked.value, null); assert.ok(revoked.reasons.includes("rejected_quality"));
  assert.throws(() => aggregateIntervals(plan(), [old, { ...old, qualityRevision: "2", quality: "pending" }, { ...old, quality: "rejected" }]), /conflicting_replay/);
});

test("authority overlap, tenant/source/subject/version mixing and raw/derived mixing are rejected", () => {
  assert.throws(() => aggregateIntervals(plan(), [row(0, "100"), row(0, "100", voice, { eventId: "another-event" })]), /overlapping_authority_evidence/);
  for (const patch of [{ workspaceId: "other" }, { sourceId: "other" }, { subjectKey: "other" }, { metric: { code: voice, version: 2 } }]) {
    assert.throws(() => aggregateIntervals(plan(), [row(0, "1", voice, patch)]), /scope_mismatch/);
  }
  assert.throws(() => aggregateIntervals(plan("service.data.total_bytes"), []), /invalid_input_mode/);
  assert.throws(() => aggregateIntervals(plan("service.data.total_bytes", { inputMode: "dependencies" }), [row(0, "1", "service.data.total_bytes")]), /scope_mismatch/);
});

test("A13: native hourly counts enter a day but cannot be split into quarter-hours", () => {
  const wholeHour = row(0, "600", voice, { period: hour });
  const day = bucketFor(time(0), "day");
  const result = aggregateIntervals(plan(voice, { period: day, grain: "day", nativeGrain: "hour", watermark: day.end }), [wholeHour]);
  assert.deepEqual(result.value, { kind: "integer", value: "600" }); assert.equal(result.expectedWindows, 24);
  assert.throws(() => aggregateIntervals(plan(voice, { period: { start: time(0), end: time(15) }, grain: "15m", nativeGrain: "hour" }), []), /unaligned_native_window/);
  assert.throws(() => aggregateIntervals(plan(), [wholeHour]), /unexpected_or_coarse_window/);
});

test("A14: Shanghai day/week/month boundaries and leap years are half-open", () => {
  const sunday = bucketFor("2026-10-25T23:45:00+08:00", "week"), monday = bucketFor("2026-10-26T00:00:00+08:00", "week");
  assert.equal(sunday.end, monday.start);
  assert.equal(monday.start, "2026-10-25T16:00:00.000Z");
  const leap = bucketFor("2028-02-29T12:00:00+08:00", "month");
  assert.equal(nativeWindows(leap, "day").length, 29);
  assert.equal(nativeWindows(bucketFor("2026-02-20T00:00:00+08:00", "month"), "day").length, 28);
  assert.equal(nativeWindows({ start: time(0), end: time(15) }, "5m").length, 3);
  assert.throws(() => nativeWindows({ start: time(1), end: time(16) }, "15m"), /unaligned_native_window/);
  assert.throws(() => bucketFor("2026-02-30T00:00:00Z", "day"), /invalid_timestamp/);
});

test("A16: exact 30-digit counters survive aggregation and aggregate overflow is rejected", () => {
  const maximum = "9".repeat(30);
  assert.deepEqual(aggregateIntervals(plan(), [row(0, maximum)]).value, { kind: "integer", value: maximum });
  assert.throws(() => aggregateIntervals(plan(), [row(0, maximum), row(1, "1")]), /invalid_integer/);
  assert.throws(() => aggregateIntervals(plan(), [row(0, "1" + "0".repeat(30))]), /invalid_integer/);
});

test("source completion and watermark are both necessary for a final result", () => {
  assert.equal(aggregateIntervals(plan(voice, { sourceComplete: false }), full()).completeness, "preliminary");
  assert.equal(aggregateIntervals(plan(voice, { watermark: time(45) }), full()).completeness, "preliminary");
  assert.notEqual(aggregateIntervals(plan(), full()).inputFingerprint,
    aggregateIntervals(plan(voice, { authorityVersion: "authority-v2" }), full()).inputFingerprint);
});

const event = (eventId: string, at: number, until: number, state: StateEvent["state"], patch: Partial<StateEvent> = {}): StateEvent =>
  ({ eventId, at: time(at), validUntil: time(until), state, revision: "1", qualityRevision: "1", quality: "verified", ...patch });
const quarter = { start: time(0), end: time(15) };

test("A10: a newer device event truncates its predecessor and TTL expiry becomes unknown", () => {
  const result = aggregateStateTimeline(quarter, [event("running", 0, 10, "running"), event("fault", 5, 12, "fault")]);
  assert.equal(result.durationMilliseconds.running, "300000");
  assert.equal(result.durationMilliseconds.fault, "420000");
  assert.equal(result.durationMilliseconds.unknown, "180000");
  assert.equal(result.knownTransitions, 1); assert.equal(result.endState, "unknown");
  assert.equal(Object.values(result.durationMilliseconds).reduce((n, v) => n + BigInt(v), 0n), 900000n);
});

test("state replays, latest quality and sequence handling are independent of arrival order", () => {
  const initial = event("run", -5, 20, "running"), fault = event("fault", 5, 15, "fault", { sequence: "2" });
  const standby = event("standby", 5, 15, "standby", { sequence: "1" });
  const a = aggregateStateTimeline(quarter, [initial, fault, standby, fault]);
  const b = aggregateStateTimeline(quarter, [standby, fault, initial]);
  assert.equal(a.inputFingerprint, b.inputFingerprint); assert.equal(a.endState, "fault");
  assert.equal(a.knownTransitions, 1); assert.equal(a.conflictCount, 0);
  const revoked = aggregateStateTimeline(quarter, [initial, { ...initial, qualityRevision: "2", quality: "pending" }]);
  assert.equal(revoked.durationMilliseconds.unknown, "900000");
});

test("same-time device conflicts become unknown; a gap is not a fault recovery", () => {
  const result = aggregateStateTimeline(quarter, [event("a", 0, 10, "running"), event("b", 0, 10, "fault"), event("c", 12, 15, "running")]);
  assert.equal(result.conflictCount, 1); assert.equal(result.knownTransitions, 0);
  assert.equal(result.durationMilliseconds.unknown, "720000");
  assert.equal(aggregateStateTimeline(quarter, []).endState, "unknown");
  assert.equal(aggregateStateTimeline(quarter, [event("end", 15, 30, "running")]).durationMilliseconds.running, "0");
});

test("state intervals retain before-window context and half-open boundary transitions", () => {
  const rows = [event("before", -5, 20, "running"), event("boundary", 0, 15, "fault")];
  const result = aggregateStateTimeline(quarter, rows);
  assert.equal(result.knownTransitions, 1); assert.equal(result.durationMilliseconds.fault, "900000");
  assert.throws(() => aggregateStateTimeline(quarter, [rows[0], { ...rows[0], state: "fault" }]), /conflicting_replay/);
});

test("gauge sample mean and duration-weighted mean preserve distinct semantics", () => {
  const values = [{ at: time(0), validUntil: time(1), unscaled: "100" }, { at: time(1), validUntil: time(10), unscaled: "200" }];
  const sample = aggregateGauge(quarter, 1, "sample_mean", values);
  assert.deepEqual(sample.mean, { numerator: "300", denominator: "2" }); assert.equal(sample.coveredMilliseconds, null);
  const weighted = aggregateGauge(quarter, 1, "time_weighted", values);
  assert.deepEqual(weighted.mean, { numerator: "114000000", denominator: "600000" });
  assert.equal(weighted.coveredMilliseconds, "600000"); assert.equal(weighted.minimum?.unscaled, "100");
  assert.throws(() => aggregateGauge(quarter, 1, "time_weighted", [{ at: time(0), unscaled: "100" }]), /gauge_duration_required/);
});

test("gauge weighting clips validity, keeps signed precision and refuses overlapping intervals", () => {
  const result = aggregateGauge(quarter, 3, "time_weighted", [{ at: time(-5), validUntil: time(20), unscaled: "-9007199254740993" }]);
  assert.deepEqual(result.mean, { numerator: (-9007199254740993n * 900000n).toString(), denominator: "900000" });
  assert.throws(() => aggregateGauge(quarter, 0, "time_weighted", [{ at: time(0), validUntil: time(10), unscaled: "1" }, { at: time(5), validUntil: time(15), unscaled: "2" }]), /overlapping_gauge_samples/);
  assert.equal(aggregateGauge(quarter, 0, "sample_mean", []).mean, null);
});

test("five-minute evidence merges exactly and equivalent timestamp offsets preserve fingerprints", () => {
  const p = plan(voice, { period: quarter, grain: "15m", nativeGrain: "5m", watermark: time(15) });
  const values = [0, 1, 2].map(i => row(i, String(i + 1), voice, { period: { start: time(i * 5), end: time((i + 1) * 5) } }));
  const result = aggregateIntervals(p, values);
  assert.equal(result.completeness, "complete"); assert.equal(result.expectedWindows, 3);
  assert.deepEqual(result.value, { kind: "integer", value: "6" });
  const offsets = { ...values[0], period: { start: "2026-10-25T00:00:00+08:00", end: "2026-10-25T00:05:00+08:00" } };
  assert.equal(aggregateIntervals(p, [offsets, ...values.slice(1)]).inputFingerprint, result.inputFingerprint);
});

test("state refresh does not count as a transition; expired faults do not become recoveries", () => {
  const refresh = aggregateStateTimeline(quarter, [event("first", -5, 10, "running"), event("refresh", 5, 15, "running")]);
  assert.equal(refresh.knownTransitions, 0); assert.equal(refresh.durationMilliseconds.running, "900000");
  const gap = aggregateStateTimeline(quarter, [event("fault", -5, 5, "fault"), event("return", 10, 15, "running")]);
  assert.equal(gap.knownTransitions, 0); assert.equal(gap.gapTransitions, 2);
  assert.equal(gap.durationMilliseconds.offline, "0"); assert.equal(gap.durationMilliseconds.unknown, "300000");
  const consistent = aggregateStateTimeline(quarter, [event("same-b", 0, 15, "running"), event("same-a", 0, 15, "running")]);
  assert.equal(consistent.conflictCount, 0); assert.equal(consistent.quality, "complete");
});

test("different object semantics and fabricated value fields cannot enter the interval kernel", () => {
  assert.throws(() => aggregateIntervals(plan("runtime.device.state"), []), /unsupported_aggregate_metric/);
  assert.throws(() => aggregateIntervals(plan(), [row(0, "1", voice, { value: { kind: "ratio_parts", numerator: "1", denominator: "2" } })]), /metric_value_mismatch/);
  const bad = row(0, "1"); Object.assign(bad.value, { fabricated: "1" });
  assert.throws(() => aggregateIntervals(plan(), [bad]), /invalid_value_fields/);
  assert.throws(() => aggregateIntervals(plan(), [row(0, "1", voice, { qualityRevision: "0" })]), /invalid_revision/);
  assert.throws(() => aggregateGauge(quarter, 10, "sample_mean", []), /invalid_gauge_policy/);
});

test("effective service windows define coverage rather than the full clock period", () => {
  const active = [row(0, "10").period, row(1, "20").period];
  const result = aggregateIntervals(plan(voice, { applicablePeriods: active, watermark: time(30) }), [row(0, "10"), row(1, "20")]);
  assert.equal(result.expectedWindows, 2); assert.equal(result.expectedMilliseconds, 1800000);
  assert.equal(result.periodMilliseconds, 3600000); assert.equal(result.completeness, "complete");
  assert.deepEqual(result.value, { kind: "integer", value: "30" });
  assert.throws(() => aggregateIntervals(plan(voice, { applicablePeriods: active }), [row(2, "100")]), /unexpected_or_coarse_window/);
  assert.throws(() => aggregateIntervals(plan(voice, { applicablePeriods: [active[0], active[0]] }), []), /invalid_applicability/);
  const inactive = aggregateIntervals(plan(voice, { applicablePeriods: [] }), []);
  assert.equal(inactive.completeness, "not_applicable"); assert.equal(inactive.expectedWindows, 0); assert.equal(inactive.value, null);
});
