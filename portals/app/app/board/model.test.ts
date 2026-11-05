import { test } from "node:test";
import assert from "node:assert/strict";
import { boardDemo, parseBoardQuery } from "./model";
import { queryMap } from "../domains/map-demo/service";

test("decision board shares the workbench counters and a consistent hourly scope", () => {
  const demo = boardDemo({});
  assert.equal(demo.cityId, "all");
  assert.equal(demo.hour, 18);
  assert.equal(demo.snapshot.summary.count, 1080);
  assert.deepEqual(demo.snapshot.summary, queryMap(parseBoardQuery({})).summary);
  for (const key of ["count", "normal", "warning", "critical", "bytes", "voiceSeconds", "sms", "energyWh"] as const)
    assert.equal(demo.cities.reduce((sum, city) => sum + (city[key] ?? 0), 0), demo.snapshot.summary[key]);
  assert.equal(demo.series.length, 24);
  assert.deepEqual(demo.series[18], { hour: 18, ...demo.snapshot.summary });
  assert.equal(demo.usage.totals.bytes, demo.snapshot.summary.bytes);
  assert.equal(demo.usage.energyWh, demo.snapshot.summary.energyWh);
  assert.equal(demo.usage.rows.reduce((sum, row) => sum + row.bytes, 0), demo.snapshot.summary.bytes);
});

test("city and hour selection updates map, metrics, trend and operator scope together", () => {
  const demo = boardDemo({ city: "610100", hour: "12" });
  assert.equal(demo.cityId, "610100");
  assert.equal(demo.hour, 12);
  assert.ok(demo.snapshot.points.every(point => point.cityId === "610100"));
  assert.equal(demo.snapshot.summary.count, 240);
  assert.equal(demo.usage.physicalSites, 240);
  assert.equal(demo.usage.totals.voiceSeconds, demo.snapshot.summary.voiceSeconds);
  assert.equal(demo.usage.totals.sms, demo.snapshot.summary.sms);
  assert.equal(demo.snapshot.summary.energyWh, demo.cities.find(city => city.id === "610100")!.energyWh);
  assert.equal(demo.series[12].bytes, demo.snapshot.summary.bytes);
});

test("board rejects unsupported provinces, duplicate fields, forged scope and invalid hours", () => {
  for (const input of [{ city: "110100" }, { hour: "24" }, { hour: "-1" }, { hour: "1.5" },
    { hour: ["12", "18"] }, { city: ["610100"] }, { workspaceId: "forged" }, { site: "SX-DEMO-001" }])
    assert.throws(() => parseBoardQuery(input));
});

test("county selection reconciles points, all 24 hours and operator totals", () => {
  const demo = boardDemo({ city: "610100", county: "610113", hour: "12" });
  assert.equal(demo.countyId, "610113");
  assert.equal(demo.snapshot.summary.count, 16);
  assert.ok(demo.snapshot.points.every(point => point.countyId === "610113"));
  assert.equal(demo.usage.physicalSites, demo.snapshot.summary.count);
  for (const key of ["bytes", "voiceSeconds", "sms"] as const) {
    assert.equal(demo.usage.totals[key], demo.snapshot.summary[key]);
    assert.equal(demo.series[12][key], demo.snapshot.summary[key]);
  }
  for (const point of demo.series)
    assert.deepEqual(point, { hour: point.hour, ...queryMap(parseBoardQuery({ city: "610100", county: "610113", hour: String(point.hour) })).summary });
  for (const input of [{ city: "610300", county: "610113" }, { county: "610113" }, { city: "610100", county: ["610113"] }])
    assert.throws(() => parseBoardQuery(input));
});
