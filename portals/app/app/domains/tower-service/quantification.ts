import type {SnapshotDescriptor} from './query';
// A captured catalogue is evidence, not today's editable directory. Quantities
// are unsigned integer minor units; scale belongs to the frozen metric.
export interface ServiceMetric {id:string;name:string;category:string;categoryName:string;service:string;unit:string;scale:number;spec:string;boundary:string;kind:'stock'|'usage';confirmed:boolean}
export interface ServiceCustomer {id:string;name:string;operator:string}
export interface ServiceConfiguration {id:string;siteId:string;customerId:string;serviceItemId:string;componentId:string;metricId:string;quantity:string;from:string|null;to:string|null;end:'known'|'open'|'unknown';ownership:'dedicated'|'shared'|'unknown';sourceRef:string;agreementVersion:string|null;ruleVersion:string|null;confirmed:boolean}
export interface ServiceUsage {id:string;siteId:string;customerId:string|null;serviceItemId:string;metricId:string;quantity:string;from:string;to:string;physicalBoundary:string;exclusiveGroup:string;basisId:string;sourceRef:string;agreementVersion:string|null;ruleVersion:string|null;reliable:boolean}
export interface ServiceCapture {id:string;sourceVersion:string;catalogVersion:string;mappingVersion:string;ruleSetVersion:string;operatorScope?:string[];period:{start:string;end:string};stockAsOf:string;dataThrough:string;periodComplete:boolean;configComplete:boolean;usageComplete:boolean;customers:ServiceCustomer[];metrics:ServiceMetric[];configurations:ServiceConfiguration[];usage:ServiceUsage[]}
const brands=['mobile','telecom','unicom','broadcast','other'];
const instant=(s:string|null):s is string=>typeof s==='string'&&/T.*(?:Z|[+-]\d\d:\d\d)$/.test(s)&&Number.isFinite(Date.parse(s));
const overlap=(af:string,at:string,bf:string,bt:string)=>Date.parse(af)<Date.parse(bt)&&Date.parse(bf)<Date.parse(at);
const unique=<T extends {id:string}>(rows:T[])=>{const map=new Map<string,T>();for(const row of rows){if(!row.id||map.has(row.id)&&JSON.stringify(map.get(row.id))!==JSON.stringify(row))throw Error('invalid_service_identity');map.set(row.id,row);}return [...map.values()];};
const quantity=(s:string)=>typeof s==='string'&&/^(0|[1-9]\d{0,79})$/.test(s);
export function validateServices(c:ServiceCapture){
 if(!c||!c.id||!c.sourceVersion||!c.catalogVersion||!c.mappingVersion||!c.ruleSetVersion||!instant(c.period?.start)||!instant(c.period?.end)||Date.parse(c.period.start)>=Date.parse(c.period.end)||!instant(c.stockAsOf)||!instant(c.dataThrough)||Date.parse(c.stockAsOf)<Date.parse(c.period.start)||Date.parse(c.stockAsOf)>Date.parse(c.period.end)||Date.parse(c.dataThrough)<Date.parse(c.stockAsOf)||Date.parse(c.dataThrough)>Date.parse(c.period.end)||c.periodComplete&&Date.parse(c.dataThrough)!==Date.parse(c.period.end)||[c.configComplete,c.usageComplete,c.periodComplete].some(v=>typeof v!=='boolean'))throw Error('invalid_service_capture');
 const customers=unique(c.customers),metrics=unique(c.metrics),configs=unique(c.configurations),usage=unique(c.usage);
 if(c.operatorScope&&(!Array.isArray(c.operatorScope)||new Set(c.operatorScope).size!==c.operatorScope.length||c.operatorScope.some(o=>!brands.includes(o))||customers.some(r=>!c.operatorScope!.includes(r.operator))))throw Error('invalid_service_operator_scope');
 for(const r of customers)if(!r.name||!['mobile','telecom','unicom','broadcast','other'].includes(r.operator))throw Error('invalid_service_customer');
 for(const r of metrics)if(!r.name||!r.category||!r.categoryName||!r.service||!r.unit||!r.spec||!r.boundary||!Number.isInteger(r.scale)||r.scale<0||r.scale>12||!['stock','usage'].includes(r.kind)||typeof r.confirmed!=='boolean')throw Error('invalid_service_metric');
 for(const r of [...configs,...usage]){const metric=metrics.find(m=>m.id===r.metricId);if(!metric||!r.siteId||!r.serviceItemId||!r.sourceRef||!quantity(r.quantity)||r.customerId!==null&&!customers.some(v=>v.id===r.customerId)||[r.agreementVersion,r.ruleVersion].some(v=>v!==null&&(typeof v!=='string'||!v)))throw Error('invalid_service_fact');}
 for(const r of configs)if(!r.customerId||!r.componentId||metrics.find(m=>m.id===r.metricId)!.kind!=='stock'||typeof r.confirmed!=='boolean'||!['dedicated','shared','unknown'].includes(r.ownership)||!['known','open','unknown'].includes(r.end)||r.from!==null&&!instant(r.from)||r.end==='known'&&(!instant(r.to)||r.from!==null&&Date.parse(r.from)>=Date.parse(r.to!))||r.end!=='known'&&r.to!==null)throw Error('invalid_service_validity');
 const components=new Map<string,ServiceConfiguration[]>();for(const r of configs){const key=JSON.stringify([r.siteId,r.componentId,r.metricId]);components.set(key,[...(components.get(key)??[]),r]);}
 for(const group of components.values()){group.sort((a,b)=>(a.from??'').localeCompare(b.from??''));for(let i=1;i<group.length;i++){const a=group[i-1],b=group[i];if(!a.from||!b.from||a.end==='unknown'||b.end==='unknown'||overlap(a.from,a.to??'9999-01-01T00:00:00Z',b.from,b.to??'9999-01-01T00:00:00Z'))throw Error('invalid_service_component_overlap');}}
 for(const r of usage)if(metrics.find(m=>m.id===r.metricId)!.kind!=='usage'||!instant(r.from)||!instant(r.to)||Date.parse(r.from)>=Date.parse(r.to)||Date.parse(r.from)<Date.parse(c.period.start)||Date.parse(r.to)>Date.parse(c.dataThrough)||!r.physicalBoundary||!r.exclusiveGroup||!r.basisId||typeof r.reliable!=='boolean')throw Error('invalid_service_usage');
 // The upstream evidence adapter supplies a common exclusive group for total
 // and child meters. Never add overlapping total/submeter or repeated bases.
 const bases=new Set<string>(),groups=new Map<string,ServiceUsage[]>();for(const r of usage){if(bases.has(r.basisId))throw Error('invalid_service_usage_overlap');bases.add(r.basisId);const key=JSON.stringify([r.siteId,r.metricId,r.exclusiveGroup]);groups.set(key,[...(groups.get(key)??[]),r]);}
 for(const group of groups.values()){group.sort((a,b)=>Date.parse(a.from)-Date.parse(b.from));for(let i=1;i<group.length;i++)if(overlap(group[i-1].from,group[i-1].to,group[i].from,group[i].to))throw Error('invalid_service_usage_overlap');}
 return c;
}
export function preserveServiceHistory(old:readonly (ServiceCapture|undefined)[],next:ServiceCapture|undefined){if(!next)return;validateServices(next);for(const c of old){if(c?.id===next.id&&JSON.stringify(c)!==JSON.stringify(next))throw Error('invalid_service_history_rewrite');if(c?.catalogVersion===next.catalogVersion&&JSON.stringify(c.metrics)!==JSON.stringify(next.metrics))throw Error('invalid_service_catalog_rewrite');}}
export function scopeServices(c:ServiceCapture|undefined,sites:ReadonlySet<string>,operators:readonly string[]){if(!c)return undefined;const copy=structuredClone(c);copy.operatorScope=(c.operatorScope??brands).filter(o=>operators.includes(o));copy.customers=copy.customers.filter(r=>copy.operatorScope!.includes(r.operator));const allowed=new Set(copy.customers.map(r=>r.id));copy.configurations=copy.configurations.filter(r=>sites.has(r.siteId)&&allowed.has(r.customerId));copy.usage=copy.usage.filter(r=>sites.has(r.siteId)&&r.customerId!==null&&allowed.has(r.customerId));const used=new Set([...copy.configurations,...copy.usage].map(r=>r.customerId));copy.customers=copy.customers.filter(r=>used.has(r.id));return copy;}
export function serviceSites(c:ServiceCapture|undefined,operators:readonly string[]){const customers=new Set(c?.customers.filter(r=>operators.includes(r.operator)).map(r=>r.id)??[]);return new Set([...(c?.configurations??[]),...(c?.usage??[])].filter(r=>r.customerId!==null&&customers.has(r.customerId)).map(r=>r.siteId));}
const beijing=(value:string)=>new Date(Date.parse(value)+8*3600000).toISOString().replace(/(?:\.000)?Z$/,'+08:00');
export function serviceDescriptor(parent:SnapshotDescriptor,c:ServiceCapture|undefined):SnapshotDescriptor {return {...parent,dataset:'tower-services',businessPeriod:c?{start:beijing(c.period.start),end:beijing(c.period.end)}:null,stockAsOf:c?beijing(c.stockAsOf):parent.stockAsOf,dataThrough:c?beijing(c.dataThrough):parent.dataThrough,mappingVersion:c?.mappingVersion??'services-pending',sourceVersion:c?.sourceVersion??'services-pending',ruleSetVersion:c?c.catalogVersion+':'+c.ruleSetVersion:null,periodComplete:c?.periodComplete??null};}
export function serviceSummary(c:ServiceCapture|undefined,metricId:string,siteIds:ReadonlySet<string>,operator='all'){
 if(!c)return {coverage:null,endCoverage:null,quantity:null,excluded:0};validateServices(c);if(operator!=='all'&&!(c.operatorScope??brands).includes(operator)||c.operatorScope?.length===0)return {coverage:null,endCoverage:null,quantity:null,excluded:0};
 const customers=new Set(c.customers.filter(v=>operator==='all'||v.operator===operator).map(v=>v.id));
 const configs=unique(c.configurations).filter(r=>siteIds.has(r.siteId)&&customers.has(r.customerId));
 const valid=(r:ServiceConfiguration)=>r.confirmed&&c.metrics.find(m=>m.id===r.metricId)?.confirmed===true&&r.from!==null&&r.end!=='unknown';
 const during=(r:ServiceConfiguration)=>valid(r)&&Date.parse(r.from!)<Date.parse(c.dataThrough)&&(r.to===null||Date.parse(r.to)>Date.parse(c.period.start));
 const point=Date.parse(c.stockAsOf)-(Date.parse(c.stockAsOf)===Date.parse(c.period.end)?1:0);
 const active=(r:ServiceConfiguration)=>valid(r)&&Date.parse(r.from!)<=point&&(r.to===null||Date.parse(r.to)>point);
 const coverage=c.configComplete&&configs.every(valid)?new Set(configs.filter(during).map(r=>r.siteId)).size:null;
 const endCoverage=c.configComplete&&configs.every(valid)?new Set(configs.filter(active).map(r=>r.siteId)).size:null;
 const m=c.metrics.find(r=>r.id===metricId);let total:string|null=null,excluded=0;
 if(m?.confirmed){if(m.kind==='stock'){const selected=configs.filter(r=>r.metricId===metricId);if(c.configComplete&&selected.every(valid))total=String(selected.filter(active).reduce((n,r)=>n+BigInt(r.quantity),0n));excluded=selected.filter(r=>!valid(r)).length;}
 else{const reliable=(r:ServiceUsage)=>r.reliable&&!!r.agreementVersion&&!!r.ruleVersion;const selected=unique(c.usage).filter(r=>siteIds.has(r.siteId)&&r.metricId===metricId&&(r.customerId===null||customers.has(r.customerId)));excluded=selected.filter(r=>!reliable(r)||r.customerId===null).length;if(c.usageComplete&&c.periodComplete&&selected.filter(r=>r.customerId!==null).every(reliable))total=String(selected.filter(r=>reliable(r)&&r.customerId!==null).reduce((n,r)=>n+BigInt(r.quantity),0n));}}
 return {coverage,endCoverage,quantity:total,excluded};
}
export function formatServiceQuantity(value:string|null,scale=0){if(value===null)return '\u5f85\u63a5\u5165';const negative=value.startsWith('-'),raw=negative?value.slice(1):value,padded=raw.padStart(scale+1,'0'),whole=scale?padded.slice(0,-scale):padded,decimal=scale?padded.slice(-scale).replace(/0+$/,''):'';return (negative?'-':'')+whole.replace(/\B(?=(\d{3})+(?!\d))/g,',')+(decimal?'.'+decimal:'');}

// A request-local immutable read plan: validate once, parse effective dates once,
// cache one aggregation for each actual site set/operator. No cross-request
// cache can conceal a caller's later edits to a capture.
export function serviceSummaryReader(c:ServiceCapture|undefined){
 if(!c)return (_metric:string,_sites:ReadonlySet<string>,_operator='all')=>({coverage:null as number|null,endCoverage:null as number|null,quantity:null as string|null,excluded:0});
 validateServices(c);const metrics=new Map(c.metrics.map(m=>[m.id,m])),customers=new Map(c.customers.map(r=>[r.id,r.operator]));
 const point=Date.parse(c.stockAsOf)-(Date.parse(c.stockAsOf)===Date.parse(c.period.end)?1:0),from=Date.parse(c.period.start),to=Date.parse(c.dataThrough);
 const configs=unique(c.configurations).map(r=>{const valid=r.confirmed&&metrics.get(r.metricId)?.confirmed===true&&r.from!==null&&r.end!=='unknown',start=Date.parse(r.from??''),end=r.to===null?Infinity:Date.parse(r.to);return {r,valid,active:valid&&start<=point&&end>point,during:valid&&start<to&&end>from};});
 const usage=unique(c.usage),cache=new WeakMap<ReadonlySet<string>,Map<string,Map<string,ReturnType<typeof serviceSummary>>>>();
 return (metricId:string,sites:ReadonlySet<string>,operator='all')=>{
  let byOperator=cache.get(sites);if(!byOperator){byOperator=new Map();cache.set(sites,byOperator);}let result=byOperator.get(operator);
  if(!result){result=new Map();byOperator.set(operator,result);const absent=operator!=='all'&&!(c.operatorScope??brands).includes(operator)||c.operatorScope?.length===0,covered=new Set<string>(),endCovered=new Set<string>();let allValid=true;
   const sums=new Map(c.metrics.map(m=>[m.id,{sum:0n,excluded:0,valid:true}]));
   for(const x of configs){const r=x.r;if(!sites.has(r.siteId)||operator!=='all'&&customers.get(r.customerId)!==operator)continue;allValid&&=x.valid;if(x.during)covered.add(r.siteId);if(x.active)endCovered.add(r.siteId);const s=sums.get(r.metricId)!;s.valid&&=x.valid;if(!x.valid)s.excluded++;if(x.active)s.sum+=BigInt(r.quantity);}
   for(const r of usage){if(!sites.has(r.siteId)||r.customerId!==null&&operator!=='all'&&customers.get(r.customerId)!==operator)continue;const s=sums.get(r.metricId)!,reliable=r.reliable&&!!r.agreementVersion&&!!r.ruleVersion;if(!reliable||r.customerId===null)s.excluded++;if(r.customerId!==null){s.valid&&=reliable;if(reliable)s.sum+=BigInt(r.quantity);}}
   for(const m of c.metrics){const s=sums.get(m.id)!;result.set(m.id,{coverage:absent?null:c.configComplete&&allValid?covered.size:null,endCoverage:absent?null:c.configComplete&&allValid?endCovered.size:null,quantity:!absent&&m.confirmed&&s.valid&&(m.kind==='stock'?c.configComplete:c.usageComplete&&c.periodComplete)?String(s.sum):null,excluded:s.excluded});}
  }
  return result.get(metricId)??{coverage:null,endCoverage:null,quantity:null,excluded:0};
 };
}
