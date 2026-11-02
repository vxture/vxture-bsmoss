import type { Pool, PoolClient } from "pg";
import { aggregateIntervals, type AggregationPlan, type IntervalInput } from "./intervals.ts";
import type { AggregateKey, AggregateScope, AggregateStore } from "./store.ts";
import { FIRST_METRICS } from "../catalog/first-metrics.ts";
import { PgAggregateRepository } from "./pg-repository.ts";
import type { RefreshLease } from "./pg-refresh-jobs.ts";

export class PgAggregateStore extends PgAggregateRepository<AggregationPlan, IntervalInput, ReturnType<typeof aggregateIntervals>> implements AggregateStore {
  protected validateMetric(key: AggregateKey) {
    const metric = FIRST_METRICS.get(key.metric);
    if (!metric || metric.semantic === "state") throw Error("unsupported_aggregate_metric");
  }
  constructor(pool: Pool, scope: AggregateScope, lease?: RefreshLease, transaction?: PoolClient) {
    super(pool, scope, aggregateIntervals, lease, transaction);
  }
}
