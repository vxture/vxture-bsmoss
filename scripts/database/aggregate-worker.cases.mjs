import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readRefreshSnapshot } from '../../portals/app/app/domains/aggregation/refresh-snapshot.ts';
import { planRefreshJob } from '../../portals/app/app/domains/aggregation/refresh-jobs.ts';
import { PgRefreshJobs } from '../../portals/app/app/domains/aggregation/pg-refresh-jobs.ts';
import { executeRefreshLease } from '../../portals/app/app/domains/aggregation/refresh-execution.ts';
import { FIRST_METRICS } from '../../portals/app/app/domains/catalog/first-metrics.ts';
import { createAggregateWorker } from '../../portals/app/app/domains/workers/aggregate-worker.ts';

export async function aggregateWorkerCases(t,{db,adapterPool,access,scope,up,rate,state,gauge,period,target,write,intercept}) {
  const full={...access,async readLocalGrant(){return {...await access.readLocalGrant(),permissions:['metering.aggregate']};}};
  async function enqueue(m=up,s=scope,q=target(m)) {
    const snapshot=await readRefreshSnapshot(adapterPool,s,q),job=planRefreshJob(snapshot,q,'aggregate-worker:'+randomUUID());
    const queue=new PgRefreshJobs(adapterPool,{workspaceId:'w',series:[{sourceId:job.sourceId,subjectKey:job.subjectKey,metricKey:job.metricKey}]}),pending=await queue.enqueue(job);
    return {queue,id:pending.id,claim:()=>queue.claim(60,[pending.id])};
  }
  const row=async id=>(await db.query('SELECT * FROM bsmoss_analysis.refresh_job WHERE id=$1',[id])).rows[0];
  const durable=async()=>(await db.query(`SELECT (SELECT jsonb_agg(to_jsonb(s) ORDER BY id) FROM bsmoss_analysis.aggregate_series s) heads,
    (SELECT count(*) FROM bsmoss_analysis.aggregate_revision) revisions,(SELECT count(*) FROM bsmoss_analysis.aggregate_outbox) outbox,
    (SELECT count(*) FROM bsmoss_analysis.refresh_attempt) attempts`)).rows[0];
  await t.test('aggregate execution rechecks current authority after durable writes and rolls back the entire result on revocation',async()=>{
    await write(up,{kind:'integer_delta',value:'709'});
    const task=await enqueue(),lease=await task.claim(),before=await durable(),prior=await row(task.id);let revoked=false;
    const restricted={...full,async readLocalGrant(){const g=await full.readLocalGrant();return revoked?{...g,permissions:[]}:g;}};
    const pool=intercept(async(c,sql,args)=>{const result=await c.query(sql,args);if(sql.includes("SET status='succeeded',lease_token=NULL"))revoked=true;return result;});
    await assert.rejects(executeRefreshLease(pool,restricted,lease),/permission_denied/);
    assert.equal(revoked,true);assert.deepEqual(await durable(),before);assert.deepEqual(await row(task.id),prior);
    assert.equal((await row(task.id)).status,'leased');
    await executeRefreshLease(adapterPool,full,lease);
  });
  await t.test('all aggregate semantics discard final identity entitlement expiry and required object scope loss but tolerate unrelated scope shrinkage',async()=>{
    for(const m of [up,rate,state,gauge]) {
      const device=m===state||m===gauge,needed={...scope,metricKeys:[m.code+'@1'],deviceIds:device?scope.deviceIds:[],serviceIds:device?[]:scope.serviceIds};
      for(const mode of ['identity','workspace','coverage','expiry','permission','sourceIds','stationIds',device?'deviceIds':'serviceIds','metricKeys','unrelated']) {
        const task=await enqueue(m),lease=await task.claim(),before=await durable(),prior=await row(task.id);let revoked=false;
        const restricted={...full,
          async readVerifiedIdentity(){const i=await full.readVerifiedIdentity();return !revoked?i:mode==='identity'?{...i,sub:'other'}:mode==='workspace'?{...i,activeWorkspace:'other'}:i;},
          async readCoverage(w){const c=await full.readCoverage(w);return revoked&&mode==='coverage'?{...c,tier:null,bundled:false}:c;},
          async readLocalGrant(){const g=await full.readLocalGrant();if(!revoked)return g;
            return mode==='expiry'?{...g,expiresAt:0}:mode==='permission'?{...g,permissions:[]}:mode==='unrelated'?{...g,scope:needed}:
              ['sourceIds','stationIds','serviceIds','deviceIds','metricKeys'].includes(mode)?{...g,scope:{...scope,[mode]:[]}}:g;}};
        const pool=intercept(async(c,sql,args)=>{const result=await c.query(sql,args);if(sql.includes("SET status='succeeded',lease_token=NULL"))revoked=true;return result;});
        if(mode==='unrelated') {await executeRefreshLease(pool,restricted,lease);assert.equal((await row(task.id)).status,'succeeded');}
        else {await assert.rejects(executeRefreshLease(pool,restricted,lease),/permission_denied|invalid_coverage|feature_denied|scope_denied/);assert.deepEqual(await durable(),before);assert.deepEqual(await row(task.id),prior);await executeRefreshLease(adapterPool,full,lease);}
        assert.equal(revoked,true);
      }
    }
    const task=await enqueue(),lease=await task.claim();let clock=100,reads=0;
    const expiry={...full,now:()=>clock,async readVerifiedIdentity(){return {...await full.readVerifiedIdentity(),expiresAt:++reads===1?200:1000};}};
    const pool=intercept(async(c,sql,args)=>{const result=await c.query(sql,args);if(sql.includes("SET status='succeeded',lease_token=NULL"))clock=300;return result;}),before=await durable();
    await assert.rejects(executeRefreshLease(pool,expiry,lease),/access_expired/);assert.deepEqual(await durable(),before);await executeRefreshLease(adapterPool,full,lease);
  });
  await t.test('final aggregate scope follows reviewed direct parts or actual dependencies and preserves the physical site switch',async()=>{
    const derived={code:'service.data.total_bytes',version:1},down={code:'service.data.downlink_bytes',version:1},connected={code:'service.voice.connected_count',version:1},attempts={code:'service.voice.attempt_count',version:1};
    for(const m of [derived,down,connected,attempts]) {
      const def=FIRST_METRICS.get(m);await db.query('INSERT INTO bsmoss_catalog.metric_version VALUES ($1,1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',[m.code,def.category,def.semantic,def.unit,def]);
      await db.query(`INSERT INTO bsmoss_integration.source_capability VALUES ('w',$1,'report-src',$2,1,'day','active','fixture://aggregate-worker',$3,'2026-01-01Z','2027-01-01Z')`,['aggregate-worker-cap:'+m.code,m.code,{intervalAggregation:{version:1,inputMode:m===derived?'dependencies':'direct',authorityRef:'fixture://aggregate-worker'}}]);
    }
    const all={...scope,metricKeys:[...scope.metricKeys,...[derived,down,connected,attempts].map(m=>m.code+'@1')]};
    const allPorts={...full,async readLocalGrant(){return {...await full.readLocalGrant(),scope:all};}};
    for(const m of [derived,rate]) {
      if(m===rate)await db.query("UPDATE bsmoss_integration.source_capability SET rules=jsonb_set(rules,'{intervalAggregation,inputMode}','\"dependencies\"') WHERE id=$1",['report-cap-'+rate.code]);
      const task=await enqueue(m,all),lease=await task.claim();let revoked=false;
      const dependency=m===derived?down:attempts,ports={...allPorts,async readLocalGrant(){const g=await allPorts.readLocalGrant();return revoked?{...g,scope:{...all,metricKeys:all.metricKeys.filter(k=>k!==dependency.code+'@1')}}:g;}};
      const pool=intercept(async(c,sql,args)=>{const r=await c.query(sql,args);if(sql.includes("SET status='succeeded',lease_token=NULL"))revoked=true;return r;}),before=await durable();
      await assert.rejects(executeRefreshLease(pool,ports,lease),/aggregate_dependency_scope_denied/);assert.equal(revoked,true);assert.deepEqual(await durable(),before);await executeRefreshLease(adapterPool,allPorts,lease);
    }
    await db.query("UPDATE bsmoss_integration.source_capability SET rules=jsonb_set(rules,'{intervalAggregation,inputMode}','\"direct\"') WHERE id=$1",['report-cap-'+rate.code]);
    await db.query(`INSERT INTO bsmoss_integration.source VALUES ('w','aggregate-site-src','AggregateSite','file');
      INSERT INTO bsmoss_integration.source_mapping(workspace_id,id,source_id,external_type,external_id,station_id,version,valid_from,valid_to)
        VALUES ('w','aggregate-site-map','aggregate-site-src','station','aggregate-site','st',1,'2026-01-01Z','2027-01-01Z');
      INSERT INTO bsmoss_integration.source_capability VALUES ('w','aggregate-site-cap','aggregate-site-src','runtime.energy.site_wh',1,'day','active','fixture://aggregate-site','{"intervalAggregation":{"version":1,"inputMode":"direct","authorityRef":"fixture://aggregate-site"}}','2026-01-01Z','2027-01-01Z')`);
    const energy={code:'runtime.energy.site_wh',version:1},s={...all,sourceIds:[...all.sourceIds,'aggregate-site-src'],metricKeys:[...all.metricKeys,energy.code+'@1'],allowSiteParameters:true},q={sourceId:'aggregate-site-src',mappingId:'aggregate-site-map',metric:energy,grain:'day',at:period.start};
    const task=await enqueue(energy,s,q),lease=await task.claim();let revoked=false;
    const ports={...full,async readLocalGrant(){return {...await full.readLocalGrant(),scope:{...s,allowSiteParameters:!revoked}};}};
    const pool=intercept(async(c,sql,args)=>{const r=await c.query(sql,args);if(sql.includes("SET status='succeeded',lease_token=NULL"))revoked=true;return r;}),before=await durable();
    await assert.rejects(executeRefreshLease(pool,ports,lease),/aggregate_scope_denied/);assert.deepEqual(await durable(),before);revoked=false;await executeRefreshLease(adapterPool,ports,lease);
  });
  const finite={...scope,metricKeys:[up.code+'@1'],deviceIds:[]},subject=(await full.readVerifiedIdentity()).sub;
  const workerPorts={...full,now:()=>Date.parse(period.end)+8*3600000,async readLocalGrant(){return {...await full.readLocalGrant(),scope:finite};}};
  const config={subject,status:'active',scope:finite,policy:{outputs:[up],grains:['day']},seeds:[{sourceId:'report-src',mappingId:'report-cell-map',metric:up,notBefore:period.start,grains:['day']}]};
  const register=(id,revision=1,patch={})=>db.query(`INSERT INTO bsmoss_integration.refresh_partition_revision(workspace_id,id,revision,config,review_ref) VALUES ('w',$1,$2,$3,'fixture://aggregate-worker')`,[id,String(revision),{...config,...patch}]);
  const options={workspaceId:'w',subject,partitionIds:['aggregate-worker-main'],executeResults:true,maxStepsPerTick:3,pollMilliseconds:1000};
  const intercepted=callback=>({...intercept(callback),query:(...args)=>adapterPool.query(...args)});
  await t.test('aggregate worker composes durable calendar change receipts and result execution with recoverable restart and paused lane isolation',async()=>{
    await register('aggregate-worker-main');await register('aggregate-worker-paused',1,{status:'paused'});
    const worker=createAggregateWorker(adapterPool,workerPorts,{...options,partitionIds:['aggregate-worker-paused','aggregate-worker-main'],maxStepsPerTick:5});
    const first=await worker.tick();assert.deepEqual(first.events.slice(0,2).map(e=>[e.status,e.failure]),[['failed','configuration_unavailable'],['failed','configuration_unavailable']]);assert.equal(first.events[2].status,'enqueued');
    assert.ok(first.events.some(e=>e.status==='succeeded'));
    // A fresh process has no cursor but reuses durable calendar receipts.
    const restarted=createAggregateWorker(adapterPool,workerPorts,options);let finished=false;
    for(let n=0;n<100;n++) {
      const cycle=await restarted.tick();assert.ok(cycle.events.every(e=>e.status!=='failed'),JSON.stringify(cycle));
      if(cycle.events[1].status==='idle'&&cycle.events[2].status==='idle'){finished=true;break;}
    }
    assert.equal(finished,true);
    assert.equal((await db.query("SELECT count(*)::int n FROM bsmoss_analysis.refresh_scan_receipt WHERE partition_id='aggregate-worker-main'")).rows[0].n,1);
    assert.ok((await db.query("SELECT count(*)::int n FROM bsmoss_analysis.input_refresh_receipt WHERE partition_id='aggregate-worker-main'")).rows[0].n>0);
    assert.equal((await db.query("SELECT count(*)::int n FROM bsmoss_analysis.refresh_job WHERE source_id='report-src' AND metric_key=$1 AND status IN ('pending','leased')",[up.code+'@1'])).rows[0].n,0);
    const before=await durable();
    for(const patch of [{subject:'foreign-worker'},{workspaceId:'other'}]) {
      const denied=createAggregateWorker(adapterPool,workerPorts,{...options,...patch});const cycle=await denied.tick();assert.ok(cycle.events.every(e=>e.failure==='authorization_denied'));
    }
    assert.deepEqual(await durable(),before);
  });
  await t.test('aggregate worker stop after a scan or a claim starts no subsequent transaction and restart recovers durable work',async()=>{
    await register('aggregate-worker-stop');const controller=new AbortController();let scan=false;
    const pool=intercepted(async(c,sql,args)=>{const r=await c.query(sql,args);if(sql.includes('INSERT INTO bsmoss_analysis.refresh_scan_receipt')){scan=true;controller.abort();}return r;});
    const worker=createAggregateWorker(pool,workerPorts,{...options,partitionIds:['aggregate-worker-stop']});
    assert.equal((await worker.tick(controller.signal)).status,'stopped');assert.equal(scan,true);
    const jobs=(await db.query("SELECT j.* FROM bsmoss_analysis.refresh_scan_receipt r CROSS JOIN LATERAL jsonb_array_elements(r.manifest->'jobs') a JOIN bsmoss_analysis.refresh_job j ON j.id=a->>'id' WHERE r.partition_id='aggregate-worker-stop'")).rows;
    assert.equal(jobs.length,1);assert.equal(jobs[0].status,'pending');
    const stopClaim=new AbortController();let claimed=false;
    const claimPool=intercepted(async(c,sql,args)=>{const r=await c.query(sql,args);if(sql.includes("SET status='leased',attempt=attempt+1")){claimed=true;stopClaim.abort();}return r;});
    const resultOnly={...options,partitionIds:[],maxStepsPerTick:1};
    const before=await durable(),cycle=await createAggregateWorker(claimPool,workerPorts,resultOnly).tick(stopClaim.signal);
    assert.equal(claimed,true);assert.equal(cycle.status,'stopped');assert.deepEqual(await durable(),before);assert.equal((await row(jobs[0].id)).status,'leased');
    await db.query("UPDATE bsmoss_analysis.refresh_job SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1",[jobs[0].id]);
    assert.equal((await createAggregateWorker(adapterPool,workerPorts,resultOnly).tick()).events[0].status,'succeeded');
    assert.equal((await row(jobs[0].id)).attempt,'2');assert.deepEqual((await db.query('SELECT outcome FROM bsmoss_analysis.refresh_attempt WHERE job_id=$1 ORDER BY attempt',[jobs[0].id])).rows.map(r=>r.outcome),['expired','succeeded']);
  });
  await t.test('aggregate worker shutdown waits for result commit and authorization loss leaves its lease without a false failure acknowledgment',async()=>{
    const one=await enqueue(),two=await enqueue();await db.query("UPDATE bsmoss_analysis.refresh_job SET available_at='2000-01-01Z' WHERE id=$1",[one.id]);
    let entered,release,hold=true;const ready=new Promise(r=>entered=r),gate=new Promise(r=>release=r),controller=new AbortController();
    const pool=intercepted(async(c,sql,args)=>{const r=await c.query(sql,args);if(hold&&sql.includes("SET status='succeeded',lease_token=NULL")){hold=false;entered();await gate;}return r;});
    const worker=createAggregateWorker(pool,workerPorts,{...options,partitionIds:[],maxStepsPerTick:1});
    const running=worker.run(controller.signal);await ready;controller.abort();assert.equal(worker.snapshot().running,true);assert.equal((await row(one.id)).status,'leased');release();await running;
    assert.equal((await row(one.id)).status,'succeeded');assert.equal((await row(two.id)).status,'pending');
    let revoked=false;const denied={...workerPorts,async readLocalGrant(){const g=await workerPorts.readLocalGrant();return revoked?{...g,scope:{...finite,metricKeys:[]}}:g;}};
    const denyPool=intercepted(async(c,sql,args)=>{const r=await c.query(sql,args);if(sql.includes("SET status='succeeded',lease_token=NULL"))revoked=true;return r;}),before=await durable();
    const cycle=await createAggregateWorker(denyPool,denied,{...options,partitionIds:[],maxStepsPerTick:1}).tick();
    assert.equal(cycle.events[0].failure,'authorization_denied');assert.deepEqual(await durable(),before);assert.equal((await row(two.id)).status,'leased');
    const leaseRow=await row(two.id);await executeRefreshLease(adapterPool,workerPorts,{id:two.id,token:leaseRow.lease_token,attempt:Number(leaseRow.attempt),leaseUntil:leaseRow.lease_until.toISOString(),job:{workspaceId:'w',sourceId:leaseRow.source_id,subjectKey:leaseRow.subject_key,metricKey:leaseRow.metric_key,target:leaseRow.target,triggerRef:leaseRow.trigger_ref,dedupeKey:leaseRow.dedupe_key}});
  });
}
