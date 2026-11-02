import { test } from "node:test";
import assert from "node:assert/strict";
import { authorityChange, authoritySubject, planAuthorityImpact, type AuthorityCandidate, type AuthorityObject } from "./authority-impact.ts";
import type { MeasurementScope } from "../measurements/store.ts";

const up = { code: "service.data.uplink_bytes", version: 1 }, total = { code: "service.data.total_bytes", version: 1 }, state = { code: "runtime.device.state", version: 1 };
const o: AuthorityObject = { sourceId: "src", mappingId: "map", stationId: "st", serviceId: "svc", networkObjectId: "cell", deviceId: null };
const scope: MeasurementScope = { workspaceId: "w", sourceIds: ["src"], stationIds: ["st"], serviceIds: ["svc"], deviceIds: ["dev"], metricKeys: [up.code + "@1", total.code + "@1"], allowSiteParameters: false };
const start = "2026-06-01T16:00:00.000Z", end = "2026-06-02T16:00:00.000Z", period = { start, end };
const snap = { workspace_id: "w", id: "cap", source_id: "src", metric_code: up.code, metric_version: "1", valid_from: start, valid_to: end };
const raw = { workspace_id: "w", id: "change", entity_kind: "source_capability", entity_id: "cap", revision: "2", operation: "update", before_snapshot: snap, after_snapshot: { ...snap, status: "retired" }, evidence_sha256: "a".repeat(64) };
const change = authorityChange(raw, scope), policy = { outputs: [up, total], grains: ["day" as const] };
test("authority parsing requires both snapshots in current scope and preserves stable identity", () => {
  assert.equal(change.snapshots.length, 2); assert.equal(authoritySubject(o), '["mapped-object-v1","st","svc","cell",null]');
  for (const patch of [{ sourceIds: [] }, { metricKeys: [] }, { workspaceId: "other" }]) assert.throws(() => authorityChange(raw, { ...scope, ...patch }));
  assert.throws(() => authorityChange({ ...raw, after_snapshot: { ...snap, source_id: "other" } }, { ...scope, sourceIds: ["src", "other"] }), /authority_object_immutable/);
  const m = { ...snap, id: "map", ...{ station_id: "st", service_id: "svc", device_id: null, network_object_id: "cell" } };
  assert.throws(() => authorityChange({ ...raw, entity_kind: "source_mapping", entity_id: "map", before_snapshot: m, after_snapshot: { ...m, station_id: "other" } }, scope), /object_scope_denied/);
});
test("authority impact combines fact windows and exact published periods and retains publication references", () => {
  const published: AuthorityCandidate = { object: o, metric: up, grain: "day", period, published: { seriesId: "series", revision: "9", inputFingerprint: "f".repeat(64) } };
  const facts = [{ mappingId: "map", metric: up, period }];
  const results = planAuthorityImpact(change, [o], [...facts, ...facts], [published], policy);
  assert.equal(results.length, 2); assert.equal(results.find(r => r.metric.code === up.code)!.published!.revision, "9");
  assert.equal(results.find(r => r.metric.code === total.code)!.published, undefined);
  assert.deepEqual(planAuthorityImpact(change, [o], [...facts].reverse(), [published], policy), results);
});
test("authority validity changes cover old and new periods without inventing empty historical calendars", () => {
  const previous = { ...snap, valid_from: "2026-05-01T16:00:00Z", valid_to: "2026-05-02T16:00:00Z" }, c = authorityChange({ ...raw, before_snapshot: previous }, scope);
  const facts = [{ mappingId: "map", metric: up, period: { start: previous.valid_from, end: previous.valid_to } }, { mappingId: "map", metric: up, period }];
  assert.equal(planAuthorityImpact(c, [o], facts, [], { outputs: [up], grains: ["day"] }).length, 2);
  assert.equal(planAuthorityImpact(c, [o], [], [], policy).length, 0);
  assert.throws(() => planAuthorityImpact(c, [o], [{ ...facts[0]!, mappingId: "foreign" }], [], policy), /invalid_authority_impact/);
});
test("authority state impacts include expired blocker hold and bounds reject overflow without truncating", () => {
  const physical = { ...o, serviceId: null, networkObjectId: null, deviceId: "dev" }, s = { ...snap, metric_code: state.code };
  const c = authorityChange({ ...raw, before_snapshot: s, after_snapshot: { ...s, status: "retired" } }, { ...scope, metricKeys: [state.code + "@1"] });
  const result = planAuthorityImpact(c, [physical], [{ mappingId: "map", metric: state, period: { start: "2026-06-01T15:59:00Z", end: "2026-06-01T15:59:01Z" } }], [], { outputs: [state], grains: ["day"] });
  assert.equal(result.length, 1); assert.deepEqual(result[0]!.period, period);
  assert.throws(() => planAuthorityImpact(c, Array(1001).fill(physical), [], [], { outputs: [state], grains: ["day"] }), /authority_bound_exceeded/);
});
