import {createHash,randomUUID} from "node:crypto";
import {mkdir,open,readFile,rename,unlink} from "node:fs/promises";
import {join,resolve} from "node:path";
import {applyMaintenance,emptyMaintenance,readMaintenance,type MaintenanceCommand} from "./maintenance-rules";
export class FileRegistryMaintenanceStore {
  private readonly directory:string;
  constructor(root:string,readonly workspaceId:string){
    if(!root||!workspaceId)throw Error("maintenance_unavailable");
    this.directory=join(resolve(root),createHash("sha256").update(workspaceId).digest("hex"));
  }
  async read(){try{return readMaintenance(JSON.parse(await readFile(join(this.directory,"catalog.json"),"utf8")));}catch(error){if((error as NodeJS.ErrnoException).code==="ENOENT")return emptyMaintenance();throw error;}}
  async update(command:MaintenanceCommand,actor:string,revalidate:()=>Promise<void>){
    await mkdir(this.directory,{recursive:true});
    const lockPath=join(this.directory,"catalog.lock"),temp=join(this.directory,randomUUID()+".tmp");
    let lock;try{lock=await open(lockPath,"wx",0o600);}catch(error){if((error as NodeJS.ErrnoException).code==="EEXIST")throw Error("maintenance_conflict");throw error;}
    try{
      const current=await this.read(),next=applyMaintenance(current,command,new Date().toISOString(),actor);
      await revalidate();
      if(next!==current){const file=await open(temp,"wx",0o600);try{await file.writeFile(JSON.stringify(next),"utf8");await file.sync();}finally{await file.close();}await rename(temp,join(this.directory,"catalog.json"));}
      return next;
    }finally{await unlink(temp).catch(()=>{});await lock.close();await unlink(lockPath);}
  }
}
export function registryMaintenanceStore(){return new FileRegistryMaintenanceStore(process.env.BSMOSS_REGISTRY_MAINTENANCE_DIR||resolve(process.cwd(),"private/registry-maintenance"),"preview");}
