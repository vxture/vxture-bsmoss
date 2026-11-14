import type {QueryInput} from '../domains/tower-service/query';

// Legacy evidence links retain their historical scope in the configuration tool.
export function ruleComparisonHref(input:QueryInput={},frozen=false){
 const query=new URLSearchParams({view:'agreements',tool:'compare'});
 if(frozen)query.set('source','snapshot');
 for(const key of ['snapshotId','operator','city','county','dimension','service','ruleA','ruleB']){
  const value=input[key];if(typeof value==='string'&&value.length<=160)query.set(key,value);
 }
 return '/tower-service/rules?'+query;
}
