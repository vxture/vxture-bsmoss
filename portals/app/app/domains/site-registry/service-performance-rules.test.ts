import {test} from 'node:test';
import assert from 'node:assert/strict';
import {summarizePhysicalObservations,confirmedServiceImpact,type PhysicalServiceObservation,type ConfirmedImpactEvent,type ImpactServiceValidity} from './service-performance-rules';
const at=(hour:number)=>'2026-10-25T'+String(hour).padStart(2,'0')+':00:00+08:00',window={start:at(0),end:at(23)};
const record:PhysicalServiceObservation={id:'a/00',siteId:'a',start:at(0),end:at(1),energyWh:'1000',power:'battery'};
test('stage3 energy exactness, duplicate identity and unknown versus reliable zero',()=>{
 const total=summarizePhysicalObservations([record,record,{...record,id:'b/00',siteId:'b',energyWh:'9007199254740993'}],window);
 assert.equal(total.observedEnergyWh,'9007199254741993');assert.equal(total.energyRecords,2);assert.equal(total.batterySites,2);
 assert.equal(summarizePhysicalObservations([{...record,energyWh:'0'}],window).observedEnergyWh,'0');
 const missing=summarizePhysicalObservations([{...record,energyWh:null,power:null}],window);assert.equal(missing.observedEnergyWh,null);assert.equal(missing.batterySites,0);assert.equal(missing.missingEnergyRecords,1);
 assert.equal(summarizePhysicalObservations([],window).observedEnergyWh,null);
});
test('stage3 overlapping meters and conflicting records cannot double physical energy',()=>{
 assert.throws(()=>summarizePhysicalObservations([record,{...record,id:'different',start:at(0),end:at(2)}],window),/overlapping_physical_observation/);
 assert.throws(()=>summarizePhysicalObservations([record,{...record,energyWh:'2'}],window),/conflicting_observation/);
 assert.throws(()=>summarizePhysicalObservations([{...record,energyWh:'1.5'}],window),/invalid_physical_observation/);
 assert.throws(()=>summarizePhysicalObservations([{...record,start:at(0),end:at(2)}],{start:at(1),end:at(3)}),/unclipped_energy_interval/);
 assert.equal(summarizePhysicalObservations([{...record,start:at(22),end:at(23)}],{start:at(0),end:at(22)}).energyRecords,0);
});
const validity:ImpactServiceValidity[]=[{siteId:'a',serviceItemId:'s1',from:at(1),to:at(10)},{siteId:'a',serviceItemId:'s2',from:at(3),to:null}];
const event:ConfirmedImpactEvent={id:'e1',start:at(0),end:at(8),confirmation:'confirmed',targets:[{siteId:'a',serviceItemId:'s1'},{siteId:'a',serviceItemId:'s2'}]};
test('stage3 confirmed impact clips to service validity and unions site and service intervals separately',()=>{
 const impact=confirmedServiceImpact([event,event,{...event,id:'e2',start:at(6),end:at(12)}],validity,window,at(23));
 assert.equal(impact.events,2);assert.equal(impact.sites,1);assert.equal(impact.services,2);
 assert.equal(impact.siteMilliseconds,String(11*3600000));assert.equal(impact.serviceMilliseconds,String(18*3600000));
});
test('stage3 unknown event feed differs from zero and reported or unmapped events are not confirmed impact',()=>{
 assert.equal(confirmedServiceImpact(null,validity,window,at(23)).events,null);
 assert.equal(confirmedServiceImpact([event],null,window,at(23)).events,null);
 assert.equal(confirmedServiceImpact([],validity,window,at(23)).events,0);
 assert.equal(confirmedServiceImpact([{...event,confirmation:'reported'}],validity,window,at(23)).events,0);
 assert.equal(confirmedServiceImpact([event],[],window,at(23)).events,0);
 const open=confirmedServiceImpact([{...event,end:null}],validity,window,at(5));assert.equal(open.siteMilliseconds,String(4*3600000));assert.equal(open.serviceMilliseconds,String(6*3600000));
 assert.equal(confirmedServiceImpact([{...event,start:at(23),end:null}],validity,window,at(23)).events,0);
 assert.throws(()=>confirmedServiceImpact([event,{...event,end:at(9)}],validity,window,at(23)),/conflicting_impact_event/);
});
