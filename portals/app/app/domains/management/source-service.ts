import { resolveMeasurementAccess, type AccessPorts } from "../access/resolve.ts";
import { fingerprintOf } from "../aggregation/intervals.ts";
import { reportScope } from "../reports/rules.ts";
import type { MeasurementScope } from "../measurements/store.ts";
import type { SourceReader } from "./source-reader.ts";
import { sourceIdentity,sourceQuery,sourceRevision } from "./source-rules.ts";
export function sourceManagement(ports:AccessPorts,readers:{create(scope:MeasurementScope):SourceReader}) {
 const now=ports.now??Date.now;
 async function run<T>(audit:boolean,read:(reader:SourceReader)=>Promise<T>){
  const operation=audit?"configuration_audit_view":"sources_view",first=await resolveMeasurementAccess(ports,operation,"interactive");
  const reader=readers.create(first.scope);if(reader.workspaceId!==first.context.workspaceId)throw Error("workspace_mismatch");
  if(first.expiresAt<=now())throw Error("access_expired");const result=await read(reader);
  if(first.expiresAt<=now())throw Error("access_expired");const current=await resolveMeasurementAccess(ports,operation,"interactive");
  if(current.context.workspaceId!==first.context.workspaceId||current.context.sub!==first.context.sub||fingerprintOf(reportScope(current.scope))!==fingerprintOf(reportScope(first.scope)))throw Error("permission_denied");
  if(current.expiresAt<=now())throw Error("access_expired");return result;
 }
 return Object.freeze({
  list:(params:URLSearchParams,audit=false)=>run(audit,r=>r.list(sourceQuery(params,audit),audit)),
  read:async(id:string,params:URLSearchParams,audit=false)=>{const result=await run(audit,r=>{
   if([...params.keys()].some(k=>k!=="revision")||audit&&(params.getAll("revision").length!==1)||!audit&&params.size)throw Error("invalid_management_query");
   return r.read(sourceIdentity(id),audit?sourceRevision(params.get("revision")!):undefined);
  });if(!result)throw Error("source_configuration_unavailable");return result;},
 });
}
