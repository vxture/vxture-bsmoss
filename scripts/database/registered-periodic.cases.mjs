import assert from 'node:assert/strict';
import { enqueueRegisteredPeriodic } from '../../portals/app/app/domains/aggregation/pg-registered-periodic.ts';
import { PgAggregateQueryReader } from '../../portals/app/app/domains/aggregation/pg-query.ts';

export async function registeredPeriodicCases(t,{db,adapterPool,ports,scope,upMetric,gaugeMetric,period,finishChangeJobs}){
  let clock=Date.parse('2026-06-03T04:00:00Z');
  const scanPorts={...ports,now:()=>clock};
  const finite={...scope,metricKeys:[upMetric.code+'@1',gaugeMetric.code+'@1'],deviceIds:['flow-empty']};
  const config={subject:'snapshot-worker',status:'active',scope:finite,policy:{outputs:[upMetric,gaugeMetric],grains:['day']},
    seeds:[{sourceId:'flow-src',mappingId:'flow-cell-map',metric:upMetric,notBefore:period.start,grains:['day']},
      {sourceId:'flow-src',mappingId:'flow-empty-map',metric:gaugeMetric,notBefore:period.start,grains:['day']}]};
  const register=(id,revision,patch={})=>db.query(`INSERT INTO bsmoss_integration.refresh_partition_revision(workspace_id,id,revision,config,review_ref)
    VALUES ('w',$1,$2,$3,'fixture://reviewed-partition')`,[id,String(revision),JSON.stringify({...config,...patch})]);
  const counts=async()=>(await db.query('SELECT (SELECT count(*) FROM bsmoss_analysis.refresh_job) jobs,(SELECT count(*) FROM bsmoss_analysis.refresh_scan_receipt) receipts')).rows[0];
  const intercepted=observe=>({async connect(){const c=await adapterPool.connect();return {async query(sql,args){return observe(c,sql,args);},release(d){c.release(d);}};}});
  await t.test('registered partition configuration is immutable tenant constrained and cannot be written by runtime',async()=>{
    await register('periodic-main',1);
    const rows=(await db.query("SELECT *,config_sha256=encode(sha256(convert_to(config::text,'UTF8')),'hex') valid FROM bsmoss_integration.refresh_partition_revision WHERE id='periodic-main'")).rows;
    assert.equal(rows.length,1);assert.equal(rows[0].valid,true);assert.equal(rows[0].database_actor,db.user);
    assert.equal((await db.query("SELECT revision FROM bsmoss_integration.refresh_partition_head WHERE id='periodic-main'")).rows[0].revision,'1');
    await assert.rejects(register('periodic-main',3),/partition_revision_conflict/);
    for(const sql of ["UPDATE bsmoss_integration.refresh_partition_revision SET review_ref='other'","DELETE FROM bsmoss_integration.refresh_partition_revision","TRUNCATE bsmoss_integration.refresh_partition_revision CASCADE"]){await assert.rejects(db.query(sql),/partition_revision_append_only/);}
    for(const table of ['bsmoss_integration.refresh_partition_revision','bsmoss_integration.refresh_partition_head']){
      for(const command of ['INSERT INTO '+table+' DEFAULT VALUES','UPDATE '+table+' SET revision=99','DELETE FROM '+table])await assert.rejects(adapterPool.query(command),e=>e.code==='42501');
    }
    await assert.rejects(adapterPool.query('SELECT bsmoss_integration.advance_refresh_partition()'),e=>e.code==='42501');
  });
  await t.test('registered calendar scans use persistent seeds including no-fact devices and replay the exact durable receipt',async()=>{
    const first=await enqueueRegisteredPeriodic(adapterPool,scanPorts,'periodic-main');assert.equal(first.status,'enqueued');assert.equal(first.manifest.targets.length,2);
    const before=await counts(),again=await enqueueRegisteredPeriodic(adapterPool,scanPorts,'periodic-main');assert.equal(again.status,'duplicate');assert.deepEqual(again.manifest,first.manifest);assert.deepEqual(await counts(),before);
    await finishChangeJobs(first.manifest,scanPorts);
    const missing=await new PgAggregateQueryReader(adapterPool,finite).read({sourceId:'flow-src',mappingId:'flow-empty-map',metric:gaugeMetric,grain:'day',at:period.start});
    assert.equal(missing.result.completeness,'missing');assert.equal(missing.result.value,null);
    clock+=3600000;const next=await enqueueRegisteredPeriodic(adapterPool,scanPorts,'periodic-main');assert.equal(next.status,'enqueued');assert.notEqual(next.manifest.triggerRef,first.manifest.triggerRef);
    await finishChangeJobs(next.manifest,scanPorts);
    for(const command of ['DELETE FROM bsmoss_analysis.refresh_scan_receipt',"UPDATE bsmoss_analysis.refresh_scan_receipt SET manifest_sha256='"+'a'.repeat(64)+"'"]){await assert.rejects(adapterPool.query(command),e=>e.code==='42501');}
    const r=(await db.query("SELECT * FROM bsmoss_analysis.refresh_scan_receipt WHERE partition_id='periodic-main' LIMIT 1")).rows[0];
    await assert.rejects(db.query('INSERT INTO bsmoss_analysis.refresh_scan_receipt(workspace_id,partition_id,partition_revision,scan_hour,manifest,manifest_sha256,recorded_by) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      ['other',r.partition_id,r.partition_revision,r.scan_hour,r.manifest,r.manifest_sha256,r.recorded_by]),e=>e.code==='23503');
  });
  await t.test('paused foreign-subject and revoked partition scopes cannot scan or replay prior evidence',async()=>{
    await register('periodic-paused',1,{status:'paused'});await register('periodic-other',1,{subject:'another-subject'});
    await assert.rejects(enqueueRegisteredPeriodic(adapterPool,scanPorts,'periodic-paused'),/registered_partition_paused/);
    await assert.rejects(enqueueRegisteredPeriodic(adapterPool,scanPorts,'periodic-other'),/registered_partition_subject_denied/);
    for(const key of ['sourceIds','stationIds','serviceIds','deviceIds','metricKeys']){
      const denied={...scanPorts,async readLocalGrant(){return {...await ports.readLocalGrant(),scope:{...scope,[key]:[]}};}};
      await assert.rejects(enqueueRegisteredPeriodic(adapterPool,denied,'periodic-main'),/registered_partition_scope_denied/);
    }
    await assert.rejects(enqueueRegisteredPeriodic(adapterPool,scanPorts,'absent'),/registered_partition_unavailable/);
    await register('periodic-main',2,{status:'paused'});await assert.rejects(enqueueRegisteredPeriodic(adapterPool,scanPorts,'periodic-main'),/registered_partition_paused/);
    await register('periodic-main',3);const restored=await enqueueRegisteredPeriodic(adapterPool,scanPorts,'periodic-main');assert.equal(restored.status,'enqueued');assert.equal(restored.manifest.partitionRevision,'3');await finishChangeJobs(restored.manifest,scanPorts);
  });
  await t.test('scan receipt failure and final authorization loss roll back every queued job',async()=>{
    for(const mode of ['receipt','permission','scope','subject']){
      const id='periodic-atomic-'+mode;await register(id,1);const before=await counts();let reads=0;
      const guarded={...scanPorts,async readLocalGrant(){const g=await ports.readLocalGrant();reads++;return reads<2?g:mode==='permission'?{...g,permissions:[]}:mode==='scope'?{...g,scope:{...scope,deviceIds:[]}}:g;},
        async readVerifiedIdentity(){const i=await ports.readVerifiedIdentity();return mode==='subject'&&reads?{...i,sub:'other'}:i;}};
      const pool=intercepted(async(c,sql,args)=>{if(mode==='receipt'&&sql.includes('INSERT INTO bsmoss_analysis.refresh_scan_receipt'))throw Error('fixture_scan_receipt_failure');return c.query(sql,args);});
      await assert.rejects(enqueueRegisteredPeriodic(pool,guarded,id),/fixture_scan_receipt_failure|permission_denied|registered_partition_scope_denied/);assert.deepEqual(await counts(),before);
    }
  });
  await t.test('concurrent same-partition scans are fenced without duplicate tasks or receipts',async()=>{
    await register('periodic-concurrent',1);let ready,release;const observed=new Promise(r=>ready=r),gate=new Promise(r=>release=r);
    const pool=intercepted(async(c,sql,args)=>{if(sql.includes('INSERT INTO bsmoss_analysis.refresh_scan_receipt')){ready();await gate;}return c.query(sql,args);});
    const first=enqueueRegisteredPeriodic(pool,scanPorts,'periodic-concurrent');
    try{await observed;const second=await enqueueRegisteredPeriodic(adapterPool,scanPorts,'periodic-concurrent');assert.equal(second.status,'busy');}finally{release();}
    const result=await first;assert.equal(result.status,'enqueued');assert.equal((await enqueueRegisteredPeriodic(adapterPool,scanPorts,'periodic-concurrent')).status,'duplicate');await finishChangeJobs(result.manifest,scanPorts);
  });
  await t.test('configuration updates wait for an authorized scan commit and affect the next scan',async()=>{
    await register('periodic-config-race',1);let pending,waited=false;
    const pool=intercepted(async(c,sql,args)=>{
      if(sql.includes('INSERT INTO bsmoss_analysis.refresh_scan_receipt')){
        pending=register('periodic-config-race',2,{status:'paused'});
        for(let n=0;n<100;n++){
          const blocked=(await adapterPool.query('SELECT EXISTS(SELECT 1 FROM pg_locks WHERE pid=$1 AND NOT granted) blocked',[db.processID])).rows[0].blocked;
          if(blocked){waited=true;break;}await new Promise(r=>setTimeout(r,10));
        }
        assert.equal(waited,true);
      }
      return c.query(sql,args);
    });
    const old=await enqueueRegisteredPeriodic(pool,scanPorts,'periodic-config-race');await pending;
    assert.equal(old.manifest.partitionRevision,'1');assert.equal((await db.query("SELECT revision FROM bsmoss_integration.refresh_partition_head WHERE id='periodic-config-race'")).rows[0].revision,'2');
    await assert.rejects(enqueueRegisteredPeriodic(adapterPool,scanPorts,'periodic-config-race'),/registered_partition_paused/);await finishChangeJobs(old.manifest,scanPorts);
  });
  await t.test('a replacement committed before the head lock cannot be scanned from an obsolete repeatable snapshot',async()=>{
    await register('periodic-prelock-race',1);let injected=false;const before=await counts();
    const pool=intercepted(async(c,sql,args)=>{if(!injected&&sql.includes('SELECT bsmoss_integration.lock_refresh_partition')){
      injected=true;await c.query('SELECT 1');await register('periodic-prelock-race',2,{status:'paused'});
    }return c.query(sql,args);});
    await assert.rejects(enqueueRegisteredPeriodic(pool,scanPorts,'periodic-prelock-race'),e=>e.code==='40001');assert.equal(injected,true);assert.deepEqual(await counts(),before);
  });
}
