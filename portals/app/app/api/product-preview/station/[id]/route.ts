import { parseMapQuery, queryStation } from '../../../../domains/map-demo/service.ts';
export const dynamic='force-dynamic';
export async function GET(request: Request,context:{params:Promise<{id:string}>}) {
  if(process.env.BSMOSS_PRODUCT_PREVIEW!=='on')return new Response(null,{status:404});
  if(request.url.length>3000)return Response.json({error:'request_too_large'},{status:413});
  try {
    const {id}=await context.params;
    const detail=queryStation(id,parseMapQuery(new URL(request.url).searchParams));
    return detail?Response.json(detail,{headers:{'Cache-Control':'no-store'}}):Response.json({error:'site_not_in_demo_scope'},{status:404});
  } catch { return Response.json({error:'invalid_demo_query'},{status:400}); }
}
