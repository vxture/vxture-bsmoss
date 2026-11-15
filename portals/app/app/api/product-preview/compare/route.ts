import { demoDataEnabled } from "../../../lib/demo-mode";
import { parseComparisonQuery, queryComparison } from '../../../domains/map-demo/service.ts';
export const dynamic='force-dynamic';
export function GET(request:Request) {
  if(!demoDataEnabled())return new Response(null,{status:404});
  if(request.url.length>3000)return Response.json({error:'request_too_large'},{status:413});
  try {
    const {ids,query}=parseComparisonQuery(new URL(request.url).searchParams);
    return Response.json(queryComparison(ids,query),{headers:{'Cache-Control':'no-store'}});
  }catch{return Response.json({error:'invalid_demo_comparison'},{status:400});}
}
