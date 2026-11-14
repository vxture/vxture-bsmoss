import {test} from "node:test";
import assert from "node:assert/strict";
import {dictionaryRows,dictionaryView,metricUnit} from "./model";
import {CLASSIFICATIONS,filterDefinitions} from "../../domains/business-parameters/catalog";
import {FIRST_METRICS} from "../../domains/catalog/first-metrics";

test("dictionary sections preserve all versioned definitions and reject ambiguous section input",()=>{
 assert.equal(dictionaryRows("classifications","").length,CLASSIFICATIONS.length);
 assert.equal(dictionaryRows("metrics","").length,FIRST_METRICS.list().length);
 assert.equal(dictionaryView("metrics"),"metrics");
 for(const value of [undefined,"unknown",["metrics","classifications"]])assert.equal(dictionaryView(value),"classifications");
 for(const view of ["classifications","metrics"] as const){const rows=dictionaryRows(view,"");assert.equal(new Set(rows.map(row=>row.id)).size,rows.length);}
});

test("classification search retains boundary and applicability matches with conjunctive category filters",()=>{
 for(const [search,group] of [["","scene"],["shared","scene"],["ground","sharing"],["\u670d\u52a1 \u6709\u6548\u671f","sharing"]]){
  assert.deepEqual(dictionaryRows("classifications",search,group).map(row=>row.definition),filterDefinitions(CLASSIFICATIONS,search,group));
 }
});

test("metric search finds display units and dependency codes without mixing measurement semantics",()=>{
 const before=JSON.stringify(FIRST_METRICS.list());
 assert.deepEqual(dictionaryRows("metrics"," TOTAL_BYTES  GiB ","business_service").map(row=>row.code),["service.data.total_bytes"]);
 assert.equal(dictionaryRows("metrics","total_bytes","runtime_parameter").length,0);
 assert.ok(dictionaryRows("metrics","uplink_bytes","business_service").some(row=>row.code==="service.data.total_bytes"));
 const sms=FIRST_METRICS.list().find(row=>row.code==="service.sms.success_count")!;
 const calls=FIRST_METRICS.list().find(row=>row.code==="service.voice.connected_count")!;
 assert.equal(metricUnit(sms,"count"),"\u6761");assert.equal(metricUnit(calls,"count"),"\u6b21");
 assert.equal(JSON.stringify(FIRST_METRICS.list()),before);
});
