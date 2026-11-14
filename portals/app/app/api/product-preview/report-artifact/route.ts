import {reportArtifact} from '../../../reports/local-service';
export const dynamic='force-dynamic';
export function GET(request:Request){
 if(process.env.BSMOSS_PRODUCT_PREVIEW!=='on')return new Response(null,{status:404});
 const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 if(request.url.length>8192)return Response.json({error:'request_too_large'},{status:413,headers});
 try{
  const p=new URL(request.url).searchParams;
  for(const key of p.keys())if(p.getAll(key).length!==1)throw Error('invalid_report_query');
  return Response.json(reportArtifact(Object.fromEntries(p)),{headers});
 }catch(error){
  const message=error instanceof Error?error.message:'';
  if(message==='report_file_changed')return Response.json({error:message},{status:409,headers});
  if(/^(invalid_|conflicting_|missing_|outside_history|history_site_not_in_scope|report_file_too_large)/.test(message))return Response.json({error:'invalid_report_artifact'},{status:400,headers});
  throw error;
 }
}
