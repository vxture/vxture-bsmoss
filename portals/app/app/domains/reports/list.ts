import { jobIdentity } from "../aggregation/refresh-jobs.ts";
import { fields } from "./rules.ts";

export interface ReportListQuery { limit: number; after?: string }
export interface ReportCursor { periodStart: string; reportId: string }
export interface ReportListItem {
  reportId: string; revision: string; manifestSha256: string; title: string;
  templateCode: string; templateVersion: number; grain: "day" | "week" | "month";
  period: { start: string; end: string }; generatedAt: string;
  capturedCompleteness: "complete" | "incomplete"; freshness: "unchecked";
}
export interface ReportListPage { items: ReportListItem[]; next: string | null }
export function decodeReportCursor(value: string): ReportCursor {
  if (typeof value !== "string" || value.length > 1024 || !/^[A-Za-z0-9_-]+$/.test(value)) throw Error("invalid_report_cursor");
  const text = Buffer.from(value, "base64url").toString("utf8");
  if (Buffer.from(text).toString("base64url") !== value) throw Error("invalid_report_cursor");
  let cursor: ReportCursor;
  try { cursor = JSON.parse(text); } catch { throw Error("invalid_report_cursor"); }
  fields(cursor, ["periodStart", "reportId"]); jobIdentity(cursor.reportId);
  if (typeof cursor.periodStart !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000Z$/.test(cursor.periodStart) ||
      !Number.isFinite(Date.parse(cursor.periodStart)) || new Date(cursor.periodStart).toISOString() !== cursor.periodStart) throw Error("invalid_report_cursor");
  return cursor;
}
export function encodeReportCursor(cursor: ReportCursor): string {
  const value = Buffer.from(JSON.stringify(cursor)).toString("base64url"); decodeReportCursor(value); return value;
}
export function normalizeReportListQuery(raw: ReportListQuery): ReportListQuery {
  fields(raw, ["limit", "after"]);
  if (!Number.isSafeInteger(raw.limit) || raw.limit < 1 || raw.limit > 25) throw Error("invalid_report_limit");
  if (raw.after !== undefined) decodeReportCursor(raw.after);
  return structuredClone(raw);
}
