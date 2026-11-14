import {parseReviewCommand,readCaseLog,type CaseLog,type ReviewEvent} from './events';
import {decideAppend,type ReviewStore,type ReviewSession,type ReviewRecords} from './event-service';
import type {ReviewCase} from './demo';
export const REVIEW_DB='bsmoss-demo-review-v1';
const sessionId=()=>crypto.randomUUID();
export const validSession=(s:string)=>/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(s);
function validateSession(value:unknown,dataset:string):ReviewSession {
 const v=value as ReviewSession;
 if(!v||v.dataset!==dataset||typeof v.id!=='string'||!validSession(v.id)||!Number.isFinite(Date.parse(v.createdAt)))throw Error('review_storage_corrupt');return v;
}
function openDatabase(name:string):Promise<IDBDatabase>{return new Promise((resolve,reject)=>{
 let settled=false;const req=indexedDB.open(name,1),timer=setTimeout(()=>{settled=true;reject(Error('review_storage_unavailable'));},5000);
 req.onupgradeneeded=e=>{if((e as IDBVersionChangeEvent).oldVersion!==0){req.transaction?.abort();return;}const db=req.result;db.createObjectStore('meta');db.createObjectStore('sessions');db.createObjectStore('cases');db.createObjectStore('commands');};
 req.onerror=()=>{clearTimeout(timer);reject(Error('review_storage_unavailable'));};
 req.onblocked=()=>{clearTimeout(timer);settled=true;reject(Error('review_storage_unavailable'));};
 req.onsuccess=()=>{clearTimeout(timer);if(settled){req.result.close();return;}resolve(req.result);};
});}
export async function indexedReviewStore(databaseName=REVIEW_DB):Promise<ReviewStore>{
 const db=await openDatabase(databaseName);db.onversionchange=()=>db.close();
 const transaction=<T>(names:string[],mode:IDBTransactionMode,run:(tx:IDBTransaction,set:(v:T)=>void,fail:(e:unknown)=>void)=>void)=>new Promise<T>((resolve,reject)=>{
  let result:T,error:unknown;const tx=db.transaction(names,mode);
  const fail=(e:unknown)=>{error=e;try{tx.abort();}catch{}};
  tx.oncomplete=()=>resolve(result);tx.onabort=()=>reject(error??Error('review_storage_unavailable'));tx.onerror=()=>{error??=Error('review_storage_unavailable');};
  try{run(tx,v=>{result=v;},fail);}catch(e){fail(e);}
 });
 const newSession=async(dataset:string)=>transaction<string>(['meta','sessions'],'readwrite',(tx,set)=>{
  const id=sessionId();tx.objectStore('sessions').add({id,dataset,createdAt:new Date().toISOString()},[dataset,id]);tx.objectStore('meta').put(id,dataset);set(id);
 });
 const read=async(dataset:string,session?:string):Promise<ReviewRecords>=>{
  const result=await transaction<ReviewRecords|undefined>(['meta','sessions','cases'],'readonly',(tx,set,fail)=>{
   const meta=tx.objectStore('meta').get(dataset);meta.onsuccess=()=>{try{
    if(meta.result===undefined){set(undefined);return;}
    const active=meta.result;if(typeof active!=='string'||!validSession(active)||session!==undefined&&!validSession(session))throw Error('review_storage_corrupt');
    const chosen=session??active,sessionsReq=tx.objectStore('sessions').getAll(IDBKeyRange.bound([dataset,''],[dataset,'\uffff']));
    sessionsReq.onsuccess=()=>{try{
     const sessions=sessionsReq.result.map(s=>validateSession(s,dataset)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id));
     if(!sessions.some(s=>s.id===active)||!sessions.some(s=>s.id===chosen))throw Error('review_session_not_found');
     const req=tx.objectStore('cases').getAll(IDBKeyRange.bound([dataset,chosen,''],[dataset,chosen,'\uffff']));
     req.onsuccess=()=>{try{set({active,sessions,logs:req.result.map(v=>readCaseLog(v,dataset,chosen))});}catch(e){fail(e);}};
    }catch(e){fail(e);}};
   }catch(e){fail(e);}};
  });
  if(result)return result;
  if(session)throw Error('review_session_not_found');
  // Concurrent first readers share one initialization transaction; a second
  // tab must never replace an already-created active pointer.
  await transaction<void>(['meta','sessions'],'readwrite',(tx,set)=>{const req=tx.objectStore('meta').get(dataset);req.onsuccess=()=>{if(req.result===undefined){const id=sessionId();tx.objectStore('sessions').add({id,dataset,createdAt:new Date().toISOString()},[dataset,id]);tx.objectStore('meta').put(id,dataset);}set();};});
  return read(dataset);
 };
 return {read,newSession,close:()=>db.close(),append:(dataset,session,current:ReviewCase,input:unknown)=>transaction<ReviewEvent>(['meta','sessions','cases','commands'],'readwrite',(tx,set,fail)=>{
  const parsed=parseReviewCommand(input);
  const meta=tx.objectStore('meta').get(dataset);meta.onsuccess=()=>{try{
   if(meta.result!==session)throw Error('review_session_archived');
   const sessionReq=tx.objectStore('sessions').get([dataset,session]);sessionReq.onsuccess=()=>{try{
    validateSession(sessionReq.result,dataset);
    const record=tx.objectStore('cases').get([dataset,session,current.id]);record.onsuccess=()=>{
     const command=parsed.commandId,receipt=tx.objectStore('commands').get([dataset,session,command]);receipt.onsuccess=()=>{try{
      const decision=decideAppend(dataset,session,current,parsed,record.result,receipt.result,new Date().toISOString());
      if(!decision.replay){const log:CaseLog={schema:1,dataset,session,caseId:current.id,events:[...(record.result?.events??[]),decision.event]};tx.objectStore('cases').put(log,[dataset,session,current.id]);tx.objectStore('commands').add(decision.event,[dataset,session,command]);}
      set(decision.event);
     }catch(e){fail(e);}};
    };
   }catch(e){fail(e);}};
  }catch(e){fail(e);}};
 })};
}
