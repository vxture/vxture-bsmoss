import type { Pool, PoolClient } from "pg";
import { aggregateGaugePeriod, type GaugePlan, type GaugeInput } from "./gauge-period.ts";
import type { AggregateKey, AggregateScope } from "./store.ts";
import { FIRST_METRICS } from "../catalog/first-metrics.ts";
import { PgAggregateRepository } from "./pg-repository.ts";
import type { RefreshLease } from "./pg-refresh-jobs.ts";
import type { GaugeAggregateStore } from "./gauge-store.ts";

export class PgGaugeAggregateStore extends PgAggregateRepository<GaugePlan, GaugeInput, ReturnType<typeof aggregateGaugePeriod>> implements GaugeAggregateStore {
  protected validateMetric(key: AggregateKey) {
    if (FIRST_METRICS.get(key.metric)?.semantic !== "gauge") throw Error("unsupported_gauge_metric");
  }
  constructor(pool: Pool, scope: AggregateScope, lease?: RefreshLease, transaction?: PoolClient) {
    super(pool, scope, aggregateGaugePeriod, lease, transaction);
  }
}
