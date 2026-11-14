import type { AggregateKey } from "./store.ts";
import type { GaugePlan, GaugeInput, aggregateGaugePeriod } from "./gauge-period.ts";

export interface StoredGaugeAggregate {
  seriesId: string; revision: string; publishedBy: string; createdAt: string; result: ReturnType<typeof aggregateGaugePeriod>;
}
export interface GaugeAggregateStore {
  readonly workspaceId: string;
  publish(plan: GaugePlan, inputs: readonly GaugeInput[], expectedRevision: string | null, actor: string): Promise<{
    status: "inserted" | "duplicate"; seriesId: string; revision: string; currentRevision: string;
  }>;
  current(key: AggregateKey): Promise<StoredGaugeAggregate | null>;
  readRevision(key: AggregateKey, revision: string): Promise<StoredGaugeAggregate | null>;
}
