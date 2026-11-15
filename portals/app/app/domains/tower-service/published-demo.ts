import {readFile} from "node:fs/promises";
import {gunzipSync} from "node:zlib";
import {previewRoot,previewAccess} from "./preview";
import {towerReportService} from "./tower-report-service";
import type {FoundationState} from "./foundation";
let published:Promise<FoundationState>|undefined;
export function readPublishedDemo() {
 if(!published){published=readFile(previewRoot()+"/demo-history/published.json.gz").then(bytes=>JSON.parse(gunzipSync(bytes).toString("utf8")) as FoundationState);published.catch(()=>{published=undefined;});}
 return published;
}
export async function publishedDemoReports() {
 const state=await readPublishedDemo();
 return towerReportService({workspaceId:state.workspaceId,read:async()=>state,transaction:async()=>{throw Error("demo_read_only");}},
  {access:async()=>previewAccess(state.workspaceId),now:()=>Date.now()});
}
