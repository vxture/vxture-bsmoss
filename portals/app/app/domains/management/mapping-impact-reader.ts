import type { PoolClient } from "pg";
import { FIRST_METRICS } from "../catalog/first-metrics.ts";
import { refKey } from "../catalog/registry.ts";
import { assertReportScope } from "../reports/rules.ts";
import { readStoredReportInTransaction } from "../reports/pg-store.ts";
import type { MeasurementScope } from "../measurements/store.ts";
import type { MappingRecord } from "./mapping-rules.ts";
import type { AggregateImpact, ImpactPage, MappingImpactScopes, MappingImpacts, ReportImpact } from "./mapping-impact-contracts.ts";
import { aggregateImpactRecord, mappingImpactScope, mappingSubject, reportMappingReferences } from "./mapping-impact-rules.ts";
export const MAPPING_IMPACT_LIMIT = 20;
function authorized(s: MeasurementScope | undefined, r: MappingRecord, workspaceId: string): s is MeasurementScope {
  if (!s) return false;
  try { assertReportScope(s, mappingImpactScope(r, workspaceId)); return true; } catch { return false; }
}
function page<T>(items: T[]): ImpactPage<T> { return { status: "authorized_current_heads", items: items.slice(0, MAPPING_IMPACT_LIMIT), hasMore: items.length > MAPPING_IMPACT_LIMIT }; }
export async function readMappingImpacts(c: PoolClient, r: MappingRecord, workspaceId: string, scopes: MappingImpactScopes = {}): Promise<MappingImpacts> {
  const result: MappingImpacts = { aggregates: { status: "not_authorized" }, reports: { status: "not_authorized" } };
  if (authorized(scopes.aggregates, r, workspaceId)) {
    const s = scopes.aggregates, dependent = FIRST_METRICS.list().filter(m => s.metricKeys.includes(refKey(m)) && m.dependencies.every(d => s.metricKeys.includes(refKey(d)))).map(refKey);
    const rows = (await c.query(`SELECT s.*,a.* FROM bsmoss_analysis.aggregate_series s JOIN bsmoss_analysis.aggregate_revision a
      ON (a.workspace_id,a.series_id,a.revision)=(s.workspace_id,s.id,s.current_revision)
      WHERE s.workspace_id=$1 AND s.source_id=$2 AND s.subject_key=$3 AND s.metric_code||'@'||s.metric_version::text=ANY($4::text[])
      AND (a.input_manifest->'plan'->>'inputMode' IS DISTINCT FROM 'dependencies' OR s.metric_code||'@'||s.metric_version::text=ANY($5::text[]))
      AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(a.input_manifest->'inputs')='array' THEN a.input_manifest->'inputs' ELSE '[]'::jsonb END) i
        WHERE NOT coalesce((i->'metric'->>'code')||'@'||(i->'metric'->>'version')=ANY($4::text[]),false))
      AND (a.input_manifest->'plan'->'authorityRevisions' @> $6::jsonb OR a.input_manifest->'plan'->'mappingWindows' @> $7::jsonb
        OR a.input_manifest->'plan'->'mappingPeriods' @> $7::jsonb OR a.input_manifest->'inputs' @> $7::jsonb)
      ORDER BY s.period_start DESC,s.id COLLATE "C" DESC LIMIT $8`,
    [workspaceId, r.sourceId, mappingSubject(r), s.metricKeys, dependent, JSON.stringify([{ kind: "source_mapping", id: r.id }]), JSON.stringify([{ mappingId: r.id }]), MAPPING_IMPACT_LIMIT + 1])).rows;
    const items: AggregateImpact[] = rows.map(row => aggregateImpactRecord(row, r, s));
    result.aggregates = page(items);
  }
  if (authorized(scopes.reports, r, workspaceId)) {
    const s = scopes.reports;
    // All required dimensions are filtered before LIMIT, including lookahead.
    // A stored report may span more objects than the mapping being inspected.
    const rows = (await c.query(`SELECT s.id,s.current_revision FROM bsmoss_analysis.report_series s JOIN bsmoss_analysis.report_revision a
      ON (a.workspace_id,a.report_id,a.revision)=(s.workspace_id,s.id,s.current_revision)
      CROSS JOIN LATERAL (SELECT a.manifest->'requiredScope' required) v
      WHERE s.workspace_id=$1 AND required->>'workspaceId'=$1
      AND required->'sourceIds' <@ $2::jsonb AND required->'stationIds' <@ $3::jsonb AND required->'serviceIds' <@ $4::jsonb
      AND required->'deviceIds' <@ $5::jsonb AND required->'metricKeys' <@ $6::jsonb
      AND (required->'allowSiteParameters'='false'::jsonb OR $7::boolean)
      AND (jsonb_path_exists(a.manifest,'$.items[*].data.** ? (@.mappingId == $mapping || (@.kind == "source_mapping" && @.id == $mapping))', $8::jsonb)
        OR jsonb_path_exists(a.manifest,'$.items[*].dailyDependencies[*].data.** ? (@.mappingId == $mapping || (@.kind == "source_mapping" && @.id == $mapping))', $8::jsonb))
      ORDER BY s.period_start DESC,s.id COLLATE "C" DESC LIMIT $9`,
    [workspaceId, ...[s.sourceIds, s.stationIds, s.serviceIds, s.deviceIds, s.metricKeys].map(a => JSON.stringify(a)), s.allowSiteParameters, JSON.stringify({ mapping: r.id }), MAPPING_IMPACT_LIMIT + 1])).rows;
    const items: ReportImpact[] = [];
    for (const row of rows) {
      const record = await readStoredReportInTransaction(s, { reportId: row.id }, c);
      if (!record || record.revision !== row.current_revision || !record.manifest.requiredScope.sourceIds.includes(r.sourceId) || !reportMappingReferences(record.manifest, r.id)) throw Error("invalid_mapping_report_evidence");
      items.push({ id: record.reportId, revision: record.revision, title: record.manifest.template.definition.title, grain: record.manifest.grain, period: record.manifest.period });
    }
    result.reports = page(items);
  }
  return result;
}
