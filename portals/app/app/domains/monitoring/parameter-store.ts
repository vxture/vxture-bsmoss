import {createHash,randomUUID} from "node:crypto";
import {mkdir,open,readFile,rename,unlink} from "node:fs/promises";
import {join,resolve} from "node:path";
import {defaultMonitoringConfiguration,monitoringParameters,readMonitoringConfiguration,type MonitoringConfiguration,type MonitoringParameters} from "./parameters.ts";
export interface MonitoringParameterStore {readonly workspaceId:string;read():Promise<MonitoringConfiguration>;update(revision:number,parameters:MonitoringParameters,subject:string,revalidate:()=>Promise<void>):Promise<MonitoringConfiguration>}
export class FileMonitoringParameterStore implements MonitoringParameterStore {
 private readonly directory:string;
 constructor(root:string,readonly workspaceId:string){if(!root||!workspaceId)throw Error("monitoring_store_unconfigured");this.directory=join(resolve(root),createHash("sha256").update(workspaceId).digest("hex"));}
 async read(){try{return readMonitoringConfiguration(JSON.parse(await readFile(join(this.directory,"parameters.json"),"utf8")));}catch(error){if((error as NodeJS.ErrnoException).code==="ENOENT")return defaultMonitoringConfiguration();throw error;}}
 async update(revision:number,parameters:MonitoringParameters,subject:string,revalidate:()=>Promise<void>){
  const validated=monitoringParameters(parameters);if(!Number.isSafeInteger(revision)||revision<0||!subject)throw Error("invalid_monitoring_command");
  await mkdir(this.directory,{recursive:true});const lockPath=join(this.directory,"parameters.lock");
  let lock;try{lock=await open(lockPath,"wx",0o600);}catch(error){if((error as NodeJS.ErrnoException).code==="EEXIST")throw Error("monitoring_revision_conflict");throw error;}
  const temp=join(this.directory,randomUUID()+".tmp");
  try{const current=await this.read();if(current.revision!==revision)throw Error("monitoring_revision_conflict");
   const next={revision:revision+1,parameters:validated,updatedAt:new Date().toISOString(),updatedBy:subject};
   await revalidate();const file=await open(temp,"wx",0o600);try{await file.writeFile(JSON.stringify(next),"utf8");await file.sync();}finally{await file.close();}
   await rename(temp,join(this.directory,"parameters.json"));return next;
  }finally{await unlink(temp).catch(()=>{});await lock.close();await unlink(lockPath);}
 }
}
export function monitoringParameterStore(workspaceId:string){const root=process.env.BSMOSS_MONITORING_PARAMETERS_DIR||(process.env.BSMOSS_PRODUCT_PREVIEW==="on"?resolve(process.cwd(),"private/monitoring-parameters"):"");return new FileMonitoringParameterStore(root,workspaceId);}
