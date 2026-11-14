import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createHash} from "node:crypto";
import {DEFAULT_CAPACITY_PARAMETERS as D,defaultCapacityConfiguration,capacityParameters,capacityCommand,readCapacityConfiguration,capacityMetricLevel} from "./parameters.ts";
import {FileCapacityParameterStore} from "./parameter-store.ts";
import {capacityParameterService} from "./parameter-service.ts";
import {capacityModel} from "../../capacity/model.ts";
import {capacityMetricClass} from "../../capacity/labels.ts";
import {evaluateTopic} from "../map-demo/topic-rules.ts";
import {capacityObservation,summarizeCapacity} from "../map-demo/capacity-rules.ts";
import {DEMO_SITES} from "../map-demo/resources.ts";
import {siteHour} from "../map-demo/rules.ts";
import type {AccessPorts} from "../access/resolve.ts";

test("capacity parameters reject invalid types, bounds, severity direction and forged commands",()=>{
 assert.deepEqual(capacityParameters({...D}),D);
 for(const patch of [{loadWarningPct:NaN},{loadCriticalPct:Infinity},{loadWarningPct:95},{loadWarningPct:96},{loadCriticalPct:84},{connectionCriticalPct:98},{connectionWarningPct:94},{connectionCriticalPct:0},{loadWarningPct:-1},{loadCriticalPct:101},{connectionWarningPct:"98"},{other:1}])assert.throws(()=>capacityParameters({...D,...patch}));
 assert.throws(()=>capacityParameters({}));assert.throws(()=>capacityCommand({revision:0,parameters:D,workspaceId:"other"}));assert.throws(()=>capacityCommand({revision:-1,parameters:D}));assert.throws(()=>readCapacityConfiguration({...defaultCapacityConfiguration(),revision:1.5}));
 assert.deepEqual(capacityParameters({...D,loadWarningPct:85.01,connectionWarningPct:98.01}),{...D,loadWarningPct:85.01,connectionWarningPct:98.01});
 assert.equal(Reflect.set(D,"loadWarningPct",1),false);
});

test("custom thresholds share exact severity and colors while preserving raw observations",()=>{
 const raw={...siteHour(DEMO_SITES[0],12,"all"),used:300,capacity:1000,connected:970,attempts:1000};const before=JSON.stringify(raw);
 const p={loadWarningPct:30,loadCriticalPct:50,connectionWarningPct:99,connectionCriticalPct:97};
 assert.equal(evaluateTopic("capacity",raw,p).level,"warning");assert.equal(capacityMetricLevel(.97,"connection",p),"warning");assert.equal(capacityMetricLevel(.9699,"connection",p),"critical");
 assert.equal(capacityMetricClass(.97,"connection",p),"site-analysis-tone-warning");assert.equal(capacityMetricClass(.9699,"connection",p),"site-analysis-tone-critical");
 const o=capacityObservation(raw,p);assert.equal(o.highLoad,true);assert.equal(o.lowConnection,true);
 assert.deepEqual(summarizeCapacity([raw],p).levels,{highLoad:{warning:1,critical:0},lowConnection:{warning:1,critical:0},both:{warning:1,critical:0},attention:{warning:1,critical:0}});
 assert.equal(JSON.stringify(raw),before);
});

test("one saved snapshot recalculates all capacity summaries, signals, facets, regions and detail hours",()=>{
 const original=capacityModel({});
 const configuration={...defaultCapacityConfiguration(),revision:4,parameters:{loadWarningPct:10,loadCriticalPct:20,connectionWarningPct:1.1,connectionCriticalPct:1}};
 const custom=capacityModel({},configuration),t=custom.bearing.total;
 assert.equal(custom.bearing.policy,"capacity-parameters-v1/r4");assert.equal(custom.bearing.configuration.revision,4);
 assert.equal(t.lowConnection,0);assert.equal(t.both,0);assert.ok(t.highLoad>0);assert.ok(t.highLoad!==original.bearing.total.highLoad);
 assert.ok(custom.rows.every(r=>!r.capacity.lowConnection));assert.equal(custom.bearing.facets.find(r=>r.value==="connection")!.count,0);
 for(const key of ["sites","used","capacity","attempts","connected","failed","load","connection"] as const)assert.equal(t[key],original.bearing.total[key]);
 const originalById=new Map(original.rows.map(r=>[r.id,r.capacity]));
 for(const row of custom.rows){const c=row.capacity,old=originalById.get(row.id)!;assert.equal(c.used,old.used);assert.equal(c.connected,old.connected);assert.equal(c.level,capacityMetricLevel(c.load,"load",configuration.parameters));for(const sample of c.series)assert.equal(sample.level,capacityMetricLevel(sample.load,"load",configuration.parameters));}
 for(const key of ["highLoad","lowConnection","both","attention"] as const)assert.equal(custom.bearing.regions.reduce((sum,r)=>sum+r[key],0),t[key]);
 for(const sample of custom.bearing.series)assert.equal(sample.lowConnection,0);
 const high=capacityModel({capacityFilter:"high"},configuration);assert.equal(high.rows.length,t.highLoad);assert.ok(high.rows.every(r=>r.capacity.highLoad));
 const provider=capacityModel({operator:"mobile"},configuration);assert.equal(provider.bearing.operators[0].lowConnection,0);
 assert.ok(original.bearing.total.lowConnection>0);assert.equal(defaultCapacityConfiguration().revision,0);
});
test("durable parameter snapshots isolate workspaces, reject concurrent/stale writes and fail closed on corruption",async()=>{
 const root=await mkdtemp(join(tmpdir(),"capacity-parameters-"));try{
 const store=new FileCapacityParameterStore(root,"w/../../x");assert.equal((await store.read()).revision,0);
 const saved=await store.update(0,{...D,loadWarningPct:31},"user",async()=>{});assert.equal(saved.revision,1);assert.equal(saved.updatedBy,"user");
 assert.equal((await new FileCapacityParameterStore(root,"w/../../x").read()).parameters.loadWarningPct,31);assert.equal((await new FileCapacityParameterStore(root,"x").read()).revision,0);
 await assert.rejects(store.update(0,{...D},"user",async()=>{}),/capacity_revision_conflict/);
 await assert.rejects(store.update(1,{...D},"user",async()=>{throw Error("permission_denied");}),/permission_denied/);assert.equal((await store.read()).revision,1);
 const concurrent=await Promise.allSettled([store.update(1,{...D},"a",async()=>{}),store.update(1,{...D,loadWarningPct:33},"b",async()=>{})]);assert.equal(concurrent.filter(r=>r.status==="fulfilled").length,1);assert.equal((await store.read()).revision,2);
 const path=join(root,createHash("sha256").update("w/../../x").digest("hex"),"parameters.json");await writeFile(path,"{corrupt");await assert.rejects(store.read());
 }finally{const resolved=join(tmpdir(),root.split(/[\\/]/).at(-1)!);assert.equal(resolved,root);await rm(root,{recursive:true,force:true});}
});
test("independent analysis-rule permissions enforce view/edit, entitlement and commit-time revocation",async()=>{
 const root=await mkdtemp(join(tmpdir(),"capacity-access-"));try{
 const scope={workspaceId:"w",sourceIds:[],stationIds:[],serviceIds:[],deviceIds:[],metricKeys:[],allowSiteParameters:false};let permissions=["admin.operators.edit","metering.view"];
 const ports:AccessPorts={now:()=>1000,readVerifiedIdentity:async()=>({sub:"user",activeWorkspace:"w",accountStatus:"active",governanceRoles:["workspace:owner"],expiresAt:9000}),readCoverage:async()=>({workspaceId:"w",product:"bsmoss",tier:"test",bundled:false,expiresAt:8000}),readLocalGrant:async()=>({workspaceId:"w",sub:"user",active:true,permissions,scope,expiresAt:8000}),featuresFor:()=>["metering"]};
 const service=capacityParameterService(ports,w=>new FileCapacityParameterStore(root,w)),command={revision:0,parameters:D};
 await service.read();await assert.rejects(service.read(true),/permission_denied/);assert.equal(await service.canEdit(),false);await assert.rejects(service.update(command),/permission_denied/);
 permissions=["admin.analysis_rules.view"];await service.read(true);await assert.rejects(service.update(command),/permission_denied/);
 permissions=["admin.analysis_rules.edit"];assert.equal((await service.update(command)).revision,1);
 let reads=0;ports.readLocalGrant=async()=>({workspaceId:"w",sub:"user",active:true,permissions:++reads===1?["admin.analysis_rules.edit"]:[],scope,expiresAt:8000});await assert.rejects(service.update({...command,revision:1}),/permission_denied/);assert.equal((await new FileCapacityParameterStore(root,"w").read()).revision,1);
 ports.featuresFor=()=>[];await assert.rejects(service.update({...command,revision:1}),/feature_denied/);
 }finally{const resolved=join(tmpdir(),root.split(/[\\/]/).at(-1)!);assert.equal(resolved,root);await rm(root,{recursive:true,force:true});}
});
