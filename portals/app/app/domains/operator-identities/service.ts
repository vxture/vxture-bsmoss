import {resolveMeasurementAccess,type AccessPorts} from "../access/resolve.ts";
import {identityCommand} from "./rules.ts";
import type {IdentityStore} from "./store.ts";
import {normalizeLogo} from "./logo.ts";
export function operatorIdentityService(ports:AccessPorts,create:(workspaceId:string)=>IdentityStore){
  async function context(operation:"view"|"operators_view"|"operators_edit"){
    const access=await resolveMeasurementAccess(ports,operation,"interactive");
    const store=create(access.context.workspaceId);if(store.workspaceId!==access.context.workspaceId)throw Error("workspace_mismatch");
    const revalidate=async()=>{if(access.expiresAt<=(ports.now??Date.now)())throw Error("access_expired");const current=await resolveMeasurementAccess(ports,operation,"interactive");if(current.context.workspaceId!==access.context.workspaceId||current.context.sub!==access.context.sub)throw Error("permission_denied");};
    return {store,revalidate,subject:access.context.sub};
  }
  return {
    async canEdit(){try{await context("operators_edit");return true;}catch(error){if(error instanceof Error&&["permission_denied","feature_denied"].includes(error.message))return false;throw error;}},
    async read(management=false){const c=await context(management?"operators_view":"view");const result=await c.store.read();await c.revalidate();return result;},
    async update(raw:unknown){const c=await context("operators_edit"),command=identityCommand(raw);command.record.logo=await normalizeLogo(command.record.logo);return c.store.update(command.revision,command.record,c.subject,c.revalidate,command.action);},
  };
}
