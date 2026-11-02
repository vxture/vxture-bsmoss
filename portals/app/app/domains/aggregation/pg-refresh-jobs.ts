import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import type { AggregateScope } from "./store.ts";
import { failureCode, jobIdentity, leaseSeconds, maxAttempts, retrySeconds, validateRefreshJob, type RefreshJob } from "./refresh-jobs.ts";

export interface RefreshLease {
  id: string;
  token: string;
  attempt: number;
  leaseUntil: string;
  job: RefreshJob;
}
const tuple = (sourceId: string, subjectKey: string, metricKey: string) => JSON.stringify([sourceId, subjectKey, metricKey]);

export async function lockRefreshLease(client: PoolClient, raw: RefreshLease) {
  const lease = structuredClone(raw); validateRefreshJob(lease.job); jobIdentity(lease.id);
  if (!/^[0-9a-f-]{36}$/.test(lease.token) || !Number.isSafeInteger(lease.attempt) || lease.attempt < 1 || lease.attempt > 8) throw Error("invalid_refresh_token");
  const row = (await client.query(`SELECT * FROM bsmoss_analysis.refresh_job WHERE workspace_id=$1 AND id=$2
    AND status='leased' AND lease_token=$3 AND attempt=$4 FOR UPDATE`, [lease.job.workspaceId, lease.id, lease.token, lease.attempt])).rows[0];
  if (!row || row.dedupe_key !== lease.job.dedupeKey) throw Error("refresh_lease_lost");
  if (!(await client.query("SELECT $1::timestamptz>clock_timestamp() AS alive", [row.lease_until])).rows[0].alive) throw Error("refresh_lease_lost");
  return row;
}
// Caller owns the transaction; publication, outbox and receipt commit together.
export async function completeRefreshLease(client: PoolClient, lease: RefreshLease, resultRef: string) {
  jobIdentity(resultRef); await lockRefreshLease(client, lease);
  await client.query(`INSERT INTO bsmoss_analysis.refresh_attempt(workspace_id,job_id,attempt,lease_token,outcome,result_ref)
    VALUES($1,$2,$3,$4,'succeeded',$5)`, [lease.job.workspaceId, lease.id, lease.attempt, lease.token, resultRef]);
  await client.query(`UPDATE bsmoss_analysis.refresh_job SET status='succeeded',lease_token=NULL,lease_until=NULL,updated_at=clock_timestamp()
    WHERE workspace_id=$1 AND id=$2`, [lease.job.workspaceId, lease.id]);
}

// Internal scoped queue adapter. Caller must resolve current worker grants first.
// PgAggregateStore may join publication and its outbox to the same lease fence.
export class PgRefreshJobs {
  readonly workspaceId: string;
  private readonly series: AggregateScope["series"];
  private readonly allowed: Set<string>;
  constructor(private readonly pool: Pool, scope: AggregateScope) {
    jobIdentity(scope.workspaceId); this.workspaceId = scope.workspaceId;
    if (!Array.isArray(scope.series) || scope.series.length > 10000) throw Error("invalid_refresh_scope");
    this.series = structuredClone(scope.series);
    this.allowed = new Set(this.series.map(s => {
      [s.sourceId, s.subjectKey, s.metricKey].forEach(jobIdentity);
      return tuple(s.sourceId, s.subjectKey, s.metricKey);
    }));
  }
  private check(job: RefreshJob) {
    if (job.workspaceId !== this.workspaceId || !this.allowed.has(tuple(job.sourceId, job.subjectKey, job.metricKey))) throw Error("refresh_scope_denied");
  }
  async enqueue(raw: RefreshJob, attempts = 5) {
    const job = validateRefreshJob(raw); this.check(job); maxAttempts(attempts);
    const client = await this.pool.connect(); let discard = false;
    try {
      await client.query("BEGIN");
      const inserted = (await client.query(`INSERT INTO bsmoss_analysis.refresh_job(workspace_id,id,dedupe_key,source_id,subject_key,metric_key,mapping_id,trigger_ref,target,max_attempts)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(workspace_id,dedupe_key) DO NOTHING RETURNING id`,
      [this.workspaceId, randomUUID(), job.dedupeKey, job.sourceId, job.subjectKey, job.metricKey, job.target.mappingId, job.triggerRef, job.target, attempts])).rows[0];
      const row = inserted ?? (await client.query("SELECT id,source_id,subject_key,metric_key,trigger_ref,max_attempts FROM bsmoss_analysis.refresh_job WHERE workspace_id=$1 AND dedupe_key=$2",
        [this.workspaceId, job.dedupeKey])).rows[0];
      if (!inserted && (!row || row.source_id !== job.sourceId || row.subject_key !== job.subjectKey || row.metric_key !== job.metricKey || row.trigger_ref !== job.triggerRef || Number(row.max_attempts) !== attempts)) throw Error("conflicting_refresh_replay");
      await client.query("COMMIT");
      return { id: row.id as string, status: inserted ? "inserted" as const : "duplicate" as const };
    } catch (error) { try { await client.query("ROLLBACK"); } catch { discard = true; } throw error; }
    finally { client.release(discard); }
  }
  async claim(ttlSeconds = 60): Promise<RefreshLease | null> {
    leaseSeconds(ttlSeconds);
    if (!this.series.length) return null;
    const client = await this.pool.connect(); let discard = false;
    try {
      await client.query("BEGIN");
      const row = (await client.query(`SELECT j.* FROM bsmoss_analysis.refresh_job j WHERE j.workspace_id=$1
        AND EXISTS (SELECT 1 FROM jsonb_to_recordset($2::jsonb) AS s("sourceId" text,"subjectKey" text,"metricKey" text)
          WHERE (s."sourceId",s."subjectKey",s."metricKey")=(j.source_id,j.subject_key,j.metric_key))
        AND ((j.status='pending' AND j.available_at<=clock_timestamp()) OR (j.status='leased' AND j.lease_until<=clock_timestamp()))
        ORDER BY j.available_at,j.created_at,j.id LIMIT 1 FOR UPDATE OF j SKIP LOCKED`, [this.workspaceId, JSON.stringify(this.series)])).rows[0];
      if (!row) { await client.query("COMMIT"); return null; }
      const attempt = Number(row.attempt);
      if (row.status === "leased") {
        await client.query(`INSERT INTO bsmoss_analysis.refresh_attempt(workspace_id,job_id,attempt,lease_token,outcome,failure_code)
          VALUES($1,$2,$3,$4,'expired','lease_expired')`, [this.workspaceId, row.id, attempt, row.lease_token]);
      }
      if (attempt >= Number(row.max_attempts)) {
        await client.query("UPDATE bsmoss_analysis.refresh_job SET status='dead',lease_token=NULL,lease_until=NULL,updated_at=clock_timestamp() WHERE workspace_id=$1 AND id=$2", [this.workspaceId, row.id]);
        await client.query("COMMIT"); return null;
      }
      const token = randomUUID();
      const updated = (await client.query(`UPDATE bsmoss_analysis.refresh_job SET status='leased',attempt=attempt+1,lease_token=$3,
        lease_until=clock_timestamp()+make_interval(secs=>$4),updated_at=clock_timestamp() WHERE workspace_id=$1 AND id=$2 RETURNING lease_until`,
      [this.workspaceId, row.id, token, ttlSeconds])).rows[0];
      const job = validateRefreshJob({ workspaceId: this.workspaceId, sourceId: row.source_id, subjectKey: row.subject_key,
        metricKey: row.metric_key, target: row.target, triggerRef: row.trigger_ref, dedupeKey: row.dedupe_key }); this.check(job);
      await client.query("COMMIT");
      return { id: row.id, token, attempt: attempt + 1, leaseUntil: updated.lease_until.toISOString(), job };
    } catch (error) { try { await client.query("ROLLBACK"); } catch { discard = true; } throw error; }
    finally { client.release(discard); }
  }
  private async transition(raw: RefreshLease, action: { kind: "renew"; seconds: number } | { kind: "succeeded"; resultRef: string } | { kind: "failed"; code: string }) {
    const lease = structuredClone(raw); this.check(validateRefreshJob(lease.job)); jobIdentity(lease.id);
    if (!/^[0-9a-f-]{36}$/.test(lease.token) || !Number.isSafeInteger(lease.attempt) || lease.attempt < 1 || lease.attempt > 8) throw Error("invalid_refresh_token");
    const client = await this.pool.connect(); let discard = false;
    try {
      await client.query("BEGIN");
      const row = await lockRefreshLease(client, lease);
      if (action.kind === "renew") {
        const renewed = (await client.query(`UPDATE bsmoss_analysis.refresh_job SET lease_until=clock_timestamp()+make_interval(secs=>$3),updated_at=clock_timestamp()
          WHERE workspace_id=$1 AND id=$2 RETURNING lease_until`, [this.workspaceId, lease.id, action.seconds])).rows[0];
        await client.query("COMMIT"); return { ...lease, leaseUntil: renewed.lease_until.toISOString() };
      }
      const outcome = action.kind === "succeeded" ? "succeeded" : lease.attempt >= Number(row.max_attempts) ? "dead" : "retry";
      await client.query(`INSERT INTO bsmoss_analysis.refresh_attempt(workspace_id,job_id,attempt,lease_token,outcome,failure_code,result_ref)
        VALUES($1,$2,$3,$4,$5,$6,$7)`, [this.workspaceId, lease.id, lease.attempt, lease.token, outcome, action.kind === "failed" ? action.code : null, action.kind === "succeeded" ? action.resultRef : null]);
      await client.query(`UPDATE bsmoss_analysis.refresh_job SET status=$3,lease_token=NULL,lease_until=NULL,
        available_at=clock_timestamp()+make_interval(secs=>$4),updated_at=clock_timestamp() WHERE workspace_id=$1 AND id=$2`,
      [this.workspaceId, lease.id, outcome === "retry" ? "pending" : outcome, outcome === "retry" ? retrySeconds(lease.attempt) : 0]);
      await client.query("COMMIT"); return null;
    } catch (error) { try { await client.query("ROLLBACK"); } catch { discard = true; } throw error; }
    finally { client.release(discard); }
  }
  async renew(lease: RefreshLease, seconds = 60) { leaseSeconds(seconds); return (await this.transition(lease, { kind: "renew", seconds }))!; }
  async succeed(lease: RefreshLease, resultRef: string) { jobIdentity(resultRef); await this.transition(lease, { kind: "succeeded", resultRef }); }
  async fail(lease: RefreshLease, code: string) { failureCode(code); await this.transition(lease, { kind: "failed", code }); }
}
