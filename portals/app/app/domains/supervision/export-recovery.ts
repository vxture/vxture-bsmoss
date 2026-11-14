import type { PoolClient } from "pg";
import type { MeasurementScope } from "../measurements/store.ts";
import { fields, reportScope } from "../reports/rules.ts";
import { fingerprintOf, positiveRevision } from "../aggregation/intervals.ts";
import { jobIdentity } from "../aggregation/refresh-jobs.ts";
import type { RecoveryRecord } from "./jobs.ts";
import type { ReportJobAttempt } from "./report-jobs.ts";

export interface ExportRecoveryManifest {
  version: "report-export-recovery-v1"; workspaceId: string; commandId: string; reasonRef: string; requestedBy: string; requiredScope: MeasurementScope;
  binding: { reportId: string; publicationRevision: string; reportRevision: string; manifestSha256: string; rendererVersion: string };
  original: { id: string; attempt: number; commandId: string; requestedBy: string; terminal: ReportJobAttempt };
  replacement: { id: string; commandId: string };
}
export function exportRecoveryCommand(workspaceId: string, jobId: string, commandId: string) { return "reviewed-export-recovery:" + fingerprintOf([workspaceId, jobId, commandId]); }
const binding = (alias: string) => `jsonb_build_object('reportId',${alias}.report_id,'publicationRevision',${alias}.publication_revision::text,
  'reportRevision',${alias}.report_revision::text,'manifestSha256',${alias}.manifest_sha256,'rendererVersion',${alias}.renderer_version)`;
export const exportRecoverySelect = `SELECT r.*,r.database_sha256=encode(sha256(convert_to(r.manifest::text,'UTF8')),'hex') AS valid,
  ${binding("p")} AS original_binding,${binding("n")} AS replacement_binding,
  p.command_id AS original_command,p.requested_by AS original_actor,p.status AS original_status,p.attempt AS actual_attempt,
  n.command_id AS replacement_command,n.requested_by AS replacement_actor,
  a.failure_code AS terminal_failure,a.recorded_at AS terminal_time,a.recorded_by AS terminal_actor,
  v.manifest->'requiredScope' AS required_scope
  FROM bsmoss_analysis.report_export_recovery r
  JOIN bsmoss_analysis.report_export_job p ON (p.workspace_id,p.id)=(r.workspace_id,r.original_job_id)
  JOIN bsmoss_analysis.report_export_job n ON (n.workspace_id,n.id)=(r.workspace_id,r.replacement_job_id)
  JOIN bsmoss_analysis.report_export_attempt a ON (a.workspace_id,a.job_id,a.attempt,a.outcome)=(r.workspace_id,r.original_job_id,r.original_attempt,r.original_outcome)
  JOIN bsmoss_analysis.report_revision v ON (v.workspace_id,v.report_id,v.revision,v.manifest_sha256)=(p.workspace_id,p.report_id,p.report_revision,p.manifest_sha256)`;
export function exportRecoveryOf(row: Record<string, any>): { manifest: ExportRecoveryManifest; record: RecoveryRecord } {
  const m = row.manifest as ExportRecoveryManifest;
  fields(m, ["version", "workspaceId", "commandId", "reasonRef", "requestedBy", "requiredScope", "binding", "original", "replacement"]);
  fields(m.binding, ["reportId", "publicationRevision", "reportRevision", "manifestSha256", "rendererVersion"]);
  fields(m.original, ["id", "attempt", "commandId", "requestedBy", "terminal"]); fields(m.replacement, ["id", "commandId"]);
  fields(m.original.terminal, ["attempt", "outcome", "failureCode", "recordedAt", "recordedBy", "result", "generationStatus", "artifactSha256"]);
  [m.workspaceId, m.commandId, m.reasonRef, m.requestedBy, m.binding.reportId, m.binding.rendererVersion,
    m.original.id, m.original.commandId, m.original.requestedBy, m.replacement.id, m.replacement.commandId].forEach(jobIdentity);
  positiveRevision(m.binding.publicationRevision); positiveRevision(m.binding.reportRevision);
  const terminal: ReportJobAttempt = { attempt: Number(row.original_attempt), outcome: "dead", failureCode: row.terminal_failure,
    recordedAt: row.terminal_time.toISOString(), recordedBy: row.terminal_actor, result: null, generationStatus: null, artifactSha256: null };
  if (!row.valid || fingerprintOf(m) !== row.manifest_sha256 || m.version !== "report-export-recovery-v1" || m.workspaceId !== row.workspace_id ||
    m.commandId !== row.command_id || m.reasonRef !== row.reason_ref || m.requestedBy !== row.requested_by || m.original.id !== row.original_job_id ||
    m.original.attempt !== Number(row.original_attempt) || !Number.isSafeInteger(m.original.attempt) || m.original.attempt < 1 || m.original.attempt > 5 ||
    row.original_status !== "dead" || Number(row.actual_attempt) !== m.original.attempt || row.original_outcome !== "dead" ||
    m.original.commandId !== row.original_command || m.original.requestedBy !== row.original_actor || m.replacement.id !== row.replacement_job_id ||
    m.replacement.id === m.original.id || m.replacement.commandId !== row.replacement_command || row.replacement_actor !== m.requestedBy ||
    m.replacement.commandId !== exportRecoveryCommand(m.workspaceId, m.original.id, m.commandId) ||
    fingerprintOf(m.binding) !== fingerprintOf(row.original_binding) || fingerprintOf(m.binding) !== fingerprintOf(row.replacement_binding) ||
    fingerprintOf(m.original.terminal) !== fingerprintOf(terminal) || fingerprintOf(reportScope(m.requiredScope)) !== fingerprintOf(reportScope(row.required_scope))) throw Error("invalid_report_recovery_evidence");
  return { manifest: m, record: { commandId: m.commandId, originalJobId: m.original.id, replacementJobId: m.replacement.id,
    originalAttempt: m.original.attempt, reasonRef: m.reasonRef, requestedBy: m.requestedBy, recordedAt: row.recorded_at.toISOString() } };
}
export async function readExportRecoveries(client: PoolClient, workspaceId: string, jobId: string) {
  const rows = (await client.query(exportRecoverySelect + " WHERE r.workspace_id=$1 AND (r.original_job_id=$2 OR r.replacement_job_id=$2) ORDER BY r.command_id LIMIT 3", [workspaceId, jobId])).rows;
  if (rows.length > 2) throw Error("invalid_report_recovery_evidence");
  return rows.map(exportRecoveryOf);
}
