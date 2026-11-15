import { demoDataEnabled } from "../../../../../../lib/demo-mode";
import {queryStationReport} from '../../../../../../domains/map-demo/service.ts';
import {renderStationReport} from '../../../../../../domains/map-demo/station-report-html.ts';
export const dynamic='force-dynamic';
export async function GET(request:Request,context:{params:Promise<{id:string}>}) {
  if(!demoDataEnabled())return new Response(null,{status:404});
  if(request.url.length>3000)return Response.json({error:'request_too_large'},{status:413});
  try {
    const params=new URL(request.url).searchParams,format=params.get('format')??'json';
    if(params.getAll('format').length>1||!['json','html'].includes(format))throw Error('invalid_format');
    params.delete('format');const {id}=await context.params,report=queryStationReport(id,params);
    if(!report)return Response.json({error:'site_not_in_demo_scope'},{status:404});
    const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
    if(format==='html')return new Response(renderStationReport(report),{headers:{...headers,'Content-Type':'text/html; charset=utf-8','Content-Disposition':`attachment; filename="bsmoss-${report.id}.html"`,'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"}});
    return Response.json(report,{headers});
  }catch{return Response.json({error:'invalid_demo_station_report'},{status:400});}
}
