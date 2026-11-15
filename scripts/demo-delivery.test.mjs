import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
test('demo maintenance keeps seed/rollup independent and rolls back failed cutover',{timeout:90000},()=>{
 const bash=process.platform==='win32'?'C:/Program Files/Git/bin/bash.exe':'bash';
 const result=spawnSync(bash,['scripts/test-demo-delivery.sh'],{encoding:'utf8',windowsHide:true,timeout:80000});
 assert.ifError(result.error);assert.equal(result.status,0,result.stdout+result.stderr);
 console.log(result.stdout.trim());
});
test('standalone maintenance rejects invalid configuration without logging stdin',()=>{
 const result=spawnSync(process.execPath,['artifacts/maintenance/demo.cjs','invalid'],{encoding:'utf8',input:'["POSTGRES_PASSWORD=fixture-secret"]'});
 assert.equal(result.status,1);assert.ok(!result.stderr.includes('fixture-secret'));
});
