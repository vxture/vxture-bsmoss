import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { refKey } from "../catalog/registry.ts";
import { timestamp } from "../measurements/rules.ts";
import { positiveRevision, type AggregateValue } from "./intervals.ts";
import { bucketFor } from "./periods.ts";
import type { AggregateKey, AggregateScope } from "./store.ts";
import type { aggregateStatePeriod } from "./state-period.ts";
import type { aggregateGaugePeriod } from "./gauge-period.ts";
import { completeRefreshLease, lockRefreshLease, type RefreshLease } from "./pg-refresh-jobs.ts";
import { validateRefreshJob } from "./refresh-jobs.ts";

const identity = (value: string) => {
  if (typeof value !== "string" || !value.trim() || value.trim() !== value || value === "*" || value.includes("\0")) throw new Error("invalid_aggregate_identity");
};
const scopeKey = (sourceId: string, subjectKey: string, metricKey: string) => JSON.stringify([sourceId, subjectKey, metricKey]);

type StateValue = ReturnType<typeof aggregateStatePeriod>["value"];
type GaugeValue = ReturnType<typeof aggregateGaugePeriod>["value"];
export interface PersistedAggregateResult {
  value: AggregateValue | StateValue | GaugeValue | null;
  aggregationVersion: string; inputFingerprint: string; watermark: string; completeness: string;
}
export interface StoredAggregateResult<R> { seriesId: string; revision: string; publishedBy: string; createdAt: string; result: R }
// Internal persistence mechanism. Product adapters own the pure calculator;
// neither routes nor job payloads may supply it or a precomputed result.
export class PgAggregateRepository<P extends AggregateKey & { workspaceId: string }, I, R extends PersistedAggregateResult> {
  readonly workspaceId: string;
  private readonly allowed: ReadonlySet<string>;
  private readonly lease?: RefreshLease;
  constructor(private readonly pool: Pool, scope: AggregateScope, private readonly calculate: (plan: P, inputs: readonly I[]) => R,
    lease?: RefreshLease, private readonly transaction?: PoolClient) {
    identity(scope.workspaceId); this.workspaceId = scope.workspaceId;
    if (!Array.isArray(scope.series) || scope.series.length > 10000) throw new Error("invalid_aggregate_scope");
    this.allowed = new Set(scope.series.map(row => {
      for (const value of [row.sourceId, row.subjectKey, row.metricKey]) identity(value);
      return scopeKey(row.sourceId, row.subjectKey, row.metricKey);
    }));
    if (lease) {
      this.lease = structuredClone(lease); validateRefreshJob(this.lease.job);
      if (this.lease.job.workspaceId !== this.workspaceId || !this.allowed.has(scopeKey(this.lease.job.sourceId, this.lease.job.subjectKey, this.lease.job.metricKey))) throw Error("refresh_scope_denied");
    }
  }
  protected validateMetric(_key: AggregateKey): void {}
  private normalizeKey(input: AggregateKey): AggregateKey {
    const key = structuredClone(input);
    if (!this.allowed.has(scopeKey(key.sourceId, key.subjectKey, refKey(key.metric)))) throw new Error("aggregate_scope_denied");
    positiveRevision(String(key.metric.version));
    if (!Number.isSafeInteger(key.metric.version)) throw new Error("invalid_metric_version");
    this.validateMetric(key);
    key.period = { start: timestamp(key.period.start), end: timestamp(key.period.end) };
    const period = bucketFor(key.period.start, key.grain);
    if (period.start !== key.period.start || period.end !== key.period.end) throw new Error("unaligned_target_window");
    return key;
  }
  private args(key: AggregateKey) {
    return [this.workspaceId, key.sourceId, key.subjectKey, key.metric.code, key.metric.version, key.grain, key.period.start, key.period.end];
  }
  async publish(rawPlan: P, rawInputs: readonly I[], expectedRevision: string | null, publishedBy: string) {
    const plan = structuredClone(rawPlan), inputs = structuredClone(rawInputs);
    identity(publishedBy);
    if (plan.workspaceId !== this.workspaceId) throw new Error("workspace_mismatch");
    const key = this.normalizeKey({ sourceId: plan.sourceId, subjectKey: plan.subjectKey, metric: plan.metric, grain: plan.grain, period: plan.period });
    if (expectedRevision !== null) positiveRevision(expectedRevision);
    const result = this.calculate(plan, inputs);
    if (this.lease) {
      const job = this.lease.job, period = bucketFor(job.target.at, job.target.grain);
      if (job.sourceId !== key.sourceId || job.subjectKey !== key.subjectKey || job.metricKey !== refKey(key.metric) || job.target.grain !== key.grain ||
          period.start !== key.period.start || period.end !== key.period.end) throw Error("refresh_snapshot_mismatch");
    }
    const args = this.args(key);
    const manifest = { plan, inputs };
    const client = this.transaction ?? await this.pool.connect();
    let discard = false;
    try {
      if (!this.transaction) await client.query("BEGIN");
      if (this.lease) await lockRefreshLease(client, this.lease);
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [JSON.stringify(["bsmoss-aggregate", ...args])]);
      await client.query(`INSERT INTO bsmoss_analysis.aggregate_series(workspace_id,source_id,subject_key,metric_code,metric_version,grain,period_start,period_end,id)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(workspace_id,source_id,subject_key,metric_code,metric_version,grain,period_start,period_end) DO NOTHING`, [...args, randomUUID()]);
      const head = (await client.query(`SELECT id,current_revision FROM bsmoss_analysis.aggregate_series
        WHERE workspace_id=$1 AND source_id=$2 AND subject_key=$3 AND metric_code=$4 AND metric_version=$5 AND grain=$6 AND period_start=$7 AND period_end=$8 FOR UPDATE`, args)).rows[0];
      const duplicate = (await client.query(`SELECT revision,result_payload=$4::jsonb AS same FROM bsmoss_analysis.aggregate_revision
        WHERE workspace_id=$1 AND series_id=$2 AND input_fingerprint=$3`, [this.workspaceId, head.id, result.inputFingerprint, JSON.stringify(result)])).rows[0];
      if (duplicate) {
        if (!duplicate.same) throw new Error("conflicting_aggregate_replay");
        if (this.lease) await completeRefreshLease(client, this.lease, JSON.stringify(["bsmoss-aggregate", head.id, duplicate.revision]));
        if (!this.transaction) await client.query("COMMIT");
        return { status: "duplicate" as const, seriesId: head.id, revision: duplicate.revision as string, currentRevision: head.current_revision as string };
      }
      if (head.current_revision !== expectedRevision) throw new Error("aggregate_revision_conflict");
      const revision = (BigInt(head.current_revision ?? "0") + 1n).toString(); positiveRevision(revision);
      const value = result.value;
      await client.query(`INSERT INTO bsmoss_analysis.aggregate_revision(workspace_id,series_id,revision,input_fingerprint,aggregation_version,watermark,
        completeness,value_kind,integer_value,numerator,denominator,result_payload,input_manifest,published_by,state_value,gauge_value)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [this.workspaceId, head.id, revision, result.inputFingerprint, result.aggregationVersion, result.watermark, result.completeness,
        value?.kind ?? "none", value?.kind === "integer" ? value.value : null, value?.kind === "ratio" ? value.numerator : null,
        value?.kind === "ratio" ? value.denominator : null, JSON.stringify(result), JSON.stringify(manifest), publishedBy,
        value?.kind === "state" ? JSON.stringify(value) : null, value?.kind === "gauge" ? JSON.stringify(value) : null]);
      await client.query("UPDATE bsmoss_analysis.aggregate_series SET current_revision=$3 WHERE workspace_id=$1 AND id=$2", [this.workspaceId, head.id, revision]);
      await client.query("INSERT INTO bsmoss_analysis.aggregate_outbox(workspace_id,id,series_id,revision,event_type) VALUES($1,$2,$3,$4,'aggregate.revised')", [this.workspaceId, randomUUID(), head.id, revision]);
      if (this.lease) await completeRefreshLease(client, this.lease, JSON.stringify(["bsmoss-aggregate", head.id, revision]));
      if (!this.transaction) await client.query("COMMIT");
      return { status: "inserted" as const, seriesId: head.id, revision, currentRevision: revision };
    } catch (error) { if (!this.transaction) try { await client.query("ROLLBACK"); } catch { discard = true; } throw error; }
    finally { if (!this.transaction) client.release(discard); }
  }
  private async read(input: AggregateKey, revision?: string): Promise<StoredAggregateResult<R> | null> {
    const key = this.normalizeKey(input);
    if (revision !== undefined) positiveRevision(revision);
    const rows = await (this.transaction ?? this.pool).query(`SELECT s.id,r.revision,r.published_by,r.created_at,r.result_payload
      FROM bsmoss_analysis.aggregate_series s JOIN bsmoss_analysis.aggregate_revision r ON r.workspace_id=s.workspace_id AND r.series_id=s.id
      AND r.revision=${revision === undefined ? "s.current_revision" : "$9"}
      WHERE s.workspace_id=$1 AND s.source_id=$2 AND s.subject_key=$3 AND s.metric_code=$4 AND s.metric_version=$5 AND s.grain=$6 AND s.period_start=$7 AND s.period_end=$8`,
    [...this.args(key), ...(revision === undefined ? [] : [revision])]);
    const row = rows.rows[0];
    return row ? { seriesId: row.id, revision: row.revision, publishedBy: row.published_by, createdAt: row.created_at.toISOString(), result: row.result_payload } : null;
  }
  current(key: AggregateKey) { return this.read(key); }
  readRevision(key: AggregateKey, revision: string) { return this.read(key, revision); }
}
