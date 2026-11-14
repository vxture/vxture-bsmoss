import { sourceBinding } from "../integration/rules.ts";
import { fingerprintOf, positiveRevision } from "../aggregation/intervals.ts";
import { assertReportScope } from "../reports/rules.ts";
import type { SourceBinding } from "../integration/contracts.ts";
import type { MeasurementScope } from "../measurements/store.ts";
export interface SourceSummary { id: string; revision: string; sourceId: string; status: "active" | "paused"; adapterVersion: string; transformVersion: string; recordedAt: string; counts: {stations:number;services:number;devices:number;metrics:number} }
export interface SourceRecord extends SourceSummary { binding: SourceBinding; reviewRef: string; databaseActor: string; digest: string }
export interface SourceQuery { search: string; status: "all" | "active" | "paused"; limit: number; after?: string }
export interface AuditCursor { at:string; id:string; revision:string }
const text=(v:unknown):v is string=>typeof v==="string"&&!!v&&v.trim()===v&&v.length<=2048&&v!=="*"&&!/[\x00-\x1f\x7f]/.test(v);
export function sourceIdentity(id:string){if(!text(id))throw Error("invalid_management_query");return id;}
export function sourceRevision(value:string){try{positiveRevision(value);if(value.length>30)throw Error();}catch{throw Error("invalid_management_query");}return value;}
function validCursor(c:AuditCursor){
 if(!c||Object.keys(c).sort().join()!=="at,id,revision"||!text(c.id)||typeof c.at!=="string"||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(c.at)||!Number.isFinite(Date.parse(c.at))||new Date(c.at).toISOString()!==c.at.replace(/(\.\d{3})\d{3}Z$/,"$1Z"))throw Error("invalid_management_query");
 sourceRevision(c.revision); return c;
}
export function encodeAuditCursor(c:AuditCursor){return Buffer.from(JSON.stringify(validCursor(c))).toString("base64url");}
export function decodeAuditCursor(value:string):AuditCursor {
 try{if(value.length>16384||!/^[A-Za-z0-9_-]+$/.test(value))throw Error();const decoded=Buffer.from(value,"base64url").toString("utf8");const c=validCursor(JSON.parse(decoded));if(encodeAuditCursor(c)!==value)throw Error();return c;}catch{throw Error("invalid_management_query");}
}
export function sourceQuery(p:URLSearchParams,audit=false):SourceQuery {
 if(p.toString().length>24000||[...p.keys()].some(k=>!["search","status","limit","after"].includes(k)||p.getAll(k).length!==1))throw Error("invalid_management_query");
 const search=p.get("search")??"",status=p.get("status")??"all",limit=p.get("limit")??"20",after=p.get("after")??undefined;
 if(search.length>100||search!==search.trim()||search==="*"||/[\x00-\x1f\x7f]/.test(search)||!["all","active","paused"].includes(status)||!/^([1-9]|[1-4][0-9]|50)$/.test(limit))throw Error("invalid_management_query");
 if(after!==undefined){if(audit)decodeAuditCursor(after);else sourceIdentity(after);}
 return {search,status:status as SourceQuery["status"],limit:+limit,...(after===undefined?{}:{after})};
}
export function sourceRecord(row:any,viewer:MeasurementScope):SourceRecord {
 const b=sourceBinding(row.binding); assertReportScope(viewer,b.scope);
 if(row.valid!==true||row.workspace_id!==viewer.workspaceId||b.id!==row.id||b.revision!==row.revision||b.sourceId!==row.source_id||b.scope.workspaceId!==row.workspace_id||fingerprintOf(b)!==row.binding_sha256||!["active","paused"].includes(row.status)||!text(row.review_ref)||!text(row.database_actor))throw Error("invalid_source_registration");
 const at=row.recorded_cursor;
 validCursor({at,id:b.id,revision:b.revision});
 return {id:b.id,revision:b.revision,sourceId:b.sourceId,status:row.status,adapterVersion:b.adapterVersion,transformVersion:b.transformVersion,recordedAt:at,
  counts:{stations:b.scope.stationIds.length,services:b.scope.serviceIds.length,devices:b.scope.deviceIds.length,metrics:b.scope.metricKeys.length},binding:b,reviewRef:row.review_ref,databaseActor:row.database_actor,digest:row.binding_sha256};
}
export function sourceSummary({binding:_binding,reviewRef:_ref,databaseActor:_actor,digest:_digest,...summary}:SourceRecord):SourceSummary{return summary;}
