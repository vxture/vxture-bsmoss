import { positiveRevision } from "../aggregation/intervals.ts";
import { jobIdentity } from "../aggregation/refresh-jobs.ts";
import { fields } from "./rules.ts";
import type { RevalidateReport, StoredReport } from "./store.ts";

export interface PublicationCommand {
  reportId: string; reportRevision: string; manifestSha256: string; expectedEventRevision: string | null;
  commandId: string; action: "published" | "withdrawn"; reasonRef: string;
}
export interface PublicationQuery { reportId: string; eventRevision?: string }
export interface PublicationEvent {
  reportId: string; eventRevision: string; previousEventRevision: string | null; reportRevision: string; manifestSha256: string;
  commandId: string; action: "published" | "withdrawn"; reasonRef: string; recordedBy: string; recordedAt: string;
}
export interface PublicationState {
  event: PublicationEvent; currentEventRevision: string; isActive: boolean;
  report: StoredReport & { freshness: "current" | "stale"; reasons: readonly string[] };
}
export interface ReportPublicationStore {
  readonly workspaceId: string;
  execute(command: PublicationCommand, actor: string, revalidate: RevalidateReport): Promise<{
    status: "inserted" | "duplicate"; event: PublicationEvent; currentEventRevision: string; isActive: boolean;
  }>;
  read(query: PublicationQuery, revalidate: RevalidateReport): Promise<PublicationState | null>;
}
export function normalizePublicationCommand(raw: PublicationCommand): PublicationCommand {
  fields(raw, ["reportId", "reportRevision", "manifestSha256", "expectedEventRevision", "commandId", "action", "reasonRef"]);
  [raw.reportId, raw.commandId, raw.reasonRef].forEach(jobIdentity); positiveRevision(raw.reportRevision);
  if (raw.expectedEventRevision !== null) positiveRevision(raw.expectedEventRevision);
  if (typeof raw.manifestSha256 !== "string" || !/^[a-f0-9]{64}$/.test(raw.manifestSha256) || !["published", "withdrawn"].includes(raw.action)) throw Error("invalid_publication_command");
  return structuredClone(raw);
}
export function normalizePublicationQuery(raw: PublicationQuery): PublicationQuery {
  fields(raw, ["reportId", "eventRevision"]); jobIdentity(raw.reportId);
  if (raw.eventRevision !== undefined) positiveRevision(raw.eventRevision);
  return structuredClone(raw);
}
export function assertPublishable(report: PublicationState["report"]) {
  if (report.revision !== report.currentRevision || report.freshness !== "current" || report.manifest.capturedFreshness !== "current") throw Error("report_stale");
  if (report.manifest.dataCompleteness !== "complete") throw Error("report_incomplete");
}
