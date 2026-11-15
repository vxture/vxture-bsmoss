import {writeFile} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {previewRoot,previewSeed,previewAccess} from '../portals/app/app/domains/tower-service/preview.ts';
import {readTowerPreview} from '../portals/app/app/domains/tower-service/history-reader.ts';
import {towerReportService} from '../portals/app/app/domains/tower-service/tower-report-service.ts';
import {DEFAULT_HISTORY_ID,HISTORY_END} from '../portals/app/app/domains/tower-service/history-calendar.ts';
process.env.BSMOSS_DATA_MODE='demo';
const state=previewSeed('published-demo'),result=await readTowerPreview({},undefined);
state.snapshots=result.versions;
const current=state.snapshots.at(-1);
state.rules=[...(current.inventory.evidence?.rules??[]),...(current.inventory.judgmentRules??[])];
const service=towerReportService({workspaceId:state.workspaceId,read:async()=>state,transaction:async(change,check)=>{await check();return change(state);}},
 {access:async()=>previewAccess(state.workspaceId),now:()=>Date.parse(HISTORY_END),id:()=> 'demo-october-2026'});
await service.generate({snapshotId:DEFAULT_HISTORY_ID,city:'all',county:'all'},'demo-monthly-2026-10');
await writeFile(previewRoot()+'/demo-history/published.json.gz',gzipSync(JSON.stringify(state)));
console.log('[published-demo] installed snapshots, agreements, judgment rules and monthly report');
