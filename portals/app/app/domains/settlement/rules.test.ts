import { test } from "node:test";
import assert from "node:assert/strict";
import { rateUsage, type Tariff } from "./lib/rules.ts";
import type { UsageRecord } from "../shared/model.ts";
const r: UsageRecord = { workspaceId: "w", sourceId: "s", sourceEventId: "e", stationId: "st", operator: "telecom", usageType: "voice", unit: "second", quantity: 30n, quality: "verified", periodStart: "2026-10-01T00:00:00+08:00", periodEnd: "2026-10-02T00:00:00+08:00" };
const t: Tariff = { id: "t", version: 1, workspaceId: "w", operator: "telecom", usageType: "voice", unit: "second", quantityPerBlock: 60n, priceFenPerBlock: 1n, effectiveFrom: r.periodStart, effectiveTo: r.periodEnd };
test("exact integer money with half-up rounding and large counters", () => {
  assert.equal(rateUsage(r,t),1n);
  assert.equal(rateUsage({...r,quantity:29n},t),0n);
  assert.equal(rateUsage({...r,quantity:60000000000000000000n},t),1000000000000000000n);
});
test("pending usage, wrong operator and tariff boundaries are rejected", () => {
  assert.throws(() => rateUsage({...r,quality:"pending"},t),/unverified/);
  assert.throws(() => rateUsage({...r,operator:"mobile"},t),/mismatch/);
  assert.throws(() => rateUsage(r,{...t,effectiveTo:r.periodStart}),/period/);
});
