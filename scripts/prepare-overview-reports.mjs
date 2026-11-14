import { writeFileSync } from "node:fs";
import { queryDailyReport, queryCalendarReport } from "../portals/app/app/domains/map-demo/service.ts";
import { REPORT_SUMMARY_VERSION, summarizeOverviewReport } from "../portals/app/app/portal/report-summary.ts";

// Build-only immutable synthetic province summaries. Never contacts a source or a database.
const params = new URLSearchParams({ hour: "18", cityId: "all", countyId: "all" });
const reports = Object.fromEntries(["day", "week", "month"].map(period => {
  const source = period === "day" ? queryDailyReport(params) : queryCalendarReport(new URLSearchParams({ ...Object.fromEntries(params), period }));
  return [period, summarizeOverviewReport(source, period, params)];
}));
writeFileSync(new URL("../portals/app/app/portal/generated-reports.json", import.meta.url),
  JSON.stringify({ schema: "bsmoss-overview-reports-v1", version: REPORT_SUMMARY_VERSION, reports }, null, 2) + "\n");
console.log("[overview-reports] prepared deterministic day/week/month province summaries");
