import { DEMO_DATE, siteHour } from "../domains/map-demo/rules";
import { previewAvailability } from "../domains/data-updates/preview";
import { DEMO_REGION, DEMO_SITES } from "../domains/map-demo/resources";
import { parseMapQuery, queryMap, queryDailyReport, queryCalendarReport } from "../domains/map-demo/service";
import { calendarWindow, parseReportPeriod } from "../domains/map-demo/period-rules";
import { reviewDemoCases, scopedReviewCases, REVIEW_DATASET, REVIEW_CUTOFF } from "../domains/usage-verification/demo";
import { parseReviewQuery } from "../domains/usage-verification/query";
import { reviewHref } from "../domains/usage-verification/links";
import { overviewSignals } from "./overview-rules";
import { REPORT_SUMMARY_VERSION, summarizeOverviewReport, type OverviewReportSummary } from "./report-summary";
import generatedReports from "./generated-reports.json";
import { overviewMetricFacts } from "./metric-rules";

// No measurement store, credentials, permissions or mutable records belong here.
export function portalDemoSummary(input: Record<string, string | string[] | undefined> = {}) {
  const params = new URLSearchParams({ hour: "18" });
  for (const [key, value] of Object.entries(input)) {
    if (!["city", "county", "reportPeriod"].includes(key) || typeof value !== "string") throw Error("invalid_overview_scope");
    if (key !== "reportPeriod") params.set(key === "city" ? "cityId" : "countyId", value);
  }
  const query = parseMapQuery(params);
  const snapshot = queryMap(query);
  const reportPeriod = parseReportPeriod(String(input.reportPeriod ?? "day"));
  const reportParams = new URLSearchParams({ hour: String(query.hour), cityId: query.cityId, countyId: query.countyId });
  const daily = queryDailyReport(reportParams), usage = daily.usage;
  if (generatedReports.schema !== "bsmoss-overview-reports-v1" || generatedReports.version !== REPORT_SUMMARY_VERSION) throw Error("overview_report_snapshot_stale");
  const report = query.cityId === "all" && query.countyId === "all"
    ? generatedReports.reports[reportPeriod] as OverviewReportSummary
    : summarizeOverviewReport(reportPeriod === "day" ? daily : queryCalendarReport(new URLSearchParams({ ...Object.fromEntries(reportParams), period: reportPeriod })), reportPeriod, reportParams);
  // Aggregate the whole selected cohort, independently of the map rendering limit.
  const cohort = DEMO_SITES.filter(site => site.regionId === query.regionId && (query.cityId === "all" || site.cityId === query.cityId)
    && (query.countyId === "all" || site.countyId === query.countyId));
  const current = cohort.map(site => siteHour(site, query.hour));
  const reviewQuery = parseReviewQuery({ city: query.cityId, county: query.countyId, period: "day", status: "open" });
  const cases = scopedReviewCases(reviewDemoCases(), reviewQuery);
  const kinds = ["up", "down", "from_zero", "zero_run", "missing", "insufficient"] as const;
  return {
    date: DEMO_DATE, hour: query.hour, version: snapshot.version, dataUpdate: previewAvailability("overview"),
    query, region: DEMO_REGION, status: snapshot.summary, usage,
    runtime: { battery: current.filter(m => m.power === "battery").length, hot: current.filter(m => m.temperature >= 35).length },
    metrics: overviewMetricFacts(cohort, query.hour),
    signals: overviewSignals(cohort, query.hour),
    verification: { dataset: REVIEW_DATASET, cutoff: REVIEW_CUTOFF, window: calendarWindow("day"), query: reviewQuery,
      total: cases.length, sites: new Set(cases.map(c => c.site.id)).size,
      counts: { business: cases.filter(c => c.category === "business").length, quality: cases.filter(c => c.category === "quality").length,
        insufficient: cases.filter(c => c.category === "insufficient").length },
      kinds: kinds.map((kind, index) => {
        const matches = cases.filter(c => c.kind === kind), c = matches[index % Math.max(1, matches.length)];
        return { kind, count: matches.length, sample: c ? { id: c.id, site: c.site, operator: c.operator, metric: c.metric,
          current: c.current, referenceNumerator: c.referenceNumerator, start: c.start, end: c.end,
          validReferences: c.windows[0].references.filter(r => r.quality === "verified" && r.complete && r.value !== null).length,
          href: reviewHref(reviewQuery, c.id) } : null };
      }) },
    report,
    cities: DEMO_REGION.cities.filter(city => query.cityId === "all" || city.id === query.cityId)
      .map(city => ({ id: city.id, name: city.name, ...queryMap({ ...query, cityId: city.id }).summary }))
      .sort((a, b) => b.bytes - a.bytes || a.id.localeCompare(b.id)),
    priorities: snapshot.ranking.filter(site => site.status !== "normal")
      .map(site => ({ ...site, city: DEMO_REGION.cities.find(city => city.id === site.cityId)!.name })),
  };
}
export type PortalDemo = ReturnType<typeof portalDemoSummary>;
