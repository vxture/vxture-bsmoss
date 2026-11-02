import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { PgMeasurementStore } from '../../portals/app/app/domains/measurements/pg-store.ts';
import { FIRST_METRICS } from '../../portals/app/app/domains/catalog/first-metrics.ts';
import { readRefreshSnapshot } from '../../portals/app/app/domains/aggregation/refresh-snapshot.ts';
import { PgAggregateStore } from '../../portals/app/app/domains/aggregation/pg-store.ts';
import { PgStateAggregateStore } from '../../portals/app/app/domains/aggregation/pg-state-store.ts';
import { PgGaugeAggregateStore } from '../../portals/app/app/domains/aggregation/pg-gauge-store.ts';
import { aggregateIntervals, fingerprintOf, mappingSetFingerprint } from '../../portals/app/app/domains/aggregation/intervals.ts';
import { aggregateStatePeriod } from '../../portals/app/app/domains/aggregation/state-period.ts';
import { aggregateGaugePeriod } from '../../portals/app/app/domains/aggregation/gauge-period.ts';
import { atomKey } from '../../portals/app/app/domains/aggregation/object-rollup.ts';
import { bucketFor, nativeWindows } from '../../portals/app/app/domains/aggregation/periods.ts';
import { PgReportStore } from '../../portals/app/app/domains/reports/pg-store.ts';
import { createAuthorizedReports } from '../../portals/app/app/domains/access/reports.ts';
import { reportPublicationCases } from './report-publication.cases.mjs';
import { reportExportCases } from './report-export.cases.mjs';
import { reportListCases } from './report-list.cases.mjs';
import { reportScheduleCases } from './report-schedule.cases.mjs';
import { aggregateWorkerCases } from './aggregate-worker.cases.mjs';

export async function reportSnapshotCases(t,{db,adapterPool,ports}) {
  const metric=code=>({code,version:1}),up=metric('service.data.uplink_bytes'),rate=metric('status.voice.connection_rate'),state=metric('runtime.device.state'),gauge=metric('runtime.environment.temperature_c'),sms=metric('service.sms.success_count');
  const period=bucketFor('2026-07-06T00:00:00+08:00','day'),scope={workspaceId:'w',sourceIds:['report-src'],stationIds:['st'],serviceIds:['report-svc'],deviceIds:['report-dev'],metricKeys:[up,rate,state,gauge,sms].map(m=>m.code+'@1'),allowSiteParameters:false};
  const access={...ports,async readLocalGrant(){return {...await ports.readLocalGrant(),scope,permissions:['reports.generate','metering.view']};}};
  const makeApi=(p=access,pool=adapterPool)=>createAuthorizedReports(p,{create:s=>new PgReportStore(pool,s)},'interactive'),api=makeApi();
  const intercept=callback=>({async connect(){const c=await adapterPool.connect();return {async query(sql,args){return callback(c,sql,args);},release(d){c.release(d);}};}});
  await db.query(`INSERT INTO bsmoss_integration.source VALUES ('w','report-src','ReportSource','file');
    INSERT INTO bsmoss_resource.station_service VALUES ('w','report-svc','st','op','2026-01-01Z','2027-01-01Z');
    INSERT INTO bsmoss_resource.network_object VALUES ('w','report-cell','st','report-svc','cell');
    INSERT INTO bsmoss_resource.device VALUES ('w','report-dev','st','sensor','tower');
    INSERT INTO bsmoss_integration.source_mapping(workspace_id,id,source_id,external_type,external_id,station_id,service_id,network_object_id,device_id,version,valid_from,valid_to)
      VALUES ('w','report-cell-map','report-src','cell','report-cell','st','report-svc','report-cell',NULL,1,'2026-01-01Z','2027-01-01Z'),
        ('w','report-dev-map','report-src','device','report-dev','st',NULL,NULL,'report-dev',1,'2026-01-01Z','2027-01-01Z')`);
  for(const [m,native,rules] of [[up,'day',{intervalAggregation:{version:1,inputMode:'direct',authorityRef:'fixture://report-up'}}],
    [rate,'day',{intervalAggregation:{version:1,inputMode:'direct',authorityRef:'fixture://report-rate'}}],
    [state,'event',{stateAggregation:{version:1,authorityRef:'fixture://report-state',maxHoldMilliseconds:86400000}}],
    [gauge,'day',{gaugeAggregation:{version:1,authorityRef:'fixture://report-gauge',mode:'sample_mean',scale:3}}]]){
    const def=FIRST_METRICS.get(m);await db.query(`INSERT INTO bsmoss_catalog.metric_version VALUES ($1,1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,[m.code,def.category,def.semantic,def.unit,def]);
    await db.query(`INSERT INTO bsmoss_integration.source_capability VALUES ('w',$1,'report-src',$2,1,$3,'active','fixture://report-reviewed',$4,'2026-01-01Z','2027-01-01Z')`,['report-cap-'+m.code,m.code,native,rules]);
  }
  const writer=new PgMeasurementStore(adapterPool,scope,FIRST_METRICS),versions=new Map();
  const target=(m=up,grain='day',at=period.start)=>({sourceId:'report-src',mappingId:m.code.startsWith('runtime.')?'report-dev-map':'report-cell-map',metric:m,grain,at});
  async function write(m,value,window=period) {
    const eventId='report:'+m.code+':'+window.start,prior=versions.get(eventId)??0,revision=String(prior+1);versions.set(eventId,prior+1);
    return writer.append({workspaceId:'w',sourceId:'report-src',eventId,revision,previousRevision:prior?String(prior):null,payloadSha256:createHash('sha256').update(eventId+revision).digest('hex'),payloadUri:'fixture://report/'+m.code,
      occurredAt:window.end,metric:m,componentKey:'value',stationId:'st',mappingId:target(m).mappingId,transformVersion:'report-fixture-v1',periodStart:window.start,periodEnd:window.end,value,
      quality:{status:'verified',ruleVersion:'fixture-v1',reason:'Fixture reviewed',decidedBy:'fixture-reviewer'}});
  }
  async function publish(m=up,grain='day',at=period.start) {
    const q=target(m,grain,at),snapshot=await readRefreshSnapshot(adapterPool,scope,q),s={workspaceId:'w',series:[{sourceId:'report-src',subjectKey:snapshot.plan.subjectKey,metricKey:m.code+'@1'}]},
      store=snapshot.kind==='state'?new PgStateAggregateStore(adapterPool,s):snapshot.kind==='gauge'?new PgGaugeAggregateStore(adapterPool,s):new PgAggregateStore(adapterPool,s),head=await store.current(snapshot.plan);
    return store.publish(snapshot.plan,snapshot.inputs,head?.revision??null,'report-fixture-worker');
  }
  const panel=(id,m,order=0,grain='day')=>({id,metricRef:m,category:FIRST_METRICS.get(m).category,view:'card',grain,displayUnit:m===up?'B':m===rate?'%':m===state?'state':m===gauge?'degC':'count',precision:2,order,visible:true});
  const single=(grain='day')=>({schema:'periodic-report-template-v1',title:'Fixture periodic report',grain,panels:[panel('usage',up,0,grain)],bindings:[{panelId:'usage',kind:'aggregate',sourceId:'report-src',mappingId:'report-cell-map'}]});
  const putTemplate=(code,definition,version=1,kind='report')=>db.query(`INSERT INTO bsmoss_views.template_version(workspace_id,code,version,template_kind,definition,published_by) VALUES ('w',$1,$2,$3,$4,'fixture-reviewer')`,[code,version,kind,definition]);
  const command=(code,expectedRevision=null,at=period.start)=>({templateCode:code,templateVersion:1,at,expectedRevision});
  const counts=async()=>(await db.query(`SELECT (SELECT count(*) FROM bsmoss_analysis.report_series) series,(SELECT count(*) FROM bsmoss_analysis.report_revision) revisions,(SELECT count(*) FROM bsmoss_analysis.report_outbox) outbox`)).rows[0];
  for(const [m,value] of [[up,{kind:'integer_delta',value:'90071992547409931234567890'}],[rate,{kind:'ratio_parts',numerator:'19',denominator:'20'}],[state,{kind:'state_event',state:'running',validUntil:period.end}],[gauge,{kind:'fixed_point',unscaled:'25345',scale:3}]]){await write(m,value);await publish(m);}
  await putTemplate('report-single',single());
  let first;
  await t.test('report generation persists a stable exact snapshot with atomic generated outbox and authorized idempotent replay',async()=>{
    first=await api.generate(command('report-single'));assert.equal(first.status,'inserted');assert.equal(first.record.revision,'1');assert.equal(first.record.generatedBy,(await ports.readVerifiedIdentity()).sub);
    const r=first.record;assert.equal(r.manifest.status,'generated');assert.equal(r.manifest.dataCompleteness,'incomplete');assert.equal(r.manifest.items[0].status,'preliminary');assert.equal(r.manifestSha256,fingerprintOf(r.manifest));
    assert.equal(r.manifest.items[0].data.publication.result.value.value,'90071992547409931234567890');
    const before=await counts();assert.equal((await api.generate(command('report-single'))).status,'duplicate');assert.deepEqual(await counts(),before);
    const read=await api.read({reportId:r.reportId});assert.equal(read.freshness,'current');assert.deepEqual(read.manifest,r.manifest);assert.deepEqual(read.reasons,[]);
    assert.equal((await db.query('SELECT event_type FROM bsmoss_analysis.report_outbox WHERE report_id=$1',[r.reportId])).rows[0].event_type,'report.generated');
    assert.equal(await api.read({reportId:'absent'}),null);assert.equal(await api.read({reportId:r.reportId,revision:'999'}),null);
  });
  await t.test('a fully confirmed three-category report is complete while completion revocation invalidates its immutable evidence',async()=>{
    for(const m of [up,rate,state,gauge]) {
      const snapshot=await readRefreshSnapshot(adapterPool,scope,target(m)),plan={...snapshot.plan,sourceComplete:false,watermark:period.start};delete plan.completionEvidence;
      const calculate=snapshot.kind==='state'?aggregateStatePeriod:snapshot.kind==='gauge'?aggregateGaugePeriod:aggregateIntervals;
      const base=calculate(plan,snapshot.inputs),device=m===state||m===gauge;
      await db.query(`INSERT INTO bsmoss_integration.source_completion_set(workspace_id,id,source_id,station_id,service_id,network_object_id,device_id,metric_code,metric_version,grain,period_start,period_end,revision,status,input_fingerprint,mapping_manifest_sha256,watermark,evidence_ref,evidence_sha256,recorded_by)
        VALUES ('w',$1,'report-src','st',$2,$3,$4,$5,1,'day',$6,$7,1,'confirmed',$8,$9,$7,'fixture://report-complete',$10,'fixture-reviewer')`,
        ['report-proof:'+m.code,device?null:'report-svc',device?null:'report-cell',device?'report-dev':null,m.code,period.start,period.end,base.inputFingerprint,mappingSetFingerprint(base.mappingWindows),'f'.repeat(64)]);
      await publish(m);
    }
    const template={...single(),panels:[panel('usage',up,0),panel('rate',rate,1),panel('state',state,2),panel('temperature',gauge,3)],bindings:[...single().bindings,...[['rate',rate],['state',state],['temperature',gauge]].map(([panelId,m])=>({panelId,kind:'aggregate',sourceId:'report-src',mappingId:target(m).mappingId}))]};
    await putTemplate('report-complete',template);const record=(await api.generate(command('report-complete'))).record;
    assert.equal(record.manifest.dataCompleteness,'complete');assert.equal(record.manifest.watermark,period.end);assert.ok(record.manifest.items.every(i=>i.status==='complete'));
    await db.query(`INSERT INTO bsmoss_integration.source_completion_set SELECT workspace_id,'report-proof-revoked',source_id,station_id,service_id,network_object_id,device_id,metric_code,metric_version,grain,period_start,period_end,2,'revoked',input_fingerprint,mapping_manifest_sha256,period_start,'fixture://report-revoke',evidence_sha256,recorded_by,clock_timestamp() FROM bsmoss_integration.source_completion_set WHERE id=$1`,['report-proof:'+up.code]);
    const stale=await api.read({reportId:record.reportId});assert.equal(stale.freshness,'stale');assert.ok(stale.reasons.includes('usage:input_or_publication_changed'));assert.equal(stale.manifest.dataCompleteness,'complete');assert.equal(stale.manifestSha256,record.manifestSha256);
    await publish(up);
  });
  await t.test('three metric categories and a reviewed region share one report transaction without changing their value semantics',async()=>{
    const snap=await readRefreshSnapshot(adapterPool,scope,target()),atom={stationId:'st',serviceId:'report-svc',networkObjectId:'report-cell'};
    await db.query(`INSERT INTO bsmoss_integration.object_rollup_revision(workspace_id,id,revision,config,review_ref) VALUES ('w','report-rollup',1,$1,'fixture://report-rollup')`,
      [{status:'active',metric:up,validPeriod:{start:'2026-01-01T00:00:00.000Z',end:'2027-01-01T00:00:00.000Z'},basis:null,atoms:[atom],members:[{id:'one',sourceId:'report-src',mappingId:'report-cell-map',authorityVersion:snap.plan.authorityVersion,atomKeys:[atomKey(atom)],coverageRef:'fixture://report-coverage'}]}]);
    const template={...single(),panels:[panel('usage',up,0),panel('rate',rate,1),panel('state',state,2),panel('temperature',gauge,3),panel('region',up,4),{...panel('sms',sms,5),visible:false}],
      bindings:[...single().bindings,...[['rate',rate],['state',state],['temperature',gauge]].map(([panelId,m])=>({panelId,kind:'aggregate',sourceId:'report-src',mappingId:target(m).mappingId})),{panelId:'region',kind:'rollup',rollupId:'report-rollup'},{panelId:'sms',kind:'not_connected'}]};
    await putTemplate('report-three',template);let begins=0;
    const observed=intercept((c,sql,args)=>{if(sql.startsWith('BEGIN'))begins++;return c.query(sql,args);});
    const record=(await makeApi(access,observed).generate(command('report-three'))).record;assert.equal(begins,1);assert.deepEqual(record.manifest.sections.map(s=>s.status),['included','included','included']);
    const items=Object.fromEntries(record.manifest.items.map(i=>[i.panel.id,i]));
    assert.deepEqual(items.rate.data.publication.result.value,{kind:'ratio',numerator:'19',denominator:'20'});assert.equal(items.state.data.publication.result.value.durationMilliseconds.running,'86400000');assert.equal(items.temperature.data.publication.result.value.minimum.unscaled,'25345');
    assert.equal(items.region.data.result.knownValue.value,'90071992547409931234567890');assert.equal(items.sms.status,'not_connected');assert.equal(items.sms.panel.visible,false);assert.equal(record.manifest.requiredScope.deviceIds[0],'report-dev');
    assert.equal((await api.read({reportId:record.reportId})).freshness,'current');
  });
  await t.test('report generation fails before writes without explicit permission even for owners or without the full configured historical scope',async()=>{
    const before=await counts();
    const viewOnly={...access,async readVerifiedIdentity(){return {...await access.readVerifiedIdentity(),governanceRoles:['workspace:owner']};},async readLocalGrant(){return {...await access.readLocalGrant(),permissions:['metering.view']};}};
    await assert.rejects(makeApi(viewOnly).generate(command('report-single')),/permission_denied/);
    for(const patch of [{sourceIds:[]},{stationIds:[]},{serviceIds:[]},{metricKeys:[]},{deviceIds:[]}]){
      const denied={...access,async readLocalGrant(){return {...await access.readLocalGrant(),scope:{...scope,...patch}};}};
      await assert.rejects(makeApi(denied).generate(command(patch.deviceIds?'report-three':'report-single')),/scope_denied|mapping_unavailable/);
    }
    assert.deepEqual(await counts(),before);
  });
  await t.test('one report snapshot cannot mix old single-object data with a concurrently republished region member',async()=>{
    const template={...single(),panels:[panel('usage',up),panel('region',up,1)],bindings:[...single().bindings,{panelId:'region',kind:'rollup',rollupId:'report-rollup'}]};await putTemplate('report-consistent',template);let corrected=false,begins=0;
    const pool=intercept(async(c,sql,args)=>{if(sql.startsWith('BEGIN'))begins++;const result=await c.query(sql,args);if(!corrected&&sql.includes('SELECT definition FROM bsmoss_views.template_version')){corrected=true;await write(up,{kind:'integer_delta',value:'90071992547409931234567891'});await publish();}return result;});
    const record=(await makeApi(access,pool).generate(command('report-consistent'))).record;assert.equal(corrected,true);assert.equal(begins,1);
    assert.equal(record.manifest.items[0].data.publication.result.value.value,'90071992547409931234567890');assert.equal(record.manifest.items[1].data.result.knownValue.value,'90071992547409931234567890');
    assert.equal((await api.read({reportId:record.reportId})).freshness,'stale');
  });
  await t.test('report revisions become stale after fact correction, retain their original data and require expected-head concurrency',async()=>{
    await write(up,{kind:'integer_delta',value:'110'});let r=await api.read({reportId:first.record.reportId});assert.equal(r.freshness,'stale');assert.ok(r.reasons.includes('usage:input_or_publication_changed'));assert.equal(r.manifest.items[0].data.publication.result.value.value,'90071992547409931234567890');
    await publish();await assert.rejects(api.generate(command('report-single')),/report_revision_conflict/);
    const next=await api.generate(command('report-single','1'));assert.equal(next.record.revision,'2');assert.equal(next.record.manifest.items[0].data.publication.result.value.value,'110');
    r=await api.read({reportId:first.record.reportId,revision:'1'});assert.ok(r.reasons.includes('older_generated_revision'));assert.equal(r.revision,'1');assert.equal(r.currentRevision,'2');
    assert.equal((await api.read({reportId:first.record.reportId})).freshness,'current');
  });
  await t.test('a captured stale publication stays visibly stale even while its original immutable report bytes remain intact',async()=>{
    await write(up,{kind:'integer_delta',value:'120'});await putTemplate('report-stale',single());const r=(await api.generate(command('report-stale'))).record;
    assert.equal(r.manifest.capturedFreshness,'stale');assert.equal(r.manifest.items[0].status,'stale');const view=await api.read({reportId:r.reportId});assert.equal(view.freshness,'stale');assert.ok(view.reasons.includes('captured_stale_publication'));
    await publish();
  });
  await t.test('report outbox faults and final permission, identity or required-scope revocation roll back the entire generated revision',async()=>{
    for(const mode of ['outbox','permission','scope','identity']){
      const code='report-rollback-'+mode;await putTemplate(code,single());const before=await counts();let deny=false;
      const restricted={...access,async readLocalGrant(){const g=await access.readLocalGrant();return !deny?g:mode==='scope'?{...g,scope:{...scope,serviceIds:[]}}:{...g,permissions:[]};},async readVerifiedIdentity(){const id=await access.readVerifiedIdentity();return mode==='identity'&&deny?{...id,sub:'other'}:id;}};
      const pool=intercept(async(c,sql,args)=>{if(sql.includes('INSERT INTO bsmoss_analysis.report_outbox')){if(mode==='outbox')throw Error('fixture_report_outbox_fault');const result=await c.query(sql,args);deny=true;return result;}return c.query(sql,args);});
      await assert.rejects(makeApi(restricted,pool).generate(command(code)),/fixture_report_outbox_fault|permission_denied|report_scope_denied/);assert.deepEqual(await counts(),before);
    }
  });
  await t.test('concurrent first generation produces exactly one revision and stale repeatable snapshots cannot replace a newer report head',async()=>{
    await putTemplate('report-concurrent',single());const races=await Promise.allSettled([api.generate(command('report-concurrent')),api.generate(command('report-concurrent'))]);assert.ok(races.some(r=>r.status==='fulfilled'));
    const rows=(await db.query("SELECT s.id,r.revision FROM bsmoss_analysis.report_series s JOIN bsmoss_analysis.report_revision r ON (r.workspace_id,r.report_id)=(s.workspace_id,s.id) WHERE s.template_code='report-concurrent'")).rows;assert.equal(rows.length,1);
    await write(up,{kind:'integer_delta',value:'130'});await publish();let changed=false;
    const pool=intercept(async(c,sql,args)=>{const result=await c.query(sql,args);if(!changed&&sql.includes('SELECT definition FROM bsmoss_views.template_version')){changed=true;await write(up,{kind:'integer_delta',value:'140'});await publish();await api.generate(command('report-concurrent','1'));}return result;});
    await assert.rejects(makeApi(access,pool).generate(command('report-concurrent','1')),e=>e.code==='40001'||/report_revision_conflict/.test(e.message));assert.equal(changed,true);
    const read=await api.read({reportId:rows[0].id});assert.equal(read.currentRevision,'2');assert.equal(read.manifest.items[0].data.publication.result.value.value,'140');
  });
  await t.test('an authorized old input replay returns its exact revision without rolling the current report head backward',async()=>{
    // Only the test owner replaces a template binding, then restores it. This
    // tests old fingerprint replay; runtime cannot mutate template definitions.
    await putTemplate('report-replay',single());const one=await api.generate(command('report-replay'));
    const changed={...single(),title:'Fixture changed title'};await db.query("UPDATE bsmoss_views.template_version SET definition=$1 WHERE code='report-replay'",[changed]);const two=await api.generate(command('report-replay','1'));assert.equal(two.record.revision,'2');
    await db.query("UPDATE bsmoss_views.template_version SET definition=$1 WHERE code='report-replay'",[single()]);const replay=await api.generate(command('report-replay','2'));assert.equal(replay.status,'duplicate');assert.equal(replay.record.revision,'1');assert.equal(replay.record.currentRevision,'2');assert.equal(replay.record.reportId,one.record.reportId);
  });
  await t.test('current authorization covers immutable historical report scope and final read revocation drops an otherwise valid result',async()=>{
    const three=(await db.query("SELECT id FROM bsmoss_analysis.report_series WHERE template_code='report-three'")).rows[0].id;
    for(const patch of [{sourceIds:[]},{stationIds:[]},{serviceIds:[]},{metricKeys:[]},{deviceIds:[]}]){const restricted={...access,async readLocalGrant(){return {...await access.readLocalGrant(),scope:{...scope,...patch}};}};await assert.rejects(makeApi(restricted).read({reportId:three}),/report_scope_denied/);}
    const foreign={...access,async readVerifiedIdentity(){return {...await access.readVerifiedIdentity(),activeWorkspace:'other'};},async readCoverage(){return {workspaceId:'other',product:'bsmoss',tier:'fixture',bundled:false,expiresAt:Date.now()+60000};},async readLocalGrant(){return {...await access.readLocalGrant(),workspaceId:'other',scope:{...scope,workspaceId:'other'}};}};
    assert.equal(await makeApi(foreign).read({reportId:first.record.reportId}),null);
    for(const mode of ['permission','scope']){let reads=0;const revoked={...access,async readLocalGrant(){const g=await access.readLocalGrant();return ++reads===1?g:mode==='permission'?{...g,permissions:[]}:{...g,scope:{...scope,serviceIds:[]}};}};await assert.rejects(makeApi(revoked).read({reportId:first.record.reportId}),/denied/);}
    let reads=0;const narrowed={...access,async readLocalGrant(){const g=await access.readLocalGrant();return {...g,scope:{...scope,stationIds:++reads===1?['st','unused']:['st']}};}};assert.ok(await makeApi(narrowed).read({reportId:first.record.reportId}));
  });
  await t.test('authority loss, template mutation and changed rollup configuration mark stored reports stale without reading new unauthorized members',async()=>{
    const three=(await db.query("SELECT id FROM bsmoss_analysis.report_series WHERE template_code='report-three'")).rows[0].id;
    await db.query("UPDATE bsmoss_integration.source_capability SET status='retired' WHERE id=$1",['report-cap-'+state.code]);let r=await api.read({reportId:three});assert.ok(r.reasons.includes('state:authority_unavailable'));
    await putTemplate('report-unavailable',{...single(),panels:[panel('state',state)],bindings:[{panelId:'state',kind:'aggregate',sourceId:'report-src',mappingId:'report-dev-map'}]});
    const unavailable=(await api.generate(command('report-unavailable'))).record;assert.equal(unavailable.manifest.items[0].status,'authority_unavailable');assert.equal(unavailable.manifest.dataCompleteness,'incomplete');assert.equal(unavailable.manifest.items[0].data.publication,null);assert.equal((await api.read({reportId:unavailable.reportId})).freshness,'current');
    await db.query("UPDATE bsmoss_integration.source_capability SET status='active' WHERE id=$1",['report-cap-'+state.code]);r=await api.read({reportId:three});assert.ok(r.reasons.includes('state:input_or_publication_changed'));
    const raw=(await db.query("SELECT config FROM bsmoss_integration.object_rollup_revision WHERE id='report-rollup'")).rows[0].config;
    await db.query(`INSERT INTO bsmoss_integration.object_rollup_revision(workspace_id,id,revision,config,review_ref) VALUES ('w','report-rollup',2,$1,'fixture://report-rollup-paused')`,[{...raw,status:'paused',members:[{...raw.members[0],sourceId:'unauthorized-source'}]}]);
    r=await api.read({reportId:three});assert.ok(r.reasons.includes('region:rollup_configuration_changed'));assert.equal(r.manifest.items.find(i=>i.panel.id==='region').data.result.configRevision,'1');
    await db.query("UPDATE bsmoss_views.template_version SET definition=jsonb_set(definition,'{title}','\"Fixture altered\"') WHERE code='report-single'");r=await api.read({reportId:first.record.reportId});assert.ok(r.reasons.includes('template_definition_changed'));assert.equal(r.manifest.template.definition.title,'Fixture periodic report');
  });
  await t.test('weekly and monthly reports pin every day publication so daily-only revisions invalidate the saved report',async()=>{
    for(const grain of ['week','month']){
      const window=bucketFor(period.start,grain);await publish(up,grain,period.start);await putTemplate('report-'+grain,single(grain));const r=(await api.generate(command('report-'+grain))).record;
      assert.equal(r.manifest.items[0].dailyDependencies.length,nativeWindows(window,'day').length);assert.equal(r.manifest.items[0].dailyDependencies.find(d=>d.data.query.at===period.start).data.publication.revision,(await db.query(`SELECT current_revision FROM bsmoss_analysis.aggregate_series WHERE source_id='report-src' AND metric_code=$1 AND grain='day' AND period_start=$2`,[up.code,period.start])).rows[0].current_revision);
      const missing=r.manifest.items[0].dailyDependencies.filter(d=>d.status==='not_published');assert.ok(missing.length>0);assert.equal(r.manifest.dataCompleteness,'incomplete');
      const otherDay=nativeWindows(window,'day').find(d=>d.start!==period.start);await publish(up,'day',otherDay.start);
      const view=await api.read({reportId:r.reportId});assert.equal(view.freshness,'stale');assert.ok(view.reasons.includes('usage:input_or_publication_changed'));
    }
  });
  await t.test('a partial capability period does not fabricate identical missing daily dependencies across a month',async()=>{
    await db.query('UPDATE bsmoss_integration.source_capability SET valid_from=$1 WHERE id=$2',[period.start,'report-cap-'+up.code]);
    await putTemplate('report-window',single('month'));const record=(await api.generate(command('report-window'))).record,item=record.manifest.items[0];
    assert.equal(item.status,'authority_unavailable');assert.equal(item.data.publication,null);
    const actual=item.dailyDependencies.find(d=>d.data.query.at===period.start);assert.ok(actual.data.publication);assert.equal(actual.data.authorityVersion===null,false);
    const before=item.dailyDependencies.find(d=>d.data.query.at<period.start);assert.equal(before.status,'authority_unavailable');assert.equal(before.data.publication,null);
    await db.query("UPDATE bsmoss_integration.source_capability SET valid_from='2026-01-01Z' WHERE id=$1",['report-cap-'+up.code]);assert.equal((await api.read({reportId:record.reportId})).freshness,'stale');
  });
  await t.test('report SQL enforces tenant references, typed generated state and immutable runtime revisions with only head updates allowed',async()=>{
    for(const sql of ['UPDATE bsmoss_analysis.report_revision SET generated_by=generated_by','DELETE FROM bsmoss_analysis.report_revision','TRUNCATE bsmoss_analysis.report_revision','UPDATE bsmoss_analysis.report_outbox SET event_type=event_type','DELETE FROM bsmoss_analysis.report_outbox','UPDATE bsmoss_analysis.report_series SET template_code=template_code','DELETE FROM bsmoss_analysis.report_series'])await assert.rejects(adapterPool.query(sql),e=>e.code==='42501');
    const row=(await db.query('SELECT * FROM bsmoss_analysis.report_revision WHERE report_id=$1 ORDER BY revision LIMIT 1',[first.record.reportId])).rows[0];
    for(const patch of [{workspace_id:'other'},{report_id:randomUUID()}]){const copy={...row,...patch},keys=Object.keys(copy);if(patch.workspace_id)copy.manifest={...copy.manifest,workspaceId:'other',requiredScope:{...copy.manifest.requiredScope,workspaceId:'other'}};await assert.rejects(db.query('INSERT INTO bsmoss_analysis.report_revision('+keys.join(',')+') VALUES ('+keys.map((_,i)=>'$'+(i+1)).join(',')+')',Object.values(copy)),e=>e.code==='23503');}
    const malformed={...row,revision:'999',manifest_sha256:'e'.repeat(64),manifest:{...row.manifest,status:'published'}},keys=Object.keys(malformed);await assert.rejects(db.query('INSERT INTO bsmoss_analysis.report_revision('+keys.join(',')+') VALUES ('+keys.map((_,i)=>'$'+(i+1)).join(',')+')',Object.values(malformed)),e=>e.code==='23514');
    await assert.rejects(db.query("INSERT INTO bsmoss_analysis.report_outbox(workspace_id,id,report_id,revision,event_type) VALUES ('w',$1,$2,1,'report.published')",[randomUUID(),first.record.reportId]),e=>e.code==='23514');
    assert.equal((await db.query("SELECT 1 FROM local_authz.permission WHERE perm_code='reports.generate'")).rowCount,1);assert.equal((await db.query("SELECT 1 FROM local_authz.role_permission rp JOIN local_authz.permission p ON rp.permission_id=p.id WHERE p.perm_code='reports.generate'")).rowCount,0);
  });
  await t.test('database failures during report freshness are errors rather than falsely current or silently missing reports',async()=>{
    const broken=intercept((c,sql,args)=>sql.includes('SELECT m.*,n.kind')?c.query('SELECT * FROM report_fixture_missing'):c.query(sql,args));
    await assert.rejects(makeApi(access,broken).read({reportId:first.record.reportId}),e=>e.code==='42P01');
    await assert.rejects(api.generate({...command('report-single'),workspaceId:'forged'}),/invalid_report_fields/);
  });
  const publicationContext=await reportPublicationCases(t,{db,adapterPool,access,scope,api,up,sms,period,target,write,publish,putTemplate,single,panel,command,intercept});
  await reportExportCases(t,{db,adapterPool,scope,api,up,rate,state,gauge,period,target,write,publish,putTemplate,single,panel,command,intercept,publicationContext});
  await reportListCases(t,{db,adapterPool,access,scope,api,sms,up,putTemplate,panel,intercept});
  await reportScheduleCases(t,{db,adapterPool,access,scope,api,up,sms,period,write,publish,putTemplate,single,panel,intercept});
  await aggregateWorkerCases(t,{db,adapterPool,access,scope,up,rate,state,gauge,period,target,write,intercept});
}
