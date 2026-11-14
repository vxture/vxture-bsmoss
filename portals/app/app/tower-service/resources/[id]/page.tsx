import {cookies} from 'next/headers';
import {notFound} from 'next/navigation';
import ProductFrame from '../../../portal/header';
import {PREVIEW_COOKIE,previewFoundation,previewSeed,validPreviewSession} from '../../../domains/tower-service/preview';
import {baselineModel} from '../baseline-model';
import Detail from './site-detail';
import {readTowerPreview} from '../../../domains/tower-service/history-reader';
export const dynamic='force-dynamic';
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
 if(process.env.BSMOSS_PRODUCT_PREVIEW!=='on')notFound();
 const session=(await cookies()).get(PREVIEW_COOKIE)?.value;
 try{const result=await readTowerPreview(await searchParams,session),input=result.input,versions=result.versions,model=baselineModel(input,versions),id=(await params).id,inventory=versions.find(s=>s.id===model.context.snapshotId)!.inventory;
  const row=inventory.rows.find(r=>r.id===id&&(model.context.city==='all'||r.city===model.context.city)&&(model.context.county==='all'||r.county===model.context.county)&&(model.context.operator==='all'||r.allOperators.includes(model.context.operator)));if(!row)notFound();
  return <ProductFrame active="customer-use" preview><Detail row={row} snapshot={model.snapshot} context={model.context} returnQuery={{...model.filters,view:model.view,search:model.data.query.search,operatorCount:model.data.query.operatorCount,page:String(model.data.query.page),pageSize:String(model.data.query.pageSize)}} tenancy={model.tenancy.rows.find(r=>r.siteId===id)??null} monthVersion={model.tenantVersion}/></ProductFrame>;
 }catch(error){if(error instanceof Error&&/^(invalid_|query_too_large)/.test(error.message))notFound();throw error;}
}
