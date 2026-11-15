import {createHash,randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile,link,unlink,open} from 'node:fs/promises';
import {resolve} from 'node:path';
import {gzipSync,gunzipSync} from 'node:zlib';
import {generateHistory,buildHistoryRollups,historyRules,type DemoHistory} from './history';
import {HISTORY_VERSION} from './history-calendar';
import type {Inventory} from './foundation';
// One immutable bundle per seed/base. Publication uses exclusive hard-link after
// fsync; concurrent first readers cannot overwrite a partially written version.
const cache=new Map<string,Promise<{history:DemoHistory;digest:string;bytes:number;path:string}>>();
type Bundle={history:DemoHistory;digest:string;bytes:number;path:string};
const factsCache=new Map<string,Promise<Bundle>>();
const immutableDigests = new WeakMap<Inventory,string>();
export async function readDemoHistory(root:string,base:Inventory,create=false, includeRollups=true){
 const baseDigest=immutableDigests.get(base)??createHash('sha256').update(JSON.stringify(base)).digest('hex');
 if(Object.isFrozen(base))immutableDigests.set(base,baseDigest);
 const key=resolve(root,HISTORY_VERSION+'-'+baseDigest+'.json.gz');
 let facts=factsCache.get(key);if(!facts){facts=(async()=>{
  if(create)await mkdir(root,{recursive:true});let compressed:Buffer;
  try{compressed=await readFile(key);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;if(!create)throw Error('demo_history_not_installed');
   const history=generateHistory(base),payload={...history,daily:Buffer.from(history.daily.buffer).toString('base64'),baseDigest};compressed=gzipSync(Buffer.from(JSON.stringify(payload)),{level:6});
   const temp=key+'.'+randomUUID()+'.tmp';try{await writeFile(temp,compressed,{flag:'wx'});const f=await open(temp,'r+');try{await f.sync();}finally{await f.close();}try{await link(temp,key);}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;}compressed=await readFile(key);}finally{await unlink(temp).catch(()=>undefined);}
  }
  const payload=JSON.parse(gunzipSync(compressed).toString('utf8')),daily=Buffer.from(payload.daily,'base64');
  if(payload.baseDigest!==baseDigest||payload.version!==HISTORY_VERSION||daily.byteLength!==payload.relations.length*payload.days*4)throw Error('invalid_history_bundle');
  const history={...payload,daily:new Uint32Array(daily.buffer.slice(daily.byteOffset,daily.byteOffset+daily.byteLength))} as DemoHistory;
  const digest=createHash('sha256').update(compressed).digest('hex');
  return {history,digest,bytes:compressed.length,path:key};
 })();factsCache.set(key,facts);facts.catch(()=>factsCache.delete(key));}
 if(!includeRollups)return facts;
 let pending=cache.get(key);if(!pending){pending=(async()=>{
  const {history,digest,bytes}=await facts,rollupPath=key+'.summaries-v3.gz';let rollupBytes:Buffer;
  try{rollupBytes=await readFile(rollupPath);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;if(!create)throw Error('demo_history_rollups_not_installed');const rows=buildHistoryRollups(history),raw=JSON.stringify(rows);rollupBytes=gzipSync(JSON.stringify({sourceDigest:digest,rows,rules:historyRules(),rulesDigest:createHash('sha256').update(JSON.stringify(historyRules())).digest('hex'),digest:createHash('sha256').update(raw).digest('hex')}));const temp=rollupPath+'.'+randomUUID()+'.tmp';try{await writeFile(temp,rollupBytes,{flag:'wx'});const f=await open(temp,'r+');try{await f.sync();}finally{await f.close();}try{await link(temp,rollupPath);}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;}rollupBytes=await readFile(rollupPath);}finally{await unlink(temp).catch(()=>undefined);}}
  const rollups=JSON.parse(gunzipSync(rollupBytes).toString('utf8'));if(rollups.rulesDigest!==createHash('sha256').update(JSON.stringify(rollups.rules)).digest('hex')||rollups.sourceDigest!==digest||rollups.digest!==createHash('sha256').update(JSON.stringify(rollups.rows)).digest('hex'))throw Error('invalid_history_rollups');
  return {history:{...history,rollups:rollups.rows,rules:rollups.rules},digest,bytes:bytes+rollupBytes.length,path:key};
 })();cache.set(key,pending);pending.catch(()=>cache.delete(key));}return pending;
}
