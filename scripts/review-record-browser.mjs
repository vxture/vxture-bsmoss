// Native IndexedDB contract harness. Run with node --import tsx. The server is
// loopback-only; its unique test DB never touches application or formal data.
import {createServer} from 'node:http';
import {build} from 'esbuild';
import {reviewDemoCases} from '../portals/app/app/domains/usage-verification/demo.ts';
const fixture=reviewDemoCases()[0];
const source=`
import {indexedReviewStore} from './portals/app/app/domains/usage-verification/indexeddb-store.ts';
import {evidenceRef} from './portals/app/app/domains/usage-verification/events.ts';
const item=${JSON.stringify(fixture)},dataset=item.source,results=[];
const check=(name,ok)=>{if(!ok)throw Error(name);results.push(name);};
const reject=async(name,fn,code)=>{try{await fn();throw Error('unexpected_success');}catch(e){check(name,e.message===code);}};
const command=(action,revision,extra={})=>({commandId:crypto.randomUUID(),caseId:item.id,expectedRevision:revision,evidenceRef:evidenceRef(item),action,...(action==='confirm'?{reasonCode:'demand'}:{}),note:'Native IDB contract check',...extra});
document.querySelector('button').onclick=async()=>{
 const output=document.querySelector('pre');document.querySelector('button').disabled=true;
 let a,b,connection;const name='bsmoss-review-contract-'+crypto.randomUUID();
 try{
  a=await indexedReviewStore(name);b=await indexedReviewStore(name);
  const [ra,rb]=await Promise.all([a.read(dataset),b.read(dataset)]),s=ra.active;
  check('concurrent first readers share one active session',s===rb.active&&ra.sessions.length===1&&rb.sessions.length===1);
  const c1=command('confirm',0),c2=command('confirm',0);
  const race=await Promise.allSettled([a.append(dataset,s,item,c1),b.append(dataset,s,item,c2)]);
  check('same revision race commits one event',race.filter(r=>r.status==='fulfilled').length===1&&race.filter(r=>r.status==='rejected'&&r.reason.message==='review_revision_conflict').length===1);
  const winner=race[0].status==='fulfilled'?c1:c2;
  check('read only after complete sees committed event',(await b.read(dataset)).logs[0].events.length===1);
  const approve=command('approve',1);await a.append(dataset,s,item,approve);
  const replay=await b.append(dataset,s,item,winner);
  check('old command replay does not roll back head',replay.revision===1&&(await a.read(dataset)).logs[0].events.length===2);
  await reject('same command different content rejected',()=>b.append(dataset,s,item,{...winner,note:'different'}),'review_command_conflict');
  const reopen=command('reopen',2),nativeAdd=IDBObjectStore.prototype.add;
  try{IDBObjectStore.prototype.add=function(...args){if(this.name==='commands')throw new DOMException('test quota failure','QuotaExceededError');return nativeAdd.apply(this,args);};
   await reject('write failure rejects before success',()=>a.append(dataset,s,item,reopen),'test quota failure');
  }finally{IDBObjectStore.prototype.add=nativeAdd;}
  check('aborted command and projection remain atomic',(await a.read(dataset)).logs[0].events.length===2);
  await a.append(dataset,s,item,reopen);await b.append(dataset,s,item,reopen);
  check('retry after aborted transaction commits once',(await b.read(dataset)).logs[0].events.length===3);
  const changed={...item,evidenceRevision:2,evidenceDigest:'a'.repeat(64)},confirm=command('confirm',3);await a.append(dataset,s,item,confirm);
  await reject('changed evidence blocks direct review',()=>b.append(dataset,s,changed,command('approve',4,{evidenceRef:evidenceRef(changed)})),'review_evidence_changed');
  await a.append(dataset,s,changed,command('reopen',4));await a.append(dataset,s,changed,command('confirm',5,{evidenceRef:evidenceRef(changed)}));await a.append(dataset,s,changed,command('approve',6,{evidenceRef:evidenceRef(changed)}));
  const logs=(await b.read(dataset)).logs;check('old snapshot retained beside new reviewed snapshot',logs[0].events[0].evidence.evidenceRevision===1&&logs[0].events[6].evidence.evidenceRevision===2);
  a.close();a=await indexedReviewStore(name);check('close and reopen preserves complete event history',(await a.read(dataset)).logs[0].events.length===7);
  const other=await a.read(dataset+'-separate');check('dataset namespace is isolated',other.logs.length===0&&other.active!==s);
  const fresh=await a.newSession(dataset);check('new session archives instead of deleting',fresh!==s&&(await a.read(dataset)).logs.length===0&&(await a.read(dataset,s)).logs[0].events.length===7);
  await reject('archived session cannot append',()=>b.append(dataset,s,item,command('reopen',7)),'review_session_archived');
  connection=await new Promise((resolve,reject)=>{const q=indexedDB.open(name,1);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
  await new Promise((resolve,reject)=>{const t=connection.transaction('cases','readwrite'),st=t.objectStore('cases'),q=st.get([dataset,s,item.id]);q.onsuccess=()=>{q.result.events[0].state='closed';st.put(q.result,[dataset,s,item.id]);};t.oncomplete=resolve;t.onabort=()=>reject(t.error);});
  await reject('corrupt archived event is surfaced, not reconstructed',()=>a.read(dataset,s),'review_storage_corrupt');
  check('active empty session remains usable after archived corruption',(await a.read(dataset)).active===fresh);
  await a.append(dataset,fresh,item,command('confirm',0));check('new session records are independent',(await a.read(dataset)).logs[0].events.length===1);
  const outcome={status:'PASS',checks:results.length,results,database:name};output.textContent=JSON.stringify(outcome,null,2);output.dataset.result='pass';
 }catch(e){output.textContent=JSON.stringify({status:'FAIL',error:e.message,results},null,2);output.dataset.result='fail';}
 finally{a?.close();b?.close();connection?.close();}
};`;
const bundled=await build({stdin:{contents:source,resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'browser'});
const html='<!doctype html><html><head><meta charset="utf-8"><title>Review native IDB contracts</title></head><body><h1>Native review storage contract</h1><button>Run storage contracts</button><pre role="status">Ready</pre><script type="module" src="/test.js"></script></body></html>';
const server=createServer((req,res)=>{res.setHeader('Cache-Control','no-store');if(req.url==='/test.js'){res.setHeader('Content-Type','text/javascript');res.end(bundled.outputFiles[0].text);}else if(req.url==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);}else{res.statusCode=404;res.end();}});
server.listen(63334,'127.0.0.1',()=>console.log('Native IDB contracts: http://127.0.0.1:63334'));
