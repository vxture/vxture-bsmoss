import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { refKey, type createRegistry } from "../catalog/registry.ts";
import { normalizeDraft, normalizeFilter } from "./rules.ts";
import type { MeasurementDraft, MeasurementFilter, MeasurementScope, MeasurementStore, MeasurementValue, StoredMeasurement } from "./store.ts";

type Row = Record<string, string | null>;
// Only internal constant table/column identifiers reach this helper; all values are parameterized.
async function insertImmutable(client: PoolClient, table: string, row: Row, naturalKey: readonly string[]) {
  const columns=Object.keys(row), values=Object.values(row);
  const result=await client.query(`INSERT INTO ${table} (${columns.join(",")}) VALUES (${columns.map((_,i)=>"$"+(i+1)).join(",")}) ON CONFLICT (${naturalKey.join(",")}) DO NOTHING RETURNING *`,values);
  if (result.rowCount) return {row:result.rows[0],inserted:true};
  const where=naturalKey.map((k,i)=>`${k}=$${i+1}`).join(" AND ");
  const existing=await client.query(`SELECT * FROM ${table} WHERE ${where}`,naturalKey.map(k=>row[k]));
  if (!existing.rowCount) throw new Error("concurrent_record_missing");
  // Compare in PostgreSQL: numeric strings and timezone-equivalent timestamps stay exact.
  const comparable=columns.filter(k=>k!=="id");
  const same=await client.query(`SELECT 1 FROM ${table} WHERE ${comparable.map((k,i)=>`${k} IS NOT DISTINCT FROM $${i+1}`).join(" AND ")}`,comparable.map(k=>row[k]));
  if (!same.rowCount) throw new Error("conflicting_replay");
  return {row:existing.rows[0],inserted:false};
}

export class PgMeasurementStore implements MeasurementStore {
  readonly workspaceId: string;
  private readonly sourceIds: readonly string[];
  private readonly stationIds: readonly string[];
  private readonly metricKeys: readonly string[];
  private readonly serviceIds: readonly string[];
  private readonly deviceIds: readonly string[];
  private readonly allowSiteParameters: boolean;
  private readonly pool: Pool;
  private readonly registry: ReturnType<typeof createRegistry>;
  constructor(pool: Pool, scope: MeasurementScope, registry: ReturnType<typeof createRegistry>) {
    if (!scope.workspaceId.trim()) throw new Error("workspace_required");
    this.pool=pool; this.registry=registry; this.workspaceId=scope.workspaceId;
    this.sourceIds=Object.freeze([...scope.sourceIds]); this.stationIds=Object.freeze([...scope.stationIds]);
    this.metricKeys=Object.freeze([...scope.metricKeys]); this.serviceIds=Object.freeze([...scope.serviceIds]);
    this.deviceIds=Object.freeze([...scope.deviceIds]); this.allowSiteParameters=scope.allowSiteParameters === true;
  }
  private scope(stationId: string, sourceId?: string) {
    if (!this.stationIds.includes(stationId) || sourceId !== undefined && !this.sourceIds.includes(sourceId)) throw new Error("scope_denied");
  }
  async append(input: MeasurementDraft) {
    // Snapshot before acquiring the connection, as in the standalone path.
    const draft = normalizeDraft(input,this.registry);
    const client=await this.pool.connect(); let discard=false;
    try {
      await client.query("BEGIN ISOLATION LEVEL READ COMMITTED");
      const result=await this.appendInTransaction(client,draft);
      await client.query("COMMIT"); return result;
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch { discard=true; }
      throw error;
    } finally { client.release(discard); }
  }
  // Internal composition only: caller owns the transaction and must roll back
  // on any failure. Reuse the same mapping, scope and immutable replay checks.
  async appendInTransaction(client: PoolClient, input: MeasurementDraft, options: { preservePendingIntakeActor?: boolean } = {}) {
    if (input.workspaceId !== this.workspaceId) throw new Error("workspace_mismatch");
    this.scope(input.stationId,input.sourceId);
    const r=normalizeDraft(input,this.registry), metric=this.registry.get(r.metric)!;
    if (!this.metricKeys.includes(refKey(r.metric))) throw new Error("metric_scope_denied");
      // No write rights or row locks on governed master data; it is append-only to runtime.
      const mapping=await client.query(`SELECT m.service_id,m.device_id,m.network_object_id,n.kind,
        s.valid_from AS service_from,s.valid_to AS service_to
        FROM bsmoss_integration.source_mapping m
        LEFT JOIN bsmoss_resource.station_service s ON s.workspace_id=m.workspace_id AND s.id=m.service_id
        LEFT JOIN bsmoss_resource.network_object n ON n.workspace_id=m.workspace_id AND n.id=m.network_object_id
        WHERE m.workspace_id=$1 AND m.id=$2 AND m.source_id=$3 AND m.station_id=$4
        AND m.valid_from<=$5 AND m.valid_to>=$6`,[this.workspaceId,r.mappingId,r.sourceId,r.stationId,r.periodStart,r.periodEnd]);
      const m=mapping.rows[0];
      if (!m) throw new Error("mapping_not_effective");
      if (m.service_id && !this.serviceIds.includes(m.service_id) || m.device_id && !this.deviceIds.includes(m.device_id) || !m.service_id && !m.device_id && !this.allowSiteParameters) throw new Error("object_scope_denied");
      if (metric.attribution === "service_required" && (!m.service_id || !m.network_object_id || m.service_from>new Date(r.periodStart) || m.service_to<new Date(r.periodEnd))) throw new Error("service_mapping_required");
      if (metric.object === "cell" && m.kind !== "cell" || metric.object === "device" && !m.device_id || metric.object === "station_meter" && (m.device_id || m.network_object_id || m.service_id)) throw new Error("mapping_object_mismatch");
      if (metric.semantic === "gauge" && (m.service_id || m.network_object_id)) throw new Error("mapping_object_mismatch");
      const definition=await client.query("SELECT semantic,unit,category FROM bsmoss_catalog.metric_version WHERE code=$1 AND version=$2",[r.metric.code,r.metric.version]);
      const d=definition.rows[0];
      if (!d || d.semantic!==metric.semantic || d.unit!==metric.unit || d.category!==metric.category) throw new Error("metric_definition_mismatch");
      const raw=await insertImmutable(client,"bsmoss_integration.raw_event",{
        workspace_id:r.workspaceId,source_id:r.sourceId,event_id:r.eventId,revision:r.revision,previous_revision:r.previousRevision,
        payload_sha256:r.payloadSha256,payload_uri:r.payloadUri,occurred_at:r.occurredAt,
      },["workspace_id","source_id","event_id","revision"]);
      const v=r.value;
      const measurement=await insertImmutable(client,"bsmoss_metering.measurement",{
        workspace_id:r.workspaceId,id:randomUUID(),source_id:r.sourceId,event_id:r.eventId,event_revision:r.revision,
        metric_code:r.metric.code,metric_version:String(r.metric.version),component_key:r.componentKey,
        station_id:r.stationId,mapping_id:r.mappingId,transform_version:r.transformVersion,
        period_start:r.periodStart,period_end:r.periodEnd,value_kind:v.kind,
        integer_value:v.kind==="integer_delta"?v.value:null,
        numerator:v.kind==="ratio_parts"?v.numerator:null,denominator:v.kind==="ratio_parts"?v.denominator:null,
        unscaled:v.kind==="fixed_point"?v.unscaled:null,scale:v.kind==="fixed_point"?String(v.scale):null,
        state_value:v.kind==="state_event"?v.state:null,valid_until:v.kind==="state_event"?v.validUntil:null,
      },["workspace_id","source_id","event_id","event_revision","metric_code","metric_version","component_key"]);
      let decidedBy=r.quality.decidedBy;
      if (!measurement.inserted && options.preservePendingIntakeActor === true && r.quality.status === "pending" && r.quality.ruleVersion === "connector-intake-v1" && r.quality.reason === "source_quality_review_required") {
        // Another authorized receiver may replay the same intake. Preserve the
        // original pending decision's attribution, never replace its evidence.
        const existing=(await client.query("SELECT decided_by FROM bsmoss_metering.quality_decision WHERE workspace_id=$1 AND measurement_id=$2 AND revision=1 AND quality='pending' AND rule_version=$3 AND reason=$4",
          [this.workspaceId,measurement.row.id,r.quality.ruleVersion,r.quality.reason])).rows[0];
        if (existing) decidedBy=existing.decided_by;
      }
      const quality=await insertImmutable(client,"bsmoss_metering.quality_decision",{
        workspace_id:r.workspaceId,id:randomUUID(),measurement_id:measurement.row.id,revision:"1",
        quality:r.quality.status,rule_version:r.quality.ruleVersion,reason:r.quality.reason,decided_by:decidedBy,
      },["workspace_id","measurement_id","revision"]);
      return {id:measurement.row.id as string,status:raw.inserted||measurement.inserted||quality.inserted?"inserted" as const:"duplicate" as const};
  }
  async list(input: MeasurementFilter) {
    this.scope(input.stationId);
    const f=normalizeFilter(input);
    if (!this.metricKeys.includes(refKey(f.metric))) throw new Error("metric_scope_denied");
    if (!this.registry.get(f.metric)) throw new Error("unavailable_metric");
    const result=await this.pool.query(`SELECT m.*,r.previous_revision,r.payload_sha256,r.payload_uri,r.occurred_at,
      q.quality,q.rule_version,q.reason,q.decided_by
      FROM bsmoss_metering.measurement m
      JOIN bsmoss_integration.raw_event r ON (r.workspace_id,r.source_id,r.event_id,r.revision)=(m.workspace_id,m.source_id,m.event_id,m.event_revision)
      JOIN bsmoss_metering.quality_decision q ON (q.workspace_id,q.measurement_id,q.revision)=(m.workspace_id,m.id,1)
      JOIN bsmoss_integration.source_mapping sm ON (sm.workspace_id,sm.id)=(m.workspace_id,m.mapping_id)
      WHERE m.workspace_id=$1 AND m.station_id=$2 AND m.source_id=ANY($3::text[])
      AND m.metric_code=$4 AND m.metric_version=$5 AND m.period_start>=$6 AND m.period_end<=$7
      AND ($8::text IS NULL OR m.id>$8)
      AND (sm.service_id IS NULL OR sm.service_id=ANY($10::text[]))
      AND (sm.device_id IS NULL OR sm.device_id=ANY($11::text[]))
      AND (sm.service_id IS NOT NULL OR sm.device_id IS NOT NULL OR $12::boolean)
      ORDER BY m.id LIMIT $9`,
    [this.workspaceId,f.stationId,this.sourceIds,f.metric.code,f.metric.version,f.from,f.to,f.afterId??null,f.limit+1,this.serviceIds,this.deviceIds,this.allowSiteParameters]);
    const items: StoredMeasurement[]=result.rows.slice(0,f.limit).map(row=>{
      let value: MeasurementValue;
      if (row.value_kind==="integer_delta") value={kind:"integer_delta",value:row.integer_value};
      else if (row.value_kind==="ratio_parts") value={kind:"ratio_parts",numerator:row.numerator,denominator:row.denominator};
      else if (row.value_kind==="fixed_point") value={kind:"fixed_point",unscaled:row.unscaled,scale:Number(row.scale)};
      else value={kind:"state_event",state:row.state_value,validUntil:row.valid_until.toISOString()};
      return {id:row.id,draft:{workspaceId:row.workspace_id,sourceId:row.source_id,eventId:row.event_id,revision:row.event_revision,
        previousRevision:row.previous_revision,payloadSha256:row.payload_sha256,payloadUri:row.payload_uri,occurredAt:row.occurred_at.toISOString(),
        metric:{code:row.metric_code,version:Number(row.metric_version)},componentKey:row.component_key,stationId:row.station_id,mappingId:row.mapping_id,
        transformVersion:row.transform_version,periodStart:row.period_start.toISOString(),periodEnd:row.period_end.toISOString(),value,
        quality:{status:row.quality,ruleVersion:row.rule_version,reason:row.reason,decidedBy:row.decided_by}}};
    });
    return {items,nextAfterId:result.rows.length>f.limit?items.at(-1)!.id:null};
  }
}
