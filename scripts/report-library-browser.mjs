// Real browser IDB contract harness. Unique test databases, loopback only.
import {createServer} from 'node:http';
import {build} from 'esbuild';
import {buildHistoryReport} from '../portals/app/app/analysis/history-report-service.ts';
import {reportArtifact} from '../portals/app/app/reports/local-service.ts';
const scope={city:'610100',county:'610113',site:'SX-DEMO-001',range:'month',month:'2026-10'},r=buildHistoryReport(scope),artifact=reportArtifact({...scope,kind:'history',snapshot:r.digest});
const source=`
import {localReportStore} from './portals/app/app/reports/local-store.ts';
import {sha256,fileMetadata} from './portals/app/app/reports/local-rules.ts';
const artifact=${JSON.stringify(artifact)},checks=[];
const check=(name,ok)=>{if(!ok)throw Error(name);checks.push(name);};
const reject=async(name,fn,error)=>{try{await fn();throw Error('unexpected_success');}catch(e){check(name,error?e.message===error:e.message!=='unexpected_success');}};
document.querySelector('button').onclick=async()=>{
 let a,b,raw;const name='bsmoss-report-contract-'+crypto.randomUUID(),out=document.querySelector('pre');document.querySelector('button').disabled=true;
 try{
  a=await localReportStore(name);b=await localReportStore(name);check('new library has no invented rows',(await a.read()).length===0);
  const [x,y]=await Promise.all([a.save(artifact),b.save(artifact)]);check('concurrent duplicate saves retain exactly one row and original timestamp',x.savedAt===y.savedAt&&(await a.read()).length===1);
  const f=fileMetadata(artifact.content),content=JSON.stringify({...f,scopeLabel:f.scopeLabel+' version two'}),second={schema:1,content,digest:await sha256(content)};
  const nativeAdd=IDBObjectStore.prototype.add;
  try{IDBObjectStore.prototype.add=function(){throw Error('test_write_failure');};await reject('failed append returns no success',()=>a.save(second),'test_write_failure');}finally{IDBObjectStore.prototype.add=nativeAdd;}
  check('failed transaction preserves only committed original',(await b.read()).length===1);await a.save(second);check('different file content creates separate immutable version',(await b.read()).length===2);
  const old=await a.save(artifact);check('repeat save does not replace saved time or file',old.savedAt===x.savedAt&&old.content===artifact.content);
  a.close();a=await localReportStore(name);const reopened=await a.read();check('close and reopen preserves exact original HTML JSON and metadata',reopened.length===2&&reopened.find(v=>v.saved.digest===artifact.digest).files.html===f.html&&reopened.find(v=>v.saved.digest===artifact.digest).files.json===f.json);
  await reject('tampered incoming package is rejected before storage',()=>a.save({...artifact,content:artifact.content+' '}),'report_file_changed');
  raw=await new Promise((resolve,reject)=>{const q=indexedDB.open(name,1);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
  await new Promise((resolve,reject)=>{const tx=raw.transaction('files','readwrite'),s=tx.objectStore('files'),q=s.get(artifact.digest);q.onsuccess=()=>s.put({...q.result,content:q.result.content+' '});tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});
  await reject('corrupt stored content is surfaced without clearing library',()=>a.read(),'report_storage_corrupt');
  const count=await new Promise(resolve=>{const tx=raw.transaction('files'),q=tx.objectStore('files').count();q.onsuccess=()=>resolve(q.result);});check('corruption never silently deletes old files',count===2);
  out.textContent=JSON.stringify({status:'PASS',checks:checks.length,results:checks,database:name},null,2);out.dataset.result='pass';
 }catch(e){out.textContent=JSON.stringify({status:'FAIL',error:e.message,results:checks},null,2);out.dataset.result='fail';}
 finally{a?.close();b?.close();raw?.close();}
};`;
const bundled=await build({stdin:{contents:source,resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'browser'});
const html='<!doctype html><html><head><meta charset="utf-8"><title>Report library native storage</title></head><body><h1>Report storage contract</h1><button>Run report storage checks</button><pre role="status">Ready</pre><script type="module" src="/test.js"></script></body></html>';
createServer((req,res)=>{res.setHeader('Cache-Control','no-store');if(req.url==='/test.js'){res.setHeader('Content-Type','text/javascript');res.end(bundled.outputFiles[0].text);}else if(req.url==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);}else{res.statusCode=404;res.end();}}).listen(63334,'127.0.0.1',()=>console.log('Native report storage checks: http://127.0.0.1:63334'));
