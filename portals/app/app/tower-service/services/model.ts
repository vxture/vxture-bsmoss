import {OPERATORS,type PublishedSnapshot} from '../../domains/tower-service/foundation';
import {readSnapshotContext,snapshotComparison,compareQuantity,type QueryInput} from '../../domains/tower-service/query';
import {serviceDescriptor,serviceSummaryReader,validateServices,type ServiceMetric} from '../../domains/tower-service/quantification';
import {resourceScope} from '../resources/model';
import {parseHistoryId,yearHistory} from '../../domains/tower-service/history-calendar';
import {configurationEvidence} from '../../domains/tower-service/configuration-evidence';
const globalKeys=['snapshotId','compareSnapshotId','operator','city','county'];
const localKeys=['view','metric','category','ownership','search','page','pageSize','comparisonMode'];
export function servicesModel(input:QueryInput,versions:PublishedSnapshot[],allowed:readonly string[]=OPERATORS){
 const readers=new Map(versions.map(v=>[v.inventory.services,serviceSummaryReader(v.inventory.services)]));
 const serviceSummary=(capture:typeof versions[number]['inventory']['services'],metric:string,sites:ReadonlySet<string>,operator='all')=>readers.get(capture)!(metric,sites,operator);
 const global:QueryInput={};for(const [k,v] of Object.entries(input)){if(![...globalKeys,...localKeys].includes(k)||typeof v!=='string'||v.length>160)throw Error('invalid_service_query');if(globalKeys.includes(k))global[k]=v;}
 const comparisonMode=(input.comparisonMode??(input.compareSnapshotId?'custom':['periods','comparison'].includes(String(input.view))?'previous':'none')) as string;
 if(!['previous','year','custom','none'].includes(comparisonMode))throw Error('invalid_service_comparison');
 if(comparisonMode!=='custom')delete global.compareSnapshotId;
 const snapshots=versions.map(s=>serviceDescriptor(s.inventory.descriptor,s.inventory.services)).reverse();
 const context=readSnapshotContext(global,snapshots,{...resourceScope,operators:['all',...allowed],snapshotIds:snapshots.map(s=>s.id)});
 const selected=versions.find(s=>s.id===context.snapshotId)!,capture=selected.inventory.services;
 if(capture)validateServices(capture);
 const metrics=capture?.metrics??[];
 let metricId=(input.metric==='none'?metrics[0]?.id??'none':input.metric??metrics[0]?.id??'none') as string,metric=metrics.find(m=>m.id===metricId)??null;
 if(metricId!=='none'&&!metric||metricId==='none'&&metrics.length)throw Error('invalid_service_metric');
 const view=input.view==='composition'?'operators':input.view??'operators',category=input.category??'all',ownership=input.ownership??'all',search=(input.search??'') as string;
 if(!['operators','periods','comparison'].includes(view as string)||!['all','dedicated','shared','unknown'].includes(ownership as string)||category!=='all'&&!metrics.some(m=>m.category===category)||search.length>80)throw Error('invalid_service_filter');
 if(category!=='all'&&metric?.category!==category){metric=metrics.find(m=>m.category===category)!;metricId=metric.id;}
 const pageSize=Number(input.pageSize??20),requested=Number(input.page??1);if(![10,20,50,100].includes(pageSize)||!/^\d+$/.test(String(input.page??1))||!Number.isSafeInteger(requested)||requested<1)throw Error('invalid_service_page');
 const inRegion=(r:typeof selected.inventory.rows[number])=>(context.city==='all'||r.city===context.city)&&(context.county==='all'||r.county===context.county);
 const regional=selected.inventory.rows.filter(inRegion),sites=new Set(regional.map(r=>r.id));
 const totals=serviceSummary(capture,metricId,sites,context.operator);
 const operators=allowed.filter(o=>context.operator==='all'||o===context.operator).map(operator=>({operator,...serviceSummary(capture,metricId,sites,operator)}));
 // Specs, unit, kind and boundary are frozen in metric identity. A matrix never
 // adds its rows together. Each cell uses exactly the row's metric.
 const matrix=metrics.filter(m=>category==='all'||m.category===category).map(m=>({...m,total:serviceSummary(capture,m.id,sites,context.operator),values:operators.map(o=>({operator:o.operator,...serviceSummary(capture,m.id,sites,o.operator)}))}));
 const customers=capture?.customers.filter(c=>context.operator==='all'||c.operator===context.operator)??[],customerIds=new Set(customers.map(c=>c.id));
 const stockPoint=capture?Date.parse(capture.stockAsOf)-(capture.stockAsOf===capture.period.end?1:0):NaN;
 const configurationRows=configurationEvidence(capture,selected.inventory.descriptor.mode==='demo'&&selected.origin==='reference'&&!!selected.inventory.evidence,sites,allowed),configurationBases=new Set(configurationRows.map(r=>r.id));
 const evidenceTargets=Object.fromEntries(metrics.map(item=>{const ids=[...new Set([...(capture?.configurations??[]),...(capture?.usage??[])].filter(r=>r.metricId===item.id).map(r=>r.serviceItemId))];return [item.id,{service:ids.length===1?ids[0]:'all',dimension:item.kind==='stock'&&configurationRows.some(r=>r.dimension.id===item.id)?'configuration:'+item.id:'all'}];}));
 const rows=(metric?.kind==='usage'?capture?.usage??[]:capture?.configurations??[]).filter(r=>(!('componentId'in r)||r.from===null||r.end==='unknown'||Date.parse(r.from)<=stockPoint&&(r.to===null||Date.parse(r.to)>stockPoint))&&sites.has(r.siteId)&&r.customerId!==null&&customerIds.has(r.customerId)&&(!metric||r.metricId===metric.id)&&(category==='all'||metrics.find(m=>m.id===r.metricId)?.category===category)&&(ownership==='all'||'ownership'in r&&r.ownership===ownership)).map(r=>({id:r.id,siteId:r.siteId,siteName:regional.find(s=>s.id===r.siteId)?.name??r.siteId,customer:customers.find(c=>c.id===r.customerId)!,metric:metrics.find(m=>m.id===r.metricId)!,quantity:r.quantity,from:r.from,to:r.to,sourceRef:r.sourceRef,agreementVersion:r.agreementVersion,ruleVersion:r.ruleVersion,confirmed:'confirmed'in r?r.confirmed&&r.from!==null&&r.end!=='unknown':r.reliable,basisId:'basisId'in r?r.basisId:configurationBases.has(r.id)?r.id:null,end:'end'in r?r.end:'known',serviceItemId:r.serviceItemId})).filter(r=>!search.trim()||[r.siteId,r.siteName,r.customer.name,r.serviceItemId,r.sourceRef].join(' ').toLowerCase().includes(search.trim().toLowerCase()));
 const dedup=[...new Map(rows.map(r=>[r.id,r])).values()],page=Math.min(requested,Math.max(1,Math.ceil(dedup.length/pageSize)));
 const comparableMetric=(other:ServiceMetric|undefined)=>!!metric&&!!other&&JSON.stringify(metric)===JSON.stringify(other);
 // Resolve calendar baselines from real published captures, never from the
 // previous sync/revision. Missing adjacent periods remain missing.
 if(capture&&(comparisonMode==='previous'||comparisonMode==='year')){
  const period=serviceDescriptor(selected.inventory.descriptor,capture).businessPeriod!;
  const priorYear=(value:string)=>String(Number(value.slice(0,4))-1)+value.slice(4);
  const candidates=snapshots.filter(s=>s.id!==selected.id&&s.businessPeriod&&
   (comparisonMode==='previous'?s.businessPeriod.end===period.start:parseHistoryId(selected.id)?s.id===yearHistory(selected.id):s.businessPeriod.start===priorYear(period.start)&&s.businessPeriod.end===priorYear(period.end)));
  const candidate=candidates.find(s=>{const v=versions.find(v=>v.id===s.id)!;return snapshotComparison(snapshots.find(s=>s.id===selected.id)!,s).comparable&&comparableMetric(v.inventory.services?.metrics.find(m=>m.id===metricId));});
  context.compareSnapshotId=candidate?.id??null;
 }
 const baseline=versions.find(s=>s.id===context.compareSnapshotId),basis=baseline?snapshotComparison(snapshots.find(s=>s.id===selected.id)!,serviceDescriptor(baseline.inventory.descriptor,baseline.inventory.services)):null;
 const comparable=!!basis?.comparable&&!!capture&&!!baseline?.inventory.services&&comparableMetric(baseline.inventory.services.metrics.find(m=>m.id===metricId));
 const before=baseline?serviceSummary(baseline.inventory.services,metricId,new Set(baseline.inventory.rows.filter(inRegion).map(r=>r.id)),context.operator):null;
 const comparison=basis?{...basis,comparable,quantity:compareQuantity(totals.quantity,before?.quantity??null,comparable),coverage:compareQuantity(totals.coverage===null?null:String(totals.coverage),before?.coverage===null||!before?null:String(before.coverage),comparable)}:null;
 const comparisonOperators=operators.map(o=>{const previous=baseline&&comparableMetric(baseline.inventory.services?.metrics.find(m=>m.id===metricId))?serviceSummary(baseline.inventory.services,metricId,new Set(baseline.inventory.rows.filter(inRegion).map(r=>r.id)),o.operator):null;return {operator:o.operator,current:o.quantity,previous:previous?.quantity??null,...compareQuantity(o.quantity,previous?.quantity??null,comparable)};});
 // Group only the permission-scoped physical sites. Local table filters do not
 // change chart totals; city selection changes the grouping to its counties.
 const regionLevel=context.city==='all'?'city':'county';
 const groups=new Map<string,{code:string;name:string;siteIds:Set<string>}>();
 for(const row of regional){const code=row[regionLevel],name=regionLevel==='city'?row.cityName:row.countyName;const group=groups.get(code)??{code,name,siteIds:new Set<string>()};group.siteIds.add(row.id);groups.set(code,group);}
 if(comparable)for(const row of baseline!.inventory.rows.filter(inRegion)){const code=row[regionLevel];if(!groups.has(code))groups.set(code,{code,name:regionLevel==='city'?row.cityName:row.countyName,siteIds:new Set<string>()});}
 const regions=[...groups.values()].sort((a,b)=>a.code.localeCompare(b.code)).map(group=>{
  const value=serviceSummary(capture,metricId,group.siteIds,context.operator);
  const previousSites=new Set(baseline?.inventory.rows.filter(r=>inRegion(r)&&r[regionLevel]===group.code).map(r=>r.id));
  const previous=baseline?serviceSummary(baseline.inventory.services,metricId,previousSites,context.operator):null;
  return {code:group.code,name:group.name,...value,delta:compareQuantity(value.quantity,previous?.quantity??null,comparable).delta,values:operators.map(o=>({operator:o.operator,...serviceSummary(capture,metricId,group.siteIds,o.operator)}))};
 });
 // Only actual captured periods. Keep the selected revision for its period,
 // latest published revision for other periods. No resampling or zero filling.
 const periods=new Map<string,typeof versions[number]>();for(const v of versions)if(v.inventory.services)periods.set(v.inventory.services.period.start+'|'+v.inventory.services.period.end,v);
 if(capture)periods.set(capture.period.start+'|'+capture.period.end,selected);
 const trend=[...periods.values()].map(v=>{const c=v.inventory.services!,d=serviceDescriptor(v.inventory.descriptor,c),same=snapshotComparison(snapshots.find(s=>s.id===selected.id)!,d).comparable&&comparableMetric(c.metrics.find(m=>m.id===metricId)),periodSites=new Set(v.inventory.rows.filter(inRegion).map(r=>r.id)),value=serviceSummary(c,metricId,periodSites,context.operator);return {id:v.id,start:d.businessPeriod!.start,end:d.businessPeriod!.end,asOf:d.stockAsOf,complete:c.periodComplete,quantity:same?value.quantity:null,compatible:same,values:operators.map(o=>({operator:o.operator,quantity:same?serviceSummary(c,metricId,periodSites,o.operator).quantity:null}))};}).sort((a,b)=>a.start.localeCompare(b.start));
 return {evidenceTargets,context,snapshot:snapshots.find(s=>s.id===selected.id)!,snapshots,allowedOperators:[...allowed],metric,metrics,view:view as string,filters:{category:category as string,ownership:ownership as string,search,metric:metricId,page,pageSize,comparisonMode},totals,operators,matrix,regions,regionLevel,comparison,comparisonOperators,baseline:baseline?serviceDescriptor(baseline.inventory.descriptor,baseline.inventory.services):null,trend,source:capture?{id:capture.id,sourceVersion:capture.sourceVersion,catalogVersion:capture.catalogVersion,period:capture.period,complete:capture.periodComplete}:null,physicalSites:regional.filter(r=>context.operator==='all'||r.allOperators.includes(context.operator)).length,rows:dedup.slice((page-1)*pageSize,page*pageSize),rowCount:dedup.length};
}
export type ServicesModel=ReturnType<typeof servicesModel>;
