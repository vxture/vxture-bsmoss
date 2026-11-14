import { calendarWindow, CALENDAR_RULE_VERSION, type ReportPeriod } from "../domains/map-demo/period-rules";
import { REPORT_TEMPLATE_VERSION } from "../domains/map-demo/report-rules";
import { CALENDAR_TEMPLATE_VERSION } from "../domains/map-demo/period-report-rules";
import { PERIOD_COMPARISON_VERSION } from "../domains/map-demo/period-comparison-rules";
import { DEMO_DATE, DEMO_VERSION } from "../domains/map-demo/rules";
import type { queryDailyReport, queryCalendarReport } from "../domains/map-demo/service";

export const REPORT_SUMMARY_VERSION = [DEMO_VERSION, CALENDAR_RULE_VERSION, REPORT_TEMPLATE_VERSION, CALENDAR_TEMPLATE_VERSION, PERIOD_COMPARISON_VERSION].join("/");
export function summarizeOverviewReport(report: ReturnType<typeof queryDailyReport> | ReturnType<typeof queryCalendarReport>, period: ReportPeriod, params: URLSearchParams) {
  if (!report.comparison) throw Error("overview_comparison_missing");
  return { id: report.id, period, templateVersion: report.templateVersion, window: calendarWindow(period),
    sites: report.usage.physicalSites, relations: report.usage.serviceRelations,
    totals: { bytes: String(report.usage.totals.bytes), voiceSeconds: String(report.usage.totals.voiceSeconds), sms: String(report.usage.totals.sms) },
    energyWh: report.usage.energyWh, runtime: report.runtime,
    comparison: { comparable: report.comparison.comparable, reason: report.comparison.reason, previous: report.comparison.previous, metrics: report.comparison.metrics },
    busy: report.busy ? { ...report.busy, date: "date" in report.busy ? report.busy.date : DEMO_DATE, bytes: String(report.busy.bytes) } : null,
    highestLoad: report.highestLoad, lowestConnection: report.lowestConnection,
    downloadHref: "/api/product-preview/reports?" + new URLSearchParams({ ...Object.fromEntries(params), ...(period !== "day" ? { period } : {}), format: "html" }) };
}
export type OverviewReportSummary = ReturnType<typeof summarizeOverviewReport>;
