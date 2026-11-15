import { authenticatedDemoEnabled } from "../../lib/demo-mode";
import { defaultMonitoringConfiguration } from "./parameters";
import {cookies} from "next/headers";
import {getOidcConfig} from "../../auth/lib/config";
import {monitoringParametersForSession} from "../access/runtime";
import {boundedText} from "../../lib/http";
import {privateReportResponse} from "../reports/http";
import {monitoringParameterStore} from "./parameter-store";
import {monitoringCommand} from "./parameters";
const reply=(status:number,error:string)=>privateReportResponse(Response.json({error},{status}));
export function monitoringPreviewAllowed(){return process.env.BSMOSS_PRODUCT_PREVIEW==="on"&&!getOidcConfig().enabled&&["127.0.0.1","localhost"].includes(process.env.HOSTNAME_BIND??"127.0.0.1");}
async function session(){const cfg=getOidcConfig(),sid=(await cookies()).get(cfg.cookieName)?.value;if(!cfg.enabled||!sid)throw Error("identity_required");return monitoringParametersForSession(sid);}
export async function loadMonitoringConfiguration(){try{if(authenticatedDemoEnabled())return defaultMonitoringConfiguration();return await (monitoringPreviewAllowed()?monitoringParameterStore("preview").read():(await session()).read());}catch{throw Error("monitoring_configuration_unavailable");}}
export async function monitoringParameterRead(management=false){try{
 if(authenticatedDemoEnabled()){const configuration=defaultMonitoringConfiguration();return privateReportResponse(Response.json(management?{configuration,canEdit:false}:configuration));}
 if(monitoringPreviewAllowed()){const configuration=await monitoringParameterStore("preview").read();return privateReportResponse(Response.json(management?{configuration,canEdit:true}:configuration));}
 const service=await session(),configuration=await service.read(management);return privateReportResponse(Response.json(management?{configuration,canEdit:await service.canEdit()}:configuration));
 }catch(error){return parameterError(error);}}
export async function monitoringParameterWrite(request:Request){
 try{
 const preview=monitoringPreviewAllowed(),service=preview?null:await session();
 const expected=preview?'http://'+(process.env.HOSTNAME_BIND??"127.0.0.1")+':'+process.env.PORT:getOidcConfig().appOrigin;
 if(!expected||request.headers.get("origin")!==expected)return reply(403,"ORIGIN_DENIED");
 if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get("content-type")??""))return reply(415,"JSON_REQUIRED");
 if(new URL(request.url).search)return reply(400,"INVALID_COMMAND");
 const command=monitoringCommand(JSON.parse(await boundedText(request,8192)));
 const configuration=preview?await monitoringParameterStore("preview").update(command.revision,command.parameters,"local-preview",async()=>{}):await service!.update(command);
 return privateReportResponse(Response.json(configuration));
 }catch(error){return parameterError(error);}}
function parameterError(error:unknown){const message=error instanceof Error?error.message:"";
 if(["identity_required","access_expired"].includes(message))return reply(401,"AUTH_REQUIRED");
 if(["permission_denied","feature_denied"].includes(message))return reply(403,"POLICY_DENIED");
 if(message==="monitoring_revision_conflict")return reply(409,"REVISION_CONFLICT");
 if(message==="body_too_large")return reply(413,"BODY_TOO_LARGE");
 if(message.startsWith("invalid_monitoring")||error instanceof SyntaxError)return reply(400,"INVALID_PARAMETERS");
 return reply(503,"CONFIGURATION_UNAVAILABLE");
}
