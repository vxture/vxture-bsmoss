import {test} from "node:test";
import assert from "node:assert/strict";
import {sourceManagement} from "./source-service.ts";
import {sourceQuery,sourceRecord,sourceSummary,decodeAuditCursor,encodeAuditCursor} from "./source-rules.ts";
import {fingerprintOf} from "../aggregation/intervals.ts";
import type {AccessPorts,VerifiedIdentity} from "../access/resolve.ts";
import type {SourceReader} from "./source-reader.ts";
function fixture(){
 const scope={workspaceId:"w",sourceIds:["s"],stationIds:["st"],serviceIds:["svc"],deviceIds:["d"],metricKeys:["m"],allowSiteParameters:false};
 let identity:VerifiedIdentity|null={sub:"u",activeWorkspace:"w",accountStatus:"active",governanceRoles:[],expiresAt:5000},clock=1000,reads=0,after=()=>{};
 const grant={workspaceId:"w",sub:"u",active:true,permissions:["admin.sources.view","admin.configuration_audit.view"],scope,expiresAt:4000};
 const ports:AccessPorts={now:()=>clock,readVerifiedIdentity:async()=>identity,readCoverage:async()=>({workspaceId:"w",product:"bsmoss",tier:"test",bundled:false,expiresAt:5000}),readLocalGrant:async()=>grant,featuresFor:()=>["metering"]};
 const reader:SourceReader={workspaceId:"w",list:async()=>{reads++;after();return {items:[],next:null,capturedAt:"2026-11-06Z"};},read:async()=>{reads++;after();return null;}};
 return {scope,grant,ports,reader,service:sourceManagement(ports,{create:()=>reader}),get reads(){return reads;},after:(f:()=>void)=>after=f,identity:(v:VerifiedIdentity|null)=>identity=v,expire:()=>clock=6000};
}
test("source queries reject unbounded, duplicate, forged-scope and malformed exact revision input",async()=>{
 for(const q of ["workspace=w","search=*","search=%00","status=inactive","limit=51","limit=01","status=all&status=active","after="])assert.throws(()=>sourceQuery(new URLSearchParams(q)),/invalid_management_query/);
 assert.throws(()=>sourceQuery(new URLSearchParams("after=forged"),true),/invalid_management_query/);
 const f=fixture();for(const q of ["","revision=1&revision=2","revision=1e2","revision=01","revision=0","revision=1&scope=w"])await assert.rejects(f.service.read("id",new URLSearchParams(q),true),/invalid_management_query/);
 await assert.rejects(f.service.read("id",new URLSearchParams("revision=1")),/invalid_management_query/);
});
test("audit cursors preserve microseconds and numeric revisions beyond safe integer",()=>{
 const c={at:"2026-11-06T00:00:00.123456Z",id:"binding",revision:"9007199254740993"};assert.deepEqual(decodeAuditCursor(encodeAuditCursor(c)),c);
 for(const patch of [{at:"2026-02-30T00:00:00.000001Z"},{revision:"0"},{id:"*"},{extra:true}])assert.throws(()=>encodeAuditCursor({...c,...patch}),/invalid_management_query/);
});
test("source inspection and audit are independent and owner has no implicit management grant",async()=>{
 for(const permission of ["metering.view","admin.sources.view","admin.configuration_audit.view"]){const f=fixture();f.grant.permissions=[permission];f.identity({sub:"u",activeWorkspace:"w",accountStatus:"active",governanceRoles:["workspace:owner"],expiresAt:5000});
  for(const audit of [false,true]){if(permission===(audit?"admin.configuration_audit.view":"admin.sources.view"))await f.service.list(new URLSearchParams(),audit);else await assert.rejects(f.service.list(new URLSearchParams(),audit),/permission_denied/);}
 }
});
test("identity and entitlement gates precede parsing and machines cannot read management",async()=>{
 const f=fixture();f.identity(null);await assert.rejects(f.service.list(new URLSearchParams("scope=x")),/identity_required/);assert.equal(f.reads,0);
 const g=fixture();g.ports.featuresFor=()=>[];await assert.rejects(g.service.list(new URLSearchParams()),/feature_denied/);assert.equal(g.reads,0);
 const h=fixture();h.identity({kind:"service",sub:"s2s:bsmoss",callerProduct:"bsmoss",activeWorkspace:"w",expiresAt:5000,tokenId:"test"});await assert.rejects(h.service.list(new URLSearchParams(),true),/permission_denied/);assert.equal(h.reads,0);
});
test("empty and unavailable records revalidate permissions, full scope, subject and expiry",async()=>{
 for(const audit of [false,true])for(const read of [false,true])for(const mutation of [(f:ReturnType<typeof fixture>)=>{f.grant.permissions=[];},(f:ReturnType<typeof fixture>)=>f.scope.deviceIds.push("outside"),(f:ReturnType<typeof fixture>)=>f.expire(),(f:ReturnType<typeof fixture>)=>f.identity({sub:"other",activeWorkspace:"w",accountStatus:"active",governanceRoles:[],expiresAt:5000})]){
  const f=fixture();f.after(()=>mutation(f));await assert.rejects(read?f.service.read("id",new URLSearchParams(audit?"revision=1":""),audit):f.service.list(new URLSearchParams(),audit),/permission_denied|access_expired/);
 }
 const f=fixture();await assert.rejects(f.service.read("id",new URLSearchParams()),/source_configuration_unavailable/);
});
test("registration projection checks complete scope, immutable digest and paused versions without leaking bindings in list",()=>{
 const f=fixture(),binding={id:"binding",revision:"1",sourceId:"s",adapterVersion:"v1",transformVersion:"t1",coverageStart:"2026-01-01T00:00:00.000Z",scope:f.scope};
 const row={binding,id:binding.id,revision:"1",source_id:"s",workspace_id:"w",binding_sha256:fingerprintOf(binding),valid:true,status:"paused",review_ref:"review-1",database_actor:"fixture-dba",recorded_cursor:"2026-11-06T00:00:00.000001Z"};
 const record=sourceRecord(row,f.scope);assert.equal(record.status,"paused");assert.equal(record.databaseActor,"fixture-dba");assert.ok(!Object.hasOwn(sourceSummary(record),"binding"));assert.ok(!Object.hasOwn(sourceSummary(record),"reviewRef"));
 for(const dim of ["sourceIds","stationIds","serviceIds","deviceIds","metricKeys"] as const)assert.throws(()=>sourceRecord(row,{...f.scope,[dim]:[]}),/report_scope_denied/);
 for(const patch of [{binding_sha256:"0".repeat(64)},{valid:false},{revision:"2"},{workspace_id:"foreign"}])assert.throws(()=>sourceRecord({...row,...patch},f.scope),/invalid_source_registration/);
});
test("source reader failures are never converted to an empty success",async()=>{const f=fixture();f.reader.list=async()=>{throw Error("sql_failure");};await assert.rejects(f.service.list(new URLSearchParams()),/sql_failure/);});
