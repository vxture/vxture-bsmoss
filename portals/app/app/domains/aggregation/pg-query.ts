import type { Pool, PoolClient } from "pg";
import type { MeasurementScope } from "../measurements/store.ts";
import { refKey } from "../catalog/registry.ts";
import { aggregateIntervals, fingerprintOf } from "./intervals.ts";
import { aggregateStatePeriod } from "./state-period.ts";
import { PgAggregateStore } from "./pg-store.ts";
import { PgStateAggregateStore } from "./pg-state-store.ts";
import { readRefreshSnapshot } from "./refresh-snapshot.ts";
import { normalizeAggregateQuery, type AggregateQuery, type AggregateQueryReader, type AggregateQueryResult } from "./query.ts";
import { jobIdentity } from "./refresh-jobs.ts";
import { PgGaugeAggregateStore } from "./pg-gauge-store.ts";
import { aggregateGaugePeriod } from "./gauge-period.ts";

// Caller owns the one RR transaction. Multi-object reads must reuse this core,
// rather than composing independently committed single-object snapshots.
export async function readAggregateQueryInTransaction(pool: Pool, access: MeasurementScope, raw: AggregateQuery, client: PoolClient) {
  const input = normalizeAggregateQuery(raw), { revision, ...target } = input;
  const snapshot = await readRefreshSnapshot(pool, access, target, client), plan = snapshot.plan;
  const scope = { workspaceId: access.workspaceId, series: [{ sourceId: plan.sourceId, subjectKey: plan.subjectKey, metricKey: refKey(plan.metric) }] };
  const store = snapshot.kind === "gauge" ? new PgGaugeAggregateStore(pool, scope, undefined, client)
    : snapshot.kind === "state" ? new PgStateAggregateStore(pool, scope, undefined, client) : new PgAggregateStore(pool, scope, undefined, client);
  const head = await store.current(plan);
  const selected = revision === undefined ? head : await store.readRevision(plan, revision);
  if (!selected) return { snapshot, publication: null };
  if (!head) throw Error("aggregate_publication_corrupt");
  const fresh = snapshot.kind === "gauge" ? aggregateGaugePeriod(snapshot.plan, snapshot.inputs)
    : snapshot.kind === "state" ? aggregateStatePeriod(snapshot.plan, snapshot.inputs) : aggregateIntervals(snapshot.plan, snapshot.inputs);
  const result = selected.result;
  if (result.workspaceId !== access.workspaceId || result.sourceId !== plan.sourceId || result.subjectKey !== plan.subjectKey ||
      refKey(result.metric) !== refKey(plan.metric) || result.grain !== plan.grain || fingerprintOf(result.period) !== fingerprintOf(plan.period) ||
      !/^[a-f0-9]{64}$/.test(result.inputFingerprint)) throw Error("aggregate_publication_corrupt");
  const reasons: string[] = [];
  if (selected.revision !== head.revision) reasons.push("older_published_revision");
  if (result.inputFingerprint !== fresh.inputFingerprint) reasons.push("latest_input_or_authority_changed");
  if ((await client.query(`SELECT 1 FROM bsmoss_analysis.aggregate_authority_invalidation WHERE workspace_id=$1 AND series_id=$2 AND invalidated_revision=$3 LIMIT 1`,
    [access.workspaceId, selected.seriesId, selected.revision])).rowCount) reasons.push("authority_change_invalidated_revision");
  const publication: AggregateQueryResult = { ...selected, currentRevision: head.revision, selection: revision === undefined ? "current" : "revision",
    freshness: reasons.length ? "stale" : "current", currentInputFingerprint: fresh.inputFingerprint, reasons };
  return { snapshot, publication };
}

// A single explicit object/period, never a province-wide raw-data scan. Source
// freshness and selected publication are compared in the same read-only view.
export class PgAggregateQueryReader implements AggregateQueryReader {
  readonly workspaceId: string;
  private readonly scope: MeasurementScope;
  constructor(private readonly pool: Pool, scope: MeasurementScope) {
    this.scope = structuredClone(scope); jobIdentity(this.scope.workspaceId); this.workspaceId = this.scope.workspaceId;
  }
  async read(raw: AggregateQuery): Promise<AggregateQueryResult | null> {
    const input = normalizeAggregateQuery(raw);
    const client = await this.pool.connect(); let discard = false;
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const { publication } = await readAggregateQueryInTransaction(this.pool, this.scope, input, client);
      await client.query("COMMIT");
      return publication;
    } catch (error) { try { await client.query("ROLLBACK"); } catch { discard = true; } throw error; }
    finally { client.release(discard); }
  }
}
