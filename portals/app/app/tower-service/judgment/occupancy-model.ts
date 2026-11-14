import {occupancyAnalysis,type OccupancyEndpoint} from '../../domains/tower-service/occupancy-analysis';
import type {QueryInput} from '../../domains/tower-service/query';
import {tenancyContext,type TenancyResult} from './tenancy-context';

export function occupancyModel(input:QueryInput,result:TenancyResult){
 const base=tenancyContext(input,result),scopeKey=JSON.stringify([base.context.city,base.context.county,[...result.scope.siteIds].sort(),base.operators]);
 const groups=new Map<string,typeof base.monthly[number]>();
 for(const row of base.monthly){const key=base.grain==='month'?row.month:base.grain==='year'?row.month.slice(0,4):row.month.slice(0,4)+' Q'+Math.ceil(Number(row.month.slice(5,7))/3);groups.set(key,row);}
 // Formal captures do not yet provide an authoritative monthly physical-site
 // lifecycle. Preserve all known regional sites so an omitted old site becomes
 // unknown, never a fabricated business exit or a silently dropped relation.
 const formalSites=new Map(result.versions.flatMap(v=>v.inventory.rows).map(r=>[r.id,r]));
 const formalIds=[...formalSites.values()].filter(r=>(base.context.city==='all'||r.city===base.context.city)&&(base.context.county==='all'||r.county===base.context.county)).map(r=>r.id);
 const endpoint=(row:typeof base.monthly[number]|undefined):OccupancyEndpoint=>({snapshot:!base.history&&row?.source?.sites.some(r=>!formalSites.has(r.siteId))?null:row?.source??null,siteIds:base.history?row?.ids??[]:formalIds,scopeKey});
 const windowSize=base.grain==='month'?12:base.grain==='quarter'?8:3;
 const trend=[...groups].slice(-windowSize).map(([label,row])=>{
  const year=Number(row.month.slice(0,4)),month=Number(row.month.slice(5,7))-1,span=base.grain==='year'?12:base.grain==='quarter'?3:1;
  const baselineMonth=new Date(Date.UTC(year,Math.floor(month/span)*span,0)).toISOString().slice(0,7),prior=base.monthly.find(r=>r.month===baselineMonth);
  return {label,month:row.month,asOf:row.source?.asOf??null,baselineMonth,baselineAsOf:prior?.source?.asOf??null,sourceId:row.source?.id??null,baselineSourceId:prior?.source?.id??null,...occupancyAnalysis(endpoint(row),endpoint(prior),base.operators)};
 });
 const current=trend[trend.length-1];
 return {context:base.context,snapshot:base.snapshot,snapshots:base.snapshots,grain:base.grain,history:base.history,windowSize,trend,current,range:{start:trend[0]?.label??base.target,end:current.label,availableSince:base.availableSince}};
}
export type OccupancyModel=ReturnType<typeof occupancyModel>;
