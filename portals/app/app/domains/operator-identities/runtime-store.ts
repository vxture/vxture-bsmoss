import {resolve} from "node:path";
import {FileIdentityStore} from "./store";
export function operatorIdentityStore(workspaceId:string){
  const root=process.env.BSMOSS_OPERATOR_IDENTITIES_DIR || (process.env.BSMOSS_PRODUCT_PREVIEW==="on"?resolve(process.cwd(),"private/operator-identities"):"");
  return new FileIdentityStore(root,workspaceId);
}
