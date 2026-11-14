import {HISTORY_VERSION} from './history-calendar';
import type {ServiceCapture} from './quantification';

// The history bundle already freezes the quantity, object, validity and rule
// references. Read its active configurations directly; do not create readings
// or duplicate them for each calendar bucket.
const missingSources=['standby-generators','indoor-coverage-area'] as const;
const confirmedOperators=new Set(['mobile','telecom','unicom']);
export function configurationEvidenceGaps(c:ServiceCapture|undefined,isHistory:boolean):readonly string[]{
 return isHistory&&c?.sourceVersion===HISTORY_VERSION&&c.ruleSetVersion==='DEMO-SERVICE-v1'?missingSources:[];
}
export function configurationEvidence(c:ServiceCapture|undefined,isHistory:boolean,sites:ReadonlySet<string>,operators:readonly string[]){
 const gaps=configurationEvidenceGaps(c,isHistory);
 if(!c||!gaps.length)return [];
 const point=Date.parse(c.stockAsOf)-(Date.parse(c.stockAsOf)===Date.parse(c.period.end)?1:0);
 const customers=new Map(c.customers.filter(r=>operators.includes(r.operator)).map(r=>[r.id,r]));
 const metrics=new Map(c.metrics.filter(r=>r.kind==='stock').map(r=>[r.id,r]));
 return c.configurations.flatMap(configuration=>{
  const {id,siteId,customerId,serviceItemId,metricId,from,to,end,sourceRef}=configuration,customer=customers.get(customerId),dimension=metrics.get(metricId);
  if(!customer||!dimension||!sites.has(siteId)||gaps.includes(serviceItemId)||!from||!to||end!=='known'||Date.parse(from)>point||Date.parse(to)<=point)return [];
  const complete=c.configComplete&&configuration.confirmed&&dimension.confirmed&&configuration.ownership==='dedicated'&&!!configuration.agreementVersion&&configuration.ruleVersion===c.ruleSetVersion&&confirmedOperators.has(customer.operator);
  return [{kind:'configuration' as const,id,siteId,customer,service:serviceItemId,serviceItemId,dimension,from,to,sourceRef,
   method:'configuration' as const,state:complete?'complete' as const:'pending' as const,reason:complete?'complete':'configuration_rule_pending',
   quantity:complete?configuration.quantity:null,rawQuantity:configuration.quantity,configuration,stockAsOf:c.stockAsOf,sourceVersion:c.sourceVersion,mappingVersion:c.mappingVersion}];
 });
}
