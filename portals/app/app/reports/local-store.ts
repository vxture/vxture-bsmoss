import {checkArtifact,type ReportArtifact,type SavedReport,FILE_LIMIT} from './local-rules';
const DB='bsmoss-local-report-library-v1',MAX_ROWS=50,MAX_CHARS=64*1024*1024;
function shape(row:SavedReport){
 if(!row||Object.keys(row).sort().join()!=='content,digest,savedAt,schema'||typeof row.savedAt!=='string'||!Number.isFinite(Date.parse(row.savedAt)))throw Error('report_storage_corrupt');
}
export async function localReportStore(name=DB){
 const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open(name,1);let blocked=false;
  r.onupgradeneeded=event=>{if(event.oldVersion!==0){r.transaction?.abort();return;}r.result.createObjectStore('files',{keyPath:'digest'});};
  r.onsuccess=()=>{if(blocked){r.result.close();return;}r.result.onversionchange=()=>r.result.close();resolve(r.result);};r.onerror=()=>reject(Error('report_storage_unavailable'));r.onblocked=()=>{blocked=true;reject(Error('report_storage_blocked'));};
 });
 function transact<T>(mode:IDBTransactionMode,run:(store:IDBObjectStore,set:(value:T)=>void,fail:(error:unknown)=>void)=>void):Promise<T>{
  return new Promise((resolve,reject)=>{let result:T,error:unknown;const tx=db.transaction('files',mode);tx.oncomplete=()=>resolve(result);tx.onabort=()=>reject(error??tx.error??Error('report_storage_unavailable'));tx.onerror=()=>{};
   try{run(tx.objectStore('files'),v=>{result=v;},e=>{error=e;tx.abort();});}catch(e){error=e;tx.abort();}
  });
 }
 const read=async()=>{
  const rows=await transact<SavedReport[]>('readonly',(s,set)=>{const r=s.getAll();r.onsuccess=()=>set(r.result);});
  try{if(rows.length>MAX_ROWS)throw Error();let total=0;const result=[];
   for(const saved of rows){shape(saved);total+=saved.content.length;if(total>MAX_CHARS||saved.content.length>FILE_LIMIT)throw Error();const {files}=await checkArtifact({schema:saved.schema,digest:saved.digest,content:saved.content});result.push({saved,files});}return result;
  }catch{throw Error('report_storage_corrupt');}
 };
 return {read,close:()=>db.close(),save:async(value:ReportArtifact)=>{
  const {artifact}=await checkArtifact(value);await read();
  return transact<SavedReport>('readwrite',(s,set,fail)=>{const r=s.getAll();r.onsuccess=()=>{try{
   const rows=r.result as SavedReport[];rows.forEach(shape);const old=rows.find(v=>v.digest===artifact.digest);
   if(old){if(old.content!==artifact.content||old.schema!==1)throw Error('report_storage_corrupt');set(old);return;}
   if(rows.length>=MAX_ROWS||rows.reduce((n,v)=>n+v.content.length,0)+artifact.content.length>MAX_CHARS)throw Error('report_storage_full');
   const saved={...artifact,savedAt:new Date().toISOString()};s.add(saved);set(saved);
  }catch(e){fail(e);}};
  });
 }};
}
