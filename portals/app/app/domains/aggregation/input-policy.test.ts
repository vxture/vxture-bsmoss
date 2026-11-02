import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveIntervalInputPolicy} from './input-policy.ts';
import {FIRST_METRICS} from '../catalog/first-metrics.ts';
import {refKey} from '../catalog/registry.ts';
const keys=FIRST_METRICS.list().map(refKey),total={code:'service.data.total_bytes',version:1},rate={code:'status.voice.connection_rate',version:1};
test('derived total uses exactly dictionary-owned directional dependencies and needs all three grants',()=>{
 const result=resolveIntervalInputPolicy(total,'day','dependencies',keys);
 assert.deepEqual(result.refs,[{code:'service.data.uplink_bytes',version:1},{code:'service.data.downlink_bytes',version:1}]);
 for(const key of [refKey(total),...result.refs.map(refKey)])assert.throws(()=>resolveIntervalInputPolicy(total,'day','dependencies',keys.filter(k=>k!==key)),/scope_denied/);
 result.refs[0].code='changed';assert.equal(resolveIntervalInputPolicy(total,'day','dependencies',keys).refs[0].code,'service.data.uplink_bytes');
 assert.throws(()=>resolveIntervalInputPolicy(total,'day','direct',keys),/dependency_policy_required/);
});
test('connection ratio can use reviewed direct parts or numerator/denominator dependencies without auto-mixing',()=>{
 assert.deepEqual(resolveIntervalInputPolicy(rate,'week','direct',[refKey(rate)]).refs,[rate]);
 const refs=resolveIntervalInputPolicy(rate,'week','dependencies',keys).refs;
 assert.deepEqual(refs.map(refKey),['service.voice.connected_count@1','service.voice.attempt_count@1']);
 assert.throws(()=>resolveIntervalInputPolicy(rate,'week','dependencies',[refKey(rate)]),/dependency_scope_denied/);
 assert.throws(()=>resolveIntervalInputPolicy(rate,'week','auto',keys),/policy_required/);
});
test('unsupported dependencies, invalid versions, state metrics and grains fail closed',()=>{
 const up={code:'service.data.uplink_bytes',version:1};
 assert.throws(()=>resolveIntervalInputPolicy(up,'hour','dependencies',keys),/unsupported_dependency/);
 for(const ref of [{...up,version:0},{...up,version:NaN},{code:'runtime.device.state',version:1}])assert.throws(()=>resolveIntervalInputPolicy(ref,'hour','direct',keys),/unsupported_aggregate_metric/);
 assert.throws(()=>resolveIntervalInputPolicy(up,'year' as 'day','direct',keys),/unsupported_aggregate_metric/);
});
