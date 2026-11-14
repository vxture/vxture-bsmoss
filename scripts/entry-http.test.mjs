import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
const appRoot=new URL('../portals/app/',import.meta.url),require=createRequire(new URL('package.json',appRoot));
async function server(enabled,run){
 const child=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'start','--hostname','127.0.0.1','--port','0'],{cwd:appRoot,env:{...process.env,BSMOSS_PRODUCT_PREVIEW:'off',OIDC_CLIENT_MODE:'third_party',OIDC_RP_ENABLED:enabled?'on':'off',OIDC_CLIENT_ID:'third-party-fixture',OIDC_CLIENT_SECRET:'fixture-not-a-live-secret',OIDC_REDIRECT_URI:'https://bsmoss.ruyin.work/api/auth/oidc/callback',NEXT_PUBLIC_APP_URL:'https://bsmoss.ruyin.work',REDIS_URL:'redis://127.0.0.1:1',DATABASE_URL:'',NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe'],windowsHide:true});let output='';
 try{const base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(output)),30000);const collect=c=>{output+=c;const m=output.match(/http:\/\/127\.0\.0\.1:\d+/);if(m&&output.includes('Ready')){clearTimeout(timer);resolve(m[0])}};child.stdout.on('data',collect);child.stderr.on('data',collect);child.once('error',reject)});await run(base);}finally{child.kill()}
}
test('third-party entry HTTP reads session authority and ignores requested display states',{timeout:60000},async()=>server(true,async base=>{
 for(const path of ['/api/entry-status','/api/entry-status?state=connected']){const r=await fetch(base+path);assert.equal(r.status,200);assert.match(r.headers.get('cache-control'),/private.*no-store/);assert.match(r.headers.get('vary'),/Cookie/);assert.deepEqual(await r.json(),{state:'signin'});}
 const out=await fetch(base+'/api/entry-status',{headers:{cookie:'bsmoss_signed_out=1'}});assert.deepEqual(await out.json(),{state:'signed-out'});
 const page=await fetch(base+'/entry');assert.equal(page.status,200);assert.match(await page.text(),/entry-card/);
 const callback=await fetch(base+'/api/auth/oidc/callback');assert.equal(callback.status,400);
}));
test('unconfigured third-party mode reports unavailable rather than fabricated login',{timeout:60000},async()=>server(false,async base=>{const r=await fetch(base+'/api/entry-status');assert.deepEqual(await r.json(),{state:'unavailable'});}));
