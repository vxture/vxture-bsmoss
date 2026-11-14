import {sharingAnalysis} from '../../domains/tower-service/sharing-analysis';
import type {QueryInput} from '../../domains/tower-service/query';
import {tenancyContext,type TenancyResult} from './tenancy-context';

export function sharingModel(input:QueryInput,result:TenancyResult){
 const base=tenancyContext(input,result),{context,snapshot,snapshots,grain,target}=base;
 const monthly=base.monthly.map(({month,source,ids})=>({month,sourceId:source?.id??null,sourceVersion:source?.sourceVersion??null,asOf:source?.asOf??null,...sharingAnalysis(source,ids,base.operators)}));
 const current=monthly[monthly.length-1],groups=new Map<string,typeof current>();
 for(const row of monthly){const key=grain==='month'?row.month:grain==='year'?row.month.slice(0,4):row.month.slice(0,4)+' Q'+Math.ceil(Number(row.month.slice(5,7))/3);groups.set(key,row);}
 const windowSize=grain==='month'?12:grain==='quarter'?8:3;
 const trend=[...groups].slice(-windowSize).map(([label,row])=>({label,month:row.month,sourceVersion:row.sourceVersion,asOf:row.asOf,occupied:row.occupied,shared:row.shared,rateBps:row.rateBps,buckets:row.buckets,complete:row.complete}));
 const prior=trend.length>1?trend[trend.length-2]:null,comparable=!!prior&&current.complete&&prior.complete&&prior.sourceVersion===current.sourceVersion;
 return {context,snapshot,snapshots,grain,current,trend,windowSize,change:{rateBps:comparable&&current.rateBps!==null&&prior!.rateBps!==null?current.rateBps-prior!.rateBps:null,shared:comparable?current.shared!-prior!.shared!:null},history:base.history,range:{start:trend[0]?.label??target,end:trend[trend.length-1]?.label??target,availableSince:base.availableSince},source:{id:current.sourceId,version:current.sourceVersion,asOf:current.asOf}};
}
export type SharingModel=ReturnType<typeof sharingModel>;
