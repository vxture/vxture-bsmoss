import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeCounterSeries, type CounterPolicy, type CounterReading, type CounterTransitionEvidence } from "./counters.ts";
import { aggregateIntervals, type IntervalInput } from "../aggregation/intervals.ts";

const at = (minute: number) => new Date(Date.parse("2026-10-25T00:00:00+08:00") + minute * 60000).toISOString();
const metric = { code: "runtime.energy.site_wh", version: 1 };
function policy(patch: Partial<CounterPolicy> = {}): CounterPolicy {
  return { workspaceId: "w", sourceId: "source", subjectKey: "station/main-meter", metric,
    version: "policy-v1", capabilityEvidenceRef: "fixture:validated-capability", mappingVersion: "mapping-v1", transformVersion: "transform-v1",
    validFrom: at(0), validTo: at(1440), nativeGrain: "15m", rawUnit: "Wh", canonicalUnit: "Wh",
    conversion: { numerator: "1", denominator: "1" }, modulus: null, maxRawPerSecond: null, ...patch };
}
function reading(minute: number, rawValue: string, patch: Partial<CounterReading> = {}): CounterReading {
  return { workspaceId: "w", sourceId: "source", subjectKey: "station/main-meter", metric,
    eventId: "reading:" + minute, revision: "1", qualityRevision: "1", quality: "verified", at: at(minute), rawValue,
    rawUnit: "Wh", counterEpoch: "meter-installation-v1", payloadSha256: "a".repeat(64), mappingVersion: "mapping-v1", ...patch };
}
const ref = (r: CounterReading) => ({ eventId: r.eventId, revision: r.revision, qualityRevision: r.qualityRevision });
const pair = [reading(0, "10000"), reading(15, "10300")];
const wrapProof = (from: CounterReading, to: CounterReading, count: string): CounterTransitionEvidence =>
  ({ kind: "wraps", count, evidenceRef: "fixture:source-wrap-counter", from: ref(from), to: ref(to) });
const result = (p: Partial<CounterPolicy>, rows: CounterReading[], proofs: CounterTransitionEvidence[] = []) => normalizeCounterSeries(policy(p), rows, proofs).decisions.at(-1)!;

test("A08: the first cumulative read is only a baseline; 10000 to 10300 to 10500 yields 500 Wh", () => {
  const rows = [...pair, reading(30, "10500")];
  const data = normalizeCounterSeries(policy(), rows);
  assert.equal(data.decisions[0].status, "baseline"); assert.equal(data.decisions[0].value, null);
  assert.equal(data.decisions[0].period, null);
  assert.deepEqual(data.decisions.slice(1).map(d => d.value?.value), ["300", "200"]);
  assert.equal(data.decisions.slice(1).reduce((n, d) => n + BigInt(d.value!.value), 0n), 500n);
});

test("a single reading is never full historical usage and an empty source is not zero", () => {
  assert.equal(normalizeCounterSeries(policy(), [reading(15, "999999")]).decisions[0].value, null);
  assert.deepEqual(normalizeCounterSeries(policy(), []).decisions, []);
});

test("A09: an unexplained drop remains pending rather than negative usage or a guessed reset", () => {
  const data = result({}, [reading(0, "10500"), reading(15, "100")]);
  assert.equal(data.status, "pending"); assert.equal(data.value, null); assert.equal(data.rawDelta, null);
  assert.ok(data.reasons.includes("counter_decreased_without_evidence"));
});

test("after an unexplained drop the next verified pair can resume without filling the lost interval", () => {
  const data = normalizeCounterSeries(policy(), [reading(0, "10500"), reading(15, "100"), reading(30, "160")]);
  assert.equal(data.decisions[1].value, null);
  assert.equal(data.decisions[2].value?.value, "60"); assert.deepEqual(data.decisions[2].period, { start: at(15), end: at(30) });
});

test("an exact reset uses the terminal old read and the initial new read, including pre-reset usage", () => {
  const rows = [reading(0, "1000"), reading(15, "100")];
  const proof: CounterTransitionEvidence = { kind: "resets", evidenceRef: "fixture:reset-log", from: ref(rows[0]), to: ref(rows[1]),
    resets: [{ at: at(5), terminalRaw: "1100", initialRaw: "0" }] };
  const data = result({}, rows, [proof]);
  assert.equal(data.status, "eligible"); assert.equal(data.value?.value, "200");
  assert.equal(data.evidenceRef, proof.evidenceRef);
});

test("multiple explicit resets add each segment without losing the intermediate usage", () => {
  const rows = [reading(0, "1000"), reading(15, "20")];
  const proof: CounterTransitionEvidence = { kind: "resets", evidenceRef: "fixture:two-resets", from: ref(rows[0]), to: ref(rows[1]), resets: [
    { at: at(5), terminalRaw: "1100", initialRaw: "10" }, { at: at(10), terminalRaw: "60", initialRaw: "0" },
  ] };
  assert.equal(result({}, rows, [proof]).value?.value, "170");
});

test("reset evidence with out-of-window, unordered or impossible values cannot produce eligible usage", () => {
  const rows = [reading(0, "1000"), reading(15, "100")];
  for (const resets of [
    [{ at: at(0), terminalRaw: "1100", initialRaw: "0" }],
    [{ at: at(16), terminalRaw: "1100", initialRaw: "0" }],
    [{ at: at(5), terminalRaw: "900", initialRaw: "0" }],
    [{ at: at(5), terminalRaw: "1100", initialRaw: "200" }],
    [{ at: at(10), terminalRaw: "1100", initialRaw: "0" }, { at: at(5), terminalRaw: "10", initialRaw: "0" }],
  ]) {
    const proof: CounterTransitionEvidence = { kind: "resets", evidenceRef: "fixture:bad-reset", from: ref(rows[0]), to: ref(rows[1]), resets };
    assert.equal(result({}, rows, [proof]).status, "pending");
  }
});

test("counter replacement and mapping change are explicit barriers, even with reset evidence", () => {
  for (const patch of [{ counterEpoch: "new-installation" }, { mappingVersion: "mapping-v2" }]) {
    const rows = [pair[0], { ...pair[1], ...patch }];
    const data = result({}, rows); assert.equal(data.status, "pending"); assert.equal(data.value, null);
  }
});

test("declared modulus plus a pinned wrap count computes exact single and multiple wraps", () => {
  const rows = [reading(0, "990"), reading(15, "20")];
  assert.equal(result({ modulus: "1000" }, rows, [wrapProof(...rows as [CounterReading, CounterReading], "1")]).value?.value, "30");
  assert.equal(result({ modulus: "1000" }, rows, [wrapProof(...rows as [CounterReading, CounterReading], "2")]).value?.value, "1030");
  assert.equal(result({ modulus: "1000" }, rows).status, "pending");
  assert.equal(result({}, rows, [wrapProof(...rows as [CounterReading, CounterReading], "1")]).status, "pending");
});

test("a rising modular read may conceal a wrap: require an explicit count or an unambiguous physical bound", () => {
  const rows = [reading(0, "10"), reading(15, "20")];
  assert.ok(result({ modulus: "1000" }, rows).reasons.includes("wrap_count_ambiguous"));
  assert.equal(result({ modulus: "1000", maxRawPerSecond: "1" }, rows).value?.value, "10");
  assert.equal(result({ modulus: "1000", maxRawPerSecond: "2" }, rows).status, "pending");
  assert.equal(result({ modulus: "1000" }, rows, [wrapProof(...rows as [CounterReading, CounterReading], "0")]).value?.value, "10");
});

test("physical upper bounds apply to ordinary, wrap and reset segments using exact milliseconds", () => {
  assert.equal(result({ maxRawPerSecond: "0" }, pair).status, "pending");
  assert.equal(result({ maxRawPerSecond: "1" }, [reading(0, "0"), reading(15, "900")]).value?.value, "900");
  assert.ok(result({ maxRawPerSecond: "1" }, [reading(0, "0"), reading(15, "901")]).reasons.includes("counter_rate_exceeded"));
  const rows = [reading(0, "990"), reading(15, "20")];
  assert.equal(result({ modulus: "1000", maxRawPerSecond: "1" }, rows, [wrapProof(...rows as [CounterReading, CounterReading], "2")]).status, "pending");
  const reset: CounterTransitionEvidence = { kind: "resets", evidenceRef: "fixture:fast-reset", from: ref(pair[0]), to: ref(pair[1]),
    resets: [{ at: at(1), terminalRaw: "20000", initialRaw: "10000" }] };
  assert.ok(result({ maxRawPerSecond: "1" }, pair, [reset]).reasons.includes("counter_rate_exceeded"));
});

test("conversion uses integer rational factors without floating point or rounding", () => {
  assert.equal(result({ rawUnit: "kWh", conversion: { numerator: "1000", denominator: "1" } }, pair.map(r => ({ ...r, rawUnit: "kWh" }))).value?.value, "300000");
  assert.equal(result({ rawUnit: "mWh", conversion: { numerator: "1", denominator: "1000" } }, [reading(0, "0", { rawUnit: "mWh" }), reading(15, "2000", { rawUnit: "mWh" })]).value?.value, "2");
  const fractional = result({ conversion: { numerator: "1", denominator: "1000" } }, pair);
  assert.equal(fractional.status, "pending"); assert.equal(fractional.value, null);
  assert.ok(fractional.reasons.includes("fractional_canonical_counter"));
});

test("30-digit precision and canonical overflow are handled without number coercion", () => {
  const max = "9".repeat(30);
  assert.equal(result({}, [reading(0, "0"), reading(15, max)]).value?.value, max);
  const overflow = result({ conversion: { numerator: "2", denominator: "1" } }, [reading(0, "0"), reading(15, max)]);
  assert.equal(overflow.status, "pending"); assert.ok(overflow.reasons.includes("canonical_counter_overflow"));
  assert.throws(() => result({}, [reading(0, "-1")]), /invalid_integer/);
  assert.throws(() => result({}, [reading(0, "1" + "0".repeat(30))]), /invalid_integer/);
});

test("native reading gaps are retained as pending intervals rather than split or filled", () => {
  const gap = result({}, [reading(0, "100"), reading(30, "300")]);
  assert.equal(gap.status, "pending"); assert.deepEqual(gap.period, { start: at(0), end: at(30) });
  assert.equal(gap.value, null); assert.ok(gap.reasons.includes("native_window_gap_or_misalignment"));
  assert.equal(result({ nativeGrain: "hour" }, [reading(0, "100"), reading(60, "300")]).value?.value, "200");
  assert.equal(result({}, [reading(1, "100"), reading(16, "300")]).status, "pending");
});

test("capability validity is checked across the whole measurement period", () => {
  assert.equal(result({ validFrom: at(1) }, pair).status, "pending");
  assert.equal(result({ validTo: at(14) }, pair).status, "pending");
  assert.equal(result({ validTo: at(15) }, pair).status, "eligible");
});

test("replays, revisions, equivalent timestamps and arrival order are deterministic", () => {
  const corrected = { ...pair[1], revision: "2", rawValue: "10400", payloadSha256: "b".repeat(64) };
  const first = normalizeCounterSeries(policy(), [pair[0], pair[1], corrected, pair[0]]);
  const second = normalizeCounterSeries(policy(), [corrected, { ...pair[0], at: "2026-10-25T00:00:00+08:00" }, pair[1]]);
  assert.equal(first.inputFingerprint, second.inputFingerprint); assert.equal(first.decisions.length, 2);
  assert.equal(first.decisions[1].value?.value, "400"); assert.equal(first.decisions[1].to.revision, "2");
  assert.notEqual(first.inputFingerprint, normalizeCounterSeries(policy({ version: "policy-v2" }), [pair[0], corrected]).inputFingerprint);
});

test("latest pending measurement or rejected quality never falls back to old verified reads", () => {
  const pending = { ...pair[1], revision: "2", quality: "pending" as const };
  assert.equal(result({}, [pair[0], pair[1], pending]).status, "pending");
  const rejected = { ...pair[1], qualityRevision: "2", quality: "rejected" as const };
  assert.equal(result({}, [pair[0], pair[1], rejected]).status, "pending");
  const previousRejected = { ...pair[0], qualityRevision: "2", quality: "rejected" as const };
  assert.equal(result({}, [...pair, previousRejected]).status, "pending");
});

test("conflicting raw payloads or historical quality versions cannot hide behind a newer decision", () => {
  assert.throws(() => result({}, [pair[0], { ...pair[0], rawValue: "10001" }]), /conflicting_counter_replay/);
  assert.throws(() => result({}, [pair[0], { ...pair[0], qualityRevision: "2" }, { ...pair[0], quality: "rejected" }]), /conflicting_counter_replay/);
  assert.throws(() => result({}, [pair[0], { ...pair[0], eventId: "different-event" }]), /counter_timestamp_conflict/);
});

test("proofs are pinned to both measurement and quality revisions and cannot silently survive corrections", () => {
  const rows = [reading(0, "990"), reading(15, "20")], proof = wrapProof(rows[0], rows[1], "1");
  for (const patch of [{ revision: "2" }, { qualityRevision: "2" }]) {
    const data = result({ modulus: "1000" }, [rows[0], { ...rows[1], ...patch }], [proof]);
    assert.ok(data.reasons.includes("stale_transition_evidence")); assert.equal(data.value, null);
  }
  assert.throws(() => result({ modulus: "1000" }, rows, [proof, { ...proof, count: "2" } as CounterTransitionEvidence]), /conflicting_transition_evidence/);
  assert.throws(() => result({ modulus: "1000" }, [...rows, reading(5, "995")], [proof]), /orphan_transition_evidence/);
});

test("scope, units, metric semantics, modulus and invalid configuration fail explicitly", () => {
  for (const patch of [{ workspaceId: "other" }, { sourceId: "other" }, { subjectKey: "other" }, { metric: { ...metric, version: 2 } }]) assert.throws(() => result({}, [reading(0, "0", patch)]), /counter_scope_mismatch/);
  assert.throws(() => result({}, [reading(0, "0", { rawUnit: "byte" })]), /counter_unit_mismatch/);
  assert.throws(() => result({ metric: { code: "status.voice.connection_rate", version: 1 } }, []), /invalid_counter_metric/);
  assert.throws(() => result({ conversion: { numerator: "1", denominator: "0" } }, []), /invalid_counter_positive/);
  assert.throws(() => result({ modulus: "1000" }, [reading(0, "1000")]), /counter_out_of_range/);
  assert.throws(() => result({ validTo: at(0) }, []), /invalid_counter_validity/);
});

test("constant reads yield real zero, and a corrected middle read changes both adjacent periods", () => {
  assert.equal(result({}, [reading(0, "100"), reading(15, "100")]).value?.value, "0");
  const initial = [reading(0, "100"), reading(15, "200"), reading(30, "300")];
  const before = normalizeCounterSeries(policy(), initial);
  const after = normalizeCounterSeries(policy(), [...initial, { ...initial[1], revision: "2", rawValue: "250" }]);
  assert.deepEqual(after.decisions.slice(1).map(d => d.value?.value), ["150", "50"]);
  assert.notEqual(before.decisions[1].inputFingerprint, after.decisions[1].inputFingerprint);
  assert.notEqual(before.decisions[2].inputFingerprint, after.decisions[2].inputFingerprint);
});

test("validated fixture normalization feeds interval aggregation without counting baselines or pending intervals", () => {
  const normalized = normalizeCounterSeries(policy(), [reading(0, "10000"), reading(15, "10300"), reading(30, "10500"), reading(45, "100"), reading(60, "150")]);
  // Test-only approval fixture: a production service must persist its own quality decision.
  const inputs: IntervalInput[] = normalized.decisions.filter(d => d.status === "eligible").map(d => ({
    workspaceId: "w", sourceId: "source", subjectKey: "station/main-meter", metric,
    eventId: d.inputFingerprint, componentKey: "counter-delta", revision: "1", qualityRevision: "1", quality: "verified",
    payloadSha256: d.inputFingerprint, mappingVersion: "mapping-v1", transformVersion: "transform-v1",
    period: d.period!, value: d.value!,
  }));
  const total = aggregateIntervals({ workspaceId: "w", sourceId: "source", subjectKey: "station/main-meter", authorityVersion: "fixture-authority",
    metric, inputMode: "direct", period: { start: at(0), end: at(60) }, grain: "hour", nativeGrain: "15m", watermark: at(60), sourceComplete: true }, inputs);
  assert.deepEqual(total.value, { kind: "integer", value: "550" });
  assert.equal(total.validWindows, 3); assert.equal(total.expectedWindows, 4); assert.equal(total.completeness, "partial");
});

test("a reset at the endpoint includes old usage and requires an exact new baseline at that instant", () => {
  const rows = [reading(0, "1000"), reading(15, "10")];
  const proof: CounterTransitionEvidence = { kind: "resets", evidenceRef: "fixture:endpoint-reset", from: ref(rows[0]), to: ref(rows[1]),
    resets: [{ at: at(15), terminalRaw: "1100", initialRaw: "10" }] };
  assert.equal(result({}, rows, [proof]).value?.value, "100");
  const mismatch: CounterTransitionEvidence = { ...proof, resets: [{ at: at(15), terminalRaw: "1100", initialRaw: "0" }] };
  const data = result({}, rows, [mismatch]);
  assert.equal(data.status, "pending"); assert.ok(data.reasons.includes("instantaneous_counter_change"));
});

test("voice, traffic and SMS retain their independent canonical dimensions", () => {
  for (const [code, unit] of [["service.voice.connected_seconds", "second"], ["service.data.uplink_bytes", "byte"], ["service.sms.success_count", "count"]] as const) {
    const metricRef = { code, version: 1 };
    const data = normalizeCounterSeries(policy({ metric: metricRef, rawUnit: unit, canonicalUnit: unit }), pair.map(r => ({ ...r, metric: metricRef, rawUnit: unit })));
    assert.equal(data.canonicalUnit, unit); assert.equal(data.decisions[1].value?.value, "300");
  }
  assert.throws(() => normalizeCounterSeries(policy({ canonicalUnit: "byte" }), []), /invalid_counter_metric/);
});

test("middle-read quality revocation invalidates both adjacent deltas without changing source evidence", () => {
  const rows = [reading(0, "100"), reading(15, "200"), reading(30, "300")];
  const snapshot = structuredClone(rows);
  const revoked = normalizeCounterSeries(policy(), [...rows, { ...rows[1], qualityRevision: "2", quality: "rejected" }]);
  assert.deepEqual(revoked.decisions.slice(1).map(d => d.status), ["pending", "pending"]);
  assert.deepEqual(rows, snapshot);
  assert.equal(revoked.decisions[1].to.qualityRevision, "2");
  assert.equal(revoked.decisions[2].from?.qualityRevision, "2");
});

test("deterministic sweep preserves telescoping sums and exposes every removed native reading", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const rows: CounterReading[] = [reading(0, String(1000 + seed))];
    let counter = BigInt(rows[0].rawValue), sum = 0n;
    for (let i = 1; i <= 12; i++) {
      const delta = BigInt((seed * 31 + i * 17) % 300); sum += delta; counter += delta;
      rows.push(reading(i * 15, counter.toString()));
    }
    const data = normalizeCounterSeries(policy(), [...rows].reverse().concat(rows[3]));
    assert.equal(data.decisions.filter(d => d.status === "eligible").reduce((n, d) => n + BigInt(d.value!.value), 0n), sum);
    const gap = normalizeCounterSeries(policy(), rows.filter((_, i) => i !== 4));
    assert.equal(gap.decisions.filter(d => d.status === "pending").length, 1);
    assert.equal(gap.decisions.find(d => d.status === "pending")!.value, null);
  }
});
