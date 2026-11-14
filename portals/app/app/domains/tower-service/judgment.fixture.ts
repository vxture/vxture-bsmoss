import {previewSeed} from './preview';
import {evidenceFixture} from './evidence.fixture';
import type {JudgmentMetric} from './judgment';
import type {RuleVersion} from './foundation';
export function judgmentFixture(workspace='t06-test'){
 const state=previewSeed(workspace),snapshot=state.snapshots[0];snapshot.inventory.rows=snapshot.inventory.rows.slice(0,2);snapshot.inventory.expectedSites=2;snapshot.inventory.expectedDevices=snapshot.inventory.rows.flatMap(r=>r.devices).length;
 const fixture=evidenceFixture(snapshot.inventory.rows[0].id);snapshot.inventory.evidence=fixture.capture;snapshot.inventory.tenancy=fixture.tenancy;
 const rule=(metric:JudgmentMetric,patch:Partial<RuleVersion>={}):RuleVersion=>({...structuredClone(fixture.capture.rules[0]),id:'judgment-'+metric,series:'judgment-'+metric,kind:'judgment',state:'active',metering:undefined,judgment:{metric,metricId:null},unit:metric==='metering_gap'?'Wh':['service_change','tenant_site_change'].includes(metric)?'%':metric==='anchor_unknown'?'site':'item',attention:'1',severe:'2',...patch});
 snapshot.inventory.judgmentRules=[rule('metering_gap',{attention:'50',severe:'100'})];
 const context={snapshotId:snapshot.id,compareSnapshotId:null,operator:'all',city:'all',county:'all',businessPeriod:null};return {state,snapshot,fixture,rule,context};
}
