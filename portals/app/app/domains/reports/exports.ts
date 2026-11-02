import type { PublicationState } from "./publication.ts";
import { assertPublishable } from "./publication.ts";
import { fields } from "./rules.ts";
import { positiveRevision } from "../aggregation/intervals.ts";
import { jobIdentity } from "../aggregation/refresh-jobs.ts";
import type { RevalidateReport } from "./store.ts";

export const REPORT_RENDERER_VERSION = "bsmoss-report-html-v1";
export const EXPORT_MAX_BYTES = 2 * 1024 * 1024;
export const EXPORT_MAX_ATTEMPTS = 5;
export interface ExportRequest { reportId: string; publicationRevision: string; commandId: string }
export interface ExportQuery { jobId: string }
export interface ExportJob {
  jobId: string; reportId: string; publicationRevision: string; reportRevision: string; manifestSha256: string;
  rendererVersion: string; commandId: string; requestedBy: string; requestedAt: string;
  status: "pending" | "succeeded" | "dead"; attempt: number; availableAt: string; artifactSha256: string | null;
}
export interface ExportDownload { html: string; sha256: string; filename: string }
export type ExportRun = { status: "busy_or_unavailable" } | { status: "delayed" | "terminal" | "succeeded" | "retry" | "dead"; job: ExportJob };
export interface ReportExportStore {
  readonly workspaceId: string;
  request(command: ExportRequest, actor: string, revalidate: RevalidateReport): Promise<{ status: "inserted" | "duplicate"; job: ExportJob }>;
  run(query: ExportQuery, actor: string, revalidate: RevalidateReport): Promise<ExportRun>;
  status(query: ExportQuery, revalidate: RevalidateReport): Promise<{ job: ExportJob; downloadable: boolean; blockingReason: string | null } | null>;
  download(query: ExportQuery, revalidate: RevalidateReport): Promise<ExportDownload | null>;
}
export function normalizeExportRequest(raw: ExportRequest): ExportRequest {
  fields(raw, ["reportId", "publicationRevision", "commandId"]); [raw.reportId, raw.commandId].forEach(jobIdentity); positiveRevision(raw.publicationRevision);
  return structuredClone(raw);
}
export function normalizeExportQuery(raw: ExportQuery): ExportQuery {
  fields(raw, ["jobId"]); jobIdentity(raw.jobId); return structuredClone(raw);
}
export function assertExportPublication(state: PublicationState | null): asserts state is PublicationState {
  if (!state || !state.isActive) throw Error("report_not_active"); assertPublishable(state.report);
}
export function exportRetrySeconds(attempt: number) {
  if (!Number.isSafeInteger(attempt) || attempt < 1 || attempt > EXPORT_MAX_ATTEMPTS) throw Error("invalid_export_attempt");
  return attempt === EXPORT_MAX_ATTEMPTS ? 0 : 5 * 2 ** (attempt - 1);
}
export function exportFailure(error: unknown): { code: string; terminal: boolean } | null {
  const message = error instanceof Error ? error.message : "";
  if (["report_not_active", "report_stale", "report_incomplete", "export_too_large", "export_renderer_unavailable"].includes(message)) return { code: message, terminal: true };
  if (message === "export_renderer_failure") return { code: "render_failed", terminal: false };
  const code = error && typeof error === "object" && "code" in error ? error.code : null;
  if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code) && !["40001", "40P01", "42501"].includes(code)) return { code: "storage_failed", terminal: false };
  return null;
}
