import type { Pool, PoolClient } from "pg";
import { randomUUID } from "node:crypto";
import type { MeasurementScope } from "../measurements/store.ts";
import type { RevalidateReport, StoredReport } from "../reports/store.ts";
import { reportScope, assertReportScope, unionReportScopes } from "../reports/rules.ts";
import { readStoredReportInTransaction } from "../reports/pg-store.ts";
import { readReportScheduleRevision, generationJobOf, validateScan } from "../reports/pg-schedule.ts";
import { exportJobOf } from "../reports/pg-exports.ts";
import { REPORT_GENERATION_MAX_ATTEMPTS } from "../reports/schedule.ts";
import { EXPORT_MAX_ATTEMPTS, REPORT_RENDERER_VERSION, assertExportPublication } from "../reports/exports.ts";
import { readPublicationInTransaction } from "../reports/pg-publication.ts";
import { exportRecoverySelect, exportRecoveryOf, exportRecoveryCommand, readExportRecoveries, type ExportRecoveryManifest } from "./export-recovery.ts";
import { fingerprintOf } from "../aggregation/intervals.ts";
import { jobIdentity } from "../aggregation/refresh-jobs.ts";
import { reportJobList, reportJobQuery, decodeReportJobCursor, encodeReportJobCursor, reportResultRef, emptyReportJobScope,
  normalizeRecoverExportJob, type RecoverExportJob, type ExportRecoveryStore,
  type ReportJobStore, type ReportJobListQuery, type ReportJobQuery, type ReportJobKind, type ReportJobSummary, type ReportJobAttempt } from "./report-jobs.ts";

const scopePredicate = `AND required->>'workspaceId'=$1
  AND required->'sourceIds' <@ $2::jsonb AND required->'stationIds' <@ $3::jsonb
  AND required->'serviceIds' <@ $4::jsonb AND required->'deviceIds' <@ $5::jsonb AND required->'metricKeys' <@ $6::jsonb
  AND (required->'allowSiteParameters'='false'::jsonb OR $7::boolean)`;
function visible(kind: ReportJobKind) {
  return kind === "generation" ? `FROM bsmoss_analysis.report_generation_job j
    JOIN bsmoss_integration.report_schedule_revision c ON (c.workspace_id,c.id,c.revision)=(j.workspace_id,j.schedule_id,j.schedule_revision)
    CROSS JOIN LATERAL (SELECT c.config->'scope' AS required) s WHERE j.workspace_id=$1 ${scopePredicate}`
    : `FROM bsmoss_analysis.report_export_job j
    JOIN bsmoss_analysis.report_revision r ON (r.workspace_id,r.report_id,r.revision,r.manifest_sha256)=(j.workspace_id,j.report_id,j.report_revision,j.manifest_sha256)
    CROSS JOIN LATERAL (SELECT r.manifest->'requiredScope' AS required) s WHERE j.workspace_id=$1 ${scopePredicate}`;
}
const columns = `j.*,j.available_at<=clock_timestamp() AS due,
  to_char(j.requested_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS created_cursor`;
const generationFailures = ["storage_failed", "report_binding_unavailable"], exportFailures = ["report_not_active", "report_stale", "report_incomplete", "export_too_large", "export_renderer_unavailable", "render_failed", "storage_failed"];

export class PgReportJobStore implements ReportJobStore, ExportRecoveryStore {
  readonly workspaceId: string; private readonly scope: MeasurementScope;
  constructor(private readonly pool: Pool, scope: MeasurementScope) { this.scope = reportScope(scope); this.workspaceId = scope.workspaceId; }
  private args() { const s = this.scope; return [s.workspaceId, ...[s.sourceIds, s.stationIds, s.serviceIds, s.deviceIds, s.metricKeys].map(a => JSON.stringify(a)), s.allowSiteParameters]; }
  private async transaction<T>(readOnly: boolean, work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect(); let discard = false;
    try { await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ" + (readOnly ? " READ ONLY" : "")); const result = await work(client); await client.query("COMMIT"); return result; }
    catch (error) { try { await client.query("ROLLBACK"); } catch { discard = true; } throw error; }
    finally { client.release(discard); }
  }
  private async stored(client: PoolClient, reportId: string, revision: string, sha256: string): Promise<StoredReport> {
    const report = await readStoredReportInTransaction(this.scope, { reportId, revision }, client);
    if (!report || report.manifestSha256 !== sha256) throw Error("invalid_report_job_evidence");
    return report;
  }
  private async inspect(client: PoolClient, row: Record<string, any>, kind: ReportJobKind): Promise<{ job: ReportJobSummary; required: MeasurementScope }> {
    let required: MeasurementScope, extra: Pick<ReportJobSummary, "registration" | "publication" | "result" | "artifactSha256" | "grain" | "period">;
    let blocked: "registration_paused" | "registration_changed" | null = null;
    if (kind === "generation") {
      const binding = await readReportScheduleRevision(client, this.workspaceId, row.schedule_id, row.schedule_revision), p = binding.schedule;
      required = p.scope; assertReportScope(this.scope, required);
      const job = generationJobOf(row, binding), scan = (await client.query(`SELECT manifest,manifest_sha256 FROM bsmoss_analysis.report_schedule_scan
        WHERE workspace_id=$1 AND schedule_id=$2 AND schedule_revision=$3 AND scan_hour=$4`, [this.workspaceId, p.id, p.revision, job.scanHour])).rows[0];
      if (!scan || !validateScan(binding, scan.manifest, scan.manifest_sha256).jobs.some(j => j.id === job.id && fingerprintOf(j.period) === fingerprintOf(job.period) && j.dueAt === job.dueAt)) throw Error("invalid_report_job_evidence");
      const current = (await client.query("SELECT revision FROM bsmoss_integration.report_schedule_head WHERE workspace_id=$1 AND id=$2", [this.workspaceId, p.id])).rows[0]?.revision ?? null;
      if (current !== p.revision) blocked = "registration_changed"; else if (p.status === "paused") blocked = "registration_paused";
      if (job.result) {
        const report = await this.stored(client, job.result.reportId, job.result.revision, job.result.manifestSha256);
        assertReportScope(required, report.manifest.requiredScope);
        if (report.manifest.template.code !== p.templateCode || report.manifest.template.version !== p.templateVersion || fingerprintOf(report.manifest.period) !== fingerprintOf(job.period)) throw Error("invalid_report_job_evidence");
      }
      extra = { registration: { id: p.id, revision: p.revision, currentRevision: current, templateCode: p.templateCode, templateVersion: p.templateVersion },
        publication: null, result: job.result, artifactSha256: null, grain: p.grain, period: job.period };
    } else {
      const job = exportJobOf(row), report = await this.stored(client, job.reportId, job.reportRevision, job.manifestSha256);
      required = report.manifest.requiredScope;
      extra = { registration: null, publication: { revision: job.publicationRevision, rendererVersion: job.rendererVersion },
        result: { reportId: job.reportId, revision: job.reportRevision, currentRevision: null, manifestSha256: job.manifestSha256 },
        artifactSha256: job.artifactSha256, grain: report.manifest.grain, period: report.manifest.period };
    }
    jobIdentity(row.requested_by); const attempt = Number(row.attempt), maxAttempts = kind === "generation" ? REPORT_GENERATION_MAX_ATTEMPTS : EXPORT_MAX_ATTEMPTS;
    if (!Number.isSafeInteger(attempt) || attempt < 0 || attempt > maxAttempts || row.status === "pending" && attempt >= maxAttempts || row.status !== "pending" && attempt === 0 ||
      kind === "export" && (row.status === "succeeded") !== (typeof row.artifact_sha256 === "string" && /^[a-f0-9]{64}$/.test(row.artifact_sha256))) throw Error("invalid_report_job_evidence");
    return { required, job: { kind, id: row.id, status: row.status, attempt, maxAttempts, requestedBy: row.requested_by,
      createdAt: row.requested_at.toISOString(), updatedAt: row.updated_at.toISOString(), availableAt: row.available_at.toISOString(),
      readiness: row.status !== "pending" ? "terminal" : blocked ?? (row.due ? "ready" : "delayed"), ...extra } };
  }
  private async history(client: PoolClient, job: ReportJobSummary): Promise<ReportJobAttempt[]> {
    const table = job.kind === "generation" ? "report_generation_attempt" : "report_export_attempt";
    const rows = (await client.query(`SELECT * FROM bsmoss_analysis.${table} WHERE workspace_id=$1 AND job_id=$2 ORDER BY attempt LIMIT $3`, [this.workspaceId, job.id, job.maxAttempts + 1])).rows;
    if (rows.length !== job.attempt || rows.length > job.maxAttempts) throw Error("invalid_report_job_evidence");
    return rows.map((r, i) => {
      const success = r.outcome === "succeeded", failures = job.kind === "generation" ? generationFailures : exportFailures;
      if (Number(r.attempt) !== i + 1 || !["retry", "succeeded", "dead"].includes(r.outcome) || i < rows.length - 1 && r.outcome !== "retry" ||
        (success ? r.failure_code !== null : !failures.includes(r.failure_code)) || i === rows.length - 1 && r.outcome !== (job.status === "pending" ? "retry" : job.status)) throw Error("invalid_report_job_evidence");
      jobIdentity(r.recorded_by); let result = null, generationStatus = null, artifactSha256 = null;
      if (job.kind === "generation") {
        if (success) {
          if (!["inserted", "duplicate"].includes(r.generation_status)) throw Error("invalid_report_job_evidence");
          result = reportResultRef({ reportId: r.report_id, revision: r.report_revision, currentRevision: r.report_current_revision, manifestSha256: r.manifest_sha256 });
          if (fingerprintOf(result) !== fingerprintOf(job.result)) throw Error("invalid_report_job_evidence");
          generationStatus = r.generation_status;
        } else if ([r.report_id, r.report_revision, r.report_current_revision, r.manifest_sha256, r.generation_status].some(x => x !== null)) throw Error("invalid_report_job_evidence");
      } else {
        artifactSha256 = r.artifact_sha256;
        if (success ? artifactSha256 !== job.artifactSha256 : artifactSha256 !== null) throw Error("invalid_report_job_evidence");
      }
      return { attempt: i + 1, outcome: r.outcome, failureCode: r.failure_code, recordedAt: r.recorded_at.toISOString(), recordedBy: r.recorded_by, result, generationStatus, artifactSha256 };
    });
  }
  async list(raw: ReportJobListQuery, revalidate: RevalidateReport) {
    const q = reportJobList(raw), cursor = q.after ? decodeReportJobCursor(q.after) : null;
    return this.transaction(true, async client => {
      const rows = (await client.query(`SELECT ${columns} ${visible(q.kind)}
        AND ($8='all' OR j.status=$8) AND ($9::timestamptz IS NULL OR j.requested_at<$9 OR (j.requested_at=$9 AND j.id COLLATE "C"<$10))
        ORDER BY j.requested_at DESC,j.id COLLATE "C" DESC LIMIT $11`, [...this.args(), q.status, cursor?.createdAt ?? null, cursor?.jobId ?? null, q.limit + 1])).rows;
      const checked = []; for (const row of rows) checked.push(await this.inspect(client, row, q.kind));
      const last = rows[q.limit - 1], next = rows.length > q.limit ? encodeReportJobCursor({ kind: q.kind, status: q.status, createdAt: last.created_cursor, jobId: last.id }) : null;
      await revalidate(unionReportScopes(this.workspaceId, checked.map(v => v.required)));
      return { items: checked.slice(0, q.limit).map(v => v.job), next };
    });
  }
  async read(raw: ReportJobQuery, revalidate: RevalidateReport) {
    const q = reportJobQuery(raw);
    return this.transaction(true, async client => {
      const row = (await client.query(`SELECT ${columns} ${visible(q.kind)} AND j.id=$8`, [...this.args(), q.jobId])).rows[0];
      if (!row) { await revalidate(emptyReportJobScope(this.scope)); return null; }
      const { job, required } = await this.inspect(client, row, q.kind), attempts = await this.history(client, job);
      const links = q.kind === "export" ? await readExportRecoveries(client, this.workspaceId, q.jobId) : [];
      for (const link of links) if (fingerprintOf(link.manifest.requiredScope) !== fingerprintOf(reportScope(required))) throw Error("invalid_report_recovery_evidence");
      await revalidate(required); return { job, attempts, recoveredFrom: links.find(l => l.record.replacementJobId === q.jobId)?.record ?? null,
        recovery: links.find(l => l.record.originalJobId === q.jobId)?.record ?? null };
    });
  }
  async recover(raw: RecoverExportJob, actor: string, revalidate: RevalidateReport) {
    const c = normalizeRecoverExportJob(raw); jobIdentity(actor);
    return this.transaction(false, async client => {
      const row = (await client.query(`SELECT ${columns} ${visible("export")} AND j.id=$8 FOR UPDATE OF j`, [...this.args(), c.jobId])).rows[0];
      if (!row) throw Error("job_unavailable");
      const { job, required } = await this.inspect(client, row, "export"), attempts = await this.history(client, job), old = exportJobOf(row);
      const prior = (await client.query(exportRecoverySelect + " WHERE r.workspace_id=$1 AND r.command_id=$2", [this.workspaceId, c.commandId])).rows[0];
      if (prior) {
        const saved = exportRecoveryOf(prior), m = saved.manifest;
        if (m.original.id !== c.jobId || m.original.attempt !== c.expectedAttempt || m.reasonRef !== c.reasonRef || m.requestedBy !== actor) throw Error("conflicting_job_recovery");
        assertReportScope(this.scope, m.requiredScope); await revalidate(m.requiredScope); return { status: "duplicate" as const, record: saved.record };
      }
      const existing = await client.query("SELECT 1 FROM bsmoss_analysis.report_export_recovery WHERE workspace_id=$1 AND original_job_id=$2", [this.workspaceId, c.jobId]);
      if (existing.rowCount || job.status !== "dead" || job.attempt !== c.expectedAttempt || attempts.at(-1)?.outcome !== "dead") throw Error("job_recovery_conflict");
      // Match the publication writer's RR fence before considering the old
      // release eligible. Replays above confirm history, not today's release.
      const head = await client.query("SELECT current_revision,current_publication_revision FROM bsmoss_analysis.report_series WHERE workspace_id=$1 AND id=$2 FOR UPDATE", [this.workspaceId, old.reportId]);
      if (!head.rowCount) throw Error("report_not_active");
      const state = await readPublicationInTransaction(this.pool, this.scope, { reportId: old.reportId, eventRevision: old.publicationRevision }, client);
      assertExportPublication(state);
      if (state.report.revision !== old.reportRevision || state.report.manifestSha256 !== old.manifestSha256) throw Error("invalid_report_recovery_evidence");
      if (old.rendererVersion !== REPORT_RENDERER_VERSION) throw Error("export_renderer_unavailable");
      const replacement = { id: randomUUID(), commandId: exportRecoveryCommand(this.workspaceId, c.jobId, c.commandId) };
      await client.query(`INSERT INTO bsmoss_analysis.report_export_job(workspace_id,id,report_id,publication_revision,report_revision,manifest_sha256,renderer_version,command_id,requested_by)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [this.workspaceId, replacement.id, old.reportId, old.publicationRevision, old.reportRevision, old.manifestSha256, old.rendererVersion, replacement.commandId, actor]);
      const manifest: ExportRecoveryManifest = { version: "report-export-recovery-v1", workspaceId: this.workspaceId, commandId: c.commandId, reasonRef: c.reasonRef, requestedBy: actor,
        requiredScope: reportScope(required), binding: { reportId: old.reportId, publicationRevision: old.publicationRevision, reportRevision: old.reportRevision, manifestSha256: old.manifestSha256, rendererVersion: old.rendererVersion },
        original: { id: c.jobId, attempt: job.attempt, commandId: old.commandId, requestedBy: old.requestedBy, terminal: attempts.at(-1)! }, replacement };
      await client.query(`INSERT INTO bsmoss_analysis.report_export_recovery(workspace_id,command_id,original_job_id,original_attempt,original_outcome,replacement_job_id,reason_ref,requested_by,manifest,manifest_sha256)
        VALUES($1,$2,$3,$4,'dead',$5,$6,$7,$8,$9)`, [this.workspaceId, c.commandId, c.jobId, job.attempt, replacement.id, c.reasonRef, actor, manifest, fingerprintOf(manifest)]);
      const saved = (await client.query(exportRecoverySelect + " WHERE r.workspace_id=$1 AND r.command_id=$2", [this.workspaceId, c.commandId])).rows[0];
      if (!saved) throw Error("invalid_report_recovery_evidence");
      const record = exportRecoveryOf(saved).record; await revalidate(required); return { status: "inserted" as const, record };
    });
  }
}
