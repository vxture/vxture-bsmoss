import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, copyFile, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { createServer } from 'node:net';

const workspaceId='10000000-0000-0000-0000-000000000001';
const raw={version:1,kind:'aggregate',workspaceId,partitionIds:[],executeResults:true,maxStepsPerTick:1,pollMilliseconds:1000};
const normalized={version:1,healthTimeoutMilliseconds:180000,shutdownMilliseconds:90000,kind:'aggregate',worker:{workspaceId,subject:'s2s:bsmoss',maxStepsPerTick:1,pollMilliseconds:1000,partitionIds:[],executeResults:true}};
const digest=createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
async function fixture(run) {
  const root=await mkdtemp(join(tmpdir(),'bsmoss-host-smoke-')),binary=join(root,'worker.cjs'),config=join(root,'config.json'),health=join(root,'health.json');
  await copyFile('artifacts/worker/worker.cjs',binary);await writeFile(config,JSON.stringify(raw));
  const env={...process.env,NODE_PATH:'',NODE_OPTIONS:'',BSMOSS_WORKER_CONFIG_FILE:config,BSMOSS_WORKER_HEALTH_FILE:health,GIT_SHA:'fixture-worker-sha',
    BSMOSS_WORKER_KIND:'aggregate',BSMOSS_WORKER_ENABLED:'off',BSMOSS_PRODUCT_PREVIEW:'off',BSMOSS_METERING_ENABLED:'on',
    DATABASE_URL:'postgresql://bsmoss_svc:fixture-only@127.0.0.1:1/test',S2S_CLIENT_ID:'bsmoss',S2S_CLIENT_SECRET:'fixture-only',OIDC_CLIENT_SECRET:'',
    OIDC_ISSUER:'http://127.0.0.1:1',S2S_TOKEN_URL:'http://127.0.0.1:1/oidc/token',PLATFORM_API_URL:'http://127.0.0.1:1',PG_FORCE_NATIVE:''};
  try { await run({root,binary,config,health,env}); } finally { await rm(root,{recursive:true,force:true}); }
}
function start(f,extra={},args=[]) {
  const child=spawn(process.execPath,[f.binary,...args],{cwd:f.root,env:{...f.env,...extra},windowsHide:true,stdio:['ignore','pipe','pipe']});
  let output='';child.stdout.on('data',b=>{output+=b;});child.stderr.on('data',b=>{output+=b;});
  const done=new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>resolve({code,signal,output}));});
  return {child,done,output:()=>output};
}
async function until(check,running,timeout=30000) {
  // Identity transport has its own 10s deadline. Observation must also allow
  // process startup and health-file IO under load, using a monotonic clock.
  const end=performance.now()+timeout;
  for(;;){
    const value=await check();if(value)return value;
    if(running.child.exitCode!==null||running.child.signalCode!==null)throw Error('worker_exited_before_degraded');
    if(performance.now()>end)throw Error('worker_degraded_observation_timeout');
    await new Promise(r=>setTimeout(r,30));
  }
}
test('compiled worker runs without node_modules and refuses disabled preview unsafe config and browser-native mode without leaking credentials',{timeout:45000},async()=>fixture(async f=>{
  for(const patch of [{},{BSMOSS_WORKER_ENABLED:'on',BSMOSS_PRODUCT_PREVIEW:'on'},{BSMOSS_WORKER_ENABLED:'on',BSMOSS_WORKER_KIND:'report'},
    {BSMOSS_WORKER_ENABLED:'on',PG_FORCE_NATIVE:'1'},{BSMOSS_WORKER_ENABLED:'on',S2S_TOKEN_URL:'http://public.example/token'}]){
    const result=await start(f,patch).done;assert.equal(result.code,1);assert.equal(result.output.trim(),'\u007b"event":"worker_startup_or_host_failed"\u007d');assert.ok(!result.output.includes('fixture-only'));
  }
}));
test('compiled health CLI verifies digest live PID version state and stale records without loading web runtime',{timeout:45000},async()=>fixture(async f=>{
  const record={schema:'bsmoss-worker-health-v1',status:'running',kind:'aggregate',configSha256:digest,pid:process.pid,gitSha:f.env.GIT_SHA,updatedAt:Date.now(),completedSteps:1,failedSteps:0};
  await writeFile(f.health,JSON.stringify(record));assert.equal((await start(f,{},['health']).done).code,0);
  for(const patch of [{status:'degraded'},{status:'stopped'},{updatedAt:Date.now()-180001},{configSha256:'0'.repeat(64)},{pid:0},{gitSha:'wrong'}]){
    await writeFile(f.health,JSON.stringify({...record,...patch}));const result=await start(f,{},['health']).done;assert.equal(result.code,1);assert.equal(result.output.trim(),'\u007b"event":"worker_unhealthy"\u007d');
  }
}));
test('compiled validation checks the mounted config and runtime without contacting the database or identity endpoint',{timeout:45000},async()=>fixture(async f=>{
  const valid=await start(f,{BSMOSS_WORKER_ENABLED:'on'},['validate']).done;assert.equal(valid.code,0);assert.ok(valid.output.includes('worker_configuration_valid'));
  for(const patch of [{DATABASE_URL:'postgresql://postgres:fixture-only@127.0.0.1:1/test'},{BSMOSS_WORKER_KIND:'report'},{BSMOSS_WORKER_HEALTH_FILE:'relative.json'}]){
    const result=await start(f,{BSMOSS_WORKER_ENABLED:'on',...patch},['validate']).done;assert.equal(result.code,1);assert.ok(!result.output.includes('fixture-only'));
  }
}));
for(const transport of ['reset','stall']) test('compiled daemon marks real identity '+transport+' failures degraded and terminates without exposing secrets',{timeout:45000},async t=>fixture(async f=>{
  // Exercise immediate reset and the real 10s transport deadline separately.
  // Both listeners are local synthetic endpoints, with no customer data.
  let connections=0;const sockets=new Set();
  const server=createServer(socket=>{connections++;sockets.add(socket);socket.once('close',()=>sockets.delete(socket));if(transport==='reset')socket.resetAndDestroy();});await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
  const running=start(f,{BSMOSS_WORKER_ENABLED:'on',OIDC_ISSUER:`http://127.0.0.1:${port}`,S2S_TOKEN_URL:`http://127.0.0.1:${port}/token`,PLATFORM_API_URL:`http://127.0.0.1:${port}`});
  try {
    const health=await until(async()=>{try{const value=JSON.parse(await readFile(f.health,'utf8'));return value.status==='degraded'?value:false;}catch{return false;}},running);
    assert.ok(connections>0);assert.equal(health.configSha256,digest);assert.ok(health.failedSteps>=1);assert.equal(health.completedSteps,0);assert.equal(health.pid,running.child.pid);
    assert.ok(!running.output().includes('fixture-only'));assert.ok(!running.output().includes(workspaceId));
    if(process.platform==='win32') {
      // Windows has no POSIX SIGTERM delivery. A real CTRL_BREAK is not exposed
      // by Node pipes; local forced exit is not counted as graceful signal QA.
      t.diagnostic('Windows forced process cleanup only; POSIX graceful SIGTERM requires this test on Linux and is not claimed locally.');
      running.child.kill();await running.done;
    } else {
      running.child.kill('SIGTERM');const result=await running.done;assert.equal(result.code,0);
      assert.equal(JSON.parse(await readFile(f.health,'utf8')).status,'stopped');assert.ok(result.output.includes('worker_stopped'));
    }
  } finally { if(running.child.exitCode===null&&running.child.signalCode===null){running.child.kill();await running.done;}for(const socket of sockets)socket.destroy();await new Promise(r=>server.close(r)); }
}));
