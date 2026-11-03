import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {PgTemplateStore} from '../../portals/app/app/domains/views/pg-templates.ts';
import {createAuthorizedTemplates} from '../../portals/app/app/domains/access/templates.ts';
import {fingerprintOf} from '../../portals/app/app/domains/aggregation/intervals.ts';
import {normalizeRollupConfig,atomKey} from '../../portals/app/app/domains/aggregation/object-rollup.ts';
import {PgAnalysisStore} from '../../portals/app/app/domains/views/pg-analysis.ts';
import {createAuthorizedAnalysis} from '../../portals/app/app/domains/access/analysis.ts';

export async function templateCases(t,{db,adapterPool,access,scope,up,state,sms,panel,period,intercept}) {
  // Previous owner-seeded analysis fixtures have no selection audit history.
  await db.query("DELETE FROM bsmoss_views.template_selection WHERE workspace_id='w' AND scope_key='analysis:default'");
  const permissions=['views.templates.view','views.templates.publish','views.templates.select','metering.view'];
  const admin={...access,async readLocalGrant(s){return{...await access.readLocalGrant(s),permissions,scope:structuredClone(scope)};}};
  const make=(p=admin,pool=adapterPool)=>createAuthorizedTemplates(p,{create:(s,sub)=>new PgTemplateStore(pool,s,sub)},'interactive'),api=make();
  const page={kind:'page',definition:{schema:'analysis-template-v1',title:'Reviewed station analysis',panels:[panel('usage',up),{...panel('state',state,1),visible:false}],bindings:[
    {panelId:'usage',kind:'aggregate',sourceId:'report-src',mappingId:'report-cell-map'},{panelId:'state',kind:'aggregate',sourceId:'report-src',mappingId:'report-dev-map'}]}};
  const narrow={kind:'page',definition:{schema:'analysis-template-v1',title:'No source connected',panels:[panel('sms',sms)],bindings:[{panelId:'sms',kind:'not_connected'}]}};
  const code='template-'+randomUUID();
  const publish=async(candidate=page,expectedVersion=null,name=code)=>{
    const v=await api.preview(candidate);return{commandId:randomUUID(),templateCode:name,expectedVersion,candidate,candidateSha256:v.candidateSha256,validationSha256:v.validationSha256,reviewRef:'fixture://reviewed'};
  };
  const select=async(name=code,version=1)=>{
    const r=await api.read({code:name,version}),v=await api.preview(r.template.candidate);
    return{commandId:randomUUID(),scopeKey:'analysis:default',templateCode:name,templateVersion:version,templateSha256:r.template.sha256,validationSha256:v.validationSha256,expected:r.selection,reviewRef:'fixture://selection'};
  };
  const counts=async()=>(await db.query(`SELECT (SELECT count(*) FROM bsmoss_views.template_version) versions,(SELECT count(*) FROM bsmoss_views.template_publication) publications,
    (SELECT count(*) FROM bsmoss_views.template_selection_event) selections`)).rows[0];
  let first,firstSelection;
  await t.test('template preview validates all hidden real objects without reading measurement or aggregate publications',async()=>{
    const noData=intercept((c,sql,args)=>/FROM bsmoss_metering\.measurement|FROM bsmoss_analysis\.aggregate_(?:series|revision)/.test(sql)?c.query('SELECT * FROM template_forbidden_timeseries'):c.query(sql,args));
    const r=await make(admin,noData).preview(page);assert.deepEqual(r.requiredScope.deviceIds,['report-dev']);assert.equal(r.references.length,2);assert.match(r.validationSha256,/^[a-f0-9]{64}$/);
    assert.deepEqual((await api.preview(narrow)).requiredScope.sourceIds,[]);
    const missing={...page,definition:{...page.definition,bindings:[page.definition.bindings[0],{...page.definition.bindings[1],mappingId:'absent'}]}};await assert.rejects(api.preview(missing),/template_binding_unavailable/);
    const wrong={...page,definition:{...page.definition,bindings:[{...page.definition.bindings[0],mappingId:'report-dev-map'},page.definition.bindings[1]]}};await assert.rejects(api.preview(wrong),/template_binding_mismatch/);
    const restricted={...admin,async readLocalGrant(s){return{...await admin.readLocalGrant(s),scope:{...scope,deviceIds:[]}};}};await assert.rejects(make(restricted).preview(page),/scope_denied/);
  });
  await t.test('reviewed publication atomically creates one immutable version with exact receipt and never auto-selects it',async()=>{
    const before=(await api.read({code})).selection;first=await publish();const r=await api.publish(first);assert.equal(r.status,'inserted');assert.equal(r.version,1);
    const loaded=await make().read({code});assert.equal(loaded.template.sha256,fingerprintOf(page.definition));assert.equal(loaded.template.candidate.definition.panels[1].visible,false);assert.deepEqual(loaded.selection,before);
    const row=(await db.query('SELECT * FROM bsmoss_views.template_publication WHERE code=$1',[code])).rows[0];assert.equal(row.recorded_by,(await db.query('SELECT session_user')).rows[0].session_user);assert.match(row.database_sha256,/^[a-f0-9]{64}$/);
    for(const sql of ["UPDATE bsmoss_views.template_version SET definition=definition WHERE code=$1","DELETE FROM bsmoss_views.template_version WHERE code=$1"])await assert.rejects(db.query(sql,[code]),e=>e.code==='42501');
  });
  await t.test('template publication CAS and subject-bound replay preserve exact historical versions after the head advances',async()=>{
    const changed={...page,definition:{...page.definition,title:'Second reviewed title'}};const second=await publish(changed,1);await api.publish(second);
    const replay=await api.publish(first);assert.equal(replay.status,'duplicate');assert.equal(replay.version,1);assert.equal(replay.currentVersion,2);
    await assert.rejects(api.publish({...first,reviewRef:'different'}),/template_command_conflict/);await assert.rejects(api.publish(await publish(page,1)),/template_revision_conflict/);
    const other={...admin,async readVerifiedIdentity(){return{...await admin.readVerifiedIdentity(),sub:'other-admin'};},async readLocalGrant(s){return{...await admin.readLocalGrant(s),sub:'other-admin'};}};
    await assert.rejects(make(other).publish(first),/template_revision_conflict/);
    const onlyOwner={...access,async readVerifiedIdentity(){return{...await access.readVerifiedIdentity(),governanceRoles:['workspace:owner']};}};await assert.rejects(make(onlyOwner).publish(first),/permission_denied/);
  });
  await t.test('concurrent publication of one command commits once while different stale commands receive explicit conflict',async()=>{
    const c=await publish(page,null,'template-race-'+randomUUID()),r=await Promise.all([api.publish(c),make().publish(c)]);assert.deepEqual(r.map(x=>x.status).sort(),['duplicate','inserted']);
    const next=await publish(narrow,1,c.templateCode),outcomes=await Promise.allSettled([api.publish(next),api.publish({...next,commandId:randomUUID()})]);
    assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);assert.match(outcomes.find(r=>r.status==='rejected').reason.message,/template_revision_conflict/);
  });
  await t.test('default selection and rollback append contiguous events while old command replay never rewinds the pointer',async()=>{
    firstSelection=await select();const first=await api.select(firstSelection);assert.equal(first.revision,'1');assert.equal(first.isCurrent,true);
    const second=await api.select(await select(code,2));assert.equal(second.revision,'2');
    const rolled=await api.select(await select(code,1));assert.equal(rolled.revision,'3');assert.equal((await api.read({code})).selection.version,1);
    const old=await api.select(firstSelection);assert.equal(old.status,'duplicate');assert.equal(old.revision,'1');assert.equal(old.currentRevision,'3');assert.equal(old.isCurrent,false);
    await assert.rejects(api.select({...firstSelection,reviewRef:'changed'}),/template_command_conflict/);
    const analysis=createAuthorizedAnalysis(admin,{create:(s,sub)=>new PgAnalysisStore(adapterPool,s,sub)},'interactive');const result=await analysis.read({at:period.start});assert.equal(result.template.code,code);assert.equal(result.template.version,1);
    const preference={commandId:randomUUID(),templateCode:code,templateVersion:1,templateSha256:result.template.sha256,expectedRevision:null,preferences:[]};assert.equal((await analysis.save(preference)).revision,'1');
  });
  await t.test('concurrent selection replays exactly once and stale competing switches cannot overwrite the chosen version',async()=>{
    const c=await select(code,2),r=await Promise.all([api.select(c),api.select(c)]);assert.deepEqual(r.map(x=>x.status).sort(),['duplicate','inserted']);
    const next=await select(code,1),outcomes=await Promise.allSettled([api.select(next),api.select({...next,commandId:randomUUID()})]);assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);assert.match(outcomes.find(r=>r.status==='rejected').reason.message,/template_revision_conflict/);
  });
  await t.test('personal preference shared locks fence default switches and stale repeatable snapshots cannot save against a replaced page',async()=>{
    const analysis=(pool=adapterPool)=>createAuthorizedAnalysis(admin,{create:(s,sub)=>new PgAnalysisStore(pool,s,sub)},'interactive');
    const current=await analysis().read({at:period.start});assert.equal(current.template.version,1);
    let signal,release;const locked=new Promise(r=>signal=r),gate=new Promise(r=>release=r);
    const pool=intercept(async(c,sql,args)=>{const result=await c.query(sql,args);if(sql.includes('bsmoss_views.lock_analysis_selection')){signal();await gate;}return result;});
    const pref={commandId:randomUUID(),templateCode:code,templateVersion:1,templateSha256:current.template.sha256,expectedRevision:current.preferenceRevision,preferences:[]};
    const saving=analysis(pool).save(pref);await locked;const switching=api.select(await select(code,2));let finished=false;switching.then(()=>finished=true,()=>finished=true);
    try{await new Promise(r=>setTimeout(r,40));assert.equal(finished,false);}finally{release();}
    await saving;await switching;
    const selected=await analysis().read({at:period.start}),c=await select(code,1);let switched=false;
    const stale=intercept(async(client,sql,args)=>{if(!switched&&sql.includes('bsmoss_views.lock_analysis_selection')){switched=true;await api.select(c);}return client.query(sql,args);});
    const before=(await db.query('SELECT count(*) FROM bsmoss_views.user_preference')).rows[0].count;
    await assert.rejects(analysis(stale).save({...pref,commandId:randomUUID(),templateVersion:2,templateSha256:selected.template.sha256,expectedRevision:selected.preferenceRevision}),/analysis_template_changed/);
    assert.equal(switched,true);assert.equal((await db.query('SELECT count(*) FROM bsmoss_views.user_preference')).rows[0].count,before);
  });
  await t.test('configuration revisions invalidate a preview while historical command receipts remain reproducible',async()=>{
    const c=await publish(page,2),old=(await db.query("SELECT version FROM bsmoss_integration.source_mapping WHERE id='report-cell-map'")).rows[0].version;
    await db.query("UPDATE bsmoss_integration.source_mapping SET version=version+1 WHERE id='report-cell-map'");
    try{await assert.rejects(api.publish(c),/template_validation_changed/);assert.equal((await api.publish(first)).status,'duplicate');assert.equal((await api.select(firstSelection)).status,'duplicate');}
    finally{await db.query("UPDATE bsmoss_integration.source_mapping SET version=$1 WHERE id='report-cell-map'",[old]);}
  });
  await t.test('default replacement requires displaced scope even when the incoming template contains only unconnected metrics',async()=>{
    const name='template-narrow-'+randomUUID();await api.publish(await publish(narrow,null,name));const c=await select(name,1);
    const restricted={...admin,async readLocalGrant(s){return{...await admin.readLocalGrant(s),scope:{...scope,deviceIds:[],sourceIds:[],serviceIds:[],stationIds:[],metricKeys:[sms.code+'@1']}};}};
    await assert.rejects(make(restricted).select(c),/scope_denied/);const done=await api.select(c);assert.equal(done.isCurrent,true);
    await assert.rejects(make(restricted).select(c),/scope_denied/);await api.select(await select(code,1));
  });
  await t.test('template writes and reads revalidate real permission identity and full required scope after database work',async()=>{
    for(const mode of ['permission','identity','scope']){
      const c=await publish(page,2),before=await counts();let reads=0;
      const revoke={...admin,async readVerifiedIdentity(){const i=await admin.readVerifiedIdentity();return mode==='identity'&&reads>0?{...i,sub:'other'}:i;},async readLocalGrant(s){const g=await admin.readLocalGrant(s);return ++reads>1?mode==='permission'?{...g,permissions:[]}:mode==='scope'?{...g,scope:{...scope,deviceIds:[]}}:g:g;}};
      await assert.rejects(make(revoke).publish(c));assert.deepEqual(await counts(),before);
      const selection=await select(code,2);reads=0;await assert.rejects(make(revoke).select(selection));assert.deepEqual(await counts(),before);
      reads=0;await assert.rejects(make(revoke).read({code}));
    }
    const before=await counts(),c=await publish(page,2),broken=intercept((client,sql,args)=>sql.includes('INSERT INTO bsmoss_views.template_publication')?client.query('SELECT * FROM template_receipt_sql_failure'):client.query(sql,args));
    await assert.rejects(make(admin,broken).publish(c),e=>e.code==='42P01');assert.deepEqual(await counts(),before);
    let wrote=false;const afterWrite=intercept(async(client,sql,args)=>{const r=await client.query(sql,args);if(sql.includes('INSERT INTO bsmoss_views.template_publication')){wrote=true;await client.query('SELECT * FROM template_after_write_failure');}return r;});
    await assert.rejects(make(admin,afterWrite).publish(c),e=>e.code==='42P01');assert.equal(wrote,true);assert.deepEqual(await counts(),before);
  });
  await t.test('template preview authorizes every uncovered device atom and keeps physical station parameters independently scoped',async()=>{
    await db.query("INSERT INTO bsmoss_resource.device VALUES ('w','template-uncovered','st','sensor','tower')");
    const a={stationId:'st',serviceId:null,networkObjectId:null,deviceId:'report-dev'},b={...a,deviceId:'template-uncovered'},config={status:'active',metric:state,validPeriod:period,basis:null,atoms:[a,b],members:[{id:'one',sourceId:'report-src',mappingId:'report-dev-map',authorityVersion:'a'.repeat(64),coverageRef:'fixture://one',atomKeys:[atomKey(a)]}]};
    const normalized=normalizeRollupConfig(config).config;await db.query("INSERT INTO bsmoss_integration.object_rollup_revision(workspace_id,id,revision,config,review_ref) VALUES ('w','template-dev-rollup',1,$1,'fixture://devices')",[normalized]);
    const device={kind:'page',definition:{schema:'analysis-template-v1',title:'Device population',panels:[panel('state',state)],bindings:[{panelId:'state',kind:'rollup',rollupId:'template-dev-rollup'}]}};
    await assert.rejects(api.preview(device),/scope_denied/);const extended={...admin,async readLocalGrant(s){return{...await admin.readLocalGrant(s),scope:{...scope,deviceIds:[...scope.deviceIds,'template-uncovered']}};}};
    assert.deepEqual((await make(extended).preview(device)).requiredScope.deviceIds,['report-dev','template-uncovered']);
    await db.query(`INSERT INTO bsmoss_integration.source_mapping(workspace_id,id,source_id,external_type,external_id,station_id,version,valid_from,valid_to)
      VALUES ('w','template-energy-map','report-src','station','template-energy','st',1,'2026-01-01Z','2027-01-01Z')`);
    const energy={kind:'page',definition:{schema:'analysis-template-v1',title:'Energy',panels:[{id:'energy',category:'runtime_parameter',metricRef:{code:'runtime.energy.site_wh',version:1},view:'card',grain:'day',displayUnit:'Wh',precision:2,order:0,visible:true}],bindings:[{panelId:'energy',kind:'aggregate',sourceId:'report-src',mappingId:'template-energy-map'}]}};
    const physical=allow=>({...admin,async readLocalGrant(s){return{...await admin.readLocalGrant(s),scope:{...scope,metricKeys:[...scope.metricKeys,'runtime.energy.site_wh@1'],allowSiteParameters:allow}};}});
    await assert.rejects(make(physical(false)).preview(energy),/scope_denied/);assert.equal((await make(physical(true)).preview(energy)).requiredScope.allowSiteParameters,true);
    const energyApi=make(physical(true)),v=await energyApi.preview(energy),name='physical-template-'+randomUUID();
    await energyApi.publish({commandId:randomUUID(),templateCode:name,expectedVersion:null,candidate:energy,candidateSha256:v.candidateSha256,validationSha256:v.validationSha256,reviewRef:'fixture://energy'});
    const r=await energyApi.read({code:name});await energyApi.select({commandId:randomUUID(),scopeKey:'analysis:default',templateCode:name,templateVersion:1,templateSha256:r.template.sha256,validationSha256:v.validationSha256,expected:r.selection,reviewRef:'fixture://physical-default'});
    const old=await energyApi.read({code,version:1}),next=await energyApi.preview(old.template.candidate),command={commandId:randomUUID(),scopeKey:'analysis:default',templateCode:code,templateVersion:1,templateSha256:old.template.sha256,validationSha256:next.validationSha256,expected:old.selection,reviewRef:'fixture://physical-replacement'};
    await energyApi.select(command);await assert.rejects(make(physical(false)).select(command),/scope_denied/);
  });
  await t.test('database template evidence is immutable and rejects forged source footprints, sequence gaps and direct pointer writes',async()=>{
    for(const table of ['template_publication','template_selection_event'])for(const sql of [`UPDATE bsmoss_views.${table} SET subject=subject`,`DELETE FROM bsmoss_views.${table}`,`TRUNCATE bsmoss_views.${table} CASCADE`]){
      await assert.rejects(adapterPool.query(sql),e=>e.code==='42501');await assert.rejects(db.query(sql),e=>e.code==='42501');
    }
    for(const sql of ["UPDATE bsmoss_views.template_selection SET template_version=1 WHERE workspace_id='w'","INSERT INTO bsmoss_views.template_version VALUES ('w','forged-template',1,'page','{}','fake',now())"])
      await assert.rejects(adapterPool.query(sql),e=>e.code==='42501');
    const row=(await db.query('SELECT * FROM bsmoss_views.template_publication WHERE code=$1 AND version=1',[code])).rows[0];
    for(const patch of [{code:'forged-footprint',version:'1',manifest:{...row.manifest,command:{...row.manifest.command,templateCode:'forged-footprint'},requiredScope:{...row.manifest.requiredScope,deviceIds:[]}}},
      {code:'forged-gap',version:'99',manifest:{...row.manifest,command:{...row.manifest.command,templateCode:'forged-gap'}}}]){
      const copy={...row,...patch,command_id:randomUUID()};copy.manifest=structuredClone(copy.manifest);copy.manifest.command.commandId=copy.command_id;
      if(patch.code==='forged-footprint')copy.manifest.validation.requiredScope=copy.manifest.requiredScope;copy.manifest_sha256=fingerprintOf(copy.manifest);
      const keys=Object.keys(copy);await assert.rejects(db.query('INSERT INTO bsmoss_views.template_publication('+keys.join(',')+') VALUES ('+keys.map((_,i)=>'$'+(i+1)).join(',')+')',Object.values(copy)),e=>e.code==='23514');
    }
    assert.equal((await db.query("SELECT 1 FROM local_authz.role_permission rp JOIN local_authz.permission p ON p.id=rp.permission_id WHERE p.perm_code LIKE 'views.templates.%'")).rowCount,0);
  });
  await t.test('template receipt digest corruption remains a hard failure and report templates publish without triggering report generation',async()=>{
    const row=(await db.query('SELECT * FROM bsmoss_views.template_publication WHERE code=$1 AND version=1',[code])).rows[0];
    await db.query('ALTER TABLE bsmoss_views.template_publication DISABLE TRIGGER capture_template_publication');
    try{await db.query('UPDATE bsmoss_views.template_publication SET manifest_sha256=repeat(\'e\',64) WHERE code=$1 AND version=1',[code]);await assert.rejects(api.publish(first),/invalid_template_evidence/);}
    finally{await db.query('UPDATE bsmoss_views.template_publication SET manifest_sha256=$1 WHERE code=$2 AND version=1',[row.manifest_sha256,code]);await db.query('ALTER TABLE bsmoss_views.template_publication ENABLE TRIGGER capture_template_publication');}
    const report={kind:'report',definition:{...page.definition,schema:'periodic-report-template-v1',grain:'day'}},name='published-report-'+randomUUID();
    const before=(await db.query('SELECT count(*) FROM bsmoss_analysis.report_revision')).rows[0].count;await api.publish(await publish(report,null,name));
    assert.equal((await api.read({code:name})).template.candidate.kind,'report');assert.equal((await db.query('SELECT count(*) FROM bsmoss_analysis.report_revision')).rows[0].count,before);
    const v=await api.preview(report),c=await select(code,1);await assert.rejects(api.select({...c,templateCode:name,templateSha256:fingerprintOf(report.definition),validationSha256:v.validationSha256}),/template_validation_changed/);
  });
}
