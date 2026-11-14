import type {OperatorFilter} from '../domains/map-demo/types';
import {siteAnalysisModel} from '../site-analysis/model';
import {DEMO_SITES} from '../domains/map-demo/resources';
import {DEMO_DATE} from '../domains/map-demo/rules';
import {SAMPLE_CUTOFF} from '../domains/map-demo/period-rules';
import {analysisPeriod} from '../domains/analysis/period';
import {aggregateBusinessUsage,businessWindow,compareUsage,sumUsage,usageEvidence,usageMetrics,type UsageMetric} from '../domains/business-usage/rules';
export function businessUsageModel(input:Record<string,string|string[]|undefined>){
 const {usageSort='bytes',...base}=input;
 if(typeof usageSort!=='string'||!usageMetrics.includes(usageSort as UsageMetric))throw Error('invalid_usage_sort');
 const normalized={...base,operatorCount:'all',sharing:'all',period:base.period??(base.hour!==undefined?'hour':'day'),asOf:base.asOf??(base.hour!==undefined?DEMO_DATE+'T'+String(base.hour).padStart(2,'0')+':00:00':DEMO_DATE+'T23:00:00')};
 const details=siteAnalysisModel(normalized),scope=siteAnalysisModel({...normalized,search:''}),window=businessWindow(details.requestedAsOf,details.query.period);
 const catalog=new Map(DEMO_SITES.map(s=>[s.id,s])),aggregate=aggregateBusinessUsage(scope.rows.map(r=>catalog.get(r.id)!),scope.query.operator as OperatorFilter,window,scope.query.period),byId=new Map(aggregate.rows.map(r=>[r.id,r]));
 const rows=details.rows.map(row=>({...row,usage:byId.get(row.id)!})).sort((a,b)=>compareUsage(a.usage,b.usage,usageSort as UsageMetric)||a.id.localeCompare(b.id));
 const page=Math.min(details.query.page,Math.max(1,Math.ceil(rows.length/details.query.pageSize))),visible=new Set(rows.slice((page-1)*details.query.pageSize,page*details.query.pageSize).map(row=>row.id));
 const clientRows=rows.map(row=>({...row,devices:[],usage:{...row.usage,operators:visible.has(row.id)?row.usage.operators:[],series:visible.has(row.id)?usageEvidence(catalog.get(row.id)!,scope.query.operator as OperatorFilter,window,scope.query.period):[]}}));
 const regions=scope.regions.map(region=>{const members=scope.rows.filter(row=>scope.query.city==='all'?row.city===region.id:row.county===region.id);return {...region,sites:members.length,...sumUsage(members.map(row=>byId.get(row.id)!))};});
 const {rows:unused,...overview}=aggregate;
 return {...details,query:{...details.query,asOf:window.asOf,hour:Number(window.asOf.slice(11,13))},snapshotAt:window.asOf,adjusted:window.adjusted,previousAsOf:window.previousAsOf,nextAsOf:window.nextAsOf,updatedThrough:SAMPLE_CUTOFF,rows:clientRows,summary:scope.summary,
  usage:{...overview,regions,window,period:analysisPeriod(window,scope.query.period),sort:usageSort as UsageMetric}};
}
export type BusinessUsageModel=ReturnType<typeof businessUsageModel>;
