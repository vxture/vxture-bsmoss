import {renderedHtml as rendered} from './rendered-html.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {randomBytes} from 'node:crypto';
import {resolve} from 'node:path';
import {FileFoundationStore} from '../portals/app/app/domains/tower-service/store.ts';
import {judgmentFixture} from '../portals/app/app/domains/tower-service/judgment.fixture.ts';
import {serviceFixture} from '../portals/app/app/domains/tower-service/quantification.fixture.ts';
const appRoot=new URL('../portals/app/',import.meta.url),require=createRequire(new URL('package.json',appRoot));
async function server(preview,run){const child=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'start','--hostname','127.0.0.1','--port','0'],{cwd:appRoot,env:{...process.env,BSMOSS_PRODUCT_PREVIEW:preview?'on':'off',OIDC_RP_ENABLED:'off',NEXT_TELEMETRY_DISABLED:'1',DATABASE_URL:''},stdio:['ignore','pipe','pipe'],windowsHide:true});let output='';try{const base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('server_timeout')),30000),collect=chunk=>{output+=chunk;const match=output.match(/http:\/\/127\.0\.0\.1:\d+/);if(match&&output.includes('Ready')){clearTimeout(timer);resolve(match[0]);}};child.stdout.on('data',collect);child.stderr.on('data',collect);child.once('error',reject);child.once('exit',()=>{clearTimeout(timer);reject(Error(output));});});await run(base);}finally{if(child.exitCode===null){const stopped=new Promise(resolve=>child.once('exit',resolve));child.kill();await stopped;}}}
const root='/tower-service/',foundation='/api/product-preview/tower-foundation',reports='/api/product-preview/tower-reports';
const views=[['overview',''],['network',''],...['sites','sharing','regions'].map(v=>['resources',v]),...['operators','composition','periods'].map(v=>['services',v]),...['summary','details','rules'].map(v=>['evidence',v]),...['findings','reports'].map(v=>['judgment',v]),...['plans','snapshots','logs'].map(v=>['sync',v]),...['agreements','judgment','access'].map(v=>['rules',v])];
await test('T08 all 19 views retain the formal source boundary',{timeout:120000},()=>server(false,async base=>{
 assert.equal(views.length,19);
 for(const [page,view] of views){const r=await fetch(base+root+page+(view?'?view='+view:'')),html=rendered(await r.text());assert.equal(r.status,200,page+'/'+view);assert.ok(html.includes('\u5854\u670d\u7814\u5224'));assert.ok(!html.includes('SX-DEMO-001'));assert.ok(!html.includes('1,080'));}
 for(const api of [foundation,reports])assert.equal((await fetch(base+api)).status,404);
}));
await test('T08 integrated entry, scope, evidence and history acceptance',{timeout:240000},async t=>server(true,async base=>{
 const token=randomBytes(32).toString('hex'),workspace='preview-'+token,f=judgmentFixture(workspace),current=f.snapshot;
 current.id='qa-t08-current';current.inventory.descriptor.id=current.id;current.inventory.services=serviceFixture(...current.inventory.rows.map(r=>r.id));
 current.inventory.rows[1].city='610200';current.inventory.rows[1].cityName='QA Tongchuan';current.inventory.rows[1].county='610202';current.inventory.rows[1].countyName='QA Wangyi';
 const previous=structuredClone(current);previous.id='qa-t08-before';previous.inventory.descriptor.id=previous.id;previous.inventory.services.configurations[0].quantity='1';f.state.snapshots.push(previous);
 const store=new FileFoundationStore(resolve('tmp/tower-foundation'),workspace,()=>f.state);await store.transaction(async()=>{},async()=>{});
 const headers={cookie:'bsmoss-tower-preview-v1='+token},query='snapshotId=qa-t08-current&compareSnapshotId=qa-t08-before&operator=all&city=all&county=all';
 const get=async path=>{const r=await fetch(base+path,{headers});assert.equal(r.status,200,path);return rendered(await r.text());};
 await t.test('all 13 frontend and 6 backend views render; sync uses the management shell',async()=>{
  for(const [page,view] of views){const business=!['sync','rules'].includes(page),html=await get(root+page+'?'+(view?'view='+view+'&':'')+(business?query:''));assert.ok(!html.includes('\u5feb\u7167\u67e5\u8be2\u6761\u4ef6\u65e0\u6548'),page+'/'+view);assert.ok(html.includes('href="/tower-service/overview?'));if(!business){assert.ok(html.includes('href="/tower-service/sync"'));assert.ok(html.includes('href="/tower-service/rules"'));assert.ok(html.includes('\u539f\u6709\u529f\u80fd\uff08\u5f85\u8fc1\u79fb\uff09'));}}
 });
 await t.test('root retains original semantics and gear/brand point to new primary destinations',async()=>{
  const old=await get('/?city=610100&county=all');assert.ok(old.includes('\u8fd0\u884c\u603b\u89c8'));assert.ok(old.includes('href="/tower-service/rules"'));
  const modern=await get(root+'overview?'+query);assert.ok(modern.includes('\u7ecf\u8425\u603b\u89c8'));assert.ok(modern.includes('snapshotId=qa-t08-current&amp;compareSnapshotId=qa-t08-before'));assert.ok(modern.includes('<title>\u5854\u670d\u7814\u5224</title>'));
 });
 await t.test('same snapshot A/B preserves exact service deltas, monthly sharing and frozen agreements across boards',async()=>{
  const services=await get(root+'services?'+query+'&metric=mount');assert.ok(services.includes('Mounts'));assert.ok(services.includes('\u6570\u91cf\u5dee\u503c 1 item'));
  const sharing=await get(root+'resources?'+query+'&view=sharing');assert.ok(sharing.includes('qa-tenants-oct'));
  const evidence=await get(root+'evidence?'+query+'&view=rules');assert.ok(evidence.includes('QA-AGREEMENT-rule-a'));
  const city=await get(root+'resources?'+query.replace('city=all','city=610200'));assert.ok(city.includes('QA Tongchuan'));assert.ok(!city.includes('href="/tower-service/resources/SX-DEMO-001?'));
  const operator=await get(root+'services?'+query.replace('operator=all','operator=other'));assert.ok(operator.includes('Acceptance customer A'));assert.ok(!operator.includes('Acceptance mobile</'));
 });
 await t.test('report locks the cross-board context; history and exports survive context and catalogue changes',async()=>{
  const r=await fetch(base+reports,{method:'POST',headers:{...headers,origin:base,'content-type':'application/json'},body:JSON.stringify({action:'generate',query:Object.fromEntries(new URLSearchParams(query)),key:'t08-cutover-report'})});assert.equal(r.status,200);const report=(await r.json()).report;assert.equal(report.context.snapshotId,current.id);assert.equal(report.context.compareSnapshotId,previous.id);assert.equal(report.findings[0].actual,'100');
  await store.transaction(async state=>{const v=structuredClone(state.snapshots[0]);v.id='qa-t08-after';v.inventory.descriptor.id=v.id;v.inventory.judgmentRules=[];state.snapshots.push(v);},async()=>{});
  const history=await get(root+'judgment?view=reports&snapshotId=qa-t08-after');assert.ok(history.includes('\u7814\u5224\u62a5\u544a'));assert.ok((await(await fetch(base+reports,{headers})).json()).reports.some(r=>r.id===report.id));
  const exported=await fetch(base+reports+'?id='+report.id+'&format=json',{headers});assert.equal(exported.status,200);assert.match(exported.headers.get('cache-control'),/no-store/);assert.equal((await exported.json()).digest,report.digest);
  assert.equal((await fetch(base+reports+'?id='+report.id,{headers:{cookie:'bsmoss-tower-preview-v1='+randomBytes(32).toString('hex')}})).status,404);
  assert.equal((await fetch(base+'/reports')).status,200);
 });
}));
