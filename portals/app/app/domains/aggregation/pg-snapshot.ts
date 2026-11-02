import type { Pool, PoolClient } from "pg";
import { FIRST_METRICS } from "../catalog/first-metrics.ts";
import { refKey, type MetricRef } from "../catalog/registry.ts";
import type { MeasurementScope } from "../measurements/store.ts";
import { fingerprintOf, type IntervalInput } from "./intervals.ts";
import { bucketFor, type NativeGrain } from "./periods.ts";
import { planMappingWindows } from "./applicability.ts";
import type { AggregateSnapshotReader, AggregateTarget } from "./snapshot.ts";
import {resolveIntervalInputPolicy} from './input-policy.ts';
import { bindSourceCompletion } from "./completion.ts";
import { mappedSubject } from "./subjects.ts";

function identity(value: unknown): asserts value is string {
  if (typeof value !== "string" || !value.trim() || value.trim() !== value || value === "*" || value.includes("\0")) throw new Error("invalid_aggregate_identity");
}
export class PgAggregateSnapshotReader implements AggregateSnapshotReader {
  readonly workspaceId: string;
  private readonly scope: MeasurementScope;
  constructor(private readonly pool: Pool, input: MeasurementScope) {
    identity(input.workspaceId); this.workspaceId = input.workspaceId;
    const scope = structuredClone(input);
    for (const values of [scope.sourceIds, scope.stationIds, scope.metricKeys, scope.serviceIds, scope.deviceIds]) {
      if (!Array.isArray(values) || values.length > 10000) throw new Error("invalid_aggregate_scope");
      values.forEach(identity);
    }
    if (typeof scope.allowSiteParameters !== "boolean") throw new Error("invalid_aggregate_scope");
    this.scope = scope;
  }
  async load(input: AggregateTarget, transaction?: PoolClient) {
    const target = structuredClone(input);
    identity(target.sourceId); identity(target.mappingId);
    if (!this.scope.sourceIds.includes(target.sourceId) || !this.scope.metricKeys.includes(refKey(target.metric))) throw new Error("aggregate_scope_denied");
    const metric = FIRST_METRICS.get(target.metric);
    // Mixed native frequencies remain unsupported; dictionary dependencies need explicit grants.
    if (!Number.isSafeInteger(target.metric.version) || !metric || metric.lifecycle === "retired" ||
        !["interval_delta", "derived", "ratio"].includes(metric.semantic) || !metric.grains.includes(target.grain)) throw new Error("unsupported_aggregate_metric");
    if(metric.semantic==='derived')resolveIntervalInputPolicy(target.metric,target.grain,'dependencies',this.scope.metricKeys);
    const period = bucketFor(target.at, target.grain);
    const client = transaction ?? await this.pool.connect();
    let discard = false;
    try {
      if (!transaction) await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const mapping = (await client.query(`SELECT m.*,n.kind,s.valid_from AS service_from,s.valid_to AS service_to
        FROM bsmoss_integration.source_mapping m
        LEFT JOIN bsmoss_resource.network_object n ON (n.workspace_id,n.id)=(m.workspace_id,m.network_object_id)
        LEFT JOIN bsmoss_resource.station_service s ON (s.workspace_id,s.id)=(m.workspace_id,m.service_id)
        WHERE m.workspace_id=$1 AND m.id=$2 AND m.source_id=$3 AND m.station_id=ANY($4::text[])`, [this.workspaceId, target.mappingId, target.sourceId, this.scope.stationIds])).rows[0];
      if (!mapping) throw new Error("aggregate_mapping_unavailable");
      if (mapping.service_id && !this.scope.serviceIds.includes(mapping.service_id) || mapping.device_id && !this.scope.deviceIds.includes(mapping.device_id) ||
          !mapping.service_id && !mapping.device_id && !this.scope.allowSiteParameters) throw new Error("object_scope_denied");
      if (metric.attribution === "service_required" && (!mapping.service_id || !mapping.network_object_id)) throw new Error("service_mapping_required");
      if (metric.object === "cell" && mapping.kind !== "cell" || metric.object === "device" && !mapping.device_id ||
          metric.object === "station_meter" && (mapping.device_id || mapping.network_object_id || mapping.service_id)) throw new Error("mapping_object_mismatch");
      const related = (await client.query(`SELECT id,version,valid_from,valid_to FROM bsmoss_integration.source_mapping
        WHERE workspace_id=$1 AND source_id=$2 AND station_id=$3 AND service_id IS NOT DISTINCT FROM $4
        AND network_object_id IS NOT DISTINCT FROM $5 AND device_id IS NOT DISTINCT FROM $6
        AND valid_from<$8 AND valid_to>$7 ORDER BY id LIMIT 10001`, [this.workspaceId, target.sourceId, mapping.station_id,
        mapping.service_id, mapping.network_object_id, mapping.device_id, period.start, period.end])).rows;
      const loadCapability=async(ref:MetricRef)=>{
        const capabilities=(await client.query(`SELECT * FROM bsmoss_integration.source_capability
          WHERE workspace_id=$1 AND source_id=$2 AND metric_code=$3 AND metric_version=$4
          AND status='active' AND valid_from<$6 AND valid_to>$5 ORDER BY id LIMIT 2`,
        [this.workspaceId,target.sourceId,ref.code,ref.version,period.start,period.end])).rows;
        if(capabilities.length!==1)throw Error('aggregate_capability_unavailable_or_ambiguous');
        const capability=capabilities[0];
        if(capability.valid_from>new Date(period.start)||capability.valid_to<new Date(period.end))throw Error('aggregate_capability_boundary');
        identity(capability.validation_ref);
        const policy=capability.rules?.intervalAggregation;
        if(!policy||policy.version!==1||!['direct','dependencies'].includes(policy.inputMode))throw Error('aggregate_policy_required');
        identity(policy.authorityRef);
        if(!['5m','15m','hour','day'].includes(capability.native_grain))throw Error('unsupported_native_grain');
        const definition=(await client.query('SELECT category,semantic,unit FROM bsmoss_catalog.metric_version WHERE code=$1 AND version=$2',[ref.code,ref.version])).rows[0];
        const expected=FIRST_METRICS.get(ref)!;
        if(!definition||definition.category!==expected.category||definition.semantic!==expected.semantic||definition.unit!==expected.unit)throw Error('metric_definition_mismatch');
        return capability;
      };
      const capability=await loadCapability(target.metric),policy=capability.rules.intervalAggregation;
      const {inputMode,refs}=resolveIntervalInputPolicy(target.metric,target.grain,policy.inputMode,this.scope.metricKeys);
      const nativeGrain=capability.native_grain as NativeGrain;
      const inputCapabilities=[];
      for(const ref of refs){
        const c=inputMode==='direct'?capability:await loadCapability(ref);
        if(c.rules.intervalAggregation.inputMode!=='direct')throw Error('aggregate_dependency_policy_required');
        if(c.native_grain!==nativeGrain)throw Error('mixed_native_grain');
        inputCapabilities.push({ref,...c});
      }
      const applicability = planMappingWindows(period, nativeGrain, related.map(m => ({ mappingId: m.id, mappingVersion: m.version,
        period: { start: m.valid_from.toISOString(), end: m.valid_to.toISOString() } })), mapping.service_id ?
        { start: mapping.service_from.toISOString(), end: mapping.service_to.toISOString() } : undefined);
      const mappingIds = related.map(m => m.id);
      const versions = new Map(related.map(m => [m.id, m.version]));
      // Select latest fact BEFORE applying mapping/time/quality. A newer fact moved
      // to another object/window must retract the old fact, never revive it.
      const rows=[];
      for(const ref of refs){const batch = (await client.query(`SELECT m.*,r.payload_sha256,q.revision AS quality_revision,q.quality
        FROM bsmoss_metering.measurement m
        JOIN bsmoss_integration.raw_event r ON (r.workspace_id,r.source_id,r.event_id,r.revision)=(m.workspace_id,m.source_id,m.event_id,m.event_revision)
        LEFT JOIN LATERAL (SELECT revision,quality FROM bsmoss_metering.quality_decision
          WHERE workspace_id=m.workspace_id AND measurement_id=m.id ORDER BY revision DESC LIMIT 1) q ON true
        WHERE m.workspace_id=$1 AND m.source_id=$2 AND m.mapping_id=ANY($3::text[]) AND m.metric_code=$4 AND m.metric_version=$5
        AND m.period_start<$7 AND m.period_end>$6
        AND NOT EXISTS (SELECT 1 FROM bsmoss_metering.measurement newer WHERE newer.workspace_id=m.workspace_id AND newer.source_id=m.source_id
          AND newer.event_id=m.event_id AND newer.component_key=m.component_key AND newer.metric_code=m.metric_code
          AND newer.metric_version=m.metric_version AND newer.event_revision>m.event_revision)
        ORDER BY m.id LIMIT 100001`, [this.workspaceId, target.sourceId, mappingIds, ref.code, ref.version, period.start, period.end])).rows;
        if(rows.length+batch.length>100000)throw Error("input_bound_exceeded");
        for(const row of batch)rows.push(row);
      }
      const subjectKey = mappedSubject(mapping.station_id, mapping.service_id, mapping.network_object_id, mapping.device_id);
      const inputs: IntervalInput[] = rows.map(row => {
        if (!row.quality_revision) throw new Error("quality_decision_required");
        if (row.value_kind !== "integer_delta" && row.value_kind !== "ratio_parts") throw new Error("metric_value_mismatch");
        return { workspaceId: this.workspaceId, sourceId: target.sourceId, subjectKey, metric: { code:row.metric_code,version:Number(row.metric_version) }, eventId: row.event_id,
          componentKey: row.component_key, revision: row.event_revision, qualityRevision: row.quality_revision, quality: row.quality,
          payloadSha256: row.payload_sha256, mappingId: row.mapping_id, mappingVersion: versions.get(row.mapping_id)!, transformVersion: row.transform_version,
          period: { start: row.period_start.toISOString(), end: row.period_end.toISOString() },
          value: row.value_kind === "integer_delta" ? { kind: "integer_delta", value: row.integer_value } : { kind: "ratio_parts", numerator: row.numerator, denominator: row.denominator } };
      });
      const basePlan = { workspaceId: this.workspaceId, sourceId: target.sourceId, subjectKey,
        authorityVersion: fingerprintOf({ policy, mappings: related.map(m => ({ id: m.id, version: m.version, from: m.valid_from.toISOString(), to: m.valid_to.toISOString() })),
          servicePeriod: mapping.service_id ? { start: mapping.service_from.toISOString(), end: mapping.service_to.toISOString() } : null,
          capabilityId: capability.id, validationRef: capability.validation_ref,
          ...(inputMode==='dependencies'?{inputCapabilities:inputCapabilities.map(c=>({ref:c.ref,id:c.id,validationRef:c.validation_ref,
            nativeGrain:c.native_grain,from:c.valid_from.toISOString(),to:c.valid_to.toISOString(),policy:c.rules.intervalAggregation}))}:{}) }),
        metric: { ...target.metric }, inputMode, period, grain: target.grain, nativeGrain,
        ...applicability,
        // Missing confirmation never falls back to observed maximum sample time.
        watermark: period.start, sourceComplete: false };
      // Object-scoped ledger wins even after topology shrinks to one mapping.
      // Select the latest revision BEFORE comparing its manifest/fingerprint;
      // a stale/revoked set must never fall back to an older segment proof.
      const setCompletion = (await client.query(`SELECT revision,status,input_fingerprint,watermark,evidence_ref,evidence_sha256,mapping_manifest_sha256
        FROM bsmoss_integration.source_completion_set WHERE workspace_id=$1 AND source_id=$2 AND station_id=$3
        AND service_id IS NOT DISTINCT FROM $4 AND network_object_id IS NOT DISTINCT FROM $5 AND device_id IS NOT DISTINCT FROM $6
        AND metric_code=$7 AND metric_version=$8 AND grain=$9 AND period_start=$10 AND period_end=$11
        ORDER BY revision DESC LIMIT 1`, [this.workspaceId, target.sourceId, mapping.station_id, mapping.service_id,
        mapping.network_object_id, mapping.device_id, metric.code, metric.version, target.grain, period.start, period.end])).rows[0];
      const completionMapping = new Set(applicability.mappingWindows.map(w => w.mappingId));
      const completionId = completionMapping.size === 1 ? [...completionMapping][0]! : null;
      const completion = setCompletion ?? (completionId === null ? undefined : (await client.query(`SELECT revision,status,input_fingerprint,watermark,evidence_ref,evidence_sha256
        FROM bsmoss_integration.source_completion WHERE workspace_id=$1 AND source_id=$2 AND mapping_id=$3
        AND metric_code=$4 AND metric_version=$5 AND grain=$6 AND period_start=$7 AND period_end=$8
        ORDER BY revision DESC LIMIT 1`, [this.workspaceId, target.sourceId, completionId, metric.code, metric.version, target.grain, period.start, period.end])).rows[0]);
      const plan = bindSourceCompletion(basePlan, inputs, completion ? { revision: completion.revision, status: completion.status,
        inputFingerprint: completion.input_fingerprint, watermark: completion.watermark.toISOString(),
        evidenceRef: completion.evidence_ref, evidenceSha256: completion.evidence_sha256,
        ...(setCompletion ? { mappingSet: { version: 1 as const, sha256: setCompletion.mapping_manifest_sha256 } } : {}) } : undefined);
      if (!transaction) await client.query("COMMIT");
      return { plan, inputs };
    } catch (error) {
      if (!transaction) try { await client.query("ROLLBACK"); } catch { discard = true; }
      throw error;
    } finally { if (!transaction) client.release(discard); }
  }
}
