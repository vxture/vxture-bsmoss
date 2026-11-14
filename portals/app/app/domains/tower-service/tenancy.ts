// Source monthly facts only. Branding and today's directory never create tenants.
export type AnchorState='yes'|'no'|'unknown';
export interface MonthlyTenant {customerId:string;operator:string;from:string|null;to:string|null;anchor:AnchorState;evidence:string[]}
export interface TenantMonthSnapshot {id:string;month:string;revision:number;supersedesId:string|null;asOf:string;sourceVersion:string;sites:{siteId:string;complete:boolean;tenants:MonthlyTenant[]}[]}
export interface TenancyCapture {snapshots:TenantMonthSnapshot[];refs:{month:string;snapshotId:string}[]}
const operators=['mobile','telecom','unicom','broadcast','other'];
export function validateTenancy(capture:TenancyCapture){
 const ids=new Set<string>(),months=new Set<string>(),revisions=new Set<string>();
 if(!Array.isArray(capture.snapshots)||!Array.isArray(capture.refs))throw Error('invalid_tenant_capture');
 for(const s of capture.snapshots){if(!s.id||ids.has(s.id)||revisions.has(s.month+':'+s.revision)||!/^\d{4}-(0[1-9]|1[0-2])$/.test(s.month)||!Number.isSafeInteger(s.revision)||s.revision<1||!Number.isFinite(Date.parse(s.asOf))||s.asOf.slice(0,7)!==s.month||!s.sourceVersion)throw Error('invalid_tenant_snapshot');ids.add(s.id);revisions.add(s.month+':'+s.revision);const sites=new Set<string>();
  for(const row of s.sites){if(!row.siteId||sites.has(row.siteId)||typeof row.complete!=='boolean')throw Error('invalid_tenant_site');sites.add(row.siteId);for(const t of row.tenants){if(!t.customerId||!operators.includes(t.operator)||!['yes','no','unknown'].includes(t.anchor)||!Array.isArray(t.evidence)||!t.evidence.length||t.evidence.some(e=>!e)||t.from!==null&&!Number.isFinite(Date.parse(t.from))||t.to!==null&&!Number.isFinite(Date.parse(t.to))||t.from!==null&&t.to!==null&&Date.parse(t.from)>=Date.parse(t.to))throw Error('invalid_tenant_fact');}}
 }
 for(const r of capture.refs){if(months.has(r.month)||!capture.snapshots.some(s=>s.id===r.snapshotId&&s.month===r.month))throw Error('invalid_tenant_reference');months.add(r.month);}
 return capture;
}
export function preserveTenantHistory(previous:readonly (TenancyCapture|undefined)[],next:TenancyCapture|undefined){if(!next)return;validateTenancy(next);const old=new Map(previous.flatMap(c=>c?.snapshots??[]).map(s=>[s.id,s]));for(const s of next.snapshots){const prior=old.get(s.id);if(prior&&JSON.stringify(prior)!==JSON.stringify(s))throw Error('invalid_tenant_revision_overwrite');if(s.supersedesId){const base=old.get(s.supersedesId)??next.snapshots.find(v=>v.id===s.supersedesId);if(!base||base.month!==s.month||base.revision>=s.revision)throw Error('invalid_tenant_revision');}}}
export function scopeTenancy(capture:TenancyCapture|undefined,siteIds:ReadonlySet<string>,allowedOperators:readonly string[]):TenancyCapture|undefined{if(!capture)return undefined;return {refs:structuredClone(capture.refs),snapshots:capture.snapshots.map(s=>({...s,sites:s.sites.filter(r=>siteIds.has(r.siteId)).map(r=>({...r,complete:r.complete&&operators.every(o=>allowedOperators.includes(o)),tenants:r.tenants.filter(t=>allowedOperators.includes(t.operator)).map(t=>structuredClone(t))}))}))};}
export function tenantMonth(capture:TenancyCapture|undefined,month:string){const ref=capture?.refs.find(r=>r.month===month);return ref?capture!.snapshots.find(s=>s.id===ref.snapshotId&&s.month===month)??null:null;}
export function siteTenancy(snapshot:TenantMonthSnapshot|null,siteId:string){
 const row=snapshot?.sites.find(r=>r.siteId===siteId);if(!snapshot||!row)return {state:'not_connected' as const,count:null,anchor:'unknown' as AnchorState,tenants:[] as MonthlyTenant[]};
 const at=Date.parse(snapshot.asOf),active=row.tenants.filter(t=>(t.from===null||Date.parse(t.from)<=at)&&(t.to===null||Date.parse(t.to)>at));
 const unique=new Map<string,MonthlyTenant>();let uncertain=!row.complete;
 for(const t of active){if(t.from===null||t.to===null)uncertain=true;const prior=unique.get(t.customerId);if(prior&&(prior.operator!==t.operator||prior.anchor!==t.anchor))uncertain=true;unique.set(t.customerId,t);}
 const tenants=[...unique.values()],anchor:AnchorState=tenants.some(t=>t.anchor==='yes')?'yes':tenants.some(t=>t.anchor==='unknown')?'unknown':'no';
 return {state:uncertain?'pending' as const:'known' as const,count:uncertain?null:tenants.length,anchor:uncertain?'unknown' as AnchorState:anchor,tenants};
}
export function summarizeTenancy(snapshot:TenantMonthSnapshot|null,siteIds:readonly string[]){const rows=siteIds.map(siteId=>({siteId,...siteTenancy(snapshot,siteId)})),known=rows.filter(r=>r.count!==null),occupied=known.filter(r=>r.count!>0),shared=occupied.filter(r=>r.count!>=2),complete=!!snapshot&&known.length===rows.length;
 return {snapshotId:snapshot?.id??null,month:snapshot?.month??null,asOf:snapshot?.asOf??null,rows,knownSites:known.length,unknownSites:rows.length-known.length,occupied:complete?occupied.length:null,shared:complete?shared.length:null,sharingRate:complete&&occupied.length?shared.length/occupied.length:null,average:complete&&occupied.length?occupied.reduce((n,r)=>n+r.count!,0)/occupied.length:null,buckets:['0','1','2','3','4','5+'].map(key=>({key,count:complete?known.filter(r=>key==='5+'?r.count!>=5:r.count===Number(key)).length:null})),complete};
}
