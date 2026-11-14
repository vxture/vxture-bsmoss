import {OPERATORS,type PublishedSnapshot} from '../../domains/tower-service/foundation';
import {readSnapshotContext,type QueryInput} from '../../domains/tower-service/query';
import {JUDGMENT_METRICS,judgmentFindings} from '../../domains/tower-service/judgment';
import {resourceScope} from '../resources/model';
import {parseHistoryId,stepHistory,yearHistory} from '../../domains/tower-service/history-calendar';
import {contributionAnalysis} from '../../domains/tower-service/contribution';
import {label} from './labels';
import {serviceName} from '../rule-format';
export function judgmentModel(input:QueryInput,versions:PublishedSnapshot[],allowed:readonly string[]=OPERATORS){
 const keys=['snapshotId','compareSnapshotId','operator','city','county'],local=['view','type','level','search','page','pageSize','report','metric','comparisonMode','dimension'];const global:QueryInput={};
 for(const [k,v] of Object.entries(input)){if(![...keys,...local].includes(k)||typeof v!=='string'||v.length>160)throw Error('invalid_judgment_query');if(keys.includes(k))global[k]=v;}
 const comparisonMode=String(input.comparisonMode??(input.compareSnapshotId?'custom':'previous'));
 if(!['previous','year','custom','none'].includes(comparisonMode))throw Error('invalid_judgment_comparison');
 if(comparisonMode!=='custom')delete global.compareSnapshotId;
 const snapshots=versions.map(s=>s.inventory.descriptor).reverse(),context=readSnapshotContext(global,snapshots,{...resourceScope,operators:['all',...allowed],snapshotIds:snapshots.map(s=>s.id)}),current=versions.find(s=>s.id===context.snapshotId)!;
 if(comparisonMode==='previous'||comparisonMode==='year'){
  const parsed=parseHistoryId(current.id),period=current.inventory.services?.period??current.inventory.descriptor.businessPeriod;
  const id=parsed?(comparisonMode==='year'?yearHistory(current.id):stepHistory(current.id,-1)):snapshots.find(s=>s.id!==current.id&&s.businessPeriod&&period&&(comparisonMode==='previous'?s.businessPeriod.end===period.start:s.businessPeriod.start===String(Number(period.start.slice(0,4))-1)+period.start.slice(4)))?.id;
  context.compareSnapshotId=versions.some(s=>s.id===id)?id??null:null;
 }
 const before=versions.find(s=>s.id===context.compareSnapshotId),metrics=current.inventory.services?.metrics??[],metric=String((input.metric==='none'?undefined:input.metric)??metrics.find(m=>m.id==='supplied-energy')?.id??metrics[0]?.id??'none'),dimension=String(input.dimension??'regions');
 if(metric!=='none'&&!metrics.some(m=>m.id===metric)||!['operators','regions','sites'].includes(dimension))throw Error('invalid_judgment_metric');
 const view=input.view??'findings',type=input.type??'all',level=input.level??'all',search=(input.search??'') as string,report=(input.report??'') as string;
 const pageSize=Number(input.pageSize??20),requested=Number(input.page??1);if(!['findings','contribution','reports'].includes(view as string)||!['all',...JUDGMENT_METRICS].includes(type as 'all')||!['all','attention','severe'].includes(level as string)||search.length>80||![10,20,50,100].includes(pageSize)||!/^\d+$/.test(String(input.page??1))||!Number.isSafeInteger(requested)||requested<1||report&&!/^[-a-zA-Z0-9_]{1,100}$/.test(report))throw Error('invalid_judgment_filter');
 const analysis=judgmentFindings(current,before,context),all=analysis.findings,siteNames=new Map([...before?.inventory.rows??[],...current.inventory.rows].map(r=>[r.id,r.name])),filtered=all.filter(f=>(type==='all'||f.type===type)&&(level==='all'||f.severity===level)&&(!search.trim()||[f.id,f.customerId,f.customerName,label(f.type),serviceName(f.rule.service),metrics.find(m=>m.id===f.rule.judgment?.metricId)?.name??'',...f.siteIds,...f.siteIds.map(id=>siteNames.get(id)??'')].join(' ').toLowerCase().includes(search.trim().toLowerCase()))),page=Math.min(requested,Math.max(1,Math.ceil(filtered.length/pageSize)));
 const regions=[...new Set(all.flatMap(f=>f.siteIds).map(id=>current.inventory.rows.find(r=>r.id===id)?.city??before?.inventory.rows.find(r=>r.id===id)?.city??'unknown'))].map(city=>{const findings=all.filter(f=>f.siteIds.some(id=>(current.inventory.rows.find(r=>r.id===id)??before?.inventory.rows.find(r=>r.id===id))?.city===city));return {city,name:current.inventory.rows.find(r=>r.city===city)?.cityName??before?.inventory.rows.find(r=>r.city===city)?.cityName??city,attention:findings.filter(f=>f.severity==='attention').length,severe:findings.filter(f=>f.severity==='severe').length};});
 return {context,snapshot:current.inventory.descriptor,snapshots,allowedOperators:[...allowed],view:view as string,filters:{type:type as string,level:level as string,search,page,pageSize,report,metric,dimension,comparisonMode},metrics,rows:filtered.slice((page-1)*pageSize,page*pageSize),exportRows:filtered,rowCount:filtered.length,contribution:view==='contribution'?contributionAnalysis(current,before,context,metric,allowed):null,totals:{attention:all.filter(f=>f.severity==='attention').length,severe:all.filter(f=>f.severity==='severe').length,sites:new Set(all.flatMap(f=>f.siteIds)).size,customers:new Set(all.map(f=>f.customerId)).size},types:JUDGMENT_METRICS.map(type=>({type,count:all.filter(f=>f.type===type).length})),regions,rules:analysis.rules,skipped:analysis.skipped.length,skippedRules:analysis.skipped,sources:{services:!!current.inventory.services,evidence:!!current.inventory.evidence,tenants:!!current.inventory.tenancy}};
}
export type JudgmentModel=ReturnType<typeof judgmentModel>;
