import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
test('delivery scripts validate the exact worker image before replacement and explicitly drain only named workers',{timeout:75000},()=>{
  const bash=process.platform==='win32'?'C:/Program Files/Git/bin/bash.exe':'bash';
  // Git Bash launches many short-lived commands. Leave room for process startup
  // under parallel type/unit checks; the synthetic script has no network waits.
  const result=spawnSync(bash,['scripts/test-worker-delivery.sh'],{encoding:'utf8',windowsHide:true,timeout:60000});
  assert.ifError(result.error);
  assert.equal(result.status,0,result.stdout+result.stderr);console.log(result.stdout.trim());
});
