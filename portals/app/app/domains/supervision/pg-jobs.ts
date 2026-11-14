import type { Pool, PoolClient } from "pg";
import type { MeasurementScope } from "../measurements/store.ts";
import { assertReportScope, reportScope, unionReportScopes, fields } from "../reports/rules.ts";
import { mappedSubject } from "../aggregation/subjects.ts";
import { jobIdentity, validateRefreshJob, planRefreshJob, failureCode, type RefreshJob } from "../aggregation/refresh-jobs.ts";
import { fingerprintOf } from "../aggregation/intervals.ts";
import { PgRefreshJobs } from "../aggregation/pg-refresh-jobs.ts";
import { readRefreshSnapshot } from "../aggregation/refresh-snapshot.ts";
import { decodeJobCursor, encodeJobCursor, normalizeJobList, normalizeJobQuery, normalizeRecoverJob, jobScope, recoveryScope, reviewedRecoveryScope,
  type RecoveryInputPolicy,
  type AggregateJobStore, type JobListQuery, type JobQuery, type RecoverJob, type JobSummary, type JobAttempt, type RecoveryRecord, type RevalidateJob } from "./jobs.ts";

function refreshJob(row: Record<string, any>): RefreshJob {
  return validateRefreshJob({ workspaceId: row.workspace_id, sourceId: row.source_id, subjectKey: row.subject_key, metricKey: row.metric_key,
    target: row.target, triggerRef: row.trigger_ref, dedupeKey: row.dedupe_key });
}
function summary(row: Record<string, any>): JobSummary {
  const job = refreshJob(row); jobIdentity(row.id); const attempt = Number(row.attempt), max = Number(row.max_attempts);
  if (!["pending", "leased", "succeeded", "dead"].includes(row.status) || !Number.isSafeInteger(attempt) || !Number.isSafeInteger(max) || max < 1 || max > 8 || attempt < 0 || attempt > max ||
    (row.status === "leased") !== (row.lease_until !== null && row.lease_token !== null) || row.status !== "pending" && attempt === 0 || row.status === "pending" && attempt >= max) throw Error("invalid_job_evidence");
  return { id: row.id, status: row.status, attempt, maxAttempts: max, target: job.target, createdAt: row.created_at.toISOString(),
    availableAt: row.available_at.toISOString(), updatedAt: row.updated_at.toISOString(), leaseUntil: row.lease_until?.toISOString() ?? null,
    readiness: row.status === "pending" ? row.due ? "ready" : "delayed" : row.status === "leased" ? row.expired ? "lease_expired" : "running" : "terminal" };
}
async function attempts(client: PoolClient, row: Record<string, any>): Promise<JobAttempt[]> {
  const rows = (await client.query("SELECT * FROM bsmoss_analysis.refresh_attempt WHERE workspace_id=$1 AND job_id=$2 ORDER BY attempt LIMIT 9", [row.workspace_id, row.id])).rows;
  const j = summary(row), expected = j.status === "leased" ? j.attempt - 1 : j.attempt;
  if (rows.length !== expected || rows.length > 8) throw Error("invalid_job_evidence");
  return rows.map((r, i) => {
    const attempt = Number(r.attempt);
    if (attempt !== i + 1 || !["retry", "expired", "succeeded", "dead"].includes(r.outcome) ||
      i < rows.length - 1 && !["retry", "expired"].includes(r.outcome) ||
      (r.outcome === "succeeded") !== (r.result_ref !== null && r.failure_code === null)) throw Error("invalid_job_evidence");
    if (r.failure_code !== null) failureCode(r.failure_code); if (r.result_ref !== null) jobIdentity(r.result_ref);
    if (i === rows.length - 1 && (j.status === "succeeded" && r.outcome !== "succeeded" || j.status === "dead" && !["dead", "expired"].includes(r.outcome) ||
      j.status === "pending" && r.outcome !== "retry")) throw Error("invalid_job_evidence");
    return { attempt, outcome: r.outcome, failureCode: r.failure_code, resultRef: r.result_ref, recordedAt: r.recorded_at.toISOString() };
  });
}
interface RecoveryManifest {
  version: "aggregate-recovery-v1"; workspaceId: string; commandId: string; reasonRef: string; requestedBy: string; requiredScope: MeasurementScope;
  inputPolicy: RecoveryInputPolicy;
  original: { id: string; attempt: number; maxAttempts: number; job: RefreshJob; terminal: JobAttempt };
  replacement: { id: string; job: RefreshJob };
}
function recovery(row: Record<string, any>): { record: RecoveryRecord; manifest: RecoveryManifest } {
  const m = row.manifest as RecoveryManifest;
  fields(m, ["version", "workspaceId", "commandId", "reasonRef", "requestedBy", "requiredScope", "inputPolicy", "original", "replacement"]);
  fields(m.original, ["id", "attempt", "maxAttempts", "job", "terminal"]); fields(m.replacement, ["id", "job"]);
  const old = validateRefreshJob(m.original.job), next = validateRefreshJob(m.replacement.job);
  [m.commandId, m.reasonRef, m.requestedBy, m.original.id, m.replacement.id].forEach(jobIdentity);
  const need = reportScope(m.requiredScope);
  if (!row.valid || fingerprintOf(m) !== row.manifest_sha256 || m.version !== "aggregate-recovery-v1" || m.workspaceId !== row.workspace_id ||
    m.commandId !== row.command_id || m.original.id !== row.original_job_id || m.replacement.id !== row.replacement_job_id || m.original.attempt !== Number(row.original_attempt) ||
    m.original.terminal.attempt !== m.original.attempt || !["dead", "expired"].includes(m.original.terminal.outcome) || m.original.terminal.outcome !== row.original_outcome ||
    m.requestedBy !== row.requested_by || m.reasonRef !== row.reason_ref || old.workspaceId !== m.workspaceId || next.workspaceId !== m.workspaceId ||
    old.sourceId !== next.sourceId || old.subjectKey !== next.subjectKey || old.metricKey !== next.metricKey || fingerprintOf(old.target) !== fingerprintOf(next.target) ||
    next.triggerRef !== "reviewed-recovery:" + fingerprintOf([m.workspaceId, m.original.id, m.commandId]) || m.original.id === m.replacement.id) throw Error("invalid_job_recovery_evidence");
  if (fingerprintOf(reviewedRecoveryScope(old, m.inputPolicy, need.metricKeys)) !== fingerprintOf(need)) throw Error("invalid_job_recovery_evidence");
  if (row.terminal_failure !== undefined && (m.original.terminal.failureCode !== row.terminal_failure || m.original.terminal.resultRef !== row.terminal_result ||
    m.original.terminal.recordedAt !== row.terminal_recorded_at.toISOString())) throw Error("invalid_job_recovery_evidence");
  return { manifest: m, record: { commandId: m.commandId, originalJobId: m.original.id, replacementJobId: m.replacement.id, originalAttempt: m.original.attempt,
    reasonRef: m.reasonRef, requestedBy: m.requestedBy, recordedAt: row.recorded_at.toISOString() } };
}
const recoverySelect = `SELECT r.*,r.database_sha256=encode(sha256(convert_to(r.manifest::text,'UTF8')),'hex') valid,
  a.failure_code terminal_failure,a.result_ref terminal_result,a.recorded_at terminal_recorded_at FROM bsmoss_analysis.refresh_recovery r
  JOIN bsmoss_analysis.refresh_attempt a ON (a.workspace_id,a.job_id,a.attempt,a.outcome)=(r.workspace_id,r.original_job_id,r.original_attempt,r.original_outcome)`;
const columns = `j.*,j.available_at<=clock_timestamp() AS due,j.lease_until<=clock_timestamp() AS expired,
  to_char(j.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS created_cursor,
  m.station_id,m.service_id,m.network_object_id,m.device_id`;
const fromVisible = `FROM bsmoss_analysis.refresh_job j JOIN bsmoss_integration.source_mapping m
  ON (m.workspace_id,m.id,m.source_id)=(j.workspace_id,j.mapping_id,j.source_id)
  WHERE j.workspace_id=$1 AND j.source_id=ANY($2::text[]) AND m.station_id=ANY($3::text[]) AND j.metric_key=ANY($4::text[])
  AND (m.service_id IS NULL OR m.service_id=ANY($5::text[])) AND (m.device_id IS NULL OR m.device_id=ANY($6::text[]))
  AND (m.service_id IS NOT NULL OR m.device_id IS NOT NULL OR $7::boolean)`;

export class PgAggregateJobStore implements AggregateJobStore {
  readonly workspaceId: string; private readonly scope: MeasurementScope;
  constructor(private readonly pool: Pool, scope: MeasurementScope) { this.scope = reportScope(scope); this.workspaceId = scope.workspaceId; }
  private args() { const s = this.scope; return [s.workspaceId, s.sourceIds, s.stationIds, s.metricKeys, s.serviceIds, s.deviceIds, s.allowSiteParameters]; }
  private empty() { return reportScope({ ...this.scope, sourceIds: [], stationIds: [], metricKeys: [], serviceIds: [], deviceIds: [], allowSiteParameters: false }); }
  private validate(row: Record<string, any>) {
    if (row.subject_key !== mappedSubject(row.station_id, row.service_id, row.network_object_id, row.device_id)) throw Error("invalid_job_evidence");
    const job = refreshJob(row); assertReportScope(this.scope, jobScope(job)); return job;
  }
  private async transaction<T>(readOnly: boolean, work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect(); let discard = false;
    try { await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ" + (readOnly ? " READ ONLY" : "")); const r = await work(client); await client.query("COMMIT"); return r; }
    catch (error) { try { await client.query("ROLLBACK"); } catch { discard = true; } throw error; }
    finally { client.release(discard); }
  }
  async list(raw: JobListQuery, revalidate: RevalidateJob) {
    const q = normalizeJobList(raw), cursor = q.after ? decodeJobCursor(q.after) : null;
    return this.transaction(true, async client => {
      const rows = (await client.query(`SELECT ${columns} ${fromVisible}
        AND ($8='all' OR j.status=$8) AND ($9::timestamptz IS NULL OR j.created_at<$9 OR (j.created_at=$9 AND j.id COLLATE "C"<$10))
        ORDER BY j.created_at DESC,j.id COLLATE "C" DESC LIMIT $11`, [...this.args(), q.status, cursor?.createdAt ?? null, cursor?.jobId ?? null, q.limit + 1])).rows;
      // The lookahead is also validated and reauthorized before it influences
      // next-page visibility; no hidden tenant total is returned.
      const jobs = rows.map(r => this.validate(r)), items = rows.slice(0, q.limit).map(summary), last = rows[q.limit - 1];
      const next = rows.length > q.limit ? encodeJobCursor({ createdAt: last.created_cursor, jobId: last.id, status: q.status }) : null;
      await revalidate(unionReportScopes(this.workspaceId, jobs.map(jobScope))); return { items, next };
    });
  }
  async read(raw: JobQuery, revalidate: RevalidateJob) {
    const q = normalizeJobQuery(raw);
    return this.transaction(true, async client => {
      const row = (await client.query(`SELECT ${columns} ${fromVisible} AND j.id=$8`, [...this.args(), q.jobId])).rows[0];
      if (!row) { await revalidate(this.empty()); return null; }
      const job = this.validate(row), history = await attempts(client, row);
      const links = (await client.query(recoverySelect + " WHERE r.workspace_id=$1 AND (original_job_id=$2 OR replacement_job_id=$2) ORDER BY command_id LIMIT 3", [this.workspaceId, q.jobId])).rows.map(recovery);
      if (links.length > 2) throw Error("invalid_job_recovery_evidence");
      for (const link of links) if (fingerprintOf(link.manifest.original.id === q.jobId ? link.manifest.original.job : link.manifest.replacement.job) !== fingerprintOf(job)) throw Error("invalid_job_recovery_evidence");
      await revalidate(jobScope(job));
      return { job: summary(row), attempts: history, recoveredFrom: links.find(l => l.record.replacementJobId === q.jobId)?.record ?? null,
        recovery: links.find(l => l.record.originalJobId === q.jobId)?.record ?? null };
    });
  }
  async recover(raw: RecoverJob, actor: string, revalidate: RevalidateJob) {
    const c = normalizeRecoverJob(raw); jobIdentity(actor);
    return this.transaction(false, async client => {
      const row = (await client.query(`SELECT ${columns} ${fromVisible} AND j.id=$8 FOR UPDATE OF j`, [...this.args(), c.jobId])).rows[0];
      if (!row) throw Error("job_unavailable");
      const job = this.validate(row), original = summary(row), history = await attempts(client, row);
      const prior = (await client.query(recoverySelect + " WHERE r.workspace_id=$1 AND command_id=$2", [this.workspaceId, c.commandId])).rows[0];
      if (prior) {
        const saved = recovery(prior), m = saved.manifest;
        if (m.original.id !== c.jobId || m.original.attempt !== c.expectedAttempt || m.reasonRef !== c.reasonRef || m.requestedBy !== actor ||
          fingerprintOf(m.original.job) !== fingerprintOf(job)) throw Error("conflicting_job_recovery");
        assertReportScope(this.scope, m.requiredScope); await revalidate(m.requiredScope); return { status: "duplicate" as const, record: saved.record };
      }
      const existing = await client.query("SELECT 1 FROM bsmoss_analysis.refresh_recovery WHERE workspace_id=$1 AND original_job_id=$2", [this.workspaceId, c.jobId]);
      if (existing.rowCount || original.status !== "dead" || original.attempt !== c.expectedAttempt || !history.length || !["dead", "expired"].includes(history.at(-1)!.outcome)) throw Error("job_recovery_conflict");
      // A reviewed recovery must load current real scope and source policy. It
      // does not assert completeness or publish a fabricated zero result.
      const snapshot = await readRefreshSnapshot(this.pool, this.scope, job.target, client), required = recoveryScope(job, snapshot, this.scope);
      assertReportScope(this.scope, required);
      const replacement = planRefreshJob(snapshot, job.target, "reviewed-recovery:" + fingerprintOf([this.workspaceId, c.jobId, c.commandId]));
      const queue = new PgRefreshJobs(this.pool, { workspaceId: this.workspaceId, series: [{ sourceId: job.sourceId, subjectKey: job.subjectKey, metricKey: job.metricKey }] }, client);
      const queued = await queue.enqueue(replacement, original.maxAttempts); if (queued.status !== "inserted") throw Error("invalid_job_recovery_evidence");
      const manifest: RecoveryManifest = { version: "aggregate-recovery-v1", workspaceId: this.workspaceId, commandId: c.commandId, reasonRef: c.reasonRef, requestedBy: actor, requiredScope: required,
        inputPolicy: { kind: snapshot.kind, inputMode: snapshot.kind === "interval" ? snapshot.plan.inputMode : null },
        original: { id: c.jobId, attempt: original.attempt, maxAttempts: original.maxAttempts, job, terminal: history.at(-1)! }, replacement: { id: queued.id, job: replacement } };
      const inserted = (await client.query(`INSERT INTO bsmoss_analysis.refresh_recovery(workspace_id,command_id,original_job_id,original_attempt,original_outcome,replacement_job_id,reason_ref,requested_by,manifest,manifest_sha256)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *,database_sha256=encode(sha256(convert_to(manifest::text,'UTF8')),'hex') valid`,
      [this.workspaceId, c.commandId, c.jobId, original.attempt, history.at(-1)!.outcome, queued.id, c.reasonRef, actor, manifest, fingerprintOf(manifest)])).rows[0];
      await revalidate(required); return { status: "inserted" as const, record: recovery(inserted).record };
    });
  }
}
