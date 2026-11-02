import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { PgReportExportStore } from '../../portals/app/app/domains/reports/pg-exports.ts';
import { createAuthorizedReportExports } from '../../portals/app/app/domains/access/report-exports.ts';
import { renderPublishedReport } from '../../portals/app/app/domains/reports/render-html.ts';
import { readRefreshSnapshot } from '../../portals/app/app/domains/aggregation/refresh-snapshot.ts';
import { aggregateIntervals, mappingSetFingerprint } from '../../portals/app/app/domains/aggregation/intervals.ts';
import { aggregateStatePeriod } from '../../portals/app/app/domains/aggregation/state-period.ts';
import { aggregateGaugePeriod } from '../../portals/app/app/domains/aggregation/gauge-period.ts';
import { reportWorkerCases } from './report-worker.cases.mjs';
import { reportExportRecoveryCases } from './report-export-recovery.cases.mjs';

export async function reportExportCases(t,{db,adapterPool,scope,api,up,rate,state,gauge,period,target,write,publish,putTemplate,single,panel,command,intercept,publicationContext}) {
  const {pub,issue,publisher}=publicationContext;
  const access={...publisher,async readLocalGrant(){return {...await publisher.readLocalGrant(),permissions:['reports.export','reports.export.execute','metering.view']};}};
  const make=(ports=access,pool=adapterPool,renderer=renderPublishedReport)=>createAuthorizedReportExports(ports,{create:s=>new PgReportExportStore(pool,s,renderer)},'interactive'),exports=make();
  const counts=async()=>(await db.query('SELECT (SELECT count(*) FROM bsmoss_analysis.report_export_job) jobs,(SELECT count(*) FROM bsmoss_analysis.report_export_artifact) artifacts,(SELECT count(*) FROM bsmoss_analysis.report_export_attempt) attempts')).rows[0];
  const jobRow=async jobId=>(await db.query('SELECT * FROM bsmoss_analysis.report_export_job WHERE id=$1',[jobId])).rows[0];
  let ready,event,firstCommand,firstJob;
  const request=(commandId=randomUUID())=>({reportId:ready.reportId,publicationRevision:event.eventRevision,commandId});
  const enqueue=async()=>(await exports.request(request())).job;
  async function confirm(m) {
    const snapshot=await readRefreshSnapshot(adapterPool,scope,target(m)),plan={...snapshot.plan,sourceComplete:false,watermark:period.start};delete plan.completionEvidence;
    const calculate=snapshot.kind==='state'?aggregateStatePeriod:snapshot.kind==='gauge'?aggregateGaugePeriod:aggregateIntervals,base=calculate(plan,snapshot.inputs),device=m===state||m===gauge;
    const revision=(await db.query("SELECT coalesce(max(revision),0)+1 AS next FROM bsmoss_integration.source_completion_set WHERE workspace_id='w' AND source_id='report-src' AND metric_code=$1 AND grain='day' AND period_start=$2",[m.code,period.start])).rows[0].next;
    await db.query(`INSERT INTO bsmoss_integration.source_completion_set(workspace_id,id,source_id,station_id,service_id,network_object_id,device_id,metric_code,metric_version,grain,period_start,period_end,revision,status,input_fingerprint,mapping_manifest_sha256,watermark,evidence_ref,evidence_sha256,recorded_by)
      VALUES ('w',$1,'report-src','st',$2,$3,$4,$5,1,'day',$6,$7,$8,'confirmed',$9,$10,$7,'fixture://export-complete',$11,'fixture-reviewer')`,
      [randomUUID(),device?null:'report-svc',device?null:'report-cell',device?'report-dev':null,m.code,period.start,period.end,revision,base.inputFingerprint,mappingSetFingerprint(base.mappingWindows),'c'.repeat(64)]);await publish(m);
  }
  async function regenerate() {await confirm(up);ready=(await api.generate(command('export-ready',ready.revision))).record;event=(await pub.execute(issue(ready,event.eventRevision))).event;}
  await t.test('export request persists a version-bound asynchronous job with actor-bound idempotency and no premature content delivery',async()=>{
    for(const m of [up,rate,state,gauge])await confirm(m);
    const template={...single(),title:'Export <script>alert(1)</script> & fixture',panels:[panel('usage',up),panel('rate',rate,1),panel('state',state,2),{...panel('temperature',gauge,3),visible:false}],bindings:[up,rate,state,gauge].map((m,i)=>({panelId:['usage','rate','state','temperature'][i],kind:'aggregate',sourceId:'report-src',mappingId:target(m).mappingId}))};
    await putTemplate('export-ready',template);ready=(await api.generate(command('export-ready'))).record;assert.equal(ready.manifest.dataCompleteness,'complete');event=(await pub.execute(issue(ready))).event;
    firstCommand=request();const queued=await exports.request(firstCommand);firstJob=queued.job;assert.equal(queued.status,'inserted');assert.equal(firstJob.status,'pending');assert.equal(firstJob.attempt,0);assert.equal(firstJob.manifestSha256,ready.manifestSha256);assert.equal(firstJob.artifactSha256,null);
    const before=await counts();assert.equal((await exports.request(firstCommand)).status,'duplicate');assert.deepEqual(await counts(),before);assert.equal((await exports.status({jobId:firstJob.jobId})).downloadable,false);assert.equal(await exports.download({jobId:firstJob.jobId}),null);
    const other={...access,async readVerifiedIdentity(){return {...await access.readVerifiedIdentity(),sub:'other-exporter'};},async readLocalGrant(){return {...await access.readLocalGrant(),sub:'other-exporter'};}};await assert.rejects(make(other).request(firstCommand),/conflicting_export_replay/);
    const owner={...access,async readVerifiedIdentity(){return {...await access.readVerifiedIdentity(),governanceRoles:['workspace:owner']};},async readLocalGrant(){return {...await access.readLocalGrant(),permissions:['metering.view','reports.publish','reports.generate']};}};await assert.rejects(make(owner).request(request()),/permission_denied/);await assert.rejects(make(owner).run({jobId:firstJob.jobId}),/permission_denied/);
  });
  await t.test('one export worker transaction creates deterministic exact three-category HTML, immutable artifact and success receipt usable after restart',async()=>{
    const result=await exports.run({jobId:firstJob.jobId});assert.equal(result.status,'succeeded');assert.equal(result.job.attempt,1);
    const downloaded=await make().download({jobId:firstJob.jobId}),expected=renderPublishedReport(await pub.read({reportId:ready.reportId}));assert.equal(downloaded.html,expected.html);assert.equal(downloaded.sha256,expected.sha256);assert.match(downloaded.filename,/^bsmoss-report-[a-f0-9]{64}\.html$/);
    assert.ok(downloaded.html.includes('19 / 20'));assert.ok(downloaded.html.includes('25345'));assert.ok(downloaded.html.includes('86400000'));assert.ok(downloaded.html.includes('&lt;script&gt;'));assert.ok(!downloaded.html.includes('<script>'));assert.ok(downloaded.html.includes(ready.manifestSha256));
    const artifact=(await db.query('SELECT * FROM bsmoss_analysis.report_export_artifact WHERE job_id=$1',[firstJob.jobId])).rows[0];assert.equal(artifact.content_sha256,createHash('sha256').update(artifact.html).digest('hex'));
    const receipt=(await db.query('SELECT * FROM bsmoss_analysis.report_export_attempt WHERE job_id=$1',[firstJob.jobId])).rows[0];assert.equal(receipt.outcome,'succeeded');assert.equal(receipt.artifact_sha256,artifact.content_sha256);assert.equal(receipt.failure_code,null);
    const before=await counts();assert.equal((await exports.run({jobId:firstJob.jobId})).status,'terminal');assert.deepEqual(await counts(),before);assert.equal((await exports.status({jobId:firstJob.jobId})).downloadable,true);
  });
  await t.test('every export stage discards otherwise valid work after final permission identity entitlement expiry or required-scope revocation',async()=>{
    const pending=await enqueue();
    for(const stage of ['request','run','status','download'])for(const mode of ['permission','scope','identity','coverage','expiry']) {
      let reads=0;const revoked={...access,async readVerifiedIdentity(){const i=await access.readVerifiedIdentity();return mode==='identity'&&reads>0?{...i,sub:'changed-exporter'}:i;},async readCoverage(w){const c=await access.readCoverage(w);return mode==='coverage'&&reads>0?{...c,tier:null,bundled:false}:c;},
        async readLocalGrant(){const g=await access.readLocalGrant();return ++reads===1?g:mode==='permission'?{...g,permissions:[]}:mode==='scope'?{...g,scope:{...scope,deviceIds:[]}}:mode==='expiry'?{...g,expiresAt:0}:g;}};
      const before=await counts(),facade=make(revoked);await assert.rejects(stage==='request'?facade.request(request()):facade[stage]({jobId:stage==='run'?pending.jobId:firstJob.jobId}),/denied|expired/);assert.deepEqual(await counts(),before);assert.equal((await jobRow(pending.jobId)).attempt,'0');
    }
  });
  await t.test('skip-locked concurrent workers execute a job once and interrupted work rolls back to pending without a stuck lease',async()=>{
    const job=await enqueue();let entered,release;const locked=new Promise(r=>entered=r),gate=new Promise(r=>release=r);let pause=true;
    const held=intercept(async(c,sql,args)=>{const result=await c.query(sql,args);if(pause&&sql.includes('SELECT *,available_at<=clock_timestamp()')){pause=false;entered();await gate;}return result;});
    const running=make(access,held).run({jobId:job.jobId});await locked;try {assert.equal((await exports.run({jobId:job.jobId})).status,'busy_or_unavailable');}finally{release();}assert.equal((await running).status,'succeeded');
    const interrupted=await enqueue(),before=await counts();const stopped=intercept(async(c,sql,args)=>{const result=await c.query(sql,args);if(sql.includes('INSERT INTO bsmoss_analysis.report_export_artifact'))throw Error('fixture_worker_interrupted');return result;});
    await assert.rejects(make(access,stopped).run({jobId:interrupted.jobId}),/fixture_worker_interrupted/);assert.deepEqual(await counts(),before);assert.equal((await jobRow(interrupted.jobId)).status,'pending');assert.equal((await jobRow(interrupted.jobId)).attempt,'0');assert.equal((await make().run({jobId:interrupted.jobId})).status,'succeeded');
  });
  await t.test('durable export failures use database-time bounded backoff and preserve all five attempt receipts without partial artifacts',async()=>{
    const job=await enqueue(),failed=make(access,adapterPool,()=>{throw Error('export_renderer_failure');});
    for(let attempt=1;attempt<=5;attempt++) {
      const result=await failed.run({jobId:job.jobId});assert.equal(result.status,attempt===5?'dead':'retry');assert.equal(result.job.attempt,attempt);
      const receipts=(await db.query('SELECT * FROM bsmoss_analysis.report_export_attempt WHERE job_id=$1 ORDER BY attempt',[job.jobId])).rows;assert.equal(receipts.length,attempt);assert.ok(receipts.every(r=>r.failure_code==='render_failed'));assert.equal((await db.query('SELECT 1 FROM bsmoss_analysis.report_export_artifact WHERE job_id=$1',[job.jobId])).rowCount,0);
      if(attempt<5){const seconds=Number((await db.query('SELECT extract(epoch FROM available_at-clock_timestamp()) AS seconds FROM bsmoss_analysis.report_export_job WHERE id=$1',[job.jobId])).rows[0].seconds);assert.ok(seconds>5*2**(attempt-1)-2&&seconds<=5*2**(attempt-1));assert.equal((await failed.run({jobId:job.jobId})).status,'delayed');await db.query("UPDATE bsmoss_analysis.report_export_job SET available_at=clock_timestamp()-interval '1 second' WHERE id=$1",[job.jobId]);}
    }
    assert.equal((await failed.run({jobId:job.jobId})).status,'terminal');
    const large=await enqueue(),oversized=make(access,adapterPool,()=>({html:'x'.repeat(2097153),sha256:'a'.repeat(64)}));assert.equal((await oversized.run({jobId:large.jobId})).status,'dead');assert.equal((await db.query('SELECT failure_code FROM bsmoss_analysis.report_export_attempt WHERE job_id=$1',[large.jobId])).rows[0].failure_code,'export_too_large');
  });
  await t.test('artifact and receipt SQL failures cannot leave an untracked file or consume an unauthorized execution',async()=>{
    const job=await enqueue(),before=await counts(),broken=intercept((c,sql,args)=>sql.includes('INSERT INTO bsmoss_analysis.report_export_attempt')?c.query('SELECT * FROM export_fixture_absent'):c.query(sql,args));
    await assert.rejects(make(access,broken).run({jobId:job.jobId}),e=>e.code==='42P01');assert.deepEqual(await counts(),before);assert.equal((await jobRow(job.jobId)).status,'pending');
    const artifactFault=intercept((c,sql,args)=>sql.includes('INSERT INTO bsmoss_analysis.report_export_artifact')?c.query('SELECT * FROM export_fixture_absent'):c.query(sql,args));
    const result=await make(access,artifactFault).run({jobId:job.jobId});assert.equal(result.status,'retry');assert.equal((await db.query('SELECT failure_code FROM bsmoss_analysis.report_export_attempt WHERE job_id=$1',[job.jobId])).rows[0].failure_code,'storage_failed');assert.equal((await db.query('SELECT 1 FROM bsmoss_analysis.report_export_artifact WHERE job_id=$1',[job.jobId])).rowCount,0);
  });
  await t.test('downloads verify deterministic artifact content again and reject a valid database digest over altered HTML',async()=>{
    const old=(await db.query('SELECT * FROM bsmoss_analysis.report_export_artifact WHERE job_id=$1',[firstJob.jobId])).rows[0],changed=old.html+'<!-- changed -->',sha=createHash('sha256').update(changed).digest('hex');
    await db.query('BEGIN');try {await db.query('SET CONSTRAINTS ALL DEFERRED');await db.query('UPDATE bsmoss_analysis.report_export_artifact SET html=$2,content_sha256=$3 WHERE job_id=$1',[firstJob.jobId,changed,sha]);await db.query('UPDATE bsmoss_analysis.report_export_job SET artifact_sha256=$2 WHERE id=$1',[firstJob.jobId,sha]);await db.query('UPDATE bsmoss_analysis.report_export_attempt SET artifact_sha256=$2 WHERE job_id=$1',[firstJob.jobId,sha]);await db.query('COMMIT');}catch(error){await db.query('ROLLBACK');throw error;}
    try {await assert.rejects(exports.download({jobId:firstJob.jobId}),/invalid_export_artifact/);}finally{
      await db.query('BEGIN');try {await db.query('SET CONSTRAINTS ALL DEFERRED');await db.query('UPDATE bsmoss_analysis.report_export_artifact SET html=$2,content_sha256=$3 WHERE job_id=$1',[firstJob.jobId,old.html,old.content_sha256]);await db.query('UPDATE bsmoss_analysis.report_export_job SET artifact_sha256=$2 WHERE id=$1',[firstJob.jobId,old.content_sha256]);await db.query('UPDATE bsmoss_analysis.report_export_attempt SET artifact_sha256=$2 WHERE job_id=$1',[firstJob.jobId,old.content_sha256]);await db.query('COMMIT');}catch(error){await db.query('ROLLBACK');throw error;}
    }
    assert.equal((await exports.download({jobId:firstJob.jobId})).sha256,old.content_sha256);
  });
  await t.test('withdrawal blocks historical downloads and pending execution; republishing creates a new event and cannot revive old jobs',async()=>{
    const pending=await enqueue(),original=event.eventRevision;event=(await pub.execute(issue(ready,event.eventRevision,'withdrawn'))).event;
    assert.equal((await exports.status({jobId:firstJob.jobId})).blockingReason,'report_not_active');await assert.rejects(exports.download({jobId:firstJob.jobId}),/report_not_active/);await assert.rejects(exports.request(firstCommand),/report_not_active/);
    assert.equal((await exports.run({jobId:pending.jobId})).status,'dead');assert.equal((await db.query('SELECT failure_code FROM bsmoss_analysis.report_export_attempt WHERE job_id=$1',[pending.jobId])).rows[0].failure_code,'report_not_active');
    event=(await pub.execute(issue(ready,event.eventRevision))).event;assert.notEqual(event.eventRevision,original);await assert.rejects(exports.request({...firstCommand,publicationRevision:event.eventRevision}),/conflicting_export_replay/);await assert.rejects(exports.download({jobId:firstJob.jobId}),/report_not_active/);const newJob=await enqueue();assert.equal((await exports.run({jobId:newJob.jobId})).status,'succeeded');firstJob=newJob;
  });
  await t.test('published data corrections and new generated revisions invalidate existing exports instead of silently rebinding their content',async()=>{
    const pending=await enqueue();await write(up,{kind:'integer_delta',value:'90071992547409931234567899'});await publish();assert.equal((await exports.status({jobId:firstJob.jobId})).blockingReason,'report_stale');await assert.rejects(exports.download({jobId:firstJob.jobId}),/report_stale/);assert.equal((await exports.run({jobId:pending.jobId})).status,'dead');
    const previous=ready;await regenerate();await assert.rejects(exports.download({jobId:firstJob.jobId}),/report_not_active/);assert.notEqual(ready.revision,previous.revision);assert.equal(previous.manifest.items[0].data.publication.result.value.value,'993');const next=await enqueue();assert.equal((await exports.run({jobId:next.jobId})).status,'succeeded');firstJob=next;
  });
  await t.test('a publisher that changes after an export snapshot begins fences the old worker and preserves its pending job for safe retry',async()=>{
    const job=await enqueue(),before=await counts();let changed=false;
    const raced=intercept(async(c,sql,args)=>{if(!changed&&sql.includes('SELECT current_revision,current_publication_revision')){changed=true;event=(await pub.execute(issue(ready,event.eventRevision,'withdrawn'))).event;}return c.query(sql,args);});
    await assert.rejects(make(access,raced).run({jobId:job.jobId}),e=>e.code==='40001');assert.equal(changed,true);assert.deepEqual(await counts(),before);assert.equal((await jobRow(job.jobId)).attempt,'0');assert.equal((await jobRow(job.jobId)).status,'pending');assert.equal((await exports.run({jobId:job.jobId})).status,'dead');event=(await pub.execute(issue(ready,event.eventRevision))).event;
  });
  await t.test('export job queries and downloads isolate tenants and all required historic scope; SQL enforces artifact digests and immutable identities',async()=>{
    const current=await enqueue();assert.equal((await exports.run({jobId:current.jobId})).status,'succeeded');
    for(const patch of [{sourceIds:[]},{stationIds:[]},{serviceIds:[]},{deviceIds:[]},{metricKeys:[]}]){const denied={...access,async readLocalGrant(){return {...await access.readLocalGrant(),scope:{...scope,...patch}};}};await assert.rejects(make(denied).download({jobId:current.jobId}),/report_scope_denied/);await assert.rejects(make(denied).run({jobId:current.jobId}),/report_scope_denied/);}
    const foreign={...access,async readVerifiedIdentity(){return {...await access.readVerifiedIdentity(),activeWorkspace:'other'};},async readCoverage(){return {...await access.readCoverage('w'),workspaceId:'other'};},async readLocalGrant(){return {...await access.readLocalGrant(),workspaceId:'other',scope:{...scope,workspaceId:'other'}};}};assert.equal(await make(foreign).download({jobId:current.jobId}),null);assert.equal((await make(foreign).run({jobId:current.jobId})).status,'busy_or_unavailable');
    for(const sql of ['UPDATE bsmoss_analysis.report_export_job SET report_id=report_id','UPDATE bsmoss_analysis.report_export_job SET requested_by=requested_by','DELETE FROM bsmoss_analysis.report_export_job','UPDATE bsmoss_analysis.report_series SET current_publication_revision=current_publication_revision','UPDATE bsmoss_analysis.report_export_artifact SET html=html','DELETE FROM bsmoss_analysis.report_export_artifact','UPDATE bsmoss_analysis.report_export_attempt SET outcome=outcome','TRUNCATE bsmoss_analysis.report_export_attempt'])await assert.rejects(adapterPool.query(sql),e=>e.code==='42501');
    const job=await jobRow(current.jobId),copy={...job,id:randomUUID(),command_id:randomUUID(),workspace_id:'other'},keys=Object.keys(copy);copy.status='pending';copy.attempt='0';copy.artifact_sha256=null;await assert.rejects(db.query('INSERT INTO bsmoss_analysis.report_export_job('+keys.join(',')+') VALUES ('+keys.map((_,i)=>'$'+(i+1)).join(',')+')',Object.values(copy)),e=>e.code==='23503');
    await assert.rejects(db.query('UPDATE bsmoss_analysis.report_export_artifact SET content_sha256=$2 WHERE job_id=$1',[current.jobId,'f'.repeat(64)]),e=>e.code==='23514');
    for(const permission of ['reports.export','reports.export.execute']){assert.equal((await db.query('SELECT 1 FROM local_authz.permission WHERE perm_code=$1',[permission])).rowCount,1);assert.equal((await db.query('SELECT 1 FROM local_authz.role_permission rp JOIN local_authz.permission p ON p.id=rp.permission_id WHERE p.perm_code=$1',[permission])).rowCount,0);}
    assert.equal(await exports.status({jobId:'absent'}),null);assert.equal(await exports.download({jobId:'absent'}),null);
  });
  await t.test('a source correction during rendering preserves one export snapshot while the next download rejects its now-stale evidence',async()=>{
    const job=await enqueue(),original=ready.manifestSha256;let corrected=false;
    const raced=intercept(async(c,sql,args)=>{if(!corrected&&sql.includes('INSERT INTO bsmoss_analysis.report_export_artifact')){corrected=true;await write(up,{kind:'integer_delta',value:'995'});await publish();}return c.query(sql,args);});
    const result=await make(access,raced).run({jobId:job.jobId});assert.equal(result.status,'succeeded');assert.equal(corrected,true);assert.equal(result.job.manifestSha256,original);await assert.rejects(exports.download({jobId:job.jobId}),/report_stale/);
  });
  await t.test('formal HTML respects configured state duration or device-count units and keeps a zero-denominator ratio explicitly undefined',async()=>{
    for(const displayUnit of ['second','device_count']){
      const code='export-state-'+displayUnit,template={...single(),panels:[{...panel('state',state),view:'table',displayUnit}],bindings:[{panelId:'state',kind:'aggregate',sourceId:'report-src',mappingId:target(state).mappingId}]};
      await putTemplate(code,template);const r=(await api.generate(command(code))).record,p=(await pub.execute(issue(r))).event;
      const job=(await exports.request({reportId:r.reportId,publicationRevision:p.eventRevision,commandId:randomUUID()})).job;assert.equal((await exports.run({jobId:job.jobId})).status,'succeeded');const file=await exports.download({jobId:job.jobId});assert.ok(file.html.includes(displayUnit==='second'?'running=86400.00':'running=1'));assert.ok(file.html.includes('86400000'));
    }
    await write(rate,{kind:'ratio_parts',numerator:'0',denominator:'0'});await confirm(rate);
    await putTemplate('export-ratio-zero',{...single(),panels:[panel('rate',rate)],bindings:[{panelId:'rate',kind:'aggregate',sourceId:'report-src',mappingId:target(rate).mappingId}]});const r=(await api.generate(command('export-ratio-zero'))).record;
    assert.equal(r.manifest.dataCompleteness,'complete');const p=(await pub.execute(issue(r))).event,job=(await exports.request({reportId:r.reportId,publicationRevision:p.eventRevision,commandId:randomUUID()})).job;
    assert.equal((await exports.run({jobId:job.jobId})).status,'succeeded');assert.ok((await exports.download({jobId:job.jobId})).html.includes('\u65e0\u6709\u6548\u5206\u6bcd'));
  });
  await reportWorkerCases(t,{db,adapterPool,access,scope,api,rate,state,period,putTemplate,panel,target,intercept,pub,issue});
  await reportExportRecoveryCases(t,{db,adapterPool,scope,access,exports,makeExports:make,api,rate,state,putTemplate,single,panel,target,command,confirm,pub,issue,intercept});
}
