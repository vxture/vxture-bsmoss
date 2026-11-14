import {test} from "node:test";
import assert from "node:assert/strict";
import {selectionFromUrl,selectionHref,legacyAggregationHref} from "./links";
import {taskTime} from "./client";
test("task display accepts PostgreSQL microseconds without changing cursor identity",()=>{
 assert.equal(taskTime("2026-11-09T01:02:03.123456Z"),"2026-11-09 09:02:03");
 assert.equal(taskTime("2026-11-09T09:02:03+08:00"),"2026-11-09 09:02:03");
});
test("task center restores exact received and independent aggregation identities",()=>{
 for(const selection of [{kind:"received",id:null},{kind:"received",id:"a".repeat(64)},{kind:"aggregation",id:null},{kind:"aggregation",id:"source/one?at=hour&metric=bytes"}] as const)assert.deepEqual(selectionFromUrl("https://local"+selectionHref(selection)),selection);
 assert.deepEqual(selectionFromUrl("https://local/operations/data-updates?job=orphan"),{kind:"aggregation",id:"orphan"});
});
test("ambiguous identities and invalid task links cannot select a different task",()=>{
 for(const query of ["task=x","view=unknown","view=received&view=aggregation","job=a&job=b","job=","job=*","job=%00","job=%20a","job="+"a".repeat(2049),"task="+"a".repeat(64)+"&job=x","view=aggregation&task="+"a".repeat(64),"view=received&job=x"])assert.throws(()=>selectionFromUrl("https://local/?"+query));
});
test("retired aggregation page preserves valid deep links and discards duplicate identities",()=>{
 const id="source/one?x=y&z=two";
 assert.equal(legacyAggregationHref({job:id,workspaceId:"other"}),selectionHref({kind:"aggregation",id}));
 for(const params of [{},{job:["one","two"]},{job:"*"}])assert.equal(legacyAggregationHref(params),"/operations/data-updates?view=aggregation");
});
