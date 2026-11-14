import {siteTenancy,type TenantMonthSnapshot} from './tenancy';

export interface OccupancyEndpoint {snapshot:TenantMonthSnapshot|null;siteIds:readonly string[];scopeKey:string}
type Relation={siteId:string;customerId:string;operator:string};
type OccupancyReason='current_missing'|'baseline_missing'|'scope_changed'|'basis_changed'|'invalid_order'|'customer_changed'|'revision';
function endpoint(value:OccupancyEndpoint,operators:readonly string[]){
 const relations=new Map<string,Relation>(),owners=new Map<string,string>();let complete=!!value.snapshot;
 for(const siteId of new Set(value.siteIds)){
  const row=siteTenancy(value.snapshot,siteId);if(row.state!=='known')complete=false;
  for(const tenant of row.tenants){
   if(!operators.includes(tenant.operator))continue;
   if(owners.has(tenant.customerId)&&owners.get(tenant.customerId)!==tenant.operator)complete=false;
   owners.set(tenant.customerId,tenant.operator);
   relations.set(JSON.stringify([siteId,tenant.customerId]),{siteId,customerId:tenant.customerId,operator:tenant.operator});
  }
 }
 return {relations,owners,complete};
}
// Compare endpoint sets, never sum monthly additions or infer contract events.
// Different physical site sets are valid only within the same authorized scope.
export function occupancyAnalysis(current:OccupancyEndpoint,baseline:OccupancyEndpoint,operators:readonly string[]){
 const now=endpoint(current,operators),before=endpoint(baseline,operators);
 const reason:OccupancyReason|null=!now.complete?'current_missing':!before.complete?'baseline_missing':current.scopeKey!==baseline.scopeKey?'scope_changed':current.snapshot!.sourceVersion!==baseline.snapshot!.sourceVersion?'basis_changed':current.snapshot!.month===baseline.snapshot!.month?'revision':!Number.isFinite(Date.parse(current.snapshot!.asOf))||!Number.isFinite(Date.parse(baseline.snapshot!.asOf))||Date.parse(current.snapshot!.asOf)<=Date.parse(baseline.snapshot!.asOf)?'invalid_order':[...now.owners].some(([id,operator])=>before.owners.has(id)&&before.owners.get(id)!==operator)?'customer_changed':null;
 const comparable=reason===null,currentSites=new Set(current.siteIds),baselineSites=new Set(baseline.siteIds);
 const additions=comparable?[...now.relations].filter(([key])=>!before.relations.has(key)).map(([,row])=>row):[];
 const removals=comparable?[...before.relations].filter(([key])=>!now.relations.has(key)).map(([,row])=>row):[];
 const count=(rows:Relation[],test:(row:Relation)=>boolean)=>comparable?rows.filter(test).length:null;
 const customers=operators.map(operator=>{
  const currentCount=now.complete?[...now.relations.values()].filter(r=>r.operator===operator).length:null;
  const baselineCount=before.complete?[...before.relations.values()].filter(r=>r.operator===operator).length:null;
  const added=count(additions,r=>r.operator===operator),removed=count(removals,r=>r.operator===operator);
  return {id:operator,operator,current:currentCount,baseline:baselineCount,added,removed,net:comparable?added!-removed!:null,addedExisting:count(additions,r=>r.operator===operator&&baselineSites.has(r.siteId)),addedNewSites:count(additions,r=>r.operator===operator&&!baselineSites.has(r.siteId)),removedExisting:count(removals,r=>r.operator===operator&&currentSites.has(r.siteId)),removedRetiredSites:count(removals,r=>r.operator===operator&&!currentSites.has(r.siteId))};
 });
 return {comparable,reason,current:now.complete?now.relations.size:null,baseline:before.complete?before.relations.size:null,added:comparable?additions.length:null,removed:comparable?removals.length:null,net:comparable?additions.length-removals.length:null,addedExisting:count(additions,r=>baselineSites.has(r.siteId)),addedNewSites:count(additions,r=>!baselineSites.has(r.siteId)),removedExisting:count(removals,r=>currentSites.has(r.siteId)),removedRetiredSites:count(removals,r=>!currentSites.has(r.siteId)),customers};
}
