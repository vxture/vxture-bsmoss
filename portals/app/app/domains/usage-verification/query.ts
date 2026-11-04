import { parseMapQuery } from "../map-demo/service";
import { parseReportPeriod, type ReportPeriod } from "../map-demo/period-rules";
import type { MapQuery } from "../map-demo/types";
import type { BusinessMetric } from "../map-demo/period-contribution-rules";
import type { FindingCategory } from "./rules";
export interface ReviewQuery {
  scope: MapQuery; period: ReportPeriod; metric: BusinessMetric | "all"; category: FindingCategory | "all";
  status: "all" | "open" | "awaiting_review" | "closed"; page: number;
}
export function parseReviewQuery(input: Record<string, string | string[] | undefined>): ReviewQuery {
  const allowed = ["city", "county", "operator", "search", "selection", "period", "metric", "category", "status", "page"], p = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (!allowed.includes(key) || typeof value !== "string") throw Error("invalid_review_query");
    if (["city", "county", "operator", "search", "selection"].includes(key)) p.set(key === "city" ? "cityId" : key === "county" ? "countyId" : key, value);
  }
  if (p.toString().length > 4096) throw Error("invalid_review_query");
  const period = parseReportPeriod(String(input.period ?? "day")), metric = input.metric ?? "all", category = input.category ?? "all", status = input.status ?? "all";
  const pageText = String(input.page ?? "1");
  if (!["all", "bytes", "voiceSeconds", "sms"].includes(String(metric)) || !["all", "business", "quality", "insufficient"].includes(String(category)) ||
    !["all", "open", "awaiting_review", "closed"].includes(String(status)) || !/^[1-9]\d{0,3}$/.test(pageText)) throw Error("invalid_review_query");
  return { scope: parseMapQuery(p), period, metric: metric as ReviewQuery["metric"], category: category as ReviewQuery["category"], status: status as ReviewQuery["status"], page: Number(pageText) };
}
