import { demoDataEnabled } from "../../lib/demo-mode";
import ProductFrame from '../../portal/header';
import FoundationAdmin from '../admin';
import {cookies} from 'next/headers';
import {PREVIEW_COOKIE} from '../../domains/tower-service/preview';
import {readTowerPreview} from '../../domains/tower-service/history-reader';
import {rememberedRegionInput} from '../../portal/region-preference';
import {evidenceModel} from '../evidence/model';
import type {RuleComparisonData} from '../rule-comparison';
import ConfigurationComparison from './comparison';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const input=await searchParams,preview=demoDataEnabled();
 const view=typeof input.view==='string'&&['agreements','judgment','access'].includes(input.view)?input.view:'agreements';
 if(view==='agreements'&&input.tool==='compare'){
  let frozen:RuleComparisonData|undefined,error:string|undefined;
  if((input.source==='snapshot'||input.snapshotId)&&preview){try{
   const query:Record<string,string>={view:'rules'};
   for(const key of ['snapshotId','operator','city','county','dimension','service','ruleA','ruleB']){const value=input[key];if(typeof value!=='string'&&value!==undefined)throw Error('invalid_query');if(typeof value==='string')query[key]=value;}
   const result=await readTowerPreview(await rememberedRegionInput(query),(await cookies()).get(PREVIEW_COOKIE)?.value);
   const model=evidenceModel(result.input,result.versions,result.access.operators);
   frozen={rules:model.rules,ruleCustomers:model.ruleCustomers,service:model.filters.service,ruleA:model.filters.ruleA,ruleB:model.filters.ruleB,snapshot:{id:model.context.snapshotId,dataThrough:model.snapshot.dataThrough}};
  }catch{error='\u539f\u5feb\u7167\u53e3\u5f84\u65e0\u6cd5\u8bfb\u53d6\uff0c\u8bf7\u68c0\u67e5\u7248\u672c\u4e0e\u8bbf\u95ee\u8303\u56f4\u3002';}}
  return <ProductFrame active="analysis-rules" preview={preview}><ConfigurationComparison key={frozen?.snapshot?.id??(error?'error':'configured')} frozen={frozen} preview={preview} error={error}/></ProductFrame>;
 }
 return <ProductFrame active="analysis-rules"><FoundationAdmin area="rules" view={view} preview={preview}/></ProductFrame>;
}
