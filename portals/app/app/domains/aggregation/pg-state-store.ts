import type { Pool, PoolClient } from "pg";
import { aggregateStatePeriod, type StatePlan, type StateInput } from "./state-period.ts";
import type { AggregateKey, AggregateScope } from "./store.ts";
import { FIRST_METRICS } from "../catalog/first-metrics.ts";
import { PgAggregateRepository } from "./pg-repository.ts";
import type { RefreshLease } from "./pg-refresh-jobs.ts";
import type { StateAggregateStore } from "./state-store.ts";

export class PgStateAggregateStore extends PgAggregateRepository<StatePlan, StateInput, ReturnType<typeof aggregateStatePeriod>> implements StateAggregateStore {
  protected validateMetric(key: AggregateKey) {
    if (FIRST_METRICS.get(key.metric)?.semantic !== "state") throw Error("unsupported_state_metric");
  }
  constructor(pool: Pool, scope: AggregateScope, lease?: RefreshLease, transaction?: PoolClient) {
    super(pool, scope, aggregateStatePeriod, lease, transaction);
  }
}
