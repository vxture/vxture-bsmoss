import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createAuthorizedReportJobs } from '../../portals/app/app/domains/access/report-jobs.ts';
import { PgReportJobStore } from '../../portals/app/app/domains/supervision/pg-report-jobs.ts';
import { scanRegisteredReports, runRegisteredReport } from '../../portals/app/app/domains/reports/pg-schedule.ts';
import { fingerprintOf } from '../../portals/app/app/domains/aggregation/intervals.ts';

export async function reportJobMonitorCases(t,{db,adapterPool,access,scope,up,period,putTemplate,single,intercept}) {
  const inspectPorts={...access,async readLocalGrant(){return {...await access.readLocalGrant(),permissions:['reports.jobs.view']};}};
  const workerPorts={...access,now:()=>clock},subject=(await access.readVerifiedIdentity()).sub;
  const make=(p=inspectPorts,pool=adapterPool)=>createAuthorizedReportJobs(p,{create:s=>new PgReportJobStore(pool,s)},'interactive'),api=make();
  const narrow={...scope,deviceIds:[],metricKeys:[up.code+'@1']};
  const narrowPorts={...inspectPorts,async readLocalGrant(){return {...await inspectPorts.readLocalGrant(),scope:narrow};}};
  const definition={...single(),bindings:[{panelId:'usage',kind:'not_connected'}]},code='monitor-report-disconnected';await putTemplate(code,definition);
  let clock=Date.parse(period.end)+8*3600000;
  const base={subject,status:'active',scope:narrow,templateCode:code,templateVersion:1,templateSha256:fingerprintOf(definition),grain:'day',notBefore:period.start,delayMinutes:480,lookbackHours:72};
  async function register(id,patch={},revision=1){await db.query(`INSERT INTO bsmoss_integration.report_schedule_revision(workspace_id,id,revision,config,review_ref)
    VALUES ('w',$1,$2,$3,'fixture://monitor-registration')`,[id,revision,{...base,...patch}]);}
  async function task(patch={}){const scheduleId='monitor-'+randomUUID();await register(scheduleId,patch);const authorized=patch.scope?.allowSiteParameters?{...workerPorts,async readLocalGrant(){return {...await workerPorts.readLocalGrant(),scope:{...scope,allowSiteParameters:true}};}}:workerPorts;const scan=await scanRegisteredReports(adapterPool,authorized,scheduleId);return {scheduleId,id:scan.manifest.jobs.at(-1).id};}
  const list=(kind='generation',p=api)=>p.list({kind,status:'all',limit:25});
  const read=(task,kind='generation',p=api)=>p.read({kind,jobId:task.id??task});
  const counts=async()=>(await db.query(`SELECT (SELECT count(*) FROM bsmoss_analysis.report_generation_attempt) generation_attempts,
    (SELECT count(*) FROM bsmoss_analysis.report_export_attempt) export_attempts,(SELECT count(*) FROM bsmoss_analysis.report_revision) reports`)).rows[0];
  let first,dead,exportId;
  await t.test('report monitoring filters full registered scope before microsecond pagination without granting the reviewer worker identity',async()=>{
    const tasks=[];
    for(let n=0;n<5;n++){const v=await task();tasks.push(v);await db.query("UPDATE bsmoss_analysis.report_generation_job SET requested_at='2099-01-01T00:00:00.123000Z'::timestamptz+($2::int*interval '1 microsecond') WHERE id=$1",[v.id,n]);}
    const hidden=await task({scope});await db.query("UPDATE bsmoss_analysis.report_generation_job SET requested_at='2100-01-01Z' WHERE id=$1",[hidden.id]);
    const reviewer={...narrowPorts,async readVerifiedIdentity(){return {...await narrowPorts.readVerifiedIdentity(),sub:'operations-reviewer'};},async readLocalGrant(s){return {...await narrowPorts.readLocalGrant(),sub:s.sub};}};
    const monitored=make(reviewer),seen=[];let after;
    do {const p=await monitored.list({kind:'generation',status:'all',limit:2,...(after?{after}:{})});seen.push(...p.items.map(i=>i.id));after=p.next;}while(after);
    assert.deepEqual(seen.slice(0,5),tasks.map(v=>v.id).toReversed());assert.equal(seen.includes(hidden.id),false);assert.equal(new Set(seen).size,seen.length);first=tasks[0];
    const expected=(await db.query(`SELECT j.id FROM bsmoss_analysis.report_generation_job j JOIN bsmoss_integration.report_schedule_revision c ON (c.workspace_id,c.id,c.revision)=(j.workspace_id,j.schedule_id,j.schedule_revision)
      WHERE j.workspace_id='w' AND c.config->'scope'->'deviceIds'='[]'::jsonb AND c.config->'scope'->'metricKeys' <@ $1::jsonb
      AND c.config->'scope'->'sourceIds' <@ $2::jsonb AND c.config->'scope'->'stationIds' <@ $3::jsonb AND c.config->'scope'->'serviceIds' <@ $4::jsonb
      AND c.config->'scope'->'allowSiteParameters'='false'::jsonb ORDER BY j.requested_at DESC,j.id COLLATE "C" DESC`,[JSON.stringify(narrow.metricKeys),JSON.stringify(narrow.sourceIds),JSON.stringify(narrow.stationIds),JSON.stringify(narrow.serviceIds)])).rows.map(r=>r.id);
    assert.deepEqual(seen,expected);
    for(const field of ['sourceIds','stationIds','serviceIds','metricKeys']){const denied={...narrowPorts,async readLocalGrant(){return {...await narrowPorts.readLocalGrant(),scope:{...narrow,[field]:[]}};}};assert.equal(await read(first,'generation',make(denied)),null);}
    assert.equal(await read(hidden,'generation',make(narrowPorts)),null);
  });
  await t.test('report inspection preserves original schedule and exact result references and distinguishes pending delay from terminal attempts',async()=>{
    let v=await read(first);assert.equal(v.job.readiness,'ready');assert.deepEqual(v.attempts,[]);
    await db.query("UPDATE bsmoss_analysis.report_generation_job SET available_at=clock_timestamp()+interval '1 hour' WHERE id=$1",[first.id]);assert.equal((await read(first)).job.readiness,'delayed');
    await db.query("UPDATE bsmoss_analysis.report_generation_job SET available_at='2000-01-01Z' WHERE id=$1",[first.id]);
    const run=await runRegisteredReport(adapterPool,workerPorts,first.scheduleId,first.id);assert.equal(run.status,'succeeded');v=await read(first);
    assert.equal(v.job.status,'succeeded');assert.deepEqual(v.job.result,run.job.result);assert.equal(v.attempts[0].generationStatus,run.generationStatus);assert.deepEqual(v.attempts[0].result,v.job.result);
    const broken=intercept((c,sql,args)=>sql.includes('INSERT INTO bsmoss_analysis.report_revision')?c.query('SELECT * FROM monitor_generation_storage_missing'):c.query(sql,args));
    // The shared template may already have an idempotent report. Use a distinct
    // template to force a real write failure for every bounded attempt.
    const deadCode='monitor-dead-template';await putTemplate(deadCode,{...definition,title:'Monitor dead report'});const d=await task({templateCode:deadCode,templateSha256:fingerprintOf({...definition,title:'Monitor dead report'})});dead=d;
    for(let n=1;n<=5;n++){await db.query("UPDATE bsmoss_analysis.report_generation_job SET available_at='2000-01-01Z' WHERE id=$1",[d.id]);assert.equal((await runRegisteredReport(broken,workerPorts,d.scheduleId,d.id)).status,n===5?'dead':'retry');}
    v=await read(dead);assert.equal(v.job.status,'dead');assert.equal(v.attempts.length,5);assert.deepEqual(v.attempts.map(a=>a.failureCode),Array(5).fill('storage_failed'));assert.equal(v.job.result,null);
    assert.equal(JSON.stringify(v).includes('leaseToken'),false);
    const oldReplay=(await db.query('SELECT id,result_report_revision,result_current_revision FROM bsmoss_analysis.report_generation_job WHERE result_report_revision<>result_current_revision LIMIT 1')).rows[0];assert.ok(oldReplay);
    const oldDetail=await read(oldReplay.id);assert.equal(oldDetail.job.result.revision,oldReplay.result_report_revision);assert.equal(oldDetail.job.result.currentRevision,oldReplay.result_current_revision);
  });
  await t.test('historical registration replacement remains inspectable without pretending old pending work is dispatchable',async()=>{
    const p=await task();const raced=intercept(async(c,sql,args)=>{if(sql.startsWith('SELECT revision FROM bsmoss_integration.report_schedule_head'))await register(p.scheduleId,{status:'paused'},2);return c.query(sql,args);});
    const prior=await read(p,'generation',make(inspectPorts,raced));assert.equal(prior.job.readiness,'ready');assert.equal(prior.job.registration.currentRevision,'1');
    const next=await read(p);assert.equal(next.job.readiness,'registration_changed');assert.equal(next.job.registration.revision,'1');assert.equal(next.job.registration.currentRevision,'2');assert.equal(next.job.status,'pending');
    await assert.rejects(runRegisteredReport(adapterPool,workerPorts,p.scheduleId,p.id),/report_schedule_paused/);
  });
  await t.test('export monitoring filters historical report scope before limit and keeps publication and download freshness unchecked',async()=>{
    const selected=(await db.query(`SELECT j.*,r.manifest->'requiredScope' AS required_scope FROM bsmoss_analysis.report_export_job j JOIN bsmoss_analysis.report_revision r ON (r.workspace_id,r.report_id,r.revision)=(j.workspace_id,j.report_id,j.report_revision)
      WHERE j.workspace_id='w' AND r.manifest->'requiredScope'->'deviceIds'='[]'::jsonb AND r.manifest->'requiredScope'->'allowSiteParameters'='false'::jsonb
      AND jsonb_array_length(r.manifest->'requiredScope'->'serviceIds')>0 AND jsonb_array_length(r.manifest->'requiredScope'->'metricKeys')>0 ORDER BY j.requested_at LIMIT 1`)).rows[0];assert.ok(selected);
    const {required_scope:exportScope,...seed}=selected,exportPorts={...inspectPorts,async readLocalGrant(){return {...await inspectPorts.readLocalGrant(),scope:exportScope};}};
    const copies=[];for(let n=0;n<5;n++){const copy={...seed,id:randomUUID(),command_id:randomUUID(),status:'pending',attempt:'0',artifact_sha256:null,requested_at:'2099-02-01T00:00:00.123000Z'},keys=Object.keys(copy);await db.query('INSERT INTO bsmoss_analysis.report_export_job('+keys.join(',')+') VALUES ('+keys.map((_,i)=>'$'+(i+1)).join(',')+')',Object.values(copy));await db.query("UPDATE bsmoss_analysis.report_export_job SET requested_at=requested_at+($2::int*interval '1 microsecond') WHERE id=$1",[copy.id,n]);copies.push(copy.id);}
    const hiddenRow=(await db.query(`SELECT j.* FROM bsmoss_analysis.report_export_job j JOIN bsmoss_analysis.report_revision r ON (r.workspace_id,r.report_id,r.revision)=(j.workspace_id,j.report_id,j.report_revision)
      WHERE j.workspace_id='w' AND jsonb_array_length(r.manifest->'requiredScope'->'deviceIds')>0 ORDER BY j.requested_at LIMIT 1`)).rows[0];assert.ok(hiddenRow);
    const hidden={...hiddenRow,id:randomUUID(),command_id:randomUUID(),status:'pending',attempt:'0',artifact_sha256:null,requested_at:'2100-01-01Z'},keys=Object.keys(hidden);
    await db.query('INSERT INTO bsmoss_analysis.report_export_job('+keys.join(',')+') VALUES ('+keys.map((_,i)=>'$'+(i+1)).join(',')+')',Object.values(hidden));
    let after,seen=[];do {const p=await make(exportPorts).list({kind:'export',status:'all',limit:2,...(after?{after}:{})});seen.push(...p.items.map(j=>j.id));after=p.next;}while(after);
    assert.deepEqual(seen.slice(0,5),copies.toReversed());assert.equal(seen.includes(hidden.id),false);assert.equal(new Set(seen).size,seen.length);exportId=copies[0];
    assert.equal(await read(hidden.id,'export',make(exportPorts)),null);assert.equal((await read(hidden.id,'export')).job.id,hidden.id);
    const detail=await read(exportId,'export');assert.equal(detail.job.result.currentRevision,null);assert.equal(detail.job.publication.revision,seed.publication_revision);assert.equal('downloadable' in detail.job,false);assert.equal('freshness' in detail.job,false);assert.deepEqual(detail.attempts,[]);
    const success=(await db.query("SELECT id FROM bsmoss_analysis.report_export_job WHERE status='succeeded' ORDER BY requested_at LIMIT 1")).rows[0];assert.ok(success);const done=await read(success.id,'export');assert.equal(done.job.status,'succeeded');assert.equal(done.attempts.at(-1).artifactSha256,done.job.artifactSha256);
    for(const field of ['sourceIds','stationIds','serviceIds','metricKeys']){const denied={...exportPorts,async readLocalGrant(){return {...await exportPorts.readLocalGrant(),scope:{...exportScope,[field]:[]}};}};assert.equal(await read(exportId,'export',make(denied)),null);}
  });
  await t.test('report job permissions tenant and full original scope remain independent of report worker and workspace owner permissions',async()=>{
    const before=await counts();const owner={...inspectPorts,async readVerifiedIdentity(){return {...await inspectPorts.readVerifiedIdentity(),governanceRoles:['workspace:owner']};},async readLocalGrant(){return {...await inspectPorts.readLocalGrant(),permissions:['metering.view','reports.generate','reports.export','reports.export.execute']};}};
    await assert.rejects(list('generation',make(owner)),/permission_denied/);await assert.rejects(read(exportId,'export',make(owner)),/permission_denied/);
    const site=await task({scope:{...narrow,allowSiteParameters:true}});assert.equal(await read(site,'generation',make(narrowPorts)),null);
    const sitePorts={...inspectPorts,async readLocalGrant(){return {...await inspectPorts.readLocalGrant(),scope:{...scope,allowSiteParameters:true}};}};assert.equal((await read(site,'generation',make(sitePorts))).job.id,site.id);
    const foreign={...inspectPorts,async readVerifiedIdentity(){return {...await inspectPorts.readVerifiedIdentity(),activeWorkspace:'other'};},async readCoverage(){return {workspaceId:'other',product:'bsmoss',tier:'fixture',bundled:false,expiresAt:Date.now()+60000};},async readLocalGrant(){return {...await inspectPorts.readLocalGrant(),workspaceId:'other',scope:{...scope,workspaceId:'other'}};}};
    for(const kind of ['generation','export']){assert.deepEqual(await list(kind,make(foreign)),{items:[],next:null});assert.equal(await read(kind==='generation'?first:exportId,kind,make(foreign)),null);}
    assert.deepEqual(await counts(),before);
  });
  await t.test('report monitoring rechecks final identity entitlement permission expiry and actual scope while allowing unrelated scope reduction',async()=>{
    for(const kind of ['generation','export'])for(const action of ['read','list'])for(const mode of ['identity','coverage','permission','expiry','scope']){
      let reads=0;const p={...inspectPorts,async readVerifiedIdentity(){const i=await inspectPorts.readVerifiedIdentity();return reads&&mode==='identity'?{...i,sub:'changed-reviewer'}:i;},async readCoverage(w){const c=await inspectPorts.readCoverage(w);return reads&&mode==='coverage'?{...c,tier:null,bundled:false}:c;},async readLocalGrant(){const g=await inspectPorts.readLocalGrant();return ++reads===1?g:mode==='permission'?{...g,permissions:[]}:mode==='expiry'?{...g,expiresAt:0}:mode==='scope'?{...g,scope:{...scope,sourceIds:[]}}:g;}};
      const monitored=make(p);await assert.rejects(action==='read'?read(kind==='generation'?first:exportId,kind,monitored):list(kind,monitored),/denied|expired/);
    }
    let reads=0;const shrink={...inspectPorts,async readLocalGrant(){const g=await inspectPorts.readLocalGrant();return ++reads===1?g:{...g,scope:narrow};}};assert.equal((await read(first,'generation',make(shrink))).job.id,first.id);
  });
  await t.test('corrupt report task evidence and SQL failures are rejected rather than becoming empty histories or successful monitoring',async()=>{
    const before=await counts();
    const badScan=intercept(async(c,sql,args)=>{const r=await c.query(sql,args);if(sql.includes('SELECT manifest,manifest_sha256 FROM bsmoss_analysis.report_schedule_scan')&&r.rows[0])r.rows[0].manifest_sha256='0'.repeat(64);return r;});
    await assert.rejects(read(first,'generation',make(inspectPorts,badScan)),/invalid_report_scan_evidence/);
    const badAttempts=intercept(async(c,sql,args)=>{const r=await c.query(sql,args);if(sql.includes('FROM bsmoss_analysis.report_generation_attempt'))r.rows=[];return r;});await assert.rejects(read(dead,'generation',make(inspectPorts,badAttempts)),/invalid_report_job_evidence/);
    const broken=intercept((c,sql,args)=>sql.includes('CROSS JOIN LATERAL')?c.query('SELECT * FROM monitor_missing_table'):c.query(sql,args));
    await assert.rejects(list('generation',make(inspectPorts,broken)),e=>e.code==='42P01');await assert.rejects(read(exportId,'export',make(inspectPorts,broken)),e=>e.code==='42P01');
    assert.deepEqual(await counts(),before);assert.equal((await db.query("SELECT 1 FROM local_authz.permission WHERE perm_code='reports.jobs.view'")).rowCount,1);assert.equal((await db.query("SELECT 1 FROM local_authz.role_permission rp JOIN local_authz.permission p ON p.id=rp.permission_id WHERE p.perm_code='reports.jobs.view'")).rowCount,0);
  });
}
