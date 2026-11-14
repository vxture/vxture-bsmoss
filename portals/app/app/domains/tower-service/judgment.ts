import {createHash} from 'node:crypto';
import {evaluateEvidence} from './evidence';
import {serviceDescriptor,serviceSummaryReader,formatServiceQuantity,type ServiceCapture} from './quantification';
import {configurationEvidence} from './configuration-evidence';
import {siteTenancy,tenantMonth} from './tenancy';
import {snapshotComparison,type SnapshotContext} from './query';
import type {PublishedSnapshot,RuleVersion} from './foundation';
export const JUDGMENT_METRICS=['basis_pending','basis_conflict','metering_gap','anchor_unknown','service_change','tenant_site_change'] as const;
export type JudgmentMetric=typeof JUDGMENT_METRICS[number];
export interface JudgmentParameters {metric:JudgmentMetric;metricId:string|null}
export interface Finding {id:string;type:JudgmentMetric;severity:'attention'|'severe';customerId:string;customerName:string;operator:string;city:string;siteIds:string[];siteSnapshots:Record<string,string>;basisIds:string[];sourceRefs:string[];actual:string;exact:{numerator:string;denominator:string};unit:string;baseline:string|null;comparison:{kind:string;current:string;baseline:string;delta:string;unit:string}|null;rule:RuleVersion;href:string;advice:string}
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const time=(s:string)=>Date.parse(s);
export function thresholdHit(numerator:bigint,denominator:bigint,threshold:string){const [a,b='']=threshold.split('.');return numerator*10n**BigInt(b.length)>=BigInt(a+b)*denominator;}
export function judgmentFindings(current:PublishedSnapshot,before:PublishedSnapshot|undefined,context:SnapshotContext){
 if(new Set(current.inventory.judgmentRules?.map(r=>r.id)).size!==(current.inventory.judgmentRules?.length??0))throw Error('invalid_frozen_judgment_identity');
 const inventory=current.inventory,regional=inventory.rows.filter(r=>(context.city==='all'||r.city===context.city)&&(context.county==='all'||r.county===context.county)),sites=new Map(regional.map(r=>[r.id,r])),cities=new Map(inventory.rows.map(r=>[r.id,r.city]));
 const evaluation=inventory.evidence?evaluateEvidence(inventory.evidence,inventory.tenancy,cities):null,month=new Date(time(inventory.descriptor.stockAsOf)+8*3600000).toISOString().slice(0,7),tenants=tenantMonth(inventory.tenancy,month);
 const configuration=configurationEvidence(inventory.services,current.origin==='reference'&&inventory.descriptor.mode==='demo'&&!!inventory.evidence,new Set(sites.keys()),inventory.services?.operatorScope??['mobile','telecom','unicom','broadcast','other']);
 const bases=[...(evaluation?.rows??[]),...configuration.map(r=>({...r,customerId:r.customer.id,service:r.dimension.service}))];
 const eligibleSets=new Map<string,Set<string>>(),priorSets=new Map<string,Set<string>>(),readers=new Map<ServiceCapture,Map<string,ReturnType<typeof serviceSummaryReader>>>();
 const customerReader=(capture:ServiceCapture,customerId:string)=>{let cache=readers.get(capture);if(!cache){cache=new Map();readers.set(capture,cache);}let reader=cache.get(customerId);if(!reader){reader=serviceSummaryReader({...capture,customers:capture.customers.filter(v=>v.id===customerId),configurations:capture.configurations.filter(v=>v.customerId===customerId),usage:capture.usage.filter(v=>v.customerId===customerId)});cache.set(customerId,reader);}return reader;};
 const rules=(inventory.judgmentRules??[]).filter(r=>r.confirmed&&r.state==='active'&&r.judgment&&(context.operator==='all'||context.operator===r.operator));
 const findings:Finding[]=[],skipped:{ruleId:string;reason:string}[]=[];
 for(const rule of rules){
  const metric=rule.judgment!.metric,period=metric==='basis_pending'||metric==='basis_conflict'||metric==='metering_gap'?inventory.evidence?.period:metric==='service_change'?inventory.services?.period:null;
  const from=period?.start??inventory.descriptor.stockAsOf,to=period?.end??inventory.descriptor.stockAsOf;
  if(time(rule.from+'T00:00:00+08:00')>time(from)||time(rule.to+'T00:00:00+08:00')<time(to)||!period&&time(rule.to+'T00:00:00+08:00')===time(to)){skipped.push({ruleId:rule.id,reason:'period'});continue;}
  let eligible=eligibleSets.get(rule.city);if(!eligible){eligible=new Set(regional.filter(s=>rule.city==='all'||rule.city===s.city).map(s=>s.id));eligibleSets.set(rule.city,eligible);}
  const evidence=evaluation?.rows.filter(r=>eligible.has(r.siteId)&&r.customerId===rule.customerId&&r.customer?.operator===rule.operator&&r.service===rule.service)??[];
  let n:bigint|null=null,d=1n,baseline:string|null=null,comparison:Finding['comparison']=null,unit=rule.unit,siteIds:string[]=[],basisIds:string[]=[],sourceRefs:string[]=[];
  if(metric==='basis_pending'||metric==='basis_conflict'){
   const applicable=bases.filter(r=>eligible!.has(r.siteId)&&r.customerId===rule.customerId&&r.customer?.operator===rule.operator&&r.service===rule.service);
   if(inventory.evidence?.applicabilityComplete&&applicable.length){const selected=applicable.filter(r=>r.state===(metric==='basis_pending'?'pending':'conflict'));n=BigInt(selected.length);unit='item';siteIds=selected.map(r=>r.siteId);basisIds=selected.map(r=>r.id);sourceRefs=selected.map(r=>r.sourceRef);}
  }else if(metric==='metering_gap'){
   const parents=new Set(evidence.flatMap(r=>r.meter.parentId?[r.meter.parentId]:r.meter.role==='total'?[r.meterId]:[]));const selected=evaluation?.reconciliation.filter(r=>eligible.has(r.siteId)&&parents.has(r.meterId)&&r.unit===rule.unit&&r.boundary===rule.boundary)??[];
   if(inventory.evidence?.complete&&selected.length&&selected.every(r=>r.difference!==null)){n=selected.reduce((sum,r)=>sum+(BigInt(r.difference!)<0n?-BigInt(r.difference!):BigInt(r.difference!)),0n);d=10n**BigInt(selected[0].scale);if(selected.some(r=>r.scale!==selected[0].scale))n=null;unit=rule.unit;siteIds=selected.filter(r=>r.difference!=='0').map(r=>r.siteId);basisIds=evidence.map(r=>r.id);sourceRefs=evidence.map(r=>r.sourceRef);}
  }else if(metric==='anchor_unknown'){
   const rows=[...eligible].map(id=>({id,value:siteTenancy(tenants,id)}));const own=rows.filter(r=>r.value.tenants.some(t=>t.customerId===rule.customerId&&t.operator===rule.operator));
   if(own.length&&own.every(r=>r.value.state==='known')){const selected=own.filter(r=>r.value.tenants.find(t=>t.customerId===rule.customerId)!.anchor==='unknown');n=BigInt(selected.length);unit='site';siteIds=selected.map(r=>r.id);sourceRefs=selected.flatMap(r=>r.value.tenants.find(t=>t.customerId===rule.customerId)!.evidence);}
  }else if(metric==='service_change'){
   const a=inventory.services,b=before?.inventory.services,id=rule.judgment!.metricId,am=a?.metrics.find(m=>m.id===id),bm=b?.metrics.find(m=>m.id===id);
   if(a&&b&&am&&bm&&am.service===rule.service&&am.boundary===rule.boundary&&JSON.stringify(am)===JSON.stringify(bm)&&(a.customers.some(c=>c.id===rule.customerId&&c.operator===rule.operator)||!a.customers.some(c=>c.id===rule.customerId)&&(a.operatorScope??['mobile','telecom','unicom','broadcast','other']).includes(rule.operator))&&b.customers.some(c=>c.id===rule.customerId&&c.operator===rule.operator)&&before&&snapshotComparison(serviceDescriptor(inventory.descriptor,a),serviceDescriptor(before.inventory.descriptor,b)).comparable){
    let bs=priorSets.get(rule.city);if(!bs){bs=new Set(before.inventory.rows.filter(r=>(context.city==='all'||r.city===context.city)&&(context.county==='all'||r.county===context.county)&&(rule.city==='all'||r.city===rule.city)).map(r=>r.id));priorSets.set(rule.city,bs);}
    const av=customerReader(a,rule.customerId)(am.id,eligible).quantity,bv=customerReader(b,rule.customerId)(bm.id,bs).quantity;
    if(av!==null&&bv!==null&&BigInt(bv)>0n){const delta=BigInt(av)-BigInt(bv);n=(delta<0n?-delta:delta)*100n;d=BigInt(bv);baseline=formatServiceQuantity(bv,am.scale);comparison={kind:snapshotComparison(serviceDescriptor(inventory.descriptor,a),serviceDescriptor(before.inventory.descriptor,b)).kind,current:formatServiceQuantity(av,am.scale),baseline:formatServiceQuantity(bv,am.scale),delta:formatServiceQuantity(String(delta),am.scale),unit:am.unit};unit='%';siteIds=[...new Set([...a.configurations,...a.usage,...b.configurations,...b.usage].filter(r=>r.customerId===rule.customerId&&(eligible.has(r.siteId)||bs.has(r.siteId))&&r.metricId===id).map(r=>r.siteId))];sourceRefs=[a.id,b.id];}
   }
  }else if(metric==='tenant_site_change'){
   const prior=before?tenantMonth(before.inventory.tenancy,new Date(time(before.inventory.descriptor.stockAsOf)+8*3600000).toISOString().slice(0,7)):null;
   if(tenants&&prior&&before&&snapshotComparison(inventory.descriptor,before.inventory.descriptor).comparable){const a=[...eligible].map(id=>({id,s:siteTenancy(tenants,id)})),b=before.inventory.rows.filter(r=>(context.city==='all'||r.city===context.city)&&(context.county==='all'||r.county===context.county)&&(rule.city==='all'||r.city===rule.city)).map(r=>({id:r.id,s:siteTenancy(prior,r.id)}));if(a.every(r=>r.s.state==='known')&&b.every(r=>r.s.state==='known')){const own=(r:typeof a[number])=>r.s.tenants.some(t=>t.customerId===rule.customerId&&t.operator===rule.operator),av=a.filter(own),bv=b.filter(own);if(bv.length){n=BigInt(Math.abs(av.length-bv.length))*100n;d=BigInt(bv.length);baseline=String(bv.length);comparison={kind:snapshotComparison(inventory.descriptor,before.inventory.descriptor).kind,current:String(av.length),baseline,delta:String(av.length-bv.length),unit:'site'};unit='%';siteIds=[...new Set([...av,...bv].map(r=>r.id))];sourceRefs=[tenants.id,prior.id];}}}
  }
  if(n===null){skipped.push({ruleId:rule.id,reason:'source_or_comparison'});continue;}
  const severity=rule.severe!==null&&thresholdHit(n,d,rule.severe)?'severe':rule.attention!==null&&thresholdHit(n,d,rule.attention)?'attention':null;if(!severity)continue;
  const customer=inventory.evidence?.customers.find(c=>c.id===rule.customerId)??inventory.services?.customers.find(c=>c.id===rule.customerId)??before?.inventory.services?.customers.find(c=>c.id===rule.customerId)??before?.inventory.evidence?.customers.find(c=>c.id===rule.customerId),ids=[...new Set(siteIds)],basis=[...new Set(basisIds)],params=new URLSearchParams({snapshotId:current.id,operator:metric==='metering_gap'?'all':rule.operator,city:context.city,county:context.county});
  if(context.compareSnapshotId)params.set('compareSnapshotId',context.compareSnapshotId);
  const path=metric==='service_change'?'/tower-service/services':metric==='anchor_unknown'||metric==='tenant_site_change'?'/tower-service/resources':'/tower-service/evidence';
  if(path.endsWith('resources'))params.set('view','sites');
  if(path.endsWith('evidence')){params.set('view','details');params.set('state',metric==='basis_pending'?'pending':metric==='basis_conflict'?'conflict':'all');}
  if(path.endsWith('services')){params.set('view','comparison');params.set('metric',rule.judgment!.metricId!);params.set('comparisonMode',context.compareSnapshotId?'custom':'none');}
  const href=path+'?'+params;
  findings.push({id:hash([current.id,before?.id??null,rule.id,context.city,context.county]),type:metric,severity,customerId:rule.customerId,customerName:customer?.name??rule.customerId,operator:rule.operator,city:rule.city,siteIds:ids,siteSnapshots:Object.fromEntries(ids.map(id=>[id,sites.has(id)?current.id:before?.id??current.id])),basisIds:basis,sourceRefs:[...new Set(sourceRefs)],actual:d===1n?String(n):String(n/d)+'.'+String(n*1000000000000n/d%1000000000000n).padStart(12,'0').replace(/0+$/,'').replace(/^$/,'0'),exact:{numerator:String(n),denominator:String(d)},unit,baseline,comparison,rule:structuredClone(rule),href,advice:metric==='metering_gap'?'\u6838\u5bf9\u603b\u5206\u8868\u8fb9\u754c\u4e0e\u8bb0\u5f55\u533a\u95f4':metric==='service_change'||metric==='tenant_site_change'?'\u6838\u5bf9\u5feb\u7167\u53d8\u5316\u4e0e\u6709\u6548\u671f\u4f9d\u636e':'\u6838\u5bf9\u539f\u59cb\u4f9d\u636e\u4e0e\u9002\u7528\u89c4\u5219'});
 }
 return {findings:findings.sort((a,b)=>Number(b.severity==='severe')-Number(a.severity==='severe')||a.id.localeCompare(b.id)),skipped,rules:rules.length,regionalSites:sites.size};
}
