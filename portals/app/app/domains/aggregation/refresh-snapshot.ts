import type { Pool, PoolClient } from "pg";
import type { MeasurementScope } from "../measurements/store.ts";
import { FIRST_METRICS } from "../catalog/first-metrics.ts";
import type { AggregateTarget } from "./snapshot.ts";
import { PgAggregateSnapshotReader } from "./pg-snapshot.ts";
import { PgStateSnapshotReader } from "./pg-state-snapshot.ts";
import { PgGaugeSnapshotReader } from "./pg-gauge-snapshot.ts";

export async function readRefreshSnapshot(pool: Pool, scope: MeasurementScope, target: AggregateTarget, transaction: PoolClient) {
  if (FIRST_METRICS.get(target.metric)?.semantic === "gauge") {
    const snapshot = await new PgGaugeSnapshotReader(pool, scope).load(target, transaction);
    return { kind: "gauge" as const, ...snapshot };
  }
  if (FIRST_METRICS.get(target.metric)?.semantic === "state") {
    const snapshot = await new PgStateSnapshotReader(pool, scope).load(target, transaction);
    return { kind: "state" as const, ...snapshot };
  }
  const snapshot = await new PgAggregateSnapshotReader(pool, scope).load(target, transaction);
  return { kind: "interval" as const, ...snapshot };
}
