import type { Grain, MetricRef } from "../catalog/registry.ts";
import type { AggregationPlan, IntervalInput } from "./intervals.ts";

// Request selectors only; scope, authority, applicability and values are server-owned.
export interface AggregateTarget {
  sourceId: string;
  mappingId: string;
  metric: MetricRef;
  grain: Grain;
  at: string;
}
export interface AggregateSnapshot {
  plan: AggregationPlan;
  inputs: readonly IntervalInput[];
}
export interface AggregateSnapshotReader {
  readonly workspaceId: string;
  load(target: AggregateTarget): Promise<AggregateSnapshot>;
}
