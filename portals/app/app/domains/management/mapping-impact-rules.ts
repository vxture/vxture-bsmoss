import { FIRST_METRICS } from "../catalog/first-metrics.ts";
import { refKey } from "../catalog/registry.ts";
import { aggregateIntervals, fingerprintOf, positiveRevision, type AggregationPlan, type IntervalInput } from "../aggregation/intervals.ts";
import { aggregateStatePeriod, type StatePlan, type StateInput } from "../aggregation/state-period.ts";
import { aggregateGaugePeriod, type GaugePlan, type GaugeInput } from "../aggregation/gauge-period.ts";
import { mappedSubject } from "../aggregation/subjects.ts";
import { reportScope, assertReportScope, type ReportData, type ReportManifest } from "../reports/rules.ts";
import type { MeasurementScope } from "../measurements/store.ts";
import type { MappingRecord } from "./mapping-rules.ts";
import type { AggregateImpact } from "./mapping-impact-contracts.ts";

export function mappingImpactScope(r: MappingRecord, workspaceId: string, metricKeys: readonly string[] = []) {
  return reportScope({ workspaceId, sourceIds: [r.sourceId], stationIds: [r.stationId], serviceIds: r.serviceId ? [r.serviceId] : [],
    deviceIds: r.deviceId ? [r.deviceId] : [], metricKeys, allowSiteParameters: !r.serviceId && !r.deviceId });
}
export const mappingSubject = (r: MappingRecord) => mappedSubject(r.stationId, r.serviceId, r.networkObjectId, r.deviceId);
export function aggregateMappingReferences(plan: any, inputs: readonly any[], id: string) {
  return plan.authorityRevisions?.some((r: any) => r.kind === "source_mapping" && r.id === id) ||
    plan.mappingWindows?.some((r: any) => r.mappingId === id) || plan.mappingPeriods?.some((r: any) => r.mappingId === id) || inputs.some(r => r.mappingId === id) || false;
}
export function reportMappingReferences(m: ReportManifest, id: string) {
  const refs = (d: ReportData): boolean => {
    if (d.kind === "not_connected") return false;
    if (d.kind === "aggregate") return d.query.mappingId === id || !!(d.publication && aggregateMappingReferences(d.publication.result, d.publication.result.evidence, id));
    return d.result.members.some(r => r.mappingId === id || r.publication?.authorityRevisions.some(a => a.kind === "source_mapping" && a.id === id));
  };
  return m.items.some(i => refs(i.data) || i.dailyDependencies.some(d => refs(d.data)));
}
// Recompute stored evidence only. Never read current raw facts or publish a revision.
export function aggregateImpactRecord(row: any, mapping: MappingRecord, scope: MeasurementScope): AggregateImpact {
  try {
    const { plan, inputs } = row.input_manifest;
    const metric = FIRST_METRICS.get(plan.metric);
    if (!metric || !Array.isArray(inputs)) throw Error();
    const keys = [refKey(plan.metric), ...(plan.inputMode === "dependencies" ? metric.dependencies.map(refKey) : [])];
    assertReportScope(scope, mappingImpactScope(mapping, scope.workspaceId, keys));
    const result = metric.semantic === "state" ? aggregateStatePeriod(plan as StatePlan, inputs as StateInput[])
      : metric.semantic === "gauge" ? aggregateGaugePeriod(plan as GaugePlan, inputs as GaugeInput[]) : aggregateIntervals(plan as AggregationPlan, inputs as IntervalInput[]);
    if (row.workspace_id !== scope.workspaceId || plan.workspaceId !== scope.workspaceId || row.source_id !== mapping.sourceId || plan.sourceId !== row.source_id ||
        row.subject_key !== mappingSubject(mapping) || plan.subjectKey !== row.subject_key || refKey(plan.metric) !== row.metric_code + "@" + row.metric_version ||
        result.grain !== row.grain || result.period.start !== row.period_start.toISOString() || result.period.end !== row.period_end.toISOString() ||
        result.inputFingerprint !== row.input_fingerprint || result.aggregationVersion !== row.aggregation_version || fingerprintOf(result) !== fingerprintOf(row.result_payload) ||
        !aggregateMappingReferences(plan, inputs, mapping.id)) throw Error();
    positiveRevision(row.revision);
    return { id: row.series_id, revision: row.revision, metricKey: refKey(plan.metric), grain: result.grain, period: result.period };
  } catch { throw Error("invalid_mapping_aggregate_evidence"); }
}
