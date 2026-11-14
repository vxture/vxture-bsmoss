import {OPERATORS,type PublishedSnapshot} from '../../domains/tower-service/foundation';
import {compareQuantity,readSnapshotContext,snapshotComparison,snapshotQuery,type QueryInput} from '../../domains/tower-service/query';
import {serviceDescriptor,serviceSummary} from '../../domains/tower-service/quantification';
import {judgmentFindings} from '../../domains/tower-service/judgment';
import {tenantMonth,summarizeTenancy} from '../../domains/tower-service/tenancy';
import {baselineModel} from '../resources/baseline-model';
import {resourceScope} from '../resources/model';
import {facilities,type Facility} from '../resources/vocabulary';
import {servicesModel} from '../services/model';
import {DEMO_REGION} from '../../domains/map-demo/resources';

const globalKeys=['snapshotId','compareSnapshotId','operator','city','county'];
export const layers=['resources','services','sharing'] as const;
// This composition consumes the accepted topic readers. It never creates a
// second source of resource, service, tenancy or finding business definitions.
export function dashboardModel(input:QueryInput,versions:PublishedSnapshot[],allowed:readonly string[]=OPERATORS,cityIds:readonly string[]=['*']){
 const global:QueryInput={};for(const [k,v] of Object.entries(input)){if(!globalKeys.includes(k)||typeof v!=='string'||v.length>160)throw Error('invalid_dashboard_query');global[k]=v;}
 const snapshots=versions.map(s=>s.inventory.descriptor).reverse(),context=readSnapshotContext(global,snapshots,{...resourceScope,operators:['all',...allowed],regions:resourceScope.regions.filter(r=>cityIds.includes('*')||r.city==='all'||cityIds.includes(r.city)),snapshotIds:snapshots.map(s=>s.id)});
 const selected=versions.find(s=>s.id===context.snapshotId)!,prior=versions.find(s=>s.id===context.compareSnapshotId);
 const query=snapshotQuery(context),resource=baselineModel({...query,view:'regions'},versions),services=servicesModel(query,versions,allowed),analysis=judgmentFindings(selected,prior,context);
 const missing=[!selected.inventory.services?'\u5ba2\u6237\u670d\u52a1':null,!resource.tenantVersion?'\u6708\u5ea6\u79df\u6237':null,!selected.inventory.evidence?'\u8ba1\u91cf\u6765\u6e90':null,!analysis.rules?'\u7814\u5224\u89c4\u5219':null].filter((v):v is string=>v!==null);
 const region={...DEMO_REGION,cities:DEMO_REGION.cities.filter(r=>cityIds.includes('*')||cityIds.includes(r.id)),counties:DEMO_REGION.counties.filter(r=>cityIds.includes('*')||cityIds.includes(r.cityId))};
 return {context,snapshot:resource.snapshot,snapshots,allowedOperators:[...allowed],region,
  totals:{sites:resource.data.rollup.totals.sites,facilities:resource.data.rollup.totals.infrastructure,sharing:resource.tenancy.sharingRate,coverage:services.totals.coverage,attention:analysis.rules?analysis.findings.filter(f=>f.severity==='attention').length:null,severe:analysis.rules?analysis.findings.filter(f=>f.severity==='severe').length:null},
  comparison:resource.comparison??null,regions:resource.regions.map(r=>({code:r.code,name:r.name,city:r.city,county:r.county,sites:r.sites})),
  service:{source:services.source,matrix:services.matrix,operators:services.operators.map(r=>r.operator)},
  findings:[...analysis.findings].sort((a,b)=>Number(b.severity==='severe')-Number(a.severity==='severe')||a.id.localeCompare(b.id)).slice(0,3).map(f=>({id:f.id,type:f.type,severity:f.severity,customerName:f.customerName,actual:f.actual,unit:f.unit,comparison:f.comparison,advice:f.advice,href:f.href})),
  rules:analysis.rules,skipped:analysis.skipped.length,missing,
 };
}
export type DashboardModel=ReturnType<typeof dashboardModel>;

export function networkModel(input:QueryInput,versions:PublishedSnapshot[],allowed:readonly string[]=OPERATORS,cityIds:readonly string[]=['*']){
 const global:QueryInput={};for(const [k,v] of Object.entries(input)){if(![...globalKeys,'layer','metric','mode'].includes(k)||typeof v!=='string'||v.length>160)throw Error('invalid_network_query');if(globalKeys.includes(k))global[k]=v;}
 const dashboard=dashboardModel(global,versions,allowed,cityIds),{context}=dashboard,layer=input.layer??'resources',mode=input.mode??'value';
 if(!layers.includes(layer as typeof layers[number])||!['value','difference'].includes(mode as string))throw Error('invalid_network_layer');
 const current=versions.find(s=>s.id===context.snapshotId)!,before=versions.find(s=>s.id===context.compareSnapshotId),capture=current.inventory.services;
 const metrics=layer==='services'?(capture?.metrics.map(m=>({id:m.id,name:m.name,unit:m.unit,scale:m.scale}))??[]):layer==='sharing'?[{id:'sharing',name:'\u5171\u4eab\u7387',unit:'%',scale:2}]:[{id:'sites',name:'\u7ad9\u5740\u6570',unit:'\u7ad9',scale:0},...Object.entries(facilities).map(([id,name])=>({id,name,unit:'\u9879',scale:0}))];
 const metricId=input.metric==='none'?metrics[0]?.id??'none':input.metric??metrics[0]?.id??'none',metric=metrics.find(m=>m.id===metricId)??null;
 if(metricId!=='none'&&!metric||metricId==='none'&&metrics.length)throw Error('invalid_network_metric');
 const a=baselineModel({...snapshotQuery(context),view:'regions'},versions),b=before?baselineModel({...snapshotQuery({...context,snapshotId:before.id,compareSnapshotId:null}),view:'regions'},versions):null;
 const match=(r:typeof current.inventory.rows[number])=>(context.city==='all'||r.city===context.city)&&(context.county==='all'||r.county===context.county);
 const byCity=context.city==='all',code=(r:typeof current.inventory.rows[number])=>byCity?r.city:r.county,ar=current.inventory.rows.filter(match),br=before?.inventory.rows.filter(match)??[];
 const serviceMetric=capture?.metrics.find(m=>m.id===metricId),beforeMetric=before?.inventory.services?.metrics.find(m=>m.id===metricId);
 const basis=before?snapshotComparison(layer==='services'?serviceDescriptor(current.inventory.descriptor,capture):current.inventory.descriptor,layer==='services'?serviceDescriptor(before.inventory.descriptor,before.inventory.services):before.inventory.descriptor):null;
 const comparable=!!basis?.comparable&&(layer!=='services'||!!serviceMetric&&!!beforeMetric&&JSON.stringify(serviceMetric)===JSON.stringify(beforeMetric));
 const regionCodes=layer==='services'?[...new Set([...ar,...br].map(code))]:[...new Set([...a.regions,...(b?.regions??[])].map(r=>r.code))];
 const value=(model:typeof a|null,c:typeof capture,rows:typeof ar,id:string)=>{
  if(!model||!metric)return null;if(layer==='services')return serviceSummary(c,metric.id,new Set(rows.filter(r=>code(r)===id).map(r=>r.id)),context.operator).quantity;
  const r=model.regions.find(r=>r.code===id);if(layer==='sharing')return r?.sharing===null||r?.sharing===undefined?null:String(Math.round(r.sharing*10000));
  return String(r?(metric.id==='sites'?r.sites:r.categories[metric.id as Facility]):0);
 };
 const rows=regionCodes.sort().map(id=>{const inventory=ar.find(r=>code(r)===id)??br.find(r=>code(r)===id),r=a.regions.find(r=>r.code===id)??b?.regions.find(r=>r.code===id),av=value(a,capture,ar,id),bv=value(b,before?.inventory.services,br,id),delta=compareQuantity(av,bv,comparable).delta;
  const tenancy=layer==='sharing'?summarizeTenancy(tenantMonth(current.inventory.tenancy,a.filters.month),ar.filter(r=>code(r)===id&&(context.operator==='all'||r.allOperators.includes(context.operator))).map(r=>r.id)):null;
  return {code:id,name:r?.name??(byCity?inventory?.cityName:inventory?.countyName)??'\u672a\u5f52\u5c5e',city:byCity?id:context.city,county:byCity?'all':id,current:av,baseline:bv,delta,value:mode==='difference'?delta:av,sites:a.regions.find(r=>r.code===id)?.sites??0,shared:tenancy?.shared??null,occupied:tenancy?.occupied??null};
 });
 const values=rows.map(r=>r.value).filter((v):v is string=>v!==null).map(BigInt),max=values.reduce((m,v)=>{const n=v<0n?-v:v;return n>m?n:m;},0n);
 // Normalize exact integers only for colour intensity; displayed values stay
 // exact even beyond Number.MAX_SAFE_INTEGER. Unknown never becomes zero.
 const colored=rows.map(r=>({...r,intensity:r.value===null?null:max===0n?0:Number((BigInt(r.value)<0n?-BigInt(r.value):BigInt(r.value))*10000n/max)/10000}));
 return {...dashboard,layer:layer as string,mode:mode as string,metric,metrics,rows:colored,range:values.length?{min:mode==='difference'?String(-max):'0',max:String(max)}:null,comparisonBasis:basis?{kind:basis.kind,comparable}:null,
  snapshot:layer==='services'?serviceDescriptor(current.inventory.descriptor,capture):dashboard.snapshot,
  period:layer==='services'?capture?.period??null:null,monthly:layer==='sharing'&&a.tenantVersion?{...a.tenantVersion,month:a.filters.month}:null,
  total:layer==='services'?serviceSummary(capture,metric?.id??'none',new Set(ar.map(r=>r.id)),context.operator).quantity:layer==='sharing'?a.tenancy.sharingRate===null?null:String(Math.round(a.tenancy.sharingRate*10000)):String(metric?.id==='sites'?a.data.rollup.totals.sites:a.facilityCounts.find(f=>f.key===metric?.id)?.count??0),
 };
}
export type NetworkModel=ReturnType<typeof networkModel>;
