import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregateObjectRollup, normalizeRollupConfig, atomKey, type RollupConfig, type RollupObservation } from "./object-rollup.ts";
import { aggregateStatePeriod, type StatePlan } from "./state-period.ts";
import { aggregateGaugePeriod, type GaugePlan } from "./gauge-period.ts";
import { reportDistributionRows, reportValueText } from "../reports/display.ts";
import type { ReportData } from "../reports/rules.ts";

const authority = "a".repeat(64), period = { start: "2026-10-24T16:00:00.000Z", end: "2026-10-24T17:00:00.000Z" };
const mappingPeriods = [{ mappingId: "map", mappingVersion: "1", period }];
function config(gauge = false): RollupConfig {
  const atoms = ["one", "two", "three"].map(deviceId => ({ stationId: "station", serviceId: null, networkObjectId: null, deviceId }));
  return { status: "active", metric: { code: gauge ? "runtime.environment.temperature_c" : "runtime.device.state", version: 1 }, validPeriod: period,
    basis: gauge ? { kind: "device_mean_bins", ref: "fixture://thresholds", scale: 3, mode: "sample_mean", thresholds: ["0", "30000"] } : null,
    atoms, members: atoms.slice(0, 2).map((a, i) => ({ id: String(i), sourceId: "source", mappingId: "map-" + i, authorityVersion: authority, atomKeys: [atomKey(a)], coverageRef: "fixture://population" })) };
}
function observation(c: RollupConfig, i: number, text = "25345"): RollupObservation {
  const common = { workspaceId: "w", sourceId: "source", subjectKey: c.atoms[i]!.deviceId!, authorityVersion: authority, metric: c.metric,
    grain: "hour" as const, period, mappingPeriods, sourceComplete: false, watermark: period.start };
  const evidence = { workspaceId: "w", sourceId: "source", subjectKey: common.subjectKey, metric: c.metric, eventId: "event", componentKey: "value", revision: "1", qualityRevision: "1",
    quality: "verified" as const, payloadSha256: authority, mappingId: "map", mappingVersion: "1", transformVersion: "v1" };
  const result = c.basis?.kind === "device_mean_bins"
    ? aggregateGaugePeriod({ ...common, semantic: "gauge", nativeGrain: "hour", policy: { version: 1, authorityRef: "fixture://gauge", mode: "sample_mean", scale: 3 } } as GaugePlan,
      [{ ...evidence, period, unscaled: text, scale: 3 }])
    : aggregateStatePeriod({ ...common, semantic: "state", nativeGrain: "event", maxHoldMilliseconds: 3600000 } as StatePlan,
      [{ ...evidence, at: period.start, validUntil: i === 0 ? period.end : "2026-10-24T16:30:00.000Z", state: i === 0 ? "running" : "fault" }]);
  return { memberId: String(i), currentAuthorityVersion: authority, unavailable: false, publication: { seriesId: "series-" + i, revision: "1", currentRevision: "1",
    publishedBy: "worker", createdAt: period.end, selection: "current", freshness: "current", currentInputFingerprint: result.inputFingerprint, reasons: [], result } };
}
function read(c: RollupConfig, obs = c.members.map((_, i) => observation(c, i))) {
  const r = aggregateObjectRollup(c, "hour", period.start, obs); assert.ok("distribution" in r); return r;
}
test("device states conserve device-time and expected population while preserving unknown gaps", () => {
  const c = config(), r = read(c); assert.equal(r.value, null); assert.equal(r.knownValue, null); assert.equal(r.completeness, "partial");
  assert.equal(r.distribution.kind, "device_states"); if (r.distribution.kind !== "device_states") return;
  assert.deepEqual(r.distribution.endCounts, { running: "1", standby: "0", fault: "0", offline: "0", maintenance: "0", unknown: "2" });
  assert.equal(r.distribution.deviceMilliseconds.fault, "1800000"); assert.equal(r.distribution.deviceMilliseconds.unknown, "5400000");
  assert.equal(Object.values(r.distribution.deviceMilliseconds).reduce((n, v) => n + BigInt(v), 0n).toString(), r.distribution.expectedDeviceMilliseconds);
  assert.equal(r.distribution.expectedDeviceMilliseconds, "10800000"); assert.equal(r.physicalStationCount, 1); assert.equal(r.serviceCount, 0);
});
test("reviewed devices cannot be double-counted through alternative sources, multiple atoms or operator attribution", () => {
  const c = config();
  for (const bad of [{ ...c, atoms: [...c.atoms, { ...c.atoms[0]!, stationId: "other" }] },
    { ...c, members: [...c.members, { ...c.members[0]!, id: "alt", sourceId: "alternative" }] },
    { ...c, members: [{ ...c.members[0]!, atomKeys: c.atoms.map(atomKey) }] },
    { ...c, atoms: [{ ...c.atoms[0]!, serviceId: "operator-service" }] }]) assert.throws(() => normalizeRollupConfig(bad));
  assert.throws(() => normalizeRollupConfig({ ...c, atoms: c.atoms.map(({ deviceId, ...a }) => a) }));
  assert.throws(() => read(c, []), /observation_mismatch/);
});
test("stale and re-reviewed devices become unknown without borrowing their historical states or means", () => {
  for (const gauge of [false, true]) {
    const c = config(gauge), a = observation(c, 0), b = observation(c, 1);
    a.publication!.freshness = "stale"; let r = read(c, [a, b]); assert.equal(r.freshness, "stale"); assert.equal(r.watermark, period.start); assert.equal(r.coverage.knownMembers, 1);
    if (r.distribution.kind === "device_states") assert.equal(r.distribution.endCounts.running, "0"); else assert.equal(r.distribution.unknownDevices, "2");
    a.publication!.freshness = "current"; a.currentAuthorityVersion = "b".repeat(64); r = read(c, [a, b]); assert.equal(r.members[0]!.deviceValue, null);
    const empty = read({ ...c, members: [] }, []); assert.equal(empty.completeness, "missing"); assert.equal(empty.value, null);
  }
});
test("temperature bins compare exact signed fractions, use inclusive lower bounds and never average sensors", () => {
  const c = config(true), a = observation(c, 0, "-1"), b = observation(c, 1, "30000");
  const v = a.publication!.result.value; assert.ok(v?.kind === "gauge"); v.mean.denominator = "90071992547409931234567890";
  const r = read(c, [a, b]); assert.equal(r.distribution.kind, "device_mean_bins"); if (r.distribution.kind !== "device_mean_bins") return;
  assert.deepEqual(r.distribution.bins.map(b => b.deviceCount), ["1", "0", "1"]); assert.equal(r.distribution.unknownDevices, "1");
  assert.equal(r.value, null); assert.equal(r.ratioParts, null); assert.equal(r.completeness, "partial");
  const lower = read(c, [observation(c, 0, "0"), observation(c, 1, "29999")]);
  assert.ok(lower.distribution.kind === "device_mean_bins"); assert.deepEqual(lower.distribution.bins.map(b => b.deviceCount), ["0", "2", "0"]);
  const huge = observation(c, 0), hugeValue = huge.publication!.result.value; assert.ok(hugeValue?.kind === "gauge");
  hugeValue.mean = { numerator: "900719925474099312345678901234567890", denominator: "1000000" };
  assert.doesNotThrow(() => read(c, [huge, b]));
});
test("temperature distribution requires reviewed thresholds and one consistent device mean policy", () => {
  const c = config(true); assert.ok(c.basis?.kind === "device_mean_bins");
  const basis = c.basis;
  for (const thresholds of [[], ["0", "0"], ["10", "-1"], ["1.5"], ["1e3"]]) assert.throws(() => normalizeRollupConfig({ ...c, basis: { ...basis, thresholds } }));
  assert.throws(() => normalizeRollupConfig({ ...c, basis: null }), /basis_required/);
  const a = observation(c, 0), v = a.publication!.result.value; assert.ok(v?.kind === "gauge"); v.mode = "time_weighted";
  assert.throws(() => read(c, [a, observation(c, 1)]), /basis_mismatch/);
  v.mode = "sample_mean"; v.mean.denominator = "0"; assert.throws(() => read(c, [a, observation(c, 1)]), /invalid_rollup_device_mean/);
});
test("device distributions retain preliminary completeness, immutable fingerprints and fail on mixed publications", () => {
  const c = config(true), obs = c.members.map((_, i) => observation(c, i)), r = read({ ...c, atoms: c.atoms.slice(0, 2) }, obs);
  assert.equal(r.completeness, "preliminary"); assert.equal(r.fingerprint, read({ ...c, atoms: c.atoms.slice(0, 2), members: [...c.members].reverse() }, [...obs].reverse()).fingerprint);
  const { fingerprint, ...body } = r; assert.equal(fingerprint.length, 64); assert.equal(JSON.stringify(body).includes("device_mean_bins"), true);
  obs[0]!.publication!.result.period.end = "2026-10-24T18:00:00.000Z"; assert.throws(() => read(c, obs), /publication_mismatch/);
});
test("display exposes distribution units and exact thresholds instead of an invented scalar temperature", () => {
  for (const gauge of [false, true]) {
    const c = config(gauge), result = read(c), data = { kind: "rollup", result } as ReportData;
    const rows = reportDistributionRows(data, gauge ? "degC" : "second", 2)!; assert.ok(rows.rows.length >= 4);
    const text = reportValueText(data, gauge ? "degC" : "device_count", 2);
    assert.ok(!text.includes("\u65e0\u53ef\u7528\u503c")); assert.ok(text.includes("\u672a\u77e5"));
    if (gauge) assert.ok(text.includes("[0.000, 30.000) degC")); else assert.ok(rows.rows.some(r => r.value === "3600.00 \u8bbe\u5907\u79d2"));
  }
});
