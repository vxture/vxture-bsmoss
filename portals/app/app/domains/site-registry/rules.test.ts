import { test } from "node:test";
import assert from "node:assert/strict";
import { DEMO_REGION, DEMO_SITES } from "../map-demo/resources";
import { siteHour } from "../map-demo/rules";
import { queryStationReport } from "../map-demo/service";
import { DEFAULT_SITE_QUERY, parseSiteQuery, siteListHref, siteDetailHref } from "./rules";
import { registryDemo, dossierDemo } from "./demo-store";

test("registry counts unique physical sites separately from operator service relations", () => {
  const result = registryDemo({});
  assert.equal(result.summary.sites, 1080);
  assert.equal(result.summary.relations, DEMO_SITES.reduce((n, s) => n + s.operators.length, 0));
  assert.equal(result.regions.cities.reduce((n, c) => n + c.count, 0), 1080);
  assert.equal(result.regions.counties.reduce((n, c) => n + c.count, 0), 1080);
  assert.equal(result.rows.length, 20);
  assert.equal(new Set(result.rows.map(s => s.id)).size, 20);
});

test("city county operator scene status and sharing filters intersect before counts and pagination", () => {
  const query = { city: "610100", county: "610113", operator: "telecom", scene: "urban", status: "warning", sharing: "multi", hour: "18" };
  const result = registryDemo(query);
  const expected = DEMO_SITES.filter(s => s.cityId === "610100" && s.countyId === "610113" && s.operators.includes("telecom") &&
    s.profile === "urban" && s.operators.length >= 3 && siteHour(s, 18).status === "warning");
  assert.ok(expected.length);
  assert.equal(result.summary.sites, expected.length);
  assert.equal(result.summary.relations, expected.length);
  assert.ok(result.rows.every(s => expected.some(e => e.id === s.id)));
  const relations = registryDemo({ ...query, view: "relations" });
  assert.equal(relations.count, expected.length);
  assert.ok(relations.relations.every(r => r.code === "telecom"));
});

test("ordering and page clamping are stable, search is literal and missing results stay empty", () => {
  const seen: string[] = [];
  for (let page = 1; page <= 12; page++) {
    const result = registryDemo({ city: "610100", sort: "load", direction: "desc", page: String(page) });
    seen.push(...result.rows.map(s => s.id));
  }
  assert.equal(seen.length, 240); assert.equal(new Set(seen).size, 240);
  const rows = registryDemo({ sort: "load", direction: "desc" }).rows;
  for (let i = 1; i < rows.length; i++) assert.ok(rows[i - 1].current.used / rows[i - 1].current.capacity >= rows[i].current.used / rows[i].current.capacity);
  assert.equal(registryDemo({ search: "sx-demo-001" }).count, 1);
  const none = registryDemo({ search: "not-a-real-site", page: "100000" });
  assert.equal(none.count, 0); assert.equal(none.query.page, 1); assert.deepEqual(none.rows, []);
  assert.equal(registryDemo({ city: "610100", page: "100000" }).query.page, 12);
});

test("dossier preserves stable resource ownership and physical energy independently of service filtering", () => {
  const a = dossierDemo("SX-DEMO-001", {})!, b = dossierDemo("SX-DEMO-001", { operator: "telecom" })!;
  assert.deepEqual(a.site, b.site); assert.deepEqual(a.relations, b.relations);
  assert.equal(a.devices.filter(d => d.owner === "\u94c1\u5854").length, 5);
  assert.equal(a.devices.filter(d => d.relationId !== null).length, a.relations.length);
  assert.equal(new Set(a.devices.map(d => d.id)).size, a.devices.length);
  assert.equal(a.site.current.energyWh, siteHour(DEMO_SITES.find(s => s.id === a.site.id)!, 18).energyWh);
  assert.ok(a.relations.every(r => r.current.energyWh === null));
  assert.equal(dossierDemo("missing", {}), null);
});

test("all three period totals reconcile with operator rows and the existing single-site report", () => {
  for (const period of ["day", "week", "month"]) {
    const d = dossierDemo("SX-DEMO-001", { period })!, totals = d.period.usage.totals;
    assert.equal(d.relations.reduce((n, r) => n + BigInt(r.usage.totals.bytes), 0n), BigInt(totals.bytes));
    assert.equal(d.relations.reduce((n, r) => n + r.usage.totals.voiceSeconds, 0), totals.voiceSeconds);
    assert.equal(d.relations.reduce((n, r) => n + r.usage.totals.sms, 0), totals.sms);
    assert.deepEqual(totals, queryStationReport(d.site.id, new URLSearchParams({ period }))!.analysis.usage.totals);
    assert.equal(d.period.days.reduce((n, day) => n + BigInt(day.counters.bytes), 0n), BigInt(totals.bytes));
  }
});

test("unsupported scope and malformed filters fail closed, including inherited property names", () => {
  for (const input of [{ city: "110100" }, { county: "610113" }, { city: "610200", county: "610113" },
    { city: ["610100"] }, { status: "offline" }, { operator: "forged" }, { view: "admin" }, { page: "1.2" },
    { page: "0" }, { page: "100001" }, { hour: "24" }, { hour: "-1" }, { search: "x".repeat(81) },
    { tab: "edit" }, { period: "year" }, { sort: "energy" }, { workspaceId: "forged" }, { constructor: "forged" }])
    assert.throws(() => parseSiteQuery(input, DEMO_REGION));
});

test("detail and list links retain business filters and cannot redirect to arbitrary destinations", () => {
  const q = { ...DEFAULT_SITE_QUERY, city: "610100", county: "610113", operator: "telecom", page: 2, hour: 12, search: "a&b" };
  const detail = siteDetailHref("SX-DEMO-001", q, { tab: "business", period: "month" });
  const parsed = parseSiteQuery(Object.fromEntries(new URL("http://localhost" + detail).searchParams), DEMO_REGION);
  assert.equal(parsed.search, "a&b"); assert.equal(parsed.tab, "business"); assert.equal(parsed.page, 2);
  const back = new URL("http://localhost" + siteListHref(parsed));
  assert.equal(back.pathname, "/sites"); assert.equal(back.searchParams.get("search"), "a&b");
  assert.equal(back.searchParams.has("tab"), false); assert.equal(back.searchParams.has("period"), false);
});
