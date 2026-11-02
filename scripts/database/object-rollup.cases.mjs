import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import pg from 'pg';
import { PgMeasurementStore } from '../../portals/app/app/domains/measurements/pg-store.ts';
import { FIRST_METRICS } from '../../portals/app/app/domains/catalog/first-metrics.ts';
import { PgAggregateSnapshotReader } from '../../portals/app/app/domains/aggregation/pg-snapshot.ts';
import { PgAggregateStore } from '../../portals/app/app/domains/aggregation/pg-store.ts';
import { aggregateIntervals, fingerprintOf, mappingSetFingerprint } from '../../portals/app/app/domains/aggregation/intervals.ts';
import { PgObjectRollupReader } from '../../portals/app/app/domains/aggregation/pg-object-rollup.ts';
import { atomKey } from '../../portals/app/app/domains/aggregation/object-rollup.ts';
import { createAuthorizedObjectRollup } from '../../portals/app/app/domains/access/object-rollup.ts';

export async function objectRollupCases(t,{db,adapterPool,ports}) {
  const up={code:'service.data.uplink_bytes',version:1},ratio={code:'status.voice.connection_rate',version:1},prb={code:'status.radio.prb_utilization',version:1},energy={code:'runtime.energy.site_wh',version:1};
  const period={start:'2026-05-01T16:00:00.000Z',end:'2026-05-02T16:00:00.000Z'},validPeriod={start:'2026-01-01T00:00:00.000Z',end:'2027-01-01T00:00:00.000Z'};
  const basis={kind:'voice_attempts',ref:'fixture://rollup/attempts'},prbBasis={kind:'prb_capacity_time',ref:'fixture://rollup/prb-capacity-time'};
  const scope={workspaceId:'w',sourceIds:['roll-src','roll-alt'],stationIds:['st','roll-st2'],serviceIds:['roll-svc','roll-svc2','roll-svc3'],deviceIds:[],metricKeys:[up,ratio,prb,energy].map(m=>m.code+'@1'),allowSiteParameters:true};
  const viewPorts={...ports,async readLocalGrant(){return {...await ports.readLocalGrant(),scope,permissions:['metering.view']};}};
  const reader=new PgObjectRollupReader(adapterPool,scope),api=createAuthorizedObjectRollup(viewPorts,{create:s=>new PgObjectRollupReader(adapterPool,s)},'interactive');
  const request=id=>({rollupId:id,grain:'day',at:period.start});
  const a=(stationId,serviceId,networkObjectId)=>({stationId,serviceId,networkObjectId});
  const atoms={a:a('st','roll-svc','roll-a'),b:a('st','roll-svc','roll-b'),c:a('st','roll-svc2','roll-c'),d:a('roll-st2','roll-svc3','roll-d'),e:a('st',null,null),f:a('roll-st2',null,null)};
  const mappings={a:['roll-src','roll-a','st'],b:['roll-src','roll-b','st'],total:['roll-src','roll-total','st'],c:['roll-src','roll-c','st'],d:['roll-src','roll-d','roll-st2'],alt:['roll-alt','roll-alt-a','st'],e:['roll-src','roll-energy','st'],f:['roll-src','roll-energy2','roll-st2']};
  const target=(name,metric=up)=>({sourceId:mappings[name][0],mappingId:mappings[name][1],metric,grain:'day',at:period.start});
  await db.query(`INSERT INTO bsmoss_integration.source VALUES ('w','roll-src','RollSource','file'),('w','roll-alt','RollAlternative','file');
    INSERT INTO bsmoss_resource.station VALUES ('w','roll-st2','RollStation2','tower','610000','610100');
    INSERT INTO bsmoss_resource.operator_entity VALUES ('w','roll-op2','unicom','RollOperator2');
    INSERT INTO bsmoss_resource.station_service VALUES ('w','roll-svc','st','op','2026-01-01Z','2027-01-01Z'),('w','roll-svc2','st','roll-op2','2026-01-01Z','2027-01-01Z'),('w','roll-svc3','roll-st2','op','2026-01-01Z','2027-01-01Z');
    INSERT INTO bsmoss_resource.network_object VALUES ('w','roll-a','st','roll-svc','cell'),('w','roll-b','st','roll-svc','cell'),('w','roll-total','st','roll-svc','base_station'),('w','roll-c','st','roll-svc2','cell'),('w','roll-d','roll-st2','roll-svc3','cell')`);
  for(const name of Object.keys(mappings)) {
    const [source,id,station]=mappings[name],atom=atoms[name==='alt'?'a':name==='total'?'a':name];
    await db.query(`INSERT INTO bsmoss_integration.source_mapping(workspace_id,id,source_id,external_type,external_id,station_id,service_id,network_object_id,version,valid_from,valid_to)
      VALUES ('w',$1,$2,'fixture',$1,$3,$4,$5,1,'2026-01-01Z','2027-01-01Z')`,[id,source,station,atom.serviceId,name==='total'?'roll-total':atom.networkObjectId]);
  }
  for(const metric of [up,ratio,prb,energy]){
    const def=FIRST_METRICS.get(metric);await db.query(`INSERT INTO bsmoss_catalog.metric_version VALUES ($1,1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,[metric.code,def.category,def.semantic,def.unit,def]);
    await db.query(`INSERT INTO bsmoss_integration.source_capability VALUES ('w',$1,'roll-src',$2,1,'day','active','fixture://rollup-source',$3,'2026-01-01Z','2027-01-01Z')`,
    ['roll-cap-'+metric.code,metric.code,{intervalAggregation:{version:1,inputMode:'direct',authorityRef:'fixture://rollup-source-policy',...(metric===ratio?{objectBasis:basis}:metric===prb?{objectBasis:prbBasis}:{})}}]);
  }
  await db.query(`INSERT INTO bsmoss_integration.source_capability VALUES ('w','roll-alt-cap','roll-alt',$1,1,'day','active','fixture://rollup-alt',$2,'2026-01-01Z','2027-01-01Z')`,[up.code,{intervalAggregation:{version:1,inputMode:'direct',authorityRef:'fixture://rollup-alt-policy'}}]);
  const writer=new PgMeasurementStore(adapterPool,scope,FIRST_METRICS),versions=new Map();
  async function write(name,metric,value) {
    const [sourceId,mappingId,stationId]=mappings[name],eventId='roll:'+name+':'+metric.code,prior=versions.get(eventId)??0,revision=String(prior+1);versions.set(eventId,prior+1);
    return writer.append({workspaceId:'w',sourceId,eventId,revision,previousRevision:prior?String(prior):null,payloadSha256:createHash('sha256').update(eventId+revision).digest('hex'),payloadUri:'fixture://rollup/'+name,
      occurredAt:period.end,metric,componentKey:'value',stationId,mappingId,transformVersion:'roll-fixture-v1',periodStart:period.start,periodEnd:period.end,value,
      quality:{status:'verified',ruleVersion:'fixture-v1',reason:'Fixture reviewed',decidedBy:'fixture-reviewer'}});
  }
  async function publish(name,metric=up,confirmed=false) {
    const q=target(name,metric),snap=await new PgAggregateSnapshotReader(adapterPool,scope).load(q);
    if(confirmed){const basePlan={...snap.plan,sourceComplete:false,watermark:period.start};delete basePlan.completionEvidence;
      const base=aggregateIntervals(basePlan,snap.inputs),proof=(await db.query(`SELECT coalesce(max(revision),0)+1 AS revision FROM bsmoss_integration.source_completion_set WHERE workspace_id='w' AND source_id=$1 AND station_id=$2 AND service_id IS NOT DISTINCT FROM $3 AND network_object_id IS NOT DISTINCT FROM $4 AND metric_code=$5 AND period_start=$6`,
      [q.sourceId,mappings[name][2],name==='total'?'roll-svc':atoms[name==='alt'?'a':name].serviceId,name==='total'?'roll-total':atoms[name==='alt'?'a':name].networkObjectId,metric.code,period.start])).rows[0].revision;
      const atom=atoms[name==='alt'||name==='total'?'a':name];
      await db.query(`INSERT INTO bsmoss_integration.source_completion_set(workspace_id,id,source_id,station_id,service_id,network_object_id,metric_code,metric_version,grain,period_start,period_end,revision,status,input_fingerprint,mapping_manifest_sha256,watermark,evidence_ref,evidence_sha256,recorded_by)
        VALUES ('w',$1,$2,$3,$4,$5,$6,1,'day',$7,$8,$9,'confirmed',$10,$11,$8,'fixture://rollup-proof',$12,'fixture-reviewer')`,
      ['roll-proof:'+name+':'+metric.code+':'+proof,q.sourceId,mappings[name][2],atom.serviceId,name==='total'?'roll-total':atom.networkObjectId,metric.code,period.start,period.end,proof,base.inputFingerprint,mappingSetFingerprint(snap.plan.mappingWindows),'a'.repeat(64)]);
    }
    const fresh=await new PgAggregateSnapshotReader(adapterPool,scope).load(q),store=new PgAggregateStore(adapterPool,{workspaceId:'w',series:[{sourceId:q.sourceId,subjectKey:fresh.plan.subjectKey,metricKey:metric.code+'@1'}]}),head=await store.current(fresh.plan);
    return store.publish(fresh.plan,fresh.inputs,head?.revision??null,'roll-fixture-worker');
  }
  async function config(names=['a','b'],metric=up) {
    const aa=names.flatMap(n=>n==='total'?[atoms.a,atoms.b]:[atoms[n==='alt'?'a':n]]),unique=[...new Map(aa.map(a=>[atomKey(a),a])).values()],members=[];
    for(const name of names){const q=target(name,metric),snap=await new PgAggregateSnapshotReader(adapterPool,scope).load(q);members.push({id:name,sourceId:q.sourceId,mappingId:q.mappingId,authorityVersion:snap.plan.authorityVersion,atomKeys:(name==='total'?[atoms.a,atoms.b]:[atoms[name==='alt'?'a':name]]).map(atomKey),coverageRef:'fixture://rollup-coverage/'+name});}
    return {status:'active',metric,validPeriod,basis:metric===ratio?basis:metric===prb?prbBasis:null,atoms:unique,members};
  }
  const register=(id,c,revision='1',workspace='w',client=db)=>client.query(`INSERT INTO bsmoss_integration.object_rollup_revision(workspace_id,id,revision,config,review_ref,database_actor) VALUES ($1,$2,$3,$4,'fixture://rollup-review','forged')`,[workspace,id,revision,c]);
  for(const [name,value] of [['a','100'],['b','200'],['total','300'],['c','50'],['d','70'],['alt','999']]){await write(name,up,{kind:'integer_delta',value});await publish(name);}
  let split;
  await t.test('reviewed rollup configuration is immutable, serial, hashed and read-only for runtime',async()=>{
    split=await config();await register('roll-split',split);
    const row=(await db.query("SELECT *,config::text AS bytes FROM bsmoss_integration.object_rollup_revision WHERE id='roll-split'")).rows[0];assert.equal(row.config_sha256,createHash('sha256').update(row.bytes).digest('hex'));assert.notEqual(row.database_actor,'forged');
    for(const sql of ["UPDATE bsmoss_integration.object_rollup_revision SET review_ref='forged'","DELETE FROM bsmoss_integration.object_rollup_revision","TRUNCATE bsmoss_integration.object_rollup_revision"])await assert.rejects(db.query(sql),/rollup_revision_append_only/);
    for(const sql of ["INSERT INTO bsmoss_integration.object_rollup_revision SELECT * FROM bsmoss_integration.object_rollup_revision","UPDATE bsmoss_integration.object_rollup_revision SET review_ref='forged'","DELETE FROM bsmoss_integration.object_rollup_revision","TRUNCATE bsmoss_integration.object_rollup_revision","SELECT bsmoss_integration.capture_object_rollup_revision()"])
      await assert.rejects(adapterPool.query(sql),e=>e.code==='42501');
    await assert.rejects(register('roll-split',split,'3'),/revision_conflict/);
    const peer=new pg.Client(db.connectionParameters);await peer.connect();
    try {
      const races=await Promise.allSettled([register('roll-race-config',split),register('roll-race-config',split,'1','w',peer)]);assert.equal(races.filter(r=>r.status==='fulfilled').length,1);assert.equal(races.filter(r=>r.status==='rejected').length,1);
      await db.query('BEGIN');await register('roll-serial-config',split);const second=register('roll-serial-config',split,'2','w',peer);let waiting=false;
      try {for(let i=0;i<100;i++){waiting=(await db.query("SELECT EXISTS(SELECT 1 FROM pg_locks WHERE pid=$1 AND locktype='advisory' AND NOT granted) AS waiting",[peer.processID])).rows[0].waiting;if(waiting)break;await new Promise(r=>setTimeout(r,5));}
        assert.equal(waiting,true);await db.query('COMMIT');await second;
      }finally{await db.query('ROLLBACK');await second.catch(()=>{});}
      assert.deepEqual((await db.query("SELECT revision FROM bsmoss_integration.object_rollup_revision WHERE id='roll-serial-config' ORDER BY revision")).rows.map(r=>r.revision),['1','2']);
    }finally{await peer.end();}
  });
  await t.test('formal rollup returns exact publications and trusted preliminary subtotals with independent physical and service counts',async()=>{
    await register('roll-multi',await config(['a','b','c','d']));const r=await api.read(request('roll-multi'));
    assert.equal(r.value,null);assert.deepEqual(r.knownValue,{kind:'integer',value:'420'});assert.equal(r.completeness,'preliminary');assert.equal(r.physicalStationCount,2);assert.equal(r.serviceCount,3);assert.equal(r.configRevision,'1');
    assert.equal(r.members.length,4);assert.ok(r.members.every(m=>m.publication.revision==='1'&&m.publication.freshness==='current'));assert.equal(r.attribution.find(a=>a.networkObjectId==='roll-c').operatorEntityId,'roll-op2');assert.ok(r.attribution.every(a=>a.serviceApplicable));assert.equal(r.applicableServiceCount,3);
    const {fingerprint,...body}=r;assert.equal(fingerprint,fingerprintOf(body));assert.ok(r.members.every(m=>m.publication.authorityRevisions.length>=3));
    assert.equal(await api.read(request('not-registered')),null);assert.equal(await new PgObjectRollupReader(adapterPool,{...scope,workspaceId:'other'}).read(request('roll-multi')),null);
  });
  await t.test('total and detail configurations agree while overlapping totals, alternative sources and duplicate atoms fail closed',async()=>{
    await register('roll-total',await config(['total']));assert.deepEqual((await reader.read(request('roll-total'))).knownValue,(await reader.read(request('roll-split'))).knownValue);
    for(const [id,c] of [['roll-overlap',await config(['total','a'])],['roll-cross-source',await config(['a','alt'])],['roll-duplicate',{...split,atoms:[...split.atoms,split.atoms[0]]}]]){
      await register(id,c);await assert.rejects(reader.read(request(id)),/overlapping_or_unknown_rollup_coverage|duplicate_rollup_atom/);
    }
  });
  await t.test('the entire expected population requires scope even when an atom has no selected source',async()=>{
    await register('roll-uncovered',{...split,members:[split.members[0]]});
    for(const patch of [{sourceIds:[]},{stationIds:[]},{serviceIds:[]},{metricKeys:[]}])await assert.rejects(new PgObjectRollupReader(adapterPool,{...scope,...patch}).read(request('roll-split')),/rollup_scope_denied/);
    await register('roll-uncovered-other',{...split,atoms:[...split.atoms,atoms.d],members:[split.members[0]]});
    await assert.rejects(new PgObjectRollupReader(adapterPool,{...scope,stationIds:['st']}).read(request('roll-uncovered-other')),/rollup_scope_denied/);
    const r=await reader.read(request('roll-uncovered'));assert.equal(r.completeness,'partial');assert.equal(r.value,null);assert.deepEqual(r.knownValue,{kind:'integer',value:'100'});assert.deepEqual(r.coverage.uncoveredAtomKeys,[atomKey(atoms.b)]);
  });
  await t.test('complete confirmations permit a complete value without inventing a result or filling missing inputs with zero',async()=>{
    for(const n of ['a','b'])await publish(n,up,true);let r=await reader.read(request('roll-split'));assert.equal(r.completeness,'complete');assert.deepEqual(r.value,{kind:'integer',value:'300'});assert.equal(r.watermark,period.end);
    await register('roll-no-source',{...split,members:[]});r=await reader.read(request('roll-no-source'));assert.equal(r.completeness,'missing');assert.equal(r.value,null);assert.equal(r.knownValue,null);
    await register('roll-not-published',await config(['a'],ratio));r=await reader.read(request('roll-not-published'));assert.equal(r.completeness,'missing');assert.ok(r.members[0].reasons.includes('not_published'));
  });
  await t.test('input corrections exclude an obsolete publication and preserve unaffected members until recomputed',async()=>{
    await write('a',up,{kind:'integer_delta',value:'110'});let r=await reader.read(request('roll-split'));assert.equal(r.freshness,'stale');assert.deepEqual(r.knownValue,{kind:'integer',value:'200'});assert.ok(r.members[0].reasons.includes('publication_stale'));
    await publish('a',up,true);r=await reader.read(request('roll-split'));assert.equal(r.completeness,'complete');assert.deepEqual(r.value,{kind:'integer',value:'310'});
  });
  await t.test('review generations never revive after capability changes and restoration, even with a newly published result',async()=>{
    await db.query("UPDATE bsmoss_integration.source_capability SET validation_ref='fixture://rollup-revised' WHERE id=$1",['roll-cap-'+up.code]);
    let r=await reader.read(request('roll-split'));assert.equal(r.knownValue,null);assert.ok(r.members.every(m=>m.reasons.includes('reviewed_authority_changed')));
    await db.query("UPDATE bsmoss_integration.source_capability SET validation_ref='fixture://rollup-source' WHERE id=$1",['roll-cap-'+up.code]);
    await publish('a',up,true);await publish('b',up,true);r=await reader.read(request('roll-split'));assert.equal(r.knownValue,null);
    split=await config();await register('roll-split',split,'2');r=await reader.read(request('roll-split'));assert.equal(r.configRevision,'2');assert.equal(r.freshness,'current');assert.equal(r.completeness,'complete');assert.deepEqual(r.value,{kind:'integer',value:'310'});
  });
  await t.test('ratio rollups add reviewed denominator parts and retain verified zero-attempt evidence',async()=>{
    for(const [name,numerator,denominator] of [['a','1','2'],['b','9','10'],['c','0','0']]){await write(name,ratio,{kind:'ratio_parts',numerator,denominator});await publish(name,ratio,true);}
    await register('roll-ratio',await config(['a','b'],ratio));assert.deepEqual((await reader.read(request('roll-ratio'))).value,{kind:'ratio',numerator:'10',denominator:'12'});
    await register('roll-zero',await config(['c'],ratio));const zero=await reader.read(request('roll-zero'));assert.equal(zero.value,null);assert.equal(zero.completeness,'complete');assert.deepEqual(zero.ratioParts,{numerator:'0',denominator:'0'});
    await register('roll-zero-plus',await config(['a','c'],ratio));assert.deepEqual((await reader.read(request('roll-zero-plus'))).value,{kind:'ratio',numerator:'1',denominator:'2'});
  });
  await t.test('PRB requires matching capacity-time bases and never trusts an arbitrary utilization percentage',async()=>{
    for(const [name,numerator,denominator] of [['a','10','100'],['b','900','1000']]){await write(name,prb,{kind:'ratio_parts',numerator,denominator});await publish(name,prb,true);}
    const c=await config(['a','b'],prb);await register('roll-prb',c);assert.deepEqual((await reader.read(request('roll-prb'))).value,{kind:'ratio',numerator:'910',denominator:'1100'});
    await db.query(`UPDATE bsmoss_integration.source_capability SET rules=jsonb_set(rules,'{intervalAggregation,objectBasis,ref}','"fixture://incompatible"') WHERE id=$1`,['roll-cap-'+prb.code]);
    await assert.rejects(reader.read(request('roll-prb')),/rollup_ratio_basis_mismatch/);
    await db.query(`UPDATE bsmoss_integration.source_capability SET rules=jsonb_set(rules,'{intervalAggregation,objectBasis,ref}',to_jsonb($1::text)) WHERE id=$2`,[prbBasis.ref,'roll-cap-'+prb.code]);
    assert.equal((await reader.read(request('roll-prb'))).knownValue,null);
  });
  await t.test('physical station energy stays independent of operator services and cannot be attributed to cells',async()=>{
    for(const [name,value] of [['e','1000'],['f','2000']]){await write(name,energy,{kind:'integer_delta',value});await publish(name,energy,true);}
    await register('roll-energy',await config(['e','f'],energy));const r=await reader.read(request('roll-energy'));assert.deepEqual(r.value,{kind:'integer',value:'3000'});assert.equal(r.physicalStationCount,2);assert.equal(r.serviceCount,0);assert.ok(r.attribution.every(a=>a.operatorEntityId===null));
    await assert.rejects(new PgObjectRollupReader(adapterPool,{...scope,allowSiteParameters:false}).read(request('roll-energy')),/rollup_scope_denied/);
    await register('roll-energy-forged',{...await config(['e'],energy),atoms:[atoms.a]});await assert.rejects(reader.read(request('roll-energy-forged')),/physical_attribution/);
  });
  await t.test('topology validates actual cells and mapping ownership instead of accepting reviewed JSON as resource evidence',async()=>{
    await register('roll-parent-atom',{...split,atoms:[a('st','roll-svc','roll-total')],members:[{...split.members[0],atomKeys:[atomKey(a('st','roll-svc','roll-total'))]}]});await assert.rejects(reader.read(request('roll-parent-atom')),/rollup_atom_unavailable/);
    await register('roll-wrong-owner',{...split,atoms:[atoms.c],members:[{...split.members[0],atomKeys:[atomKey(atoms.c)]}]});await assert.rejects(reader.read(request('roll-wrong-owner')),/rollup_mapping_coverage_mismatch/);
    await register('roll-wrong-cell',{...split,atoms:[atoms.b],members:[{...split.members[0],atomKeys:[atomKey(atoms.b)]}]});await assert.rejects(reader.read(request('roll-wrong-cell')),/rollup_mapping_coverage_mismatch/);
    await register('roll-boundary',{...split,validPeriod:{start:'2026-05-02T00:00:00.000Z',end:validPeriod.end}});await assert.rejects(reader.read(request('roll-boundary')),/rollup_period_boundary/);
    await db.query(`INSERT INTO bsmoss_integration.source_mapping(workspace_id,id,source_id,external_type,external_id,station_id,service_id,network_object_id,version,valid_from,valid_to)
      VALUES ('w','roll-total-history','roll-src','fixture','roll-total-history','st','roll-svc','roll-total',1,'2025-01-01Z','2026-01-01Z')`);
    const total=await config(['total']),historical=await new PgAggregateSnapshotReader(adapterPool,scope).load({...target('total'),mappingId:'roll-total-history'});
    await register('roll-alias',{...total,members:[{...total.members[0],atomKeys:[atomKey(atoms.a)]},{...total.members[0],id:'historical',mappingId:'roll-total-history',authorityVersion:historical.plan.authorityVersion,atomKeys:[atomKey(atoms.b)]}]});
    await assert.rejects(reader.read(request('roll-alias')),/duplicate_rollup_subject/);
  });
  await t.test('inactive services remain not-applicable instead of becoming missing or zero service usage',async()=>{
    await db.query("UPDATE bsmoss_resource.station_service SET valid_to=$1 WHERE id='roll-svc2'",[period.start]);await publish('c',ratio);
    await register('roll-inactive',await config(['c'],ratio));let r=await reader.read(request('roll-inactive'));assert.equal(r.completeness,'not_applicable');assert.equal(r.knownValue,null);assert.equal(r.value,null);assert.equal(r.watermark,period.end);assert.equal(r.attribution[0].serviceApplicable,false);assert.equal(r.serviceCount,1);assert.equal(r.applicableServiceCount,0);
    await register('roll-active-and-inactive',await config(['a','c'],ratio));r=await reader.read(request('roll-active-and-inactive'));assert.equal(r.completeness,'complete');assert.deepEqual(r.value,{kind:'ratio',numerator:'1',denominator:'2'});assert.equal(r.watermark,period.end);
  });
  await t.test('unavailable source authority is explicit and database faults never become invented missing values',async()=>{
    await db.query("UPDATE bsmoss_integration.source_capability SET status='retired' WHERE id=$1",['roll-cap-'+up.code]);let r=await reader.read(request('roll-split'));assert.equal(r.completeness,'missing');assert.equal(r.knownValue,null);assert.ok(r.members.every(m=>m.reasons.includes('authority_unavailable')));
    await db.query("UPDATE bsmoss_integration.source_capability SET status='active' WHERE id=$1",['roll-cap-'+up.code]);
    const broken={async connect(){const c=await adapterPool.connect();return {query(sql,args){if(sql.includes('SELECT m.*,n.kind'))return c.query('SELECT * FROM fixture_missing_table');return c.query(sql,args);},release(d){c.release(d);}};}};
    await assert.rejects(new PgObjectRollupReader(broken,scope).read(request('roll-split')),e=>e.code==='42P01');
    split=await config();await register('roll-split',split,'3');await publish('a',up,true);await publish('b',up,true);assert.equal((await reader.read(request('roll-split'))).completeness,'complete');
  });
  await t.test('one repeatable-read view binds configuration and all members across concurrent pause and publication',async()=>{
    await register('roll-snapshot',split);let changed=false,begins=0;
    const observed={async connect(){const c=await adapterPool.connect();return {async query(sql,args){if(sql.startsWith('BEGIN'))begins++;const result=await c.query(sql,args);
      if(!changed&&sql.includes('FROM bsmoss_integration.object_rollup_revision')){changed=true;await register('roll-snapshot',{...split,status:'paused'},'2');await write('b',up,{kind:'integer_delta',value:'400'});await publish('b',up,true);}return result;},release(d){c.release(d);}};}};
    const r=await new PgObjectRollupReader(observed,scope).read(request('roll-snapshot'));assert.equal(begins,1);assert.equal(changed,true);assert.equal(r.configRevision,'1');assert.equal(r.freshness,'current');assert.deepEqual(r.value,{kind:'integer',value:'310'});
    await assert.rejects(reader.read(request('roll-snapshot')),/rollup_paused/);await register('roll-snapshot',split,'3');assert.deepEqual((await reader.read(request('roll-snapshot'))).value,{kind:'integer',value:'510'});
  });
  await t.test('formal rollup drops an otherwise successful PostgreSQL result after final authority or scope revocation',async()=>{
    for(const mode of ['permission','scope']){let reads=0;const revoked={...viewPorts,async readLocalGrant(){const g=await viewPorts.readLocalGrant();return ++reads===1?g:mode==='permission'?{...g,permissions:[]}:{...g,scope:{...scope,serviceIds:[]}};}};
      await assert.rejects(createAuthorizedObjectRollup(revoked,{create:s=>new PgObjectRollupReader(adapterPool,s)},'interactive').read(request('roll-split')),/permission_denied/);}
    assert.deepEqual((await api.read(request('roll-split'))).value,{kind:'integer',value:'510'});
  });
}
