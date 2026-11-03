import { mutateTemplateFixture } from './template-owner-fixture.mjs';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fingerprintOf } from '../../portals/app/app/domains/aggregation/intervals.ts';
import { bucketFor } from '../../portals/app/app/domains/aggregation/periods.ts';
import { reconcileRegisteredReport, readHistoryCheck } from '../../portals/app/app/domains/reports/pg-history.ts';
import { createReportWorker } from '../../portals/app/app/domains/workers/report-worker.ts';
import { PgReportStore } from '../../portals/app/app/domains/reports/pg-store.ts';
import { createAuthorizedReports } from '../../portals/app/app/domains/access/reports.ts';

export async function reportHistoryCases(t,{db,adapterPool,access,scope,api,up,period,write,publish,putTemplate,single,intercept}) {
  const subject=(await access.readVerifiedIdentity()).sub;
  let clock=Date.parse('2026-11-03T00:15:00Z');
  const worker={...access,now:()=>clock,
    async readVerifiedIdentity(){return {...await access.readVerifiedIdentity(),expiresAt:Math.max(Date.now(),clock)+60000};},
    async readCoverage(w){return {...await access.readCoverage(w),expiresAt:Math.max(Date.now(),clock)+60000};},
    async readLocalGrant(s){return {...await access.readLocalGrant(s),expiresAt:Math.max(Date.now(),clock)+60000};}},
    make=(p=worker,pool=adapterPool)=>createAuthorizedReports(p,{create:s=>new PgReportStore(pool,s)},'data');
  const check=(id,p=worker,pool=adapterPool)=>reconcileRegisteredReport(pool,p,id);
  const register=async(id,config,revision=1)=>db.query(`INSERT INTO bsmoss_integration.report_schedule_revision(workspace_id,id,revision,config,review_ref) VALUES('w',$1,$2,$3,'fixture://report-history-reviewed')`,[id,revision,config]);
  const count=async()=>(await db.query(`SELECT (SELECT count(*) FROM bsmoss_analysis.report_history_check) checks,
    (SELECT count(*) FROM bsmoss_analysis.report_revision) reports,(SELECT count(*) FROM bsmoss_analysis.report_outbox) outbox,
    (SELECT count(*) FROM bsmoss_analysis.report_publication_event) publications`)).rows[0];
  async function fixture({grain='day',disconnected=false,at=period.start,required=scope,mappingId=null}={}) {
    const id='history-'+randomUUID(),definition={...single(grain),title:id};if(disconnected)definition.bindings=[{panelId:'usage',kind:'not_connected'}];
    if(mappingId)definition.bindings=[{panelId:'usage',kind:'aggregate',sourceId:'report-src',mappingId}];
    await putTemplate(id,definition);
    const p={...worker,async readLocalGrant(){return {...await worker.readLocalGrant(),scope:required};}},record=(await make(p).generate({templateCode:id,templateVersion:1,at,expectedRevision:null})).record;
    const config={subject,status:'active',scope:required,templateCode:id,templateVersion:1,templateSha256:fingerprintOf(definition),grain,notBefore:bucketFor(at,grain).start,delayMinutes:480,lookbackHours:72};
    await register(id,config);return {id,definition,record,config,worker:p};
  }
  const receipt=async(f,hour=bucketFor(new Date(clock).toISOString(),'hour').start,pool=adapterPool)=>{const c=await pool.connect();try{return await readHistoryCheck(c,'w',f.id,'1',hour,f.record.reportId);}finally{c.release();}};
  let first;
  await t.test('history checks regenerate changes months outside calendar lookback without publishing or mutating original reports',async()=>{
    await write(up,{kind:'integer_delta',value:'610'});await publish(up);first=await fixture();
    await write(up,{kind:'integer_delta',value:'620'});await publish(up);const before=await count(),r=await check(first.id);
    assert.equal(r.status,'checked');assert.equal(r.receipt.manifest.outcome,'inserted');assert.equal(r.receipt.manifest.result.revision,'2');assert.equal(r.receipt.manifest.original.revision,'1');
    assert.equal(r.receipt.manifest.before.freshness,'stale');assert.ok(r.receipt.manifest.before.reasons.includes('usage:input_or_publication_changed'));
    const current=await api.read({reportId:first.record.reportId}),old=await api.read({reportId:first.record.reportId,revision:'1'});
    assert.equal(current.manifest.items[0].data.publication.result.value.value,'620');assert.equal(old.manifest.items[0].data.publication.result.value.value,'610');assert.equal(old.freshness,'stale');
    assert.equal((await count()).publications,before.publications);assert.equal(BigInt((await count()).reports),BigInt(before.reports)+1n);assert.deepEqual((await receipt(first)).manifest,r.receipt.manifest);
    const after=await count();assert.equal((await check(first.id)).status,'idle');assert.deepEqual(await count(),after);
  });
  await t.test('hour receipts never skip later reports and changes after a completed hour are found in the next hour',async()=>{
    await write(up,{kind:'integer_delta',value:'630'});await publish(up);assert.equal((await check(first.id)).status,'idle');
    clock+=3600000;assert.equal((await check(first.id)).receipt.manifest.outcome,'inserted');assert.equal((await api.read({reportId:first.record.reportId})).revision,'3');
    const future=bucketFor('2026-07-07T00:00:00+08:00','day'),late=(await make().generate({templateCode:first.id,templateVersion:1,at:future.start,expectedRevision:null})).record;
    const r=await check(first.id);assert.equal(r.status,'checked');assert.equal(r.receipt.manifest.reportId,late.reportId);assert.equal(r.receipt.manifest.outcome,'duplicate');assert.equal(r.receipt.manifest.before.freshness,'stale');assert.equal((await check(first.id)).status,'idle');
    clock+=3600000;const a=await check(first.id),b=await check(first.id);assert.equal(a.receipt.manifest.reportId,first.record.reportId);assert.equal(b.receipt.manifest.reportId,late.reportId);assert.equal(a.receipt.manifest.outcome,'unchanged');
  });
  await t.test('weekly and monthly reports detect an independently changed daily dependency even when the period publication is unchanged',async()=>{
    for(const grain of ['week','month']) {
      await publish(up,grain,period.start);const f=await fixture({grain}),original=f.record.manifest.items[0],main=original.data.publication.revision;
      await write(up,{kind:'integer_delta',value:grain==='week'?'640':'650'});await publish(up);const r=await check(f.id),next=await api.read({reportId:f.record.reportId});
      assert.equal(r.receipt.manifest.outcome,'inserted');assert.equal(next.manifest.items[0].data.publication.revision,main);
      assert.notEqual(next.manifest.items[0].dependencyFingerprint,original.dependencyFingerprint);assert.equal(next.manifest.items[0].dailyDependencies.length,grain==='week'?7:31);
      assert.notEqual(next.manifest.dataCompleteness,'complete');assert.equal((await api.read({reportId:f.record.reportId,revision:'1'})).manifest.items[0].data.publication.revision,main);
    }
  });
  await t.test('unconnected and missing source observations stay explicit and known missing bindings record blocked without blocking later reports',async()=>{
    const disconnected=await fixture({disconnected:true}),r=await check(disconnected.id);assert.equal(r.receipt.manifest.outcome,'unchanged');assert.equal(r.receipt.manifest.before.freshness,'current');
    assert.equal((await api.read({reportId:disconnected.record.reportId})).manifest.dataCompleteness,'incomplete');
    const mappingId='history-unmeasured-'+randomUUID(),original={...(await db.query("SELECT * FROM bsmoss_integration.source_mapping WHERE id='report-cell-map'")).rows[0],id:mappingId,external_id:mappingId};
    const keys=Object.keys(original);await db.query('INSERT INTO bsmoss_integration.source_mapping('+keys.join(',')+') VALUES('+keys.map((_,i)=>'$'+(i+1)).join(',')+')',Object.values(original));
    const f=await fixture({mappingId}),later=(await make().generate({templateCode:f.id,templateVersion:1,at:'2026-07-07T00:00:00+08:00',expectedRevision:null})).record;
    await db.query('DELETE FROM bsmoss_integration.source_mapping WHERE id=$1',[mappingId]);
    try {const blocked=await check(f.id);assert.equal(blocked.receipt.manifest.outcome,'blocked');assert.equal(blocked.receipt.manifest.failureCode,'report_binding_unavailable');assert.equal(blocked.receipt.manifest.result.revision,'1');
      const next=await check(f.id);assert.equal(next.receipt.manifest.outcome,'blocked');assert.equal(next.receipt.manifest.reportId,later.reportId);assert.equal((await check(f.id)).status,'idle');}
    finally {const keys=Object.keys(original);await db.query('INSERT INTO bsmoss_integration.source_mapping('+keys.join(',')+') VALUES('+keys.map((_,i)=>'$'+(i+1)).join(',')+')',Object.values(original));}
    clock+=3600000;assert.equal((await check(f.id)).status,'checked');await db.query('DELETE FROM bsmoss_integration.source_mapping WHERE id=$1',[mappingId]);
  });
  await t.test('history selectors enforce the complete historical scope before limit and never borrow owner or another subject authority',async()=>{
    const f=await fixture({disconnected:true});
    for(const mode of ['permission','scope','subject','owner','expiry','workspace']) {
      const p={...worker,async readVerifiedIdentity(){const i=await worker.readVerifiedIdentity();return mode==='subject'?{...i,sub:'wrong'}:mode==='owner'?{...i,governanceRoles:['workspace:owner']}:mode==='workspace'?{...i,activeWorkspace:'other'}:i;},
        async readLocalGrant(s){const g=await worker.readLocalGrant(s);return mode==='permission'||mode==='owner'?{...g,permissions:['metering.view']}:mode==='scope'?{...g,scope:{...scope,deviceIds:[]}}:mode==='expiry'?{...g,expiresAt:0}:g;}};
      const before=await count();await assert.rejects(check(f.id,p),/denied|expired|unavailable|mismatch|invalid_coverage/);assert.deepEqual(await count(),before);
    }
    // The registration can be narrower than an existing historical report.
    const narrow={...scope,stationIds:[]},g=await fixture();await register(g.id,{...g.config,scope:narrow},2);
    const p={...worker,async readLocalGrant(){return {...await worker.readLocalGrant(),scope:narrow};}};assert.equal((await check(g.id,p)).status,'idle');
    await register(g.id,{...g.config,status:'paused'},3);await assert.rejects(check(g.id),/report_schedule_paused/);
  });
  await t.test('history regeneration and receipts roll back atomically for write faults and each final authorization loss',async()=>{
    for(const mode of ['identity','coverage','permission','scope','expiry','receipt','readback','sql']) {
      const f=await fixture();await write(up,{kind:'integer_delta',value:String(700+mode.length)});await publish(up);const before=await count();let written=false;
      const pool=intercept(async(c,sql,args)=>{const r=await c.query(sql,args);if(sql.includes('INSERT INTO bsmoss_analysis.report_history_check')){written=true;if(mode==='receipt')throw Error('fixture_history_receipt_interrupted');}
        if(mode==='readback'&&sql.includes('SELECT *,database_sha256=encode')&&r.rows.length)r.rows[0].manifest_sha256='0'.repeat(64);
        if(mode==='sql'&&sql.includes('SELECT s.id,s.current_revision'))return c.query('SELECT * FROM fixture_history_storage_absent');return r;});
      const p={...worker,async readVerifiedIdentity(){const i=await worker.readVerifiedIdentity();return written&&mode==='identity'?{...i,sub:'revoked'}:i;},
        async readCoverage(w){const c=await worker.readCoverage(w);return written&&mode==='coverage'?{...c,tier:null,bundled:false}:c;},
        async readLocalGrant(s){const g=await worker.readLocalGrant(s);return !written?g:mode==='permission'?{...g,permissions:[]}:mode==='scope'?{...g,scope:{...scope,sourceIds:[]}}:mode==='expiry'?{...g,expiresAt:0}:g;}};
      await assert.rejects(check(f.id,p,pool));assert.deepEqual(await count(),before);assert.equal((await api.read({reportId:f.record.reportId})).revision,'1');
      assert.equal((await check(f.id)).receipt.manifest.outcome,'inserted');
    }
  });
  await t.test('history concurrency uses durable exclusion and stale repeatable-read report heads cannot overwrite newer generations',async()=>{
    const f=await fixture();await write(up,{kind:'integer_delta',value:'801'});await publish(up);
    let entered,release,hold=true;const ready=new Promise(r=>entered=r),gate=new Promise(r=>release=r);
    const held=intercept(async(c,sql,args)=>{const r=await c.query(sql,args);if(hold&&sql.includes('pg_try_advisory_xact_lock')){hold=false;entered();await gate;}return r;});
    const work=check(f.id,worker,held);await ready;try{assert.equal((await check(f.id)).status,'busy');}finally{release();}assert.equal((await work).status,'checked');assert.equal((await check(f.id)).status,'idle');
    const g=await fixture();await write(up,{kind:'integer_delta',value:'802'});await publish(up);let changed=false;
    const race=intercept(async(c,sql,args)=>{const r=await c.query(sql,args);if(!changed&&sql.includes('SELECT s.id,s.current_revision')){changed=true;await make().generate({templateCode:g.id,templateVersion:1,at:period.start,expectedRevision:'1'});}return r;});
    const before=await count();await assert.rejects(check(g.id,worker,race),e=>e.code==='40001'||/report_revision_conflict/.test(e.message));assert.equal(changed,true);assert.equal((await count()).checks,before.checks);
    assert.equal((await check(g.id)).receipt.manifest.outcome,'unchanged');assert.equal((await api.read({reportId:g.record.reportId})).revision,'2');
  });
  await t.test('registered history host lanes resume after interruption and share fixed worker identity without auto publication',async()=>{
    const f=await fixture({disconnected:true}),options={workspaceId:'w',subject,scheduleIds:[f.id],executeExports:false,reconcileHistory:true,maxStepsPerTick:2,pollMilliseconds:1000},controller=new AbortController();
    const interrupted=intercept(async(c,sql,args)=>{const r=await c.query(sql,args);if(sql.includes('INSERT INTO bsmoss_analysis.report_history_check')){controller.abort();throw Error('fixture_host_interrupted');}return r;});
    const before=await count(),stopped=await createReportWorker(interrupted,worker,options).tick(controller.signal);assert.equal(stopped.status,'stopped');assert.equal((await count()).checks,before.checks);
    const resumed=await createReportWorker(adapterPool,worker,options).tick();assert.equal(resumed.events[1].status,'succeeded');assert.equal((await count()).publications,before.publications);
    assert.equal((await receipt(f)).manifest.outcome,'unchanged');
  });
  await t.test('history receipt database provenance is immutable and checks fail closed on SHA scope result and binding tampering',async()=>{
    const f=await fixture({disconnected:true}),r=await check(f.id),row=(await db.query('SELECT * FROM bsmoss_analysis.report_history_check WHERE report_id=$1',[f.record.reportId])).rows[0];
    assert.notEqual(row.database_actor,'forged');assert.equal(row.recorded_by,subject);assert.equal(row.database_sha256,(await db.query("SELECT encode(sha256(convert_to($1::jsonb::text,'UTF8')),'hex') actual",[row.manifest])).rows[0].actual);
    for(const sql of ["UPDATE bsmoss_analysis.report_history_check SET outcome=outcome","DELETE FROM bsmoss_analysis.report_history_check","TRUNCATE bsmoss_analysis.report_history_check CASCADE"])await assert.rejects(db.query(sql),/report_history_append_only/);
    await assert.rejects(adapterPool.query('UPDATE bsmoss_analysis.report_history_check SET recorded_by=recorded_by'),e=>e.code==='42501');
    for(const mode of ['sha','scope','result','schedule','hour','outcome']) {
      const corrupt=intercept(async(c,sql,args)=>{const r=await c.query(sql,args);if(sql.includes('SELECT *,database_sha256=encode')&&r.rows.length){const x=r.rows[0];
        if(mode==='sha')x.valid=false;else {if(mode==='scope')x.manifest.requiredScope.metricKeys=[];if(mode==='result')x.manifest.result.revision='999';if(mode==='schedule')x.manifest.scheduleSha256='0'.repeat(64);if(mode==='hour')x.scan_hour=new Date(0);if(mode==='outcome')x.outcome='inserted';x.manifest_sha256=fingerprintOf(x.manifest);}}return r;});
      await assert.rejects(receipt(f,undefined,corrupt));
    }
    for(const patch of [{workspace_id:'other'},{schedule_id:'foreign'},{outcome:'inserted'},{recorded_by:'other-worker'}]) {
      const copy={...row,...patch,scan_hour:new Date(row.scan_hour.getTime()+3600000)},keys=Object.keys(copy);await assert.rejects(db.query('INSERT INTO bsmoss_analysis.report_history_check('+keys.join(',')+') VALUES('+keys.map((_,i)=>'$'+(i+1)).join(',')+')',Object.values(copy)));
    }
    assert.equal(r.receipt.manifest.outcome,'unchanged');
  });
  await t.test('physical history checks require the independent site flag for discovery and commit and unrelated scope shrink does not widen the registration',async()=>{
    const definition=(await db.query("SELECT definition FROM bsmoss_views.template_version WHERE code='worker-site'")).rows[0].definition,id='history-site-'+randomUUID();
    const site={...scope,serviceIds:[],deviceIds:[],metricKeys:['runtime.energy.site_wh@1'],allowSiteParameters:true};await putTemplate(id,definition);
    const p={...worker,async readLocalGrant(){return {...await worker.readLocalGrant(),scope:site};}},record=(await make(p).generate({templateCode:id,templateVersion:1,at:period.start,expectedRevision:null})).record;
    const config={subject,status:'active',scope:site,templateCode:id,templateVersion:1,templateSha256:fingerprintOf(definition),grain:'day',notBefore:period.start,delayMinutes:480,lookbackHours:72};await register(id,config);
    let wrote=false;const pool=intercept(async(c,sql,args)=>{const r=await c.query(sql,args);if(sql.includes('INSERT INTO bsmoss_analysis.report_history_check'))wrote=true;return r;}),before=await count();
    const lost={...p,async readLocalGrant(){const g=await p.readLocalGrant();return wrote?{...g,scope:{...site,allowSiteParameters:false}}:g;}};
    await assert.rejects(check(id,lost,pool),/report_scope_denied/);assert.equal(wrote,true);assert.deepEqual(await count(),before);
    assert.equal((await check(id,p)).receipt.manifest.requiredScope.allowSiteParameters,true);
    await register(id,{...config,scope:{...site,allowSiteParameters:false}},2);assert.equal((await check(id,p)).status,'idle');
    assert.equal((await db.query('SELECT current_revision FROM bsmoss_analysis.report_series WHERE id=$1',[record.reportId])).rows[0].current_revision,record.revision);
  });
  await t.test('history registration fences serialize pause and reject replaced snapshots while source corruption never becomes blocked evidence',async()=>{
    const f=await fixture({disconnected:true});let entered,release,hold=true;const ready=new Promise(r=>entered=r),gate=new Promise(r=>release=r);
    const held=intercept(async(c,sql,args)=>{const r=await c.query(sql,args);if(hold&&sql.includes('INSERT INTO bsmoss_analysis.report_history_check')){hold=false;entered();await gate;}return r;});
    const work=check(f.id,worker,held);await ready;let updated=false;const pause=register(f.id,{...f.config,status:'paused'},2).then(()=>{updated=true;});
    try {let blocked=false;const deadline=Date.now()+2000;while(Date.now()<deadline){if((await adapterPool.query('SELECT pg_blocking_pids($1) pids',[db.processID])).rows[0].pids.length){blocked=true;break;}await new Promise(r=>setTimeout(r,10));}assert.equal(blocked,true);assert.equal(updated,false);}finally{release();}
    assert.equal((await work).status,'checked');await pause;await assert.rejects(check(f.id),/report_schedule_paused/);
    const g=await fixture({disconnected:true});let changed=false;
    const old=intercept(async(c,sql,args)=>{if(!changed&&sql.includes('lock_report_schedule')){changed=true;await c.query('SELECT 1 FROM bsmoss_analysis.report_series LIMIT 1');await register(g.id,{...g.config,status:'paused'},2);}return c.query(sql,args);});
    const before=await count();await assert.rejects(check(g.id,worker,old),e=>e.code==='40001');assert.deepEqual(await count(),before);
    const h=await fixture(),corrupt=intercept(async(c,sql,args)=>{const r=await c.query(sql,args);if(sql.includes('SELECT s.*,r.*')&&r.rows.length)r.rows[0].manifest_sha256='0'.repeat(64);return r;});
    const initial=await count();await assert.rejects(check(h.id,worker,corrupt),/invalid_report_record/);assert.deepEqual(await count(),initial);
  });
  await t.test('a report committed for an earlier period after a later receipt remains discoverable without a global watermark',async()=>{
    const f=await fixture({disconnected:true});await register(f.id,{...f.config,notBefore:'2026-01-01T00:00:00+08:00'},2);
    assert.equal((await check(f.id)).receipt.manifest.reportId,f.record.reportId);assert.equal((await check(f.id)).status,'idle');
    const late=(await make().generate({templateCode:f.id,templateVersion:1,at:'2026-06-01T00:00:00+08:00',expectedRevision:null})).record;
    const r=await check(f.id);assert.equal(r.receipt.manifest.reportId,late.reportId);assert.equal(r.receipt.manifest.scheduleRevision,'2');assert.equal(r.receipt.manifest.outcome,'unchanged');
  });
  await t.test('historical fingerprint reuse pins the older result separately and never rolls the current report or publication head backward',async()=>{
    const f=await fixture({disconnected:true}),changed={...f.definition,title:'Reviewed title replacement'};
    await mutateTemplateFixture(db,'UPDATE bsmoss_views.template_version SET definition=$2 WHERE code=$1',[f.id,changed]);await register(f.id,{...f.config,templateSha256:fingerprintOf(changed)},2);
    const second=(await make().generate({templateCode:f.id,templateVersion:1,at:period.start,expectedRevision:'1'})).record;assert.equal(second.revision,'2');
    await mutateTemplateFixture(db,'UPDATE bsmoss_views.template_version SET definition=$2 WHERE code=$1',[f.id,f.definition]);await register(f.id,f.config,3);
    const before=await count(),r=await check(f.id);assert.equal(r.receipt.manifest.outcome,'duplicate');assert.equal(r.receipt.manifest.original.revision,'2');
    assert.equal(r.receipt.manifest.result.revision,'1');assert.equal(r.receipt.manifest.result.currentRevision,'2');assert.equal((await count()).reports,before.reports);
    assert.equal((await api.read({reportId:f.record.reportId})).currentRevision,'2');assert.equal((await count()).publications,before.publications);
    const c=await adapterPool.connect();try{assert.deepEqual((await readHistoryCheck(c,'w',f.id,'3',bucketFor(new Date(clock).toISOString(),'hour').start,f.record.reportId)).manifest,r.receipt.manifest);}finally{c.release();}
  });
  await t.test('unprocessed and longest-unchecked reports stay ahead of earlier periods across hourly rollover and worker restarts',async()=>{
    const f=await fixture({disconnected:true}),later=(await make().generate({templateCode:f.id,templateVersion:1,at:'2026-07-07T00:00:00+08:00',expectedRevision:null})).record;
    assert.equal((await check(f.id)).receipt.manifest.reportId,f.record.reportId);
    clock+=3600000;assert.equal((await check(f.id)).receipt.manifest.reportId,later.reportId);
    clock+=3600000;assert.equal((await check(f.id)).receipt.manifest.reportId,f.record.reportId);
    clock+=3600000;assert.equal((await check(f.id)).receipt.manifest.reportId,later.reportId);
  });
}
