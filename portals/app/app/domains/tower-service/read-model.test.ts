import {test} from "node:test";
import assert from "node:assert/strict";
import {previewInventory,previewAccess} from "./preview";
import {generateHistory,buildHistoryRollups,historyAggregate,historyScope} from "./history";
import {historyId} from "./history-calendar";
test("published temporal tables reconcile flows, end stocks and distinct coverage",()=>{
 const base=previewInventory();base.rows=base.rows.slice(0,12);
 const raw=generateHistory(base),published={...raw,rollups:buildHistoryRollups(raw)},scope=historyScope(raw,previewAccess("test"),Date.now());
 for(const grain of ["day","week","month","year"] as const)for(const date of ["2024-11-01","2026-10-21"]){
  const id=historyId(grain,date);
  for(const metric of raw.metrics)for(const region of [{city:"all",county:"all",operator:"all"},{city:raw.sites[0].city,county:raw.sites[0].county,operator:"mobile"}])
   assert.deepEqual(historyAggregate(published,id,metric.id,scope,region),historyAggregate(raw,id,metric.id,scope,region));
 }
 const restricted={...scope,siteIds:new Set([raw.sites[0].id])};
 assert.deepEqual(historyAggregate(published,historyId("month","2026-10-01"),"supplied-energy",restricted,{city:"all",county:"all"}),historyAggregate(raw,historyId("month","2026-10-01"),"supplied-energy",restricted,{city:"all",county:"all"}));
});
