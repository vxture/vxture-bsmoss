import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createAuthorizedAggregateJobs } from '../../portals/app/app/domains/access/aggregate-jobs.ts';
import { PgAggregateJobStore } from '../../portals/app/app/domains/supervision/pg-jobs.ts';
import { PgRefreshJobs } from '../../portals/app/app/domains/aggregation/pg-refresh-jobs.ts';
import { readRefreshSnapshot } from '../../portals/app/app/domains/aggregation/refresh-snapshot.ts';
import { planRefreshJob } from '../../portals/app/app/domains/aggregation/refresh-jobs.ts';
import { executeRefreshLease } from '../../portals/app/app/domains/aggregation/refresh-execution.ts';
import { fingerprintOf } from '../../portals/app/app/domains/aggregation/intervals.ts';

export async function jobRecoveryCases(t,{db,adapterPool,access,scope,up,rate,state,gauge,period,target,intercept}) {
  const full={...access,async readLocalGrant(){return {...await access.readLocalGrant(),permissions:['metering.jobs.view','metering.jobs.recover','metering.aggregate']};}};
  const make=(ports=full,pool=adapterPool)=>createAuthorizedAggregateJobs(ports,{create:s=>new PgAggregateJobStore(pool,s)},'interactive'),api=make();
  const row=async id=>(await db.query('SELECT * FROM bsmoss_analysis.refresh_job WHERE id=$1',[id])).rows[0];
  async function task(m=up,terminal=true,s=scope,q=target(m)) {
    const snapshot=await readRefreshSnapshot(adapterPool,s,q),job=planRefreshJob(snapshot,q,'monitor-fixture:'+randomUUID()),queue=new PgRefreshJobs(adapterPool,{workspaceId:'w',series:[{sourceId:job.sourceId,subjectKey:job.subjectKey,metricKey:job.metricKey}]}),pending=await queue.enqueue(job,1);
    if(terminal)await queue.fail(await queue.claim(60,[pending.id]),'source_unavailable');
    return {...pending,job,queue};
  }
  const counts=async()=>(await db.query(`SELECT (SELECT count(*) FROM bsmoss_analysis.refresh_job) jobs,(SELECT count(*) FROM bsmoss_analysis.refresh_recovery) recoveries,(SELECT count(*) FROM bsmoss_analysis.refresh_attempt) attempts`)).rows[0];
  const command=id=>({jobId:id,expectedAttempt:1,commandId:randomUUID(),reasonRef:'review://source-restored'});
  let main,issued;
  await t.test('job monitoring filters scope before pagination and preserves microseconds without missing or repeating same-time jobs',async()=>{
    const rows=[];
    for(let i=0;i<5;i++){const a=await task(up);rows.push(a.id);await db.query("UPDATE bsmoss_analysis.refresh_job SET created_at='2099-01-01T00:00:00.123000Z'::timestamptz+($2::int*interval '1 microsecond') WHERE id=$1",[a.id,i]);}
    for(let i=0;i<3;i++){const a=await task(state);await db.query("UPDATE bsmoss_analysis.refresh_job SET created_at='2100-01-01Z' WHERE id=$1",[a.id]);}
    const narrow={...full,async readLocalGrant(){return {...await full.readLocalGrant(),scope:{...scope,metricKeys:[up.code+'@1'],deviceIds:[]}};}};
    let next,seen=[];
    do {const page=await make(narrow).list({status:'dead',limit:2,...(next?{after:next}:{})});seen.push(...page.items.map(i=>i.id));next=page.next;}while(next);
    const expected=(await db.query("SELECT id FROM bsmoss_analysis.refresh_job WHERE source_id='report-src' AND metric_key=$1 AND status='dead' ORDER BY created_at DESC,id COLLATE \"C\" DESC",[up.code+'@1'])).rows.map(r=>r.id);
    assert.deepEqual(seen,expected);assert.deepEqual(seen.slice(0,5),rows.toReversed());assert.equal(new Set(seen).size,seen.length);
    const before=await counts();for(const field of ['sourceIds','stationIds','serviceIds','metricKeys']){
      const denied={...narrow,async readLocalGrant(){const g=await narrow.readLocalGrant();return {...g,scope:{...g.scope,[field]:[]}};}};
      assert.deepEqual(await make(denied).list({status:'all',limit:25}),{items:[],next:null});assert.equal(await make(denied).read({jobId:rows[0]}),null);
    }
    assert.deepEqual(await counts(),before);
    const foreign={...full,async readVerifiedIdentity(){return {...await full.readVerifiedIdentity(),activeWorkspace:'other'};},async readCoverage(){return {workspaceId:'other',product:'bsmoss',tier:'fixture',bundled:false,expiresAt:Date.now()+60000};},async readLocalGrant(){return {...await full.readLocalGrant(),workspaceId:'other',scope:{...scope,workspaceId:'other'}};}};
    assert.deepEqual(await make(foreign).list({status:'all',limit:25}),{items:[],next:null});
  });
  await t.test('monitor details expose bounded attempts and server-observed ready delayed live and expired lease states without lease tokens',async()=>{
    const p=await task(up,false);let detail=await api.read({jobId:p.id});assert.equal(detail.job.readiness,'ready');assert.deepEqual(detail.attempts,[]);
    await db.query("UPDATE bsmoss_analysis.refresh_job SET available_at=clock_timestamp()+interval '1 hour' WHERE id=$1",[p.id]);assert.equal((await api.read({jobId:p.id})).job.readiness,'delayed');
    await db.query("UPDATE bsmoss_analysis.refresh_job SET available_at=clock_timestamp()-interval '1 second' WHERE id=$1",[p.id]);const lease=await p.queue.claim(60,[p.id]);detail=await api.read({jobId:p.id});assert.equal(detail.job.readiness,'running');assert.ok(!JSON.stringify(detail).includes(lease.token));
    await db.query("UPDATE bsmoss_analysis.refresh_job SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1",[p.id]);assert.equal((await api.read({jobId:p.id})).job.readiness,'lease_expired');
    assert.equal(await p.queue.claim(60,[p.id]),null);detail=await api.read({jobId:p.id});assert.equal(detail.job.status,'dead');assert.equal(detail.attempts[0].outcome,'expired');
    const c=command(p.id),restored=await api.recover(c);assert.equal(restored.status,'inserted');assert.equal((await row(p.id)).status,'dead');
  });
  await t.test('reviewed recovery appends one linked job and immutable receipt preserving the original terminal attempts and replay identity',async()=>{
    main=await task();issued=command(main.id);const before=await row(main.id),result=await api.recover(issued);assert.equal(result.status,'inserted');assert.equal(result.record.requestedBy,(await full.readVerifiedIdentity()).sub);
    assert.deepEqual(await row(main.id),before);const child=await row(result.record.replacementJobId);assert.equal(child.status,'pending');assert.equal(child.attempt,'0');assert.equal(child.max_attempts,'1');assert.equal(child.target.mappingId,main.job.target.mappingId);
    const parentDetail=await api.read({jobId:main.id});assert.equal(parentDetail.recovery.replacementJobId,child.id);assert.equal(parentDetail.attempts[0].outcome,'dead');assert.equal((await api.read({jobId:child.id})).recoveredFrom.originalJobId,main.id);
    const countsBefore=await counts();assert.deepEqual(await api.recover(issued),{status:'duplicate',record:result.record});assert.deepEqual(await counts(),countsBefore);
    for(const patch of [{reasonRef:'review://different'},{expectedAttempt:2}])await assert.rejects(api.recover({...issued,...patch}),/conflicting_job_recovery/);
    await assert.rejects(api.recover({...issued,commandId:randomUUID()}),/job_recovery_conflict/);
    const impersonated={...full,async readVerifiedIdentity(){return {...await full.readVerifiedIdentity(),sub:'other-reviewer'};},async readLocalGrant(){return {...await full.readLocalGrant(),sub:'other-reviewer'};}};
    await assert.rejects(make(impersonated).recover(issued),/conflicting_job_recovery/);
    const queue=new PgRefreshJobs(adapterPool,{workspaceId:'w',series:[{sourceId:main.job.sourceId,subjectKey:main.job.subjectKey,metricKey:main.job.metricKey}]}),lease=await queue.claim(60,[child.id]);
    await executeRefreshLease(adapterPool,full,lease);assert.equal((await api.read({jobId:child.id})).job.status,'succeeded');assert.equal((await api.recover(issued)).status,'duplicate');
  });
  await t.test('all three semantics recover through current reviewed policy without requiring unknown values to become zero',async()=>{
    for(const m of [up,rate,state,gauge]) {
      const dead=await task(m),r=await api.recover(command(dead.id)),child=await row(r.record.replacementJobId),lease=await dead.queue.claim(60,[child.id]);
      await executeRefreshLease(adapterPool,full,lease);assert.equal((await api.read({jobId:child.id})).job.status,'succeeded');assert.equal((await api.read({jobId:dead.id})).job.status,'dead');
    }
  });
  await t.test('independent inspection and recovery permissions and complete object scope are required even for owners and final revocation rolls back new jobs and audit',async()=>{
    const modes=['permission','identity','coverage','expiry','sourceIds','stationIds','serviceIds','metricKeys','audit'];
    for(const mode of modes){
      const dead=await task(),c=command(dead.id),before=await counts(),original=await row(dead.id);let revoke=false;
      const denied={...full,async readVerifiedIdentity(){const i=await full.readVerifiedIdentity();return mode==='identity'&&revoke?{...i,sub:'other'}:i;},async readCoverage(w){const e=await full.readCoverage(w);return mode==='coverage'&&revoke?{...e,tier:null,bundled:false}:e;},
        async readLocalGrant(){const g=await full.readLocalGrant();return !revoke?g:mode==='permission'?{...g,permissions:['metering.aggregate']}:mode==='expiry'?{...g,expiresAt:0}:['sourceIds','stationIds','serviceIds','metricKeys'].includes(mode)?{...g,scope:{...scope,[mode]:[]}}:g;}};
      const pool=intercept(async(c,sql,args)=>{const r=await c.query(sql,args);if(sql.includes('INSERT INTO bsmoss_analysis.refresh_recovery')){revoke=true;if(mode==='audit')await c.query('SELECT * FROM job_recovery_fixture_missing');}return r;});
      await assert.rejects(make(denied,pool).recover(c),/permission_denied|feature_denied|scope_denied|does not exist/);assert.equal(revoke,true);assert.deepEqual(await counts(),before);assert.deepEqual(await row(dead.id),original);
    }
    const dead=await task(state);const noDevice={...full,async readLocalGrant(){return {...await full.readLocalGrant(),scope:{...scope,deviceIds:[]}};}};
    assert.equal(await make(noDevice).read({jobId:dead.id}),null);await assert.rejects(make(noDevice).recover(command(dead.id)),/job_unavailable/);
    const owner={...full,async readVerifiedIdentity(){return {...await full.readVerifiedIdentity(),governanceRoles:['workspace:owner']};},async readLocalGrant(){return {...await full.readLocalGrant(),permissions:['metering.view','metering.aggregate']};}};
    await assert.rejects(make(owner).read({jobId:dead.id}),/permission_denied/);await assert.rejects(make(owner).recover(command(dead.id)),/permission_denied/);
  });
  await t.test('recovery refuses nonterminal stale attempts and missing current source policy and concurrent commands create exactly one replacement',async()=>{
    const pending=await task(up,false);await assert.rejects(api.recover(command(pending.id)),/job_recovery_conflict/);const lease=await pending.queue.claim(60,[pending.id]);await assert.rejects(api.recover(command(pending.id)),/job_recovery_conflict/);await pending.queue.fail(lease,'source_unavailable');
    await assert.rejects(api.recover({...command(pending.id),expectedAttempt:2}),/job_recovery_conflict/);
    await db.query("UPDATE bsmoss_integration.source_capability SET status='retired' WHERE id=$1",['report-cap-'+up.code]);const before=await counts();
    try{await assert.rejects(api.recover(command(pending.id)),/capability_unavailable/);assert.deepEqual(await counts(),before);}finally{await db.query("UPDATE bsmoss_integration.source_capability SET status='active' WHERE id=$1",['report-cap-'+up.code]);}
    const c=command(pending.id),race=await Promise.allSettled([api.recover(c),api.recover(c)]);assert.ok(race.some(r=>r.status==='fulfilled'));const stable=await api.recover(c);assert.equal(stable.status,'duplicate');assert.equal((await counts()).recoveries, String(BigInt(before.recoveries)+1n));
    const another=await task(),commands=[command(another.id),command(another.id)],outcomes=await Promise.allSettled(commands.map(c=>api.recover(c)));assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);
    assert.equal((await db.query('SELECT count(*)::int n FROM bsmoss_analysis.refresh_recovery WHERE original_job_id=$1',[another.id])).rows[0].n,1);
  });
  await t.test('recovery pins actual dependency scope and independent physical-site authority through write and idempotent replay',async()=>{
    const derived={code:'service.data.total_bytes',version:1},down={code:'service.data.downlink_bytes',version:1},s={...scope,metricKeys:[...scope.metricKeys,derived.code+'@1',down.code+'@1']};
    const ports={...full,async readLocalGrant(){return {...await full.readLocalGrant(),scope:s};}},dead=await task(derived,true,s),c=command(dead.id),before=await counts();
    let revoke=false;const denied={...ports,async readLocalGrant(){const g=await ports.readLocalGrant();return revoke?{...g,scope:{...s,metricKeys:s.metricKeys.filter(k=>k!==down.code+'@1')}}:g;}};
    const pool=intercept(async(c,sql,args)=>{const r=await c.query(sql,args);if(sql.includes('INSERT INTO bsmoss_analysis.refresh_recovery'))revoke=true;return r;});
    await assert.rejects(make(denied,pool).recover(c),/scope_denied/);assert.deepEqual(await counts(),before);
    const issued=await make(ports).recover(c);await assert.rejects(make(denied).recover(c),/scope_denied/);assert.equal((await make(ports).recover(c)).status,'duplicate');
    // Replay uses the immutable reviewed footprint, not a new authority lookup.
    await db.query("UPDATE bsmoss_integration.source_capability SET status='retired' WHERE id=$1",['aggregate-worker-cap:'+derived.code]);
    try{assert.equal((await make(ports).recover(c)).status,'duplicate');}finally{await db.query("UPDATE bsmoss_integration.source_capability SET status='active' WHERE id=$1",['aggregate-worker-cap:'+derived.code]);}
    const audit=(await db.query('SELECT manifest FROM bsmoss_analysis.refresh_recovery WHERE command_id=$1',[c.commandId])).rows[0].manifest;
    assert.deepEqual(audit.requiredScope.metricKeys,[down.code+'@1',derived.code+'@1',up.code+'@1'].sort());assert.equal(audit.inputPolicy.inputMode,'dependencies');assert.equal(issued.record.originalJobId,dead.id);
    const energy={code:'runtime.energy.site_wh',version:1},siteScope={...scope,sourceIds:[...scope.sourceIds,'aggregate-site-src'],serviceIds:[],deviceIds:[],metricKeys:[energy.code+'@1'],allowSiteParameters:true},q={sourceId:'aggregate-site-src',mappingId:'aggregate-site-map',metric:energy,grain:'day',at:period.start},physical=await task(energy,true,siteScope,q);
    const sitePorts={...full,async readLocalGrant(){return {...await full.readLocalGrant(),scope:siteScope};}},noSite={...sitePorts,async readLocalGrant(){return {...await sitePorts.readLocalGrant(),scope:{...siteScope,allowSiteParameters:false}};}};
    assert.equal(await make(noSite).read({jobId:physical.id}),null);await assert.rejects(make(noSite).recover(command(physical.id)),/job_unavailable/);
    const restored=await make(sitePorts).recover(command(physical.id)),lease=await physical.queue.claim(60,[restored.record.replacementJobId]);await executeRefreshLease(adapterPool,sitePorts,lease);
    const ref=JSON.parse((await make(sitePorts).read({jobId:restored.record.replacementJobId})).attempts[0].resultRef),result=(await db.query('SELECT result_payload FROM bsmoss_analysis.aggregate_revision WHERE series_id=$1 AND revision=$2',[ref[1],ref[2]])).rows[0].result_payload;
    assert.equal(result.value,null);assert.equal(result.completeness,'missing');
  });
  await t.test('job monitoring and recovery replays revalidate current scope and reject corrupt immutable audit or SQL errors',async()=>{
    for(const operation of ['list','read','recover']) {
      let reads=0;const denied={...full,async readLocalGrant(){const g=await full.readLocalGrant();return ++reads>1?{...g,permissions:[]}:g;}};
      const api=make(denied);await assert.rejects(operation==='list'?api.list({status:'all',limit:25}):operation==='read'?api.read({jobId:main.id}):api.recover(issued),/permission_denied/);
    }
    const broken=intercept((c,sql,args)=>sql.includes('SELECT j.*')?c.query('SELECT * FROM job_recovery_fixture_missing'):c.query(sql,args));await assert.rejects(make(full,broken).list({status:'all',limit:25}),e=>e.code==='42P01');
    const corrupt=intercept(async(c,sql,args)=>{const r=await c.query(sql,args);if(sql.includes('database_sha256=encode')&&sql.includes('FROM bsmoss_analysis.refresh_recovery')&&r.rows.length)r.rows[0]={...r.rows[0],manifest_sha256:'0'.repeat(64)};return r;});
    await assert.rejects(make(full,corrupt).read({jobId:main.id}),/invalid_job_recovery_evidence/);
  });
  await t.test('recovery SQL captures database provenance protects immutable linkage and rejects cross-tenant or misbound commands',async()=>{
    const r=(await db.query('SELECT * FROM bsmoss_analysis.refresh_recovery WHERE command_id=$1',[issued.commandId])).rows[0];assert.equal(r.database_actor,db.user);
    assert.equal((await db.query("SELECT database_sha256=encode(sha256(convert_to(manifest::text,'UTF8')),'hex') valid FROM bsmoss_analysis.refresh_recovery WHERE command_id=$1",[issued.commandId])).rows[0].valid,true);
    for(const sql of ['UPDATE bsmoss_analysis.refresh_recovery SET requested_by=requested_by','DELETE FROM bsmoss_analysis.refresh_recovery','TRUNCATE bsmoss_analysis.refresh_recovery'])await assert.rejects(adapterPool.query(sql),e=>e.code==='42501');
    for(const sql of ['UPDATE bsmoss_analysis.refresh_recovery SET requested_by=requested_by','DELETE FROM bsmoss_analysis.refresh_recovery','TRUNCATE bsmoss_analysis.refresh_recovery'])await assert.rejects(db.query(sql),/append_only/);
    await assert.rejects(adapterPool.query('SELECT bsmoss_analysis.capture_refresh_recovery()'),e=>e.code==='42501');
    const copy={...r,command_id:randomUUID(),requested_by:'forged'};copy.manifest={...copy.manifest,commandId:copy.command_id};copy.manifest_sha256=fingerprintOf(copy.manifest);const keys=Object.keys(copy);
    await assert.rejects(db.query('INSERT INTO bsmoss_analysis.refresh_recovery('+keys.join(',')+') VALUES ('+keys.map((_,i)=>'$'+(i+1)).join(',')+')',Object.values(copy)),/invalid_refresh_recovery_binding/);
    for(const p of ['metering.jobs.view','metering.jobs.recover']){assert.equal((await db.query('SELECT 1 FROM local_authz.permission WHERE perm_code=$1',[p])).rowCount,1);assert.equal((await db.query('SELECT 1 FROM local_authz.permission p JOIN local_authz.role_permission rp ON rp.permission_id=p.id WHERE p.perm_code=$1',[p])).rowCount,0);}
  });
}
