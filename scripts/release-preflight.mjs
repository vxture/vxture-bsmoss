import {readFileSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const checks=[];
const add=(id,ok,detail,required=true)=>checks.push({id,status:ok?'passed':required?'missing':'advisory_unavailable',required,detail});
function envFile(path){if(!path||!existsSync(path))return null;const parsed={};for(const line of readFileSync(path,'utf8').split(/\r?\n/)){const m=line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);if(m)parsed[m[1]]=m[2].trim().replace(/^(['"])(.*)\1$/,'$2');}return parsed;}
function https(value){try{return new URL(value).protocol==='https:';}catch{return false;}}
const app=envFile(process.env.BSMOSS_APP_ENV_FILE),stack=envFile(process.env.BSMOSS_STACK_ENV_FILE);
add('app_env',!!app,'Provide BSMOSS_APP_ENV_FILE pointing to the private target app.env; values are never printed.');
add('stack_env',!!stack,'Provide BSMOSS_STACK_ENV_FILE pointing to the private target stack.env.');
if(app){
  for(const key of ['DATABASE_URL','REDIS_URL','OIDC_CLIENT_SECRET','S2S_CLIENT_SECRET','PROVISION_WEBHOOK_SECRET','RP_SESSION_COOKIE_NAME'])add('app_'+key,!!app[key],'Required value present check only.');
  for(const key of ['OIDC_ISSUER','OIDC_REDIRECT_URI','OIDC_POST_LOGOUT_REDIRECT_URI','NEXT_PUBLIC_APP_URL','PLATFORM_API_URL','S2S_TOKEN_URL'])add('app_'+key,https(app[key]),'Registered HTTPS URL required; registration must also be verified externally.');
  add('preview_off',app.BSMOSS_PRODUCT_PREVIEW==='off','Formal runtime must disable synthetic preview.');add('oidc_enabled',app.OIDC_RP_ENABLED==='on','Real platform identity required.');
  let role=false;try{role=decodeURIComponent(new URL(app.DATABASE_URL).username)==='bsmoss_svc';}catch{}add('runtime_db_role',role,'Runtime must use bsmoss_svc, never the schema owner.');
  add('owner_separation',!app.POSTGRES_PASSWORD&&!app.POSTGRES_DB_OWNER,'Owner credentials must stay out of app.env.');
}
if(stack)for(const key of ['PROJECT_NAME','APP_PUBLISH_PORT','DATA_DIR','POSTGRES_DB','POSTGRES_DB_OWNER','POSTGRES_PASSWORD'])add('stack_'+key,!!stack[key],'Environment registry value required; presence does not prove allocation.');
const docker=spawnSync('docker',['info','--format','{{.OSType}}'],{encoding:'utf8',timeout:15000,windowsHide:true});
add('local_linux_docker',docker.status===0&&docker.stdout.trim()==='linux','Local image verification needs Linux Docker; GitHub-hosted builds and an authorized remote target can provide this separately.',false);
if(!process.argv.includes('--local-only')){
  const repo='vxture/vxture-bsmoss';
  function api(path){const r=spawnSync('gh',['api','repos/'+repo+path],{encoding:'utf8',timeout:20000,windowsHide:true});if(r.status!==0)return null;try{return JSON.parse(r.stdout);}catch{return null;}}
  const repository=api('');add('remote_commits',!!repository&&repository.size>0,'Remote repository must contain the reviewed source; no source is pushed by this script.');
  const repoVars=api('/actions/variables'),repoSecrets=api('/actions/secrets');
  add('repository_configuration_access',!!repoVars&&!!repoSecrets,'Read-only repository configuration-name inspection.');
  const envs=api('/environments');add('github_environments_access',!!envs,'Read-only GitHub environment inspection.');
  for(const stage of ['build','beta','prod']){
    const env=envs?.environments?.find(e=>e.name===stage);add('environment_'+stage,!!env,'Registered GitHub environment required.');
    if(!env)continue;
    const vars=api('/environments/'+stage+'/variables'),secrets=api('/environments/'+stage+'/secrets');
    add('environment_'+stage+'_readable',!!vars&&!!secrets,'Names only; secret values are never fetched.');
    const varNames=new Set([...(repoVars?.variables??[]),...(vars?.variables??[])].map(v=>v.name)),secretNames=new Set([...(repoSecrets?.secrets??[]),...(secrets?.secrets??[])].map(v=>v.name));
    for(const key of stage==='build'?['IMAGE_REPOSITORY']:['IMAGE_REPOSITORY','STACK_ROOT','DEPLOY_HOST','DEPLOY_USER'])add(stage+'_var_'+key,varNames.has(key),'Environment variable name required.');
    for(const key of stage==='build'?['NODE_AUTH_TOKEN']:['DEPLOY_SSH_KEY','DEPLOY_KNOWN_HOSTS','APP_ENV_FILE','STACK_ENV_FILE'])add(stage+'_secret_'+key,secretNames.has(key),'Environment secret name required; correctness not proven.');
    if(stage==='prod')add('prod_review_gate',env.protection_rules?.some(p=>p.type==='required_reviewers')??false,'Production review gate must be configured; business acceptance remains human-owned.');
  }
}
const result={schema:'bsmoss-release-preflight-v1',checkedAt:new Date().toISOString(),status:checks.every(c=>!c.required||c.status==='passed')?'technical_prerequisites_present':'prerequisites_missing',productionLaunch:false,scope:process.argv.includes('--local-only')?'local_only':'local_and_github',checks,manualGates:['Authorized source field/unit/grain/mapping sign-off','Platform client/entitlement and C1/C2/C3 live acceptance','Real source ingestion-to-authorized-query reconciliation','110k-scale capacity and 3x burst measurement','Backup restore and rollout/rollback exercise','Business UAT and production approval']};
mkdirSync('artifacts/release-preflight',{recursive:true});writeFileSync('artifacts/release-preflight/result.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));process.exitCode=result.status==='prerequisites_missing'?2:0;
