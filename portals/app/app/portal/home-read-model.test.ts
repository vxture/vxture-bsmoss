import {test} from "node:test";
import assert from "node:assert/strict";
import {readHomeSummary} from "./home-read-model";
import {portalDemoSummary} from "./demo";
import {DEMO_REGION} from "../domains/map-demo/resources";
test("published home counters conserve the legacy physical-site boundary",()=>{
 for(const scope of [{city:"all",county:"all"},{city:DEMO_REGION.cities[0].id,county:"all"},{city:DEMO_REGION.counties[0].cityId,county:DEMO_REGION.counties[0].id}]){
  const actual=readHomeSummary(scope).demo,expected=portalDemoSummary({...scope,reportPeriod:"month"});
  assert.equal(actual.usage.physicalSites,expected.usage.physicalSites);
  assert.equal(actual.usage.sharedSites,expected.usage.sharedSites);
  assert.equal(actual.occupiedSites,expected.occupiedSites);
  assert.equal(actual.report.energyWh,expected.report.energyWh);
 }
 assert.throws(()=>readHomeSummary({city:"unknown"}),/invalid_/);
});
