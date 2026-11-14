import {SERVICE_DELIVERABLES} from './delivery-catalog';
import {OPERATORS,type Inventory,type InventoryRow,type FoundationAccess,type RuleVersion,type PublishedSnapshot,assertAccess} from './foundation';
import type {ServiceMetric,ServiceConfiguration,ServiceUsage,ServiceCapture} from './quantification';
import type {EvidenceCapture} from './evidence';
import type {TenantMonthSnapshot} from './tenancy';
import {DAY,HISTORY_VERSION,HISTORY_START,HISTORY_END,historyDay,historyAt,parseHistoryId,historyId,historyWindow,calendarPeriod,beijing} from './history-calendar';
export {HISTORY_VERSION,HISTORY_START,HISTORY_END} from './history-calendar';
export interface HistoryRelation {site:number;operator:string;from:number;to:number;anchor:boolean}
export interface HistoryConfig {pair:number;metric:number;from:number;to:number;quantity:number}
export interface HistoryMonth {month:string;id:string;asOf:string;pairs:number[]}
export interface HistoryRollup {id:string;city:string;county:string;operator:string;quantities:number[];covered:number[];active:number[]}
export interface DemoHistory {version:typeof HISTORY_VERSION;start:string;end:string;seed:string;days:number;sites:InventoryRow[];activated:number[];relations:HistoryRelation[];metrics:ServiceMetric[];configs:HistoryConfig[];months:HistoryMonth[];daily:Uint32Array;rollups?:HistoryRollup[];rules?:RuleVersion[]}
const hash=(s:string)=>{let n=2166136261;for(let i=0;i<s.length;i++)n=Math.imul(n^s.charCodeAt(i),16777619);return n>>>0;};
const names:Record<string,string>={mobile:'\u79fb\u52a8',telecom:'\u7535\u4fe1',unicom:'\u8054\u901a',broadcast:'\u5e7f\u7535',other:'\u5176\u4ed6'};
const customerId=(operator:string)=>'demo-customer-'+operator;
const agreement=(operator:string,year:string)=>'DEMO-AGREEMENT-'+operator+'-'+year;
const ruleId=(operator:string,year:string)=>'DEMO-METER-'+operator+'-'+year;
export function generateHistory(base:Inventory,seed='shaanxi-two-year-v1'):DemoHistory {
 const days=historyDay(HISTORY_END),sites=structuredClone(base.rows),activated=sites.map(s=>hash(seed+s.id)%100<15?30+hash(s.id+'start')%600:0);
 const metrics:ServiceMetric[]=SERVICE_DELIVERABLES.map(r=>({id:r.id,name:r.name,category:r.group,categoryName:r.groupName,service:r.group==='indoor'?'indoor':r.group==='transport'?'transport':r.group==='power'||r.group==='backup'||r.group==='metering'?'power':'tower',unit:r.unit,scale:r.kind==='usage'?3:['room-area','site-area','power-capacity','apparent-capacity','backup-energy','cooling-capacity','fiber-core-length'].includes(r.id)?2:0,spec:'DEMO v1',boundary:r.kind==='usage'?'customer_dedicated_meter':'customer_delivered_component',kind:r.kind,confirmed:true}));
 const relations:HistoryRelation[]=[];
 sites.forEach((s,site)=>s.allOperators.forEach((operator,index)=>{const n=hash(seed+s.id+operator);const from=Math.min(days-30,activated[site]+(index&&n%5===0?30+n%300:0)),to=index&&n%31===0?Math.max(from+30,days-30-n%240):days;relations.push({site,operator,from,to,anchor:index===0});}));
 const configs:HistoryConfig[]=[];
 relations.forEach((p,pair)=>metrics.forEach((m,metric)=>{
  if(m.kind==='usage')return;const n=hash(seed+pair+m.id);
  // Candidate categories without a physical inventory are explicit demo service
  // configurations, never inferred from customer equipment or site totals.
  const common=['mounting-positions','power-connections','power-capacity','customer-metering-points'].includes(m.id);
  if(!common&&n%100>({tower:90,space:35,power:45,backup:25,facilities:20,metering:100,indoor:12,transport:18}[m.category]??20))return;
  const quantity=m.id==='reserved-bandwidth'?(1+n%10)*100:m.id==='cabinet-units'?2+n%12:m.scale?((m.id==='indoor-coverage-area'?500:1)+n%20)*10**m.scale:1+n%3;
  const upgrade=p.from+240+n%160;if(n%7===0&&upgrade<p.to){configs.push({pair,metric,from:p.from,to:upgrade,quantity},{pair,metric,from:upgrade,to:p.to,quantity:quantity+10**m.scale});}else configs.push({pair,metric,from:p.from,to:p.to,quantity});
 }));
 const daily=new Uint32Array(relations.length*days);
 relations.forEach((p,pair)=>{const n=hash(seed+sites[p.site].id+p.operator),baseWh=25000+n%95000;for(let day=p.from;day<p.to;day++){
  const date=new Date(Date.parse(HISTORY_START)+day*DAY+8*3600000),month=date.getUTCMonth(),weekend=[0,6].includes(date.getUTCDay());
  const season=[113,109,100,94,100,115,128,126,110,98,102,111][month],noise=92+hash(n+':'+day)%17;
  daily[pair*days+day]=Math.floor(baseWh*season*noise*(weekend?98:100)*(1000+Math.floor(day/12))/1000000000);
 }});
 const h:DemoHistory={version:HISTORY_VERSION,start:HISTORY_START,end:HISTORY_END,seed,days,sites,activated,relations,metrics,configs,months:[],daily};
 for(const id of historyWindow(historyId('month',HISTORY_START))){const p=parseHistoryId(id)!;h.months.push({month:p.start.slice(0,7),id:HISTORY_VERSION+':tenants:'+p.start.slice(0,7),asOf:beijing(Date.parse(p.to)-1),pairs:relations.flatMap((r,i)=>r.from<historyDay(p.to)&&r.to>historyDay(p.from)?[i]:[])});}
 h.rules=historyRules();return h;
}
export interface HistoryScope {operators:readonly string[];siteIds:ReadonlySet<string>}
export function historyScope(h:DemoHistory,access:FoundationAccess,now:number):HistoryScope {
 assertAccess(access,'read',now);if(!access.provinceIds.includes('610000'))throw Error('permission_denied');
 return {operators:access.operators,siteIds:new Set(h.sites.filter(r=>(access.cityIds.includes('*')||access.cityIds.includes(r.city))&&(!access.siteIds||access.siteIds.includes(r.id))).map(r=>r.id))};
}
const prefixCache=new WeakMap<DemoHistory,Float64Array>();
function prefixes(h:DemoHistory){let a=prefixCache.get(h);if(!a){a=new Float64Array(h.relations.length*(h.days+1));for(let pair=0;pair<h.relations.length;pair++)for(let d=0;d<h.days;d++)a[pair*(h.days+1)+d+1]=a[pair*(h.days+1)+d]+h.daily[pair*h.days+d];prefixCache.set(h,a);}return a;}
// Integer cumulative shares conserve every day's Wh, including remainder units.
export function hourlyShares(value:number,pair:number,day:number){const weights=Array.from({length:24},(_,hour)=>80+hash(pair+':'+day+':'+hour)%41+(hour>=9&&hour<21?20:0)),total=weights.reduce((a,b)=>a+b,0);let before=0;return weights.map(w=>{const a=Math.floor(value*before/total);before+=w;return Math.floor(value*before/total)-a;});}
export function relationUsage(h:DemoHistory,pair:number,from:string,to:string){
 const a=Date.parse(from),b=Date.parse(to),start=Date.parse(h.start),first=Math.floor((a-start)/DAY),last=Math.floor((b-start)/DAY),p=prefixes(h),offset=pair*(h.days+1);
 if(a<start||b>Date.parse(h.end)||a>=b||a%3600000||b%3600000)throw Error('invalid_history_usage_interval');
 if(a===start+first*DAY&&b===start+last*DAY)return p[offset+last]-p[offset+first];
 let sum=0;for(let day=first;day<=Math.min(last,h.days-1);day++){const lo=Math.max(0,(a-start-day*DAY)/3600000),hi=Math.min(24,(b-start-day*DAY)/3600000);if(hi>lo)sum+=hourlyShares(h.daily[pair*h.days+day],pair,day).slice(lo,hi).reduce((a,b)=>a+b,0);}return sum;
}
export function historyAggregate(h:DemoHistory,id:string,metricId:string,scope:HistoryScope,region:{city:string;county:string;operator?:string}){
 const p=parseHistoryId(id)!,m=h.metrics.find(m=>m.id===metricId);if(!m)throw Error('invalid_history_metric');
 if(p.grain==='month'&&h.rollups&&h.sites.every(s=>scope.siteIds.has(s.id))){const rows=h.rollups.filter(r=>r.id===id&&scope.operators.includes(r.operator)&&(!region.operator||region.operator==='all'||r.operator===region.operator)&&(region.city==='all'||r.city===region.city)&&(region.county==='all'||r.county===region.county)),quantity=rows.reduce((n,r)=>n+r.quantities[h.metrics.indexOf(m)],0);return {quantity:String(quantity),partialQuantity:String(quantity),coverage:new Set(rows.flatMap(r=>r.covered)).size,endCoverage:new Set(rows.flatMap(r=>r.active)).size};}
 const selected=new Set(h.relations.flatMap((r,i)=>{const s=h.sites[r.site];return scope.siteIds.has(s.id)&&scope.operators.includes(r.operator)&&(region.operator==='all'||!region.operator||r.operator===region.operator)&&(region.city==='all'||s.city===region.city)&&(region.county==='all'||s.county===region.county)?[i]:[];}));
 const point=(Date.parse(p.to)-Date.parse(h.start)-1)/DAY,coverage=new Set<number>(),endCoverage=new Set<number>();let total=0;
 const lo=(Date.parse(p.from)-Date.parse(h.start))/DAY,hi=(Date.parse(p.to)-Date.parse(h.start))/DAY;
 for(const pair of selected){const r=h.relations[pair];if(r.from<hi&&r.to>lo)coverage.add(r.site);if(r.from<=point&&r.to>point)endCoverage.add(r.site);if(m.kind==='usage')total+=relationUsage(h,pair,p.from,p.to);}
 if(m.kind==='stock')for(const c of h.configs)if(selected.has(c.pair)&&c.metric===h.metrics.indexOf(m)&&c.from<=point&&c.to>point)total+=c.quantity;
 return {quantity:p.complete||m.kind==='stock'?String(total):null,partialQuantity:String(total),coverage:coverage.size,endCoverage:endCoverage.size};
}
// Persist only month x county x customer aggregates. Province/city totals sum
// these additive quantities; coverage always unions identities, never counts.
export function buildHistoryRollups(h:DemoHistory):HistoryRollup[]{
 const out:HistoryRollup[]=[];
 for(const id of historyWindow(historyId('month',HISTORY_START))){const p=parseHistoryId(id)!,lo=historyDay(p.from),hi=historyDay(p.to),groups=new Map<string,{row:HistoryRollup;covered:Set<number>;active:Set<number>}>(),point=hi-1/DAY;
  const group=(pair:number)=>{const r=h.relations[pair],site=h.sites[r.site],key=site.county+':'+r.operator;let g=groups.get(key);if(!g){g={row:{id,city:site.city,county:site.county,operator:r.operator,quantities:h.metrics.map(()=>0),covered:[],active:[]},covered:new Set(),active:new Set()};groups.set(key,g);}return g;};
  h.relations.forEach((r,pair)=>{if(r.from>=hi||r.to<=lo)return;const g=group(pair);g.covered.add(r.site);if(r.from<=point&&r.to>point)g.active.add(r.site);g.row.quantities[h.metrics.findIndex(m=>m.kind==='usage')]+=relationUsage(h,pair,p.from,p.to);});
  for(const c of h.configs)if(c.from<=point&&c.to>point)group(c.pair).row.quantities[c.metric]+=c.quantity;
  for(const g of groups.values()){g.row.covered=[...g.covered].sort((a,b)=>a-b);g.row.active=[...g.active].sort((a,b)=>a-b);out.push(g.row);}
 }
 return out;
}
export function auditHistory(h:DemoHistory){
 if(h.start!==HISTORY_START||h.end!==HISTORY_END||h.days!==historyDay(h.end)||h.daily.length!==h.days*h.relations.length||h.activated.length!==h.sites.length||h.months.length!==24)throw Error('invalid_history_shape');
 if(h.relations.some(r=>!h.sites[r.site]||!OPERATORS.includes(r.operator as typeof OPERATORS[number])||r.from<0||r.from>=r.to||r.to>h.days)||h.configs.some(c=>!h.relations[c.pair]||!h.metrics[c.metric]||c.quantity<0||!Number.isSafeInteger(c.quantity)||c.from<h.relations[c.pair].from||c.to>h.relations[c.pair].to||c.from>=c.to))throw Error('invalid_history_fact');
 const raw={...h,rollups:undefined},scope={operators:OPERATORS,siteIds:new Set(h.sites.map(s=>s.id))},region={city:'all',county:'all',operator:'all'};let checked=0;
 for(const id of historyWindow(DEFAULT_MONTH()))for(const metric of h.metrics){const a=historyAggregate(h,id,metric.id,scope,region),b=historyAggregate(raw,id,metric.id,scope,region);if(JSON.stringify(a)!==JSON.stringify(b))throw Error('invalid_history_rollup_reconciliation');checked++;}
 return {checkedMonthlyMetrics:checked,calendar:'Asia/Shanghai / Monday / end-exclusive',hourlyMaterialization:'integer cumulative shares',storedHourlyFacts:0};
}
function DEFAULT_MONTH(){return historyId('month',HISTORY_START);}
function demoRules(year:string):RuleVersion[]{return OPERATORS.map(operator=>({id:ruleId(operator,year),series:'DEMO-METER-'+operator,revision:Number(year)-2023,kind:'metering',operator,customerId:customerId(operator),service:'power',unit:'Wh',city:'all',from:year+'-01-01',to:String(Number(year)+1)+'-01-01',state:'active',reference:agreement(operator,year)+' / SYNTHETIC ONLY',confirmed:operator!=='broadcast'&&operator!=='other',boundary:'customer_dedicated_meter',attention:null,severe:null,monthPolicy:'pending',tiers:[],createdAt:HISTORY_START,createdBy:HISTORY_VERSION,metering:{method:'measured',reading:'interval',allocationBps:null,estimateRef:null}}));}
export function historyRules(){return ['2024','2025','2026'].flatMap(demoRules);}
// Versioned reference-only assessment policy, projected with the immutable
// history capture. It never activates or edits a workspace's configured rules.
function historyJudgments(metrics:ServiceMetric[],operators:readonly string[]):RuleVersion[]{
 return operators.flatMap(operator=>{
  const base:RuleVersion={id:'',series:'',revision:1,kind:'judgment',operator,customerId:customerId(operator),service:'power',unit:'item',city:'all',from:'2024-11-01',to:'2026-11-01',state:'active',reference:HISTORY_VERSION+'/assessment-policy-v1',confirmed:true,boundary:'customer_delivered_component',attention:'1',severe:'500',monthPolicy:'pending',tiers:[],createdAt:HISTORY_START,createdBy:HISTORY_VERSION};
  const pending:RuleVersion[]=[...new Set(metrics.map(m=>m.service))].map(service=>{const key='DEMO-JUDGMENT-pending-'+operator+'-'+service;return {...base,id:key,series:key,service,judgment:{metric:'basis_pending',metricId:null}};});
  return [...pending,...metrics.map(m=>{const key='DEMO-JUDGMENT-change-'+operator+'-'+m.id;return {...base,id:key,series:key,service:m.service,unit:'%',boundary:m.boundary,attention:m.kind==='usage'?'10':'5',severe:m.kind==='usage'?'25':'15',judgment:{metric:'service_change' as const,metricId:m.id}};})];
 });
}
// Lightweight monthly source projection shared by resource and sharing analysis.
// It never materializes meters, service configurations or hourly facts.
export function historyTenancy(h:DemoHistory,month:string,scope:HistoryScope,cutoff=Infinity):TenantMonthSnapshot|null {
 const m=h.months.find(m=>m.month===month);if(!m)return null;
 const at=Math.min(Date.parse(m.asOf),cutoff),asOf=beijing(at);
 const bySite=new Map<string,import('./tenancy').MonthlyTenant[]>();
 for(const i of m.pairs){const r=h.relations[i],siteId=h.sites[r.site].id;if(!scope.siteIds.has(siteId)||!scope.operators.includes(r.operator))continue;const values=bySite.get(siteId)??[];values.push({customerId:customerId(r.operator),operator:r.operator,from:historyAt(r.from),to:historyAt(r.to),anchor:r.anchor?'yes':'no',evidence:[HISTORY_VERSION+'/tenancy/'+i]});bySite.set(siteId,values);}
 return {id:m.id+(asOf===m.asOf?'':':'+asOf),month:m.month,revision:1,supersedesId:null,asOf,sourceVersion:HISTORY_VERSION,sites:h.sites.filter((row,i)=>scope.siteIds.has(row.id)&&h.activated[i]<=(at-Date.parse(h.start))/DAY).map(row=>({siteId:row.id,complete:OPERATORS.every(o=>scope.operators.includes(o)),tenants:bySite.get(row.id)??[]}))};
}
export function materializeHistory(h:DemoHistory,id:string,scope:HistoryScope,withEvidence=true):PublishedSnapshot {
 const p=parseHistoryId(id);if(!p)throw Error('invalid_history_id');const lo=historyDay(p.from),hi=(Date.parse(p.to)-Date.parse(h.start))/DAY,point=hi-1/DAY;
 const pairs=new Set(h.relations.flatMap((r,i)=>scope.siteIds.has(h.sites[r.site].id)&&scope.operators.includes(r.operator)&&r.from<hi&&r.to>lo?[i]:[]));
 const rows=h.sites.flatMap((raw,i)=>{
  if(!scope.siteIds.has(raw.id)||h.activated[i]>point)return [];
  const active=h.relations.filter(r=>r.site===i&&r.from<=point&&r.to>point&&scope.operators.includes(r.operator)).map(r=>r.operator);
  if(!active.length&&!h.relations.some((r,j)=>r.site===i&&pairs.has(j)))return [];
  const row=structuredClone(raw);row.allOperators=active;row.devices=row.devices.filter(d=>d.owner==='\u94c1\u5854'||active.includes(d.owner));row.graph.devices=row.graph.devices.filter(d=>d.owner==='\u94c1\u5854'||active.includes(d.owner));row.graph.relations=row.graph.relations.filter(r=>active.includes(r.code));const relationIds=new Set(row.graph.relations.map(r=>r.id));row.graph.devices=row.graph.devices.map(d=>({...d,relationIds:d.relationIds.filter(id=>relationIds.has(id))}));row.graph.observedAt=p.to;return [row];
 });
 const rowIds=new Set(rows.map(r=>r.id)),customers=OPERATORS.filter(o=>scope.operators.includes(o)).map(operator=>({id:customerId(operator),operator,name:names[operator]+' (DEMO)'}));
 const configurations:ServiceConfiguration[]=h.configs.flatMap((c,index)=>{
  const r=h.relations[c.pair];if(!pairs.has(c.pair)||!rowIds.has(h.sites[r.site].id)||c.from>=hi||c.to<=lo)return [];
  return ['2024','2025','2026'].flatMap(year=>{const from=beijing(Math.max(Date.parse(historyAt(c.from)),Date.parse(year+'-01-01T00:00:00+08:00'))),to=beijing(Math.min(Date.parse(historyAt(c.to)),Date.parse(String(Number(year)+1)+'-01-01T00:00:00+08:00')));if(Date.parse(from)>=Date.parse(to)||Date.parse(from)>=Date.parse(p.to)||Date.parse(to)<=Date.parse(p.from))return [];return [{id:HISTORY_VERSION+':config:'+index+':'+year,siteId:h.sites[r.site].id,customerId:customerId(r.operator),serviceItemId:h.metrics[c.metric].id,componentId:'demo-'+c.pair+'-'+c.metric,metricId:h.metrics[c.metric].id,quantity:String(c.quantity),from,to,end:'known' as const,ownership:'dedicated' as const,sourceRef:HISTORY_VERSION+'/config/'+index,agreementVersion:agreement(r.operator,year),ruleVersion:'DEMO-SERVICE-v1',confirmed:true}];});
 });
 const usage:ServiceUsage[]=[];
 for(const pair of pairs){const r=h.relations[pair],siteId=h.sites[r.site].id;if(!rowIds.has(siteId))continue;
  // Split at rule-year boundaries; period evidence and service use the same sum.
  let from=beijing(Math.max(Date.parse(p.from),Date.parse(historyAt(r.from))));const end=beijing(Math.min(Date.parse(p.to),Date.parse(historyAt(r.to))));
  while(Date.parse(from)<Date.parse(end)){const year=from.slice(0,4),to=beijing(Math.min(Date.parse(end),Date.parse(String(Number(year)+1)+'-01-01T00:00:00+08:00'))),key=HISTORY_VERSION+':basis:'+pair+':'+from.slice(0,13).replace(/\D/g,'')+':'+to.slice(0,13).replace(/\D/g,'');
   usage.push({id:key,siteId,customerId:customerId(r.operator),serviceItemId:'supplied-energy',metricId:'supplied-energy',quantity:String(relationUsage(h,pair,from,to)),from,to,physicalBoundary:'customer_dedicated_meter',exclusiveGroup:'customer-'+r.operator,basisId:key,sourceRef:HISTORY_VERSION+'/daily/'+pair+'/'+from+'/'+to,agreementVersion:agreement(r.operator,year),ruleVersion:ruleId(r.operator,year),reliable:true});from=to;
  }
 }
 // A clipped year ends at the data cutoff, not the later calendar-year end.
 // Stock refers to the last observed instant, before exclusive validity ends.
 const stockAsOf=p.to===p.end?p.to:beijing(Date.parse(p.to)-1);
 const services:ServiceCapture={id:id+':services',sourceVersion:HISTORY_VERSION,catalogVersion:HISTORY_VERSION+':catalog',mappingVersion:HISTORY_VERSION+':mapping',ruleSetVersion:'DEMO-SERVICE-v1',operatorScope:[...scope.operators],period:{start:p.start,end:p.end},stockAsOf,dataThrough:p.to,periodComplete:p.complete,configComplete:true,usageComplete:true,customers,metrics:structuredClone(h.metrics),configurations,usage};
 const months=h.months.filter(m=>m.month>=p.from.slice(0,7)&&m.month<=beijing(Date.parse(p.to)-1).slice(0,7)).map(m=>historyTenancy(h,m.month,scope,Date.parse(p.to)-1)!);
 let evidence:EvidenceCapture|undefined;
 if(withEvidence){const years=[...new Set(usage.map(u=>u.from.slice(0,4)))];evidence={id:id+':evidence',sourceVersion:HISTORY_VERSION,mappingVersion:HISTORY_VERSION+':meters',ruleSetVersion:'DEMO-METER-v1',period:{start:p.from,end:p.to},dataThrough:p.to,complete:p.complete,applicabilityComplete:true,operatorScope:[...scope.operators],customers,meters:[],records:[],bindings:[],items:[],rules:structuredClone((h.rules??historyRules()).filter(r=>years.includes(r.from.slice(0,4))&&scope.operators.includes(r.operator)))};
  for(const u of usage){const meterId='demo-meter-'+u.siteId+'-'+u.customerId;if(!evidence.meters.some(m=>m.id===meterId))evidence.meters.push({id:meterId,siteId:u.siteId,unit:'Wh',scale:0,boundary:u.physicalBoundary,role:'independent',parentId:null,sourceRef:HISTORY_VERSION+'/meters/'+meterId});evidence.records.push({id:u.id+':reading',meterId,from:u.from,to:u.to,kind:'interval',quantity:u.quantity,startValue:null,endValue:null,multiplier:'1',epoch:HISTORY_VERSION,event:'none',reliable:true,sourceRef:u.sourceRef});evidence.bindings.push({id:u.id+':binding',meterId,customerId:u.customerId!,service:'power',from:u.from,to:u.to,sourceRef:u.sourceRef});evidence.items.push({id:u.basisId,siteId:u.siteId,meterId,customerId:u.customerId,service:'power',from:u.from,to:u.to,method:'measured',ruleIds:[u.ruleVersion!],sharingRuleIds:[],sharingRequired:false,sharingReferenceAt:null,sourceRef:u.sourceRef});}
 }
 const descriptor={id,dataset:'site-resources',mode:'demo' as const,sourceVersion:HISTORY_VERSION,mappingVersion:HISTORY_VERSION+':resources',stockAsOf:p.to,businessPeriod:{start:p.start,end:p.end},dataThrough:p.to,syncedAt:HISTORY_END,publishedAt:HISTORY_END,periodComplete:p.complete,ruleSetVersion:HISTORY_VERSION,scopeKey:JSON.stringify([...scope.operators].sort())};
 return {id,previousId:null,origin:'reference',digest:HISTORY_VERSION+':'+id,checks:[],inventory:{descriptor,provinceId:'610000',expectedSites:rows.length,expectedDevices:rows.reduce((n,r)=>n+r.devices.length,0),rows,services,evidence,judgmentRules:historyJudgments(h.metrics,scope.operators),tenancy:{snapshots:months,refs:months.map(m=>({month:m.month,snapshotId:m.id}))}}};
}
