import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import sharp from "sharp";
import {applyIdentity,defaultCatalog,GENERIC_LOGO,MAX_IDENTITIES,identityCommand,identityRecord,readCatalog} from "./rules.ts";
import {normalizeLogo} from "./logo.ts";
import {FileIdentityStore} from "./store.ts";
import {operatorIdentityService} from "./service.ts";
import type {AccessPorts} from "../access/resolve.ts";
test("fixed identities validate names and reject unknown keys, scripts, remote images and forged MIME",()=>{
 const c=defaultCatalog();assert.deepEqual(c.items.map(i=>i.code),["tower","mobile","unicom","telecom","broadcast","other"]);
 const record=c.items[1];assert.equal(identityRecord({...record,shortName:" Example "}).shortName,"Example");
 for(const patch of [{code:"new"},{fullName:" "},{shortName:"a".repeat(13)},{logo:"https://example.com/logo.png"},{logo:"data:image/svg+xml;base64,PHN2Zz4="},{logo:"data:image/png;base64,PHNjcmlwdD4="},{other:true}])assert.throws(()=>identityRecord({...record,...patch}));
 assert.throws(()=>identityCommand({revision:-1,record}));assert.throws(()=>identityCommand({revision:0,record,workspaceId:"other"}));
 assert.throws(()=>readCatalog({...c,items:[...c.items.slice(1),record]}));
});
const customIdentity={code:"provider_0123456789abcdef0123456789abcdef",fullName:"Example Network Services",shortName:"Example",logo:GENERIC_LOGO};
test("custom providers retain mandatory presets, stable codes and a bounded catalog",()=>{
 const c=defaultCatalog(),items=applyIdentity(c,customIdentity,"create");
 assert.equal(readCatalog({...c,items}).items.at(-1)?.code,customIdentity.code);
 assert.equal(identityCommand({revision:0,record:customIdentity,action:"create"}).action,"create");
 assert.throws(()=>identityCommand({revision:0,record:customIdentity,action:"delete"}));
 for(const code of ["../other","__proto__","constructor","provider_invalid","MOBILE"])assert.throws(()=>identityRecord({...customIdentity,code}));
 assert.throws(()=>readCatalog({...c,items:items.slice(1)}));
 assert.throws(()=>readCatalog({...c,items:[...items,customIdentity]}));
 assert.throws(()=>applyIdentity(c,customIdentity,"update"),/invalid_operator_missing/);
 assert.throws(()=>applyIdentity(c,c.items[0],"create"),/operator_identity_conflict/);
 assert.throws(()=>applyIdentity(c,{...customIdentity,shortName:c.items[1].shortName},"create"),/operator_identity_conflict/);
 assert.throws(()=>applyIdentity({...c,items},{...customIdentity,code:"provider_fedcba9876543210fedcba9876543210",shortName:"EXAMPLE"},"create"),/operator_identity_conflict/);
 const full={...c,items:[...c.items,...Array.from({length:MAX_IDENTITIES-c.items.length},(_,i)=>({...customIdentity,code:"provider_"+i.toString(16).padStart(32,"0"),fullName:"Network "+i,shortName:"N"+i}))]};
 assert.equal(readCatalog(full).items.length,MAX_IDENTITIES);
 assert.throws(()=>applyIdentity(full,customIdentity,"create"),/invalid_operator_limit/);
});
test("custom provider creation and later edits persist without overwriting existing providers",async()=>{
 const root=await mkdtemp(join(tmpdir(),"operator-create-"));try{
  const store=new FileIdentityStore(root,"workspace");
  const created=await store.update(0,customIdentity,"user",async()=>{},"create");
  assert.equal(created.items.length,7);assert.equal(created.revision,1);
  const reopened=new FileIdentityStore(root,"workspace");assert.deepEqual((await reopened.read()).items.at(-1),customIdentity);
  await assert.rejects(reopened.update(1,customIdentity,"user",async()=>{},"create"),/operator_identity_conflict/);
  await assert.rejects(reopened.update(0,{...customIdentity,shortName:"Stale"},"user",async()=>{}),/operator_revision_conflict/);
  const edited=await reopened.update(1,{...customIdentity,shortName:"Updated"},"user",async()=>{});
  assert.equal(edited.items.at(-1)?.shortName,"Updated");assert.deepEqual(edited.items.slice(0,6),defaultCatalog().items);
  assert.equal((await new FileIdentityStore(root,"other").read()).items.length,6);
  await assert.rejects(reopened.update(2,{...customIdentity,code:"provider_fedcba9876543210fedcba9876543210",shortName:"Denied",fullName:"Denied Network"},"user",async()=>{throw Error("permission_denied");},"create"),/permission_denied/);
  assert.equal((await reopened.read()).items.length,7);
 }finally{await rm(root,{recursive:true,force:true});}
});
test("uploaded logos are decoded, bounded and re-encoded without metadata",async()=>{
 const image=await sharp({create:{width:40,height:40,channels:4,background:"#123456"}}).webp().toBuffer();
 const logo="data:image/webp;base64,"+image.toString("base64");identityRecord({...defaultCatalog().items[0],logo});
 const normalized=await normalizeLogo(logo);assert.ok(normalized.startsWith("data:image/png;base64,"));assert.equal((await sharp(Buffer.from(normalized.split(',')[1],"base64")).metadata()).width,40);
 await assert.rejects(normalizeLogo("data:image/png;base64,iVBORw0KGgoAAAAA"),/invalid_operator_logo/);
 const tiny=await sharp({create:{width:1,height:1,channels:4,background:"#123456"}}).png().toBuffer();await assert.rejects(normalizeLogo("data:image/png;base64,"+tiny.toString("base64")),/invalid_operator_logo/);
});
test("server files survive adapter recreation, isolate workspace paths and reject stale or revoked writes",async()=>{
 const root=await mkdtemp(join(tmpdir(),"operator-identities-"));try{
 const a=new FileIdentityStore(root,"a/../../b"),b=new FileIdentityStore(root,"b");const original=defaultCatalog().items[1],edited={...original,shortName:"Custom"};
 const saved=await a.update(0,edited,"user",async()=>{});assert.equal(saved.revision,1);
 assert.equal((await new FileIdentityStore(root,"a/../../b").read()).items[1].shortName,"Custom");assert.equal((await b.read()).revision,0);
 await assert.rejects(a.update(0,original,"user",async()=>{}),/operator_revision_conflict/);
 await assert.rejects(a.update(1,original,"user",async()=>{throw Error("permission_denied");}),/permission_denied/);assert.equal((await a.read()).revision,1);
 const results=await Promise.allSettled([a.update(1,original,"user",async()=>{}),a.update(1,edited,"user",async()=>{})]);assert.equal(results.filter(r=>r.status==="fulfilled").length,1);assert.equal((await a.read()).revision,2);
 }finally{await rm(root,{recursive:true,force:true});}
});
test("operator editing requires its independent permission even for owners, and revalidates under the lock",async()=>{
 const root=await mkdtemp(join(tmpdir(),"operator-access-"));try{
 const scope={workspaceId:"w",sourceIds:[],stationIds:[],serviceIds:[],deviceIds:[],metricKeys:[],allowSiteParameters:false};let permissions=["admin.sources.view","metering.view"];
 const ports:AccessPorts={now:()=>1000,readVerifiedIdentity:async()=>({sub:"user",activeWorkspace:"w",accountStatus:"active",governanceRoles:["workspace:owner"],expiresAt:9000}),readCoverage:async()=>({workspaceId:"w",product:"bsmoss",tier:"test",bundled:false,expiresAt:8000}),readLocalGrant:async()=>({workspaceId:"w",sub:"user",active:true,permissions,scope,expiresAt:8000}),featuresFor:()=>["metering"]};
 const service=operatorIdentityService(ports,w=>new FileIdentityStore(root,w)),command={revision:0,record:defaultCatalog().items[0]};
 await assert.rejects(service.update(command),/permission_denied/);assert.equal(await service.canEdit(),false);
 permissions=["admin.operators.view"];await service.read(true);await assert.rejects(service.update(command),/permission_denied/);
 permissions=["admin.operators.edit"];const result=await service.update(command);assert.equal(result.revision,1);
 const created=await service.update({revision:1,record:customIdentity,action:"create"});assert.equal(created.items.at(-1)?.code,customIdentity.code);assert.equal(created.revision,2);
 let reads=0;ports.readLocalGrant=async()=>({workspaceId:"w",sub:"user",active:true,permissions:++reads===1?["admin.operators.edit"]:[],scope,expiresAt:8000});
 await assert.rejects(service.update({...command,revision:2}),/permission_denied/);assert.equal((await new FileIdentityStore(root,"w").read()).revision,2);
 }finally{await rm(root,{recursive:true,force:true});}
});
