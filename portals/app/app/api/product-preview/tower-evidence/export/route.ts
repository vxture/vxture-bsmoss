import {cookies} from 'next/headers';
import {PREVIEW_COOKIE,previewFoundation,validPreviewSession} from '../../../../domains/tower-service/preview';
import {privateReportResponse} from '../../../../domains/reports/http';
import {evidenceModel} from '../../../../tower-service/evidence/model';
import {formatServiceQuantity} from '../../../../domains/tower-service/quantification';
import {evidenceCsvCell as csvCell} from '../../../../domains/tower-service/evidence-csv';
import {readTowerPreview} from '../../../../domains/tower-service/history-reader';
export const dynamic='force-dynamic';
// Text cells are spreadsheet-formula safe, including user-controlled source refs.
export async function GET(request:Request){
 if(process.env.BSMOSS_PRODUCT_PREVIEW!=='on')return privateReportResponse(Response.json({error:'NOT_AVAILABLE'},{status:404}));
 const session=(await cookies()).get(PREVIEW_COOKIE)?.value;if(!validPreviewSession(session))return privateReportResponse(Response.json({error:'SESSION_REQUIRED'},{status:401}));
 try{const input:Record<string,string|string[]>={};for(const [key,value] of new URL(request.url).searchParams){if(key in input)input[key]=[...(Array.isArray(input[key])?input[key]:[input[key]]) as string[],value];else input[key]=value;}
  const result=await readTowerPreview(input,session),model=evidenceModel(result.input,result.versions,result.access.operators,true);
  const headers=['snapshot','basis','site','customer','service','meter','from','to','quantity','unit','boundary','method','state','agreement','rule','binding','source','tenant_month','tenant_snapshot','tenant_count','anchor','sharing_rule','factor_bps','source_kind','service_item','configuration_object','stock_as_of','source_version'];
  const rows=model.rows.map(r=>{const config=r.kind==='configuration',meter=r.kind==='meter'?r:null;return [model.context.snapshotId,r.id,r.siteId,r.customer?.name??'',r.service,meter?.meterId??'',r.from,r.to,config&&r.quantity===null?'':formatServiceQuantity(r.quantity,r.dimension.scale),r.dimension.unit,r.dimension.boundary,r.method,r.state,config?r.configuration.agreementVersion:meter?.rule?.reference??'',config?r.configuration.ruleVersion:meter?.rule?.id??meter?.ruleIds.join('|'),meter?.binding?.id??'',r.sourceRef,meter?.sharing.month,meter?.sharing.tenantSnapshotId,meter?.sharing.tenants,meter?.sharing.anchor,meter?.sharing.ruleId,meter?.sharing.factorBps,r.kind,r.serviceItemId,config?r.configuration.componentId:'',config?r.stockAsOf:'',config?r.sourceVersion:model.source?.sourceVersion];});
  return privateReportResponse(new Response('\uFEFF'+[headers,...rows].map(row=>row.map(csvCell).join(',')).join('\r\n'),{headers:{'content-type':'text/csv; charset=utf-8','content-disposition':'attachment; filename="tower-evidence.csv"','x-content-type-options':'nosniff'}}));
 }catch(error){return privateReportResponse(Response.json({error:error instanceof Error&&/^invalid_/.test(error.message)?'INVALID_QUERY':'UNAVAILABLE'},{status:error instanceof Error&&/^invalid_/.test(error.message)?400:503}));}
}
