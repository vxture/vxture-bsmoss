import { mutateTemplateFixture } from './template-owner-fixture.mjs';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fingerprintOf } from '../../portals/app/app/domains/aggregation/intervals.ts';
import { scanRegisteredReports, pendingRegisteredReports, runRegisteredReport } from '../../portals/app/app/domains/reports/pg-schedule.ts';

export async function reportScheduleCases(t,{db,adapterPool,access,scope,api,up,sms,period,write,publish,putTemplate,single,panel,intercept}) {
  let clock=Date.parse('2026-07-07T08:00:00+08:00');
  const ports={...access,now:()=>clock},subject=(await access.readVerifiedIdentity()).sub;
  const base={subject,status:'active',scope,templateCode:'schedule-day',templateVersion:1,grain:'day',notBefore:period.start,delayMinutes:480,lookbackHours:72};
  await putTemplate(base.templateCode,single());
  base.templateSha256=fingerprintOf(single());
  const register=async(id,patch={},revision=1)=>{
    const config={...base,...patch};
    await db.query(`INSERT INTO bsmoss_integration.report_schedule_revision(workspace_id,id,revision,config,review_ref,database_actor)
      VALUES('w',$1,$2,$3,'fixture://reviewed-report-calendar','forged-actor')`,[id,revision,config]);return config;
  };
  const scan=(id,p=ports,pool=adapterPool)=>scanRegisteredReports(pool,p,id);
  const pending=(id,p=ports,pool=adapterPool,limit=25)=>pendingRegisteredReports(pool,p,id,limit);
  const run=(id,job,p=ports,pool=adapterPool)=>runRegisteredReport(pool,p,id,job);
  const row=async id=>(await db.query('SELECT * FROM bsmoss_analysis.report_generation_job WHERE id=$1',[id])).rows[0];
  const counts=async()=>(await db.query(`SELECT (SELECT count(*) FROM bsmoss_analysis.report_generation_job) jobs,
    (SELECT count(*) FROM bsmoss_analysis.report_schedule_scan) scans,(SELECT count(*) FROM bsmoss_analysis.report_generation_attempt) attempts,
    (SELECT count(*) FROM bsmoss_analysis.report_revision) reports,(SELECT count(*) FROM bsmoss_analysis.report_outbox) outbox,
    (SELECT count(*) FROM bsmoss_analysis.report_publication_event) publications`)).rows[0];
  const enqueue=async(patch={})=>{const id='schedule-'+randomUUID();await register(id,patch);const result=await scan(id);return {id,job:result.manifest.jobs.at(-1)?.id,result};};

  await t.test('reviewed report registrations capture database actor and actual JSON digest with a consecutive immutable head',async()=>{
    await register('schedule-reviewed');
    const registered=(await db.query(`SELECT *,encode(sha256(convert_to(config::text,'UTF8')),'hex') AS actual FROM bsmoss_integration.report_schedule_revision WHERE id='schedule-reviewed'`)).rows[0];
    assert.equal(registered.config_sha256,registered.actual);assert.notEqual(registered.database_actor,'forged-actor');assert.equal(registered.template_code,base.templateCode);
    await assert.rejects(register('schedule-reviewed',{},3),/report_schedule_revision_conflict/);
    await register('schedule-reviewed',{status:'paused'},2);assert.equal((await db.query("SELECT revision FROM bsmoss_integration.report_schedule_head WHERE id='schedule-reviewed'")).rows[0].revision,'2');
    for(const sql of ["UPDATE bsmoss_integration.report_schedule_revision SET review_ref=review_ref","DELETE FROM bsmoss_integration.report_schedule_revision","TRUNCATE bsmoss_integration.report_schedule_revision CASCADE"])
      await assert.rejects(db.query(sql),/report_schedule_append_only/);
    const sql="INSERT INTO bsmoss_integration.report_schedule_revision(workspace_id,id,revision,config,review_ref) VALUES ('w','runtime-forgery',1,$1,'fixture://forged')";
    await assert.rejects(adapterPool.query(sql,[base]),e=>e.code==='42501');
    await assert.rejects(adapterPool.query('UPDATE bsmoss_integration.report_schedule_head SET revision=revision'),e=>e.code==='42501');
    await assert.rejects(adapterPool.query('SELECT bsmoss_integration.advance_report_schedule()'),e=>e.code==='42501');
    assert.equal((await db.query(`SELECT EXISTS(SELECT 1 FROM pg_proc p,LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
      WHERE p.oid='bsmoss_integration.lock_report_schedule(text,text)'::regprocedure AND a.grantee=0 AND a.privilege_type='EXECUTE') AS allowed`)).rows[0].allowed,false);
    for(const patch of [{subject:null},{templateCode:'absent'},{templateVersion:1.5},{scope:{...scope,workspaceId:'other'}},{extra:true}])await assert.rejects(register('malformed-'+randomUUID(),patch));
  });
  await t.test('day week and month scans persist only closed due windows with exact Beijing boundaries and hourly idempotency',async()=>{
    const cases=[['day','2026-07-07T08:00:00+08:00',480,period.start,period],['week','2026-07-06T09:00:00+08:00',540,'2026-06-29T00:00:00+08:00',{start:'2026-06-28T16:00:00.000Z',end:'2026-07-05T16:00:00.000Z'}],
      ['month','2026-03-02T10:00:00+08:00',2040,'2026-02-01T00:00:00+08:00',{start:'2026-01-31T16:00:00.000Z',end:'2026-02-28T16:00:00.000Z'}]];
    for(const [grain,now,delayMinutes,notBefore,expected] of cases){
      const templateCode='schedule-calendar-'+grain,definition=single(grain);await putTemplate(templateCode,definition);
      const id=templateCode;await register(id,{templateCode,templateSha256:fingerprintOf(definition),grain,delayMinutes,notBefore});
      clock=Date.parse(now)-3600000;assert.equal((await scan(id)).manifest.jobs.length,0);
      clock=Date.parse(now);const result=await scan(id);assert.equal(result.status,'enqueued');assert.equal(result.manifest.jobs.length,1);assert.deepEqual(result.manifest.jobs[0].period,expected);assert.equal(result.manifest.jobs[0].dueAt,new Date(clock).toISOString());
      const before=await counts();clock+=30000;const duplicate=await scan(id);assert.equal(duplicate.status,'duplicate');assert.deepEqual(duplicate.manifest,result.manifest);assert.deepEqual(await counts(),before);
      assert.deepEqual((await pending(id)).jobIds,[result.manifest.jobs[0].id]);
      const generated=await run(id,result.manifest.jobs[0].id);assert.equal(generated.status,'succeeded');
      const report=await api.read({reportId:generated.job.result.reportId});assert.deepEqual(report.manifest.period,expected);assert.equal(report.manifest.status,'generated');if(grain!=='day')assert.notEqual(report.manifest.dataCompleteness,'complete');
    }
    clock=Date.parse('2026-07-07T08:00:00+08:00');
  });
  await t.test('hourly bounded catch-up retains missing and disconnected evidence and never auto-publishes reports',async()=>{
    const definition={...single(),panels:[panel('sms',sms)],bindings:[{panelId:'sms',kind:'not_connected'}]},templateCode='schedule-disconnected';await putTemplate(templateCode,definition);
    const {id,result}=await enqueue({templateCode,templateSha256:fingerprintOf(definition),notBefore:'2026-01-01T00:00:00+08:00'});
    assert.equal(result.manifest.jobs.length,4);assert.deepEqual(result.manifest.jobs.map(j=>j.dueAt),['2026-07-04T00:00:00.000Z','2026-07-05T00:00:00.000Z','2026-07-06T00:00:00.000Z','2026-07-07T00:00:00.000Z']);
    const before=await counts();
    for(const job of result.manifest.jobs){const generated=await run(id,job.id);assert.equal(generated.status,'succeeded');const report=await api.read({reportId:generated.job.result.reportId});assert.equal(report.manifest.items[0].status,'not_connected');assert.equal(report.manifest.dataCompleteness,'incomplete');assert.equal(report.manifest.items[0].data.kind,'not_connected');}
    assert.equal((await counts()).publications,before.publications);assert.deepEqual(await pending(id),{jobIds:[]});
    await assert.rejects(pending(id,ports,adapterPool,26),/invalid_report_generation_limit/);
  });
  await t.test('new scan hours incorporate corrected data while exact repeats reuse a report without resetting its current head',async()=>{
    const {id,job}=await enqueue(),first=await run(id,job),before=await counts();assert.equal(first.status,'succeeded');
    assert.equal((await run(id,job)).status,'terminal');assert.deepEqual(await counts(),before);
    clock+=3600000;const repeated=await scan(id),duplicate=await run(id,repeated.manifest.jobs.at(-1).id);assert.equal(duplicate.generationStatus,'duplicate');assert.equal(duplicate.job.result.revision,first.job.result.revision);assert.equal((await counts()).reports,before.reports);
    await write(up,{kind:'integer_delta',value:'987654321'});await publish(up);clock+=3600000;
    const changed=await scan(id),next=await run(id,changed.manifest.jobs.at(-1).id);assert.equal(next.generationStatus,'inserted');assert.equal(BigInt(next.job.result.revision),BigInt(first.job.result.revision)+1n);
    const report=await api.read({reportId:next.job.result.reportId});assert.equal(report.manifest.items[0].data.publication.result.value.value,'987654321');assert.equal((await counts()).publications,before.publications);
    clock=Date.parse('2026-07-07T08:00:00+08:00');
  });
  await t.test('every schedule stage revalidates current subject entitlement permission expiry and the entire reviewed scope',async()=>{
    const {id,job}=await enqueue();
    for(const stage of ['scan','pending','run'])for(const mode of ['permission','scope','identity','coverage','expiry']){
      let reads=0;const revoked={...ports,
        async readVerifiedIdentity(){const i=await ports.readVerifiedIdentity();return mode==='identity'&&reads>0?{...i,sub:'other-worker'}:i;},
        async readCoverage(w){const c=await ports.readCoverage(w);return mode==='coverage'&&reads>0?{...c,tier:null,bundled:false}:c;},
        async readLocalGrant(){const g=await ports.readLocalGrant();return ++reads===1?g:mode==='permission'?{...g,permissions:[]}:mode==='scope'?{...g,scope:{...scope,deviceIds:[]}}:mode==='expiry'?{...g,expiresAt:0}:g;}};
      const before=await counts();await assert.rejects(stage==='run'?run(id,job,revoked):stage==='scan'?scan(id,revoked):pending(id,revoked),/denied|expired/);assert.deepEqual(await counts(),before);assert.equal((await row(job)).attempt,'0');
    }
    const narrow={...ports,async readLocalGrant(){return {...await ports.readLocalGrant(),scope:{...scope,deviceIds:[]}};}};
    await assert.rejects(run(id,job,narrow),/report_scope_denied/);
    const foreign={...ports,async readVerifiedIdentity(){return {...await ports.readVerifiedIdentity(),activeWorkspace:'other'};},async readCoverage(){return {workspaceId:'other',product:'bsmoss',tier:'fixture',bundled:false,expiresAt:Date.now()+60000};},async readLocalGrant(){return {...await ports.readLocalGrant(),workspaceId:'other',scope:{...scope,workspaceId:'other'}};}};
    await assert.rejects(scan(id,foreign),/report_schedule_unavailable/);
    const another=await enqueue();assert.equal((await run(id,another.job)).status,'busy_or_unavailable');
    const owner={...ports,async readVerifiedIdentity(){return {...await ports.readVerifiedIdentity(),governanceRoles:['workspace:owner']};},async readLocalGrant(){return {...await ports.readLocalGrant(),permissions:['metering.view']};}};
    await assert.rejects(scan(id,owner),/permission_denied/);
  });
  await t.test('pause and new reviewed revisions isolate old pending jobs and changed template definitions require a new review',async()=>{
    const {id,job}=await enqueue();await register(id,{status:'paused'},2);await assert.rejects(run(id,job),/report_schedule_paused/);assert.equal((await row(job)).attempt,'0');
    await register(id,{},3);assert.deepEqual(await pending(id),{jobIds:[]});assert.equal((await run(id,job)).status,'busy_or_unavailable');assert.equal((await scan(id)).manifest.scheduleRevision,'3');
    const templateCode='schedule-drift',definition=single();await putTemplate(templateCode,definition);const drift=await enqueue({templateCode,templateSha256:fingerprintOf(definition)});
    const changed={...definition,title:'Reviewed replacement title'};await mutateTemplateFixture(db,'UPDATE bsmoss_views.template_version SET definition=$2 WHERE code=$1',[templateCode,changed]);
    for(const action of [()=>scan(drift.id),()=>pending(drift.id),()=>run(drift.id,drift.job)])await assert.rejects(action(),/report_schedule_template_changed/);
    await register(drift.id,{templateCode,templateSha256:fingerprintOf(changed)},2);const restored=await scan(drift.id);assert.equal((await run(drift.id,restored.manifest.jobs.at(-1).id)).status,'succeeded');
  });
  await t.test('reviewed old-input replays record the exact historical report revision separately from its newer current revision',async()=>{
    const templateCode='schedule-replay',definition=single();await putTemplate(templateCode,definition);const {id,job}=await enqueue({templateCode,templateSha256:fingerprintOf(definition)});
    const first=await run(id,job);assert.equal(first.job.result.revision,'1');
    const changed={...definition,title:'Second reviewed report definition'};await mutateTemplateFixture(db,'UPDATE bsmoss_views.template_version SET definition=$2 WHERE code=$1',[templateCode,changed]);await register(id,{templateCode,templateSha256:fingerprintOf(changed)},2);
    const second=await run(id,(await scan(id)).manifest.jobs.at(-1).id);assert.equal(second.job.result.revision,'2');
    await mutateTemplateFixture(db,'UPDATE bsmoss_views.template_version SET definition=$2 WHERE code=$1',[templateCode,definition]);await register(id,{templateCode,templateSha256:fingerprintOf(definition)},3);
    const replay=await run(id,(await scan(id)).manifest.jobs.at(-1).id);assert.equal(replay.generationStatus,'duplicate');assert.equal(replay.job.result.revision,'1');assert.equal(replay.job.result.currentRevision,'2');assert.equal(replay.job.result.manifestSha256,first.job.result.manifestSha256);
    const receipt=(await db.query('SELECT * FROM bsmoss_analysis.report_generation_attempt WHERE job_id=$1',[replay.job.id])).rows[0];assert.equal(receipt.report_revision,'1');assert.equal(receipt.report_current_revision,'2');
  });
  await t.test('corrupt registration scan and job evidence fail closed without consuming attempts or hiding storage faults',async()=>{
    const {id,job}=await enqueue();
    for(const kind of ['config','scan','job']){
      const corrupt=intercept(async(c,sql,args)=>{const result=await c.query(sql,args);if(result.rows.length){if(kind==='config'&&sql.includes('config_sha256=encode'))result.rows[0].valid=false;
        if(kind==='scan'&&sql.includes('SELECT manifest,manifest_sha256 FROM bsmoss_analysis.report_schedule_scan'))result.rows[0].manifest_sha256='0'.repeat(64);
        if(kind==='job'&&sql.includes('SELECT *,available_at<=clock_timestamp()'))result.rows[0].requested_by='unreviewed-worker';}return result;});
      const before=await counts();await assert.rejects(run(id,job,ports,corrupt),/invalid_report_(schedule_evidence|scan_evidence|generation_job)/);assert.deepEqual(await counts(),before);assert.equal((await row(job)).attempt,'0');
    }
    const storage=intercept((c,sql,args)=>sql.includes('SELECT id FROM bsmoss_analysis.report_generation_job')?c.query('SELECT * FROM fixture_report_pending_absent'):c.query(sql,args));await assert.rejects(pending(id,ports,storage),e=>e.code==='42P01');
  });
  await t.test('concurrent workers skip locked jobs and worker interruption rolls back report outbox attempts and status together',async()=>{
    const {id,job}=await enqueue();let entered,release,hold=true;const locked=new Promise(r=>entered=r),gate=new Promise(r=>release=r);
    const held=intercept(async(c,sql,args)=>{const result=await c.query(sql,args);if(hold&&sql.includes('SELECT *,available_at<=clock_timestamp()')){hold=false;entered();await gate;}return result;});
    const work=run(id,job,ports,held);await locked;try{assert.equal((await run(id,job)).status,'busy_or_unavailable');}finally{release();}assert.equal((await work).status,'succeeded');
    const interrupted=await enqueue(),before=await counts();const stopped=intercept(async(c,sql,args)=>{const result=await c.query(sql,args);if(sql.includes('INSERT INTO bsmoss_analysis.report_generation_attempt'))throw Error('fixture_report_worker_interrupted');return result;});
    await assert.rejects(run(interrupted.id,interrupted.job,ports,stopped),/fixture_report_worker_interrupted/);assert.deepEqual(await counts(),before);assert.equal((await row(interrupted.job)).attempt,'0');assert.equal((await row(interrupted.job)).status,'pending');assert.equal((await run(interrupted.id,interrupted.job)).status,'succeeded');
  });
  await t.test('scanner competition is bounded and its jobs and manifest roll back on receipt failure',async()=>{
    const id='schedule-race';await register(id);let entered,release,hold=true;const locked=new Promise(r=>entered=r),gate=new Promise(r=>release=r);
    const held=intercept(async(c,sql,args)=>{const result=await c.query(sql,args);if(hold&&sql.includes('pg_try_advisory_xact_lock')){hold=false;entered();await gate;}return result;});
    const work=scan(id,ports,held);await locked;try{assert.equal((await scan(id)).status,'busy');}finally{release();}assert.equal((await work).status,'enqueued');assert.equal((await scan(id)).status,'duplicate');
    const brokenId='schedule-scan-failure';await register(brokenId);const before=await counts();const broken=intercept((c,sql,args)=>sql.includes('INSERT INTO bsmoss_analysis.report_schedule_scan')?c.query('SELECT * FROM fixture_report_scan_absent'):c.query(sql,args));
    await assert.rejects(scan(brokenId,ports,broken),e=>e.code==='42P01');assert.deepEqual(await counts(),before);assert.equal((await scan(brokenId)).status,'enqueued');
  });
  await t.test('durable generation failures use database time and bounded five-attempt retry without consuming serialization or SQL permission faults',async()=>{
    const {id,job}=await enqueue(),before=await counts();
    const broken=intercept((c,sql,args)=>sql.includes('SELECT definition FROM bsmoss_views.template_version')?c.query('SELECT * FROM fixture_report_generation_absent'):c.query(sql,args));
    for(let attempt=1;attempt<=5;attempt++){
      const result=await run(id,job,ports,broken);assert.equal(result.status,attempt===5?'dead':'retry');assert.equal(result.job.attempt,attempt);
      const receipts=(await db.query('SELECT * FROM bsmoss_analysis.report_generation_attempt WHERE job_id=$1 ORDER BY attempt',[job])).rows;assert.equal(receipts.length,attempt);assert.ok(receipts.every(r=>r.failure_code==='storage_failed'&&r.report_id===null));assert.equal((await counts()).reports,before.reports);
      if(attempt<5){const seconds=Number((await db.query('SELECT extract(epoch FROM available_at-clock_timestamp()) AS seconds FROM bsmoss_analysis.report_generation_job WHERE id=$1',[job])).rows[0].seconds);assert.ok(seconds>5*2**(attempt-1)-2&&seconds<=5*2**(attempt-1));assert.equal((await run(id,job,ports,broken)).status,'delayed');assert.deepEqual(await pending(id),{jobIds:[]});await db.query("UPDATE bsmoss_analysis.report_generation_job SET available_at=clock_timestamp()-interval '1 second' WHERE id=$1",[job]);}
    }
    assert.equal((await run(id,job)).status,'terminal');assert.deepEqual(await pending(id),{jobIds:[]});
    for(const code of ['40001','40P01','42501']){const fresh=await enqueue(),prior=await counts(),fault=intercept((c,sql,args)=>sql.includes('SELECT definition FROM bsmoss_views.template_version')?Promise.reject(Object.assign(Error('private database fault'),{code})):c.query(sql,args));await assert.rejects(run(fresh.id,fresh.job,ports,fault),e=>e.code===code);assert.deepEqual(await counts(),prior);assert.equal((await row(fresh.job)).attempt,'0');}
    const fresh=await enqueue(),prior=await counts();
    // Fail work then fail the durable receipt in the same client transaction.
    const doubleFault=intercept((c,sql,args)=>sql.includes('SELECT definition FROM bsmoss_views.template_version')||sql.includes('INSERT INTO bsmoss_analysis.report_generation_attempt')?c.query('SELECT * FROM fixture_report_double_absent'):c.query(sql,args));
    await assert.rejects(run(fresh.id,fresh.job,ports,doubleFault),e=>e.code==='42P01');assert.deepEqual(await counts(),prior);assert.equal((await row(fresh.job)).attempt,'0');
  });
  await t.test('missing reviewed mappings retry as binding failures instead of inventing ownership or zero-valued data',async()=>{
    const templateCode='schedule-missing-map',definition={...single(),bindings:[{panelId:'usage',kind:'aggregate',sourceId:'report-src',mappingId:'missing-schedule-map'}]};await putTemplate(templateCode,definition);
    const {id,job}=await enqueue({templateCode,templateSha256:fingerprintOf(definition)});assert.equal((await run(id,job)).status,'retry');assert.equal((await db.query('SELECT failure_code FROM bsmoss_analysis.report_generation_attempt WHERE job_id=$1',[job])).rows[0].failure_code,'report_binding_unavailable');
  });
  await t.test('schedule shared locks serialize reviewed pauses and old repeatable snapshots cannot run a replaced registration',async()=>{
    const {id,job}=await enqueue();let entered,release,hold=true;const locked=new Promise(r=>entered=r),gate=new Promise(r=>release=r);
    const held=intercept(async(c,sql,args)=>{const result=await c.query(sql,args);if(hold&&sql.includes('lock_report_schedule')){hold=false;entered();await gate;}return result;});
    const work=run(id,job,ports,held);await locked;let updated=false;const pause=register(id,{status:'paused'},2).then(()=>{updated=true;});
    try{let blocked=false;const deadline=Date.now()+2000;while(Date.now()<deadline){const blockers=await adapterPool.query('SELECT pg_blocking_pids($1) AS pids',[db.processID]);if(blockers.rows[0].pids.length>0){blocked=true;break;}await new Promise(r=>setTimeout(r,10));}assert.equal(blocked,true);assert.equal(updated,false);}finally{release();}assert.equal((await work).status,'succeeded');await pause;await assert.rejects(pending(id),/report_schedule_paused/);
    const stale=await enqueue();let advanced=false;const old=intercept(async(c,sql,args)=>{if(!advanced&&sql.includes('lock_report_schedule')){advanced=true;await c.query('SELECT 1 FROM bsmoss_analysis.report_generation_job LIMIT 1');await register(stale.id,{status:'paused'},2);}return c.query(sql,args);});
    await assert.rejects(run(stale.id,stale.job,ports,old),e=>e.code==='40001');assert.equal((await row(stale.job)).attempt,'0');
  });
  await t.test('an old repeatable report snapshot cannot overwrite concurrently generated revisions',async()=>{
    const {id,job}=await enqueue();let advanced=false;
    const old=intercept(async(c,sql,args)=>{const result=await c.query(sql,args);if(!advanced&&sql.includes('SELECT definition FROM bsmoss_views.template_version')){advanced=true;await write(up,{kind:'integer_delta',value:'123450987'});await publish(up);const current=(await db.query("SELECT current_revision FROM bsmoss_analysis.report_series WHERE template_code=$1 AND period_start=$2",[base.templateCode,period.start])).rows[0];await api.generate({templateCode:base.templateCode,templateVersion:1,at:period.start,expectedRevision:current?.current_revision??null});}return result;});
    const before=(await row(job)).attempt;await assert.rejects(run(id,job,ports,old),e=>e.code==='40001'||/report_revision_conflict/.test(e.message));assert.equal(advanced,true);assert.equal((await row(job)).attempt,before);assert.equal((await run(id,job)).status,'succeeded');
  });
  await t.test('generation SQL protects bindings append-only receipts exact report references and successful job result evidence',async()=>{
    for(const sql of ['UPDATE bsmoss_analysis.report_generation_job SET schedule_id=schedule_id','DELETE FROM bsmoss_analysis.report_generation_job','TRUNCATE bsmoss_analysis.report_generation_job','UPDATE bsmoss_analysis.report_schedule_scan SET recorded_by=recorded_by','DELETE FROM bsmoss_analysis.report_schedule_scan','UPDATE bsmoss_analysis.report_generation_attempt SET recorded_by=recorded_by','DELETE FROM bsmoss_analysis.report_generation_attempt','TRUNCATE bsmoss_analysis.report_generation_attempt'])await assert.rejects(adapterPool.query(sql),e=>e.code==='42501');
    for(const sql of ['UPDATE bsmoss_analysis.report_schedule_scan SET recorded_by=recorded_by','DELETE FROM bsmoss_analysis.report_generation_attempt','TRUNCATE bsmoss_analysis.report_generation_attempt CASCADE'])await assert.rejects(db.query(sql),/report_schedule_evidence_append_only/);
    const {id,job}=await enqueue(),generated=await run(id,job),r=generated.job.result;
    const pendingJob=await enqueue();
    await assert.rejects(adapterPool.query(`UPDATE bsmoss_analysis.report_generation_job SET status='succeeded',attempt=1,result_report_id=$2,result_report_revision=$3,result_current_revision=$4,result_manifest_sha256=$5 WHERE id=$1`,[pendingJob.job,r.reportId,r.revision,r.currentRevision,r.manifestSha256]),e=>e.code==='23503');assert.equal((await row(pendingJob.job)).status,'pending');
    await assert.rejects(adapterPool.query(`INSERT INTO bsmoss_analysis.report_generation_attempt(workspace_id,job_id,attempt,outcome,generation_status,report_id,report_revision,report_current_revision,manifest_sha256,recorded_by) VALUES ('w',$1,1,'succeeded','duplicate',$2,$3,$4,$5,'snapshot-worker')`,[pendingJob.job,r.reportId,r.revision,r.currentRevision,'0'.repeat(64)]),e=>e.code==='23503');
    await assert.rejects(adapterPool.query(`INSERT INTO bsmoss_analysis.report_generation_attempt(workspace_id,job_id,attempt,outcome,failure_code,recorded_by) VALUES ('w',$1,1,'retry','private-database-message','snapshot-worker')`,[pendingJob.job]),e=>e.code==='23514');
    const original=await row(job),keys=['workspace_id','id','schedule_id','schedule_revision','schedule_sha256','scan_hour','grain','period_start','period_end','due_at','requested_by'];
    await assert.rejects(adapterPool.query('INSERT INTO bsmoss_analysis.report_generation_job('+keys.join(',')+') VALUES ('+keys.map((_,i)=>'$'+(i+1)).join(',')+')',keys.map(k=>k==='id'?randomUUID():k==='period_end'?new Date(original.period_end.getTime()+1000):original[k])),e=>e.code==='23514');
    await assert.rejects(adapterPool.query('INSERT INTO bsmoss_analysis.report_generation_job('+keys.join(',')+') VALUES ('+keys.map((_,i)=>'$'+(i+1)).join(',')+')',keys.map(k=>k==='id'?randomUUID():k==='workspace_id'?'other':original[k])),e=>e.code==='23503');
  });
}
