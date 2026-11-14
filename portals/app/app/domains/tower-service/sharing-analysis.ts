import {summarizeTenancy,type TenantMonthSnapshot} from './tenancy';

export function sharingAnalysis(snapshot:TenantMonthSnapshot|null,siteIds:readonly string[],operators:readonly string[]){
 const total=summarizeTenancy(snapshot,siteIds),complete=total.complete;
 const count=(test:(value:number)=>boolean)=>complete?total.rows.filter(r=>test(r.count!)).length:null;
 const buckets=[{id:'vacant',count:count(n=>n===0)},{id:'single',count:count(n=>n===1)},{id:'double',count:count(n=>n===2)},{id:'triple',count:count(n=>n===3)},{id:'quadruple',count:count(n=>n===4)},{id:'fivePlus',count:count(n=>n>=5)}];
 const customers=operators.map(operator=>{
  const rows=total.rows.filter(r=>r.tenants.some(t=>t.operator===operator));
  const covered=complete?rows.length:null,shared=complete?rows.filter(r=>r.count!>=2).length:null;
  return {id:operator,operator,covered,shared,single:complete?rows.filter(r=>r.count===1).length:null,double:complete?rows.filter(r=>r.count===2).length:null,triple:complete?rows.filter(r=>r.count===3).length:null,quadruple:complete?rows.filter(r=>r.count===4).length:null,fivePlus:complete?rows.filter(r=>r.count!>=5).length:null,rateBps:covered?Math.round(shared!*10000/covered):null};
 });
 return {siteCount:siteIds.length,knownSites:total.knownSites,unknownSites:total.unknownSites,complete,occupied:total.occupied,shared:total.shared,relationships:complete?total.rows.reduce((n,r)=>n+r.count!,0):null,rateBps:total.sharingRate===null?null:Math.round(total.sharingRate*10000),averageHundredths:total.average===null?null:Math.round(total.average*100),buckets,customers};
}
