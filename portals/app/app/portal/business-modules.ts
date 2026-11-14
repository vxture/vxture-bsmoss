import type {IconName} from '@vxture/design-system';
import {towerNavigationHref} from '../tower-service/links';
import {regionLink,type RegionPreference} from './region-scope';
import {analysisHref} from '../tower-service/judgment/analysis-links';

// Navigation ownership is independent of whether an existing model was rebuilt.
// Original routes keep their validation, permissions and observation periods.
export const businessModuleIds=['overview','network','monitoring','services','judgment','resources','reports'] as const;
export type BusinessModuleId=typeof businessModuleIds[number];
export interface ModuleFunction {id:string;label:string;href:string;icon:IconName}
export const moduleFunctions:Record<BusinessModuleId,readonly ModuleFunction[]>={
 overview:[
  {id:'overview',label:'\u7ecf\u8425\u603b\u89c8',href:'/tower-service/overview',icon:'house-line'},
  {id:'runtime-overview',label:'\u8fd0\u884c\u603b\u89c8',href:'/',icon:'gauge'},
  {id:'situation',label:'\u7efc\u5408\u6001\u52bf',href:'/board',icon:'chart-bar'},
 ],
 network:[],monitoring:[],
 services:[
  {id:'services',label:'\u670d\u52a1\u91cf\u5316',href:'/tower-service/services',icon:'users'},
  {id:'usage-review',label:'\u7528\u91cf\u6838\u9a8c',href:'/usage-review',icon:'list-checks'},
  {id:'review-records',label:'\u6838\u9a8c\u8bb0\u5f55',href:'/usage-review?view=records',icon:'file-text'},
 ],
 judgment:[
  {id:'energy',label:'\u80fd\u8017\u5206\u6790',href:'/tower-service/judgment?view=energy',icon:'lightning'},
  {id:'sharing',label:'\u5171\u4eab\u5206\u6790',href:'/tower-service/judgment?view=sharing',icon:'share'},
  {id:'occupancy',label:'\u5165\u9a7b\u53d8\u5316',href:'/tower-service/judgment?view=occupancy',icon:'users'},
  {id:'regions',label:'\u533a\u57df\u5bf9\u6bd4',href:'/tower-service/network',icon:'map-pin'},
  {id:'findings',label:'\u5173\u6ce8\u4e8b\u9879',href:'/tower-service/judgment?view=findings',icon:'list-checks'},
  {id:'contribution',label:'\u53d8\u5316\u8d21\u732e',href:'/tower-service/judgment?view=contribution',icon:'chart-bar'},
  {id:'capacity',label:'\u627f\u8f7d\u5206\u6790',href:'/capacity',icon:'gauge'},
  {id:'efficiency',label:'\u8fd0\u884c\u80fd\u6548',href:'/efficiency',icon:'lightning'},
  {id:'analysis',label:'\u7ecf\u8425\u5206\u6790',href:'/analysis',icon:'chart-line-up'},
 ],
 resources:[
  {id:'resources',label:'\u8d44\u6e90\u5e95\u6570',href:'/tower-service/resources',icon:'building'},
  {id:'sites',label:'\u7ad9\u5740\u53f0\u8d26',href:'/sites',icon:'building'},
  {id:'customer-use',label:'\u5ba2\u6237\u4f7f\u7528',href:'/customer-use',icon:'plugs-connected'},
 ],
 reports:[
  {id:'library',label:'\u62a5\u544a\u5e93',href:'/reports',icon:'file-text'},
  {id:'tower-reports',label:'\u7814\u5224\u62a5\u544a',href:'/reports?view=tower',icon:'chart-line-up'},
  {id:'generation',label:'\u62a5\u544a\u751f\u6210',href:'/reports/new',icon:'newspaper'},
  {id:'tasks',label:'\u4efb\u52a1\u8bb0\u5f55',href:'/reports?view=tasks',icon:'list-checks'},
 ],
};
const ownedPaths:ReadonlyArray<readonly [BusinessModuleId,readonly string[]]>=[
 ['overview',['/tower-service/overview','/','/board']],
 ['network',['/product-preview']],['monitoring',['/monitoring']],
 ['services',['/tower-service/services','/tower-service/evidence','/usage-review','/review-history']],
 ['judgment',['/tower-service/judgment','/tower-service/network','/sharing','/capacity','/efficiency','/analysis']],
 ['resources',['/tower-service/resources','/sites','/customer-use','/operator-usage']],
 ['reports',['/reports','/usage-reports','/operations/reports']],
];
const matches=(path:string,root:string)=>path===root||root!=='/'&&path.startsWith(root+'/');
export function businessModuleForPath(path:string):BusinessModuleId|undefined{
 return ownedPaths.find(([,paths])=>paths.some(root=>matches(path,root)))?.[0];
}
export function activeModuleFunction(module:BusinessModuleId,path:string,query:string){
 const params=new URLSearchParams(query);
 return [...moduleFunctions[module]].sort((a,b)=>b.href.length-a.href.length).find(item=>{
  const target=new URL(item.href,'http://local');
  if(!matches(path,target.pathname))return false;
  const view=target.searchParams.get('view');
  return view?params.get('view')===view:true;
 })?.id??(module==='judgment'&&path==='/tower-service/judgment'&&!params.has('view')?'energy':undefined);
}
export function moduleFunctionHref(target:string,path:string,query:string,region?:RegionPreference['selection']){
 const source=new URLSearchParams(query),city=source.getAll('city'),county=source.getAll('county');
 const scope=region??(city.length===1&&county.length===1?{cityId:city[0],countyId:county[0]}:undefined);
 const href=towerNavigationHref(scope?regionLink(target,scope):target,path,query);
 const destination=new URL(href,'http://local');
 const view=destination.searchParams.get('view'),snapshots=source.getAll('snapshotId'),grain=source.get('grain');
 if(destination.pathname==='/tower-service/judgment'&&['energy','sharing','occupancy'].includes(view??'')&&snapshots.length===1&&snapshots[0]){
  return analysisHref({snapshotId:snapshots[0],city:scope?.cityId??'all',county:scope?.countyId??'all'},view as 'energy'|'sharing'|'occupancy',grain==='quarter'||grain==='year'?grain:'month');
 }
 // Frozen reports explicitly accept tower snapshot context; other old pages do not.
 if(destination.pathname==='/reports'&&destination.searchParams.get('view')==='tower'&&path.startsWith('/tower-service/')){
  for(const key of ['snapshotId','compareSnapshotId','operator']){
   const values=source.getAll(key);if(values.length===1&&values[0])destination.searchParams.set(key,values[0]);
  }
 }
 return destination.pathname+(destination.searchParams.size?'?'+destination.searchParams:'');
}
