import { demoDataEnabled } from "../../../lib/demo-mode";
import {queryDailyReport,queryCalendarReport} from '../../../domains/map-demo/service.ts';
import {renderDailyReport} from '../../../domains/map-demo/report-html.ts';
import {renderCalendarReport} from '../../../domains/map-demo/period-report-html.ts';
import {parseReportPeriod} from '../../../domains/map-demo/period-rules.ts';
export const dynamic='force-dynamic';
export function GET(request:Request) {
 if(!demoDataEnabled())return new Response(null,{status:404});
 if(request.url.length>3000)return Response.json({error:'request_too_large'},{status:413});
 try {
  const params=new URL(request.url).searchParams,format=params.get('format')??'json';
  if(params.getAll('format').length>1||!['json','html'].includes(format))throw Error('invalid_format');
  params.delete('format');
  if(params.getAll('period').length>1)throw Error('invalid_period');
  const period=parseReportPeriod(params.get('period')??'day');
  if(period==='day')params.delete('period');
  const report=period==='day'?queryDailyReport(params):queryCalendarReport(params);
  const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
  if(format==='html')return new Response('period' in report?renderCalendarReport(report):renderDailyReport(report),{headers:{...headers,'Content-Type':'text/html; charset=utf-8','Content-Disposition':`attachment; filename="bsmoss-${report.id}.html"`,'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"}});
  return Response.json(report,{headers});
 }catch{return Response.json({error:'invalid_demo_report'},{status:400});}
}
