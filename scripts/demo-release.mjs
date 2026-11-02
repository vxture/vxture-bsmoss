import {readdirSync,readFileSync,writeFileSync,mkdirSync,statSync,existsSync,copyFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const digest=b=>createHash('sha256').update(b).digest('hex');
const directories=['portals/app/app','portals/app/prisma','portals/app/public','portals/packages','scripts','deploy','.github','docs','.husky'];
const roots=['AGENTS.md','CLAUDE.md','README.md','.dockerignore','.editorconfig','.env.example','.gitignore','.gitleaks.toml','.npmrc','.osv-scanner.toml','docker-compose.yml','package.json','pnpm-lock.yaml','pnpm-workspace.yaml','tsconfig.json','portals/app/package.json','portals/app/tsconfig.json','portals/app/next-env.d.ts','portals/app/next.config.mjs','portals/app/Dockerfile'];
function walk(path){return readdirSync(path,{withFileTypes:true}).flatMap(e=>{const p=path+'/'+e.name;assert.ok(!e.isSymbolicLink(),'symlinks forbidden: '+p);return e.isDirectory()?walk(p):[p];});}
const paths=[...new Set([...roots,...directories.flatMap(walk)])].sort();
for(const p of paths){assert.ok(!/(?:^|\/)\.env(?:\.|$)/.test(p)||p.endsWith('.env.example'),'environment file forbidden');assert.ok(!/\.(?:key|pem|pdf|log|png|zip)$/i.test(p),'artifact/private file forbidden: '+p);}
const files=paths.map(path=>({path,bytes:statSync(path).size,sha256:digest(readFileSync(path))}));
const sourceSha256=digest(JSON.stringify(files));
const acceptance=JSON.parse(readFileSync('artifacts/demo-acceptance/result.json','utf8'));
const nextBuildId=readFileSync('portals/app/.next/BUILD_ID','utf8').trim();assert.equal(acceptance.status,'passed');assert.equal(acceptance.browser.status,'passed');assert.equal(acceptance.nextBuildId,nextBuildId,'acceptance build mismatch');assert.equal(acceptance.scenarios.length,6);
for(const s of acceptance.scenarios)for(const p of s.periods)assert.equal(digest(readFileSync('artifacts/demo-acceptance/'+p.filename)),p.sha256,'report evidence changed');
const evidencePaths=process.argv.slice(2);assert.ok(evidencePaths.length>=4,'supply final unit, HTTP, types and build logs');
const evidence=evidencePaths.map(path=>({path,sha256:digest(readFileSync(path)),bytes:statSync(path).size}));
const git=spawnSync('git',['rev-parse','--verify','HEAD'],{encoding:'utf8'});
const acceptanceRef={path:'artifacts/demo-acceptance/result.json',sha256:digest(readFileSync('artifacts/demo-acceptance/result.json'))};
const releaseId='bsmoss-demo-'+digest(JSON.stringify({sourceSha256,nextBuildId,evidence,acceptanceRef})).slice(0,16);
const manifest={schema:'bsmoss-demo-release-v1',releaseId,sourceSha256,createdAt:new Date().toISOString(),nextBuildId,gitSha:git.status===0?git.stdout.trim():null,sourceState:'content_hash_snapshot',productionLaunch:false,synthetic:true,files,evidence,acceptance:acceptanceRef};
const folder='artifacts/demo-release/'+manifest.releaseId;
for(const f of files){const target=folder+'/source/'+f.path;mkdirSync(dirname(target),{recursive:true});if(existsSync(target))assert.equal(digest(readFileSync(target)),f.sha256,'snapshot conflict');else copyFileSync(f.path,target);}
for(const [i,e] of evidence.entries()){mkdirSync(folder+'/evidence',{recursive:true});copyFileSync(e.path,folder+'/evidence/'+i+'.log');}
copyFileSync('artifacts/demo-acceptance/result.json',folder+'/evidence/acceptance.json');
writeFileSync(folder+'/manifest.json',JSON.stringify(manifest,null,2)+'\n');writeFileSync('artifacts/demo-release/manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({releaseId:manifest.releaseId,nextBuildId,sourceFiles:files.length,productionLaunch:false,manifest:'artifacts/demo-release/manifest.json'},null,2));
