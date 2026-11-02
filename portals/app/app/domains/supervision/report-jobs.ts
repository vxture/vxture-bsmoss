import type { MeasurementScope } from "../measurements/store.ts";
import type { RevalidateReport } from "../reports/store.ts";
import type { ReportGrain } from "../reports/rules.ts";
import { fields } from "../reports/rules.ts";
import { jobIdentity } from "../aggregation/refresh-jobs.ts";
import { positiveRevision } from "../aggregation/intervals.ts";
import { decodeJobCursor } from "./jobs.ts";
import type { RecoveryRecord, RecoveryResult } from "./jobs.ts";

export const REPORT_JOB_KINDS = ["generation", "export"] as const;
export const REPORT_JOB_STATES = ["all", "pending", "succeeded", "dead"] as const;
export type ReportJobKind = typeof REPORT_JOB_KINDS[number];
export type ReportJobState = typeof REPORT_JOB_STATES[number];
export interface ReportJobQuery { kind: ReportJobKind; jobId: string }
export interface ReportJobListQuery { kind: ReportJobKind; status: ReportJobState; limit: number; after?: string }
export interface ReportJobCursor { kind: ReportJobKind; status: ReportJobState; createdAt: string; jobId: string }
export interface ReportResultRef { reportId: string; revision: string; currentRevision: string | null; manifestSha256: string }
export interface ReportJobSummary {
  kind: ReportJobKind; id: string; status: Exclude<ReportJobState, "all">; attempt: number; maxAttempts: number;
  requestedBy: string; createdAt: string; updatedAt: string; availableAt: string;
  readiness: "ready" | "delayed" | "terminal" | "registration_paused" | "registration_changed";
  grain: ReportGrain; period: { start: string; end: string };
  registration: { id: string; revision: string; currentRevision: string | null; templateCode: string; templateVersion: number } | null;
  publication: { revision: string; rendererVersion: string } | null;
  result: ReportResultRef | null; artifactSha256: string | null;
}
export interface ReportJobAttempt {
  attempt: number; outcome: "retry" | "succeeded" | "dead"; failureCode: string | null; recordedAt: string; recordedBy: string;
  result: ReportResultRef | null; generationStatus: "inserted" | "duplicate" | null; artifactSha256: string | null;
}
export interface ReportJobDetail { job: ReportJobSummary; attempts: ReportJobAttempt[]; recoveredFrom: RecoveryRecord | null; recovery: RecoveryRecord | null }
export interface RecoverExportJob { kind: "export"; jobId: string; expectedAttempt: number; commandId: string; reasonRef: string }
export interface ExportRecoveryStore {
  readonly workspaceId: string;
  recover(command: RecoverExportJob, actor: string, revalidate: RevalidateReport): Promise<RecoveryResult>;
}
export function normalizeRecoverExportJob(raw: RecoverExportJob): RecoverExportJob {
  fields(raw, ["kind", "jobId", "expectedAttempt", "commandId", "reasonRef"]);
  [raw.jobId, raw.commandId, raw.reasonRef].forEach(jobIdentity);
  if (raw.kind !== "export" || !Number.isSafeInteger(raw.expectedAttempt) || raw.expectedAttempt < 1 || raw.expectedAttempt > 5) throw Error("invalid_report_recovery");
  return structuredClone(raw);
}
export interface ReportJobPage { items: ReportJobSummary[]; next: string | null }
export interface ReportJobStore {
  readonly workspaceId: string;
  list(query: ReportJobListQuery, revalidate: RevalidateReport): Promise<ReportJobPage>;
  read(query: ReportJobQuery, revalidate: RevalidateReport): Promise<ReportJobDetail | null>;
}
export function reportJobQuery(raw: ReportJobQuery) {
  fields(raw, ["kind", "jobId"]); jobIdentity(raw.jobId);
  if (!REPORT_JOB_KINDS.includes(raw.kind)) throw Error("invalid_report_job_kind");
  return structuredClone(raw);
}
export function decodeReportJobCursor(value: string): ReportJobCursor {
  if (typeof value !== "string" || value.length > 8192 || !/^[A-Za-z0-9_-]+$/.test(value)) throw Error("invalid_report_job_cursor");
  const text = Buffer.from(value, "base64url").toString("utf8");
  if (Buffer.from(text).toString("base64url") !== value) throw Error("invalid_report_job_cursor");
  let c: ReportJobCursor; try { c = JSON.parse(text); } catch { throw Error("invalid_report_job_cursor"); }
  fields(c, ["kind", "status", "createdAt", "jobId"]);
  if (!REPORT_JOB_KINDS.includes(c.kind) || !REPORT_JOB_STATES.includes(c.status)) throw Error("invalid_report_job_cursor");
  // Reuse the strict six-microsecond UTC and stable ID validation.
  decodeJobCursor(Buffer.from(JSON.stringify({ createdAt: c.createdAt, jobId: c.jobId, status: c.status })).toString("base64url"));
  return c;
}
export function encodeReportJobCursor(c: ReportJobCursor) { const value = Buffer.from(JSON.stringify(c)).toString("base64url"); decodeReportJobCursor(value); return value; }
export function reportJobList(raw: ReportJobListQuery) {
  fields(raw, ["kind", "status", "limit", "after"]);
  if (!REPORT_JOB_KINDS.includes(raw.kind) || !REPORT_JOB_STATES.includes(raw.status) || !Number.isSafeInteger(raw.limit) || raw.limit < 1 || raw.limit > 25) throw Error("invalid_report_job_filter");
  if (raw.after !== undefined) { const c = decodeReportJobCursor(raw.after); if (c.kind !== raw.kind || c.status !== raw.status) throw Error("invalid_report_job_cursor"); }
  return structuredClone(raw);
}
export function reportResultRef(raw: ReportResultRef): ReportResultRef {
  fields(raw, ["reportId", "revision", "currentRevision", "manifestSha256"]); jobIdentity(raw.reportId);
  positiveRevision(raw.revision); if (typeof raw.currentRevision !== "string") throw Error("invalid_report_job_evidence"); positiveRevision(raw.currentRevision);
  if (typeof raw.manifestSha256 !== "string" || !/^[a-f0-9]{64}$/.test(raw.manifestSha256)) throw Error("invalid_report_job_evidence");
  return structuredClone(raw);
}
export function emptyReportJobScope(scope: MeasurementScope): MeasurementScope {
  return { ...scope, sourceIds: [], stationIds: [], serviceIds: [], deviceIds: [], metricKeys: [], allowSiteParameters: false };
}
