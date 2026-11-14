import {test} from "node:test";
import assert from "node:assert/strict";
import {createAuthorizedTemplates} from "./templates.ts";
import type {AccessPorts} from "./resolve.ts";
import type {TemplateStore} from "../views/template-store.ts";
function fixture() {
  const scope={workspaceId:"w",sourceIds:[],stationIds:[],serviceIds:[],deviceIds:[],metricKeys:[],allowSiteParameters:false};
  const identity={sub:"admin",activeWorkspace:"w",accountStatus:"active",governanceRoles:["workspace:owner"],expiresAt:5000};
  const grant={workspaceId:"w",sub:"admin",active:true,permissions:["metering.view"],scope,expiresAt:5000};
  let calls=0,change=()=>{},clock=1000;
  const ports:AccessPorts={now:()=>clock,async readVerifiedIdentity(){return identity;},async readCoverage(){return{workspaceId:"w",product:"bsmoss",tier:"fixture",bundled:false,expiresAt:5000};},async readLocalGrant(){return grant;},featuresFor(){return["metering"];}};
  const store={workspaceId:"w",async read(_q,r){calls++;change();await r(scope);return{template:null,selection:null};}} as TemplateStore;
  const api=createAuthorizedTemplates(ports,{create(s,sub){assert.equal(s.workspaceId,"w");assert.equal(sub,"admin");return store;}},"interactive");
  return{api,grant,identity,calls:()=>calls,setChange(f:()=>void){change=f;},expire(){clock=6000;}};
}
test("template administration requires explicit local permissions even for workspace owners",async()=>{
  const f=fixture();await assert.rejects(f.api.read({code:"page"}),/permission_denied/);assert.equal(f.calls(),0);
  f.grant.permissions=["views.templates.view"];assert.equal((await f.api.read({code:"page"})).template,null);assert.equal(f.calls(),1);
});
test("template reads recheck original identity permission coverage and expiry before returning",async()=>{
  for(const mutate of [(f:ReturnType<typeof fixture>)=>f.identity.sub="other",(f:ReturnType<typeof fixture>)=>f.grant.permissions=[],(f:ReturnType<typeof fixture>)=>f.expire()]){
    const f=fixture();f.grant.permissions=["views.templates.view"];f.setChange(()=>mutate(f));await assert.rejects(f.api.read({code:"page"}));
  }
});
