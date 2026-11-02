import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPreview, DEFAULT_REQUEST } from "./model.ts";

test("three sample categories resolve against the versioned catalog without activating sources", () => {
  for (const category of [
    "business_service",
    "operational_status",
    "runtime_parameter",
  ] as const) {
    const result = buildPreview({ ...DEFAULT_REQUEST, category });
    assert.equal(result.mode, "sample");
    assert.equal(result.stationCount, 6);
    assert.ok(result.cards.length > 0);
    assert.ok(result.cards.every((c) => c.category === category));
    assert.equal(result.templateVersion, 1);
  }
});
test("source gaps remain null in total-traffic trend and valid partial totals are labeled", () => {
  const result = buildPreview(DEFAULT_REQUEST);
  const total = result.cards.find(
    (c) => c.code === "service.data.total_bytes",
  )!;
  assert.equal(total.partial, true);
  assert.equal(total.validWindows, 143);
  assert.equal(total.expectedWindows, 144);
  assert.equal(total.series[10].value, null);
  assert.equal(result.quality.valid, 143);
  const sms = result.cards.find((c) => c.code === "service.sms.success_count")!;
  assert.equal(sms.status, "not_connected");
  assert.equal(sms.value, null);
});
test("city and operator filters constrain the same trend and evidence population", () => {
  const one = buildPreview({
    ...DEFAULT_REQUEST,
    city: "xian",
    operator: "mobile",
  });
  assert.equal(one.stationCount, 1);
  assert.equal(one.cards[0].evidence.length, 1);
  assert.equal(one.cards[0].evidence[0].stationId, "SX-DEMO-001");
  const none = buildPreview({
    ...DEFAULT_REQUEST,
    city: "baoji",
    operator: "telecom",
  });
  assert.equal(none.stationCount, 0);
  assert.ok(
    none.cards
      .filter((c) => !c.code.includes("sms"))
      .every((c) => c.status === "empty"),
  );
  assert.equal(none.cards[0].value, null);
});
test("shared energy and equipment are never allocated through an operator selector", () => {
  const result = buildPreview({
    ...DEFAULT_REQUEST,
    category: "runtime_parameter",
    operator: "mobile",
  });
  assert.ok(
    result.cards.every(
      (c) =>
        c.status === "not_applicable" &&
        c.value === null &&
        c.states.length === 0,
    ),
  );
});
test("display preferences change presentation while preserving source granularity and values", () => {
  const id = "service.data.uplink_bytes";
  const before = buildPreview(DEFAULT_REQUEST).cards.find((c) => c.id === id)!;
  const after = buildPreview({
    ...DEFAULT_REQUEST,
    preferences: [{ id, displayUnit: "GB", order: -1 }],
  }).cards[0];
  assert.equal(after.id, id);
  assert.equal(after.value, before.value);
  assert.notEqual(after.formatted, before.formatted);
  const fine = buildPreview({
    ...DEFAULT_REQUEST,
    preferences: [{ id, grain: "15m" }],
  }).cards.find((c) => c.id === id)!;
  assert.equal(fine.status, "not_connected");
  assert.equal(fine.value, null);
  assert.equal(fine.series.length, 0);
  const hidden = buildPreview({
    ...DEFAULT_REQUEST,
    preferences: [{ id, visible: false }],
  });
  assert.ok(!hidden.cards.some((c) => c.id === id));
});
test("request cannot supply authorization or invalid template preferences", () => {
  assert.throws(
    () => buildPreview({ ...DEFAULT_REQUEST, allowedMetricKeys: ["*"] }),
    /unknown_field/,
  );
  assert.throws(
    () => buildPreview({ ...DEFAULT_REQUEST, city: "__proto__" }),
    /invalid_filter/,
  );
  assert.throws(
    () => buildPreview({ ...DEFAULT_REQUEST, preferences: [null] }),
    /invalid_preference/,
  );
  assert.throws(
    () =>
      buildPreview({
        ...DEFAULT_REQUEST,
        preferences: [{ id: "service.data.uplink_bytes", displayUnit: "kWh" }],
      }),
    /unsupported_unit/,
  );
});
