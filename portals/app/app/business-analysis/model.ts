import {createHash} from 'node:crypto';
import {previewAvailability} from '../domains/data-updates/preview';
import { parseMapQuery, queryMap, queryOperatorUsage, queryCalendarUsage, queryDailyReport, queryCalendarReport, selectSites } from "../domains/map-demo/service";
import {analyzeCapacity} from '../domains/map-demo/capacity-rules';
import {analyzeRuntime} from '../domains/map-demo/runtime-rules';
import {registryRecord} from '../domains/site-registry/demo-store';
import {resourceGraph} from '../domains/site-registry/resource-rules';
import { DEMO_REGION, DEMO_SITES } from "../domains/map-demo/resources";
import { DEMO_DATE, DEMO_VERSION, siteHour } from "../domains/map-demo/rules";
import { evaluateTopic } from "../domains/map-demo/topic-rules";
import { calendarLabel, parseReportPeriod } from "../domains/map-demo/period-rules";
import { type BusinessKind, type BusinessScope } from "./links";
export function parseBusinessQuery(kind: BusinessKind, input: Record<string, string | string[] | undefined>) {
  const p = new URLSearchParams(), allowed = ["city", "county", "operator", "hour", "search", "selection", "period", ...(kind === "efficiency" ? ["topic"] : [])];
  for (const [key, value] of Object.entries(input)) {
    if (!allowed.includes(key) || typeof value !== "string") throw Error("invalid_business_query");
    p.set(key === "city" ? "cityId" : key === "county" ? "countyId" : key, value);
  }
  const rawPeriod = p.get("period") ?? "day", period = rawPeriod === "hour" ? "hour" : parseReportPeriod(rawPeriod); p.delete("period");
  if (kind === "usage-reports" && period === "hour") throw Error("invalid_report_period");
  if ((kind === "capacity" || kind === "efficiency") && input.period !== undefined) throw Error("invalid_topic_period");
  const topic = kind === "capacity" ? "capacity" : kind === "efficiency" ? p.get("topic") ?? "efficiency" : undefined;
  if (kind === "efficiency" && topic !== "efficiency" && topic !== "power") throw Error("invalid_runtime_topic");
  if (topic) p.set("topic", topic);
  const query = parseMapQuery(p);
  return { query, scope: { ...query, period, topic: query.topic ?? "capacity" } as BusinessScope };
}
export function businessDemo(kind: BusinessKind, input: Record<string, string | string[] | undefined>) {
  const { query, scope } = parseBusinessQuery(kind, input), snapshot = queryMap(query);
  const topicMode = kind === "capacity" || kind === "efficiency";
  const params = new URLSearchParams({ cityId: query.cityId, countyId: query.countyId, operator: query.operator, hour: String(query.hour), search: query.search });
  if (input.selection) params.set("selection", String(input.selection));
  const metricRows = topicMode ? snapshot.points.map(point => {
    const site = DEMO_SITES.find(s => s.id === point.id)!, m = siteHour(site, query.hour, query.operator);
    return { ...point, ...evaluateTopic(scope.topic, m), load: m.capacity ? m.used / m.capacity : null, temperature: m.temperature, power: m.power, connection: m.attempts ? m.connected / m.attempts : null,
      city: DEMO_REGION.cities.find(c => c.id === site.cityId)!.name, county: DEMO_REGION.counties.find(c => c.id === site.countyId)!.name };
  }) : [];
  const severity = { critical: 0, warning: 1, unknown: 2, normal: 3 };
  metricRows.sort((a, b) => severity[a.level] - severity[b.level] || (b.value ?? -1) - (a.value ?? -1) || a.id.localeCompare(b.id));
  const trend = topicMode ? snapshot.topic!.series.map(s => ({ key: String(s.hour), label: String(s.hour).padStart(2, "0"), value: s.warning + s.critical })) : [];
  if (!topicMode) params.set("period", scope.period);
  if (kind === "usage-reports" && scope.period === "day") params.delete("period");
  // A report already owns the exact usage snapshot; never recompute it for the page.
  const sourceReport = kind === "usage-reports" ? (scope.period === "day" ? queryDailyReport(params) : queryCalendarReport(params)) : null;
  let usage = null;
  if (kind === "operator-usage" || kind === "usage-reports") {
    const u = sourceReport?.usage ?? (scope.period === "hour" || scope.period === "day" ? queryOperatorUsage(params) : queryCalendarUsage(params));
    usage = { ...u, totals: { ...u.totals, bytes: String(u.totals.bytes) }, rows: u.rows.map(r => ({ ...r, bytes: String(r.bytes) })),
      trend: "dailySeries" in u ? u.dailySeries.map(s => ({ key: s.date, label: s.date.slice(5), bytes: s.rows.reduce((n, r) => n + Number(r.bytes), 0), voiceSeconds: s.rows.reduce((n, r) => n + r.voiceSeconds, 0), sms: s.rows.reduce((n, r) => n + r.sms, 0) })) :
        u.series.map(s => ({ key: String(s.hour), label: String(s.hour).padStart(2, "0"), bytes: s.rows.reduce((n, r) => n + r.bytes, 0), voiceSeconds: s.rows.reduce((n, r) => n + r.voiceSeconds, 0), sms: s.rows.reduce((n, r) => n + r.sms, 0) })) };
  }
  let report = null;
  if (sourceReport) {
    const r = sourceReport;
    report = { digest:createHash("sha256").update(JSON.stringify(r,null,2)).digest("hex"), id: r.id, templateVersion: r.templateVersion, runtime: r.runtime, comparison: r.comparison, ranking: r.ranking.map(s => ({ id: s.id, name: s.name, bytes: String(s.bytes) })),
      downloadHref: "/api/product-preview/reports?" + params + "&format=html" };
  }
  const sites=kind==='efficiency'?selectSites(query):[];
  const runtime=kind==='efficiency'?analyzeRuntime(sites,query,sites.map(s=>resourceGraph(registryRecord(s,query.hour),DEMO_DATE,DEMO_VERSION))):null;
  return { kind, scope, runtime, dataUpdate:previewAvailability(topicMode||scope.period==='hour'?'station':'calendar'), capacity:kind==='capacity'?analyzeCapacity(selectSites(query),query):null, date: DEMO_DATE, snapshot: { topic: snapshot.topic, summary: snapshot.summary }, metricRows, trend, usage, report,
    window: scope.period === "hour" ? DEMO_DATE + " " + String(scope.hour).padStart(2, "0") + ":00" : calendarLabel(scope.period),
    region: DEMO_REGION, scopeName: DEMO_REGION.counties.find(c => c.id === query.countyId)?.name ?? DEMO_REGION.cities.find(c => c.id === query.cityId)?.name ?? DEMO_REGION.name };
}
export type BusinessDemo = ReturnType<typeof businessDemo>;
