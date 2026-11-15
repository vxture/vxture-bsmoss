import { demoDataEnabled } from "../../../lib/demo-mode";
import { parseMapQuery, queryMap } from '../../../domains/map-demo/service.ts';
export const dynamic='force-dynamic';
export function GET(request: Request) {
  if(!demoDataEnabled())return new Response(null,{status:404});
  if(request.url.length>3000)return Response.json({error:'request_too_large'},{status:413});
  try {
    return Response.json(queryMap(parseMapQuery(new URL(request.url).searchParams)),{headers:{'Cache-Control':'no-store'}});
  } catch { return Response.json({error:'invalid_demo_query'},{status:400}); }
}
