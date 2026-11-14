import {createHash,randomUUID} from "node:crypto";
import {mkdir,open,readFile,rename,unlink} from "node:fs/promises";
import {join,resolve} from "node:path";
import {applyIdentity,defaultCatalog,readCatalog,type IdentityAction,type OperatorIdentityCatalog,type OperatorIdentityRecord} from "./rules.ts";
export interface IdentityStore {
  readonly workspaceId:string;
  read():Promise<OperatorIdentityCatalog>;
  update(revision:number,record:OperatorIdentityRecord,subject:string,revalidate:()=>Promise<void>,action?:IdentityAction):Promise<OperatorIdentityCatalog>;
}
// Files live outside .next; configure a persistent shared volume for deployment.
// Workspace keys are hashed, never interpolated as filesystem paths.
export class FileIdentityStore implements IdentityStore {
  private readonly directory:string;
  constructor(root:string,readonly workspaceId:string){
    if(!root||!workspaceId)throw Error("operator_store_unconfigured");
    this.directory=join(resolve(root),createHash("sha256").update(workspaceId).digest("hex"));
  }
  async read(){
    try{return readCatalog(JSON.parse(await readFile(join(this.directory,"catalog.json"),"utf8")));}
    catch(error){if((error as NodeJS.ErrnoException).code==="ENOENT")return defaultCatalog();throw error;}
  }
  async update(revision:number,record:OperatorIdentityRecord,subject:string,revalidate:()=>Promise<void>,action:IdentityAction="update"){
    await mkdir(this.directory,{recursive:true});
    const lockPath=join(this.directory,"catalog.lock");
    let lock;try{lock=await open(lockPath,"wx",0o600);}catch(error){if((error as NodeJS.ErrnoException).code==="EEXIST")throw Error("operator_revision_conflict");throw error;}
    const temp=join(this.directory,randomUUID()+".tmp");
    try{
      const current=await this.read();if(current.revision!==revision)throw Error("operator_revision_conflict");
      const next={revision:revision+1,items:applyIdentity(current,record,action),updatedAt:new Date().toISOString()};
      // Identity, permission and workspace are checked again under the write lock.
      await revalidate();
      const file=await open(temp,"wx",0o600);
      try{await file.writeFile(JSON.stringify({...next,updatedBy:subject}),"utf8");await file.sync();}finally{await file.close();}
      await rename(temp,join(this.directory,"catalog.json"));return next;
    }finally{await unlink(temp).catch(()=>{});await lock.close();await unlink(lockPath);}
  }
}
