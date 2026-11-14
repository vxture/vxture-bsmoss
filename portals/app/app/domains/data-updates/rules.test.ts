import { test } from "node:test";
import assert from "node:assert/strict";
import { commonThrough, formatDataTime, planDataUpdate, readAvailability, UPDATE_FAMILIES } from "./rules.ts";
import { previewAvailability } from "./preview.ts";
import { businessDemo } from "../../business-analysis/model.ts";
import { registryDemo } from "../site-registry/demo-store.ts";

test("common coverage uses the slowest confirmed source and only a closed hour", () => {
  const data = previewAvailability("overview");
  assert.equal(formatDataTime(commonThrough(data)), "2026-10-26 00:00:00");
  data.sources[0].through = "2026-10-25T13:43:00+08:00";
  assert.equal(formatDataTime(commonThrough(data)), "2026-10-25 13:00:00");
  data.sources[1].confirmed = false;
  assert.equal(commonThrough(data), null);
  data.sources[1].confirmed = true; data.sources[1].through = null;
  assert.equal(commonThrough(data), null);
});
test("no new data never creates an update from sync execution time or host time", () => {
  for (const family of UPDATE_FAMILIES) {
    const a = previewAvailability(family), b = previewAvailability(family);
    b.sources[0].syncedAt = "2030-01-01T14:08:00+08:00";
    assert.equal(planDataUpdate(a, b).state, "current");
    assert.deepEqual(planDataUpdate(a, b).changedSources, []);
    assert.ok(a.sources.every(s => s.syncedAt === null));
  }
});
test("a same-cutoff revision is available even when the shared watermark stays put", () => {
  const a = previewAvailability("overview"), b = structuredClone(a);
  b.sources[1].version += "/revision-2";
  const plan = planDataUpdate(a, b);
  assert.equal(plan.state, "available"); assert.equal(plan.current, plan.latest);
  assert.deepEqual(plan.changedSources, ["calendar"]);
  b.sources[1].through = "2026-11-02T00:00:00+08:00";
  assert.equal(planDataUpdate(a, b).state, "available");
});
test("unknown, changed source topology and individual source regressions fail closed", () => {
  const a = previewAvailability("overview"), b = structuredClone(a);
  b.sources[1].through = "2026-10-30T00:00:00+08:00";
  assert.equal(planDataUpdate(a, b).state, "regressed");
  b.sources[1].through = null;
  assert.equal(planDataUpdate(a, b).state, "unknown");
  b.sources[1].id = "different-source";
  assert.equal(planDataUpdate(a, b).state, "incompatible");
  assert.equal(planDataUpdate(a, previewAvailability("history")).state, "incompatible");
});
test("availability is strict, copied, and time-zone canonical", () => {
  const data = previewAvailability("station"), offset = structuredClone(data);
  offset.sources[0].through = "2026-10-26T00:00:00+08:00";
  assert.equal(planDataUpdate(data, offset).state, "current");
  const copy = readAvailability(data); copy.sources[0].version = "changed";
  assert.notEqual(data.sources[0].version, copy.sources[0].version);
  for (const bad of [{ ...data, workspaceId: "forged" }, { ...data, sources: [] }, { ...data, sources: [...data.sources, ...data.sources] }, { ...data, mode: "live" }]) assert.throws(() => readAvailability(bad));
  for (const through of ["2026-02-30T00:00:00Z", "2026-10-25T24:00:00Z", "2026-10-25", "bad"]) assert.throws(() => readAvailability({ ...data, sources: [{ ...data.sources[0], through }] }));
});
test("analysis hour and period do not masquerade as latest source coverage", () => {
  const morning = registryDemo({ hour: "12", city: "610100" }), evening = registryDemo({ hour: "18", city: "610100" });
  assert.deepEqual(morning.dataUpdate, evening.dataUpdate);
  assert.notEqual(morning.rows[0].current.bytes, evening.rows[0].current.bytes);
  assert.equal(formatDataTime(commonThrough(businessDemo("capacity", { hour: "12" }).dataUpdate)), "2026-10-26 00:00:00");
  assert.equal(formatDataTime(commonThrough(businessDemo("operator-usage", { period: "month" }).dataUpdate)), "2026-11-01 00:00:00");
  assert.equal(formatDataTime(commonThrough(previewAvailability("history"))), "2026-11-01 00:00:00");
});

test("data timestamps retain seconds and Beijing date rollover", () => {
  assert.equal(formatDataTime("2026-10-31T16:00:07Z"), "2026-11-01 00:00:07");
  assert.equal(formatDataTime(null), "\u5f85\u786e\u8ba4");
});
