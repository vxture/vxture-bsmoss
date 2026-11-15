import {readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {gunzipSync} from "node:zlib";
import {previewRoot,previewAccess,PREVIEW_COOKIE,validPreviewSession} from "./preview";
import {authenticatedDemoEnabled,demoDataEnabled} from "../../lib/demo-mode";
import {DEFAULT_HISTORY_ID,historyWindow} from "./history-calendar";
import {historyDescriptor,extendHistoryCatalog} from "./history-reader";
import type {QueryInput,SnapshotDescriptor} from "./query";
import type {readTowerPreview} from "./history-reader";
type Result=Awaited<ReturnType<typeof readTowerPreview>>;
export function pageModelKey(kind:string,input:QueryInput) {
 const normalized={...input,city:input.city??"all",county:input.county??"all",operator:input.operator??"all",snapshotId:input.snapshotId??DEFAULT_HISTORY_ID};
 return createHash("sha256").update(JSON.stringify([kind,Object.entries(normalized).sort(([a],[b])=>a.localeCompare(b))])).digest("hex");
}
const cached=new Map<string,Promise<unknown>>();
export async function publishedPageRead<T extends {snapshots: SnapshotDescriptor[]}>(kind:string,input:QueryInput):Promise<T|null> {
 if(!authenticatedDemoEnabled()){
  if(!demoDataEnabled())return null;
  const {cookies}=await import("next/headers");
  if(validPreviewSession((await cookies()).get(PREVIEW_COOKIE)?.value))return null;
 }
 const key=pageModelKey(kind,input);
 let pending=cached.get(key) as Promise<T>|undefined;
 if(!pending){pending=readFile(previewRoot()+"/demo-history/pages/"+key+".json.gz").then(bytes=>JSON.parse(gunzipSync(bytes).toString("utf8")) as T);cached.set(key,pending);pending.catch(()=>cached.delete(key));if(cached.size>64)cached.delete(cached.keys().next().value!);}
 try {
  const model=await pending;
  const access=previewAccess("reference-only");
  const catalog=historyWindow(DEFAULT_HISTORY_ID).map(id=>historyDescriptor(undefined,id,access));
  return extendHistoryCatalog(model,{catalog},kind==="services");
 }catch(error){if((error as NodeJS.ErrnoException).code==="ENOENT")return null;throw error;}
}
// Published models contain synthetic data only. Authorized subsets never reuse
// the full-province model. Local mutable workspaces always use their own readers.
export async function pageReadModel<T>(kind:string,result:Result,compute:()=>T):Promise<T> {
 const full=result.access.workspaceId==="reference-only" && result.access.siteIds===null && result.access.cityIds.includes("*") && result.access.operators.length===5;
 if(!full)return compute();
 const key=pageModelKey(kind,result.input);
 let pending=cached.get(key) as Promise<T>|undefined;
 if(!pending){pending=(async()=>{try{return JSON.parse(gunzipSync(await readFile(previewRoot()+"/demo-history/pages/"+key+".json.gz")).toString("utf8")) as T;}catch(error){if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error;return compute();}})();cached.set(key,pending);pending.catch(()=>cached.delete(key));if(cached.size>64)cached.delete(cached.keys().next().value!);}
 return pending;
}
