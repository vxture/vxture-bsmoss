import {cookies} from 'next/headers';
import {PREVIEW_COOKIE,previewTowerReports,validPreviewSession} from '../../../domains/tower-service/preview';
import {privateReportResponse} from '../../../domains/reports/http';
import {boundedText} from '../../../lib/http';
import {towerReportHtml} from '../../../domains/tower-service/tower-report-html';
export const dynamic='force-dynamic';
const reply=(status:number,error:string)=>privateReportResponse(Response.json({error},{status}));
export async function GET(request:Request){
 if(process.env.BSMOSS_PRODUCT_PREVIEW!=='on')return reply(404,'NOT_AVAILABLE');const token=(await cookies()).get(PREVIEW_COOKIE)?.value;if(!validPreviewSession(token))return reply(401,'SESSION_REQUIRED');
 try{const q=new URL(request.url).searchParams;if([...q.keys()].some(k=>!['id','format'].includes(k)||q.getAll(k).length!==1)||q.has('format')&&!['html','json'].includes(q.get('format')!))throw Error('invalid_query');const service=previewTowerReports(token);if(!q.has('id')){if(q.size)throw Error('invalid_query');return privateReportResponse(Response.json({reports:await service.list()}));}
  const r=await service.get(q.get('id')!);if(!q.has('format'))return privateReportResponse(Response.json({report:r}));const format=q.get('format')!;return privateReportResponse(new Response(format==='html'?towerReportHtml(r,new URL(request.url).origin):JSON.stringify(r,null,2),{headers:{'content-type':format==='html'?'text/html; charset=utf-8':'application/json; charset=utf-8','content-disposition':'attachment; filename="'+r.id+'.'+format+'"','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"}}));
 }catch(error){const code=error instanceof Error?error.message:'';return reply(code==='report_not_found'?404:/^invalid_/.test(code)?400:code==='permission_denied'?403:503,code==='report_not_found'?'NOT_FOUND':/^invalid_/.test(code)?'INVALID_QUERY':'REPORT_UNAVAILABLE');}
}
export async function POST(request:Request){
 if(process.env.BSMOSS_PRODUCT_PREVIEW!=='on')return reply(404,'NOT_AVAILABLE');const token=(await cookies()).get(PREVIEW_COOKIE)?.value;if(!validPreviewSession(token))return reply(401,'SESSION_REQUIRED');
 const url=new URL(request.url);let origin:URL;try{origin=new URL(request.headers.get('origin')??'');}catch{return reply(403,'ORIGIN_DENIED');}if(!['127.0.0.1','localhost'].includes(url.hostname)||!['127.0.0.1','localhost'].includes(origin.hostname)||origin.protocol!=='http:'||origin.origin!==request.headers.get('origin')||origin.host!==request.headers.get('host'))return reply(403,'ORIGIN_DENIED');
 if(url.search)return reply(400,'INVALID_QUERY');if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get('content-type')??''))return reply(415,'JSON_REQUIRED');
 try{const body=JSON.parse(await boundedText(request,8192));if(!body||Array.isArray(body)||!['preview','generate'].includes(body.action)||Object.keys(body).sort().join()!==(body.action==='preview'?'action,query':'action,key,query')||!body.query||Array.isArray(body.query)||typeof body.query!=='object')throw Error('invalid_report_command');const service=previewTowerReports(token),report=body.action==='preview'?await service.preview(body.query):await service.generate(body.query,body.key);return privateReportResponse(Response.json({report}));
 }catch(error){const code=error instanceof Error?error.message:'';return reply(code==='body_too_large'?413:code==='permission_denied'?403:code==='revision_conflict'?409:/^invalid_/.test(code)||error instanceof SyntaxError?400:503,/^invalid_/.test(code)?'INVALID_COMMAND':code==='permission_denied'?'POLICY_DENIED':code==='revision_conflict'?'REVISION_CONFLICT':'REPORT_UNAVAILABLE');}
}
