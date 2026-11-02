import type { PoolClient } from "pg";
import type { MeasurementScope } from "../measurements/store.ts";
import type { RecoveryRecord } from "../supervision/jobs.ts";
import type { ReportJobAttempt } from "../supervision/report-jobs.ts";
import { fields, reportScope } from "./rules.ts";
import { fingerprintOf, positiveRevision } from "../aggregation/intervals.ts";
import { jobIdentity } from "../aggregation/refresh-jobs.ts";

export interface GenerationRecoveryBinding {
  scheduleId: string; scheduleRevision: string; scheduleSha256: string; scanHour: string; scanJobId: string;
  grain: string; period: { start: string; end: string }; dueAt: string; requestedBy: string;
}
export interface GenerationRecoveryManifest {
  version: "report-generation-recovery-v1"; workspaceId: string; commandId: string; reasonRef: string; requestedBy: string;
  requiredScope: MeasurementScope; binding: GenerationRecoveryBinding;
  original: { id: string; attempt: number; terminal: ReportJobAttempt }; replacement: { id: string };
}
const iso = (column: string) => `to_char(${column} AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
const binding = (a: string) => `jsonb_build_object('scheduleId',${a}.schedule_id,'scheduleRevision',${a}.schedule_revision::text,'scheduleSha256',${a}.schedule_sha256,
  'scanHour',${iso(a + ".scan_hour")},'scanJobId',coalesce(${a}.scan_job_id,${a}.id),'grain',${a}.grain,
  'period',jsonb_build_object('start',${iso(a + ".period_start")},'end',${iso(a + ".period_end")}),
  'dueAt',${iso(a + ".due_at")},'requestedBy',${a}.requested_by)`;
export const generationRecoverySelect = `SELECT r.*,r.database_sha256=encode(sha256(convert_to(r.manifest::text,'UTF8')),'hex') AS valid,
  ${binding("p")} original_binding,${binding("n")} replacement_binding,${binding("root")} root_binding,
  p.status original_status,p.attempt actual_attempt,n.recovery_of parent_link,n.scan_job_id root_job_id,
  root.recovery_of IS NULL AND root.scan_job_id IS NULL AS root_is_scan,
  a.failure_code terminal_failure,a.recorded_at terminal_time,a.recorded_by terminal_actor,c.config->'scope' required_scope
  FROM bsmoss_analysis.report_generation_recovery r
  JOIN bsmoss_analysis.report_generation_job p ON (p.workspace_id,p.id)=(r.workspace_id,r.original_job_id)
  JOIN bsmoss_analysis.report_generation_job n ON (n.workspace_id,n.id)=(r.workspace_id,r.replacement_job_id)
  JOIN bsmoss_analysis.report_generation_job root ON (root.workspace_id,root.id)=(n.workspace_id,n.scan_job_id)
  JOIN bsmoss_analysis.report_generation_attempt a ON (a.workspace_id,a.job_id,a.attempt,a.outcome)=(r.workspace_id,r.original_job_id,r.original_attempt,r.original_outcome)
  JOIN bsmoss_integration.report_schedule_revision c ON (c.workspace_id,c.id,c.revision)=(p.workspace_id,p.schedule_id,p.schedule_revision)`;
export function generationRecoveryOf(row: Record<string, any>): { manifest: GenerationRecoveryManifest; record: RecoveryRecord } {
  const m = row.manifest as GenerationRecoveryManifest;
  fields(m, ["version", "workspaceId", "commandId", "reasonRef", "requestedBy", "requiredScope", "binding", "original", "replacement"]);
  fields(m.binding, ["scheduleId", "scheduleRevision", "scheduleSha256", "scanHour", "scanJobId", "grain", "period", "dueAt", "requestedBy"]);
  fields(m.original, ["id", "attempt", "terminal"]); fields(m.replacement, ["id"]);
  fields(m.original.terminal, ["attempt", "outcome", "failureCode", "recordedAt", "recordedBy", "result", "generationStatus", "artifactSha256"]);
  [m.workspaceId, m.commandId, m.reasonRef, m.requestedBy, m.binding.scheduleId, m.binding.scanJobId, m.binding.requestedBy, m.original.id, m.replacement.id].forEach(jobIdentity);
  positiveRevision(m.binding.scheduleRevision);
  const terminal: ReportJobAttempt = { attempt: Number(row.original_attempt), outcome: "dead", failureCode: row.terminal_failure,
    recordedAt: row.terminal_time.toISOString(), recordedBy: row.terminal_actor, result: null, generationStatus: null, artifactSha256: null };
  if (!row.valid || fingerprintOf(m) !== row.manifest_sha256 || m.version !== "report-generation-recovery-v1" || m.workspaceId !== row.workspace_id ||
    m.commandId !== row.command_id || m.reasonRef !== row.reason_ref || m.requestedBy !== row.requested_by || m.original.id !== row.original_job_id ||
    m.original.attempt !== Number(row.original_attempt) || !Number.isSafeInteger(m.original.attempt) || m.original.attempt < 1 || m.original.attempt > 5 ||
    row.original_status !== "dead" || Number(row.actual_attempt) !== m.original.attempt || row.original_outcome !== "dead" ||
    m.replacement.id !== row.replacement_job_id || m.replacement.id === m.original.id || row.parent_link !== m.original.id ||
    !row.root_is_scan || row.root_job_id !== m.binding.scanJobId ||
    fingerprintOf(m.binding) !== fingerprintOf(row.original_binding) || fingerprintOf(m.binding) !== fingerprintOf(row.replacement_binding) || fingerprintOf(m.binding) !== fingerprintOf(row.root_binding) ||
    fingerprintOf(m.original.terminal) !== fingerprintOf(terminal) || fingerprintOf(reportScope(m.requiredScope)) !== fingerprintOf(reportScope(row.required_scope))) throw Error("invalid_report_recovery_evidence");
  return { manifest: m, record: { commandId: m.commandId, originalJobId: m.original.id, replacementJobId: m.replacement.id,
    originalAttempt: m.original.attempt, reasonRef: m.reasonRef, requestedBy: m.requestedBy, recordedAt: row.recorded_at.toISOString() } };
}
export async function readGenerationRecoveries(client: PoolClient, workspaceId: string, jobId: string) {
  const rows = (await client.query(generationRecoverySelect + " WHERE r.workspace_id=$1 AND (r.original_job_id=$2 OR r.replacement_job_id=$2) ORDER BY r.command_id LIMIT 3", [workspaceId, jobId])).rows;
  if (rows.length > 2) throw Error("invalid_report_recovery_evidence");
  return rows.map(generationRecoveryOf);
}
