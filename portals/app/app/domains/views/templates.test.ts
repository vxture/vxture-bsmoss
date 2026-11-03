import { test } from "node:test";
import assert from "node:assert/strict";
import { fingerprintOf } from "../aggregation/intervals.ts";
import { templateCandidate, templatePublication, templateSelection } from "./templates.ts";
import { templateHttpError, templateSearch } from "./templates-http.ts";
import { reportCommand } from "../reports/http.ts";
const panel = { id: "usage", category: "business_service" as const, metricRef: { code: "service.data.uplink_bytes", version: 1 }, view: "card" as const, grain: "day" as const, displayUnit: "B", precision: 2, order: 0, visible: false };
const candidate = { kind: "page" as const, definition: { schema: "analysis-template-v1" as const, title: "Review", panels: [panel], bindings: [{panelId: "usage", kind: "not_connected" as const}] } };
const command = { commandId: "command", templateCode: "reviewed", expectedVersion: null, candidate, candidateSha256: fingerprintOf(candidate), validationSha256: "a".repeat(64), reviewRef: "review://fixture" };
test("template candidates retain hidden bindings and normalize deterministic page and report panel order", () => {
  const c = templateCandidate(candidate); assert.deepEqual(c, candidate); assert.equal(c.definition.panels[0]!.visible, false);
  const second = { ...panel, id: "second", order: -1 }, unsorted = { ...candidate, definition: { ...candidate.definition, panels: [panel, second], bindings: [...candidate.definition.bindings, {panelId: "second", kind: "not_connected" as const}] } };
  assert.deepEqual(templateCandidate(unsorted).definition.panels.map(p => p.id), ["second", "usage"]);
  const report = templateCandidate({kind: "report", definition: {...candidate.definition, schema: "periodic-report-template-v1", grain: "day"}});
  assert.equal(report.kind, "report"); assert.throws(() => templateCandidate({...candidate,kind: "role" as any}));
  assert.throws(() => templateCandidate({...candidate,definition: {...candidate.definition,panels: [{...panel,displayUnit: "kWh"}]}}));
  assert.equal(candidate.definition.panels[0]!.order, 0);
});
test("template publication binds exact normalized candidate hash, finite version and explicit review reference", () => {
  assert.deepEqual(templatePublication(command), command);
  for (const patch of [{candidateSha256:"b".repeat(64)},{expectedVersion:0},{expectedVersion:Number.MAX_SAFE_INTEGER},{reviewRef:""},{workspaceId:"forged"},{candidate:{...candidate,definition:{...candidate.definition,title:"Changed"}}}]) assert.throws(() => templatePublication({...command,...patch} as any));
});
test("template selection accepts only the default page pointer with exact CAS revision and historical target", () => {
  const c = {commandId:"selection",scopeKey:"analysis:default" as const,templateCode:"reviewed",templateVersion:1,templateSha256:"a".repeat(64),validationSha256:"b".repeat(64),expected:null,reviewRef:"fixture"};
  assert.deepEqual(templateSelection(c), c);
  assert.equal(templateSelection({...c,expected:{revision:"4",code:"old",version:2,sha256:"c".repeat(64)}}).expected!.revision,"4");
  for (const patch of [{scopeKey:"role:admin"},{templateVersion:1.5},{expected:{}},{expected:{revision:"01",code:"old",version:2,sha256:"c".repeat(64)}}]) assert.throws(() => templateSelection({...c,...patch} as any));
});
test("template query rejects caller workspace, duplicate fields, imprecise numbers and unsupported selection scopes", () => {
  assert.deepEqual(templateSearch(new URLSearchParams("code=page&version=2")),{code:"page",version:2});
  for(const s of ["", "code=x&workspaceId=w", "code=x&code=y", "code=x&version=01", "code=x&version=9007199254740993", "code=x&version=1e2"]) assert.throws(()=>templateSearch(new URLSearchParams(s)));
  assert.equal(templateHttpError(Error("template_validation_changed")).status,409); assert.equal(templateHttpError(Error("invalid_template_evidence")).status,503);
  assert.equal(templateHttpError(Error("template_binding_unavailable")).status,404);
});
test("template commands retain configured origin, actual body limit and private conflict responses", async () => {
  let writes=0; const session={enabled:true,sid:"opaque",appOrigin:"https://bsmoss.example"};
  const request=(body:string,origin=session.appOrigin)=>new Request(session.appOrigin+"/api/templates",{method:"POST",headers:{origin,"content-type":"application/json"},body});
  const run=(r:Request)=>reportCommand(r,session,templatePublication,async()=>{writes++;throw Error("template_revision_conflict");},200,templateHttpError);
  assert.equal((await run(request(JSON.stringify(command),"https://other.example"))).status,403); assert.equal((await run(request(" ".repeat(16385)))).status,413); assert.equal(writes,0);
  const r=await run(request(JSON.stringify(command))); assert.equal(r.status,409); assert.equal(r.headers.get("cache-control"),"no-store"); assert.equal(writes,1);
});
