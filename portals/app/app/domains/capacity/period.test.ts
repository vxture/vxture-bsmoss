import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sumCapacityCounters,capacityTimeBuckets} from './period';
import {capacityObservation,summarizeCapacity} from '../map-demo/capacity-rules';
import {evaluateCapacity} from '../map-demo/topic-rules';

test('period ratios weight original denominators and classify each station once, without merging separate hourly hits',()=>{
 const samples=[{used:95,capacity:100,connected:100,attempts:100},{used:0,capacity:900,connected:846,attempts:900}];
 const before=JSON.stringify(samples),sum=sumCapacityCounters(samples),o=capacityObservation(sum);
 assert.deepEqual(sum,{used:95,capacity:1000,connected:946,attempts:1000});
 assert.equal(o.load,.095);assert.equal(o.connection,.946);assert.equal(o.highLoad,false);assert.equal(o.lowConnection,true);
 assert.equal(evaluateCapacity(sum).level,'critical');
 const total=summarizeCapacity([sum]);assert.equal(total.sites,1);assert.equal(total.attention,1);assert.equal(total.both,0);assert.equal(total.levels.lowConnection.critical,1);
 assert.equal(JSON.stringify(samples),before);
 const empty=sumCapacityCounters([]);assert.equal(capacityObservation(empty).load,null);assert.equal(evaluateCapacity(empty).level,'unknown');
 const partial=sumCapacityCounters([{used:0,capacity:0,connected:94,attempts:100}]);assert.equal(evaluateCapacity(partial).level,'critical');
});

test('time buckets retain actual observations, use hours for hour/day and daily groups for week/month',()=>{
 const times=['2026-10-24T23:00:00','2026-10-25T00:00:00','2026-10-25T01:00:00'];
 assert.deepEqual(capacityTimeBuckets(times,'day').map(b=>b.label),['23','00','01']);
 for(const period of ['week','month'] as const){const buckets=capacityTimeBuckets(times,period);assert.deepEqual(buckets.map(b=>b.label),['10-24','10-25']);assert.deepEqual(buckets.map(b=>b.times.length),[1,2]);assert.deepEqual(buckets.flatMap(b=>b.times),times);}
 assert.deepEqual(capacityTimeBuckets([],'month'),[]);
});
