import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createAuthorizedReportRecovery } from '../../portals/app/app/domains/access/report-recovery.ts';
import { createAuthorizedReportJobs } from '../../portals/app/app/domains/access/report-jobs.ts';
import { PgReportJobStore } from '../../portals/app/app/domains/supervision/pg-report-jobs.ts';
import { fingerprintOf } from '../../portals/app/app/domains/aggregation/intervals.ts';

export async function reportExportRecoveryCases(t,{db,adapterPool,scope,access,exports,makeExports,api,rate,state,putTemplate,single,panel,target,command,confirm,pub,issue,intercept}) {
  const ports={...access,async readVerifiedIdentity(){return {...await access.readVerifiedIdentity(),sub:'export-reviewer'};},async readLocalGrant(s){return {...await access.readLocalGrant(),sub:s.sub,permissions:['reports.jobs.recover']};}};
  const make=(p=ports,pool=adapterPool)=>createAuthorizedReportRecovery(p,{create:s=>new PgReportJobStore(pool,s)},'interactive'),recover=make();
  const viewer={...ports,async readLocalGrant(s){return {...await ports.readLocalGrant(s),permissions:['reports.jobs.view']};}};
  const monitor=createAuthorizedReportJobs(viewer,{create:s=>new PgReportJobStore(adapterPool,s)},'interactive');
  const read=id=>monitor.read({kind:'export',jobId:id});
  const row=async id=>(await db.query('SELECT * FROM bsmoss_analysis.report_export_job WHERE workspace_id=$1 AND id=$2',['w',id])).rows[0];
  const counts=async()=>(await db.query(`SELECT (SELECT count(*) FROM bsmoss_analysis.report_export_job) jobs,
    (SELECT count(*) FROM bsmoss_analysis.report_export_attempt) attempts,(SELECT count(*) FROM bsmoss_analysis.report_export_recovery) recoveries,
    (SELECT count(*) FROM bsmoss_analysis.report_export_artifact) artifacts`)).rows[0];
  const review=(j,patch={})=>({kind:'export',jobId:j.jobId,expectedAttempt:j.attempt,commandId:randomUUID(),reasonRef:'review://export-repaired',...patch});
  async function fixture(metric=rate,mode='terminal') {
    await confirm(metric);const code='export-recovery-'+randomUUID();
    await putTemplate(code,{...single(),panels:[panel('one',metric)],bindings:[{panelId:'one',kind:'aggregate',sourceId:'report-src',mappingId:target(metric).mappingId}]});
    const report=(await api.generate(command(code))).record,event=(await pub.execute(issue(report))).event;
    let job=(await exports.request({reportId:report.reportId,publicationRevision:event.eventRevision,commandId:randomUUID()})).job;
    const failed=makeExports(access,adapterPool,()=>{throw Error(mode==='retry'?'export_renderer_failure':'export_too_large');});
    for(let n=1;n<=(mode==='retry'?5:1);n++){await db.query("UPDATE bsmoss_analysis.report_export_job SET available_at='2000-01-01Z' WHERE id=$1",[job.jobId]);job=(await failed.run({jobId:job.jobId})).job;}
    assert.equal(job.status,'dead');return {report,event,job};
  }
  let first,receipt,firstReview;
  await t.test('reviewed export recovery retains all five failures and binds one new pending task to the exact original publication',async()=>{
    first=await fixture(rate,'retry');firstReview=review(first.job);const old=await read(first.job.jobId),result=await recover.recover(firstReview);receipt=result.record;
    assert.equal(result.status,'inserted');assert.notEqual(receipt.replacementJobId,first.job.jobId);assert.equal(receipt.requestedBy,'export-reviewer');assert.equal(receipt.originalAttempt,5);
    const next=await row(receipt.replacementJobId);for(const k of ['report_id','publication_revision','report_revision','manifest_sha256','renderer_version'])assert.equal(next[k],(await row(first.job.jobId))[k]);
    assert.equal(next.status,'pending');assert.equal(next.attempt,'0');assert.equal(next.artifact_sha256,null);assert.equal(next.requested_by,'export-reviewer');
    const original=await read(first.job.jobId);assert.deepEqual(original.attempts,old.attempts);assert.equal(original.attempts.length,5);assert.deepEqual(original.recovery,receipt);assert.deepEqual((await read(next.id)).recoveredFrom,receipt);
    assert.equal((await exports.run({jobId:next.id})).status,'succeeded');assert.ok((await exports.download({jobId:next.id})).html.includes(first.report.manifestSha256));
    const before=await counts();assert.deepEqual(await recover.recover(firstReview),{status:'duplicate',record:receipt});assert.deepEqual(await counts(),before);
  });
  await t.test('committed recovery replay confirms historical evidence after withdrawal without reviving download or rebinding a new release',async()=>{
    let event=(await pub.execute(issue(first.report,first.event.eventRevision,'withdrawn'))).event;
    const before=await counts();assert.deepEqual(await recover.recover(firstReview),{status:'duplicate',record:receipt});assert.deepEqual(await counts(),before);
    await assert.rejects(exports.download({jobId:receipt.replacementJobId}),/report_not_active/);
    event=(await pub.execute(issue(first.report,event.eventRevision))).event;assert.notEqual(event.eventRevision,first.event.eventRevision);
    assert.deepEqual((await recover.recover(firstReview)).record,receipt);await assert.rejects(exports.download({jobId:receipt.replacementJobId}),/report_not_active/);
    for(const patch of [{reasonRef:'review://changed'},{expectedAttempt:4}])await assert.rejects(recover.recover({...firstReview,...patch}),/conflicting_job_recovery/);
    const other={...ports,async readVerifiedIdentity(){return {...await ports.readVerifiedIdentity(),sub:'other-reviewer'};},async readLocalGrant(s){return {...await ports.readLocalGrant(s),sub:s.sub};}};
    await assert.rejects(make(other).recover(firstReview),/conflicting_job_recovery/);await assert.rejects(recover.recover(review(first.job)),/job_recovery_conflict/);
  });
  await t.test('first export recovery refuses pending succeeded stale withdrawn replaced and unsupported renderer bindings',async()=>{
    const pending=(await exports.request({reportId:first.report.reportId,publicationRevision:(await pub.read({reportId:first.report.reportId})).event.eventRevision,commandId:randomUUID()})).job;
    await assert.rejects(recover.recover(review(pending,{expectedAttempt:1})),/job_recovery_conflict/);assert.equal((await exports.run({jobId:pending.jobId})).status,'succeeded');await assert.rejects(recover.recover(review({...pending,attempt:1})),/job_recovery_conflict/);
    for(const mode of ['withdrawn','replaced','renderer','stale']) {
      const f=await fixture(),before=await counts();
      if(mode==='withdrawn'||mode==='replaced'){const e=(await pub.execute(issue(f.report,f.event.eventRevision,'withdrawn'))).event;if(mode==='replaced')await pub.execute(issue(f.report,e.eventRevision));}
      if(mode==='renderer')await db.query("UPDATE bsmoss_analysis.report_export_job SET renderer_version='retired-renderer' WHERE id=$1",[f.job.jobId]);
      // Staleness must be tested through actual report freshness. A source
      // completion withdrawal changes the current evidence without job edits.
      if(mode==='stale') {await db.query(`INSERT INTO bsmoss_integration.source_completion_set
        (workspace_id,id,source_id,station_id,service_id,network_object_id,metric_code,metric_version,grain,period_start,period_end,revision,status,input_fingerprint,mapping_manifest_sha256,watermark,evidence_ref,evidence_sha256,recorded_by)
        SELECT workspace_id,$1,source_id,station_id,service_id,network_object_id,metric_code,metric_version,grain,period_start,period_end,revision+1,'revoked',input_fingerprint,mapping_manifest_sha256,watermark,'fixture://recovery-withdrawal',evidence_sha256,recorded_by
        FROM bsmoss_integration.source_completion_set WHERE workspace_id='w' AND source_id='report-src' AND metric_code=$2 AND grain='day' ORDER BY revision DESC LIMIT 1`,[randomUUID(),rate.code]);}
      await assert.rejects(recover.recover(review(f.job)),mode==='renderer'?/export_renderer_unavailable/:mode==='stale'?/report_stale/:/report_not_active/);assert.deepEqual(await counts(),before);
    }
  });
  await t.test('recovery permission and full historical service and device scope are independent of owner or execution grants',async()=>{
    const f=await fixture(state),before=await counts();
    const owner={...ports,async readVerifiedIdentity(){return {...await ports.readVerifiedIdentity(),governanceRoles:['workspace:owner']};},async readLocalGrant(s){return {...await ports.readLocalGrant(s),permissions:['reports.jobs.view','reports.export','reports.export.execute','reports.generate']};}};
    await assert.rejects(make(owner).recover(review(f.job)),/permission_denied/);
    for(const key of ['sourceIds','stationIds','deviceIds','metricKeys']) {const denied={...ports,async readLocalGrant(s){return {...await ports.readLocalGrant(s),scope:{...scope,[key]:[]}};}};await assert.rejects(make(denied).recover(review(f.job)),/job_unavailable/);}
    const service=await fixture();const denied={...ports,async readLocalGrant(s){return {...await ports.readLocalGrant(s),scope:{...scope,serviceIds:[]}};}};await assert.rejects(make(denied).recover(review(service.job)),/job_unavailable/);
    const foreign={...ports,async readVerifiedIdentity(){return {...await ports.readVerifiedIdentity(),activeWorkspace:'other'};},async readCoverage(){return {...await ports.readCoverage('w'),workspaceId:'other'};},async readLocalGrant(s){return {...await ports.readLocalGrant(s),workspaceId:'other',scope:{...scope,workspaceId:'other'}};}};
    await assert.rejects(make(foreign).recover(review(f.job)),/job_unavailable/);assert.equal((await counts()).recoveries,before.recoveries);
    assert.equal((await db.query("SELECT 1 FROM local_authz.permission WHERE perm_code='reports.jobs.recover'")).rowCount,1);assert.equal((await db.query("SELECT 1 FROM local_authz.role_permission rp JOIN local_authz.permission p ON p.id=rp.permission_id WHERE p.perm_code='reports.jobs.recover'")).rowCount,0);
  });
  await t.test('physical export recovery independently requires the station-parameter switch at selection final commit and historical replay and preserves recovery chains',async()=>{
    const report=(await db.query("SELECT report_id,manifest->'requiredScope' AS required FROM bsmoss_analysis.report_revision WHERE workspace_id='w' AND manifest->'template'->>'code'='worker-site' ORDER BY revision DESC LIMIT 1")).rows[0];assert.ok(report);
    const siteScope=report.required,siteAccess={...access,async readLocalGrant(s){return {...await access.readLocalGrant(s),scope:siteScope};}},sitePorts={...ports,async readLocalGrant(s){return {...await ports.readLocalGrant(s),scope:siteScope};}};
    const publication=(await db.query("SELECT event_revision FROM bsmoss_analysis.report_publication_event WHERE workspace_id='w' AND report_id=$1 ORDER BY event_revision DESC LIMIT 1",[report.report_id])).rows[0];
    const job=(await makeExports(siteAccess).request({reportId:report.report_id,publicationRevision:publication.event_revision,commandId:randomUUID()})).job;
    const failed=makeExports(siteAccess,adapterPool,()=>{throw Error('export_too_large');}),dead=(await failed.run({jobId:job.jobId})).job,c=review(dead),before=await counts();
    const denied={...sitePorts,async readLocalGrant(s){return {...await sitePorts.readLocalGrant(s),scope:{...siteScope,allowSiteParameters:false}};}};
    await assert.rejects(make(denied).recover(c),/job_unavailable/);assert.deepEqual(await counts(),before);
    let reads=0;const revoked={...sitePorts,async readLocalGrant(s){const g=await sitePorts.readLocalGrant(s);return ++reads===1?g:{...g,scope:{...siteScope,allowSiteParameters:false}};}};
    await assert.rejects(make(revoked).recover(c),/report_scope_denied/);assert.deepEqual(await counts(),before);
    const first=(await make(sitePorts).recover(c)).record;await assert.rejects(make(denied).recover(c),/job_unavailable/);
    const next=(await failed.run({jobId:first.replacementJobId})).job;assert.equal(next.status,'dead');const second=(await make(sitePorts).recover(review(next))).record;
    const siteViewer={...sitePorts,async readLocalGrant(s){return {...await sitePorts.readLocalGrant(s),permissions:['reports.jobs.view']};}},detail=await createAuthorizedReportJobs(siteViewer,{create:s=>new PgReportJobStore(adapterPool,s)},'interactive').read({kind:'export',jobId:next.jobId});
    assert.deepEqual(detail.recoveredFrom,first);assert.deepEqual(detail.recovery,second);assert.equal((await makeExports(siteAccess).run({jobId:second.replacementJobId})).status,'succeeded');
  });
  await t.test('report-series fence rejects a withdrawal committed after the recovery snapshot and concurrent commands create at most one replacement',async()=>{
    const f=await fixture(),before=await counts();let changed=false;
    const raced=intercept(async(c,sql,args)=>{if(!changed&&sql.includes('SELECT current_revision,current_publication_revision')){changed=true;await pub.execute(issue(f.report,f.event.eventRevision,'withdrawn'));}return c.query(sql,args);});
    await assert.rejects(make(ports,raced).recover(review(f.job)),e=>e.code==='40001');assert.equal(changed,true);assert.deepEqual(await counts(),before);
    const next=await fixture(),results=await Promise.allSettled([recover.recover(review(next.job)),recover.recover(review(next.job))]);
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.ok(results.find(r=>r.status==='rejected'));assert.equal((await db.query('SELECT 1 FROM bsmoss_analysis.report_export_recovery WHERE original_job_id=$1',[next.job.jobId])).rowCount,1);
    const concurrentCommand=review((await fixture()).job),same=await Promise.allSettled([recover.recover(concurrentCommand),recover.recover(concurrentCommand)]);
    assert.ok(same.some(r=>r.status==='fulfilled'));assert.equal((await recover.recover(concurrentCommand)).status,'duplicate');
  });
  await t.test('final authorization and audit SQL failure roll back the replacement and receipt while retaining original terminal evidence',async()=>{
    const f=await fixture(),before=await counts();
    for(const mode of ['identity','workspace','coverage','permission','expiry','sourceIds','stationIds','serviceIds','metricKeys']) {
      let reads=0;const p={...ports,async readVerifiedIdentity(){const i=await ports.readVerifiedIdentity();return reads&&mode==='identity'?{...i,sub:'changed'}:reads&&mode==='workspace'?{...i,activeWorkspace:'other'}:i;},
        async readCoverage(w){const v=await ports.readCoverage(w);return reads&&mode==='coverage'?{...v,tier:null,bundled:false}:v;},async readLocalGrant(s){const g=await ports.readLocalGrant(s);return ++reads===1?g:mode==='permission'?{...g,permissions:[]}:mode==='expiry'?{...g,expiresAt:0}:mode.endsWith('Ids')||mode==='metricKeys'?{...g,scope:{...scope,[mode]:[]}}:g;}};
      await assert.rejects(make(p).recover(review(f.job)),/denied|expired|invalid_coverage/);assert.deepEqual(await counts(),before);assert.equal((await row(f.job.jobId)).status,'dead');
    }
    const broken=intercept((c,sql,args)=>sql.includes('INSERT INTO bsmoss_analysis.report_export_recovery')?c.query('SELECT * FROM export_recovery_missing'):c.query(sql,args));
    await assert.rejects(make(ports,broken).recover(review(f.job)),e=>e.code==='42P01');assert.deepEqual(await counts(),before);
    let reads=0;const narrowed={...ports,async readLocalGrant(s){const g=await ports.readLocalGrant(s);return ++reads===1?g:{...g,scope:f.report.manifest.requiredScope};}};
    assert.equal((await make(narrowed).recover(review(f.job))).status,'inserted');
  });
  await t.test('recovery audit enforces immutable database provenance and exact bindings and rejects corrupt historical replay',async()=>{
    const r=(await db.query('SELECT * FROM bsmoss_analysis.report_export_recovery WHERE command_id=$1',[firstReview.commandId])).rows[0];
    assert.ok(r.database_actor);assert.equal(r.manifest_sha256,fingerprintOf(r.manifest));assert.match(r.database_sha256,/^[a-f0-9]{64}$/);
    for(const sql of ['UPDATE bsmoss_analysis.report_export_recovery SET reason_ref=reason_ref','DELETE FROM bsmoss_analysis.report_export_recovery','TRUNCATE bsmoss_analysis.report_export_recovery'])await assert.rejects(adapterPool.query(sql),e=>e.code==='42501');
    for(const sql of ['UPDATE bsmoss_analysis.report_export_recovery SET reason_ref=reason_ref','DELETE FROM bsmoss_analysis.report_export_recovery','TRUNCATE bsmoss_analysis.report_export_recovery'])await assert.rejects(db.query(sql),/report_export_recovery_append_only/);
    // Disable only the user capture trigger inside a rolled-back DBA fixture
    // transaction to independently prove that the composite FK isolates tenants.
    await db.query('BEGIN');try {
      await db.query('ALTER TABLE bsmoss_analysis.report_export_recovery DISABLE TRIGGER report_export_recovery_capture');
      const foreign={...r,workspace_id:'other',command_id:randomUUID()},keys=Object.keys(foreign);
      await assert.rejects(db.query('INSERT INTO bsmoss_analysis.report_export_recovery('+keys.join(',')+') VALUES ('+keys.map((_,i)=>'$'+(i+1)).join(',')+')',Object.values(foreign)),e=>e.code==='23503');
    } finally {await db.query('ROLLBACK');}
    const fresh=await fixture(),c=review(fresh.job),original=await row(fresh.job.jobId),copy={...original,id:randomUUID(),command_id:'forged-recovery',status:'pending',attempt:'0',artifact_sha256:null},keys=Object.keys(copy);
    await db.query('INSERT INTO bsmoss_analysis.report_export_job('+keys.join(',')+') VALUES ('+keys.map((_,i)=>'$'+(i+1)).join(',')+')',Object.values(copy));
    await assert.rejects(db.query(`INSERT INTO bsmoss_analysis.report_export_recovery(workspace_id,command_id,original_job_id,original_attempt,replacement_job_id,reason_ref,requested_by,manifest,manifest_sha256)
      VALUES('w',$1,$2,1,$3,'review://forged','export-reviewer',$4,$5)`,[c.commandId,fresh.job.jobId,copy.id,r.manifest,r.manifest_sha256]),/invalid_report_recovery_binding/);
    const corrupt=intercept(async(client,sql,args)=>{const out=await client.query(sql,args);if(sql.includes('FROM bsmoss_analysis.report_export_recovery r')&&out.rows[0])out.rows[0].manifest_sha256='0'.repeat(64);return out;});
    await assert.rejects(make(ports,corrupt).recover(firstReview),/invalid_report_recovery_evidence/);
    await assert.rejects(createAuthorizedReportJobs(viewer,{create:s=>new PgReportJobStore(corrupt,s)},'interactive').read({kind:'export',jobId:first.job.jobId}),/invalid_report_recovery_evidence/);
    for(const mode of ['scope','binding','terminal','command']) {
      const forged=intercept(async(client,sql,args)=>{const out=await client.query(sql,args);if(sql.includes('FROM bsmoss_analysis.report_export_recovery r')&&out.rows[0]) {
        const v=out.rows[0],m=structuredClone(v.manifest);if(mode==='scope')m.requiredScope.metricKeys=[];if(mode==='binding')m.binding.reportRevision='999';if(mode==='terminal')m.original.terminal.recordedBy='forged-worker';if(mode==='command')m.replacement.commandId='forged-command';v.manifest=m;v.manifest_sha256=fingerprintOf(m);v.valid=true;
      }return out;});await assert.rejects(make(ports,forged).recover(firstReview),/invalid_report_recovery_evidence/);
    }
  });
}
