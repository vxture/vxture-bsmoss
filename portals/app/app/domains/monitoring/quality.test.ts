import {test} from 'node:test';
import assert from 'node:assert/strict';
import {serviceQuality,qualityMetricScore,QUALITY_DIMENSIONS,type QualityInput} from './quality';
import {demoQuality} from './quality-demo';
import {DEMO_SITES} from '../map-demo/resources';
const input=()=>Object.fromEntries(QUALITY_DIMENSIONS.map(id=>[id,{expectedSeconds:1000000,observedSeconds:1000000,badSeconds:0,applicable:true,complete:true,source:'test'}])) as QualityInput;
test('quality distinguishes no fault, missing evidence and non-applicability',()=>{
 const rows=input();assert.equal(serviceQuality(rows).score,10000);
 rows.power.observedSeconds=949999;assert.equal(serviceQuality(rows).score,null);
 rows.power.observedSeconds=950000;assert.equal(serviceQuality(rows).score,10000);
 rows.backup.complete=false;assert.equal(serviceQuality(rows).score,null);
 rows.backup.applicable=false;assert.equal(serviceQuality(rows).score,10000);
});
test('quality curves retain boundary values and severe incidents cap the result',()=>{
 assert.equal(qualityMetricScore('power',500,1000000),9000);
 assert.equal(qualityMetricScore('power',2000,1000000),6000);
 assert.equal(qualityMetricScore('power',10000,1000000),0);
 assert.equal(serviceQuality(input(),true).score,5900);
 const rows=input();rows.power.badSeconds=-1;assert.throws(()=>serviceQuality(rows),/invalid_quality/);
});
test('demo observations produce reproducible auditable scores without a target-score input',()=>{
 for(const site of DEMO_SITES){
  const result=demoQuality(site,'2026-10');
  assert.deepEqual(result,demoQuality(site,'2026-10'));
  assert.ok(result.score===null||result.score>=0&&result.score<=10000);
  assert.ok(result.dimensions.every(d=>d.source.includes(site.id)));
 }
});
