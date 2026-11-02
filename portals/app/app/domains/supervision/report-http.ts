import { reportJobList, reportJobQuery, type ReportJobListQuery, type ReportJobQuery } from "./report-jobs.ts";

function parameters(url: URL, allowed: string[]) {
  if (url.search.length > 10000 || [...url.searchParams.keys()].some(k => !allowed.includes(k) || url.searchParams.getAll(k).length !== 1)) throw Error("invalid_report_job_filter");
  return url.searchParams;
}
export function reportJobListFromUrl(url: URL) {
  const p = parameters(url, ["kind", "status", "limit", "after"]);
  if (p.has("limit") && !/^[1-9]\d?$/.test(p.get("limit")!)) throw Error("invalid_report_job_filter");
  return reportJobList({ kind: (p.get("kind") ?? "generation") as ReportJobListQuery["kind"], status: (p.get("status") ?? "all") as ReportJobListQuery["status"],
    limit: Number(p.get("limit") ?? "20"), ...(p.has("after") ? { after: p.get("after")! } : {}) });
}
export function reportJobQueryFromUrl(url: URL, jobId: string) {
  const p = parameters(url, ["kind"]);
  return reportJobQuery({ kind: (p.get("kind") ?? "generation") as ReportJobQuery["kind"], jobId });
}
