import { test } from "node:test";
import assert from "node:assert/strict";
import type { Pool } from "pg";
import { inputRefreshSubscription, planInputRefresh, type InputRefreshPolicy } from "./input-refresh.ts";
import { dispatchInputChange, pendingInputChanges } from "./pg-input-refresh.ts";
import type { AccessPorts } from "../access/resolve.ts";
import type { MeasurementScope } from "../measurements/store.ts";

const up = { code: "service.data.uplink_bytes", version: 1 }, total = { code: "service.data.total_bytes", version: 1 };
const scope: MeasurementScope = { workspaceId: "w", sourceIds: ["s"], stationIds: ["st"], serviceIds: ["svc"], deviceIds: [], allowSiteParameters: false,
  metricKeys: ["service.data.uplink_bytes@1", "service.data.downlink_bytes@1", "service.data.total_bytes@1"] };
const policy: InputRefreshPolicy = { outputs: [up, total], grains: ["day", "week", "month"] };
const impact = { sourceId: "s", mappingId: "a", metric: up, period: { start: "2026-02-01T00:00:00Z", end: "2026-02-01T00:15:00Z" }, mappingEnd: "2027-01-01T00:00:00Z" };
test("input subscriptions bind exact finite scope and output/grain policy, independent of list ordering", () => {
  const first = inputRefreshSubscription(scope, policy);
  assert.equal(first.sha256, inputRefreshSubscription({ ...scope, metricKeys: [...scope.metricKeys].reverse() }, { outputs: [total, up], grains: ["month", "week", "day"] }).sha256);
  for (const next of [{ ...scope, serviceIds: [] }, { ...scope, stationIds: ["other"] }, { ...scope, allowSiteParameters: true }]) assert.notEqual(inputRefreshSubscription(next, policy).sha256, first.sha256);
  assert.notEqual(inputRefreshSubscription(scope, { ...policy, outputs: [up] }).sha256, first.sha256);
  assert.notEqual(inputRefreshSubscription(scope, { ...policy, grains: ["day"] }).sha256, first.sha256);
  for (const next of [{ ...policy, outputs: [] }, { ...policy, outputs: [up, up] }, { ...policy, grains: [] }, { ...policy, grains: ["day", "day"] }, { ...policy, scope: {} }]) assert.throws(() => inputRefreshSubscription(scope, next as InputRefreshPolicy));
  assert.throws(() => inputRefreshSubscription({ ...scope, metricKeys: [] }, policy), /aggregate_scope_denied/);
});
test("input change planning preserves historical old/new windows and reverse dependencies without duplicate jobs", () => {
  const rows = [impact, { ...impact, mappingId: "b", period: { start: "2026-04-01T00:00:00Z", end: "2026-04-01T00:15:00Z" } }];
  const targets = planInputRefresh(rows, policy); assert.equal(targets.length, 12);
  assert.equal(targets.filter(t => t.metric.code === total.code).length, 6);
  assert.deepEqual(planInputRefresh([...rows].reverse().concat(Array(100).fill(impact)), policy), targets);
  assert.ok(targets.some(t => t.grain === "month" && t.at === "2026-01-31T16:00:00.000Z"));
  assert.deepEqual(planInputRefresh(rows, { outputs: [{ code: "runtime.device.state", version: 1 }], grains: ["day"] }), []);
});
test("state impact includes suppression after short expiry and stops at mapping authority", () => {
  const state = { code: "runtime.device.state", version: 1 }, p: InputRefreshPolicy = { outputs: [state], grains: ["day"] };
  const row = { ...impact, metric: state, period: { start: "2026-02-01T15:55:00Z", end: "2026-02-01T15:56:00Z" } };
  const targets = planInputRefresh([row], p); assert.equal(targets.length, 2);
  assert.equal(planInputRefresh([{ ...row, mappingEnd: "2026-02-01T16:00:00Z" }], p).length, 1);
  assert.throws(() => planInputRefresh([{ ...row, mappingEnd: "invalid" }], p), /invalid_input_impact/);
});
test("input history and target bounds fail closed without truncating evidence", () => {
  assert.throws(() => planInputRefresh(Array(1001).fill(impact), policy), /input_history_bound_exceeded/);
  assert.throws(() => planInputRefresh(Array.from({ length: 65 }, (_, i) => ({ ...impact, mappingId: "map" + i })), policy), /refresh_batch_bound_exceeded/);
  assert.throws(() => planInputRefresh([{ ...impact, period: { ...impact.period, end: impact.period.start } }], policy));
});
test("input discovery and dispatch require current data-plane authorization before database access", async () => {
  let calls = 0;
  const pool = { async connect() { calls++; throw Error("unexpected_io"); }, async query() { calls++; throw Error("unexpected_io"); } } as unknown as Pool;
  const ports = { async readVerifiedIdentity() { return null; } } as unknown as AccessPorts;
  await assert.rejects(dispatchInputChange(pool, ports, "change", policy), /identity_required/);
  await assert.rejects(pendingInputChanges(pool, ports, policy), /identity_required/);
  assert.equal(calls, 0);
});
