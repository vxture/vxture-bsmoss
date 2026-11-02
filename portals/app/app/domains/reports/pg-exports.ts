import { randomUUID, createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import type { MeasurementScope } from "../measurements/store.ts";
import { jobIdentity } from "../aggregation/refresh-jobs.ts";
import { positiveRevision } from "../aggregation/intervals.ts";
import { reportScope } from "./rules.ts";
import { readStoredReportInTransaction } from "./pg-store.ts";
import { readPublicationInTransaction } from "./pg-publication.ts";
import { renderPublishedReport } from "./render-html.ts";
import { assertExportPublication, normalizeExportRequest, normalizeExportQuery, exportFailure, exportRetrySeconds,
  REPORT_RENDERER_VERSION, EXPORT_MAX_ATTEMPTS, EXPORT_MAX_BYTES, type ExportRequest, type ExportQuery, type ExportJob,
  type ExportRun, type ReportExportStore } from "./exports.ts";
import type { RevalidateReport } from "./store.ts";

function jobOf(row: Record<string, any>): ExportJob {
  [row.id, row.report_id, row.command_id, row.requested_by, row.renderer_version].forEach(jobIdentity);
  positiveRevision(row.report_revision); positiveRevision(row.publication_revision);
  const attempt = Number(row.attempt);
  if (!["pending", "succeeded", "dead"].includes(row.status) || !Number.isSafeInteger(attempt) || attempt < 0 || attempt > EXPORT_MAX_ATTEMPTS ||
      !/^[a-f0-9]{64}$/.test(row.manifest_sha256)) throw Error("invalid_export_job");
  return { jobId: row.id, reportId: row.report_id, publicationRevision: row.publication_revision, reportRevision: row.report_revision,
    manifestSha256: row.manifest_sha256, rendererVersion: row.renderer_version, commandId: row.command_id,
    requestedBy: row.requested_by, requestedAt: row.requested_at.toISOString(), status: row.status, attempt,
    availableAt: row.available_at.toISOString(), artifactSha256: row.artifact_sha256 };
}

export class PgReportExportStore implements ReportExportStore {
  readonly workspaceId: string;
  private readonly scope: MeasurementScope;
  constructor(private readonly pool: Pool, scope: MeasurementScope, private readonly render = renderPublishedReport) {
    this.scope = reportScope(scope); this.workspaceId = this.scope.workspaceId;
  }
  private async transaction<T>(readOnly: boolean, work: (client: PoolClient) => Promise<T>) {
    const client = await this.pool.connect(); let discard = false;
    try { await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ" + (readOnly ? " READ ONLY" : "")); const result = await work(client); await client.query("COMMIT"); return result; }
    catch (error) { try { await client.query("ROLLBACK"); } catch { discard = true; } throw error; }
    finally { client.release(discard); }
  }
  private emptyScope() { return reportScope({ ...this.scope, sourceIds: [], stationIds: [], serviceIds: [], deviceIds: [], metricKeys: [], allowSiteParameters: false }); }
  private async required(client: PoolClient, job: ExportJob) {
    const record = await readStoredReportInTransaction(this.scope, { reportId: job.reportId, revision: job.reportRevision }, client);
    if (!record || record.manifestSha256 !== job.manifestSha256) throw Error("invalid_export_job");
    return record.manifest.requiredScope;
  }
  private async publication(client: PoolClient, job: Pick<ExportJob, "reportId" | "publicationRevision">) {
    return readPublicationInTransaction(this.pool, this.scope, { reportId: job.reportId, eventRevision: job.publicationRevision }, client);
  }
  private async fence(client: PoolClient, reportId: string) {
    const head = await client.query("SELECT current_revision,current_publication_revision FROM bsmoss_analysis.report_series WHERE workspace_id=$1 AND id=$2 FOR UPDATE", [this.workspaceId, reportId]);
    if (!head.rowCount) throw Error("report_not_active");
  }
  async request(raw: ExportRequest, actor: string, revalidate: RevalidateReport) {
    const command = normalizeExportRequest(raw); jobIdentity(actor);
    return this.transaction(false, async client => {
      await this.fence(client, command.reportId);
      const state = await this.publication(client, command); assertExportPublication(state);
      const candidate = { reportId: command.reportId, publicationRevision: command.publicationRevision, reportRevision: state.report.revision,
        manifestSha256: state.report.manifestSha256, rendererVersion: REPORT_RENDERER_VERSION };
      const inserted = (await client.query(`INSERT INTO bsmoss_analysis.report_export_job
        (workspace_id,id,report_id,publication_revision,report_revision,manifest_sha256,renderer_version,command_id,requested_by)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(workspace_id,command_id) DO NOTHING RETURNING *`,
      [this.workspaceId, randomUUID(), candidate.reportId, candidate.publicationRevision, candidate.reportRevision, candidate.manifestSha256, candidate.rendererVersion, command.commandId, actor])).rows[0];
      const row = inserted ?? (await client.query("SELECT * FROM bsmoss_analysis.report_export_job WHERE workspace_id=$1 AND command_id=$2", [this.workspaceId, command.commandId])).rows[0];
      if (!row) throw Error("conflicting_export_replay");
      const job = jobOf(row);
      if (job.reportId !== candidate.reportId || job.publicationRevision !== candidate.publicationRevision || job.reportRevision !== candidate.reportRevision ||
          job.manifestSha256 !== candidate.manifestSha256 || job.requestedBy !== actor) throw Error("conflicting_export_replay");
      await revalidate(state.report.manifest.requiredScope); return { status: inserted ? "inserted" as const : "duplicate" as const, job };
    });
  }
  async run(raw: ExportQuery, actor: string, revalidate: RevalidateReport): Promise<ExportRun> {
    const query = normalizeExportQuery(raw); jobIdentity(actor);
    return this.transaction(false, async client => {
      const row = (await client.query(`SELECT *,available_at<=clock_timestamp() AS due FROM bsmoss_analysis.report_export_job
        WHERE workspace_id=$1 AND id=$2 FOR UPDATE SKIP LOCKED`, [this.workspaceId, query.jobId])).rows[0];
      if (!row) { await revalidate(this.emptyScope()); return { status: "busy_or_unavailable" }; }
      const job = jobOf(row), required = await this.required(client, job);
      if (job.status !== "pending" || !row.due) { await revalidate(required); return { status: job.status !== "pending" ? "terminal" : "delayed", job }; }
      if (job.attempt >= EXPORT_MAX_ATTEMPTS) throw Error("invalid_export_job");
      const attempt = job.attempt + 1; let outcome: "succeeded" | "retry" | "dead", failureCode: string | null = null, sha256: string | null = null;
      await client.query("SAVEPOINT export_work");
      try {
        await this.fence(client, job.reportId);
        const state = await this.publication(client, job); assertExportPublication(state);
        if (state.report.revision !== job.reportRevision || state.report.manifestSha256 !== job.manifestSha256) throw Error("invalid_export_job");
        if (job.rendererVersion !== REPORT_RENDERER_VERSION) throw Error("export_renderer_unavailable");
        const rendered = this.render(state);
        if (Buffer.byteLength(rendered.html, "utf8") > EXPORT_MAX_BYTES) throw Error("export_too_large");
        await client.query(`INSERT INTO bsmoss_analysis.report_export_artifact(workspace_id,job_id,renderer_version,html,content_sha256,created_by)
          VALUES($1,$2,$3,$4,$5,$6)`, [this.workspaceId, job.jobId, job.rendererVersion, rendered.html, rendered.sha256, actor]);
        sha256 = rendered.sha256; outcome = "succeeded";
        await client.query("RELEASE SAVEPOINT export_work");
      } catch (error) {
        await client.query("ROLLBACK TO SAVEPOINT export_work"); const failure = exportFailure(error); if (!failure) throw error;
        failureCode = failure.code; outcome = failure.terminal || attempt >= EXPORT_MAX_ATTEMPTS ? "dead" : "retry";
        await client.query("RELEASE SAVEPOINT export_work");
      }
      await client.query(`INSERT INTO bsmoss_analysis.report_export_attempt(workspace_id,job_id,attempt,outcome,failure_code,artifact_sha256,recorded_by)
        VALUES($1,$2,$3,$4,$5,$6,$7)`, [this.workspaceId, job.jobId, attempt, outcome, failureCode, sha256, actor]);
      const updated = (await client.query(`UPDATE bsmoss_analysis.report_export_job SET attempt=$3,status=$4,artifact_sha256=$5,
        available_at=clock_timestamp()+make_interval(secs=>$6),updated_at=clock_timestamp() WHERE workspace_id=$1 AND id=$2 RETURNING *`,
      [this.workspaceId, job.jobId, attempt, outcome === "retry" ? "pending" : outcome, sha256, outcome === "retry" ? exportRetrySeconds(attempt) : 0])).rows[0];
      await revalidate(required); return { status: outcome, job: jobOf(updated) };
    });
  }
  async status(raw: ExportQuery, revalidate: RevalidateReport) {
    const query = normalizeExportQuery(raw);
    return this.transaction(true, async client => {
      const row = (await client.query("SELECT * FROM bsmoss_analysis.report_export_job WHERE workspace_id=$1 AND id=$2", [this.workspaceId, query.jobId])).rows[0];
      if (!row) { await revalidate(this.emptyScope()); return null; }
      const job = jobOf(row), required = await this.required(client, job), state = await this.publication(client, job);
      let blockingReason: string | null = null;
      try { assertExportPublication(state); } catch (error) { const failure = exportFailure(error); if (!failure) throw error; blockingReason = failure.code; }
      if (job.rendererVersion !== REPORT_RENDERER_VERSION) blockingReason ??= "export_renderer_unavailable";
      if (job.status !== "succeeded") blockingReason ??= job.status;
      await revalidate(required); return { job, downloadable: blockingReason === null, blockingReason };
    });
  }
  async download(raw: ExportQuery, revalidate: RevalidateReport) {
    const query = normalizeExportQuery(raw);
    return this.transaction(true, async client => {
      const row = (await client.query("SELECT * FROM bsmoss_analysis.report_export_job WHERE workspace_id=$1 AND id=$2", [this.workspaceId, query.jobId])).rows[0];
      if (!row) { await revalidate(this.emptyScope()); return null; }
      const job = jobOf(row), required = await this.required(client, job);
      if (job.status !== "succeeded") { await revalidate(required); return null; }
      const state = await this.publication(client, job); assertExportPublication(state);
      if (job.rendererVersion !== REPORT_RENDERER_VERSION) throw Error("export_renderer_unavailable");
      if (state.report.revision !== job.reportRevision || state.report.manifestSha256 !== job.manifestSha256) throw Error("invalid_export_job");
      const artifact = (await client.query("SELECT * FROM bsmoss_analysis.report_export_artifact WHERE workspace_id=$1 AND job_id=$2", [this.workspaceId, job.jobId])).rows[0];
      const expected = renderPublishedReport(state);
      if (!artifact || artifact.renderer_version !== job.rendererVersion || artifact.content_sha256 !== job.artifactSha256 || artifact.content_sha256 !== expected.sha256 ||
          Buffer.byteLength(artifact.html, "utf8") > EXPORT_MAX_BYTES || createHash("sha256").update(artifact.html).digest("hex") !== expected.sha256) throw Error("invalid_export_artifact");
      await revalidate(required); return { html: artifact.html as string, sha256: artifact.content_sha256 as string, filename: "bsmoss-report-" + artifact.content_sha256 + ".html" };
    });
  }
}
