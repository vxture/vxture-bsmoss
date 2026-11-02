import {FIRST_METRICS} from '../catalog/first-metrics.ts';
import {refKey,type Grain,type MetricRef} from '../catalog/registry.ts';

// Product-owned policy. A request cannot choose inputMode or grant dependencies.
export function resolveIntervalInputPolicy(target:MetricRef,grain:Grain,inputMode:unknown,metricKeys:readonly string[]):{inputMode:'direct'|'dependencies';refs:MetricRef[]}{
  const metric=FIRST_METRICS.get(target);
  if(!Number.isSafeInteger(target.version)||!metric||metric.lifecycle==='retired'||
    !['interval_delta','derived','ratio'].includes(metric.semantic)||!metric.grains.includes(grain))throw Error('unsupported_aggregate_metric');
  if(!metricKeys.includes(refKey(target)))throw Error('aggregate_scope_denied');
  if(inputMode!=='direct'&&inputMode!=='dependencies')throw Error('aggregate_policy_required');
  if(inputMode==='direct'&&metric.semantic==='derived')throw Error('aggregate_dependency_policy_required');
  const refs=inputMode==='dependencies'?metric.dependencies:[target];
  if(inputMode==='dependencies'&&(refs.length!==2||refs.some(ref=>{
    const dependency=FIRST_METRICS.get(ref);
    return !dependency||dependency.lifecycle==='retired'||dependency.semantic!=='interval_delta'||!dependency.grains.includes(grain);
  })))throw Error('unsupported_dependency');
  for(const ref of refs)if(!metricKeys.includes(refKey(ref)))throw Error('aggregate_dependency_scope_denied');
  return {inputMode,refs:refs.map(ref=>({...ref}))};
}
