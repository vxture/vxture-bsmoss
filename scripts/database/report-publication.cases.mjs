import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PgReportPublicationStore } from '../../portals/app/app/domains/reports/pg-publication.ts';
import { createAuthorizedReportPublication } from '../../portals/app/app/domains/access/report-publication.ts';
import { readRefreshSnapshot } from '../../portals/app/app/domains/aggregation/refresh-snapshot.ts';
import { aggregateIntervals, mappingSetFingerprint } from '../../portals/app/app/domains/aggregation/intervals.ts';

export async function reportPublicationCases(t,{db,adapterPool,access,scope,api,up,sms,period,target,write,publish,putTemplate,single,panel,command,intercept}) {
  const publisher={...access,async readLocalGrant(){return {...await access.readLocalGrant(),permissions:['reports.publish','reports.generate','metering.view']};}};
  const make=(ports=publisher,pool=adapterPool)=>createAuthorizedReportPublication(ports,{create:s=>new PgReportPublicationStore(pool,s)},'interactive'),pub=make();
  const counts=async()=>(await db.query('SELECT (SELECT count(*) FROM bsmoss_analysis.report_publication_event) events,(SELECT count(*) FROM bsmoss_analysis.report_publication_outbox) outbox')).rows[0];
  const issue=(record,expectedEventRevision=null,action='published',commandId=randomUUID())=>({reportId:record.reportId,reportRevision:record.revision,manifestSha256:record.manifestSha256,expectedEventRevision,commandId,action,reasonRef:'fixture://publication-review'});
  async function confirm() {
    const snapshot=await readRefreshSnapshot(adapterPool,scope,target()),plan={...snapshot.plan,sourceComplete:false,watermark:period.start};delete plan.completionEvidence;
    const base=aggregateIntervals(plan,snapshot.inputs),revision=(await db.query("SELECT coalesce(max(revision),0)+1 AS next FROM bsmoss_integration.source_completion_set WHERE workspace_id='w' AND source_id='report-src' AND metric_code=$1 AND grain='day' AND period_start=$2",[up.code,period.start])).rows[0].next;
    await db.query(`INSERT INTO bsmoss_integration.source_completion_set(workspace_id,id,source_id,station_id,service_id,network_object_id,device_id,metric_code,metric_version,grain,period_start,period_end,revision,status,input_fingerprint,mapping_manifest_sha256,watermark,evidence_ref,evidence_sha256,recorded_by)
      VALUES ('w',$1,'report-src','st','report-svc','report-cell',NULL,$2,1,'day',$3,$4,$5,'confirmed',$6,$7,$4,'fixture://publication-complete',$8,'fixture-reviewer')`,
      [randomUUID(),up.code,period.start,period.end,revision,base.inputFingerprint,mappingSetFingerprint(base.mappingWindows),'a'.repeat(64)]);
    await publish();
  }
  let ready,firstCommand,lastEvent;
  await t.test('report publication requires complete current evidence and explicit permission without granting owners automatic publishing rights',async()=>{
    await putTemplate('publication-incomplete',{...single(),panels:[panel('sms',sms)],bindings:[{panelId:'sms',kind:'not_connected'}]});
    const incomplete=(await api.generate(command('publication-incomplete'))).record,before=await counts();
    await assert.rejects(pub.execute(issue(incomplete)),/report_incomplete/);
    const owner={...publisher,async readVerifiedIdentity(){return {...await publisher.readVerifiedIdentity(),governanceRoles:['workspace:owner']};},async readLocalGrant(){return {...await publisher.readLocalGrant(),permissions:['reports.generate','metering.view']};}};
    await assert.rejects(make(owner).execute(issue(incomplete)),/permission_denied/);
    const stale=(await db.query("SELECT id FROM bsmoss_analysis.report_series WHERE template_code='report-complete'")).rows[0].id,old=await api.read({reportId:stale});
    assert.equal(old.manifest.dataCompleteness,'complete');assert.equal(old.freshness,'stale');await assert.rejects(pub.execute(issue(old)),/report_stale/);
    await assert.rejects(pub.execute({...issue(incomplete),manifestSha256:'e'.repeat(64)}),/report_unavailable/);assert.deepEqual(await counts(),before);
  });
  await t.test('publishing pins the exact immutable report and writes its publication event and typed outbox atomically',async()=>{
    await confirm();await putTemplate('publication-ready',single());ready=(await api.generate(command('publication-ready'))).record;
    assert.equal(ready.manifest.dataCompleteness,'complete');assert.equal((await api.read({reportId:ready.reportId})).freshness,'current');
    firstCommand=issue(ready);const result=await pub.execute(firstCommand);lastEvent=result.event;
    assert.equal(result.status,'inserted');assert.equal(lastEvent.eventRevision,'1');assert.equal(lastEvent.previousEventRevision,null);assert.equal(lastEvent.reportRevision,ready.revision);assert.equal(lastEvent.manifestSha256,ready.manifestSha256);
    const state=await pub.read({reportId:ready.reportId});assert.equal(state.isActive,true);assert.equal(state.report.freshness,'current');assert.deepEqual(state.report.manifest,ready.manifest);
    const outbox=(await db.query('SELECT * FROM bsmoss_analysis.report_publication_outbox WHERE report_id=$1',[ready.reportId])).rows[0];assert.equal(outbox.action,'published');assert.equal(outbox.event_revision,'1');
    assert.equal((await db.query('SELECT manifest FROM bsmoss_analysis.report_revision WHERE report_id=$1',[ready.reportId])).rows[0].manifest.status,'generated');
  });
  await t.test('publication command replay is scoped and actor-bound; conflicting payloads and new redundant commands fail without extra events',async()=>{
    const before=await counts(),again=await pub.execute(firstCommand);assert.equal(again.status,'duplicate');assert.deepEqual(again.event,lastEvent);
    for(const patch of [{reasonRef:'fixture://different'},{expectedEventRevision:'1'},{action:'withdrawn'}])await assert.rejects(pub.execute({...firstCommand,...patch}),/conflicting_publication_replay/);
    const other={...publisher,async readVerifiedIdentity(){return {...await publisher.readVerifiedIdentity(),sub:'other-publisher'};},async readLocalGrant(){return {...await publisher.readLocalGrant(),sub:'other-publisher'};}};
    await assert.rejects(make(other).execute(firstCommand),/conflicting_publication_replay/);
    await assert.rejects(pub.execute(issue(ready,'1')),/report_already_published/);await assert.rejects(pub.execute(issue(ready)),/publication_revision_conflict/);assert.deepEqual(await counts(),before);
  });
  await t.test('withdrawal and republishing append transitions while historical reads and old command replay never reactivate a superseded release',async()=>{
    await assert.rejects(pub.execute({...issue(ready,'1','withdrawn'),reportRevision:'999'}),/report_unavailable/);
    lastEvent=(await pub.execute(issue(ready,'1','withdrawn'))).event;assert.equal(lastEvent.eventRevision,'2');assert.equal((await pub.read({reportId:ready.reportId})).isActive,false);
    const before=await counts(),oldReplay=await pub.execute(firstCommand);assert.equal(oldReplay.status,'duplicate');assert.equal(oldReplay.currentEventRevision,'2');assert.equal(oldReplay.isActive,false);assert.equal((await pub.read({reportId:ready.reportId})).isActive,false);assert.deepEqual(await counts(),before);
    await assert.rejects(pub.execute(issue(ready,'2','withdrawn')),/publication_withdrawal_conflict/);
    lastEvent=(await pub.execute(issue(ready,'2'))).event;assert.equal(lastEvent.eventRevision,'3');assert.equal((await pub.read({reportId:ready.reportId})).isActive,true);
    for(const eventRevision of ['1','2']){const old=await pub.read({reportId:ready.reportId,eventRevision});assert.equal(old.isActive,false);assert.equal(old.currentEventRevision,'3');assert.equal(old.event.eventRevision,eventRevision);}
    assert.equal(await pub.read({reportId:ready.reportId,eventRevision:'999'}),null);
  });
  await t.test('input correction makes the active publication visibly stale and permits withdrawal without requiring obsolete evidence to become current',async()=>{
    await write(up,{kind:'integer_delta',value:'991'});let state=await pub.read({reportId:ready.reportId});assert.equal(state.isActive,true);assert.equal(state.report.freshness,'stale');assert.equal(state.report.manifest.dataCompleteness,'complete');
    await assert.rejects(pub.execute(issue(ready,'3')),/report_stale/);assert.equal((await pub.execute(firstCommand)).status,'duplicate');
    lastEvent=(await pub.execute(issue(ready,'3','withdrawn'))).event;assert.equal(lastEvent.eventRevision,'4');
    await publish();const incomplete=(await api.generate(command('publication-ready',ready.revision))).record;await assert.rejects(pub.execute(issue(incomplete,'4')),/report_incomplete/);
    await confirm();ready=(await api.generate(command('publication-ready',incomplete.revision))).record;assert.equal(ready.manifest.dataCompleteness,'complete');
    lastEvent=(await pub.execute(issue(ready,'4'))).event;assert.equal(lastEvent.eventRevision,'5');const historical=await pub.read({reportId:ready.reportId,eventRevision:'1'});assert.equal(historical.report.currentRevision,ready.revision);assert.equal(historical.report.revision,'1');assert.ok(historical.report.reasons.includes('older_generated_revision'));
  });
  await t.test('publication outbox failure or final access revocation rolls back the entire transition, including replays',async()=>{
    const before=await counts(),cmd=issue(ready,lastEvent.eventRevision,'withdrawn');
    const broken=intercept((c,sql,args)=>sql.includes('INSERT INTO bsmoss_analysis.report_publication_outbox')?c.query('SELECT * FROM publication_fixture_absent'):c.query(sql,args));
    await assert.rejects(make(publisher,broken).execute(cmd),e=>e.code==='42P01');assert.deepEqual(await counts(),before);
    for(const replay of [false,true])for(const mode of ['permission','scope','identity','coverage','expiry']){
      let reads=0;const changed={...publisher,async readVerifiedIdentity(){const i=await publisher.readVerifiedIdentity();return mode==='identity'&&reads>0?{...i,sub:'changed-publisher'}:i;},
        async readCoverage(w){const c=await publisher.readCoverage(w);return mode==='coverage'&&reads>0?{...c,tier:null,bundled:false}:c;},
        async readLocalGrant(){const g=await publisher.readLocalGrant();return ++reads===1?g:mode==='permission'?{...g,permissions:[]}:mode==='scope'?{...g,scope:{...scope,serviceIds:[]}}:mode==='expiry'?{...g,expiresAt:0}:g;}};
      await assert.rejects(make(changed).execute(replay?firstCommand:cmd),/denied|expired/);assert.deepEqual(await counts(),before);
    }
    assert.equal((await pub.read({reportId:ready.reportId})).currentEventRevision,lastEvent.eventRevision);
  });
  await t.test('concurrent publication transitions retain exactly one contiguous event and one outbox without silently retrying stale CAS',async()=>{
    const before=await counts(),commands=[issue(ready,lastEvent.eventRevision,'withdrawn'),issue(ready,lastEvent.eventRevision,'withdrawn')];
    const settled=await Promise.allSettled(commands.map(c=>pub.execute(c)));assert.equal(settled.filter(r=>r.status==='fulfilled').length,1);
    const failed=settled.find(r=>r.status==='rejected').reason;assert.ok(['40001','23505'].includes(failed.code)||/publication_revision_conflict/.test(failed.message));
    const after=await counts();assert.equal(BigInt(after.events),BigInt(before.events)+1n);assert.equal(BigInt(after.outbox),BigInt(before.outbox)+1n);
    lastEvent=(await pub.read({reportId:ready.reportId})).event;lastEvent=(await pub.execute(issue(ready,lastEvent.eventRevision))).event;
  });
  await t.test('an older repeatable-read publisher cannot use a newer generated head to publish an obsolete report',async()=>{
    const before=await counts(),previous=ready;let moved=false;
    const raced=intercept(async(c,sql,args)=>{if(!moved&&sql.includes('SELECT current_revision FROM bsmoss_analysis.report_series')){moved=true;await c.query('SELECT count(*) FROM bsmoss_analysis.report_series');await write(up,{kind:'integer_delta',value:'992'});await publish();ready=(await api.generate(command('publication-ready',ready.revision))).record;}return c.query(sql,args);});
    await assert.rejects(make(publisher,raced).execute(issue(previous,lastEvent.eventRevision)),e=>e.code==='40001');assert.equal(moved,true);assert.deepEqual(await counts(),before);
    await assert.rejects(pub.execute(issue(previous,lastEvent.eventRevision)),/report_stale/);
    await pub.execute(issue(previous,lastEvent.eventRevision,'withdrawn'));await confirm();ready=(await api.generate(command('publication-ready',ready.revision))).record;
    lastEvent=(await pub.execute(issue(ready,(await pub.read({reportId:ready.reportId})).currentEventRevision))).event;
  });
  await t.test('publication freshness and its original evidence use one snapshot and later corrections are independently visible',async()=>{
    lastEvent=(await pub.execute(issue(ready,lastEvent.eventRevision,'withdrawn'))).event;let corrected=false,begins=0;
    const raced=intercept(async(c,sql,args)=>{if(sql.startsWith('BEGIN'))begins++;const r=await c.query(sql,args);if(!corrected&&sql.includes('SELECT definition,template_kind')){corrected=true;await write(up,{kind:'integer_delta',value:'993'});await publish();}return r;});
    lastEvent=(await make(publisher,raced).execute(issue(ready,lastEvent.eventRevision))).event;assert.equal(corrected,true);assert.equal(begins,1);
    const state=await pub.read({reportId:ready.reportId});assert.equal(state.isActive,true);assert.equal(state.report.freshness,'stale');assert.equal(state.report.manifestSha256,ready.manifestSha256);
  });
  await t.test('publication queries and commands enforce current tenant and all historical scope, including final read revalidation',async()=>{
    const before=await counts();for(const patch of [{sourceIds:[]},{stationIds:[]},{serviceIds:[]},{metricKeys:[]}]){
      const denied={...publisher,async readLocalGrant(){return {...await publisher.readLocalGrant(),scope:{...scope,...patch}};}};
      await assert.rejects(make(denied).read({reportId:ready.reportId}),/report_scope_denied/);await assert.rejects(make(denied).execute(firstCommand),/report_scope_denied/);
    }
    const foreign={...publisher,async readVerifiedIdentity(){return {...await publisher.readVerifiedIdentity(),activeWorkspace:'other'};},async readCoverage(){return {...await publisher.readCoverage('w'),workspaceId:'other'};},async readLocalGrant(){return {...await publisher.readLocalGrant(),workspaceId:'other',scope:{...scope,workspaceId:'other'}};}};
    assert.equal(await make(foreign).read({reportId:ready.reportId}),null);await assert.rejects(make(foreign).execute(firstCommand),/report_unavailable/);
    let reads=0;const revoke={...publisher,async readLocalGrant(){const g=await publisher.readLocalGrant();return ++reads===1?g:{...g,scope:{...scope,stationIds:[]}};}};await assert.rejects(make(revoke).read({reportId:ready.reportId}),/report_scope_denied/);
    const broken=intercept((c,sql,args)=>sql.includes('SELECT definition,template_kind')?c.query('SELECT * FROM publication_fixture_absent'):c.query(sql,args));await assert.rejects(make(publisher,broken).read({reportId:ready.reportId}),e=>e.code==='42P01');
    assert.equal(await pub.read({reportId:'absent'}),null);assert.deepEqual(await counts(),before);
  });
  await t.test('SQL publication chains enforce exact tenant report digest transitions, immutable runtime history and typed outbox references',async()=>{
    const row=(await db.query('SELECT * FROM bsmoss_analysis.report_publication_event WHERE report_id=$1 ORDER BY event_revision DESC LIMIT 1',[ready.reportId])).rows[0];
    const insert=patch=>{const candidate={...row,event_revision:String(BigInt(row.event_revision)+1n),previous_event_revision:row.event_revision,command_id:randomUUID(),action:'withdrawn',...patch},keys=Object.keys(candidate);return db.query('INSERT INTO bsmoss_analysis.report_publication_event('+keys.join(',')+') VALUES ('+keys.map((_,i)=>'$'+(i+1)).join(',')+')',Object.values(candidate));};
    await assert.rejects(insert({event_revision:'999'}),/publication_revision_conflict/);await assert.rejects(insert({workspace_id:'other',event_revision:'1',previous_event_revision:null,action:'published'}),e=>e.code==='23503');
    await assert.rejects(insert({manifest_sha256:'e'.repeat(64)}),/publication_withdrawal_conflict/);await assert.rejects(insert({action:'published'}),/report_already_published/);
    for(const table of ['report_publication_event','report_publication_outbox'])for(const action of ['UPDATE '+table+' SET report_id=report_id','DELETE FROM '+table,'TRUNCATE '+table])await assert.rejects(adapterPool.query(action.replace(table,'bsmoss_analysis.'+table)),e=>e.code==='42501');
    await assert.rejects(db.query('TRUNCATE bsmoss_analysis.report_publication_event CASCADE'),/publication_append_only/);await assert.rejects(db.query('UPDATE bsmoss_analysis.report_publication_event SET reason_ref=reason_ref WHERE report_id=$1',[ready.reportId]),/publication_append_only/);
    await db.query('BEGIN');try {
      await db.query('DELETE FROM bsmoss_analysis.report_publication_outbox WHERE report_id=$1 AND event_revision=$2',[ready.reportId,row.event_revision]);
      await assert.rejects(db.query("INSERT INTO bsmoss_analysis.report_publication_outbox VALUES ('w',$1,$2,$3,'withdrawn',clock_timestamp())",[randomUUID(),ready.reportId,row.event_revision]),e=>e.code==='23503');
    } finally {await db.query('ROLLBACK');}
    await assert.rejects(adapterPool.query('SELECT bsmoss_analysis.capture_report_publication()'),e=>e.code==='42501');
    assert.equal((await db.query("SELECT 1 FROM local_authz.permission WHERE perm_code='reports.publish'")).rowCount,1);assert.equal((await db.query("SELECT 1 FROM local_authz.role_permission rp JOIN local_authz.permission p ON p.id=rp.permission_id WHERE p.perm_code='reports.publish'")).rowCount,0);
  });
}
