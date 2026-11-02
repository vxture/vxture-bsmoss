import type { aggregateIntervals, AggregationPlan, IntervalInput } from "./intervals.ts";

export type IntervalAggregate = ReturnType<typeof aggregateIntervals>;
export interface AggregateScope {
  workspaceId: string;
  // Explicit authorized triples. Independent lists could broaden access.
  series: readonly { sourceId: string; subjectKey: string; metricKey: string }[];
}
export interface AggregateKey {
  sourceId: string; subjectKey: string; metric: AggregationPlan["metric"];
  grain: AggregationPlan["grain"]; period: AggregationPlan["period"];
}
export interface StoredAggregate {
  seriesId: string; revision: string; publishedBy: string; createdAt: string;
  result: IntervalAggregate;
}
export interface AggregateStore {
  readonly workspaceId: string;
  publish(plan: AggregationPlan, inputs: readonly IntervalInput[], expectedRevision: string | null, publishedBy: string): Promise<{
    status: "inserted" | "duplicate"; seriesId: string; revision: string; currentRevision: string;
  }>;
  current(key: AggregateKey): Promise<StoredAggregate | null>;
  readRevision(key: AggregateKey, revision: string): Promise<StoredAggregate | null>;
}
