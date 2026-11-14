import type { AggregateKey } from "./store.ts";
import type { StatePlan, StateInput, aggregateStatePeriod } from "./state-period.ts";

export interface StoredStateAggregate {
  seriesId: string; revision: string; publishedBy: string; createdAt: string; result: ReturnType<typeof aggregateStatePeriod>;
}
export interface StateAggregateStore {
  readonly workspaceId: string;
  publish(plan: StatePlan, inputs: readonly StateInput[], expectedRevision: string | null, actor: string): Promise<{
    status: "inserted" | "duplicate"; seriesId: string; revision: string; currentRevision: string;
  }>;
  current(key: AggregateKey): Promise<StoredStateAggregate | null>;
  readRevision(key: AggregateKey, revision: string): Promise<StoredStateAggregate | null>;
}
