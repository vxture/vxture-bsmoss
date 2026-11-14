import { cookies } from "next/headers";
import { getOidcConfig } from "../../../../auth/lib/config";
import { sourceManagementForSession } from "../../../../domains/access/runtime";
import { managementHttpError } from "../../../../domains/management/http";
import { privateReportResponse } from "../../../../domains/reports/http";
import { errorResponse } from "../../../../platform/envelope";
export const dynamic="force-dynamic";
export async function GET(request:Request,context:{params:Promise<{id:string}>}){
 const cfg=getOidcConfig(),sid=(await cookies()).get(cfg.cookieName)?.value;
 if(!cfg.enabled||!sid)return privateReportResponse(errorResponse(401,"AUTH_REQUIRED","Authentication required"));
 try{return privateReportResponse(Response.json(await sourceManagementForSession(sid).read((await context.params).id,new URL(request.url).searchParams,true)));}catch(error){return managementHttpError(error);}
}
