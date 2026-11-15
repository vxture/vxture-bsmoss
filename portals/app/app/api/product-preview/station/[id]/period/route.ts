import { demoDataEnabled } from "../../../../../lib/demo-mode";
import {queryStationPeriod} from '../../../../../domains/map-demo/service.ts';
export const dynamic='force-dynamic';
export async function GET(request:Request,context:{params:Promise<{id:string}>}) {
  if(!demoDataEnabled())return new Response(null,{status:404});
  if(request.url.length>3000)return Response.json({error:'request_too_large'},{status:413});
  try {
    const {id}=await context.params,result=queryStationPeriod(id,new URL(request.url).searchParams);
    return result?Response.json(result,{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}}):Response.json({error:'site_not_in_demo_scope'},{status:404});
  }catch{return Response.json({error:'invalid_demo_station_period'},{status:400});}
}
