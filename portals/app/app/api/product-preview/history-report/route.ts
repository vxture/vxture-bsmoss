import { demoDataEnabled } from "../../../lib/demo-mode";
import {buildHistoryReport,assertHistorySnapshot} from '../../../analysis/history-report-service';
import {renderHistoryReport} from '../../../analysis/history-report-html';
export const dynamic='force-dynamic';
export function GET(request:Request){
 if(!demoDataEnabled())return new Response(null,{status:404});
 if(request.url.length>6000)return Response.json({error:'request_too_large'},{status:413});
 try{
  const p=new URL(request.url).searchParams;
  for(const key of p.keys())if(p.getAll(key).length!==1)throw Error('invalid_history_query');
  const format=p.get('format')??'html',snapshot=p.get('snapshot')??'';
  if(!['html','json'].includes(format)||!/^[a-f0-9]{64}$/.test(snapshot))throw Error('invalid_history_download');
  p.delete('format');p.delete('snapshot');
  const report=buildHistoryReport(Object.fromEntries(p));assertHistorySnapshot(snapshot,report.digest);
  return new Response(format==='html'?renderHistoryReport(report):JSON.stringify(report,null,2),{headers:{
   'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Bsmoss-Snapshot':report.digest,
   'Content-Type':format==='html'?'text/html; charset=utf-8':'application/json; charset=utf-8',
   'Content-Disposition':'attachment; filename="bsmoss-'+report.id+'.'+format+'"',
   'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  }});
 }catch(error){
  if(error instanceof Error&&error.message==='history_snapshot_changed')return Response.json({error:error.message},{status:409,headers:{'Cache-Control':'no-store'}});
  if(error instanceof Error&&/^(invalid_|conflicting_|missing_|outside_history|history_site_not_in_scope)/.test(error.message))return Response.json({error:'invalid_history_report'},{status:400});
  throw error;
 }
}
