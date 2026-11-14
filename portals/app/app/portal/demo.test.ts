import { test } from "node:test";
import assert from "node:assert/strict";
import { portalDemoSummary } from "./demo";
import { businessDemo } from "../business-analysis/model";
import { registryDemo } from "../domains/site-registry/demo-store";
import { queryDailyReport, queryCalendarReport } from "../domains/map-demo/service";
import { reviewDemo, reviewDemoDetail } from "../domains/usage-verification/demo";
import { DEMO_SITES } from "../domains/map-demo/resources";
import { siteHour } from "../domains/map-demo/rules";
import { evaluateTopic } from "../domains/map-demo/topic-rules";
import { overviewSignals, overviewTriggers } from "./overview-rules";
import { REPORT_SUMMARY_VERSION, summarizeOverviewReport } from "./report-summary";
import generatedReports from "./generated-reports.json";

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
    { city: "610300", county: "610113" }, { workspaceId: "forged" }, { hour: "12" },
    { reportPeriod: "year" }, { reportPeriod: ["day", "week"] }]) {
    assert.throws(() => portalDemoSummary(input));
  }
});

test("topic counts and consecutive evidence agree with independent topic rules without future slots", () => {
  const sites = DEMO_SITES.slice(0, 24);
  for (const hour of [0, 12, 18, 23]) for (const group of overviewSignals(sites, hour)) {
    for (const level of ["normal", "warning", "critical", "unknown"] as const) {
      assert.equal(group.counts[level], sites.filter(site => evaluateTopic(group.topic, siteHour(site, hour)).level === level).length);
    }
    for (const row of group.rows) {
      const site = sites.find(site => site.id === row.site.id)!;
      assert.ok(row.triggers.length > 0);
      assert.equal(row.series.length, hour + 1);
      assert.equal(row.series.at(-1)!.hour, hour);
      assert.ok(row.series.slice(-row.streak).every(s => s.level === "warning" || s.level === "critical"));
      if (row.streak <= hour) assert.ok(!["warning", "critical"].includes(row.series[hour - row.streak].level));
      assert.equal(row.operators.reduce((n, op) => n + op.bytes, 0), siteHour(site, hour).bytes);
      assert.ok(Math.abs(row.operators.reduce((n, op) => n + (op.share ?? 0), 0) - 1) < 1e-12);
    }
  }
  assert.ok(overviewSignals(sites, 12).find(g => g.topic === "power")!.rows.some(row => row.triggers.includes("battery")));
});

test("trigger explanations obey exact thresholds and do not diagnose an unknown energy value", () => {
  const m = siteHour(DEMO_SITES[0], 18);
  assert.deepEqual(overviewTriggers("capacity", { ...m, capacity: 100, used: 85, attempts: 100, connected: 98 }), ["load"]);
  assert.deepEqual(overviewTriggers("capacity", { ...m, capacity: 0, attempts: 0 }), []);
  assert.deepEqual(overviewTriggers("power", { ...m, power: "mains", temperature: 35 }), ["temperature"]);
  assert.deepEqual(overviewTriggers("efficiency", { ...m, energyWh: null }), []);
  assert.deepEqual(overviewSignals([], 18).map(g => g.rows), [[], [], []]);
});

test("all six verification kinds reconcile to the scoped independent evidence list", () => {
  const d = portalDemoSummary(), v = d.verification, expected = reviewDemo({ status: "open" });
  assert.equal(v.total, expected.total);
  assert.deepEqual(v.counts, expected.counts);
  assert.equal(v.kinds.reduce((n, k) => n + k.count, 0), v.total);
  assert.ok(v.kinds.every(k => k.count > 0 && k.sample));
  for (const { sample, kind } of v.kinds) {
    const detail = reviewDemoDetail(sample!.id, Object.fromEntries(new URL(sample!.href, "http://localhost").searchParams))!;
    assert.equal(detail.item.kind, kind);
    assert.equal(sample!.current, detail.item.current);
    if (kind === "missing") assert.equal(sample!.current, null);
    if (kind === "insufficient") assert.equal(sample!.validReferences, 2);
    if (kind === "zero_run") assert.equal(Date.parse(sample!.end) - Date.parse(sample!.start), 3 * 3600000);
  }
  const empty = portalDemoSummary({ city: "610400", county: "610403" });
  assert.equal(empty.verification.total, 0);
  assert.ok(empty.verification.kinds.every(k => !k.sample));
});

test("report day/week/month summaries and download IDs match the report engine while daily overview stays fixed", () => {
  const base = { city: "610100", county: "610113" }, day = portalDemoSummary(base);
  for (const reportPeriod of ["day", "week", "month"] as const) {
    const overview = portalDemoSummary({ ...base, reportPeriod });
    const params = new URLSearchParams({ cityId: base.city, countyId: base.county, hour: "18" });
    const expected = reportPeriod === "day" ? queryDailyReport(params) : queryCalendarReport(new URLSearchParams({ ...Object.fromEntries(params), period: reportPeriod }));
    assert.equal(overview.report.id, expected.id);
    assert.equal(overview.report.totals.bytes, String(expected.usage.totals.bytes));
    assert.deepEqual(overview.report.runtime, expected.runtime);
    assert.deepEqual(overview.report.comparison.metrics, expected.comparison!.metrics);
    assert.deepEqual(overview.usage.totals, day.usage.totals);
    assert.deepEqual(overview.status, day.status);
    assert.equal(overview.report.window.dates.length, reportPeriod === "day" ? 1 : reportPeriod === "week" ? 7 : 31);
    assert.equal(new URL(overview.report.downloadHref, "http://localhost").searchParams.get("format"), "html");
    assert.equal(overview.report.runtime.samples, overview.report.sites * overview.report.window.dates.length * 24);
    assert.equal("contribution" in overview.report.comparison, false);
  }
});

test("immutable province summaries reconcile exactly with the report engine and version", () => {
  assert.equal(generatedReports.schema, "bsmoss-overview-reports-v1");
  assert.equal(generatedReports.version, REPORT_SUMMARY_VERSION);
  const params = new URLSearchParams({ hour: "18", cityId: "all", countyId: "all" });
  for (const period of ["day", "week", "month"] as const) {
    const source = period === "day" ? queryDailyReport(params) : queryCalendarReport(new URLSearchParams({ ...Object.fromEntries(params), period }));
    const expected = summarizeOverviewReport(source, period, params);
    assert.deepEqual(generatedReports.reports[period], expected);
    assert.deepEqual(portalDemoSummary({ reportPeriod: period }).report, expected);
  }
});
