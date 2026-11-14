import {resolveMeasurementAccess,type AccessPorts} from "../access/resolve.ts";
import {capacityCommand} from "./parameters.ts";
import type {CapacityParameterStore} from "./parameter-store.ts";
export function capacityParameterService(ports:AccessPorts,create:(workspaceId:string)=>CapacityParameterStore){
 async function context(operation:"view"|"analysis_rules_view"|"analysis_rules_edit"){
  const access=await resolveMeasurementAccess(ports,operation,"interactive"),store=create(access.context.workspaceId);
  if(store.workspaceId!==access.context.workspaceId)throw Error("workspace_mismatch");
  const revalidate=async()=>{if(access.expiresAt<=(ports.now??Date.now)())throw Error("access_expired");const current=await resolveMeasurementAccess(ports,operation,"interactive");if(current.context.workspaceId!==access.context.workspaceId||current.context.sub!==access.context.sub)throw Error("permission_denied");};
  return {store,revalidate,subject:access.context.sub};
 }
 return {
  async canEdit(){try{await context("analysis_rules_edit");return true;}catch(error){if(error instanceof Error&&["permission_denied","feature_denied"].includes(error.message))return false;throw error;}},
  async read(management=false){const c=await context(management?"analysis_rules_view":"view");const result=await c.store.read();await c.revalidate();return result;},
  async update(raw:unknown){const c=await context("analysis_rules_edit"),command=capacityCommand(raw);return c.store.update(command.revision,command.parameters,c.subject,c.revalidate);},
 };
}
