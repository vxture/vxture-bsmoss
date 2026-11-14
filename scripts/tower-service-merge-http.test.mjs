import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
const appRoot=new URL('../portals/app/',import.meta.url),require=createRequire(new URL('package.json',appRoot));
async function server(preview,run){
 const child=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'start','--hostname','127.0.0.1','--port','0'],{cwd:appRoot,env:{...process.env,BSMOSS_PRODUCT_PREVIEW:preview?'on':'off',OIDC_RP_ENABLED:'off',NEXT_TELEMETRY_DISABLED:'1',DATABASE_URL:''},stdio:['ignore','pipe','pipe'],windowsHide:true});
 let output='';
 try{const base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('server_timeout')),30000);const collect=chunk=>{output+=chunk;const match=output.match(/http:\/\/127\.0\.0\.1:\d+/);if(match&&output.includes('Ready')){clearTimeout(timer);resolve(match[0]);}};child.stdout.on('data',collect);child.stderr.on('data',collect);child.once('error',reject);child.once('exit',()=>{clearTimeout(timer);reject(Error(output));});});await run(base);}finally{if(child.exitCode===null){const stopped=new Promise(resolve=>child.once('exit',resolve));child.kill();await stopped;}}
}
const root='/tower-service/services',old='/tower-service/evidence',api='/api/product-preview/tower-foundation',csv='/api/product-preview/tower-evidence/export',snapshot='tower-demo-history-v1:month:2026-10-01';
const rendered=html=>html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'');
await test('merged service board preserves scopes, compatibility and export',{timeout:180000},async t=>server(true,async base=>{
 const session=await fetch(base+api),cookie=session.headers.get('set-cookie').split(';')[0],headers={cookie},before=await session.json();
 const get=async params=>{const r=await fetch(base+root+'?'+new URLSearchParams({snapshotId:snapshot,...params}),{headers});assert.equal(r.status,200);return rendered(await r.text());};
 await t.test('all five pages use the service title, shared navigation and one active destination',async()=>{
  for(const view of ['operators','periods','comparison','summary','details']){
   const html=await get({view});assert.ok(!html.includes('\u5feb\u7167\u67e5\u8be2\u6761\u4ef6\u65e0\u6548'),view);
   assert.ok(html.includes('service-unified-navigation'));for(const label of ['\u6309\u8fd0\u8425\u5546','\u5468\u671f\u53d8\u5316','\u53d8\u5316\u5bf9\u6bd4','\u4f9d\u636e\u6c47\u603b','\u8ba1\u91cf\u660e\u7ec6'])assert.ok(html.includes(label),label);
   assert.ok(html.includes('\u670d\u52a1\u91cf\u5316'));assert.ok(!html.includes('href="/tower-service/evidence'));
  }
 });
 await t.test('legacy paths redirect with all filters; rules remain configuration',async()=>{
  const r=await fetch(base+old+'?view=details&snapshotId='+encodeURIComponent(snapshot)+'&operator=mobile&city=610100&service=mounting-positions&dimension=configuration%3Amounting-positions',{headers,redirect:'manual'});
  assert.equal(r.status,307);const url=new URL(r.headers.get('location'),base);assert.equal(url.pathname,root);assert.equal(url.searchParams.get('operator'),'mobile');assert.equal(url.searchParams.get('service'),'mounting-positions');
  const rules=await fetch(base+old+'?view=rules&ruleA=A&ruleB=B',{headers,redirect:'manual'});assert.equal(rules.status,307);assert.ok(rules.headers.get('location').startsWith('/tower-service/rules'));
 });
 await t.test('stock and usage drill contexts render matching evidence and retain a safe analysis return',async()=>{
  const returnTo=root+'?'+new URLSearchParams({snapshotId:snapshot,view:'comparison',metric:'supplied-energy',city:'610100',county:'all',operator:'all',comparisonMode:'previous'});
  for(const service of ['mounting-positions','supplied-energy']){
   const html=await get({view:'details',city:'610100',county:'all',operator:'mobile',serviceMetric:service,service,dimension:service==='mounting-positions'?'configuration:'+service:'all',returnTo});
   assert.ok(!html.includes('\u5feb\u7167\u67e5\u8be2\u6761\u4ef6\u65e0\u6548'));assert.ok(html.includes('\u8fd4\u56de\u53d8\u5316\u5bf9\u6bd4'));assert.ok(html.includes(service));assert.ok(html.includes('\u9ad8\u65b0'));
  }
 });
 await t.test('export keeps the operator, region and service scope and remains private',async()=>{
  const r=await fetch(base+csv+'?'+new URLSearchParams({snapshotId:snapshot,view:'details',city:'610100',county:'all',operator:'mobile',serviceMetric:'mounting-positions',service:'mounting-positions',dimension:'configuration:mounting-positions',page:'2',pageSize:'10'}),{headers});
  assert.equal(r.status,200);assert.match(r.headers.get('cache-control'),/no-store/);assert.match(r.headers.get('vary'),/Cookie/);
  const text=await r.text(),rows=text.trim().split('\r\n');assert.ok(rows.length>11);assert.ok(rows.slice(1).every(line=>line.includes('mounting-positions')&&line.includes('configuration')));
  assert.ok(!text.includes('supplied-energy'));assert.equal((await fetch(base+csv)).status,401);
 });
 await t.test('invalid scopes, duplicate views and unsafe return targets cannot cross the merged boundary',async()=>{
  for(const q of ['view=summary&view=details','view=details&operator=forged','view=summary&workspaceId=forged','view=details&returnTo=https%3A%2F%2Fevil.example','view=details&dimension=amount']){const r=await fetch(base+root+'?'+q,{headers}),html=await r.text();assert.ok(html.includes('\u5feb\u7167\u67e5\u8be2\u6761\u4ef6\u65e0\u6548'),q);}
  const after=await(await fetch(base+api,{headers})).json();assert.deepEqual(after.snapshots,before.snapshots);
 });
}));
await test('formal mode withholds demo data on every merged page and export',{timeout:60000},async()=>server(false,async base=>{
 for(const view of ['operators','periods','comparison','summary','details']){const r=await fetch(base+root+'?view='+view),html=await r.text();assert.equal(r.status,200);assert.ok(html.includes('\u670d\u52a1\u91cf\u5316'));assert.ok(!html.includes('SX-DEMO-001'));assert.ok(!html.includes(snapshot));}
 assert.equal((await fetch(base+csv)).status,404);
}));
