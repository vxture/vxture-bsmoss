import {canMaintainAssets as allowed} from "../../../../domains/site-registry/maintenance-access";
import {boundedText} from "../../../../lib/http";
import {privateReportResponse} from "../../../../domains/reports/http";
import {registryMaintenanceStore} from "../../../../domains/site-registry/maintenance-store";
import {registryMaintenanceService} from "../../../../domains/site-registry/maintenance-service";
export const dynamic="force-dynamic";
const reply=(status:number,error:string)=>privateReportResponse(Response.json({error},{status}));
export async function POST(request:Request){
  if(!allowed())return reply(404,"NOT_AVAILABLE");
  const origin="http://"+(process.env.HOSTNAME_BIND??"127.0.0.1")+":"+process.env.PORT;
  if(request.headers.get("origin")!==origin)return reply(403,"ORIGIN_DENIED");
  if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get("content-type")??""))return reply(415,"JSON_REQUIRED");
  if(new URL(request.url).search)return reply(400,"INVALID_COMMAND");
  try{
    const authorize=async()=>{if(!allowed())throw Error("permission_denied");};
    const catalog=await registryMaintenanceService(registryMaintenanceStore(),authorize).update(JSON.parse(await boundedText(request,8192)));
    return privateReportResponse(Response.json(catalog));
  }catch(error){const message=error instanceof Error?error.message:"";
    if(message==="maintenance_conflict")return reply(409,"REVISION_CONFLICT");
    if(message==="permission_denied")return reply(403,"POLICY_DENIED");
    if(message==="asset_not_found")return reply(404,"ASSET_NOT_FOUND");
    if(message==="body_too_large")return reply(413,"BODY_TOO_LARGE");
    if(message==="invalid_maintenance"||error instanceof SyntaxError)return reply(400,"INVALID_COMMAND");
    return reply(503,"MAINTENANCE_UNAVAILABLE");
  }
}
