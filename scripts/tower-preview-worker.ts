// Local-only schedule host. Separate from Next startup; no production connector.
import {readdir,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {previewRoot,previewFoundation} from '../portals/app/app/domains/tower-service/preview';
if(process.env.BSMOSS_PRODUCT_PREVIEW!=='on')throw Error('preview_worker_requires_explicit_mode');
let stopping=false;process.on('SIGTERM',()=>{stopping=true;});process.on('SIGINT',()=>{stopping=true;});
async function main(){
console.log('tower-preview-scheduler ready; local snapshots only');
while(!stopping){
 try{for(const dir of await readdir(previewRoot())){if(!/^[a-f0-9]{64}$/.test(dir))continue;try{const state=JSON.parse(await readFile(join(previewRoot(),dir,'foundation.json'),'utf8'));if(!/^preview-[a-f0-9]{64}$/.test(state.workspaceId)||createHash('sha256').update(state.workspaceId).digest('hex')!==dir)continue;if(state.plans.some((p:{enabled:boolean;nextAt:string|null})=>p.enabled&&p.nextAt&&Date.parse(p.nextAt)<=Date.now())){const runs=await previewFoundation(state.workspaceId.slice(8)).tick();console.log(JSON.stringify({at:new Date().toISOString(),runs:runs.map(r=>({id:r.id,status:r.status}))}));}}catch(error){console.error(error instanceof Error?error.message:'schedule_failed');}}}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')console.error('schedule_store_unavailable');}
 await new Promise(resolve=>setTimeout(resolve,15000));
}
}
void main().catch(()=>{console.error('preview_scheduler_failed');process.exitCode=1;});
