import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { pendingRegisteredInputChanges, dispatchRegisteredInputChange, superviseRegisteredInputChange, runRegisteredInputStep, reopenRegisteredInputChange } from '../../portals/app/app/domains/aggregation/pg-registered-input.ts';
import { dispatchInputChange } from '../../portals/app/app/domains/aggregation/pg-input-refresh.ts';
import { PgMeasurementStore } from '../../portals/app/app/domains/measurements/pg-store.ts';
import { FIRST_METRICS } from '../../portals/app/app/domains/catalog/first-metrics.ts';

export async function registeredInputCases(t,{db,adapterPool,ports,scope,upMetric,period,writer,draft,finishChangeJobs}){
  const finite={...scope,metricKeys:[upMetric.code+'@1'],deviceIds:[]}, policy={outputs:[upMetric],grains:['day']};
  const config={subject:'snapshot-worker',status:'active',scope:finite,policy,seeds:[{sourceId:'flow-src',mappingId:'flow-cell-map',metric:upMetric,notBefore:period.start,grains:['day']}]};
  const register=(id,revision,patch={})=>db.query(`INSERT INTO bsmoss_integration.refresh_partition_revision(workspace_id,id,revision,config,review_ref) VALUES ('w',$1,$2,$3,'fixture://input-partition')`,[id,String(revision),JSON.stringify({...config,...patch})]);
  const latestChange=async(kind,event='flow:up')=>(await db.query(`SELECT c.id FROM bsmoss_metering.input_change c JOIN bsmoss_metering.measurement m ON (c.workspace_id,c.measurement_id)=(m.workspace_id,m.id)
    WHERE m.workspace_id='w' AND m.source_id='flow-src' AND m.event_id=$1 AND c.change_kind=$2 ORDER BY m.event_revision DESC,c.quality_revision DESC NULLS LAST LIMIT 1`,[event,kind])).rows[0].id;
  async function correction(value='120',patch={},customWriter=writer){
    const prior=(await db.query("SELECT event_revision FROM bsmoss_metering.measurement WHERE source_id='flow-src' AND event_id='flow:up' ORDER BY event_revision DESC LIMIT 1")).rows[0].event_revision;
    const revision=(BigInt(prior)+1n).toString();await customWriter.append(draft('up',upMetric,{kind:'integer_delta',value},{revision,previousRevision:prior,payloadSha256:createHash('sha256').update(revision).digest('hex'),...patch}));return latestChange('measurement');
  }
  const counts=async()=>(await db.query('SELECT (SELECT count(*) FROM bsmoss_analysis.refresh_job) jobs,(SELECT count(*) FROM bsmoss_analysis.input_refresh_receipt) receipts,(SELECT count(*) FROM bsmoss_analysis.input_dispatch_event) failures,(SELECT count(*) FROM bsmoss_analysis.aggregate_authority_invalidation) invalidations')).rows[0];
  const intercept=observe=>({async connect(){const c=await adapterPool.connect();return {async query(sql,args){return observe(c,sql,args);},release(d){c.release(d);}};}});
  let primary;
  await t.test('registered input discovery and dispatch bind the exact configuration with independent durable replay',async()=>{
    await register('input-main',1);primary=await correction();const pending=await pendingRegisteredInputChanges(adapterPool,ports,'input-main');assert.ok(pending.changeIds.includes(primary));
    const result=await dispatchRegisteredInputChange(adapterPool,ports,'input-main',primary);assert.equal(result.status,'dispatched');assert.equal(result.manifest.jobs.length,1);assert.equal(result.registration.partitionId,'input-main');assert.equal(result.registration.revision,'1');assert.deepEqual(result.manifest.registration,result.registration);
    const row=(await db.query('SELECT partition_id,partition_revision FROM bsmoss_analysis.input_refresh_receipt WHERE change_id=$1 AND subscription_sha256=$2',[primary,result.manifest.subscriptionSha256])).rows[0];assert.deepEqual(row,{partition_id:'input-main',partition_revision:'1'});
    const before=await counts();assert.equal((await dispatchRegisteredInputChange(adapterPool,ports,'input-main',primary)).status,'duplicate');assert.deepEqual(await counts(),before);
    assert.ok(!(await pendingRegisteredInputChanges(adapterPool,ports,'input-main')).changeIds.includes(primary));await finishChangeJobs(result.manifest,ports);
    const direct=await dispatchInputChange(adapterPool,ports,primary,policy);assert.notEqual(direct.manifest.subscriptionSha256,result.manifest.subscriptionSha256);assert.equal(direct.manifest.registration,undefined);
    assert.equal((await db.query('SELECT partition_id FROM bsmoss_analysis.input_refresh_receipt WHERE change_id=$1 AND subscription_sha256=$2',[primary,direct.manifest.subscriptionSha256])).rows[0].partition_id,null);await finishChangeJobs(direct.manifest,ports);
  });
  await t.test('different registered identities and revisions never reuse another partition receipt and pause blocks every entry',async()=>{
    await register('input-other',1);const other=await dispatchRegisteredInputChange(adapterPool,ports,'input-other',primary);assert.equal(other.status,'dispatched');await finishChangeJobs(other.manifest,ports);
    await register('input-main',2);const revised=await dispatchRegisteredInputChange(adapterPool,ports,'input-main',primary);assert.equal(revised.status,'dispatched');assert.notEqual(revised.manifest.subscriptionSha256,other.manifest.subscriptionSha256);await finishChangeJobs(revised.manifest,ports);
    await register('input-main',3,{status:'paused'});
    for(const call of [()=>pendingRegisteredInputChanges(adapterPool,ports,'input-main'),()=>runRegisteredInputStep(adapterPool,ports,'input-main'),()=>dispatchRegisteredInputChange(adapterPool,ports,'input-main',primary),()=>reopenRegisteredInputChange(adapterPool,ports,'input-main',{changeId:primary,expectedRevision:'5',reasonRef:'fixture://fix'})])await assert.rejects(call,/registered_partition_paused/);
    await register('input-main',4);const restored=await dispatchRegisteredInputChange(adapterPool,ports,'input-main',primary);assert.equal(restored.status,'dispatched');assert.equal(restored.registration.revision,'4');await finishChangeJobs(restored.manifest,ports);
    assert.equal((await db.query("SELECT count(*)::int n FROM bsmoss_analysis.input_refresh_receipt WHERE partition_id='input-main' AND change_id=$1",[primary])).rows[0].n,3);
  });
  await t.test('only registered scope affects progress while final grant loss rolls back already-written receipts',async()=>{
    const event=await correction('121');let reads=0;const narrowed={...ports,async readLocalGrant(){const g=await ports.readLocalGrant();return {...g,scope:++reads>1?finite:scope};}};
    const valid=await dispatchRegisteredInputChange(adapterPool,narrowed,'input-main',event);assert.equal(valid.status,'dispatched');await finishChangeJobs(valid.manifest,ports);
    for(const mode of ['permission','scope','receipt']){
      const id='input-revoke-'+mode;await register(id,1);let grants=0,deny=false;const before=await counts();
      const revoked={...ports,async readLocalGrant(){const g=await ports.readLocalGrant();grants++;return (mode==='receipt'?deny:grants>1)?mode==='scope'?{...g,scope:{...scope,serviceIds:[]}}:{...g,permissions:[]}:g;}};
      const pool=intercept(async(c,sql,args)=>{const result=await c.query(sql,args);if(sql.includes('INSERT INTO bsmoss_analysis.input_refresh_receipt'))deny=true;return result;});
      await assert.rejects(superviseRegisteredInputChange(pool,revoked,id,event),/permission_denied|registered_partition_scope_denied/);assert.deepEqual(await counts(),before);
    }
  });
  await t.test('registered retries quarantine and reopen preserve exact configuration history without acknowledging failed work',async()=>{
    const id='input-poison';await register(id,1);const event=await correction('122'),before=await counts();
    const poisoned=intercept(async(c,sql,args)=>{if(sql.includes('INSERT INTO bsmoss_analysis.input_refresh_receipt'))throw Error('fixture_registered_receipt_failure');return c.query(sql,args);});
    let last;
    for(let attempt=1;attempt<=5;attempt++){
      last=await superviseRegisteredInputChange(poisoned,ports,id,event);assert.equal(last.status,'failure_recorded');assert.equal(last.attempt,attempt);assert.equal(last.registration.partitionId,id);
      const stored=(await db.query('SELECT partition_id,partition_revision FROM bsmoss_analysis.input_dispatch_event WHERE change_id=$1 AND subscription_sha256=$2 ORDER BY revision DESC LIMIT 1',[event,(await pendingRegisteredInputChanges(adapterPool,ports,id)).subscriptionSha256])).rows[0];assert.deepEqual(stored,{partition_id:id,partition_revision:'1'});
      if(attempt<5){assert.equal((await superviseRegisteredInputChange(adapterPool,ports,id,event)).status,'deferred');await db.query("UPDATE bsmoss_analysis.input_dispatch_event SET available_at=clock_timestamp()-interval '1 second' WHERE partition_id=$1",[id]);}
    }
    assert.equal(last.state,'quarantined');assert.equal((await counts()).jobs,before.jobs);assert.equal((await counts()).receipts,before.receipts);
    assert.equal((await superviseRegisteredInputChange(adapterPool,ports,id,event)).status,'quarantined');assert.ok(!(await pendingRegisteredInputChanges(adapterPool,ports,id)).changeIds.includes(event));
    const step=await runRegisteredInputStep(adapterPool,ports,id);assert.equal(step.status,'dispatched');assert.notEqual(step.changeId,event);await finishChangeJobs(step.manifest,ports);
    await assert.rejects(reopenRegisteredInputChange(adapterPool,ports,id,{changeId:event,expectedRevision:'4',reasonRef:'fixture://corrected'}),/input_dispatch_revision_conflict/);
    const request={changeId:event,expectedRevision:'5',reasonRef:'fixture://corrected'};assert.equal((await reopenRegisteredInputChange(adapterPool,ports,id,request)).status,'reopened');assert.equal((await reopenRegisteredInputChange(adapterPool,ports,id,request)).status,'duplicate');
    const fixed=await dispatchRegisteredInputChange(adapterPool,ports,id,event);assert.equal(fixed.status,'dispatched');await finishChangeJobs(fixed.manifest,ports);
    assert.equal((await db.query('SELECT count(*)::int n FROM bsmoss_analysis.input_dispatch_event WHERE partition_id=$1 AND change_id=$2',[id,event])).rows[0].n,6);
  });
  await t.test('failure recording faults and authorization revoked after failure insertion leave no partial evidence',async()=>{
    const event=await correction('123');
    for(const mode of ['storage','revoke']){
      const id='input-failure-'+mode;await register(id,1);const before=await counts();let deny=false;
      const guarded={...ports,async readLocalGrant(){const g=await ports.readLocalGrant();return deny?{...g,permissions:[]}:g;}};
      const pool=intercept(async(c,sql,args)=>{
        if(sql.includes('INSERT INTO bsmoss_analysis.input_refresh_receipt'))throw Error('fixture_receipt_failure');
        if(sql.includes('INSERT INTO bsmoss_analysis.input_dispatch_event')){if(mode==='storage')throw Error('fixture_failure_recording');const result=await c.query(sql,args);deny=true;return result;}return c.query(sql,args);
      });
      await assert.rejects(superviseRegisteredInputChange(pool,guarded,id,event),/fixture_failure_recording|permission_denied/);assert.deepEqual(await counts(),before);
    }
  });
  await t.test('concurrent registered consumption fences one event in one subscription and replays its receipt',async()=>{
    const id='input-concurrent';await register(id,1);const event=await correction('124');let ready,release;const observed=new Promise(r=>ready=r),gate=new Promise(r=>release=r);
    const pool=intercept(async(c,sql,args)=>{if(sql.includes('INSERT INTO bsmoss_analysis.input_refresh_receipt')){ready();await gate;}return c.query(sql,args);});
    const first=dispatchRegisteredInputChange(pool,ports,id,event);
    try{await Promise.race([observed,first.then(()=>{throw Error('fixture_intercept_missing');})]);assert.equal((await dispatchRegisteredInputChange(adapterPool,ports,id,event)).status,'busy');}finally{release();}
    const result=await first;assert.equal(result.status,'dispatched');assert.equal((await dispatchRegisteredInputChange(adapterPool,ports,id,event)).status,'duplicate');await finishChangeJobs(result.manifest,ports);
  });
  await t.test('configuration pause waits through both success and failure SAVEPOINT paths before taking effect',async()=>{
    const event=await correction('125');
    for(const mode of ['success','failure']){
      const id='input-config-race-'+mode;await register(id,1);let pending,blocked=false;
      const pool=intercept(async(c,sql,args)=>{
        if(mode==='failure'&&sql.includes('INSERT INTO bsmoss_analysis.input_refresh_receipt'))throw Error('fixture_work_failure');
        if(sql.includes(mode==='success'?'INSERT INTO bsmoss_analysis.input_refresh_receipt':'INSERT INTO bsmoss_analysis.input_dispatch_event')){
          pending=register(id,2,{status:'paused'});
          for(let n=0;n<100;n++){if((await adapterPool.query('SELECT EXISTS(SELECT 1 FROM pg_locks WHERE pid=$1 AND NOT granted) blocked',[db.processID])).rows[0].blocked){blocked=true;break;}await new Promise(r=>setTimeout(r,10));}
          assert.equal(blocked,true);
        }return c.query(sql,args);
      });
      const result=await superviseRegisteredInputChange(pool,ports,id,event);await pending;assert.equal(result.registration.revision,'1');assert.equal(result.status,mode==='success'?'dispatched':'failure_recorded');
      await assert.rejects(pendingRegisteredInputChanges(adapterPool,ports,id),/registered_partition_paused/);if(result.manifest)await finishChangeJobs(result.manifest,ports);
    }
  });
  await t.test('a configuration replacement committed before acquisition rejects an obsolete input transaction',async()=>{
    const id='input-prelock-race';await register(id,1);const before=await counts();let injected=false;
    const pool=intercept(async(c,sql,args)=>{if(!injected&&sql.includes('SELECT bsmoss_integration.lock_refresh_partition')){injected=true;await c.query('SELECT 1');await register(id,2,{status:'paused'});}return c.query(sql,args);});
    await assert.rejects(dispatchRegisteredInputChange(pool,ports,id,primary),e=>e.code==='40001');assert.equal(injected,true);assert.deepEqual(await counts(),before);
  });
  await t.test('registered discovery still sees a late completion commit after a newer measurement was consumed',async()=>{
    const id='input-late';await register(id,1);let late;
    await db.query('BEGIN');try{
      await db.query(`INSERT INTO bsmoss_integration.source_completion_set(workspace_id,id,source_id,station_id,service_id,network_object_id,metric_code,metric_version,grain,period_start,period_end,revision,status,input_fingerprint,mapping_manifest_sha256,watermark,evidence_ref,evidence_sha256,recorded_by)
        VALUES ('w','input-late-proof','flow-src','st','flow-svc','flow-cell',$1,1,'day',$2,$3,101,'revoked',$4,$4,$2,'fixture://late-proof',$4,'fixture-reviewer')`,[upMetric.code,period.start,period.end,'a'.repeat(64)]);
      late=(await db.query("SELECT id FROM bsmoss_metering.input_change WHERE completion_set_id='input-late-proof'")).rows[0].id;
      assert.ok(!(await pendingRegisteredInputChanges(adapterPool,ports,id)).changeIds.includes(late));
      // The writer uses a separate runtime connection, while this proof is open.
      const prior=(await adapterPool.query("SELECT event_revision FROM bsmoss_metering.measurement WHERE source_id='flow-src' AND event_id='flow:up' ORDER BY event_revision DESC LIMIT 1")).rows[0].event_revision,revision=(BigInt(prior)+1n).toString();
      await writer.append(draft('up',upMetric,{kind:'integer_delta',value:'126'},{revision,previousRevision:prior,payloadSha256:createHash('sha256').update(revision).digest('hex')}));
      const newer=(await adapterPool.query(`SELECT c.id FROM bsmoss_metering.input_change c JOIN bsmoss_metering.measurement m ON (c.workspace_id,c.measurement_id)=(m.workspace_id,m.id) WHERE m.source_id='flow-src' AND m.event_id='flow:up' AND c.change_kind='measurement' ORDER BY event_revision DESC LIMIT 1`)).rows[0].id;
      const result=await dispatchRegisteredInputChange(adapterPool,ports,id,newer);await finishChangeJobs(result.manifest,ports);await db.query('COMMIT');
    }catch(error){await db.query('ROLLBACK');throw error;}
    assert.ok((await pendingRegisteredInputChanges(adapterPool,ports,id)).changeIds.includes(late));const result=await dispatchRegisteredInputChange(adapterPool,ports,id,late);assert.equal(result.manifest.change.kind,'completion_set');assert.equal(result.manifest.jobs.length,1);await finishChangeJobs(result.manifest,ports);
  });
  await t.test('registered quality and authority changes use the same atomic dispatcher and preserve their bindings',async()=>{
    const id='input-quality-authority';await register(id,1);const m=(await db.query("SELECT id FROM bsmoss_metering.measurement WHERE source_id='flow-src' AND event_id='flow:up' ORDER BY event_revision DESC LIMIT 1")).rows[0].id;
    await db.query("INSERT INTO bsmoss_metering.quality_decision(workspace_id,id,measurement_id,revision,quality,rule_version,reason,decided_by) VALUES ('w','registered-quality',$1,2,'pending','1','fixture pending','fixture-reviewer')",[m]);
    const changed=await latestChange('quality');const quality=await dispatchRegisteredInputChange(adapterPool,ports,id,changed);assert.equal(quality.manifest.change.kind,'quality');await finishChangeJobs(quality.manifest,ports);
    await db.query("UPDATE bsmoss_integration.source_capability SET validation_ref='fixture://registered-authority' WHERE id='flow-up-cap'");
    const authority=(await db.query(`SELECT c.id FROM bsmoss_metering.input_change c JOIN bsmoss_integration.authority_change a ON (c.workspace_id,c.authority_change_id)=(a.workspace_id,a.id) WHERE a.entity_id='flow-up-cap' ORDER BY a.revision DESC LIMIT 1`)).rows[0].id;
    const result=await dispatchRegisteredInputChange(adapterPool,ports,id,authority);assert.equal(result.manifest.change.kind,'authority');assert.ok(result.manifest.evidence.some(e=>e.invalidated));await finishChangeJobs(result.manifest,ports);
    const receipt=(await db.query('SELECT * FROM bsmoss_analysis.input_refresh_receipt WHERE change_id=$1 AND partition_id=$2',[authority,id])).rows[0];
    for(const [patch,code] of [[{workspace_id:'other'},'23503'],[{partition_revision:'999',manifest:{...receipt.manifest,registration:{...receipt.manifest.registration,revision:'999'}}},'23503'],
      [{partition_id:null},'23514'],[{partition_id:null,partition_revision:null},'23514'],[{manifest:{...receipt.manifest,registration:{...receipt.manifest.registration,revision:'999'}}},'23514']]){
      const row={...receipt,...patch,subscription_sha256:'e'.repeat(64),manifest:{...(patch.manifest??receipt.manifest),subscriptionSha256:'e'.repeat(64)}},keys=Object.keys(row);
      await assert.rejects(db.query('INSERT INTO bsmoss_analysis.input_refresh_receipt('+keys.join(',')+') VALUES ('+keys.map((_,i)=>'$'+(i+1)).join(',')+')',Object.values(row)),e=>e.code===code);
    }
  });
  await t.test('cross-object corrections require all old and new objects in the reviewed partition rather than partial consumption',async()=>{
    const id='input-move';await register(id,1);await db.query(`INSERT INTO bsmoss_resource.station_service VALUES ('w','registered-new-svc','st','op','2026-01-01Z','2027-01-01Z');
      INSERT INTO bsmoss_resource.network_object VALUES ('w','registered-new-cell','st','registered-new-svc','cell');
      INSERT INTO bsmoss_integration.source_mapping(workspace_id,id,source_id,external_type,external_id,station_id,service_id,network_object_id,version,valid_from,valid_to)
        VALUES ('w','registered-new-map','flow-src','cell','registered-new-cell','st','registered-new-svc','registered-new-cell',1,'2026-01-01Z','2027-01-01Z')`);
    const broad={...scope,serviceIds:[...scope.serviceIds,'registered-new-svc']},widePorts={...ports,async readLocalGrant(){return {...await ports.readLocalGrant(),scope:broad};}};
    const wideWriter=new PgMeasurementStore(adapterPool,broad,FIRST_METRICS),event=await correction('127',{mappingId:'registered-new-map'},wideWriter),before=await counts();
    await assert.rejects(superviseRegisteredInputChange(adapterPool,widePorts,id,event),/object_scope_denied/);assert.deepEqual(await counts(),before);
    await register(id,2,{scope:{...finite,serviceIds:[...finite.serviceIds,'registered-new-svc']}});
    const moved=await dispatchRegisteredInputChange(adapterPool,widePorts,id,event);assert.equal(moved.manifest.jobs.length,2);assert.deepEqual(new Set(moved.manifest.targets.map(t=>t.mappingId)),new Set(['flow-cell-map','registered-new-map']));await finishChangeJobs(moved.manifest,widePorts);
  });
}
