import type { Pool, PoolClient } from "pg";
import type { MeasurementScope } from "../measurements/store.ts";
import { reportScope } from "../reports/rules.ts";
import type { ManagementPage } from "./rules.ts";
import { decodeAuditCursor, encodeAuditCursor, sourceRecord, sourceSummary, type SourceQuery, type SourceRecord, type SourceSummary } from "./source-rules.ts";
export interface SourceReader {
 readonly workspaceId:string;
 list(query:SourceQuery,audit:boolean):Promise<ManagementPage<SourceSummary>>;
 read(id:string,revision?:string):Promise<SourceRecord|null>;
}
const select=`SELECT b.*,b.database_sha256=encode(sha256(convert_to(b.binding::text,'UTF8')),'hex') AS valid,
 to_char(b.recorded_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') recorded_cursor FROM bsmoss_integration.source_binding_revision b`;
// Exact full-scope containment before LIMIT, never any-overlap visibility.
const scopeWhere=`b.workspace_id=$1 AND b.binding->'scope'->>'workspaceId'=$1
 AND b.binding->'scope' ?& ARRAY['workspaceId','sourceIds','stationIds','serviceIds','deviceIds','metricKeys','allowSiteParameters']
 AND (b.binding->'scope')-ARRAY['workspaceId','sourceIds','stationIds','serviceIds','deviceIds','metricKeys','allowSiteParameters']='{}'::jsonb
 AND jsonb_typeof(b.binding->'scope'->'sourceIds')='array' AND jsonb_typeof(b.binding->'scope'->'stationIds')='array'
 AND jsonb_typeof(b.binding->'scope'->'serviceIds')='array' AND jsonb_typeof(b.binding->'scope'->'deviceIds')='array' AND jsonb_typeof(b.binding->'scope'->'metricKeys')='array'
 AND ((b.binding->'scope')-'allowSiteParameters') <@ ($2::jsonb-'allowSiteParameters')
 AND (b.binding->'scope'->'allowSiteParameters'='false'::jsonb OR b.binding->'scope'->'allowSiteParameters'='true'::jsonb AND $2::jsonb->'allowSiteParameters'='true'::jsonb)`;
export class PgSourceReader implements SourceReader {
 readonly workspaceId:string; private scope:MeasurementScope;
 constructor(private pool:Pool,scope:MeasurementScope){this.scope=reportScope(scope);this.workspaceId=this.scope.workspaceId;}
 private async snapshot<T>(read:(c:PoolClient)=>Promise<T>){const c=await this.pool.connect();try{await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");const result=await read(c);await c.query("COMMIT");return result;}catch(e){await c.query("ROLLBACK").catch(()=>{});throw e;}finally{c.release();}}
 list(q:SourceQuery,audit:boolean){return this.snapshot(async c=>{
  const cursor=audit&&q.after?decodeAuditCursor(q.after):null;
  const rows=(await c.query(select+(audit?"":" JOIN bsmoss_integration.source_binding_head h ON (h.workspace_id,h.id,h.revision)=(b.workspace_id,b.id,b.revision)")+` WHERE ${scopeWhere}
   AND ($3::text='all' OR b.status=$3) AND ($4::text='' OR strpos(lower(b.id||' '||b.source_id||' '||(b.binding->>'adapterVersion')||' '||(b.binding->>'transformVersion')),lower($4))>0)
   AND `+(audit?`($5::timestamptz IS NULL OR b.recorded_at<$5 OR b.recorded_at=$5 AND (b.id COLLATE "C"<$6 COLLATE "C" OR b.id=$6 AND b.revision<$7::numeric)) ORDER BY b.recorded_at DESC,b.id COLLATE "C" DESC,b.revision DESC LIMIT $8`:`($5::text IS NULL OR b.id COLLATE "C">$5 COLLATE "C") ORDER BY b.id COLLATE "C" LIMIT $6`),
   audit?[this.workspaceId,this.scope,q.status,q.search,cursor?.at??null,cursor?.id??null,cursor?.revision??null,q.limit+1]:[this.workspaceId,this.scope,q.status,q.search,q.after??null,q.limit+1])).rows;
  const records=rows.map(r=>sourceRecord(r,this.scope)),last=records[q.limit-1];
  return {items:records.slice(0,q.limit).map(sourceSummary),next:records.length>q.limit?(audit?encodeAuditCursor({at:last.recordedAt,id:last.id,revision:last.revision}):last.id):null,capturedAt:new Date((await c.query("SELECT CURRENT_TIMESTAMP at")).rows[0].at).toISOString()};
 });}
 read(id:string,revision?:string){return this.snapshot(async c=>{
  const rows=(await c.query(select+(revision===undefined?" JOIN bsmoss_integration.source_binding_head h ON (h.workspace_id,h.id,h.revision)=(b.workspace_id,b.id,b.revision)":"")+` WHERE ${scopeWhere} AND b.id=$3`+(revision===undefined?"":" AND b.revision=$4::numeric"),revision===undefined?[this.workspaceId,this.scope,id]:[this.workspaceId,this.scope,id,revision])).rows;
  return rows[0]?sourceRecord(rows[0],this.scope):null;
 });}
}
