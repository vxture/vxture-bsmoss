import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createAuthorizedReportRecovery } from '../../portals/app/app/domains/access/report-recovery.ts';
import { createAuthorizedReportJobs } from '../../portals/app/app/domains/access/report-jobs.ts';
import { PgReportJobStore } from '../../portals/app/app/domains/supervision/pg-report-jobs.ts';
import { scanRegisteredReports, pendingRegisteredReports, runRegisteredReport } from '../../portals/app/app/domains/reports/pg-schedule.ts';
import { fingerprintOf } from '../../portals/app/app/domains/aggregation/intervals.ts';

export async function reportGenerationRecoveryCases(t,{db,adapterPool,access,scope,up,period,putTemplate,single,intercept}) {
  const subject=(await access.readVerifiedIdentity()).sub,clock=Date.parse(period.end)+8*3600000;
  const worker={...access,now:()=>clock},ports={...access,async readVerifiedIdentity(){return {...await access.readVerifiedIdentity(),sub:'generation-reviewer'};},async readLocalGrant(s){return {...await access.readLocalGrant(),sub:s.sub,permissions:['reports.jobs.recover']};}};
  const make=(p=ports,pool=adapterPool)=>createAuthorizedReportRecovery(p,{create:s=>new PgReportJobStore(pool,s)},'interactive'),recover=make();
  const viewer={...ports,async readLocalGrant(s){return {...await ports.readLocalGrant(s),permissions:['reports.jobs.view']};}};
  const monitor=(p=viewer,pool=adapterPool)=>createAuthorizedReportJobs(p,{create:s=>new PgReportJobStore(pool,s)},'interactive');
  const read=(id,p=viewer,pool=adapterPool)=>monitor(p,pool).read({kind:'generation',jobId:id});
  const row=async id=>(await db.query("SELECT * FROM bsmoss_analysis.report_generation_job WHERE workspace_id='w' AND id=$1",[id])).rows[0];
  const counts=async()=>(await db.query(`SELECT (SELECT count(*) FROM bsmoss_analysis.report_generation_job) jobs,
    (SELECT count(*) FROM bsmoss_analysis.report_schedule_scan) scans,(SELECT count(*) FROM bsmoss_analysis.report_generation_attempt) attempts,
    (SELECT count(*) FROM bsmoss_analysis.report_generation_recovery) recoveries,(SELECT count(*) FROM bsmoss_analysis.report_revision) reports,
    (SELECT count(*) FROM bsmoss_analysis.report_outbox) outbox,(SELECT count(*) FROM bsmoss_analysis.report_publication_event) publications`)).rows[0];
  const review=(id,patch={})=>({kind:'generation',jobId:id,expectedAttempt:5,commandId:randomUUID(),reasonRef:'review://generation-repaired',...patch});
  const register=async(id,config,revision=1)=>db.query(`INSERT INTO bsmoss_integration.report_schedule_revision(workspace_id,id,revision,config,review_ref) VALUES('w',$1,$2,$3,'fixture://generation-recovery')`,[id,revision,config]);
  const broken=intercept((c,sql,args)=>sql.includes('INSERT INTO bsmoss_analysis.report_revision')?c.query('SELECT * FROM generation_recovery_storage_missing'):c.query(sql,args));
  async function die(f,id=f.id,pool=broken) {for(let n=1;n<=5;n++){await db.query("UPDATE bsmoss_analysis.report_generation_job SET available_at='2000-01-01Z' WHERE id=$1",[id]);assert.equal((await runRegisteredReport(pool,f.worker,f.scheduleId,id)).status,n===5?'dead':'retry');}}
  async function fixture({site=false,dead=true}={}) {
    const scheduleId='generation-recovery-'+randomUUID(),definition={...single(),title:scheduleId,bindings:[{panelId:'usage',kind:'not_connected'}]};await putTemplate(scheduleId,definition);
    const required={...scope,allowSiteParameters:site},config={subject,status:'active',scope:required,templateCode:scheduleId,templateVersion:1,templateSha256:fingerprintOf(definition),grain:'day',notBefore:period.start,delayMinutes:480,lookbackHours:72};
    await register(scheduleId,config);const p={...worker,async readLocalGrant(){return {...await worker.readLocalGrant(),scope:required};}},scan=await scanRegisteredReports(adapterPool,p,scheduleId),id=scan.manifest.jobs.at(-1).id,f={id,scheduleId,config,scan,definition,worker:p};if(dead)await die(f);return f;
  }
  let first,command,receipt;
  await t.test('generation recovery preserves five failures and the immutable scan while executing one linked task under the registered worker',async()=>{
    first=await fixture();command=review(first.id);const before=await counts(),original=await read(first.id),r=await recover.recover(command);receipt=r.record;
    assert.equal(r.status,'inserted');assert.equal(receipt.requestedBy,'generation-reviewer');const next=await row(receipt.replacementJobId),old=await row(first.id);
    assert.equal(next.recovery_of,first.id);assert.equal(next.scan_job_id,first.id);assert.equal(next.status,'pending');assert.equal(next.attempt,'0');assert.equal(next.requested_by,subject);
    for(const key of ['schedule_id','schedule_revision','schedule_sha256','grain'])assert.equal(next[key],old[key]);for(const key of ['scan_hour','period_start','period_end','due_at'])assert.equal(next[key].toISOString(),old[key].toISOString());
    assert.deepEqual((await read(first.id)).attempts,original.attempts);assert.deepEqual((await read(first.id)).recovery,receipt);assert.deepEqual((await read(next.id)).recoveredFrom,receipt);
    assert.equal((await counts()).scans,before.scans);assert.deepEqual((await scanRegisteredReports(adapterPool,first.worker,first.scheduleId)).manifest,first.scan.manifest);
    assert.ok((await pendingRegisteredReports(adapterPool,first.worker,first.scheduleId)).jobIds.includes(next.id));
    const executed=await runRegisteredReport(adapterPool,first.worker,first.scheduleId,next.id);assert.equal(executed.status,'succeeded');assert.equal(executed.job.scanJobId,first.id);assert.equal(executed.job.recoveryOf,first.id);assert.ok(executed.job.result);
    assert.equal((await counts()).publications,before.publications);assert.equal((await read(next.id)).attempts[0].recordedBy,subject);
    const after=await counts();assert.deepEqual(await recover.recover(command),{status:'duplicate',record:receipt});assert.deepEqual(await counts(),after);
  });
  await t.test('generation recovery exact replay retains its original scope after registration pause and replacement without permitting a new recovery or execution',async()=>{
    const f=await fixture(),c=review(f.id),r=(await recover.recover(c)).record;
    await register(f.scheduleId,{...f.config,status:'paused',subject:'replacement-worker'},2);const before=await counts();
    assert.deepEqual(await recover.recover(c),{status:'duplicate',record:r});assert.deepEqual(await counts(),before);
    await assert.rejects(recover.recover(review(f.id)),/job_recovery_conflict/);await assert.rejects(runRegisteredReport(adapterPool,f.worker,f.scheduleId,r.replacementJobId),/report_schedule_paused/);
    for(const patch of [{reasonRef:'review://changed'},{expectedAttempt:4}])await assert.rejects(recover.recover({...c,...patch}),/conflicting_job_recovery/);
    const other={...ports,async readVerifiedIdentity(){return {...await ports.readVerifiedIdentity(),sub:'other-reviewer'};},async readLocalGrant(s){return {...await ports.readLocalGrant(s),sub:s.sub};}};await assert.rejects(make(other).recover(c),/conflicting_job_recovery/);
    const p={...viewer,async readLocalGrant(s){return {...await viewer.readLocalGrant(s),scope:{...scope,deviceIds:[]}};}};assert.equal(await read(f.id,p),null);
  });
  await t.test('first generation recovery requires exact terminal attempt current active registration and its reviewed unchanged template',async()=>{
    const pending=await fixture({dead:false});await assert.rejects(recover.recover(review(pending.id,{expectedAttempt:1})),/job_recovery_conflict/);
    assert.equal((await runRegisteredReport(adapterPool,pending.worker,pending.scheduleId,pending.id)).status,'succeeded');await assert.rejects(recover.recover(review(pending.id,{expectedAttempt:1})),/job_recovery_conflict/);
    for(const mode of ['attempt','paused','subject','template']) {
      const f=await fixture(),before=await counts();if(mode==='paused'||mode==='subject')await register(f.scheduleId,{...f.config,...(mode==='paused'?{status:'paused'}:{subject:'different-worker'})},2);
      if(mode==='template')await db.query("UPDATE bsmoss_views.template_version SET definition=jsonb_set(definition,'{title}','\"Changed by DBA fixture\"') WHERE workspace_id='w' AND code=$1",[f.scheduleId]);
      await assert.rejects(recover.recover(review(f.id,mode==='attempt'?{expectedAttempt:4}:{})),mode==='template'?/report_schedule_template_changed/:/job_recovery_conflict/);assert.deepEqual(await counts(),before);
    }
  });
  await t.test('generation recovery scope and independent reviewer permission cannot impersonate the fixed registered worker',async()=>{
    const f=await fixture(),before=await counts(),owner={...ports,async readVerifiedIdentity(){return {...await ports.readVerifiedIdentity(),governanceRoles:['workspace:owner']};},async readLocalGrant(s){return {...await ports.readLocalGrant(s),permissions:['reports.jobs.view','reports.generate','reports.export.execute']};}};
    await assert.rejects(make(owner).recover(review(f.id)),/permission_denied/);
    for(const key of ['sourceIds','stationIds','serviceIds','deviceIds','metricKeys']){const p={...ports,async readLocalGrant(s){return {...await ports.readLocalGrant(s),scope:{...scope,[key]:[]}};}};await assert.rejects(make(p).recover(review(f.id)),/job_unavailable/);}
    const foreign={...ports,async readVerifiedIdentity(){return {...await ports.readVerifiedIdentity(),activeWorkspace:'other'};},async readCoverage(){return {...await ports.readCoverage('w'),workspaceId:'other'};},async readLocalGrant(s){return {...await ports.readLocalGrant(s),workspaceId:'other',scope:{...scope,workspaceId:'other'}};}};
    await assert.rejects(make(foreign).recover(review(f.id)),/job_unavailable/);assert.deepEqual(await counts(),before);
    const r=(await recover.recover(review(f.id))).record,notWorker={...ports,async readLocalGrant(s){return {...await ports.readLocalGrant(s),permissions:['reports.generate']};}};
    await assert.rejects(runRegisteredReport(adapterPool,notWorker,f.scheduleId,r.replacementJobId),/report_schedule_subject_denied/);assert.equal((await row(r.replacementJobId)).attempt,'0');
  });
  await t.test('generation recovery rolls back new job audit report and attempts on final identity entitlement permission expiry or full scope loss and SQL failure',async()=>{
    const f=await fixture(),before=await counts();
    for(const mode of ['identity','coverage','permission','expiry','sourceIds','stationIds','serviceIds','deviceIds','metricKeys']) {
      let reads=0;const p={...ports,async readVerifiedIdentity(){const i=await ports.readVerifiedIdentity();return reads&&mode==='identity'?{...i,sub:'changed'}:i;},async readCoverage(w){const v=await ports.readCoverage(w);return reads&&mode==='coverage'?{...v,tier:null,bundled:false}:v;},
        async readLocalGrant(s){const g=await ports.readLocalGrant(s);return ++reads===1?g:mode==='permission'?{...g,permissions:[]}:mode==='expiry'?{...g,expiresAt:0}:mode.endsWith('Ids')||mode==='metricKeys'?{...g,scope:{...scope,[mode]:[]}}:g;}};
      await assert.rejects(make(p).recover(review(f.id)),/denied|expired/);assert.deepEqual(await counts(),before);assert.equal((await row(f.id)).status,'dead');
    }
    const failed=intercept((c,sql,args)=>sql.includes('INSERT INTO bsmoss_analysis.report_generation_recovery')?c.query('SELECT * FROM generation_recovery_audit_missing'):c.query(sql,args));
    await assert.rejects(make(ports,failed).recover(review(f.id)),e=>e.code==='42P01');assert.deepEqual(await counts(),before);
  });
  await t.test('physical station authority is required at generation recovery selection final commit and historical replay even for disconnected template data',async()=>{
    const f=await fixture({site:true}),required=f.config.scope,p={...ports,async readLocalGrant(s){return {...await ports.readLocalGrant(s),scope:required};}},c=review(f.id),before=await counts();
    await assert.rejects(recover.recover(c),/job_unavailable/);let reads=0;const revoked={...p,async readLocalGrant(s){const g=await p.readLocalGrant(s);return ++reads===1?g:{...g,scope:{...required,allowSiteParameters:false}};}};
    await assert.rejects(make(revoked).recover(c),/report_scope_denied/);assert.deepEqual(await counts(),before);const result=await make(p).recover(c);assert.equal(result.status,'inserted');
    await assert.rejects(recover.recover(c),/job_unavailable/);assert.equal((await make(p).recover(c)).status,'duplicate');assert.equal((await runRegisteredReport(adapterPool,f.worker,f.scheduleId,result.record.replacementJobId)).status,'succeeded');
  });
  await t.test('generation recovery chains keep the same original scan root and do not change ordinary scan-window uniqueness or create unaudited tasks',async()=>{
    const f=await fixture(),r1=(await recover.recover(review(f.id))).record;await die(f,r1.replacementJobId);const r2=(await recover.recover(review(r1.replacementJobId))).record;
    const middle=await read(r1.replacementJobId);assert.deepEqual(middle.recoveredFrom,r1);assert.deepEqual(middle.recovery,r2);assert.equal((await row(r2.replacementJobId)).scan_job_id,f.id);
    assert.equal((await runRegisteredReport(adapterPool,f.worker,f.scheduleId,r2.replacementJobId)).status,'succeeded');assert.deepEqual((await scanRegisteredReports(adapterPool,f.worker,f.scheduleId)).manifest,f.scan.manifest);
    const original=await row(f.id),copy={...original,id:randomUUID(),status:'pending',attempt:'0'},keys=Object.keys(copy),sql='INSERT INTO bsmoss_analysis.report_generation_job('+keys.join(',')+') VALUES ('+keys.map((_,i)=>'$'+(i+1)).join(',')+')';
    await assert.rejects(db.query(sql,Object.values(copy)),e=>e.code==='23505');
    const orphan={...copy,id:randomUUID(),recovery_of:f.id,scan_job_id:f.id};await assert.rejects(db.query(sql,Object.keys(copy).map(k=>orphan[k])),e=>e.code==='23503');
    const foreign={...orphan,id:randomUUID(),workspace_id:'other'};await assert.rejects(db.query(sql,Object.keys(copy).map(k=>foreign[k])),e=>e.code==='23503');
    for(const statement of ['UPDATE bsmoss_analysis.report_generation_job SET recovery_of=recovery_of','UPDATE bsmoss_analysis.report_generation_job SET scan_job_id=scan_job_id'])await assert.rejects(adapterPool.query(statement),e=>e.code==='42501');
  });
  await t.test('generation recovery serializes current registration updates and competing commands without creating duplicate linked jobs',async()=>{
    const f=await fixture(),before=await counts();let changed=false;
    const raced=intercept(async(c,sql,args)=>{if(!changed&&sql.includes('SELECT bsmoss_integration.lock_report_schedule')){changed=true;await register(f.scheduleId,{...f.config,status:'paused'},2);}return c.query(sql,args);});
    await assert.rejects(make(ports,raced).recover(review(f.id)),e=>e.code==='40001');assert.equal(changed,true);assert.deepEqual(await counts(),before);
    const next=await fixture(),results=await Promise.allSettled([recover.recover(review(next.id)),recover.recover(review(next.id))]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
    const exact=review((await fixture()).id),same=await Promise.allSettled([recover.recover(exact),recover.recover(exact)]);assert.ok(same.some(r=>r.status==='fulfilled'));assert.equal((await recover.recover(exact)).status,'duplicate');
    assert.equal((await db.query('SELECT 1 FROM bsmoss_analysis.report_generation_recovery WHERE original_job_id=$1',[next.id])).rowCount,1);
  });
  await t.test('generation recovery database evidence is immutable and both worker and monitor reject forged scan scope binding terminal or digest',async()=>{
    const f=await fixture(),c=review(f.id),r=(await recover.recover(c)).record,before=await counts();
    for(const mode of ['sha','scope','root','terminal']) {
      const bad=intercept(async(client,sql,args)=>{const out=await client.query(sql,args);if(sql.includes('FROM bsmoss_analysis.report_generation_recovery r')&&out.rows[0]) {
        const v=out.rows[0],m=structuredClone(v.manifest);if(mode==='scope')m.requiredScope.metricKeys=[];if(mode==='root')m.binding.scanJobId='forged-root';if(mode==='terminal')m.original.terminal.recordedBy='forged-worker';v.manifest=m;v.manifest_sha256=mode==='sha'?'0'.repeat(64):fingerprintOf(m);v.valid=true;
      }return out;});await assert.rejects(make(ports,bad).recover(c),/invalid_report_recovery_evidence/);await assert.rejects(read(r.replacementJobId,viewer,bad),/invalid_report_recovery_evidence/);
      await assert.rejects(runRegisteredReport(bad,f.worker,f.scheduleId,r.replacementJobId),/invalid_report_recovery_evidence/);assert.deepEqual(await counts(),before);
    }
    const badScan=intercept(async(client,sql,args)=>{const out=await client.query(sql,args);if(sql.includes('SELECT manifest,manifest_sha256 FROM bsmoss_analysis.report_schedule_scan')&&out.rows[0])out.rows[0].manifest_sha256='0'.repeat(64);return out;});
    await assert.rejects(runRegisteredReport(badScan,f.worker,f.scheduleId,r.replacementJobId),/invalid_report_scan_evidence/);assert.deepEqual(await counts(),before);
    for(const sql of ['UPDATE bsmoss_analysis.report_generation_recovery SET reason_ref=reason_ref','DELETE FROM bsmoss_analysis.report_generation_recovery','TRUNCATE bsmoss_analysis.report_generation_recovery']){await assert.rejects(adapterPool.query(sql),e=>e.code==='42501');await assert.rejects(db.query(sql+(sql.startsWith('TRUNCATE')?' CASCADE':'')),/append_only/);}
    const audit=(await db.query('SELECT * FROM bsmoss_analysis.report_generation_recovery WHERE command_id=$1',[c.commandId])).rows[0];assert.ok(audit.database_actor);assert.match(audit.database_sha256,/^[a-f0-9]{64}$/);assert.equal(audit.manifest_sha256,fingerprintOf(audit.manifest));
    const missing=intercept((client,sql,args)=>sql.includes('FROM bsmoss_analysis.report_generation_recovery r')?client.query('SELECT * FROM generation_recovery_read_missing'):client.query(sql,args));
    await assert.rejects(runRegisteredReport(missing,f.worker,f.scheduleId,r.replacementJobId),e=>e.code==='42P01');assert.deepEqual(await counts(),before);
  });
  await t.test('generation recovery SQL independently rejects wrong scan roots shrunk scope and foreign terminal references and captures review provenance',async()=>{
    const f=await fixture(),other=await fixture(),before=await counts();
    for(const mode of ['root','scope','terminal']) {
      const forged=intercept((client,sql,args)=>{
        if(mode==='root'&&sql.includes('INSERT INTO bsmoss_analysis.report_generation_job')){const changed=[...args];changed[12]=other.id;return client.query(sql,changed);}
        if(mode!=='root'&&sql.includes('INSERT INTO bsmoss_analysis.report_generation_recovery')){const changed=[...args],m=structuredClone(changed[7]);if(mode==='scope')m.requiredScope.metricKeys=[];else m.original.terminal.recordedBy='forged-worker';changed[7]=m;changed[8]=fingerprintOf(m);return client.query(sql,changed);}
        return client.query(sql,args);
      });await assert.rejects(make(ports,forged).recover(review(f.id)),/invalid_report_recovery_binding/);assert.deepEqual(await counts(),before);
    }
    const c=review(f.id),r=(await recover.recover(c)).record,audit=(await db.query('SELECT * FROM bsmoss_analysis.report_generation_recovery WHERE command_id=$1',[c.commandId])).rows[0];
    assert.equal(audit.manifest.requestedBy,'generation-reviewer');assert.equal(audit.manifest.binding.requestedBy,subject);assert.equal(audit.manifest.binding.scanJobId,f.id);assert.equal(audit.replacement_job_id,r.replacementJobId);
    await db.query('BEGIN');try {
      await db.query('ALTER TABLE bsmoss_analysis.report_generation_recovery DISABLE TRIGGER report_generation_recovery_capture');const foreign={...audit,workspace_id:'other',command_id:randomUUID()},keys=Object.keys(foreign);
      await assert.rejects(db.query('INSERT INTO bsmoss_analysis.report_generation_recovery('+keys.join(',')+') VALUES ('+keys.map((_,i)=>'$'+(i+1)).join(',')+')',Object.values(foreign)),e=>e.code==='23503');
    }finally{await db.query('ROLLBACK');}
  });
}
