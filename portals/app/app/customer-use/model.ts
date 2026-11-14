import {siteAnalysisModel} from '../site-analysis/model';
import {DEMO_SITES} from '../domains/map-demo/resources';
import {DEMO_DATE} from '../domains/map-demo/rules';
import {SAMPLE_CUTOFF} from '../domains/map-demo/period-rules';
import {analysisPeriod} from '../domains/analysis/period';
import {sharingSummary} from '../domains/sharing/rules';
import {aggregateBusinessUsage,businessWindow,compareUsage,sumUsage,usageEvidence,usageMetrics,type UsageMetric} from '../domains/business-usage/rules';
import type {OperatorFilter} from '../domains/map-demo/types';
export function customerUseModel(input:Record<string,string|string[]|undefined>){
 const {usageSort='bytes',compare='sites',tenancy,sharing='all',...base}=input;
 if(typeof usageSort!=='string'||!usageMetrics.includes(usageSort as UsageMetric))throw Error('invalid_usage_sort');
 if(typeof compare!=='string'||!['sites','sharing','usage'].includes(compare))throw Error('invalid_comparison');
 if(typeof sharing!=='string'||!['all','single','shared','multi'].includes(sharing))throw Error('invalid_sharing');
 const group=tenancy??sharing;
 if(typeof group!=='string'||!['all','single','double','multi','shared'].includes(group))throw Error('invalid_tenancy');
 const normalized={...base,sharing:'all',period:base.period??(base.hour!==undefined?'hour':'day'),asOf:base.asOf??DEMO_DATE+'T'+(base.hour!==undefined?String(base.hour).padStart(2,'0'):'23')+':00:00'};
 const details=siteAnalysisModel(normalized),scope=siteAnalysisModel({...normalized,search:'',operatorCount:'all',site:'all'});
 const window=businessWindow(details.requestedAsOf,details.query.period),catalog=new Map(DEMO_SITES.map(s=>[s.id,s]));
 const aggregate=aggregateBusinessUsage(scope.rows.map(r=>catalog.get(r.id)!),scope.query.operator as OperatorFilter,window,scope.query.period),byId=new Map(aggregate.rows.map(r=>[r.id,r]));
 const inGroup=(count:number)=>group==='all'||(group==='single'?count===1:group==='double'?count===2:group==='multi'?count>=3:count>=2);
 const rows=details.rows.filter(row=>inGroup(row.allOperators.length)&&(details.query.site==='all'||row.id===details.query.site)).map(row=>({...row,usage:byId.get(row.id)!})).sort((a,b)=>compareUsage(a.usage,b.usage,usageSort as UsageMetric)||a.id.localeCompare(b.id));
 const page=Math.min(details.query.page,Math.max(1,Math.ceil(rows.length/details.query.pageSize))),visible=new Set(rows.slice((page-1)*details.query.pageSize,page*details.query.pageSize).map(row=>row.id));
 const clientRows=rows.map(row=>({...row,usage:{...row.usage,operators:visible.has(row.id)?row.usage.operators:[],series:visible.has(row.id)?usageEvidence(catalog.get(row.id)!,scope.query.operator as OperatorFilter,window,scope.query.period):[]}}));
 const regions=scope.regions.map(region=>{const members=scope.rows.filter(row=>scope.query.city==='all'?row.city===region.id:row.county===region.id);return {...region,sharing:sharingSummary(members),...sumUsage(members.map(row=>byId.get(row.id)!))};});
 const {rows:unused,...usage}=aggregate;
 const occupancyCounts=details.occupancyCounts.map(item=>({...item,count:item.value==='all'?details.occupancyCounts.slice(1).filter(entry=>inGroup(Number(entry.value))).reduce((sum,entry)=>sum+entry.count,0):inGroup(Number(item.value))?item.count:0}));
 return {...details,query:{...details.query,asOf:window.asOf,hour:Number(window.asOf.slice(11,13))},occupancyCounts,summary:scope.summary,operators:scope.operators,regions,rows:clientRows,sharing:sharingSummary(scope.rows),resourceAt:scope.snapshotAt,tenancy:group,compare:compare as 'sites'|'sharing'|'usage',snapshotAt:window.asOf,updatedThrough:SAMPLE_CUTOFF,adjusted:window.adjusted,previousAsOf:window.previousAsOf,nextAsOf:window.nextAsOf,
 usage:{...usage,window,period:analysisPeriod(window,scope.query.period),sort:usageSort as UsageMetric}};
}
export type CustomerUseModel=ReturnType<typeof customerUseModel>;
