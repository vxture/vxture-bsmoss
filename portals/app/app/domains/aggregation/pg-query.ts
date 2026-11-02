import type { Pool } from "pg";
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

// A single explicit object/period, never a province-wide raw-data scan. Source
// freshness and selected publication are compared in the same read-only view.
export class PgAggregateQueryReader implements AggregateQueryReader {
  readonly workspaceId: string;
  private readonly scope: MeasurementScope;
  constructor(private readonly pool: Pool, scope: MeasurementScope) {
    this.scope = structuredClone(scope); jobIdentity(this.scope.workspaceId); this.workspaceId = this.scope.workspaceId;
  }
  async read(raw: AggregateQuery): Promise<AggregateQueryResult | null> {
    const input = normalizeAggregateQuery(raw), { revision, ...target } = input;
    const client = await this.pool.connect(); let discard = false;
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const snapshot = await readRefreshSnapshot(this.pool, this.scope, target, client), plan = snapshot.plan;
      const scope = { workspaceId: this.workspaceId, series: [{ sourceId: plan.sourceId, subjectKey: plan.subjectKey, metricKey: refKey(plan.metric) }] };
      const store = snapshot.kind === "gauge" ? new PgGaugeAggregateStore(this.pool, scope, undefined, client)
        : snapshot.kind === "state" ? new PgStateAggregateStore(this.pool, scope, undefined, client) : new PgAggregateStore(this.pool, scope, undefined, client);
      const head = await store.current(plan);
      const selected = revision === undefined ? head : await store.readRevision(plan, revision);
      if (!selected) { await client.query("COMMIT"); return null; }
      if (!head) throw Error("aggregate_publication_corrupt");
      const fresh = snapshot.kind === "gauge" ? aggregateGaugePeriod(snapshot.plan, snapshot.inputs)
        : snapshot.kind === "state" ? aggregateStatePeriod(snapshot.plan, snapshot.inputs) : aggregateIntervals(snapshot.plan, snapshot.inputs);
      const result = selected.result;
      if (result.workspaceId !== this.workspaceId || result.sourceId !== plan.sourceId || result.subjectKey !== plan.subjectKey ||
          refKey(result.metric) !== refKey(plan.metric) || result.grain !== plan.grain || fingerprintOf(result.period) !== fingerprintOf(plan.period) ||
          !/^[a-f0-9]{64}$/.test(result.inputFingerprint)) throw Error("aggregate_publication_corrupt");
      const reasons: string[] = [];
      if (selected.revision !== head.revision) reasons.push("older_published_revision");
      if (result.inputFingerprint !== fresh.inputFingerprint) reasons.push("latest_input_or_authority_changed");
      await client.query("COMMIT");
      return { ...selected, currentRevision: head.revision, selection: revision === undefined ? "current" : "revision",
        freshness: reasons.length ? "stale" : "current", currentInputFingerprint: fresh.inputFingerprint, reasons };
    } catch (error) { try { await client.query("ROLLBACK"); } catch { discard = true; } throw error; }
    finally { client.release(discard); }
  }
}
