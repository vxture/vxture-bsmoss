import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GIB} from '../map-demo/rules';
import {energyObservation,summarizeEnergy,intensityLevel} from './rules';
const p={intensityWarning:0.15,intensityCritical:0.3};
test('energy pairs raw observations before rollups; missing energy is neither zero nor denominator traffic',()=>{
 const a=energyObservation([{energyWh:1000,bytes:GIB},{energyWh:null,bytes:100*GIB}],p);
 const b=energyObservation([{energyWh:1000,bytes:9*GIB}],p),total=summarizeEnergy([a,b]);
 assert.equal(a.energyWh,1000);assert.equal(a.bytes,101*GIB);assert.equal(a.pairedBytes,GIB);assert.equal(a.intensity,1);assert.equal(a.missing,1);
 assert.equal(total.intensity,0.2);assert.notEqual(total.intensity,(a.intensity!+b.intensity!)/2);assert.equal(total.bytes,110*GIB);assert.equal(total.pairedBytes,10*GIB);
 assert.equal(total.sites,2);assert.equal(total.observed,2);assert.equal(total.expected,3);assert.equal(total.missing,1);assert.equal(total.critical,1);
});
test('unknown, measured zero, zero traffic and threshold equality remain distinct',()=>{
 const unknown=energyObservation([{energyWh:null,bytes:GIB}],p),zero=energyObservation([{energyWh:0,bytes:GIB}],p),idle=energyObservation([{energyWh:2000,bytes:0}],p);
 assert.equal(unknown.energyWh,null);assert.equal(unknown.level,'unknown');assert.equal(unknown.zeroTraffic,false);
 assert.equal(zero.energyWh,0);assert.equal(zero.intensity,0);assert.equal(zero.level,'normal');
 assert.equal(idle.intensity,null);assert.equal(idle.zeroTraffic,true);assert.equal(idle.level,'unknown');
 const empty=summarizeEnergy([unknown]);assert.equal(empty.energyWh,null);assert.equal(empty.intensity,null);
 assert.equal(intensityLevel(.15,p),'warning');assert.equal(intensityLevel(.3,p),'critical');assert.equal(intensityLevel(.149,p),'normal');
 assert.equal(intensityLevel(.3,{intensityWarning:1,intensityCritical:2}),'normal');
});

test('zero traffic and wholly missing energy stay outside severity distribution; partial records can have severity',()=>{
 const partial=energyObservation([{energyWh:300,bytes:GIB},{energyWh:null,bytes:GIB}],p);
 const normal=energyObservation([{energyWh:100,bytes:GIB}],p),idle=energyObservation([{energyWh:100,bytes:0}],p),missing=energyObservation([{energyWh:null,bytes:GIB}],p);
 const total=summarizeEnergy([partial,normal,idle,missing]);
 assert.equal(total.sites,4);assert.equal(total.evaluable,2);assert.equal(total.critical,1);assert.equal(total.warning,0);assert.equal(total.evaluable-total.warning-total.critical,1);
 assert.equal(total.zeroTraffic,1);assert.equal(total.missing,2);assert.equal(partial.level,'critical');
});
