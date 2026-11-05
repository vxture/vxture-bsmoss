import { test } from "node:test";
import assert from "node:assert/strict";
import { DEMO_REGION } from "../domains/map-demo/resources";
import { normalizeRegion, regionLabel, regionOptions } from "./region-selection";

test("region paths represent province, city and county without redundant all-level labels", () => {
  assert.equal(regionLabel(DEMO_REGION, { cityId: "all", countyId: "all" }), "\u9655\u897f\u7701");
  assert.equal(regionLabel(DEMO_REGION, { cityId: "610100", countyId: "all" }), "\u9655\u897f\u7701\u00b7\u897f\u5b89\u5e02");
  assert.equal(regionLabel(DEMO_REGION, { cityId: "610100", countyId: "610113" }), "\u9655\u897f\u7701\u00b7\u897f\u5b89\u5e02\u00b7\u96c1\u5854\u533a");
});
test("invalid and mismatched children cannot leak across parents", () => {
  assert.deepEqual(normalizeRegion(DEMO_REGION, { cityId: "610300", countyId: "610113" }), { cityId: "610300", countyId: "all" });
  assert.deepEqual(normalizeRegion(DEMO_REGION, { cityId: "110100", countyId: "610113" }), { cityId: "all", countyId: "all" });
  assert.deepEqual(normalizeRegion(DEMO_REGION, { cityId: "all", countyId: "610113" }), { cityId: "all", countyId: "all" });
});
test("search finds names, full paths and codes with distinguishable parent paths", () => {
  for (const term of ["\u96c1\u5854", "610113", "\u9655\u897f\u7701\u00b7\u897f\u5b89\u5e02\u00b7\u96c1\u5854\u533a", "\u897f\u5b89 / \u96c1\u5854"]) {
    const result = regionOptions(DEMO_REGION, term);
    assert.equal(result.length, 1);
    assert.equal(result[0].cityId, "610100");
    assert.equal(result[0].countyId, "610113");
  }
  assert.equal(regionOptions(DEMO_REGION, "\u4e0d\u5b58\u5728\u7684\u533a\u57df").length, 0);
  const matching = regionOptions(DEMO_REGION, "\u957f\u5b89");
  assert.ok(matching.every(item => item.label.includes("\u897f\u5b89\u5e02")));
  assert.equal(new Set(regionOptions(DEMO_REGION, "").map(item => item.cityId + ":" + item.countyId)).size,
    1 + DEMO_REGION.cities.length + DEMO_REGION.counties.length);
});
