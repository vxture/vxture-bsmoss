// Run from the repository: pnpm exec tsx scripts/seed-tower-history.ts
// --verify-only reads and verifies an existing bundle without writing.
// --output <directory> installs an isolated copy (useful for tests/backups).
import {resolve} from 'node:path';
import {writeFile,mkdir,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {previewInventory,previewRoot,previewAccess} from '../portals/app/app/domains/tower-service/preview';
import {readDemoHistory} from '../portals/app/app/domains/tower-service/history-store';
import {historyScope,materializeHistory,historyAggregate,auditHistory} from '../portals/app/app/domains/tower-service/history';
import {DEFAULT_HISTORY_ID,HISTORY_VERSION,HISTORY_START,HISTORY_END,historyWindow,historyId} from '../portals/app/app/domains/tower-service/history-calendar';
import {validateServices,serviceSummaryReader} from '../portals/app/app/domains/tower-service/quantification';
import {validateEvidence} from '../portals/app/app/domains/tower-service/evidence';
import {validateTenancy} from '../portals/app/app/domains/tower-service/tenancy';
async function main(){
const args=process.argv.slice(2);let output=resolve(previewRoot(),'demo-history'),verifyOnly=false;
for(let i=0;i<args.length;i++){if(args[i]==='--verify-only')verifyOnly=true;else if(args[i]==='--output'&&args[i+1])output=resolve(args[++i]);else throw Error('Usage: pnpm exec tsx scripts/seed-tower-history.ts [--verify-only] [--output <directory>]');}
const before=previewInventory(),baseDigest=createHash('sha256').update(JSON.stringify(before)).digest('hex'),started=performance.now();
const bundle=await readDemoHistory(output,before,!verifyOnly),h=bundle.history,scope=historyScope(h,previewAccess('history-script'),Date.now()),snapshot=materializeHistory(h,DEFAULT_HISTORY_ID,scope);
const audit=auditHistory(h);
validateServices(snapshot.inventory.services!);validateEvidence(snapshot.inventory.evidence!);validateTenancy(snapshot.inventory.tenancy!);
const sites=new Set(snapshot.inventory.rows.map(r=>r.id)),summary=serviceSummaryReader(snapshot.inventory.services)('supplied-energy',sites),aggregate=historyAggregate(h,DEFAULT_HISTORY_ID,'supplied-energy',scope,{city:'all',county:'all',operator:'all'});
if(summary.quantity!==aggregate.quantity)throw Error('history_aggregate_mismatch');
if(baseDigest!==createHash('sha256').update(JSON.stringify(previewInventory())).digest('hex'))throw Error('history_base_was_modified');
const report={version:HISTORY_VERSION,synthetic:true,start:HISTORY_START,endExclusive:HISTORY_END,timezone:'Asia/Shanghai',baseDigest,digest:bundle.digest,path:bundle.path,bytes:bundle.bytes,sites:h.sites.length,relationships:h.relations.length,sparseConfigurations:h.configs.length,dailyFacts:h.daily.length,days:h.days,monthlyTenantSnapshots:h.months.length,monthlyCountyCustomerAggregates:h.rollups?.length??0,hourlyRowsStored:0,monthlyPeriods:historyWindow(historyId('month',HISTORY_START)).length,selectedCheck:{id:DEFAULT_HISTORY_ID,quantityWh:summary.quantity},elapsedMs:Math.round(performance.now()-started),verifyOnly};
if(!verifyOnly){await mkdir(output,{recursive:true});await writeFile(resolve(output,HISTORY_VERSION+'-installation.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({...report,audit},null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
