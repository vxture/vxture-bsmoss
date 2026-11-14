import { parseMapQuery } from "../map-demo/service";
import { parseReportPeriod, type ReportPeriod } from "../map-demo/period-rules";
import type { MapQuery } from "../map-demo/types";
import type { BusinessMetric } from "../map-demo/period-contribution-rules";
import type { FindingCategory } from "./rules";
export interface ReviewQuery {
  site?:string; scope: MapQuery; period: ReportPeriod; metric: BusinessMetric | "all"; category: FindingCategory | "all";
  status: "all" | "open" | "awaiting_review" | "closed"; page: number; pageSize?:number; kind?:import('./rules').FindingKind|'all';
}
export function parseReviewQuery(input: Record<string, string | string[] | undefined>): ReviewQuery {
  const allowed = ["city", "county", "operator", "search", "selection", "period", "metric", "category", "status", "page", "pageSize", "kind", "site", "hour"], p = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (!allowed.includes(key) || typeof value !== "string") throw Error("invalid_review_query");
    if (["city", "county", "operator", "search", "selection", "hour"].includes(key)) p.set(key === "city" ? "cityId" : key === "county" ? "countyId" : key, value);
  }
  if (p.toString().length > 4096) throw Error("invalid_review_query");
  const period = parseReportPeriod(String(input.period ?? "day")), metric = input.metric ?? "all", category = input.category ?? "all", status = input.status ?? "all";
  const pageText = String(input.page ?? "1");
  if (!["all", "bytes", "voiceSeconds", "sms"].includes(String(metric)) || !["all", "business", "quality", "insufficient"].includes(String(category)) ||
    !["all", "open", "awaiting_review", "closed"].includes(String(status)) || !/^[1-9]\d{0,3}$/.test(pageText)) throw Error("invalid_review_query");
  if(input.site!==undefined&&(typeof input.site!=="string"||!(/^[A-Za-z0-9-]{1,40}$/).test(input.site)))throw Error("invalid_review_site");
  if(input.pageSize!==undefined&&!['10','20','50','100'].includes(String(input.pageSize))||input.kind!==undefined&&!['all','up','down','from_zero','zero_run','missing','insufficient'].includes(String(input.kind)))throw Error('invalid_review_query');
  return { ...(input.site?{site:input.site as string}:{}), scope: parseMapQuery(p), period, metric: metric as ReviewQuery["metric"], category: category as ReviewQuery["category"], status: status as ReviewQuery["status"], page: Number(pageText),pageSize:Number(input.pageSize??20),kind:(input.kind??'all') as ReviewQuery['kind'] };
}
