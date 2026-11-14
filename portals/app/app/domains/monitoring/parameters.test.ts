import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createHash} from "node:crypto";
import {DEFAULT_MONITORING_PARAMETERS as D,defaultMonitoringConfiguration,monitoringParameters,monitoringCommand,readMonitoringConfiguration} from "./parameters.ts";
import {FileMonitoringParameterStore} from "./parameter-store.ts";
import {monitoringParameterService} from "./parameter-service.ts";
import {assessRuntime,reviewRuntime} from "./runtime-rules.ts";
import {monitoringModel} from "../../monitoring/model.ts";
import type {AccessPorts} from "../access/resolve.ts";
test("parameter commands reject non-numeric, incomplete, reversed, equal and forged workspace values",()=>{
 assert.deepEqual(monitoringParameters({...D}),D);
 for(const patch of [{temperatureWarningC:NaN},{temperatureCriticalC:Infinity},{temperatureWarningC:40},{temperatureCriticalC:34},{intensityWarning:0},{intensityCritical:.14},{batteryAttention:1},{intensityCritical:"0.30"},{temperatureWarningC:-274},{other:1}])assert.throws(()=>monitoringParameters({...D,...patch}));
 assert.throws(()=>monitoringParameters({}));assert.throws(()=>monitoringCommand({revision:0,parameters:D,workspaceId:"other"}));assert.throws(()=>monitoringCommand({revision:-1,parameters:D}));
 assert.throws(()=>readMonitoringConfiguration({...defaultMonitoringConfiguration(),revision:1.5}));
 assert.equal(Reflect.set(D,"temperatureWarningC",1),false);
});
test("custom parameters change precise rule boundaries and battery attention while preserving original records",()=>{
 const record={at:"2026-10-25T12:00:00+08:00",power:"battery" as const,temperature:32,energyWh:200,bytes:1073741824};
 const parameters={...D,batteryAttention:false,temperatureWarningC:30,temperatureCriticalC:32,intensityWarning:.20,intensityCritical:.25};
 const before=JSON.stringify(record),result=assessRuntime(record,parameters);
 assert.deepEqual(result.signals.map(s=>[s.kind,s.level,s.threshold]),[["temperature","critical",32],["intensity","warning",.20]]);
 assert.equal(JSON.stringify(record),before);
 const review=reviewRuntime([record],record.at,record.at,null,parameters,"monitoring-parameters-v1/r8");
 assert.equal(review.policy,"monitoring-parameters-v1/r8");assert.equal(review.clues.length,2);assert.equal(review.level,"critical");
});
test("one configuration snapshot drives cohort, regions, facets, row states and detailed context",()=>{
 const original=monitoringModel({city:"610100",county:"610116"});
 const configuration={...defaultMonitoringConfiguration(),revision:4,parameters:{...D,batteryAttention:false,temperatureWarningC:100,temperatureCriticalC:101,intensityWarning:100,intensityCritical:101}};
 const custom=monitoringModel({city:"610100",county:"610116"},configuration);
 assert.equal(custom.monitoring.runtimeSummary.currentAbnormal,0);assert.equal(custom.monitoring.runtimeSummary.periodAbnormal,0);assert.equal(custom.monitoring.runtimeSummary.sites,62);
 assert.ok(custom.monitoring.runtimeSummary.signals.every(s=>s.warning===0&&s.critical===0&&s.monitored===62));
 assert.ok(custom.rows.every(r=>r.monitoring.runtime.level==="normal"&&r.monitoring.runtime.policy.endsWith("r4")));
 assert.equal(custom.monitoring.runtimeFacets.find(r=>r.value==="current")!.count,0);
 assert.deepEqual(custom.rows.find(r=>r.id===original.rows[0].id)?.monitoring.runtime.current?.temperature,original.rows[0].monitoring.runtime.current?.temperature);
 assert.ok(original.monitoring.runtimeSummary.currentAbnormal>0);assert.equal(defaultMonitoringConfiguration().revision,0);
});
test("durable parameter snapshots isolate workspaces, reject concurrent/stale writes and fail closed on corruption",async()=>{
 const root=await mkdtemp(join(tmpdir(),"monitoring-parameters-"));try{
 const store=new FileMonitoringParameterStore(root,"w/../../x");assert.equal((await store.read()).revision,0);
 const saved=await store.update(0,{...D,temperatureWarningC:31},"user",async()=>{});assert.equal(saved.revision,1);assert.equal(saved.updatedBy,"user");
 assert.equal((await new FileMonitoringParameterStore(root,"w/../../x").read()).parameters.temperatureWarningC,31);assert.equal((await new FileMonitoringParameterStore(root,"x").read()).revision,0);
 await assert.rejects(store.update(0,{...D},"user",async()=>{}),/monitoring_revision_conflict/);
 await assert.rejects(store.update(1,{...D},"user",async()=>{throw Error("permission_denied");}),/permission_denied/);assert.equal((await store.read()).revision,1);
 const concurrent=await Promise.allSettled([store.update(1,{...D},"a",async()=>{}),store.update(1,{...D,temperatureWarningC:33},"b",async()=>{})]);assert.equal(concurrent.filter(r=>r.status==="fulfilled").length,1);assert.equal((await store.read()).revision,2);
 const path=join(root,createHash("sha256").update("w/../../x").digest("hex"),"parameters.json");await writeFile(path,"{corrupt");await assert.rejects(store.read());
 }finally{const resolved=join(tmpdir(),root.split(/[\\/]/).at(-1)!);assert.equal(resolved,root);await rm(root,{recursive:true,force:true});}
});
test("independent analysis-rule permissions enforce view/edit, entitlement and commit-time revocation",async()=>{
 const root=await mkdtemp(join(tmpdir(),"monitoring-access-"));try{
 const scope={workspaceId:"w",sourceIds:[],stationIds:[],serviceIds:[],deviceIds:[],metricKeys:[],allowSiteParameters:false};let permissions=["admin.operators.edit","metering.view"];
 const ports:AccessPorts={now:()=>1000,readVerifiedIdentity:async()=>({sub:"user",activeWorkspace:"w",accountStatus:"active",governanceRoles:["workspace:owner"],expiresAt:9000}),readCoverage:async()=>({workspaceId:"w",product:"bsmoss",tier:"test",bundled:false,expiresAt:8000}),readLocalGrant:async()=>({workspaceId:"w",sub:"user",active:true,permissions,scope,expiresAt:8000}),featuresFor:()=>["metering"]};
 const service=monitoringParameterService(ports,w=>new FileMonitoringParameterStore(root,w)),command={revision:0,parameters:D};
 await service.read();await assert.rejects(service.read(true),/permission_denied/);assert.equal(await service.canEdit(),false);await assert.rejects(service.update(command),/permission_denied/);
 permissions=["admin.analysis_rules.view"];await service.read(true);await assert.rejects(service.update(command),/permission_denied/);
 permissions=["admin.analysis_rules.edit"];assert.equal((await service.update(command)).revision,1);
 let reads=0;ports.readLocalGrant=async()=>({workspaceId:"w",sub:"user",active:true,permissions:++reads===1?["admin.analysis_rules.edit"]:[],scope,expiresAt:8000});await assert.rejects(service.update({...command,revision:1}),/permission_denied/);assert.equal((await new FileMonitoringParameterStore(root,"w").read()).revision,1);
 ports.featuresFor=()=>[];await assert.rejects(service.update({...command,revision:1}),/feature_denied/);
 }finally{const resolved=join(tmpdir(),root.split(/[\\/]/).at(-1)!);assert.equal(resolved,root);await rm(root,{recursive:true,force:true});}
});
