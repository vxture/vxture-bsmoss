import {cookies} from "next/headers";
import {getOidcConfig} from "../../auth/lib/config";
import {operatorIdentitiesForSession} from "../access/runtime";
import {operatorIdentityStore} from "./runtime-store";
import {identityCommand} from "./rules";
import {normalizeLogo} from "./logo";
import {boundedText} from "../../lib/http";
import {privateReportResponse} from "../reports/http";

const reply=(status:number,error:string)=>privateReportResponse(Response.json({error},{status}));
function previewAllowed(){return process.env.BSMOSS_PRODUCT_PREVIEW==="on"&&!getOidcConfig().enabled&&["127.0.0.1","localhost"].includes(process.env.HOSTNAME_BIND??"127.0.0.1");}
export async function identityRead(management=false){
  try{
    if(previewAllowed()){const catalog=await operatorIdentityStore("preview").read();return privateReportResponse(Response.json(management?{catalog,canEdit:true}:catalog));}
    const cfg=getOidcConfig(),sid=(await cookies()).get(cfg.cookieName)?.value;
    if(!cfg.enabled||!sid)return reply(401,"AUTH_REQUIRED");
    const catalog=await operatorIdentitiesForSession(sid).read(management);
    // The command endpoint always rechecks edit permission; this flag is UI only.
    const canEdit=management?await operatorIdentitiesForSession(sid).canEdit():false;
    return privateReportResponse(Response.json(management?{catalog,canEdit}:catalog));
  }catch(error){return identityError(error);}
}
export async function identityWrite(request:Request){
  const cfg=getOidcConfig(),preview=previewAllowed(),sid=(await cookies()).get(cfg.cookieName)?.value;
  if(!preview&&(!cfg.enabled||!sid))return reply(401,"AUTH_REQUIRED");
  const expected=preview?`http://${process.env.HOSTNAME_BIND??"127.0.0.1"}:${process.env.PORT}`:cfg.appOrigin;
  if(!expected||request.headers.get("origin")!==expected)return reply(403,"ORIGIN_DENIED");
  if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get("content-type")??""))return reply(415,"JSON_REQUIRED");
  if(new URL(request.url).search)return reply(400,"INVALID_COMMAND");
  try{
    const command=identityCommand(JSON.parse(await boundedText(request,750000)));
    if(preview)command.record.logo=await normalizeLogo(command.record.logo);
    const catalog=preview?await operatorIdentityStore("preview").update(command.revision,command.record,"local-preview",async()=>{},command.action):await operatorIdentitiesForSession(sid!).update(command);
    return privateReportResponse(Response.json(catalog));
  }catch(error){return identityError(error);}
}
export function identityError(error:unknown){
  const message=error instanceof Error?error.message:"";
  if(["identity_required","access_expired"].includes(message))return reply(401,"AUTH_REQUIRED");
  if(["permission_denied","feature_denied"].includes(message))return reply(403,"POLICY_DENIED");
  if(message==="operator_revision_conflict")return reply(409,"REVISION_CONFLICT");
  if(message==="operator_identity_conflict")return reply(409,"IDENTITY_CONFLICT");
  if(message==="body_too_large")return reply(413,"LOGO_TOO_LARGE");
  if(message.startsWith("invalid_operator")||error instanceof SyntaxError)return reply(400,"INVALID_IDENTITY");
  return reply(503,"CONFIGURATION_UNAVAILABLE");
}
