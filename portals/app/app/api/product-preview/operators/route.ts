import { demoDataEnabled } from "../../../lib/demo-mode";
import {queryOperatorUsage,queryCalendarUsage} from '../../../domains/map-demo/service.ts';
export const dynamic='force-dynamic';
export function GET(request:Request) {
  if(!demoDataEnabled())return new Response(null,{status:404});
  if(request.url.length>3000)return Response.json({error:'request_too_large'},{status:413});
  try {
    const p=new URL(request.url).searchParams;
    const result=p.get('period')==='week'||p.get('period')==='month'?queryCalendarUsage(p):queryOperatorUsage(p);
    return Response.json(result,{headers:{'Cache-Control':'no-store'}});
  }catch{return Response.json({error:'invalid_demo_usage'},{status:400});}
}
