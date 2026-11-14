import type { Pool, PoolClient } from "pg";
import type { MeasurementScope } from "../measurements/store.ts";
import { reportScope } from "../reports/rules.ts";
import { memberRecord, memberSummary, type DirectoryQuery, type JurisdictionQuery, type ManagementPage, type MemberRecord, type MemberSummary, type StationRecord } from "./rules.ts";
export interface ManagementReader {
 readonly workspaceId: string;
 members(query: DirectoryQuery): Promise<ManagementPage<MemberSummary>>;
 member(id: string): Promise<MemberRecord | null>;
 jurisdiction(query: JurisdictionQuery): Promise<ManagementPage<StationRecord>>;
}
// Full stored scope containment is checked before LIMIT. Never expose a member
// merely because one of their stations overlaps the viewer's authority.
const memberFields = `m.id,m.sub,m.display_name,m.status,s.scope,s.expires_at,
 coalesce((SELECT jsonb_agg(jsonb_build_object('code',r.role_code,'name',r.name,'permissions',
  ARRAY(SELECT p.perm_code FROM local_authz.role_permission rp JOIN local_authz.permission p ON p.id=rp.permission_id WHERE rp.role_id=r.id ORDER BY p.perm_code)) ORDER BY r.role_code)
  FROM local_authz.member_role mr JOIN local_authz.role r ON r.id=mr.role_id WHERE mr.member_id=m.id),'[]'::jsonb) AS roles`;
const memberFrom = `FROM local_authz.member m JOIN local_authz.data_scope s ON (s.workspace_id,s.member_id)=(m.workspace_id,m.id)
 WHERE m.workspace_id=$1::uuid AND s.scope->>'workspaceId'=$1::text
 AND s.scope ?& ARRAY['workspaceId','sourceIds','stationIds','serviceIds','deviceIds','metricKeys','allowSiteParameters']
 AND s.scope-ARRAY['workspaceId','sourceIds','stationIds','serviceIds','deviceIds','metricKeys','allowSiteParameters']='{}'::jsonb
 AND jsonb_typeof(s.scope->'sourceIds')='array' AND jsonb_typeof(s.scope->'stationIds')='array'
 AND jsonb_typeof(s.scope->'serviceIds')='array' AND jsonb_typeof(s.scope->'deviceIds')='array' AND jsonb_typeof(s.scope->'metricKeys')='array'
 AND (s.scope-'allowSiteParameters') <@ ($2::jsonb-'allowSiteParameters')
 AND (s.scope->'allowSiteParameters'='false'::jsonb OR s.scope->'allowSiteParameters'='true'::jsonb AND ($2::jsonb->'allowSiteParameters')='true'::jsonb)`;
export class PgManagementReader implements ManagementReader {
 readonly workspaceId: string;
 private scope: MeasurementScope;
 constructor(private pool: Pool, scope: MeasurementScope) { this.scope = reportScope(scope); this.workspaceId = scope.workspaceId; }
 private async snapshot<T>(read: (db: PoolClient, at: string) => Promise<T>): Promise<T> {
  const db = await this.pool.connect();
  try { await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY"); const at = (await db.query("SELECT CURRENT_TIMESTAMP AS at")).rows[0].at;
   const result = await read(db, new Date(at).toISOString()); await db.query("COMMIT"); return result;
  } catch (error) { await db.query("ROLLBACK").catch(() => {}); throw error; } finally { db.release(); }
 }
 async members(q: DirectoryQuery) {
  return this.snapshot(async (db, capturedAt) => {
   const result = await db.query(`SELECT ${memberFields} ${memberFrom}
    AND ($3::text='all' OR m.status=$3) AND ($4::text='' OR strpos(lower(coalesce(m.display_name,'')||' '||m.sub),lower($4))>0)
    AND ($5::uuid IS NULL OR m.id>$5) ORDER BY m.id LIMIT $6`, [this.workspaceId, this.scope, q.status, q.search, q.after ?? null, q.limit+1]);
   const records = result.rows.map(r => memberRecord(r, this.scope));
   return { items: records.slice(0,q.limit).map(memberSummary), next: records.length>q.limit ? records[q.limit-1].id : null, capturedAt };
  });
 }
 async member(id: string) {
  return this.snapshot(async db => {
   const result = await db.query(`SELECT ${memberFields} ${memberFrom} AND m.id=$3::uuid`, [this.workspaceId, this.scope, id]);
   return result.rows[0] ? memberRecord(result.rows[0],this.scope) : null;
  });
 }
 async jurisdiction(q: JurisdictionQuery) {
  return this.snapshot(async (db,capturedAt) => {
   const result = await db.query(`SELECT s.id,s.name,s.province_code,s.city_code,
    (SELECT count(*)::int FROM bsmoss_resource.station_service x WHERE x.workspace_id=s.workspace_id AND x.station_id=s.id AND x.id=ANY($3::text[])) AS services,
    (SELECT count(*)::int FROM bsmoss_resource.device x WHERE x.workspace_id=s.workspace_id AND x.station_id=s.id AND x.id=ANY($4::text[])) AS devices
    FROM bsmoss_resource.station s WHERE s.workspace_id=$1 AND s.id=ANY($2::text[])
    AND ($5::text='all' OR s.city_code=$5) AND ($6::text='' OR strpos(lower(s.name||' '||s.id),lower($6))>0)
    AND ($7::text IS NULL OR s.id COLLATE "C">$7 COLLATE "C") ORDER BY s.id COLLATE "C" LIMIT $8`,
    [this.workspaceId,this.scope.stationIds,this.scope.serviceIds,this.scope.deviceIds,q.city,q.search,q.after??null,q.limit+1]);
   const records: StationRecord[] = result.rows.map(r => ({ id:r.id,name:r.name,province:r.province_code,city:r.city_code,services:r.services,devices:r.devices }));
   return { items:records.slice(0,q.limit), next:records.length>q.limit ? records[q.limit-1].id : null,capturedAt };
  });
 }
}
