// Adapted from the yucer engineering reference for product bsmoss.
import { getPlatformClientConfig } from "./platform-client";
import { PlatformEntitlementResolver } from "./platform-resolver";
import { EMPTY_ENTITLEMENT, type Entitlement } from "./types";
export interface EntitlementResolver { resolve(workspaceId:string):Promise<Entitlement>; invalidate(workspaceId:string):void }
export function makeEntitlement(workspaceId:string,product:string,overrides:Partial<Entitlement>={}):Entitlement {
  return {...EMPTY_ENTITLEMENT,workspace_id:workspaceId,product,...overrides};
}
let singleton:EntitlementResolver|null=null;
export function getEntitlementResolver():EntitlementResolver {
  if(singleton) return singleton;
  const config=getPlatformClientConfig();
  if(!config) throw Error("platform_entitlement_unconfigured");
  return singleton=new PlatformEntitlementResolver(config);
}
export function resetResolver(){singleton=null;}
