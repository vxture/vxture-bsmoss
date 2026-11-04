import { test } from "node:test";
import assert from "node:assert/strict";
import { businessDemo, parseBusinessQuery } from "./model";
import { businessHref, businessMapHref, type BusinessKind } from "./links";
import { queryCalendarReport, queryCalendarUsage, queryDailyReport, queryMap, queryOperatorUsage } from "../domains/map-demo/service";
import { useWorkbench } from "../domains/map-demo/workbench-store";

const kinds: BusinessKind[] = ["capacity", "efficiency", "operator-usage", "usage-reports"];
const narrow = { city: "610100", county: "610113", operator: "mobile", hour: "17", search: "SX-DEMO-006", selection: "circle:108.95,34.26,10000" };
const input = (href: string) => Object.fromEntries(new URL(href, "http://localhost").searchParams);

test("business queries reject ambiguous, forged, non-Shaanxi and incompatible scope", () => {
  for (const kind of kinds) {
    assert.equal(parseBusinessQuery(kind, {}).scope.hour, 18);
    for (const bad of [{ city: "110100" }, { county: "610113" }, { city: "610300", county: "610113" }, { operator: "forged" }, { hour: "24" }, { period: "year" }, { workspaceId: "forged" }, { city: ["610100", "610200"] }, { search: "a".repeat(81) }, { selection: "circle:108,34,0" }]) {
      assert.throws(() => parseBusinessQuery(kind, bad));
    }
  }
  assert.throws(() => parseBusinessQuery("capacity", { period: "day" }));
  assert.throws(() => parseBusinessQuery("capacity", { topic: "power" }));
  assert.throws(() => parseBusinessQuery("efficiency", { topic: "capacity" }));
  assert.throws(() => parseBusinessQuery("usage-reports", { period: "hour" }));
  assert.equal(parseBusinessQuery("efficiency", { topic: "power" }).scope.topic, "power");
});

test("independent topic detail and trends reconcile with existing map analysis", () => {
  for (const [kind, topic] of [["capacity", "capacity"], ["efficiency", "efficiency"], ["efficiency", "power"]] as const) {
    const d = businessDemo(kind, { city: "610100", hour: "12", ...(kind === "efficiency" ? { topic } : {}) });
    const expected = queryMap(parseBusinessQuery(kind, input(businessHref(kind, d.scope))).query);
    assert.deepEqual(d.snapshot.topic, expected.topic);
    assert.equal(d.metricRows.length, expected.summary.count);
    for (const level of ["normal", "warning", "critical", "unknown"] as const) assert.equal(d.metricRows.filter(r => r.level === level).length, expected.topic!.counts[level]);
    for (let hour = 0; hour < 24; hour++) assert.equal(d.trend[hour].value, expected.topic!.series[hour].warning + expected.topic!.series[hour].critical);
    assert.equal(d.trend[12].value, expected.topic!.counts.critical + expected.topic!.counts.warning);
  }
  const unknown = businessDemo("efficiency", narrow);
  assert.ok(unknown.metricRows.length > 0);
  assert.ok(unknown.metricRows.every(r => r.level === "unknown" && r.value === null && r.energyKWh === null));
  const empty = businessDemo("capacity", { search: "not-found" });
  assert.equal(empty.metricRows.length, 0); assert.ok(empty.trend.every(p => p.value === 0));
});

test("hour/day/week/month usage and report exports reuse exact scoped counters", () => {
  for (const period of ["hour", "day", "week", "month"] as const) {
    const d = businessDemo("operator-usage", { ...narrow, period }), u = d.usage!;
    const p = new URLSearchParams({ cityId: narrow.city, countyId: narrow.county, operator: narrow.operator, hour: narrow.hour, search: narrow.search, selection: narrow.selection, period });
    const expected = period === "hour" || period === "day" ? queryOperatorUsage(p) : queryCalendarUsage(p);
    assert.equal(u.totals.bytes, String(expected.totals.bytes));
    assert.equal(u.energyWh, null); assert.equal(u.physicalSites, 1);
    const summedTrend = period === "hour" ? u.trend.filter(p => p.key === narrow.hour) : u.trend;
    assert.equal(summedTrend.reduce((sum, row) => sum + row.bytes, 0), Number(expected.totals.bytes));
    assert.equal(summedTrend.reduce((sum, row) => sum + row.voiceSeconds, 0), expected.totals.voiceSeconds);
    assert.equal(summedTrend.reduce((sum, row) => sum + row.sms, 0), expected.totals.sms);
    if (period === "hour") continue;
    const r = businessDemo("usage-reports", { ...narrow, period });
    const download = new URL(r.report!.downloadHref, "http://localhost");
    assert.equal(download.searchParams.get("format"), "html"); download.searchParams.delete("format");
    const report = period === "day" ? queryDailyReport(download.searchParams) : queryCalendarReport(download.searchParams);
    assert.equal(r.report!.id, report.id);
    assert.deepEqual(r.report!.comparison, report.comparison);
    assert.deepEqual(r.usage!.totals, u.totals); assert.deepEqual(r.usage!.rows, u.rows); assert.equal(report.usage.physicalSites, 1);
    assert.equal(String(report.usage.totals.bytes), r.usage!.totals.bytes);
  }
});

test("analysis/map links round-trip region, operator, period, search and geometry without default station", () => {
  for (const kind of kinds) for (const period of kind === "capacity" || kind === "efficiency" ? ["day"] : kind === "usage-reports" ? ["day", "week", "month"] : ["hour", "day", "week", "month"]) {
    const scope = parseBusinessQuery(kind, { ...narrow, ...(kind === "capacity" || kind === "efficiency" ? {} : { period }), ...(kind === "efficiency" ? { topic: "power" } : {}) }).scope;
    const map = input(businessMapHref(kind, scope));
    assert.equal(map.site, undefined); assert.equal(map.search, narrow.search); assert.equal(map.selection, narrow.selection);
    const back = { ...map }; delete back.topic; delete back.usage; delete back.report;
    if (kind === "efficiency") back.topic = map.topic;
    if (map.usage || map.report) back.period = map.usage || map.report;
    assert.deepEqual(parseBusinessQuery(kind, back).scope, scope);
    assert.equal(input(businessMapHref(kind, scope, "SX-DEMO-006")).site, "SX-DEMO-006");
    assert.deepEqual(parseBusinessQuery(kind, input(businessHref(kind, scope))).scope, scope);
  }
  assert.equal(input(businessHref("usage-reports", parseBusinessQuery("operator-usage", { period: "hour" }).scope)).period, "day");
});

test("map panel hydration preserves explicitly supplied search while a fresh panel resets it", () => {
  for (const panel of ["topicOpen", "usageOpen", "reportOpen"] as const) {
    useWorkbench.getState().set({ [panel]: true, search: "SX-DEMO-006" });
    assert.equal(useWorkbench.getState().search, "SX-DEMO-006");
    useWorkbench.getState().set({ [panel]: true });
    assert.equal(useWorkbench.getState().search, "");
  }
});
