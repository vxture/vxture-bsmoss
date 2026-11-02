import type { Pool, PoolClient } from "pg";
import { FIRST_METRICS } from "../catalog/first-metrics.ts";
import { refKey } from "../catalog/registry.ts";
import type { MeasurementScope } from "../measurements/store.ts";
import { fingerprintOf } from "./intervals.ts";
import { bucketFor, type NativeGrain } from "./periods.ts";
import type { AggregateTarget } from "./snapshot.ts";
import { jobIdentity } from "./refresh-jobs.ts";
import { mappedSubject } from "./subjects.ts";
import { bindGaugeCompletion, gaugePolicy, type GaugePlan, type GaugeInput } from "./gauge-period.ts";

export class PgGaugeSnapshotReader {
  readonly workspaceId: string;
  private readonly scope: MeasurementScope;
  constructor(private readonly pool: Pool, raw: MeasurementScope) {
    this.scope = structuredClone(raw); jobIdentity(this.scope.workspaceId); this.workspaceId = this.scope.workspaceId;
    for (const values of [this.scope.sourceIds, this.scope.stationIds, this.scope.metricKeys, this.scope.deviceIds, this.scope.serviceIds]) {
      if (!Array.isArray(values) || values.length > 10000) throw Error("invalid_aggregate_scope"); values.forEach(jobIdentity);
    }
    if (typeof this.scope.allowSiteParameters !== "boolean") throw Error("invalid_aggregate_scope");
  }
  async load(raw: AggregateTarget, transaction?: PoolClient) {
    const target = structuredClone(raw); [target.sourceId, target.mappingId].forEach(jobIdentity);
    if (!this.scope.sourceIds.includes(target.sourceId) || !this.scope.metricKeys.includes(refKey(target.metric))) throw Error("aggregate_scope_denied");
    const metric = FIRST_METRICS.get(target.metric);
    if (!Number.isSafeInteger(target.metric.version) || target.metric.version < 1 || !metric || metric.lifecycle === "retired" || metric.semantic !== "gauge" || !metric.grains.includes(target.grain)) throw Error("unsupported_gauge_metric");
    const period = bucketFor(target.at, target.grain), client = transaction ?? await this.pool.connect(); let discard = false;
    try {
      if (!transaction) await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const mapping = (await client.query(`SELECT * FROM bsmoss_integration.source_mapping WHERE workspace_id=$1 AND id=$2 AND source_id=$3
        AND station_id=ANY($4::text[])`, [this.workspaceId, target.mappingId, target.sourceId, this.scope.stationIds])).rows[0];
      if (!mapping) throw Error("aggregate_mapping_unavailable");
      if (!mapping.device_id || !this.scope.deviceIds.includes(mapping.device_id)) throw Error("object_scope_denied");
      if (mapping.service_id || mapping.network_object_id) throw Error("mapping_object_mismatch");
      const caps = (await client.query(`SELECT * FROM bsmoss_integration.source_capability WHERE workspace_id=$1 AND source_id=$2
        AND metric_code=$3 AND metric_version=$4 AND status='active' AND valid_from<$6 AND valid_to>$5 ORDER BY id LIMIT 2`,
      [this.workspaceId, target.sourceId, metric.code, metric.version, period.start, period.end])).rows;
      if (caps.length !== 1) throw Error("aggregate_capability_unavailable_or_ambiguous");
      const cap = caps[0]; jobIdentity(cap.validation_ref);
      if (cap.valid_from > new Date(period.start) || cap.valid_to < new Date(period.end)) throw Error("aggregate_capability_boundary");
      const policy = gaugePolicy(cap.rules?.gaugeAggregation);
      if (!["5m", "15m", "hour", "day"].includes(cap.native_grain)) throw Error("unsupported_native_grain");
      const definition = (await client.query("SELECT semantic,unit,category FROM bsmoss_catalog.metric_version WHERE code=$1 AND version=$2", [metric.code, metric.version])).rows[0];
      if (!definition || definition.semantic !== metric.semantic || definition.unit !== metric.unit || definition.category !== metric.category) throw Error("metric_definition_mismatch");
      const related = (await client.query(`SELECT id,version,valid_from,valid_to FROM bsmoss_integration.source_mapping WHERE workspace_id=$1 AND source_id=$2
        AND station_id=$3 AND device_id=$4 AND service_id IS NULL AND network_object_id IS NULL
        AND valid_from<$6 AND valid_to>$5 ORDER BY id LIMIT 10001`, [this.workspaceId, target.sourceId, mapping.station_id, mapping.device_id, period.start, period.end])).rows;
      if (related.length > 10000) throw Error("mapping_bound_exceeded");
      const versions = new Map(related.map(m => [m.id, m.version]));
      // Choose latest facts before object/time filtering, so corrections moved
      // to another device or calendar period retract the former sample.
      const rows = (await client.query(`SELECT m.*,r.payload_sha256,q.revision AS quality_revision,q.quality
        FROM bsmoss_metering.measurement m JOIN bsmoss_integration.raw_event r
        ON (r.workspace_id,r.source_id,r.event_id,r.revision)=(m.workspace_id,m.source_id,m.event_id,m.event_revision)
        LEFT JOIN LATERAL (SELECT revision,quality FROM bsmoss_metering.quality_decision WHERE workspace_id=m.workspace_id AND measurement_id=m.id ORDER BY revision DESC LIMIT 1) q ON true
        WHERE m.workspace_id=$1 AND m.source_id=$2 AND m.mapping_id=ANY($3::text[]) AND m.metric_code=$4 AND m.metric_version=$5
        AND m.period_start<$7 AND m.period_end>$6
        AND NOT EXISTS (SELECT 1 FROM bsmoss_metering.measurement newer WHERE newer.workspace_id=m.workspace_id AND newer.source_id=m.source_id
          AND newer.event_id=m.event_id AND newer.component_key=m.component_key AND newer.metric_code=m.metric_code AND newer.metric_version=m.metric_version AND newer.event_revision>m.event_revision)
        ORDER BY m.id LIMIT 100001`, [this.workspaceId, target.sourceId, related.map(m => m.id), metric.code, metric.version, period.start, period.end])).rows;
      if (rows.length > 100000) throw Error("input_bound_exceeded");
      const subjectKey = mappedSubject(mapping.station_id, null, null, mapping.device_id);
      const inputs: GaugeInput[] = rows.map(row => {
        if (!row.quality_revision) throw Error("quality_decision_required");
        if (row.value_kind !== "fixed_point") throw Error("metric_value_mismatch");
        return { workspaceId: this.workspaceId, sourceId: target.sourceId, subjectKey, metric: { ...target.metric }, eventId: row.event_id,
          componentKey: row.component_key, revision: row.event_revision, qualityRevision: row.quality_revision, quality: row.quality,
          mappingId: row.mapping_id, mappingVersion: versions.get(row.mapping_id)!, transformVersion: row.transform_version,
          payloadSha256: row.payload_sha256, period: { start: row.period_start.toISOString(), end: row.period_end.toISOString() }, unscaled: row.unscaled, scale: Number(row.scale) };
      });
      const plan: GaugePlan = { semantic: "gauge", workspaceId: this.workspaceId, sourceId: target.sourceId, subjectKey,
        authorityVersion: fingerprintOf({ version: "gauge-authority-v1", policy, capabilityId: cap.id, nativeGrain: cap.native_grain, validationRef: cap.validation_ref,
          from: cap.valid_from.toISOString(), to: cap.valid_to.toISOString(), mappings: related.map(m => ({ id: m.id, version: m.version, from: m.valid_from.toISOString(), to: m.valid_to.toISOString() })) }),
        metric: { ...target.metric }, grain: target.grain, nativeGrain: cap.native_grain as NativeGrain, period, policy,
        mappingPeriods: related.map(m => ({ mappingId: m.id, mappingVersion: m.version, period: { start: m.valid_from.toISOString(), end: m.valid_to.toISOString() } })),
        sourceComplete: false, watermark: period.start };
      const proof = (await client.query(`SELECT revision,status,input_fingerprint,mapping_manifest_sha256,watermark,evidence_ref,evidence_sha256
        FROM bsmoss_integration.source_completion_set WHERE workspace_id=$1 AND source_id=$2 AND station_id=$3 AND device_id=$4
        AND service_id IS NULL AND network_object_id IS NULL AND metric_code=$5 AND metric_version=$6 AND grain=$7 AND period_start=$8 AND period_end=$9
        ORDER BY revision DESC LIMIT 1`, [this.workspaceId, target.sourceId, mapping.station_id, mapping.device_id, metric.code, metric.version, target.grain, period.start, period.end])).rows[0];
      const bound = bindGaugeCompletion(plan, inputs, proof ? { revision: proof.revision, status: proof.status, inputFingerprint: proof.input_fingerprint,
        mappingSet: { version: 1, sha256: proof.mapping_manifest_sha256 }, watermark: proof.watermark.toISOString(), evidenceRef: proof.evidence_ref, evidenceSha256: proof.evidence_sha256 } : undefined);
      if (!transaction) await client.query("COMMIT");
      return { plan: bound, inputs };
    } catch (error) { if (!transaction) try { await client.query("ROLLBACK"); } catch { discard = true; } throw error; }
    finally { if (!transaction) client.release(discard); }
  }
}
