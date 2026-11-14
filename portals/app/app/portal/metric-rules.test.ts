import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregateOverviewObservations, metricChange, overviewMetricFacts } from "./metric-rules";
import { OVERVIEW_METRICS, defaultOverviewDisplay, metricDisplay, parseOverviewDisplay } from "./metric-catalog";
import { FIRST_METRICS } from "../domains/catalog/first-metrics";
import { DEMO_SITES } from "../domains/map-demo/resources";
import { siteHour } from "../domains/map-demo/rules";
import { portalDemoSummary } from "./demo";
import { queryDailyReport } from "../domains/map-demo/service";

test("24 view metrics have one category, explicit windows and valid formal catalog references", () => {
  assert.equal(OVERVIEW_METRICS.length, 24);
  assert.equal(new Set(OVERVIEW_METRICS.map(d => d.id)).size, 24);
  assert.deepEqual(["business_service", "operational_status", "runtime_parameter"].map(c => OVERVIEW_METRICS.filter(d => d.category === c).length), [8, 7, 9]);
  for (const d of OVERVIEW_METRICS) if (d.catalogCode) {
    const formal = FIRST_METRICS.get({ code: d.catalogCode, version: 1 })!;
    assert.ok(formal); assert.equal(formal.category, d.category);
    assert.equal(formal.lifecycle, "planned");
  }
  assert.equal(OVERVIEW_METRICS.find(d => d.id === "load")!.catalogCode, undefined);
});

test("metric facts reconcile with the daily report, previous window and runtime snapshots", () => {
  const scope = { city: "610100", county: "610113" }, home = portalDemoSummary(scope);
  const report = queryDailyReport(new URLSearchParams({ cityId: scope.city, countyId: scope.county, hour: "18" }));
  const f = (id: string) => home.metrics.rows.find(r => r.id === id)!;
  for (const [id, key] of [["flow", "bytes"], ["uplink", "upBytes"], ["downlink", "downBytes"], ["voice", "voiceSeconds"], ["sms", "sms"], ["attempts", "attempts"], ["connected", "connected"]] as const) {
    assert.equal(f(id).current, report.usage.totals[key]);
    assert.equal(f(id).previous, Number(report.comparison!.previous.totals[key]));
  }
  assert.equal(f("flow").current, f("uplink").current! + f("downlink").current!);
  assert.equal(f("dailyLoad").current, report.usage.totals.load);
  assert.equal(f("dailyConnection").current, report.usage.totals.connectionRate);
  assert.equal(f("energy").current, report.usage.energyWh);
  assert.equal(f("temperatureMax").current, report.runtime.temperatureMax);
  assert.equal(f("batterySites").current, report.runtime.batterySites);
  assert.equal(f("batteryHours").current, report.runtime.batterySiteHours);
  assert.equal(f("connection").current, home.status.connectionRate);
  assert.equal(f("load").current, home.status.load);
  assert.equal(f("battery").current, home.runtime.battery);
  assert.equal(f("hot").current, home.runtime.hot);
  assert.ok(home.metrics.rows.every(r => r.expected === r.observed && r.expected === r.previousObserved));
  assert.deepEqual(portalDemoSummary({ ...scope, reportPeriod: "month" }).metrics, home.metrics);
});

test("ratios use counter weights, temperature uses sample mean, and missing energy stays unknown", () => {
  const base = siteHour(DEMO_SITES[0], 18);
  const rows = [
    { siteId: "a", metrics: { ...base, attempts: 100, connected: 100, used: 10, capacity: 10, temperature: 20, energyWh: 1000 } },
    { siteId: "b", metrics: { ...base, attempts: 900, connected: 0, used: 0, capacity: 90, temperature: 40, energyWh: null } },
  ];
  const summary = aggregateOverviewObservations(rows, 18);
  assert.equal(summary.values.connection, .1);
  assert.equal(summary.values.load, .1);
  assert.equal(summary.values.temperature, 30);
  assert.equal(summary.values.temperatureMax, 40);
  assert.equal(summary.energySamples, 1);
  assert.equal(summary.values.energy, null); assert.equal(summary.values.intensity, null);
  const noDenominator = aggregateOverviewObservations([{ siteId: "a", metrics: { ...base, attempts: 0, connected: 0, capacity: 0, used: 0, bytes: 0 } }], 18);
  assert.equal(noDenominator.values.connection, null); assert.equal(noDenominator.values.load, null); assert.equal(noDenominator.values.intensity, null);
  const noSnapshot = aggregateOverviewObservations(rows, 17);
  assert.equal(noSnapshot.values.battery, null); assert.equal(noSnapshot.values.highLoad, null);
});

test("comparison semantics distinguish percentage points, physical deltas, zero bases and incomplete samples", () => {
  assert.ok(Math.abs(metricChange(.98, .97, "points").amount! - 1) < 1e-12);
  assert.equal(metricChange(30, 28, "delta").amount, 2);
  assert.equal(metricChange(120, 100, "rate").amount, .2);
  assert.equal(metricChange(100, 0, "rate").status, "from_zero");
  assert.equal(metricChange(0, 0, "rate").status, "both_zero");
  assert.equal(metricChange(100, null, "rate").status, "unavailable");
  assert.equal(metricChange(100, 100, "rate", false).status, "unavailable");
  assert.ok(overviewMetricFacts([], 18).rows.every(r => r.current === null && r.previous === null && r.change.status === "unavailable"));
});

test("battery sites are deduplicated while station-hours remain additive", () => {
  const mountain = DEMO_SITES.find(s => s.profile === "mountain")!;
  const rows = [11, 12, 13].map(hour => ({ siteId: mountain.id, metrics: siteHour(mountain, hour) }));
  const summary = aggregateOverviewObservations(rows, 12);
  assert.equal(summary.values.battery, 1); assert.equal(summary.values.mains, 0);
  assert.equal(summary.values.batterySites, 1); assert.equal(summary.values.batteryHours, 3);
});

test("display preferences preserve order and legal units and reject stale, forged and cross-category settings", () => {
  const valid = defaultOverviewDisplay();
  valid.selections.business_service.reverse(); valid.selections.business_service[2].unit = "GiB";
  assert.deepEqual(parseOverviewDisplay(valid), valid);
  const bad = (edit: (p: any) => void) => { const p = structuredClone(valid); edit(p); assert.throws(() => parseOverviewDisplay(p)); };
  bad(p => p.role = "owner"); bad(p => p.catalogVersion = "old"); bad(p => p.version = 2);
  bad(p => delete p.selections.operational_status);
  bad(p => p.selections.business_service[0].id = "energy");
  bad(p => p.selections.business_service[0].unit = "kWh");
  bad(p => p.selections.business_service.push(p.selections.business_service[0]));
  bad(p => p.selections.business_service = p.selections.business_service.slice(0, 1));
  bad(p => p.selections.runtime_parameter.push({ id: "temperature", unit: "degC" }, { id: "mains", unit: "station" }));
  bad(p => p.selections.runtime_parameter[0].threshold = 999);
  assert.equal(metricDisplay(1099511627776, "TiB", 2), "1");
  assert.equal(metricDisplay(1099511627776, "GiB", 2), "1,024");
  assert.equal(metricDisplay(null, "kWh", 1), "\u2014");
});
