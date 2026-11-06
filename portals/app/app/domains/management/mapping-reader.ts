import type { Pool, PoolClient } from "pg";
import type { MeasurementScope } from "../measurements/store.ts";
import { reportScope } from "../reports/rules.ts";
import type { ManagementPage } from "./rules.ts";
import { mappingRecord, type MappingQuery, type MappingRecord } from "./mapping-rules.ts";

export interface MappingReader {
  readonly workspaceId: string;
  list(query: MappingQuery): Promise<ManagementPage<MappingRecord>>;
  read(id: string): Promise<MappingRecord | null>;
}
const iso = (column: string) => `to_char(${column} AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
const kind = `CASE WHEN m.device_id IS NOT NULL THEN 'device' WHEN m.network_object_id IS NOT NULL THEN 'network' WHEN m.service_id IS NOT NULL THEN 'service' ELSE 'site' END`;
const select = `SELECT m.workspace_id,m.id,m.source_id,m.external_type,m.external_id,m.station_id,m.service_id,m.network_object_id,m.device_id,m.version,
 ${iso("m.valid_from")} valid_from,${iso("m.valid_to")} valid_to,s.id linked_station,s.name station_name,
 sv.station_id service_station,${iso("sv.valid_from")} service_from,${iso("sv.valid_to")} service_to,
 n.station_id network_station,n.service_id network_service,n.kind network_kind,d.station_id device_station
 FROM bsmoss_integration.source_mapping m
 JOIN bsmoss_resource.station s ON (s.workspace_id,s.id)=(m.workspace_id,m.station_id)
 LEFT JOIN bsmoss_resource.station_service sv ON (sv.workspace_id,sv.id)=(m.workspace_id,m.service_id)
 LEFT JOIN bsmoss_resource.network_object n ON (n.workspace_id,n.id)=(m.workspace_id,m.network_object_id)
 LEFT JOIN bsmoss_resource.device d ON (d.workspace_id,d.id)=(m.workspace_id,m.device_id)`;
const scoped = `m.workspace_id=$1 AND m.source_id=ANY($2::text[]) AND m.station_id=ANY($3::text[])
 AND (m.service_id IS NULL OR m.service_id=ANY($4::text[])) AND (m.device_id IS NULL OR m.device_id=ANY($5::text[]))
 AND (m.service_id IS NOT NULL OR m.device_id IS NOT NULL OR $6::boolean)`;
export class PgMappingReader implements MappingReader {
  readonly workspaceId: string; private scope: MeasurementScope;
  constructor(private pool: Pool, scope: MeasurementScope) { this.scope = reportScope(scope); this.workspaceId = this.scope.workspaceId; }
  private args() { const s = this.scope; return [s.workspaceId, s.sourceIds, s.stationIds, s.serviceIds, s.deviceIds, s.allowSiteParameters]; }
  private async snapshot<T>(read: (c: PoolClient) => Promise<T>) {
    const c = await this.pool.connect();
    try { await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY"); const result = await read(c); await c.query("COMMIT"); return result; }
    catch (e) { await c.query("ROLLBACK").catch(() => {}); throw e; } finally { c.release(); }
  }
  list(q: MappingQuery) { return this.snapshot(async c => {
    const rows = (await c.query(select + ` WHERE ${scoped} AND ($7::text='all' OR ${kind}=$7)
      AND ($8::text='' OR strpos(lower(concat_ws(' ',m.id,m.source_id,m.external_type,m.external_id,m.station_id,s.name,m.service_id,m.network_object_id,m.device_id)),lower($8))>0)
      AND ($9::text IS NULL OR m.id COLLATE "C">$9 COLLATE "C") ORDER BY m.id COLLATE "C" LIMIT $10`, [...this.args(), q.kind, q.search, q.after ?? null, q.limit + 1])).rows;
    const records = rows.map(row => mappingRecord(row, this.scope));
    return { items: records.slice(0, q.limit), next: records.length > q.limit ? records[q.limit - 1].id : null,
      capturedAt: new Date((await c.query("SELECT CURRENT_TIMESTAMP at")).rows[0].at).toISOString() };
  }); }
  read(id: string) { return this.snapshot(async c => {
    const rows = (await c.query(select + ` WHERE ${scoped} AND m.id=$7`, [...this.args(), id])).rows;
    return rows[0] ? mappingRecord(rows[0], this.scope) : null;
  }); }
}
