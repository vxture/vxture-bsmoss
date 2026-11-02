import { FIRST_METRICS } from "../catalog/first-metrics.ts";
import type { AggregateTarget } from "./snapshot.ts";
import { jobIdentity } from "./refresh-jobs.ts";
import { positiveRevision } from "./intervals.ts";
import { bucketFor } from "./periods.ts";
import type { IntervalAggregate } from "./store.ts";
import type { aggregateStatePeriod } from "./state-period.ts";
import type { aggregateGaugePeriod } from "./gauge-period.ts";

export interface AggregateQuery extends AggregateTarget { revision?: string }
export interface AggregateQueryResult {
  seriesId: string; revision: string; currentRevision: string; publishedBy: string; createdAt: string;
  selection: "current" | "revision"; freshness: "current" | "stale";
  currentInputFingerprint: string; reasons: readonly string[];
  result: IntervalAggregate | ReturnType<typeof aggregateStatePeriod> | ReturnType<typeof aggregateGaugePeriod>;
}
export interface AggregateQueryReader {
  readonly workspaceId: string;
  read(input: AggregateQuery): Promise<AggregateQueryResult | null>;
}
export function normalizeAggregateQuery(raw: AggregateQuery): AggregateQuery {
  const input = structuredClone(raw);
  if (!input || typeof input !== "object" || Array.isArray(input) ||
      Object.keys(input).some(k => !["sourceId", "mappingId", "metric", "grain", "at", "revision"].includes(k)) ||
      !input.metric || typeof input.metric !== "object" || Array.isArray(input.metric) ||
      Object.keys(input.metric).some(k => !["code", "version"].includes(k))) throw Error("invalid_aggregate_filter");
  jobIdentity(input.sourceId); jobIdentity(input.mappingId);
  const metric = FIRST_METRICS.get(input.metric);
  if (!Number.isSafeInteger(input.metric.version) || input.metric.version < 1 || !metric || metric.lifecycle === "retired" ||
      !metric.grains.includes(input.grain)) throw Error("invalid_aggregate_filter");
  input.at = bucketFor(input.at, input.grain).start;
  if (input.revision !== undefined) positiveRevision(input.revision);
  return input;
}
// URL selectors never carry workspace, actor, subject, value or access scope.
export function parseAggregateQuery(params: URLSearchParams): AggregateQuery {
  const allowed = ["sourceId", "mappingId", "metricCode", "metricVersion", "grain", "at", "revision"];
  if (params.toString().length > 4096 || [...params.keys()].some(k => !allowed.includes(k)) ||
      allowed.some(k => params.getAll(k).length > 1) || !/^[1-9][0-9]*$/.test(params.get("metricVersion") ?? "")) throw Error("invalid_aggregate_filter");
  return normalizeAggregateQuery({ sourceId: params.get("sourceId")!, mappingId: params.get("mappingId")!,
    metric: { code: params.get("metricCode")!, version: Number(params.get("metricVersion")) },
    grain: params.get("grain") as AggregateTarget["grain"], at: params.get("at")!,
    ...(params.has("revision") ? { revision: params.get("revision")! } : {}) });
}
