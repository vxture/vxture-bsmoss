import { test } from "node:test";
import assert from "node:assert/strict";
import { portalDemoSummary } from "./demo";
import { businessDemo } from "../business-analysis/model";
import { registryDemo } from "../domains/site-registry/demo-store";

test("overview province and city totals reconcile without duplicating shared physical sites", () => {
  const province = portalDemoSummary();
  const cities = province.region.cities.map(city => portalDemoSummary({ city: city.id }));
  assert.equal(cities.reduce((n, city) => n + city.usage.physicalSites, 0), province.usage.physicalSites);
  assert.equal(cities.reduce((n, city) => n + city.usage.serviceRelations, 0), province.usage.serviceRelations);
  for (const metric of ["bytes", "voiceSeconds", "sms"] as const) {
    assert.equal(cities.reduce((n, city) => n + city.usage.totals[metric], 0), province.usage.totals[metric]);
    assert.equal(province.usage.series.reduce((n, hour) => n + hour.rows.reduce((s, row) => s + row[metric], 0), 0), province.usage.totals[metric]);
    assert.equal(province.usage.rows.reduce((n, row) => n + row[metric], 0), province.usage.totals[metric]);
  }
  assert.equal(cities.reduce((n, city) => n + city.status.warning + city.status.critical, 0), province.status.warning + province.status.critical);
});

test("county scope matches usage, resource registry and runtime workspace", () => {
  const input = { city: "610100", county: "610113" }, overview = portalDemoSummary(input);
  const usage = businessDemo("operator-usage", input);
  const runtime = businessDemo("efficiency", { ...input, topic: "power" });
  const registry = registryDemo(input);
  assert.equal(overview.usage.physicalSites, usage.usage!.physicalSites);
  assert.equal(overview.usage.physicalSites, registry.summary.sites);
  assert.equal(overview.usage.totals.bytes, Number(usage.usage!.totals.bytes));
  assert.deepEqual(overview.status, runtime.snapshot.summary);
  assert.equal(overview.runtime.battery, runtime.metricRows.filter(row => row.power === "battery").length);
  assert.equal(overview.runtime.hot, runtime.metricRows.filter(row => row.temperature >= 35).length);
  assert.ok(overview.priorities.every(row => row.countyId === input.county && row.status !== "normal"));
  assert.deepEqual(overview.cities.map(row => row.id), [input.city]);
});

test("unchanged refresh retains source windows and a valid empty county has no fabricated concerns", () => {
  const first = portalDemoSummary();
  assert.deepEqual(portalDemoSummary(), first);
  assert.equal(first.usage.window.start, first.date + "T00:00:00+08:00");
  assert.equal(first.usage.window.end, "2026-10-26T00:00:00+08:00");
  assert.equal(first.hour, 18);
  const county = first.region.counties.find(county => portalDemoSummary({ city: county.cityId, county: county.id }).usage.physicalSites === 0);
  assert.ok(county, "scenario cohort must include an empty county for this case");
  const empty = portalDemoSummary({ city: county.cityId, county: county.id });
  assert.equal(empty.status.connectionRate, null);
  assert.equal(empty.status.load, null);
  assert.deepEqual(empty.priorities, []);
  assert.equal(empty.usage.serviceRelations, 0);
});

test("overview rejects ambiguous, unknown and incompatible region scopes", () => {
  for (const input of [{ city: ["610100", "610200"] }, { city: "110100" }, { county: "610113" },
    { city: "610300", county: "610113" }, { workspaceId: "forged" }, { hour: "12" }]) {
    assert.throws(() => portalDemoSummary(input));
  }
});
