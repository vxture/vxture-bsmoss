import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
// Offline generation only: never inherit a runtime database backend or session.
for(const script of ['seed-tower-history.ts','prepare-home.mjs','prepare-overview-reports.mjs','prepare-history.mjs','prepare-page-models.mjs','prepare-published-demo.mjs','prepare-monitoring.mjs']) {
 const result=spawnSync(process.execPath,['--import','tsx',fileURLToPath(new URL(script,import.meta.url))],{
  stdio:'inherit',env:{...process.env,BSMOSS_DEMO_STORAGE:'file',BSMOSS_DATA_MODE:'',DATABASE_URL:''},
 });
 if(result.error)throw result.error;
 if(result.status!==0)process.exit(result.status??1);
}
