import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fingerprintOf, aggregateIntervals, mappingSetFingerprint } from '../../portals/app/app/domains/aggregation/intervals.ts';
import { createReportWorker } from '../../portals/app/app/domains/workers/report-worker.ts';
import { PgReportExportStore } from '../../portals/app/app/domains/reports/pg-exports.ts';
import { createAuthorizedReportExports } from '../../portals/app/app/domains/access/report-exports.ts';
import { FIRST_METRICS } from '../../portals/app/app/domains/catalog/first-metrics.ts';
import { PgMeasurementStore } from '../../portals/app/app/domains/measurements/pg-store.ts';
import { readRefreshSnapshot } from '../../portals/app/app/domains/aggregation/refresh-snapshot.ts';
import { PgAggregateStore } from '../../portals/app/app/domains/aggregation/pg-store.ts';
import { PgReportStore } from '../../portals/app/app/domains/reports/pg-store.ts';
import { createAuthorizedReports } from '../../portals/app/app/domains/access/reports.ts';
import { PgReportPublicationStore } from '../../portals/app/app/domains/reports/pg-publication.ts';
import { createAuthorizedReportPublication } from '../../portals/app/app/domains/access/report-publication.ts';

export async function reportWorkerCases(t,{db,adapterPool,access,scope,api,rate,state,period,putTemplate,panel,target,intercept,pub,issue}) {
  const subject=(await access.readVerifiedIdentity()).sub;
  const full={...access,async readLocalGrant(){return {...await access.readLocalGrant(),permissions:['reports.export.execute','reports.export','reports.generate','metering.view']};}};
  const make=(ports=full,pool=adapterPool)=>createAuthorizedReportExports(ports,{create:s=>new PgReportExportStore(pool,s)},'data');
  const portsFor=s=>({...full,async readLocalGrant(){return {...await full.readLocalGrant(),scope:s};}});
  const records={};
  for(const [key,m] of [['state',state],['rate',rate]]){
    const code='worker-'+key,definition={schema:'periodic-report-template-v1',title:code,grain:'day',panels:[panel(key,m)],bindings:[{panelId:key,kind:'aggregate',sourceId:'report-src',mappingId:target(m).mappingId}]};
    await putTemplate(code,definition);const record=(await api.generate({templateCode:code,templateVersion:1,at:period.start,expectedRevision:null})).record;
    const event=(await pub.execute(issue(record))).event;records[key]={record,event,definition};
  }
  const enqueue=async(key='rate')=>{const {record,event}=records[key];return (await make().request({reportId:record.reportId,publicationRevision:event.eventRevision,commandId:randomUUID()})).job;};
  const row=async id=>(await db.query('SELECT * FROM bsmoss_analysis.report_export_job WHERE id=$1',[id])).rows[0];
  const narrow={...scope,sourceIds:['report-src'],stationIds:['st'],serviceIds:['report-svc'],deviceIds:[],metricKeys:[rate.code+'@1'],allowSiteParameters:false};
  const counts=async()=>(await db.query(`SELECT (SELECT count(*) FROM bsmoss_analysis.report_export_artifact) artifacts,
    (SELECT count(*) FROM bsmoss_analysis.report_export_attempt) attempts,(SELECT count(*) FROM bsmoss_analysis.report_generation_attempt) generations,
    (SELECT count(*) FROM bsmoss_analysis.report_revision) reports,(SELECT count(*) FROM bsmoss_analysis.report_publication_event) publications`)).rows[0];
  let selected=[];
  await t.test('export worker discovery filters the complete historical scope before limiting and returns only due pending identifiers',async()=>{
    for(let n=0;n<3;n++){const job=await enqueue('state');await db.query("UPDATE bsmoss_analysis.report_export_job SET available_at='2000-01-01Z' WHERE id=$1",[job.jobId]);}
    for(let n=0;n<4;n++){const job=await enqueue('rate');selected.push(job.jobId);await db.query("UPDATE bsmoss_analysis.report_export_job SET available_at='2001-01-01Z'::timestamptz+make_interval(secs=>$2) WHERE id=$1",[job.jobId,n]);}
    assert.deepEqual(await make(portsFor(narrow)).pending({limit:2}),{jobIds:selected.slice(0,2)});
    const reader=make(portsFor(narrow));assert.equal((await reader.run({jobId:selected[0]})).status,'succeeded');assert.deepEqual(await reader.pending({limit:2}),{jobIds:selected.slice(1,3)});
    await db.query("UPDATE bsmoss_analysis.report_export_job SET available_at=clock_timestamp()+interval '1 hour' WHERE id=$1",[selected[1]]);assert.deepEqual(await reader.pending({limit:2}),{jobIds:selected.slice(2,4)});
    await assert.rejects(reader.pending({limit:26}),/invalid_export_pending_limit/);
    const foreign={...full,async readVerifiedIdentity(){return {...await full.readVerifiedIdentity(),activeWorkspace:'other'};},async readCoverage(){return {workspaceId:'other',product:'bsmoss',tier:'fixture',bundled:false,expiresAt:Date.now()+60000};},async readLocalGrant(){return {...await full.readLocalGrant(),workspaceId:'other',scope:{...scope,workspaceId:'other'}};}};
    assert.deepEqual(await make(foreign).pending({limit:25}),{jobIds:[]});
  });
  await t.test('export discovery checks every scope dimension and discards otherwise valid identifiers after final authorization loss',async()=>{
    const rows=(await db.query(`SELECT j.id,r.manifest FROM bsmoss_analysis.report_export_job j JOIN bsmoss_analysis.report_revision r
      ON (r.workspace_id,r.report_id,r.revision)=(j.workspace_id,j.report_id,j.report_revision) WHERE j.workspace_id='w' AND j.status='pending' AND j.available_at<=clock_timestamp() ORDER BY j.available_at,j.id COLLATE "C"`)).rows;
    for(const key of ['sourceIds','stationIds','serviceIds','deviceIds','metricKeys']){
      const s={...scope,[key]:[]},expected=rows.filter(r=>['sourceIds','stationIds','serviceIds','deviceIds','metricKeys'].every(k=>r.manifest.requiredScope[k].every(id=>s[k].includes(id)))&&(!r.manifest.requiredScope.allowSiteParameters||s.allowSiteParameters)).slice(0,25).map(r=>r.id);
      assert.deepEqual((await make(portsFor(s)).pending({limit:25})).jobIds,expected,key);
    }
    for(const mode of ['permission','scope','identity','coverage','expiry']){
      let reads=0;const revoked={...full,
        async readVerifiedIdentity(){const i=await full.readVerifiedIdentity();return mode==='identity'&&reads>0?{...i,sub:'other-worker'}:i;},
        async readCoverage(w){const c=await full.readCoverage(w);return mode==='coverage'&&reads>0?{...c,tier:null,bundled:false}:c;},
        async readLocalGrant(){const g=await full.readLocalGrant();return ++reads===1?g:mode==='permission'?{...g,permissions:[]}:mode==='scope'?{...g,scope:{...scope,deviceIds:[]}}:mode==='expiry'?{...g,expiresAt:0}:g;}};
      const before=await counts();await assert.rejects(make(revoked).pending({limit:1}),/denied|expired/);assert.deepEqual(await counts(),before);
    }
    const requestOnly={...full,async readLocalGrant(){return {...await full.readLocalGrant(),permissions:['reports.export']};}};await assert.rejects(make(requestOnly).pending({limit:1}),/permission_denied/);
    const broken=intercept((c,sql,args)=>sql.includes('SELECT j.* FROM bsmoss_analysis.report_export_job j')?c.query('SELECT * FROM fixture_worker_discovery_absent'):c.query(sql,args));await assert.rejects(make(full,broken).pending({limit:1}),e=>e.code==='42P01');
    const corrupt=intercept(async(c,sql,args)=>{const r=await c.query(sql,args);if(sql.includes('SELECT s.*,r.* FROM bsmoss_analysis.report_series')&&r.rows.length)r.rows[0].manifest_sha256='0'.repeat(64);return r;});await assert.rejects(make(full,corrupt).pending({limit:1}),/invalid_report_record|invalid_export_job/);
  });
  await t.test('revoked publication jobs remain discoverable for a durable terminal outcome and worker restart preserves pending work',async()=>{
    const job=await enqueue('state'),r=records.state;
    await pub.execute(issue(r.record,r.event.eventRevision,'withdrawn'));
    assert.ok((await make().pending({limit:25})).jobIds.includes(job.jobId));assert.equal((await make().run({jobId:job.jobId})).status,'dead');
    assert.equal((await db.query('SELECT failure_code FROM bsmoss_analysis.report_export_attempt WHERE job_id=$1',[job.jobId])).rows[0].failure_code,'report_not_active');
    r.event=(await pub.execute(issue(r.record,(BigInt(r.event.eventRevision)+1n).toString()))).event;
    const prior=await counts(),pendingJob=selected[2];
    const stopped=intercept(async(c,sql,args)=>{const r=await c.query(sql,args);if(sql.includes('INSERT INTO bsmoss_analysis.report_export_attempt'))throw Error('fixture_host_interrupted');return r;});
    const config={workspaceId:'w',subject,scheduleIds:[],executeExports:true,maxStepsPerTick:1,pollMilliseconds:1000};
    const interrupted=createReportWorker(stopped,portsFor(narrow),config);const event=(await interrupted.tick()).events[0];assert.equal(event.status,'failed');assert.equal(event.failure,'execution_failed');assert.deepEqual(await counts(),prior);assert.equal((await row(pendingJob)).attempt,'0');
    const restarted=createReportWorker(adapterPool,portsFor(narrow),config);assert.equal((await restarted.tick()).events[0].status,'succeeded');assert.equal((await row(pendingJob)).status,'succeeded');
  });
  await t.test('a real report worker cycle fairly isolates a paused schedule while generating a closed report and delivering an authorized export',async()=>{
    const r=records.rate,config={subject,status:'active',scope:narrow,templateCode:r.record.manifest.template.code,templateVersion:1,templateSha256:fingerprintOf(r.definition),grain:'day',notBefore:period.start,delayMinutes:480,lookbackHours:72};
    for(const [id,status] of [['worker-paused','paused'],['worker-active','active']])await db.query(`INSERT INTO bsmoss_integration.report_schedule_revision(workspace_id,id,revision,config,review_ref) VALUES ('w',$1,1,$2,'fixture://report-worker-reviewed')`,[id,{...config,status}]);
    const job=await enqueue('rate');await db.query("UPDATE bsmoss_analysis.report_export_job SET available_at='1990-01-01Z' WHERE id=$1",[job.jobId]);
    const ports={...portsFor(narrow),now:()=>Date.parse('2026-07-07T08:00:00+08:00')},before=await counts();
    const worker=createReportWorker(adapterPool,ports,{workspaceId:'w',subject,scheduleIds:['worker-paused','worker-active'],executeExports:true,maxStepsPerTick:2,pollMilliseconds:1000});
    const first=await worker.tick();assert.deepEqual(first.events.map(e=>[e.lane,e.status]),[[0,'failed'],[1,'succeeded']]);assert.equal(first.events[0].failure,'configuration_unavailable');
    const second=await worker.tick();assert.equal(second.events[0].lane,2);assert.equal(second.events[0].status,'succeeded');assert.equal((await row(job.jobId)).status,'succeeded');assert.equal((await counts()).publications,before.publications);
    assert.equal((await db.query("SELECT status FROM bsmoss_analysis.report_generation_job WHERE schedule_id='worker-active'")).rows[0].status,'succeeded');
    const pendingJob=await enqueue('rate'),changed={...ports,async readVerifiedIdentity(){return {...await ports.readVerifiedIdentity(),sub:'different-worker'};},async readLocalGrant(){return {...await ports.readLocalGrant(),sub:'different-worker'};}};
    const denied=createReportWorker(adapterPool,changed,{workspaceId:'w',subject,scheduleIds:[],executeExports:true,maxStepsPerTick:1,pollMilliseconds:1000}),prior=await counts();assert.equal((await denied.tick()).events[0].failure,'authorization_denied');assert.deepEqual(await counts(),prior);assert.equal((await row(pendingJob.jobId)).attempt,'0');
    const foreign=createReportWorker(adapterPool,ports,{workspaceId:'other',subject,scheduleIds:[],executeExports:true,maxStepsPerTick:1,pollMilliseconds:1000});assert.equal((await foreign.tick()).events[0].failure,'authorization_denied');
  });
  await t.test('shutdown after a committed calendar scan leaves durable pending jobs without starting generation and a fresh host resumes them',async()=>{
    const r=records.rate,id='worker-shutdown',config={subject,status:'active',scope:narrow,templateCode:r.record.manifest.template.code,templateVersion:1,templateSha256:fingerprintOf(r.definition),grain:'day',notBefore:period.start,delayMinutes:480,lookbackHours:72};
    await db.query(`INSERT INTO bsmoss_integration.report_schedule_revision(workspace_id,id,revision,config,review_ref) VALUES ('w',$1,1,$2,'fixture://shutdown-reviewed')`,[id,config]);
    const controller=new AbortController(),ports={...portsFor(narrow),now:()=>Date.parse('2026-07-07T08:00:00+08:00')},before=await counts();let aborted=false;
    const stopped=intercept(async(c,sql,args)=>{const result=await c.query(sql,args);if(sql.includes('INSERT INTO bsmoss_analysis.report_schedule_scan')){aborted=true;controller.abort();}return result;});
    const options={workspaceId:'w',subject,scheduleIds:[id],executeExports:false,maxStepsPerTick:1,pollMilliseconds:1000},worker=createReportWorker(stopped,ports,options);
    const result=await worker.tick(controller.signal);assert.equal(aborted,true);assert.equal(result.status,'stopped');assert.equal((await counts()).generations,before.generations);
    assert.equal((await db.query('SELECT status FROM bsmoss_analysis.report_generation_job WHERE schedule_id=$1',[id])).rows[0].status,'pending');
    assert.equal((await createReportWorker(adapterPool,ports,options).tick()).events[0].status,'succeeded');
  });
  await t.test('physical energy export discovery requires independent site-parameter authority and a live host loop drains one exact durable task',async()=>{
    const metric={code:'runtime.energy.site_wh',version:1},def=FIRST_METRICS.get(metric),siteScope={...scope,serviceIds:[],deviceIds:[],metricKeys:[metric.code+'@1'],allowSiteParameters:true};
    await db.query(`INSERT INTO bsmoss_catalog.metric_version VALUES ($1,1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,[metric.code,def.category,def.semantic,def.unit,def]);
    await db.query(`INSERT INTO bsmoss_integration.source_mapping(workspace_id,id,source_id,external_type,external_id,station_id,version,valid_from,valid_to) VALUES ('w','worker-site-map','report-src','station','worker-site-map','st',1,'2026-01-01Z','2027-01-01Z');
      INSERT INTO bsmoss_integration.source_capability(workspace_id,id,source_id,metric_code,metric_version,native_grain,status,validation_ref,rules,valid_from,valid_to)
      VALUES ('w','worker-site-cap','report-src','runtime.energy.site_wh',1,'day','active','fixture://reviewed-energy','{"intervalAggregation":{"version":1,"inputMode":"direct","authorityRef":"fixture://worker-energy"}}','2026-01-01Z','2027-01-01Z')`);
    const writer=new PgMeasurementStore(adapterPool,siteScope,FIRST_METRICS),q={sourceId:'report-src',mappingId:'worker-site-map',metric,grain:'day',at:period.start};
    await writer.append({workspaceId:'w',sourceId:'report-src',eventId:'worker-site-reading',revision:'1',previousRevision:null,payloadSha256:'a'.repeat(64),payloadUri:'fixture://worker-site-reading',occurredAt:period.end,
      metric,componentKey:'value',stationId:'st',mappingId:q.mappingId,transformVersion:'fixture-v1',periodStart:period.start,periodEnd:period.end,value:{kind:'integer_delta',value:'54321'},quality:{status:'verified',ruleVersion:'fixture-v1',reason:'Reviewed',decidedBy:'fixture-reviewer'}});
    let snapshot=await readRefreshSnapshot(adapterPool,siteScope,q),plan={...snapshot.plan,sourceComplete:false,watermark:period.start};delete plan.completionEvidence;const base=aggregateIntervals(plan,snapshot.inputs);
    await db.query(`INSERT INTO bsmoss_integration.source_completion_set(workspace_id,id,source_id,station_id,metric_code,metric_version,grain,period_start,period_end,revision,status,input_fingerprint,mapping_manifest_sha256,watermark,evidence_ref,evidence_sha256,recorded_by)
      VALUES ('w','worker-site-complete','report-src','st',$1,1,'day',$2,$3,1,'confirmed',$4,$5,$3,'fixture://worker-complete',$6,'fixture-reviewer')`,[metric.code,period.start,period.end,base.inputFingerprint,mappingSetFingerprint(base.mappingWindows),'b'.repeat(64)]);
    snapshot=await readRefreshSnapshot(adapterPool,siteScope,q);await new PgAggregateStore(adapterPool,{workspaceId:'w',series:[{sourceId:'report-src',subjectKey:snapshot.plan.subjectKey,metricKey:metric.code+'@1'}]}).publish(snapshot.plan,snapshot.inputs,null,'fixture-worker');
    await putTemplate('worker-site',{schema:'periodic-report-template-v1',title:'Physical energy',grain:'day',panels:[{...panel('energy',metric),displayUnit:'Wh'}],bindings:[{panelId:'energy',kind:'aggregate',sourceId:'report-src',mappingId:q.mappingId}]});
    const sitePorts={...portsFor(siteScope),async readLocalGrant(){return {...await full.readLocalGrant(),scope:siteScope,permissions:['reports.generate','reports.publish','reports.export','reports.export.execute','metering.view']};}},reports=createAuthorizedReports(sitePorts,{create:s=>new PgReportStore(adapterPool,s)},'data');
    const report=(await reports.generate({templateCode:'worker-site',templateVersion:1,at:period.start,expectedRevision:null})).record;assert.equal(report.manifest.dataCompleteness,'complete');assert.equal(report.manifest.requiredScope.allowSiteParameters,true);
    const publisher=createAuthorizedReportPublication(sitePorts,{create:s=>new PgReportPublicationStore(adapterPool,s)},'data'),event=(await publisher.execute(issue(report))).event;
    const job=(await make(sitePorts).request({reportId:report.reportId,publicationRevision:event.eventRevision,commandId:randomUUID()})).job;
    assert.deepEqual(await make(portsFor({...siteScope,allowSiteParameters:false})).pending({limit:1}),{jobIds:[]});assert.deepEqual(await make(sitePorts).pending({limit:1}),{jobIds:[job.jobId]});
    const second=(await make(sitePorts).request({reportId:report.reportId,publicationRevision:event.eventRevision,commandId:randomUUID()})).job;
    await db.query("UPDATE bsmoss_analysis.report_export_job SET available_at=clock_timestamp()-interval '2 seconds' WHERE id=$1",[job.jobId]);
    let entered,release,hold=true;const ready=new Promise(r=>entered=r),gate=new Promise(r=>release=r);
    const paused=intercept(async(c,sql,args)=>{const result=await c.query(sql,args);if(hold&&sql.includes('INSERT INTO bsmoss_analysis.report_export_artifact')){hold=false;entered();await gate;}return result;});
    const worker=createReportWorker(paused,sitePorts,{workspaceId:'w',subject,scheduleIds:[],executeExports:true,maxStepsPerTick:1,pollMilliseconds:1000}),controller=new AbortController();let cycles=0;
    const running=worker.run(controller.signal,cycle=>{cycles++;assert.equal(cycle.events[0].status,'succeeded');});await ready;controller.abort();assert.equal(worker.snapshot().running,true);assert.equal((await row(job.jobId)).status,'pending');release();await running;
    assert.equal(cycles,1);assert.equal(worker.snapshot().running,false);assert.equal((await row(job.jobId)).status,'succeeded');assert.equal((await row(second.jobId)).status,'pending');
    const file=await make(sitePorts).download({jobId:job.jobId});assert.ok(file.html.includes('54321'));
  });
}
