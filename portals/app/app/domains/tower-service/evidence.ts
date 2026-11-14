import {validateRule,UNITS,type RuleVersion} from './foundation';
import {siteTenancy,tenantMonth,type TenancyCapture} from './tenancy';
import type {SnapshotDescriptor} from './query';
export type BasisMethod='measured'|'allocated'|'estimated'|'unassigned';
export interface Meter {id:string;siteId:string;unit:string;scale:number;boundary:string;role:'total'|'sub'|'independent';parentId:string|null;sourceRef:string}
export interface MeterRecord {id:string;meterId:string;from:string;to:string;kind:'interval'|'cumulative';quantity:string|null;startValue:string|null;endValue:string|null;multiplier:string;epoch:string;event:'none'|'reset'|'replacement';reliable:boolean;sourceRef:string}
export interface MeterBinding {kind?:'exclusive'|'allocation';id:string;meterId:string;customerId:string;service:string;from:string;to:string;sourceRef:string}
export interface BasisItem {id:string;siteId:string;meterId:string;customerId:string|null;service:string;from:string;to:string;method:BasisMethod;ruleIds:string[];sharingRuleIds:string[];sharingRequired:boolean;sharingReferenceAt:string|null;sourceRef:string}
export interface EvidenceCapture {id:string;sourceVersion:string;mappingVersion:string;ruleSetVersion:string;period:{start:string;end:string};dataThrough:string;complete:boolean;applicabilityComplete:boolean;operatorScope:string[];customers:{id:string;name:string;operator:string}[];meters:Meter[];records:MeterRecord[];bindings:MeterBinding[];items:BasisItem[];rules:RuleVersion[]}
const brands=['mobile','telecom','unicom','broadcast','other'];
const at=(s:string)=>Date.parse(s),integer=(s:unknown):s is string=>typeof s==='string'&&/^\d{1,100}$/.test(s);
const instant=(s:string)=>typeof s==='string'&&/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(s)&&Number.isFinite(at(s));
const validInterval=(a:string,b:string)=>instant(a)&&instant(b)&&at(a)<at(b);
const overlap=(a:{from:string;to:string},b:{from:string;to:string})=>at(a.from)<at(b.to)&&at(b.from)<at(a.to);
const covers=(a:{from:string;to:string},b:{from:string;to:string})=>at(a.from)<=at(b.from)&&at(a.to)>=at(b.to);
export function validateEvidence(c:EvidenceCapture){
 if(!c.id||!c.sourceVersion||!c.mappingVersion||!c.ruleSetVersion||!validInterval(c.period.start,c.period.end)||!instant(c.dataThrough)||at(c.period.end)>at(c.dataThrough)||typeof c.complete!=='boolean'||typeof c.applicabilityComplete!=='boolean'||!Array.isArray(c.operatorScope)||new Set(c.operatorScope).size!==c.operatorScope.length||c.operatorScope.some(o=>!brands.includes(o)))throw Error('invalid_evidence_capture');
 for(const rows of [c.customers,c.meters,c.records,c.bindings,c.items,c.rules]){if(!Array.isArray(rows)||new Set(rows.map(r=>r.id)).size!==rows.length||rows.some(r=>!r.id))throw Error('invalid_evidence_identity');}
 const meters=new Map(c.meters.map(m=>[m.id,m])),customers=new Map(c.customers.map(r=>[r.id,r]));
 for(const r of c.customers)if(!r.name||!c.operatorScope.includes(r.operator))throw Error('invalid_evidence_customer');
 for(const m of c.meters){if(!m.siteId||!UNITS.includes(m.unit as typeof UNITS[number])||!Number.isInteger(m.scale)||m.scale<0||m.scale>9||!m.boundary||!m.sourceRef||!['total','sub','independent'].includes(m.role)||m.parentId===m.id)throw Error('invalid_meter');if(m.parentId){const p=meters.get(m.parentId);if(!p||m.role!=='sub'||p.role!=='total'||p.siteId!==m.siteId||p.unit!==m.unit||p.scale!==m.scale)throw Error('invalid_meter_parent');}}
 for(const r of c.records){if(!meters.has(r.meterId)||!validInterval(r.from,r.to)||!covers({from:c.period.start,to:c.period.end},r)||!['interval','cumulative'].includes(r.kind)||!['none','reset','replacement'].includes(r.event)||!integer(r.multiplier)||BigInt(r.multiplier)===0n||!r.epoch||!r.sourceRef||typeof r.reliable!=='boolean'||r.quantity!==null&&!integer(r.quantity)||r.startValue!==null&&!integer(r.startValue)||r.endValue!==null&&!integer(r.endValue)||r.kind==='interval'&&(r.startValue!==null||r.endValue!==null)||r.kind==='cumulative'&&r.quantity!==null)throw Error('invalid_meter_record');}
 const totals=c.meters.filter(m=>m.role==='total').map(m=>m.siteId+'|'+m.unit+'|'+m.scale+'|'+m.boundary);if(new Set(totals).size!==totals.length)throw Error('invalid_total_meter_overlap');
 const recordRefs=c.records.map(r=>r.sourceRef+'|'+r.from+'|'+r.to);if(new Set(recordRefs).size!==recordRefs.length)throw Error('invalid_record_source_overlap');
 const ordered=[...c.records].sort((a,b)=>a.meterId.localeCompare(b.meterId)||at(a.from)-at(b.from));
 for(let i=1;i<ordered.length;i++){const a=ordered[i-1],b=ordered[i];if(a.meterId===b.meterId&&overlap(a,b))throw Error('invalid_meter_record_overlap');if(a.meterId===b.meterId&&at(a.to)===at(b.from)&&a.kind==='cumulative'&&b.kind==='cumulative'&&a.epoch===b.epoch&&a.endValue!==null&&b.startValue!==null&&BigInt(a.endValue)!==BigInt(b.startValue))throw Error('invalid_meter_reading_chain');}
 for(const b of c.bindings)if(!meters.has(b.meterId)||!customers.has(b.customerId)||!b.service||!b.sourceRef||b.kind!==undefined&&!['exclusive','allocation'].includes(b.kind)||!validInterval(b.from,b.to))throw Error('invalid_meter_binding');
 for(let i=0;i<c.bindings.length;i++)for(let j=i+1;j<c.bindings.length;j++){const a=c.bindings[i],b=c.bindings[j];if(a.meterId===b.meterId&&overlap(a,b)&&a.customerId!==b.customerId&&(a.kind!=='allocation'||b.kind!=='allocation'))throw Error('invalid_meter_binding_overlap');}
 for(const rule of c.rules)validateRule(rule);
 for(const b of c.items)if(!meters.has(b.meterId)||meters.get(b.meterId)!.siteId!==b.siteId||b.customerId!==null&&!customers.has(b.customerId)||!b.service||!validInterval(b.from,b.to)||!covers({from:c.period.start,to:c.period.end},b)||!['measured','allocated','estimated','unassigned'].includes(b.method)||b.customerId===null&&b.method!=='unassigned'||typeof b.sharingRequired!=='boolean'||!Array.isArray(b.ruleIds)||!Array.isArray(b.sharingRuleIds)||new Set(b.ruleIds).size!==b.ruleIds.length||new Set(b.sharingRuleIds).size!==b.sharingRuleIds.length||b.sharingReferenceAt!==null&&!Number.isFinite(at(b.sharingReferenceAt))||!b.sourceRef)throw Error('invalid_basis_item');
 for(let i=0;i<c.items.length;i++)for(let j=i+1;j<c.items.length;j++){const a=c.items[i],b=c.items[j];if(a.meterId===b.meterId&&a.customerId===b.customerId&&overlap(a,b))throw Error('invalid_basis_overlap');}
 return c;
}
export function preserveEvidenceHistory(previous:readonly (EvidenceCapture|undefined)[],next:EvidenceCapture|undefined){if(!next)return;validateEvidence(next);for(const old of previous){if(!old)continue;if(old.id===next.id&&JSON.stringify(old)!==JSON.stringify(next))throw Error('invalid_evidence_revision_overwrite');for(const rule of next.rules){const prior=old.rules.find(r=>r.id===rule.id);if(prior&&JSON.stringify({...prior,state:'frozen'})!==JSON.stringify({...rule,state:'frozen'}))throw Error('invalid_evidence_rule_overwrite');}}}
// Resolve only during publication, then copy exact rule revisions into the capture.
// Historical reads never consult today's editable rule catalogue.
export function freezeConfiguredRules(c:EvidenceCapture|undefined,rules:readonly RuleVersion[],cities:ReadonlyMap<string,string>){
 if(!c)return undefined;const copy=structuredClone(c);
 for(const item of copy.items){if(item.customerId===null)continue;const customer=copy.customers.find(r=>r.id===item.customerId);for(const kind of ['metering','sharing'] as const){const key=kind==='metering'?'ruleIds':'sharingRuleIds';if(item[key].length||kind==='sharing'&&!item.sharingRequired)continue;const matches=rules.filter(r=>r.state==='active'&&r.confirmed&&r.kind===kind&&r.customerId===item.customerId&&r.operator===customer?.operator&&r.service===item.service&&(r.city==='all'||r.city===cities.get(item.siteId))&&at(r.from+'T00:00:00+08:00')<at(item.to)&&at(item.from)<at(r.to+'T00:00:00+08:00'));item[key]=matches.map(r=>r.id);for(const r of matches)if(!copy.rules.some(v=>v.id===r.id))copy.rules.push(structuredClone(r));}}
 return copy;
}
export function evidenceSites(c:EvidenceCapture|undefined,operators:readonly string[]){const customers=new Set(c?.customers.filter(v=>operators.includes(v.operator)).map(v=>v.id));return new Set(c?.items.filter(i=>i.customerId!==null&&customers.has(i.customerId)).map(i=>i.siteId));}
export function scopeEvidence(c:EvidenceCapture|undefined,sites:ReadonlySet<string>,operators:readonly string[],wholeSiteAllowed:boolean):EvidenceCapture|undefined{
 if(!c)return undefined;const copy=structuredClone(c);copy.operatorScope=copy.operatorScope.filter(o=>operators.includes(o));copy.customers=copy.customers.filter(r=>operators.includes(r.operator));const customers=new Set(copy.customers.map(r=>r.id));copy.items=copy.items.filter(r=>sites.has(r.siteId)&&(r.customerId!==null?customers.has(r.customerId):wholeSiteAllowed));const meterIds=new Set(copy.items.map(r=>r.meterId));copy.meters=copy.meters.filter(r=>sites.has(r.siteId)&&meterIds.has(r.id)).map(r=>({...r,parentId:r.parentId&&meterIds.has(r.parentId)?r.parentId:null}));copy.records=copy.records.filter(r=>meterIds.has(r.meterId)&&(wholeSiteAllowed||copy.meters.find(m=>m.id===r.meterId)?.role!=='total'));copy.bindings=copy.bindings.filter(r=>meterIds.has(r.meterId)&&customers.has(r.customerId));copy.customers=copy.customers.filter(r=>copy.items.some(i=>i.customerId===r.id));const ruleIds=new Set(copy.items.flatMap(r=>[...r.ruleIds,...r.sharingRuleIds]));copy.rules=copy.rules.filter(r=>ruleIds.has(r.id)&&customers.has(r.customerId));return copy;
}
export function meterQuantity(records:readonly MeterRecord[],period:{from:string;to:string}){
 const selected=records.filter(r=>overlap(r,period)).sort((a,b)=>at(a.from)-at(b.from));
 if(!selected.length)return {quantity:null,reason:'source_missing',records:[] as MeterRecord[]};
 let cursor=at(period.from),sum=0n;
 for(const r of selected){if(at(r.from)!==cursor||at(r.to)>at(period.to)||!r.reliable)return {quantity:null,reason:'incomplete',records:selected};if(r.event!=='none')return {quantity:null,reason:'needs_segmentation',records:selected};const n=r.kind==='interval'?r.quantity:r.startValue===null||r.endValue===null||BigInt(r.endValue)<BigInt(r.startValue)?null:String(BigInt(r.endValue)-BigInt(r.startValue));if(n===null)return {quantity:null,reason:'invalid_reading',records:selected};sum+=BigInt(n)*BigInt(r.multiplier);cursor=at(r.to);}
 return {quantity:cursor===at(period.to)?String(sum):null,reason:cursor===at(period.to)?'complete':'incomplete',records:selected};
}
const localDate=(s:string)=>new Date(at(s)+8*3600000).toISOString().slice(0,10);
function matchRules(c:EvidenceCapture,item:BasisItem,meter:Meter,city:string,kind:'metering'|'sharing'){
 const customer=c.customers.find(v=>v.id===item.customerId),ids=kind==='metering'?item.ruleIds:item.sharingRuleIds;
 const rules=ids.map(id=>c.rules.find(v=>v.id===id)).filter((r):r is RuleVersion=>!!r);
 const valid=rules.filter(r=>r.kind===kind&&r.confirmed&&r.state!=='draft'&&r.customerId===item.customerId&&r.operator===customer?.operator&&r.service===item.service&&r.unit===meter.unit&&r.boundary===meter.boundary&&(r.city==='all'||r.city===city)&&at(r.from+'T00:00:00+08:00')<=at(item.from)&&at(r.to+'T00:00:00+08:00')>=at(item.to)&&!!r.reference.trim());
 return {state:ids.length>1?'conflict':ids.length===1&&valid.length===1?'matched':'pending',rule:ids.length===1&&valid.length===1?valid[0]:null};
}
function sharingMatch(c:EvidenceCapture,item:BasisItem,meter:Meter,city:string,tenancy:TenancyCapture|undefined){
 if(!item.sharingRequired)return {state:'not_required',ruleId:null,month:null,tenantSnapshotId:null,tenants:null,anchor:'unknown',factorBps:null};
 const match=matchRules(c,item,meter,city,'sharing'),month=localDate(item.from).slice(0,7),snapshot=tenantMonth(tenancy,month),s=siteTenancy(snapshot,item.siteId),tenant=s.tenants.find(r=>r.customerId===item.customerId),rule=match.rule;
 const result={state:match.state,ruleId:rule?.id??null,month,tenantSnapshotId:snapshot?.id??null,tenants:s.count,anchor:tenant?.anchor??'unknown',factorBps:null as number|null};
 if(!rule||match.state==='conflict')return result;
 if(localDate(new Date(at(item.to)-1).toISOString()).slice(0,7)!==month||s.state!=='known'||!tenant||tenant.anchor==='unknown'||rule.monthPolicy==='pending')return {...result,state:'pending'};
 const monthStart=month+'-01T00:00:00+08:00',nextMonth=new Date(Date.parse(month+'-01T00:00:00Z'));nextMonth.setUTCMonth(nextMonth.getUTCMonth()+1);const monthEnd=nextMonth.toISOString().slice(0,10)+'T00:00:00+08:00';
 const validity=rule.monthPolicy==='whole_month'?{from:monthStart,to:monthEnd}:item;
 const monthTenants=snapshot!.sites.find(r=>r.siteId===item.siteId)!.tenants.filter(t=>t.from===null||t.to===null||overlap({from:t.from,to:t.to},validity));
 if(rule.monthPolicy==='reference_day'&&(!item.sharingReferenceAt||at(item.sharingReferenceAt)!==at(snapshot!.asOf))||rule.monthPolicy!=='reference_day'&&monthTenants.some(t=>t.from===null||t.to===null||!covers({from:t.from,to:t.to},validity)))return {...result,state:'pending'};
 const tiers=rule.tiers.filter(t=>s.count!>=t.min&&s.count!<=(t.max??Infinity)&&(t.anchor==='any'||t.anchor===tenant.anchor));
 return {...result,state:tiers.length===1?'matched':tiers.length?'conflict':'pending',factorBps:tiers.length===1?tiers[0].factorBps:null};
}
export function evaluateEvidence(c:EvidenceCapture,tenancy:TenancyCapture|undefined,cities:ReadonlyMap<string,string>){
 validateEvidence(c);
 const rows=c.items.map(item=>{
  const meter=c.meters.find(m=>m.id===item.meterId)!,raw=meterQuantity(c.records.filter(r=>r.meterId===meter.id),item),customer=c.customers.find(r=>r.id===item.customerId)??null;
  const match=matchRules(c,item,meter,cities.get(item.siteId)??'unknown','metering'),rule=match.rule;
  const binding=c.bindings.filter(b=>b.meterId===meter.id&&b.customerId===item.customerId&&b.service===item.service&&(item.method==='allocated'?b.kind==='allocation':b.kind!=='allocation')&&covers(b,item));
  let quantity=raw.quantity,state=item.customerId===null?'unassigned':match.state==='conflict'?'conflict':match.state==='matched'&&binding.length===1?'complete':'pending',reason=raw.reason;
  if(raw.quantity===null){state='pending';reason=raw.reason;}
  else if(item.customerId!==null){if(!rule||binding.length!==1||rule.metering?.method!==item.method||raw.records.some(r=>r.kind!==rule.metering?.reading)){quantity=null;reason='rule_or_binding';}
   else if(item.method==='measured'&&meter.role==='total'){quantity=null;state='conflict';reason='whole_site_not_customer';}
   else if(item.method==='allocated'){const bps=rule.metering?.allocationBps;if(bps===null||bps===undefined||meter.role!=='total'){quantity=null;state='pending';reason='allocation_pending';}else if(BigInt(raw.quantity)*BigInt(bps)%10000n!==0n){quantity=null;state='pending';reason='allocation_precision';}else quantity=String(BigInt(raw.quantity)*BigInt(bps)/10000n);}
   else if(item.method==='estimated'){if(!rule.metering?.estimateRef){quantity=null;state='pending';reason='estimate_pending';}else state='estimated';}
  }
  if(state==='pending'||state==='conflict')quantity=null;
  const sharing=sharingMatch(c,item,meter,cities.get(item.siteId)??'unknown',tenancy);
  if(item.sharingRequired&&sharing.state!=='matched'&&state!=='unassigned'){state=sharing.state==='conflict'?'conflict':'pending';reason='sharing_pending';quantity=null;}
  return {...item,meter,customer,quantity,rawQuantity:raw.quantity,state,reason,records:raw.records,binding:binding.length===1?binding[0]:null,rule,sharing};
 });
 // An allocated total and measured children cannot both claim the same energy.
 for(const row of rows.filter(r=>r.method==='allocated'&&r.quantity!==null)){
  const peers=rows.filter(r=>r.meterId===row.meterId&&r.method==='allocated'&&r.customerId!==null&&overlap(r,row)),bps=peers.reduce((n,r)=>n+(r.rule?.metering?.allocationBps??0),0);
  const children=rows.filter(r=>r.meter.parentId===row.meterId&&r.customerId!==null&&overlap(r,row));
  if(bps>10000||children.length)for(const r of [...peers,...children]){r.quantity=null;r.state='conflict';r.reason='allocation_conflict';}
 }
 const reconciliation=c.meters.filter(m=>m.role==='total').map(m=>{const parent=meterQuantity(c.records.filter(r=>r.meterId===m.id),{from:c.period.start,to:c.period.end}),children=c.meters.filter(v=>v.parentId===m.id),values=children.map(v=>meterQuantity(c.records.filter(r=>r.meterId===v.id),{from:c.period.start,to:c.period.end}));const sub=children.length&&values.every(v=>v.quantity!==null)?String(values.reduce((n,v)=>n+BigInt(v.quantity!),0n)):null;return {meterId:m.id,siteId:m.siteId,unit:m.unit,scale:m.scale,boundary:m.boundary,total:parent.quantity,sub,difference:parent.quantity!==null&&sub!==null?String(BigInt(parent.quantity)-BigInt(sub)):null};});
 for(const check of reconciliation.filter(r=>r.difference!==null&&BigInt(r.difference)<0n))for(const row of rows.filter(r=>r.meter.parentId===check.meterId)){row.quantity=null;row.state='conflict';row.reason='reconciliation_conflict';}
 return {rows,reconciliation};
}
export function evidenceDescriptor(parent:SnapshotDescriptor,c:EvidenceCapture|undefined):SnapshotDescriptor{return {...parent,dataThrough:c?.dataThrough??parent.dataThrough,dataset:'metering-evidence',sourceVersion:c?.sourceVersion??'pending',mappingVersion:c?.mappingVersion??'pending',businessPeriod:c?{start:new Date(at(c.period.start)+8*3600000).toISOString().slice(0,19)+'+08:00',end:new Date(at(c.period.end)+8*3600000).toISOString().slice(0,19)+'+08:00'}:null,periodComplete:c?.complete??null,ruleSetVersion:c?c.ruleSetVersion+':'+c.rules.map(r=>r.id).sort().join(','):null};}
