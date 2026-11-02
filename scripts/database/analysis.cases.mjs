import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PgAnalysisStore } from '../../portals/app/app/domains/views/pg-analysis.ts';
import { createAuthorizedAnalysis } from '../../portals/app/app/domains/access/analysis.ts';
import { fingerprintOf } from '../../portals/app/app/domains/aggregation/intervals.ts';
import { readRefreshSnapshot } from '../../portals/app/app/domains/aggregation/refresh-snapshot.ts';
import { atomKey } from '../../portals/app/app/domains/aggregation/object-rollup.ts';

export async function analysisCases(t,{db,adapterPool,access,scope,up,rate,state,gauge,sms,period,publish,putTemplate,panel,intercept}) {
  const subject=(await access.readVerifiedIdentity()).sub, query={at:period.start};
  const make=(p=access,pool=adapterPool)=>createAuthorizedAnalysis(p,{create:(s,sub)=>new PgAnalysisStore(pool,s,sub)},'interactive'),api=make();
  const selection=(code,version=1)=>db.query(`INSERT INTO bsmoss_views.template_selection VALUES ('w','analysis:default',$1,$2,'fixture',now())
    ON CONFLICT(workspace_id,scope_key) DO UPDATE SET template_code=excluded.template_code,template_version=excluded.template_version`,[code,version]);
  const name='analysis-'+randomUUID(), definition={schema:'analysis-template-v1',title:'Authorized analysis',panels:[{...panel('usage',up),view:'trend'},panel('rate',rate,1),panel('state',state,2),panel('temperature',gauge,3),panel('sms',sms,4)],
    bindings:[{panelId:'usage',kind:'aggregate',sourceId:'report-src',mappingId:'report-cell-map'},{panelId:'rate',kind:'aggregate',sourceId:'report-src',mappingId:'report-cell-map'},
      {panelId:'state',kind:'aggregate',sourceId:'report-src',mappingId:'report-dev-map'},{panelId:'temperature',kind:'aggregate',sourceId:'report-src',mappingId:'report-dev-map'},{panelId:'sms',kind:'not_connected'}]};
  const command=(preferences=[],expectedRevision=null)=>({commandId:randomUUID(),templateCode:name,templateVersion:1,templateSha256:fingerprintOf(definition),expectedRevision,preferences});
  const count=async()=>(await db.query('SELECT count(*)::int n FROM bsmoss_views.user_preference')).rows[0].n;
  await t.test('analysis requires a server-selected page template and returns three categories with exact values and missing history',async()=>{
    assert.equal((await api.read(query)).template,null);await putTemplate(name,definition,1,'page');await selection(name);
    const r=await api.read(query);assert.equal(r.panels.length,5);assert.equal(new Set(r.panels.map(p=>p.panel.category)).size,3);
    const usage=r.panels.find(p=>p.panel.id==='usage');assert.equal(usage.points.length,7);assert.equal(usage.points.at(-1).data.publication.result.value.value,'90071992547409931234567890');
    assert.ok(usage.points.slice(0,-1).every(p=>p.status==='not_published'&&p.data.publication===null));assert.equal(r.panels.find(p=>p.panel.id==='sms').points[0].status,'not_connected');
    assert.equal(r.preferenceRevision,null);assert.equal(r.template.sha256,fingerprintOf(definition));
  });
  let firstCommand;
  await t.test('personal preferences persist exact CAS revisions and idempotent history never rolls back the current head',async()=>{
    firstCommand=command([{id:'usage',displayUnit:'GB',visible:false,order:8}]);const first=await api.save(firstCommand);assert.equal(first.revision,'1');
    const loaded=await api.read(query),u=loaded.panels.find(p=>p.panel.id==='usage');assert.equal(u.panel.visible,false);assert.equal(u.panel.displayUnit,'GB');assert.deepEqual(u.points,[]);
    assert.equal((await api.save(command([], '1'))).revision,'2');assert.equal((await api.read(query)).panels.find(p=>p.panel.id==='usage').panel.visible,true);
    const replay=await api.save(firstCommand);assert.equal(replay.status,'duplicate');assert.equal(replay.revision,'1');assert.equal(replay.currentRevision,'2');
    await assert.rejects(api.save({...firstCommand,preferences:[]}),/analysis_preference_conflict/);await assert.rejects(api.save(command()),/analysis_preference_conflict/);
  });
  await t.test('hidden and configuration-only panels do not read time series and cannot reveal unauthorized objects',async()=>{
    const broken=intercept((c,sql,args)=>sql.includes('SELECT m.*,n.kind')?c.query('SELECT * FROM analysis_forbidden_timeseries'):c.query(sql,args));
    const saved=command([{id:'usage',visible:false},{id:'rate',visible:false},{id:'state',visible:false},{id:'temperature',visible:false}], '2');
    assert.equal((await make(access,broken).save(saved)).revision,'3');assert.ok((await make(access,broken).read(query)).panels.every(p=>p.points.length===0||p.binding.kind==='not_connected'));
    const restricted={...access,async readLocalGrant(s){return {...await access.readLocalGrant(s),scope:{...scope,deviceIds:[]}};}};
    const result=await make(restricted).read(query);assert.ok(result.panels.every(p=>!['state','temperature'].includes(p.panel.id)));
    await assert.rejects(make(restricted).save(command([{id:'state',visible:true}],'3')),/scope_denied/);
    const narrowed={...access,async readLocalGrant(s){return {...await access.readLocalGrant(s),scope:{...scope,sourceIds:[]}};}};
    assert.deepEqual((await make(narrowed).read(query)).panels.map(p=>p.panel.id),['sms']);
    await assert.rejects(make(narrowed).save(firstCommand),/scope_denied/);
    assert.equal((await api.save(command([], '3'))).revision,'4');
  });
  await t.test('preferences are isolated by trusted subject and template version, reset appends a new revision',async()=>{
    const other={...access,async readVerifiedIdentity(){return {...await access.readVerifiedIdentity(),sub:'analysis-other'};},async readLocalGrant(s){return {...await access.readLocalGrant(s),sub:'analysis-other'};}};
    assert.equal((await make(other).read(query)).preferenceRevision,null);assert.equal((await make(other).save(command([{id:'usage',displayUnit:'GiB'}]))).revision,'1');
    assert.equal((await api.read(query)).preferenceRevision,'4');await putTemplate(name,definition,2,'page');await selection(name,2);
    assert.equal((await api.read(query)).preferenceRevision,null);await assert.rejects(api.save(command([], '4')),/analysis_template_changed/);
    assert.equal((await api.save(firstCommand)).revision,'1');await selection(name);
  });
  await t.test('concurrent identical preference commands replay once and different stale commands cannot overwrite a winner',async()=>{
    const same=command([{id:'usage',precision:4}], '4'),before=await count(),both=await Promise.all([api.save(same),api.save(same)]);
    assert.deepEqual(both.map(r=>r.status).sort(),['duplicate','inserted']);assert.equal(await count(),before+1);
    const different=await Promise.allSettled([api.save(command([], '5')),api.save(command([{id:'usage',precision:3}], '5'))]);
    assert.equal(different.filter(r=>r.status==='fulfilled').length,1);assert.match(different.find(r=>r.status==='rejected').reason.message,/analysis_preference_conflict/);
  });
  await t.test('preference writes and returned reads revalidate subject, permission, actual scope and original lifetime at the final boundary',async()=>{
    for(const mode of ['permission','scope','identity','expiry']){
      let written=false,clock=Date.now();const before=await count(),loaded=await api.read(query);
      const p={...access,now:()=>clock,async readVerifiedIdentity(){const i=await access.readVerifiedIdentity();return mode==='identity'&&written?{...i,sub:'foreign'}:i;},
        async readLocalGrant(s){const g=await access.readLocalGrant(s);return written&&mode==='permission'?{...g,permissions:[]}:written&&mode==='scope'?{...g,scope:{...scope,sourceIds:[]}}:g;}};
      const pool=intercept(async(c,sql,args)=>{const r=await c.query(sql,args);if(sql.includes('INSERT INTO bsmoss_views.user_preference')){written=true;if(mode==='expiry')clock=Date.now()+86400000;}return r;});
      await assert.rejects(make(p,pool).save(command([],loaded.preferenceRevision)));assert.equal(await count(),before);
    }
    let reads=0;const p={...access,async readLocalGrant(s){const g=await access.readLocalGrant(s);return ++reads>1?{...g,permissions:[]}:g;}};
    await assert.rejects(make(p).read(query),/permission_denied/);
    const pool=intercept((c,sql,args)=>sql.includes('INSERT INTO bsmoss_views.user_preference')?c.query('SELECT * FROM analysis_sql_failure'):c.query(sql,args));
    const before=await count();await assert.rejects(make(access,pool).save(command([],(await api.read(query)).preferenceRevision)),e=>e.code==='42P01');assert.equal(await count(),before);
  });
  await t.test('analysis does not disguise SQL failures as missing values and known capability gaps remain explicit',async()=>{
    await api.save(command([],(await api.read(query)).preferenceRevision));
    const broken=intercept((c,sql,args)=>sql.includes('SELECT m.*,n.kind')?c.query('SELECT * FROM analysis_fixture_missing'):c.query(sql,args));
    await assert.rejects(make(access,broken).read(query),e=>e.code==='42P01');
    await db.query("UPDATE bsmoss_integration.source_capability SET status='retired' WHERE id=$1",['report-cap-'+up.code]);
    const r=await api.read(query);assert.equal(r.panels.find(p=>p.panel.id==='usage').points.at(-1).status,'authority_unavailable');
    await db.query("UPDATE bsmoss_integration.source_capability SET status='active' WHERE id=$1",['report-cap-'+up.code]);await publish(up);
  });
  await t.test('analysis rollups enforce their actual complete scope and direct ratios do not require unrelated dependency grants',async()=>{
    const atom={stationId:'st',serviceId:'report-svc',networkObjectId:'report-cell'},id='analysis-rollup-'+randomUUID();
    const snap=await readRefreshSnapshot(adapterPool,scope,{sourceId:'report-src',mappingId:'report-cell-map',metric:rate,grain:'day',at:period.start});
    // The reviewed ratio basis must match the source policy; adding it revises authority.
    const rules=(await db.query('SELECT rules FROM bsmoss_integration.source_capability WHERE id=$1',['report-cap-'+rate.code])).rows[0].rules;
    await db.query('UPDATE bsmoss_integration.source_capability SET rules=$1 WHERE id=$2',[{...rules,intervalAggregation:{...rules.intervalAggregation,objectBasis:{kind:'voice_attempts',ref:'fixture://analysis-basis'}}},'report-cap-'+rate.code]);
    const fresh=await readRefreshSnapshot(adapterPool,scope,{sourceId:'report-src',mappingId:'report-cell-map',metric:rate,grain:'day',at:period.start});
    const c={status:'active',metric:rate,validPeriod:{start:'2026-01-01T00:00:00.000Z',end:'2027-01-01T00:00:00.000Z'},basis:{kind:'voice_attempts',ref:'fixture://analysis-basis'},atoms:[atom],members:[{id:'one',sourceId:'report-src',mappingId:'report-cell-map',authorityVersion:fresh.plan.authorityVersion,atomKeys:[atomKey(atom)],coverageRef:'fixture://analysis-coverage'}]};
    await db.query(`INSERT INTO bsmoss_integration.object_rollup_revision(workspace_id,id,revision,config,review_ref) VALUES ('w',$1,1,$2,'fixture://analysis-reviewed')`,[id,c]);
    const code='analysis-region-'+randomUUID();await putTemplate(code,{schema:'analysis-template-v1',title:'Regional ratio',panels:[panel('region',rate)],bindings:[{panelId:'region',kind:'rollup',rollupId:id}]},1,'page');await selection(code);
    try{await publish(rate);const r=await api.read(query);assert.equal(r.panels.length,1);assert.equal(r.panels[0].points[0].data.kind,'rollup');assert.deepEqual(r.panels[0].points[0].data.result.requiredMetricKeys,[rate.code+'@1']);
      const narrow={...access,async readLocalGrant(s){return {...await access.readLocalGrant(s),scope:{...scope,serviceIds:[]}};}};assert.deepEqual((await make(narrow).read(query)).panels,[]);
    }finally{await db.query('UPDATE bsmoss_integration.source_capability SET rules=$1 WHERE id=$2',[rules,'report-cap-'+rate.code]);await publish(rate);await selection(name);}
    assert.ok(snap.plan.authorityVersion);
  });
  await t.test('physical station parameters require their independent flag even before reading unavailable source authority',async()=>{
    await db.query(`INSERT INTO bsmoss_integration.source_mapping(workspace_id,id,source_id,external_type,external_id,station_id,version,valid_from,valid_to)
      VALUES ('w','analysis-energy-map','report-src','station','analysis-energy','st',1,'2026-01-01Z','2027-01-01Z')`);
    const m={code:'runtime.energy.site_wh',version:1},p={id:'energy',category:'runtime_parameter',metricRef:m,view:'card',grain:'day',displayUnit:'Wh',precision:2,order:0,visible:true},code='analysis-energy-'+randomUUID();
    await putTemplate(code,{schema:'analysis-template-v1',title:'Physical energy',panels:[p],bindings:[{panelId:'energy',kind:'aggregate',sourceId:'report-src',mappingId:'analysis-energy-map'}]},1,'page');await selection(code);
    const ports=allow=>({...access,async readLocalGrant(s){return {...await access.readLocalGrant(s),scope:{...scope,metricKeys:[...scope.metricKeys,m.code+'@1'],allowSiteParameters:allow}};}});
    try{assert.deepEqual((await make(ports(false)).read(query)).panels,[]);const r=await make(ports(true)).read(query);assert.equal(r.panels[0].points[0].status,'authority_unavailable');assert.equal(r.panels[0].points[0].data,null);}finally{await selection(name);await db.query("DELETE FROM bsmoss_integration.source_mapping WHERE workspace_id='w' AND id='analysis-energy-map'");}
  });
  await t.test('preference evidence is append-only with database actor capture, digest checks and tenant foreign keys',async()=>{
    const row=(await db.query('SELECT * FROM bsmoss_views.user_preference WHERE subject=$1 ORDER BY created_at LIMIT 1',[subject])).rows[0];
    assert.equal(row.recorded_by,(await db.query('SELECT session_user')).rows[0].session_user);assert.match(row.database_sha256,/^[a-f0-9]{64}$/);
    const foreign={...row,workspace_id:'other',definition:{...row.definition,requiredScope:{...row.definition.requiredScope,workspaceId:'other'}}};foreign.definition_sha256=fingerprintOf(foreign.definition);
    const keys=Object.keys(foreign);await assert.rejects(db.query('INSERT INTO bsmoss_views.user_preference('+keys.join(',')+') VALUES ('+keys.map((_,i)=>'$'+(i+1)).join(',')+')',Object.values(foreign)),e=>e.code==='23503');
    for(const sql of ['UPDATE bsmoss_views.user_preference SET subject=subject','DELETE FROM bsmoss_views.user_preference','TRUNCATE bsmoss_views.user_preference'])await assert.rejects(adapterPool.query(sql),e=>e.code==='42501');
    await assert.rejects(db.query('UPDATE bsmoss_views.user_preference SET subject=subject'),e=>e.code==='42501');
    await db.query('ALTER TABLE bsmoss_views.user_preference DISABLE TRIGGER user_preference_capture');
    try{await db.query("UPDATE bsmoss_views.user_preference SET definition_sha256=repeat('e',64) WHERE workspace_id='w' AND subject=$1 AND template_code=$2 AND template_version=1 AND revision=(SELECT max(revision) FROM bsmoss_views.user_preference WHERE subject=$1 AND template_code=$2 AND template_version=1)",[subject,name]);await assert.rejects(api.read(query),/invalid_analysis_preference_evidence/);}
    finally{await db.query("UPDATE bsmoss_views.user_preference SET definition_sha256=$1 WHERE workspace_id='w' AND subject=$2 AND template_code=$3 AND template_version=1 AND revision=(SELECT max(revision) FROM bsmoss_views.user_preference WHERE subject=$2 AND template_code=$3 AND template_version=1)",[(await db.query("SELECT definition FROM bsmoss_views.user_preference WHERE subject=$1 AND template_code=$2 AND template_version=1 ORDER BY revision DESC LIMIT 1",[subject,name])).rows.map(r=>fingerprintOf(r.definition))[0],subject,name]);await db.query('ALTER TABLE bsmoss_views.user_preference ENABLE TRIGGER user_preference_capture');}
    await db.query("DELETE FROM bsmoss_views.template_selection WHERE workspace_id='w' AND scope_key='analysis:default'");
  });
}
