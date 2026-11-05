import { test } from "node:test";
import assert from "node:assert/strict";
import { DEMO_REGION } from "../domains/map-demo/resources";
import { changedRegionHref, decodeRegionPreference, encodeRegionPreference, inheritRegionInput, regionLink } from "./region-scope";

const county = { cityId: "610100", countyId: "610113" }, province = { cityId: "all", countyId: "all" };
test("remembered scopes survive missing query but never override explicit links", () => {
  assert.deepEqual(inheritRegionInput({ view: "relations" }, county), { view: "relations", city: "610100", county: "610113" });
  assert.deepEqual(inheritRegionInput({ city: "610300" }, county), { city: "610300" });
  assert.deepEqual(inheritRegionInput({ city: "all", county: "all" }, county), { city: "all", county: "all" });
  assert.deepEqual(inheritRegionInput({ county: "610113" }, county), { county: "610113" });
  assert.deepEqual(inheritRegionInput({ city: ["610100", "610300"] }, county), { city: ["610100", "610300"] });
});
test("stored preferences reject stale catalogues, foreign and mismatched children", () => {
  assert.deepEqual(decodeRegionPreference(DEMO_REGION, encodeRegionPreference(DEMO_REGION, county)), county);
  assert.deepEqual(decodeRegionPreference(DEMO_REGION, encodeRegionPreference(DEMO_REGION, province)), province);
  for (const text of [undefined, "v2.610000.all.all", "v1.110000.all.all", "v1.610000.610300.610113", "v1.610000.all.610113", "v1.610000.unknown.all"]) {
    assert.equal(decodeRegionPreference(DEMO_REGION, text), null);
  }
});
test("module links preserve scope and local destination options without changing management routes", () => {
  for (const href of ["/", "/board", "/capacity", "/sites?view=relations", "/product-preview?hour=18", "/reports"]) {
    const url = new URL(regionLink(href, county), "http://localhost");
    assert.equal(url.searchParams.get("city"), county.cityId); assert.equal(url.searchParams.get("county"), county.countyId);
  }
  assert.equal(regionLink("/settings", county), "/settings");
  assert.equal(new URL(regionLink("/sites?view=relations", county), "http://localhost").searchParams.get("view"), "relations");
});
test("changing scope removes stale selection and returns object details to lists", () => {
  const href = changedRegionHref("/sites", "view=relations&page=8&search=old&selection=box&site=X&compare=A,B&hour=12", county);
  const q = new URL(href, "http://localhost").searchParams;
  assert.equal(q.get("view"), "relations"); assert.equal(q.get("hour"), "12");
  for (const key of ["page", "search", "selection", "site", "compare"]) assert.equal(q.has(key), false);
  assert.equal(changedRegionHref("/sites/DEMO-00037", "tab=business", county), "/sites?city=610100&county=610113");
  assert.equal(changedRegionHref("/usage-review/UV-123", "metric=sms", province), "/usage-review?city=all&county=all");
});
