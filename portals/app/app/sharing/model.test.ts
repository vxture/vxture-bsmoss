import {test} from "node:test";
import assert from "node:assert/strict";
import {sharingSummary} from "../domains/sharing/rules";
import {sharingModel} from "./model";

test("sharing deduplicates physical stations/providers and excludes tower and empty stations",()=>{
 const summary=sharingSummary([
  {id:"a",allOperators:["tower","mobile","mobile"]},
  {id:"a",allOperators:["telecom"]},
  {id:"b",allOperators:["tower","mobile"]},
  {id:"c",allOperators:["mobile","telecom","provider_custom"]},
  {id:"empty",allOperators:["tower",""]},
 ]);
 assert.equal(summary.occupiedSites,3);assert.equal(summary.sharedSites,2);
 assert.equal(summary.relationships,6);assert.equal(summary.sharingRate,2/3);assert.equal(summary.averageTenants,2);
 assert.deepEqual(summary.distribution.map(item=>item.sites),[1,1,1]);
 assert.equal(sharingSummary([]).sharingRate,null);assert.equal(sharingSummary([]).averageTenants,null);
});
test("table filters do not change cohort sharing metrics or regional denominators",()=>{
 const baseline=sharingModel({city:"610100"});
 for(const filter of [{operatorCount:"5"},{search:"NO_SUCH_STATION"},{pageSize:"10",page:"2"}]){
  const selected=sharingModel({city:"610100",...filter});
  assert.deepEqual(selected.sharing,baseline.sharing);
  assert.equal(selected.summary.sites,baseline.summary.sites);
 }
 const empty=sharingModel({city:"610100",search:"NO_SUCH_STATION"});
 assert.equal(empty.rows.length,0);assert.ok(empty.sharing.occupiedSites>0);
});
test("province/city/county sharing totals reconcile, operator scope preserves full tenancy",()=>{
 const province=sharingModel({});
 assert.equal(province.sharing.regions.reduce((sum,row)=>sum+row.occupiedSites,0),province.sharing.occupiedSites);
 assert.equal(province.sharing.regions.reduce((sum,row)=>sum+row.sharedSites,0),province.sharing.sharedSites);
 assert.equal(province.sharing.distribution.reduce((sum,row)=>sum+row.sites,0),province.sharing.occupiedSites);
 const city=sharingModel({city:"610100"});
 assert.equal(city.sharing.regions.reduce((sum,row)=>sum+row.occupiedSites,0),city.sharing.occupiedSites);
 const county=sharingModel({city:"610100",county:"610116",operator:"unicom"});
 assert.equal(county.sharing.regions.length,0);
 assert.ok(county.rows.every(row=>row.allOperators.includes("unicom")));
 assert.equal(county.sharing.relationships,county.rows.reduce((sum,row)=>sum+row.allOperators.length,0));
 assert.ok(county.sharing.averageTenants!>1);
 assert.throws(()=>sharingModel({city:"610100",county:"611002"}));
 assert.throws(()=>sharingModel({operator:"tower"}));
 assert.throws(()=>sharingModel({operatorCount:"6"}));
});
