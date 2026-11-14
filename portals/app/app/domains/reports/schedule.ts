import type { MeasurementAccess } from "../access/resolve.ts";
import type { MeasurementScope } from "../measurements/store.ts";
import { fingerprintOf, positiveRevision } from "../aggregation/intervals.ts";
import { bucketFor, instant, type Period } from "../aggregation/periods.ts";
import { jobIdentity } from "../aggregation/refresh-jobs.ts";
import { assertReportScope, fields, reportScope, type ReportGrain } from "./rules.ts";

export const REPORT_CALENDAR_VERSION = "bsmoss-report-calendar-v1";
export const REPORT_GENERATION_MAX_ATTEMPTS = 5;
export interface ReportSchedule {
  workspaceId: string; id: string; revision: string; subject: string; status: "active" | "paused";
  scope: MeasurementScope; templateCode: string; templateVersion: number; templateSha256: string;
  grain: ReportGrain; notBefore: string; delayMinutes: number; lookbackHours: number;
}
export function reportSchedule(raw: ReportSchedule) {
  fields(raw, ["workspaceId", "id", "revision", "subject", "status", "scope", "templateCode", "templateVersion", "templateSha256", "grain", "notBefore", "delayMinutes", "lookbackHours"]);
  const p = structuredClone(raw); [p.workspaceId, p.id, p.subject, p.templateCode].forEach(jobIdentity); positiveRevision(p.revision);
  if (!["active", "paused"].includes(p.status) || !["day", "week", "month"].includes(p.grain) || !Number.isSafeInteger(p.templateVersion) || p.templateVersion < 1 ||
      typeof p.templateSha256 !== "string" || !/^[a-f0-9]{64}$/.test(p.templateSha256) || !Number.isSafeInteger(p.delayMinutes) || p.delayMinutes < 0 || p.delayMinutes > 10080 ||
      !Number.isSafeInteger(p.lookbackHours) || p.lookbackHours < 1 || p.lookbackHours > 168) throw Error("invalid_report_schedule");
  p.scope = reportScope(p.scope); if (p.scope.workspaceId !== p.workspaceId) throw Error("workspace_mismatch");
  p.notBefore = new Date(instant(p.notBefore)).toISOString();
  if (bucketFor(p.notBefore, p.grain).start !== p.notBefore) throw Error("unaligned_report_schedule_start");
  return { schedule: p, sha256: fingerprintOf({ version: REPORT_CALENDAR_VERSION, schedule: p }) };
}
export function reportScheduleAccess(raw: ReportSchedule, access: MeasurementAccess, now: number): MeasurementAccess {
  const { schedule: p } = reportSchedule(raw);
  if (p.status !== "active") throw Error("report_schedule_paused");
  if (access.context.workspaceId !== p.workspaceId || access.context.sub !== p.subject) throw Error("report_schedule_subject_denied");
  if (access.expiresAt <= now) throw Error("access_expired");
  assertReportScope(access.scope, p.scope); return { ...access, scope: structuredClone(p.scope) };
}
export function planReportCalendar(raw: ReportSchedule, now: string) {
  const { schedule: p, sha256 } = reportSchedule(raw), clock = instant(now), delay = p.delayMinutes * 60000;
  const scanHour = bucketFor(now, "hour").start, windows: { period: Period; dueAt: string }[] = [];
  if (clock - delay < instant(p.notBefore)) return { version: REPORT_CALENDAR_VERSION, scheduleSha256: sha256, scanHour, windows };
  let end = bucketFor(new Date(clock - delay).toISOString(), p.grain).start;
  while (Date.parse(end) > instant(p.notBefore)) {
    const period = bucketFor(new Date(Date.parse(end) - 1).toISOString(), p.grain), due = Date.parse(end) + delay;
    if (due < clock - p.lookbackHours * 3600000) break;
    if (period.start < p.notBefore || due > clock) break;
    windows.push({ period, dueAt: new Date(due).toISOString() });
    if (windows.length > 16) throw Error("report_schedule_batch_bound");
    end = period.start;
  }
  return { version: REPORT_CALENDAR_VERSION, scheduleSha256: sha256, scanHour, windows: windows.reverse() };
}
export function generationRetrySeconds(attempt: number) {
  if (!Number.isSafeInteger(attempt) || attempt < 1 || attempt > REPORT_GENERATION_MAX_ATTEMPTS) throw Error("invalid_report_generation_attempt");
  return attempt === REPORT_GENERATION_MAX_ATTEMPTS ? 0 : 5 * 2 ** (attempt - 1);
}
export function generationFailure(error: unknown): string | null {
  if (error instanceof Error && ["aggregate_mapping_unavailable", "report_rollup_unavailable"].includes(error.message)) return "report_binding_unavailable";
  const code = error && typeof error === "object" && "code" in error ? error.code : null;
  return typeof code === "string" && /^[0-9A-Z]{5}$/.test(code) && !["40001", "40P01", "42501"].includes(code) ? "storage_failed" : null;
}
