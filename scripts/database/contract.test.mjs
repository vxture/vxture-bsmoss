// Creates and removes only a random bsmoss_contract_* database on a local test cluster.
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import pg from "pg";
import { PgMeasurementStore } from "../../portals/app/app/domains/measurements/pg-store.ts";
import { FIRST_METRICS } from "../../portals/app/app/domains/catalog/first-metrics.ts";
import { PgProvisioningStore } from "../../portals/app/app/provisioning/lib/pg-store.ts";
import { handleProvisioning } from "../../portals/app/app/provisioning/lib/handler.ts";
import { readPgGrant } from "../../portals/app/app/domains/access/pg-grants.ts";
import { PgAggregateStore } from "../../portals/app/app/domains/aggregation/pg-store.ts";
import { aggregateIntervals, mappingSetFingerprint } from "../../portals/app/app/domains/aggregation/intervals.ts";
import { PgAggregateSnapshotReader } from "../../portals/app/app/domains/aggregation/pg-snapshot.ts";
import { createAuthorizedAggregates } from "../../portals/app/app/domains/access/aggregates.ts";
const { Client } = pg;
const connectionString = process.env.TEST_DATABASE_ADMIN_URL;
if (!connectionString) throw new Error("TEST_DATABASE_ADMIN_URL is required (dedicated local PostgreSQL only)");
const url = new URL(connectionString);
if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) throw new Error("local_test_cluster_required");
const dbName = "bsmoss_contract_" + randomUUID().replaceAll("-", "");
const admin = new Client({ connectionString });
let db;
const peers = [];
let adapterPool;
let created = false;
await test("empty-database PostgreSQL contract", async t => {
  try {
    await admin.connect();
    // Cluster role is a DBA precondition; do not modify an existing role.
    const role = await admin.query("SELECT rolsuper, rolcreaterole, rolcreatedb, rolcanlogin FROM pg_roles WHERE rolname='bsmoss_svc'");
    if (!role.rowCount) await admin.query("CREATE ROLE bsmoss_svc NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE");
    else assert.ok(Object.values(role.rows[0]).every(v => v === false), "test runtime role must be unprivileged and NOLOGIN");
    await admin.query('CREATE DATABASE "' + dbName + '"'); created = true;
    const target = new URL(connectionString); target.pathname = "/" + dbName;
    db = new Client({connectionString:target.toString()}); await db.connect();
    await t.test("baseline plus grants and column locks apply to an empty database", async () => {
      for (const name of ["00_baseline.sql","97_runtime_grants.sql","98_column_locks.sql"]) {
        await db.query(readFileSync(new URL("../../deploy/database/ddl/"+name,import.meta.url),"utf8"));
      }
      const tables = await db.query("SELECT count(*)::int AS n FROM information_schema.tables WHERE (table_schema LIKE 'bsmoss_%' OR table_schema IN ('vx_provision','local_authz','local_usage')) AND table_type='BASE TABLE'");
      assert.equal(tables.rows[0].n,31);
      const version = await db.query("SHOW server_version"); console.log("PostgreSQL:",version.rows[0].server_version);
    });
    await t.test("actual PostgreSQL columns match the Prisma scalar mirror",async()=>{
      const schema=readFileSync(new URL("../../portals/app/prisma/schema.prisma",import.meta.url),"utf8");
      const actual=await db.query("SELECT table_schema,table_name,column_name,data_type,is_nullable,numeric_precision,numeric_scale FROM information_schema.columns WHERE table_schema LIKE 'bsmoss_%' OR table_schema IN ('vx_provision','local_authz','local_usage')");
      const expected=[];
      for (const model of schema.matchAll(/model \w+ \{([\s\S]*?)\n\}/g)) {
        const body=model[1],schemaName=body.match(/@@schema\("(\w+)"\)/)[1],table=body.match(/@@map\("(\w+)"\)/)[1];
        for(const field of body.matchAll(/^  (\w+) (String|DateTime|Decimal|Json|BigInt|Boolean)(\?)?([^\n]*)/gm)) {
          const name=field[4].match(/@map\("(\w+)"\)/)?.[1]??field[1];
          const found=actual.rows.find(c=>c.table_schema===schemaName&&c.table_name===table&&c.column_name===name);
          assert.ok(found,schemaName+"."+table+"."+name);
          assert.equal(found.data_type,field[4].includes("@db.Uuid")?"uuid":field[4].includes("@db.VarChar")?"character varying":{String:"text",DateTime:"timestamp with time zone",Decimal:"numeric",Json:"jsonb",BigInt:"bigint",Boolean:"boolean"}[field[2]]);
          assert.equal(found.is_nullable,field[3]?"YES":"NO");
          if(field[2]==="Decimal"){assert.equal(found.numeric_precision,30);assert.equal(found.numeric_scale,0);}
          expected.push(found);
        }
      }
      assert.equal(expected.length,actual.rowCount);
    });
    await db.query(`
      INSERT INTO bsmoss_resource.station VALUES ('w','st','Station','tower','610000','610100'),('other','foreign','Foreign','tower','610000','610100');
      INSERT INTO bsmoss_resource.operator_entity VALUES ('w','op','mobile','Operator');
      INSERT INTO bsmoss_resource.station_service VALUES ('w','svc','st','op','2026-01-01Z','2027-01-01Z');
      INSERT INTO bsmoss_integration.source VALUES ('w','src','Source','file'),('w','src2','Source2','file');
      INSERT INTO bsmoss_catalog.metric_version VALUES ('service.data.uplink_bytes',1,'business_service','interval_delta','byte','{}');
      INSERT INTO bsmoss_integration.source_mapping(workspace_id,id,source_id,external_type,external_id,station_id,version,valid_from,valid_to)
      VALUES ('w','map','src','station','external','st',1,'2026-01-01Z','2026-07-01Z');
      INSERT INTO bsmoss_views.template_version VALUES ('w','default',1,'workspace','{}','admin',now()),('w','default',2,'workspace','{}','admin',now());
    `);
    async function rejects(sql, code, args=[]) {
      await assert.rejects(db.query(sql,args),e => e.code === code);
    }
    const event = (id,source="src") => db.query("INSERT INTO bsmoss_integration.raw_event(workspace_id,source_id,event_id,revision,payload_sha256,payload_uri,occurred_at) VALUES ('w',$1,$2,1,$3,'fixture://payload','2026-02-01Z')",[source,id,"a".repeat(64)]);
    async function measurement(id, patch={}) {
      const row={workspace_id:"w",id,source_id:"src",event_id:"event",event_revision:"1",metric_code:"service.data.uplink_bytes",metric_version:"1",component_key:id,station_id:"st",mapping_id:"map",transform_version:"1",period_start:"2026-02-01T00:00:00Z",period_end:"2026-02-01T00:15:00Z",value_kind:"integer_delta",integer_value:"100",...patch};
      const keys=Object.keys(row); return db.query("INSERT INTO bsmoss_metering.measurement("+keys.join(",")+") VALUES ("+keys.map((_,i)=>"$"+(i+1)).join(",")+")",Object.values(row));
    }
    await t.test("composite foreign keys reject cross-workspace references",async()=>{
      await rejects("INSERT INTO bsmoss_resource.device VALUES ('w','dev','foreign','meter','tower')","23503");
    });
    await t.test("mapping interval overlap is rejected and adjacent windows are allowed",async()=>{
      const sql="INSERT INTO bsmoss_integration.source_mapping(workspace_id,id,source_id,external_type,external_id,station_id,version,valid_from,valid_to) VALUES ('w',$1,'src','station','external','st',1,$2,$3)";
      await rejects(sql,"23P01",["overlap","2026-06-01Z","2026-08-01Z"]);
      await db.query(sql,["adjacent","2026-07-01Z","2027-01-01Z"]);
    });
    await t.test("invalid service periods are rejected",async()=>{
      await rejects("INSERT INTO bsmoss_resource.station_service VALUES ('w','bad','st','op','2026-01-01Z','2026-01-01Z')","23514");
    });
    await t.test("concurrent source-event replay admits exactly one insert",async()=>{
      const a=new Client({connectionString:target.toString()}),b=new Client({connectionString:target.toString()}); peers.push(a,b);
      await Promise.all([a.connect(),b.connect()]);
      const sql="INSERT INTO bsmoss_integration.raw_event(workspace_id,source_id,event_id,revision,payload_sha256,payload_uri,occurred_at) VALUES ('w','src','race',1,$1,'fixture://payload','2026-02-01Z')";
      const results=await Promise.allSettled([a.query(sql,["a".repeat(64)]),b.query(sql,["a".repeat(64)])]);
      assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
      assert.equal(results.find(r=>r.status==="rejected").reason.code,"23505");
    });
    await event("event"); await event("second","src2");
    await t.test("measurement natural key rejects duplicate component under another id",async()=>{
      await measurement("m1"); await assert.rejects(measurement("m2",{component_key:"m1"}),e=>e.code==="23505");
    });
    await t.test("measurement cannot reference a mapping from a different source",async()=>{
      await assert.rejects(measurement("wrong-source",{source_id:"src2",event_id:"second"}),e=>e.code==="23503");
    });
    await t.test("typed values reject NULL loopholes, mixed variants and negative counters",async()=>{
      for(const patch of [{integer_value:null},{numerator:"1"},{integer_value:"-1"},{value_kind:"ratio_parts",integer_value:null,numerator:"11",denominator:"10"},{value_kind:"state_event",integer_value:null,state_value:"running",valid_until:null}]) {
        await assert.rejects(measurement(randomUUID(),patch),e=>e.code==="23514");
      }
    });
    await t.test("numeric boundary accepts 30 digits and rejects overflow",async()=>{
      await measurement("max",{integer_value:"9".repeat(30)});
      await assert.rejects(measurement("overflow",{integer_value:"1"+"0".repeat(30)}),e=>e.code==="22003");
    });
    await t.test("zero denominator and bounded state events have valid representations",async()=>{
      await measurement("zero-ratio",{value_kind:"ratio_parts",integer_value:null,numerator:"0",denominator:"0"});
      await measurement("state",{value_kind:"state_event",integer_value:null,state_value:"running",valid_until:"2026-02-01T00:15:00Z"});
    });
    await t.test("active capability requires validation evidence and object JSON",async()=>{
      await rejects("INSERT INTO bsmoss_integration.source_capability VALUES ('w','cap','src','service.data.uplink_bytes',1,'15m','active',NULL,'{}','2026-01-01Z','2027-01-01Z')","23514");
      await rejects("INSERT INTO bsmoss_catalog.metric_version VALUES ('invalid',1,'business_service','interval_delta','byte','[]')","23514");
    });
    await t.test("runtime can insert evidence but cannot modify or remove it",async()=>{
      await db.query("SET ROLE bsmoss_svc");
      try {
        await event("runtime");
        await rejects("UPDATE bsmoss_integration.raw_event SET payload_uri='changed' WHERE event_id='runtime'","42501");
        await rejects("DELETE FROM bsmoss_integration.raw_event WHERE event_id='runtime'","42501");
        await rejects("TRUNCATE bsmoss_integration.raw_event CASCADE","42501");
        await rejects("INSERT INTO bsmoss_catalog.metric_version VALUES ('forbidden',1,'business_service','interval_delta','byte','{}')","42501");
      } finally {await db.query("RESET ROLE");}
    });
    await t.test("runtime may move selection pointer but not anchor columns or published versions",async()=>{
      await db.query("SET ROLE bsmoss_svc");
      try {
        await db.query("INSERT INTO bsmoss_views.template_selection VALUES ('w','home','default',1,'user',now())");
        await db.query("UPDATE bsmoss_views.template_selection SET template_version=2,changed_by='reviewer',changed_at=now() WHERE workspace_id='w' AND scope_key='home'");
        await rejects("UPDATE bsmoss_views.template_selection SET workspace_id='other' WHERE scope_key='home'","42501");
        await rejects("UPDATE bsmoss_views.template_version SET definition='{}' WHERE code='default'","42501");
      } finally {await db.query("RESET ROLE");}
    });
    await t.test("revision chains cannot point forward and quality cannot reference a foreign tenant",async()=>{
      await rejects("INSERT INTO bsmoss_integration.raw_event VALUES ('w','src','event',2,3,$1,'fixture://payload','2026-02-01Z',now())","23514",["a".repeat(64)]);
      await rejects("INSERT INTO bsmoss_metering.quality_decision VALUES ('other','q','m1',1,'verified','1','fixture','reviewer',now())","23503");
    });
    await db.query(`
      INSERT INTO bsmoss_resource.network_object VALUES ('w','cell','st','svc','cell');
      INSERT INTO bsmoss_resource.device VALUES ('w','device','st','radio','tower');
      INSERT INTO bsmoss_integration.source_mapping(workspace_id,id,source_id,external_type,external_id,station_id,service_id,network_object_id,device_id,version,valid_from,valid_to)
      VALUES ('w','cell-map','src','cell','c1','st','svc','cell',NULL,1,'2026-01-01Z','2027-01-01Z'),
      ('w','device-map','src','device','d1','st',NULL,NULL,'device',1,'2026-01-01Z','2027-01-01Z');
    `);
    for (const code of ['status.voice.connection_rate','runtime.energy.site_wh','runtime.device.state']) {
      const m=FIRST_METRICS.get({code,version:1});
      await db.query("INSERT INTO bsmoss_catalog.metric_version VALUES ($1,1,$2,$3,$4,'{}')",[code,m.category,m.semantic,m.unit]);
    }
    adapterPool=new pg.Pool({connectionString:target.toString(),options:"-c role=bsmoss_svc",max:4});
    const aggTime = minutes => new Date(Date.parse('2026-10-25T00:00:00+08:00') + minutes * 60000).toISOString();
    const aggPlan = { workspaceId:'w',sourceId:'src',subjectKey:'st/svc/cell',authorityVersion:'authority-1',
      metric:{code:'service.data.uplink_bytes',version:1},inputMode:'direct',grain:'hour',nativeGrain:'15m',
      period:{start:aggTime(0),end:aggTime(60)},watermark:aggTime(60),sourceComplete:true };
    const aggScope = {workspaceId:'w',series:[{sourceId:'src',subjectKey:aggPlan.subjectKey,metricKey:'service.data.uplink_bytes@1'},
      {sourceId:'src',subjectKey:aggPlan.subjectKey,metricKey:'status.voice.connection_rate@1'}]};
    const aggregates = new PgAggregateStore(adapterPool,aggScope);
    const aggRows = (value='10') => Array.from({length:4},(_,i)=>({workspaceId:'w',sourceId:'src',subjectKey:aggPlan.subjectKey,
      metric:aggPlan.metric,eventId:'agg-'+i,componentKey:'uplink',revision:'1',qualityRevision:'1',quality:'verified',
      payloadSha256:'a'.repeat(64),mappingVersion:'1',transformVersion:'1',period:{start:aggTime(i*15),end:aggTime((i+1)*15)},value:{kind:'integer_delta',value}}));
    let aggregateId, firstPublisher;
    await t.test('aggregate concurrent replay saves one immutable result, manifest and outbox event',async()=>{
      const rows=aggRows(), outcomes=await Promise.all([aggregates.publish(aggPlan,rows,null,'worker'),aggregates.publish(aggPlan,[...rows].reverse(),null,'retry-worker')]);
      assert.deepEqual(outcomes.map(r=>r.status).sort(),['duplicate','inserted']);
      assert.equal(new Set(outcomes.map(r=>r.seriesId)).size,1); aggregateId=outcomes[0].seriesId;
      const current=await aggregates.current(aggPlan);
      firstPublisher=current.publishedBy;
      assert.equal(current.revision,'1'); assert.deepEqual(current.result.value,{kind:'integer',value:'40'});
      const saved=(await db.query('SELECT input_manifest FROM bsmoss_analysis.aggregate_revision WHERE series_id=$1',[aggregateId])).rows[0];
      assert.deepEqual(aggregateIntervals(saved.input_manifest.plan,saved.input_manifest.inputs),current.result);
      assert.equal((await db.query('SELECT 1 FROM bsmoss_analysis.aggregate_outbox WHERE series_id=$1',[aggregateId])).rowCount,1);
    });
    await t.test('aggregate correction keeps history and old retries never rewind the current result',async()=>{
      const changed=aggRows('20').map(r=>({...r,revision:'2',payloadSha256:'b'.repeat(64)}));
      const second=await aggregates.publish(aggPlan,changed,'1','review-worker');
      assert.equal(second.revision,'2');
      const replay=await aggregates.publish(aggPlan,aggRows(),'1','old-worker');
      assert.equal(replay.status,'duplicate'); assert.equal(replay.revision,'1'); assert.equal(replay.currentRevision,'2');
      const old=await aggregates.readRevision(aggPlan,'1'),current=await aggregates.current(aggPlan);
      assert.deepEqual(old.result.value,{kind:'integer',value:'40'}); assert.equal(old.publishedBy,firstPublisher);
      assert.deepEqual(current.result.value,{kind:'integer',value:'80'}); assert.equal(current.publishedBy,'review-worker');
      assert.equal(await aggregates.readRevision(aggPlan,'99'),null);
      await assert.rejects(aggregates.publish(aggPlan,aggRows('30'),'1','stale-worker'),/aggregate_revision_conflict/);
      assert.equal((await db.query('SELECT 1 FROM bsmoss_analysis.aggregate_revision WHERE series_id=$1',[aggregateId])).rowCount,2);
      assert.equal((await db.query('SELECT 1 FROM bsmoss_analysis.aggregate_outbox WHERE series_id=$1',[aggregateId])).rowCount,2);
    });
    await t.test('aggregate concurrent corrections admit one expected-head writer',async()=>{
      const outcomes=await Promise.allSettled([aggregates.publish(aggPlan,aggRows('31'),'2','writer-a'),aggregates.publish(aggPlan,aggRows('32'),'2','writer-b')]);
      assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);
      assert.match(outcomes.find(r=>r.status==='rejected').reason.message,/aggregate_revision_conflict/);
      assert.equal((await aggregates.current(aggPlan)).revision,'3');
      assert.equal((await db.query('SELECT 1 FROM bsmoss_analysis.aggregate_outbox WHERE series_id=$1',[aggregateId])).rowCount,3);
    });
    await t.test('aggregate outbox failure rolls back the revision and pointer together',async()=>{
      await db.query(`CREATE FUNCTION bsmoss_analysis.reject_fixture_outbox() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'outbox fixture failure'; END $$;
        CREATE TRIGGER reject_fixture_outbox BEFORE INSERT ON bsmoss_analysis.aggregate_outbox FOR EACH ROW EXECUTE FUNCTION bsmoss_analysis.reject_fixture_outbox();`);
      try {
        await assert.rejects(aggregates.publish(aggPlan,aggRows('99'),'3','worker'),/outbox fixture failure/);
        assert.equal((await aggregates.current(aggPlan)).revision,'3');
        assert.equal((await db.query('SELECT 1 FROM bsmoss_analysis.aggregate_revision WHERE series_id=$1',[aggregateId])).rowCount,3);
        const newPlan={...aggPlan,period:{start:aggTime(60),end:aggTime(120)},watermark:aggTime(120)};
        await assert.rejects(aggregates.publish(newPlan,[],null,'worker'),/outbox fixture failure/);
        assert.equal(await aggregates.current(newPlan),null);
        assert.equal((await db.query('SELECT 1 FROM bsmoss_analysis.aggregate_series WHERE period_start=$1',[aggTime(60)])).rowCount,0);
      } finally {await db.query('DROP TRIGGER reject_fixture_outbox ON bsmoss_analysis.aggregate_outbox; DROP FUNCTION bsmoss_analysis.reject_fixture_outbox()');}
    });
    await t.test('aggregate typed snapshots round-trip ratios, zero, missing and partial values',async()=>{
      const ratioPlan={...aggPlan,metric:{code:'status.voice.connection_rate',version:1}};
      const rows=aggRows().map(r=>({...r,metric:ratioPlan.metric,value:{kind:'ratio_parts',numerator:'9',denominator:'10'}}));
      await aggregates.publish(ratioPlan,rows,null,'worker');
      assert.deepEqual((await aggregates.current(ratioPlan)).result.value,{kind:'ratio',numerator:'36',denominator:'40'});
      await aggregates.publish(ratioPlan,rows.map(r=>({...r,value:{kind:'ratio_parts',numerator:'0',denominator:'0'}})),'1','worker');
      assert.equal((await aggregates.current(ratioPlan)).result.value,null);
      await aggregates.publish(aggPlan,aggRows('0'),'3','worker');
      assert.deepEqual((await aggregates.current(aggPlan)).result.value,{kind:'integer',value:'0'});
      await aggregates.publish(aggPlan,[],'4','worker');
      assert.equal((await aggregates.current(aggPlan)).result.completeness,'missing');
      await aggregates.publish(aggPlan,aggRows().slice(0,1),'5','worker');
      assert.equal((await aggregates.current(aggPlan)).result.completeness,'partial');
    });
    await t.test('aggregate reads isolate tenant and explicit source/subject/metric triples',async()=>{
      assert.equal(await new PgAggregateStore(adapterPool,{...aggScope,workspaceId:'other'}).current(aggPlan),null);
      for(const patch of [{sourceId:'src2'},{subjectKey:'foreign'},{metric:{code:'runtime.energy.site_wh',version:1}}]) {
        await assert.rejects(aggregates.current({...aggPlan,...patch}),/aggregate_scope_denied/);
      }
      const finite={workspaceId:'w',series:[...aggScope.series]};
      const snapshot=new PgAggregateStore(adapterPool,finite);
      finite.series[0]={...finite.series[0],subjectKey:'foreign'};
      await assert.rejects(snapshot.current({...aggPlan,subjectKey:'foreign'}),/aggregate_scope_denied/);
      assert.ok(await snapshot.current(aggPlan));
    });
    await t.test('runtime cannot rewrite aggregate revisions, events or series anchors',async()=>{
      for(const sql of ["UPDATE bsmoss_analysis.aggregate_revision SET published_by='changed'",'DELETE FROM bsmoss_analysis.aggregate_revision',
        'TRUNCATE bsmoss_analysis.aggregate_revision CASCADE',"UPDATE bsmoss_analysis.aggregate_outbox SET event_type='changed'",'DELETE FROM bsmoss_analysis.aggregate_outbox',
        "UPDATE bsmoss_analysis.aggregate_series SET workspace_id='other'",'DELETE FROM bsmoss_analysis.aggregate_series']) {
        await assert.rejects(adapterPool.query(sql),e=>e.code==='42501');
      }
    });
    await t.test('aggregate constraints reject typed null loopholes, payload mismatch and cross-tenant references',async()=>{
      const copy=`INSERT INTO bsmoss_analysis.aggregate_revision(workspace_id,series_id,revision,input_fingerprint,aggregation_version,watermark,completeness,
        value_kind,integer_value,numerator,denominator,result_payload,input_manifest,published_by)
        SELECT workspace_id,series_id,99,$2,aggregation_version,watermark,completeness,$3,$4,$5,$6,$7,input_manifest,published_by
        FROM bsmoss_analysis.aggregate_revision WHERE series_id=$1 AND revision=1`;
      const payload=(await aggregates.readRevision(aggPlan,'1')).result, hash='f'.repeat(64);
      for(const [kind,v,n,d,result] of [['integer',null,null,null,payload],['integer','-1',null,null,payload],
        ['ratio',null,'1','0',payload],['ratio',null,'11','10',payload],['integer','40',null,null,{...payload,value:{kind:'integer',value:'999'}}],
        ['integer','40',null,null,{...payload,inputFingerprint:hash,workspaceId:'other'}]]) {
        await rejects(copy,'23514',[aggregateId,hash,kind,v,n,d,JSON.stringify({...result,inputFingerprint:hash})]);
      }
      await rejects("INSERT INTO bsmoss_analysis.aggregate_outbox VALUES ('other','bad',$1,1,'aggregate.revised',now())",'23503',[aggregateId]);
      await rejects("UPDATE bsmoss_analysis.aggregate_series SET current_revision=99 WHERE id=$1",'23503',[aggregateId]);
      assert.equal((await db.query("SELECT 1 FROM local_authz.permission WHERE perm_code='metering.aggregate'")).rowCount,1);
    });
    const provision = new PgProvisioningStore(adapterPool);
    const provisionEvent = { id: 'provision-1', type: 'tenant.provisioned', seq: 1, workspace_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', application: 'bsmoss' };
    await t.test('provisioning serializes concurrent deliveries and never regresses a sequence', async () => {
      const result = await Promise.all([handleProvisioning(provisionEvent,{store:provision,product:'bsmoss'}),handleProvisioning(provisionEvent,{store:provision,product:'bsmoss'})]);
      assert.equal(result.filter(r=>r.handled).length,1);
      await handleProvisioning({...provisionEvent,id:'provision-3',seq:3,type:'tenant.deprovisioned'},{store:provision,product:'bsmoss'});
      const stale=await handleProvisioning({...provisionEvent,id:'provision-2',seq:2},{store:provision,product:'bsmoss'});
      assert.equal(stale.reason,'stale');
      assert.equal((await db.query('SELECT status FROM vx_provision.app_instance WHERE workspace_id=$1',[provisionEvent.workspace_id])).rows[0].status,'deprovisioned');
    });
    await t.test('provisioning rolls back state, delivery and watermark before running external effects', async () => {
      let effects=0;
      const broken={...provisionEvent,id:'x'.repeat(129),seq:4};
      await assert.rejects(handleProvisioning(broken,{store:provision,product:'bsmoss',onProvisioned:()=>{effects++;}}));
      assert.equal(effects,0);
      assert.equal(await provision.getLastSeq(provisionEvent.workspace_id,'bsmoss'),3);
      assert.equal((await db.query('SELECT status FROM vx_provision.app_instance WHERE workspace_id=$1',[provisionEvent.workspace_id])).rows[0].status,'deprovisioned');
    });
    await t.test('runtime cannot rewrite provisioning anchors, delivery history, local grants or usage buffers', async () => {
      for(const sql of ["UPDATE vx_provision.app_instance SET workspace_id=gen_random_uuid()", "DELETE FROM vx_provision.webhook_delivery", "INSERT INTO local_authz.role(role_code,name) VALUES ('forbidden','Forbidden')", "INSERT INTO local_usage.raw(workspace_id,metric,amount,idempotency_key) VALUES (gen_random_uuid(),'forbidden',1,'forbidden')"]) {
        await assert.rejects(adapterPool.query(sql),e=>e.code==='42501');
      }
    });
    await t.test('local grants require explicit membership, product permission and finite expiring scope', async () => {
      const ws=provisionEvent.workspace_id;
      const member=(await db.query("INSERT INTO local_authz.member(workspace_id,sub) VALUES($1,'usr_test') RETURNING id",[ws])).rows[0].id;
      assert.equal(await readPgGrant(adapterPool,ws,'usr_test'),null);
      const finite={workspaceId:ws,sourceIds:['src'],stationIds:['st'],metricKeys:['runtime.energy.site_wh@1'],serviceIds:[],deviceIds:[],allowSiteParameters:true};
      await db.query("INSERT INTO local_authz.data_scope(workspace_id,member_id,scope,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')",[ws,member,finite]);
      const role=(await db.query("INSERT INTO local_authz.role(role_code,name) VALUES('analyst','Analyst') RETURNING id")).rows[0].id;
      await db.query('INSERT INTO local_authz.member_role(member_id,role_id) VALUES($1,$2)',[member,role]);
      await db.query("INSERT INTO local_authz.role_permission(role_id,permission_id) SELECT $1,id FROM local_authz.permission WHERE perm_code='metering.view'",[role]);
      const grant=await readPgGrant(adapterPool,ws,'usr_test');
      assert.deepEqual(grant.permissions,['metering.view']);assert.deepEqual(grant.scope,finite);assert.ok(grant.expiresAt>Date.now());
      assert.equal(await readPgGrant(adapterPool,'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','usr_test'),null);
      await db.query("UPDATE local_authz.member SET status='inactive' WHERE id=$1",[member]);
      assert.equal((await readPgGrant(adapterPool,ws,'usr_test')).active,false);
      await assert.rejects(db.query('INSERT INTO local_authz.data_scope(workspace_id,member_id,scope,expires_at) VALUES($1,$2,$3,now())',['bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',member,finite]),e=>e.code==='23503');
    });
    const scope={workspaceId:'w',sourceIds:['src'],stationIds:['st'],metricKeys:FIRST_METRICS.list().map(m=>m.code+'@'+m.version),serviceIds:['svc'],deviceIds:['device'],allowSiteParameters:true};
    const store=new PgMeasurementStore(adapterPool,scope,FIRST_METRICS);
    const draft=(eventId,patch={})=>({workspaceId:'w',sourceId:'src',eventId,revision:'1',previousRevision:null,
      payloadSha256:'b'.repeat(64),payloadUri:'fixture://adapter',occurredAt:'2026-02-01T08:00:00+08:00',
      metric:{code:'service.data.uplink_bytes',version:1},componentKey:'uplink',stationId:'st',mappingId:'cell-map',
      transformVersion:'1',periodStart:'2026-02-01T00:00:00Z',periodEnd:'2026-02-01T00:15:00Z',
      value:{kind:'integer_delta',value:'100'},quality:{status:'verified',reason:'fixture',ruleVersion:'1',decidedBy:'worker'},...patch});
    const filter={stationId:'st',metric:{code:'service.data.uplink_bytes',version:1},from:'2026-02-01T00:00:00Z',to:'2026-02-02T00:00:00Z',limit:200};
    await t.test('adapter runs as runtime role, persists atomically and normalizes equivalent replays',async()=>{
      const role=await adapterPool.query('SELECT current_user'); assert.equal(role.rows[0].current_user,'bsmoss_svc');
      const first=await store.append(draft('adapter-one'));
      const replay=await store.append(draft('adapter-one',{occurredAt:'2026-02-01T00:00:00.000Z'}));
      assert.equal(first.status,'inserted'); assert.deepEqual(replay,{id:first.id,status:'duplicate'});
    });
    await t.test('adapter rejects raw, measurement and initial quality conflicts without overwrites',async()=>{
      await assert.rejects(store.append(draft('adapter-one',{payloadSha256:'c'.repeat(64)})),/conflicting_replay/);
      await assert.rejects(store.append(draft('adapter-one',{value:{kind:'integer_delta',value:'101'}})),/conflicting_replay/);
      await assert.rejects(store.append(draft('adapter-one',{quality:{status:'pending',reason:'changed',ruleVersion:'1',decidedBy:'worker'}})),/conflicting_replay/);
      const row=(await store.list(filter)).items.find(r=>r.draft.eventId==='adapter-one');
      assert.equal(row.draft.value.value,'100'); assert.equal(row.draft.quality.status,'verified');
    });
    await t.test('adapter handles concurrent identical requests with one result id',async()=>{
      const outcomes=await Promise.all([store.append(draft('adapter-race')),store.append(draft('adapter-race'))]);
      assert.deepEqual(outcomes.map(r=>r.status).sort(),['duplicate','inserted']);
      assert.equal(new Set(outcomes.map(r=>r.id)).size,1);
    });
    await t.test('adapter rejects one conflicting concurrent request and preserves event revision history',async()=>{
      const outcomes=await Promise.allSettled([store.append(draft('adapter-conflict')),store.append(draft('adapter-conflict',{value:{kind:'integer_delta',value:'200'}}))]);
      assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);
      assert.match(outcomes.find(r=>r.status==='rejected').reason.message,/conflicting_replay/);
      await store.append(draft('adapter-revision'));
      await store.append(draft('adapter-revision',{revision:'2',previousRevision:'1',payloadSha256:'c'.repeat(64),value:{kind:'integer_delta',value:'150'}}));
      const revisions=(await store.list(filter)).items.filter(r=>r.draft.eventId==='adapter-revision');
      assert.equal(revisions.length,2);
      assert.deepEqual(revisions.map(r=>r.draft.revision).sort(),['1','2']);
    });
    await t.test('adapter rolls back both evidence and measurement on a quality-write failure',async()=>{
      await db.query(`CREATE FUNCTION bsmoss_metering.reject_fixture_quality() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.reason='force_failure' THEN RAISE EXCEPTION 'fixture failure'; END IF; RETURN NEW; END $$;
        CREATE TRIGGER reject_fixture_quality BEFORE INSERT ON bsmoss_metering.quality_decision FOR EACH ROW EXECUTE FUNCTION bsmoss_metering.reject_fixture_quality();`);
      try {
        await assert.rejects(store.append(draft('adapter-rollback',{quality:{status:'verified',reason:'force_failure',ruleVersion:'1',decidedBy:'worker'}})),/fixture failure/);
        assert.equal((await db.query("SELECT 1 FROM bsmoss_integration.raw_event WHERE event_id='adapter-rollback'")).rowCount,0);
        assert.equal((await db.query("SELECT 1 FROM bsmoss_metering.measurement WHERE event_id='adapter-rollback'")).rowCount,0);
      } finally {await db.query('DROP TRIGGER reject_fixture_quality ON bsmoss_metering.quality_decision; DROP FUNCTION bsmoss_metering.reject_fixture_quality()');}
    });
    await t.test('adapter round-trips ratio, state, energy and full-precision counters',async()=>{
      await store.append(draft('adapter-ratio',{metric:{code:'status.voice.connection_rate',version:1},value:{kind:'ratio_parts',numerator:'0',denominator:'0'}}));
      await store.append(draft('adapter-state',{metric:{code:'runtime.device.state',version:1},mappingId:'device-map',value:{kind:'state_event',state:'running',validUntil:'2026-02-01T00:15:00Z'}}));
      await store.append(draft('adapter-energy',{metric:{code:'runtime.energy.site_wh',version:1},mappingId:'map',value:{kind:'integer_delta',value:'9'.repeat(30)}}));
      for(const [code,eventId] of [['status.voice.connection_rate','adapter-ratio'],['runtime.device.state','adapter-state'],['runtime.energy.site_wh','adapter-energy']]) {
        const row=(await store.list({...filter,metric:{code,version:1}})).items.find(r=>r.draft.eventId===eventId);
        assert.ok(row);
        if(code.endsWith('site_wh')) assert.equal(row.draft.value.value,'9'.repeat(30));
        if(code.endsWith('state')) assert.equal(row.draft.value.validUntil,'2026-02-01T00:15:00.000Z');
        if(code.endsWith('connection_rate')) assert.equal(row.draft.value.denominator,'0');
      }
    });
    await t.test('adapter bounds queries, paginates without duplicates and isolates trusted scopes',async()=>{
      const first=await store.list({...filter,limit:1}); assert.equal(first.items.length,1); assert.ok(first.nextAfterId);
      const second=await store.list({...filter,limit:1,afterId:first.nextAfterId}); assert.notEqual(first.items[0].id,second.items[0].id);
      assert.equal((await new PgMeasurementStore(adapterPool,{...scope,workspaceId:'other'},FIRST_METRICS).list(filter)).items.length,0);
      assert.equal((await new PgMeasurementStore(adapterPool,{...scope,sourceIds:[]},FIRST_METRICS).list(filter)).items.length,0);
      assert.equal((await new PgMeasurementStore(adapterPool,{...scope,serviceIds:[]},FIRST_METRICS).list(filter)).items.length,0);
      await assert.rejects(new PgMeasurementStore(adapterPool,{...scope,metricKeys:[]},FIRST_METRICS).list(filter),/metric_scope_denied/);
      const operatorStore=new PgMeasurementStore(adapterPool,{...scope,deviceIds:[],allowSiteParameters:false},FIRST_METRICS);
      assert.equal((await operatorStore.list({...filter,metric:{code:'runtime.device.state',version:1}})).items.length,0);
      await assert.rejects(operatorStore.append(draft('no-physical',{metric:{code:'runtime.energy.site_wh',version:1},mappingId:'map'})),/object_scope_denied/);
      await assert.rejects(store.append(draft('wrong-workspace',{workspaceId:'other'})),/workspace_mismatch/);
      await assert.rejects(store.append(draft('wrong-source',{sourceId:'src2'})),/scope_denied/);
      await assert.rejects(store.list({...filter,stationId:'foreign'}),/scope_denied/);
      await assert.rejects(store.list({...filter,limit:201}),/invalid_query_window/);
    });
    await t.test('adapter rejects expired mappings and wrong object semantics before committing evidence',async()=>{
      await assert.rejects(store.append(draft('late',{periodStart:'2027-02-01T00:00:00Z',periodEnd:'2027-02-01T00:15:00Z'})),/mapping_not_effective/);
      await assert.rejects(store.append(draft('bad-object',{metric:{code:'runtime.energy.site_wh',version:1}})),/mapping_object_mismatch/);
      await assert.rejects(store.append(draft('fraction',{value:{kind:'integer_delta',value:'0.5'}})),/invalid_integer/);
      assert.equal((await db.query("SELECT 1 FROM bsmoss_integration.raw_event WHERE event_id IN ('late','bad-object','fraction')")).rowCount,0);
    });
    await db.query(`INSERT INTO bsmoss_resource.network_object VALUES ('w','snapshot-cell','st','svc','cell');
      INSERT INTO bsmoss_integration.source_mapping(workspace_id,id,source_id,external_type,external_id,station_id,service_id,network_object_id,version,valid_from,valid_to)
      VALUES ('w','snapshot-map','src','cell','snapshot-external','st','svc','snapshot-cell',1,'2026-01-01Z','2027-01-01Z');`);
    const snapshotReader=new PgAggregateSnapshotReader(adapterPool,scope);
    const snapshotTarget={sourceId:'src',mappingId:'snapshot-map',metric:{code:'service.data.uplink_bytes',version:1},grain:'hour',at:'2026-02-01T08:30:00+08:00'};
    const snapshotTime=minutes=>new Date(Date.parse('2026-02-01T00:00:00Z')+minutes*60000).toISOString();
    const snapshotDraft=(slot,patch={})=>draft('snapshot-'+slot,{mappingId:'snapshot-map',periodStart:snapshotTime(slot*15),periodEnd:snapshotTime((slot+1)*15),value:{kind:'integer_delta',value:'10'},...patch});
    const capabilityPolicy={intervalAggregation:{version:1,inputMode:'direct',authorityRef:'fixture://reviewed-source-authority'}};
    const snapshotPorts={
      async readVerifiedIdentity(){return {sub:'snapshot-worker',activeWorkspace:'w',accountStatus:'active',governanceRoles:[],expiresAt:Date.now()+60000};},
      async readCoverage(){return {workspaceId:'w',product:'bsmoss',tier:'fixture',bundled:false,expiresAt:Date.now()+60000};},
      async readLocalGrant(){return {workspaceId:'w',sub:'snapshot-worker',active:true,permissions:['metering.aggregate'],scope,expiresAt:Date.now()+60000};},
      featuresFor(){return ['metering'];}
    };
    const snapshotApi=createAuthorizedAggregates(snapshotPorts,{
      reader:finite=>new PgAggregateSnapshotReader(adapterPool,finite),store:finite=>new PgAggregateStore(adapterPool,finite)
    },'interactive');
    await t.test('snapshot requires an active reviewed capability and never infers authority from sample rows',async()=>{
      await assert.rejects(snapshotReader.load(snapshotTarget),/aggregate_capability_unavailable_or_ambiguous/);
      await db.query(`INSERT INTO bsmoss_integration.source_capability VALUES ('w','snapshot-cap','src','service.data.uplink_bytes',1,'15m','active','fixture://validation','{}','2026-01-01Z','2027-01-01Z')`);
      await assert.rejects(snapshotReader.load(snapshotTarget),/aggregate_policy_required/);
      await db.query("UPDATE bsmoss_integration.source_capability SET rules=$1 WHERE id='snapshot-cap'",[capabilityPolicy]);
    });
    await t.test('scoped snapshot reads database evidence and authorized orchestration publishes a reproducible preliminary revision',async()=>{
      for(let i=0;i<4;i++) await store.append(snapshotDraft(i));
      const snapshot=await snapshotReader.load(snapshotTarget),result=aggregateIntervals(snapshot.plan,snapshot.inputs);
      assert.equal(snapshot.inputs.length,4); assert.equal(snapshot.plan.sourceComplete,false); assert.equal(snapshot.plan.watermark,snapshotTime(0));
      assert.deepEqual(result.value,{kind:'integer',value:'40'}); assert.equal(result.completeness,'preliminary');
      assert.equal(snapshot.plan.subjectKey,JSON.stringify(['mapped-object-v1','st','svc','snapshot-cell',null]));
      const first=await snapshotApi.recompute({...snapshotTarget,expectedRevision:null});
      const replay=await snapshotApi.recompute({...snapshotTarget,expectedRevision:null});
      assert.equal(first.status,'inserted');assert.equal(replay.status,'duplicate');assert.equal(first.seriesId,replay.seriesId);
      const saved=(await db.query('SELECT result_payload,input_manifest,published_by FROM bsmoss_analysis.aggregate_revision WHERE series_id=$1 AND revision=1',[first.seriesId])).rows[0];
      assert.deepEqual(saved.result_payload,result);assert.equal(saved.published_by,'snapshot-worker');
      assert.deepEqual(aggregateIntervals(saved.input_manifest.plan,saved.input_manifest.inputs),result);
    });
    await t.test('latest quality revocation overrides initial verification and generates a new aggregate revision',async()=>{
      const measurementId=(await db.query("SELECT id FROM bsmoss_metering.measurement WHERE event_id='snapshot-0'")).rows[0].id;
      await db.query("INSERT INTO bsmoss_metering.quality_decision VALUES ('w','snapshot-revoke',$1,2,'rejected','2','fixture revocation','reviewer',now())",[measurementId]);
      const snapshot=await snapshotReader.load(snapshotTarget),result=aggregateIntervals(snapshot.plan,snapshot.inputs);
      const revoked=snapshot.inputs.find(r=>r.eventId==='snapshot-0');
      assert.equal(revoked.qualityRevision,'2');assert.equal(revoked.quality,'rejected');
      assert.equal(result.validWindows,3);assert.equal(result.completeness,'partial');assert.ok(result.reasons.includes('rejected_quality'));
      assert.equal((await snapshotApi.recompute({...snapshotTarget,expectedRevision:'1'})).revision,'2');
    });
    await t.test('snapshot repeatable-read keeps metadata and quality on one database snapshot',async()=>{
      const measurementId=(await db.query("SELECT id FROM bsmoss_metering.measurement WHERE event_id='snapshot-1'")).rows[0].id;
      let injected=false;
      const interceptedPool={async connect(){
        const client=await adapterPool.connect();
        return {async query(sql,args){const result=await client.query(sql,args);
          if(!injected && sql.includes('SELECT m.*,n.kind')) {
            injected=true;
            await db.query("INSERT INTO bsmoss_metering.quality_decision VALUES ('w','snapshot-concurrent-quality',$1,2,'pending','2','fixture concurrent','reviewer',now())",[measurementId]);
          }
          return result;
        },release(discard){client.release(discard);}};
      }};
      const sameSnapshot=await new PgAggregateSnapshotReader(interceptedPool,scope).load(snapshotTarget);
      assert.equal(injected,true);
      assert.equal(sameSnapshot.inputs.find(r=>r.eventId==='snapshot-1').qualityRevision,'1');
      const nextSnapshot=await snapshotReader.load(snapshotTarget);
      assert.equal(nextSnapshot.inputs.find(r=>r.eventId==='snapshot-1').qualityRevision,'2');
      assert.equal(nextSnapshot.inputs.find(r=>r.eventId==='snapshot-1').quality,'pending');
    });
    await t.test('latest fact revisions moved to a different window or mapping retract older evidence',async()=>{
      await store.append(snapshotDraft(1,{revision:'2',previousRevision:'1',payloadSha256:'c'.repeat(64),periodStart:snapshotTime(60),periodEnd:snapshotTime(75)}));
      await store.append(snapshotDraft(2,{revision:'2',previousRevision:'1',payloadSha256:'c'.repeat(64),mappingId:'cell-map'}));
      await store.append(snapshotDraft(3,{revision:'2',previousRevision:'1',payloadSha256:'c'.repeat(64),quality:{status:'pending',reason:'fixture pending',ruleVersion:'2',decidedBy:'worker'}}));
      const snapshot=await snapshotReader.load(snapshotTarget);
      assert.deepEqual(snapshot.inputs.map(r=>r.eventId).sort(),['snapshot-0','snapshot-3']);
      assert.equal(snapshot.inputs.find(r=>r.eventId==='snapshot-3').revision,'2');
      const result=aggregateIntervals(snapshot.plan,snapshot.inputs);
      assert.equal(result.value,null);assert.equal(result.completeness,'missing');assert.ok(result.reasons.includes('pending_quality'));
    });
    await t.test('snapshot enforces tenant, station, service, physical-object and metric scopes',async()=>{
      await assert.rejects(new PgAggregateSnapshotReader(adapterPool,{...scope,workspaceId:'other'}).load(snapshotTarget),/aggregate_mapping_unavailable/);
      await assert.rejects(new PgAggregateSnapshotReader(adapterPool,{...scope,stationIds:[]}).load(snapshotTarget),/aggregate_mapping_unavailable/);
      await assert.rejects(new PgAggregateSnapshotReader(adapterPool,{...scope,serviceIds:[]}).load(snapshotTarget),/object_scope_denied/);
      await assert.rejects(new PgAggregateSnapshotReader(adapterPool,{...scope,sourceIds:[]}).load(snapshotTarget),/aggregate_scope_denied/);
      await assert.rejects(new PgAggregateSnapshotReader(adapterPool,{...scope,allowSiteParameters:false}).load({...snapshotTarget,mappingId:'map',metric:{code:'runtime.energy.site_wh',version:1}}),/object_scope_denied/);
      await assert.rejects(snapshotReader.load({...snapshotTarget,metric:{code:'runtime.energy.site_wh',version:1}}),/mapping_object_mismatch/);
    });
    await t.test('snapshot fails closed on capability overlap, lifecycle and incomplete validity boundaries',async()=>{
      await db.query(`INSERT INTO bsmoss_integration.source_mapping(workspace_id,id,source_id,external_type,external_id,station_id,service_id,network_object_id,version,valid_from,valid_to)
        VALUES ('w','snapshot-alias','src','cell','snapshot-alias','st','svc','snapshot-cell',1,'2026-01-01Z','2027-01-01Z')`);
      await assert.rejects(snapshotReader.load(snapshotTarget),/aggregate_subject_mapping_ambiguous/);
      await db.query("DELETE FROM bsmoss_integration.source_mapping WHERE id='snapshot-alias'");
      await db.query(`INSERT INTO bsmoss_integration.source_capability VALUES ('w','snapshot-ambiguous','src','service.data.uplink_bytes',1,'15m','active','fixture://validation',$1,'2026-01-01Z','2027-01-01Z')`,[capabilityPolicy]);
      await assert.rejects(snapshotReader.load(snapshotTarget),/aggregate_capability_unavailable_or_ambiguous/);
      await db.query("DELETE FROM bsmoss_integration.source_capability WHERE id='snapshot-ambiguous'");
      await db.query("UPDATE bsmoss_integration.source_capability SET status='validated' WHERE id='snapshot-cap'");
      await assert.rejects(snapshotReader.load(snapshotTarget),/aggregate_capability_unavailable_or_ambiguous/);
      await db.query("UPDATE bsmoss_integration.source_capability SET status='active',valid_from=$1 WHERE id='snapshot-cap'",[snapshotTime(15)]);
      await assert.rejects(snapshotReader.load(snapshotTarget),/aggregate_capability_boundary/);
      await db.query("UPDATE bsmoss_integration.source_capability SET valid_from='2026-01-01Z' WHERE id='snapshot-cap'");
      await db.query("UPDATE bsmoss_integration.source_mapping SET valid_from=$1 WHERE id='snapshot-map'",[snapshotTime(15)]);
      await assert.rejects(snapshotReader.load(snapshotTarget),/aggregate_mapping_gap/);
      await db.query("UPDATE bsmoss_integration.source_mapping SET valid_from='2026-01-01Z' WHERE id='snapshot-map'");
      await db.query("UPDATE bsmoss_resource.station_service SET valid_from=$1 WHERE id='svc'",[snapshotTime(15)]);
      await assert.rejects(snapshotReader.load(snapshotTarget),/unexpected_or_coarse_window/);
      await db.query("UPDATE bsmoss_resource.station_service SET valid_from='2026-01-01Z' WHERE id='svc'");
    });
    await t.test('snapshot rejects coarse/straddling evidence and missing quality instead of silently dropping it',async()=>{
      await store.append(snapshotDraft(3,{revision:'3',previousRevision:'2',payloadSha256:'d'.repeat(64),periodStart:snapshotTime(50),periodEnd:snapshotTime(65)}));
      await assert.rejects(snapshotReader.load(snapshotTarget),/unexpected_or_coarse_window/);
      await store.append(snapshotDraft(3,{revision:'4',previousRevision:'3',payloadSha256:'e'.repeat(64)}));
      await db.query("DELETE FROM bsmoss_metering.quality_decision WHERE measurement_id IN (SELECT id FROM bsmoss_metering.measurement WHERE event_id='snapshot-3' AND event_revision=4)");
      await assert.rejects(snapshotReader.load(snapshotTarget),/quality_decision_required/);
    });
    await t.test('snapshot supports direct ratio evidence and preserves numerator/denominator through orchestration',async()=>{
      const metric={code:'status.voice.connection_rate',version:1};
      await db.query(`INSERT INTO bsmoss_integration.source_capability VALUES ('w','snapshot-ratio-cap','src','status.voice.connection_rate',1,'15m','active','fixture://validation',$1,'2026-01-01Z','2027-01-01Z')`,[capabilityPolicy]);
      for(let i=0;i<4;i++) await store.append(draft('snapshot-ratio-'+i,{mappingId:'snapshot-map',metric,
        periodStart:snapshotTime(i*15),periodEnd:snapshotTime((i+1)*15),value:{kind:'ratio_parts',numerator:'9',denominator:'10'}}));
      const target={...snapshotTarget,metric};
      const result=await snapshotApi.recompute({...target,expectedRevision:null});
      const saved=(await db.query('SELECT result_payload FROM bsmoss_analysis.aggregate_revision WHERE series_id=$1',[result.seriesId])).rows[0].result_payload;
      assert.deepEqual(saved.value,{kind:'ratio',numerator:'36',denominator:'40'});assert.equal(saved.completeness,'preliminary');
    });
    const completionTarget={...snapshotTarget,metric:{code:'status.voice.connection_rate',version:1}};
    async function attestCompletion(revision,status='confirmed',patch={}) {
      const snapshot=await snapshotReader.load(completionTarget);
      const basePlan={...snapshot.plan,watermark:snapshot.plan.period.start,sourceComplete:false}; delete basePlan.completionEvidence;
      const row={workspace_id:'w',source_id:'src',mapping_id:'snapshot-map',station_id:'st',metric_code:completionTarget.metric.code,metric_version:1,
        grain:'hour',period_start:snapshotTime(0),period_end:snapshotTime(60),revision,status,input_fingerprint:aggregateIntervals(basePlan,snapshot.inputs).inputFingerprint,
        watermark:status==='confirmed'?snapshotTime(60):snapshotTime(0),evidence_ref:'fixture://source-completion/'+revision,evidence_sha256:'f'.repeat(64),recorded_by:'reviewed-import',...patch};
      const columns=Object.keys(row);
      return db.query(`INSERT INTO bsmoss_integration.source_completion(${columns.join(',')}) VALUES (${columns.map((_,i)=>'$'+(i+1)).join(',')})`,Object.values(row));
    }
    await t.test('matching source completion and full valid windows produce an auditable complete aggregate',async()=>{
      let inserted=false;
      const concurrentPool={async connect(){const client=await adapterPool.connect();return {
        async query(sql,args){const result=await client.query(sql,args);if(!inserted && sql.includes('SELECT m.*,n.kind')){inserted=true;await attestCompletion('1');}return result;},
        release(discard){client.release(discard);}
      };}};
      const beforeConfirmation=await new PgAggregateSnapshotReader(concurrentPool,scope).load(completionTarget);
      assert.equal(inserted,true);assert.equal(beforeConfirmation.plan.completionEvidence,undefined);
      assert.equal(aggregateIntervals(beforeConfirmation.plan,beforeConfirmation.inputs).completeness,'preliminary');
      const snapshot=await snapshotReader.load(completionTarget),result=aggregateIntervals(snapshot.plan,snapshot.inputs);
      assert.equal(result.completeness,'complete');assert.equal(snapshot.plan.sourceComplete,true);assert.equal(result.watermark,snapshotTime(60));
      assert.equal(result.completionEvidence.revision,'1');assert.equal(result.completionEvidence.evidenceRef,'fixture://source-completion/1');
      const saved=await snapshotApi.recompute({...completionTarget,expectedRevision:'1'});
      assert.equal(saved.revision,'2');
      const manifest=(await db.query('SELECT input_manifest,result_payload FROM bsmoss_analysis.aggregate_revision WHERE series_id=$1 AND revision=2',[saved.seriesId])).rows[0];
      assert.deepEqual(aggregateIntervals(manifest.input_manifest.plan,manifest.input_manifest.inputs),manifest.result_payload);
      assert.equal((await snapshotApi.recompute({...completionTarget,expectedRevision:'2'})).status,'duplicate');
    });
    await t.test('quality revisions invalidate source completion and reconfirmation is bound to the new snapshot',async()=>{
      const measurementId=(await db.query("SELECT id FROM bsmoss_metering.measurement WHERE event_id='snapshot-ratio-0'")).rows[0].id;
      await db.query("INSERT INTO bsmoss_metering.quality_decision VALUES ('w','completion-quality-change',$1,2,'pending','2','fixture pending','reviewer',now())",[measurementId]);
      const changed=await snapshotReader.load(completionTarget),result=aggregateIntervals(changed.plan,changed.inputs);
      assert.equal(result.completeness,'partial');assert.equal(changed.plan.sourceComplete,false);assert.ok(result.reasons.includes('source_confirmation_stale'));
      await attestCompletion('2');
      const confirmed=await snapshotReader.load(completionTarget);
      assert.equal(confirmed.plan.sourceComplete,true);assert.equal(aggregateIntervals(confirmed.plan,confirmed.inputs).completeness,'partial');
      await db.query("INSERT INTO bsmoss_metering.quality_decision VALUES ('w','completion-quality-restore',$1,3,'verified','3','fixture restore','reviewer',now())",[measurementId]);
      const restored=await snapshotReader.load(completionTarget);
      assert.equal(aggregateIntervals(restored.plan,restored.inputs).completeness,'preliminary');
      await attestCompletion('3');
      const current=await snapshotReader.load(completionTarget);
      assert.equal(aggregateIntervals(current.plan,current.inputs).completeness,'complete');
    });
    await t.test('latest revocation and stale confirmation never fall back to an older confirmation',async()=>{
      await attestCompletion('4','revoked');
      const revoked=await snapshotReader.load(completionTarget),result=aggregateIntervals(revoked.plan,revoked.inputs);
      assert.equal(result.completeness,'preliminary');assert.ok(result.reasons.includes('source_confirmation_revoked'));
      assert.equal(result.completionEvidence.revision,'4');assert.equal(result.watermark,snapshotTime(0));
      await attestCompletion('5','confirmed',{input_fingerprint:'0'.repeat(64)});
      const stale=await snapshotReader.load(completionTarget),staleResult=aggregateIntervals(stale.plan,stale.inputs);
      assert.equal(staleResult.completeness,'preliminary');assert.equal(staleResult.completionEvidence.revision,'5');assert.ok(staleResult.reasons.includes('source_confirmation_stale'));
    });
    await t.test('completion lookup isolates metric, period and mapping, and authority changes invalidate evidence',async()=>{
      await attestCompletion('6');
      assert.equal((await snapshotReader.load({...completionTarget,at:snapshotTime(75)})).plan.completionEvidence,undefined);
      const otherMapping=await snapshotReader.load({...completionTarget,mappingId:'cell-map'});
      assert.equal(otherMapping.plan.completionEvidence,undefined);assert.equal(otherMapping.plan.sourceComplete,false);
      await db.query("UPDATE bsmoss_integration.source_capability SET rules=$1 WHERE id='snapshot-ratio-cap'",[{intervalAggregation:{...capabilityPolicy.intervalAggregation,authorityRef:'fixture://changed-authority'}}]);
      const changed=await snapshotReader.load(completionTarget),result=aggregateIntervals(changed.plan,changed.inputs);
      assert.equal(result.completeness,'preliminary');assert.ok(result.reasons.includes('source_confirmation_stale'));
    });
    await t.test('source completion is read-only to runtime and constraints reject bad proofs and cross-tenant mappings',async()=>{
      for(const sql of ["UPDATE bsmoss_integration.source_completion SET status='confirmed'",'DELETE FROM bsmoss_integration.source_completion',
        'TRUNCATE bsmoss_integration.source_completion',"INSERT INTO bsmoss_integration.source_completion SELECT * FROM bsmoss_integration.source_completion LIMIT 1"]) {
        await assert.rejects(adapterPool.query(sql),e=>e.code==='42501');
      }
      for(const patch of [{watermark:snapshotTime(30)},{revision:'0'},{input_fingerprint:'bad'},{evidence_sha256:'bad'},{evidence_ref:' '},{recorded_by:''}]) {
        await assert.rejects(attestCompletion('7','confirmed',patch),e=>e.code==='23514');
      }
      await assert.rejects(attestCompletion('7','confirmed',{workspace_id:'other'}),e=>e.code==='23503');
      await assert.rejects(attestCompletion('7','confirmed',{source_id:'src2'}),e=>e.code==='23503');
      await assert.rejects(attestCompletion('6'),e=>e.code==='23505');
    });
    await db.query(`INSERT INTO bsmoss_resource.network_object VALUES ('w','roll-cell','st','svc','cell');
      INSERT INTO bsmoss_integration.source_mapping(workspace_id,id,source_id,external_type,external_id,station_id,service_id,network_object_id,version,valid_from,valid_to)
      VALUES ('w','roll-old','src','cell','roll-external','st','svc','roll-cell',1,'2026-01-01Z','2026-02-01T00:30:00Z'),
      ('w','roll-new','src','cell','roll-external','st','svc','roll-cell',2,'2026-02-01T00:30:00Z','2027-01-01Z');`);
    const rollTarget={...snapshotTarget,mappingId:'roll-old'};
    let rollSeries;
    await t.test('adjacent mapping versions combine into one stable subject result with per-window provenance',async()=>{
      for(let i=0;i<4;i++) await store.append(draft('roll-'+i,{mappingId:i<2?'roll-old':'roll-new',
        periodStart:snapshotTime(i*15),periodEnd:snapshotTime((i+1)*15),value:{kind:'integer_delta',value:'10'}}));
      const oldAnchor=await snapshotReader.load(rollTarget),newAnchor=await snapshotReader.load({...rollTarget,mappingId:'roll-new'});
      assert.deepEqual(oldAnchor,newAnchor);
      const result=aggregateIntervals(oldAnchor.plan,oldAnchor.inputs);
      assert.deepEqual(result.value,{kind:'integer',value:'40'});assert.equal(result.expectedWindows,4);
      assert.deepEqual(result.mappingWindows.map(w=>w.mappingId),['roll-old','roll-old','roll-new','roll-new']);
      assert.deepEqual(result.evidence.map(e=>[e.mappingId,e.mappingVersion]).sort(),[['roll-new','2'],['roll-new','2'],['roll-old','1'],['roll-old','1']]);
      const first=await snapshotApi.recompute({...rollTarget,expectedRevision:null});rollSeries=first.seriesId;
      const duplicate=await snapshotApi.recompute({...rollTarget,mappingId:'roll-new',expectedRevision:null});
      assert.equal(duplicate.status,'duplicate');assert.equal(duplicate.seriesId,rollSeries);
      const saved=(await db.query('SELECT result_payload,input_manifest FROM bsmoss_analysis.aggregate_revision WHERE series_id=$1 AND revision=1',[rollSeries])).rows[0];
      assert.deepEqual(aggregateIntervals(saved.input_manifest.plan,saved.input_manifest.inputs),saved.result_payload);
    });
    await t.test('multi-mapping snapshots cannot reuse a single segment source confirmation',async()=>{
      const snapshot=await snapshotReader.load(rollTarget),binding=aggregateIntervals(snapshot.plan,snapshot.inputs).inputFingerprint;
      await db.query(`INSERT INTO bsmoss_integration.source_completion(workspace_id,source_id,mapping_id,station_id,metric_code,metric_version,grain,
        period_start,period_end,revision,status,input_fingerprint,watermark,evidence_ref,evidence_sha256,recorded_by)
        VALUES ('w','src','roll-old','st','service.data.uplink_bytes',1,'hour',$1,$2,1,'confirmed',$3,$2,'fixture://one-segment',$4,'reviewer')`,[snapshotTime(0),snapshotTime(60),binding,'a'.repeat(64)]);
      for(const mappingId of ['roll-old','roll-new']) {
        const current=await snapshotReader.load({...rollTarget,mappingId});
        assert.equal(current.plan.completionEvidence,undefined);assert.equal(aggregateIntervals(current.plan,current.inputs).completeness,'preliminary');
      }
    });
    await t.test('cross-mapping corrections retain old aggregate versions without counting old and new facts twice',async()=>{
      await store.append(draft('roll-0',{mappingId:'roll-old',revision:'2',previousRevision:'1',payloadSha256:'b'.repeat(64),
        periodStart:snapshotTime(0),periodEnd:snapshotTime(15),value:{kind:'integer_delta',value:'20'}}));
      const snapshot=await snapshotReader.load(rollTarget);
      assert.equal(snapshot.inputs.length,4);assert.deepEqual(aggregateIntervals(snapshot.plan,snapshot.inputs).value,{kind:'integer',value:'50'});
      const saved=await snapshotApi.recompute({...rollTarget,expectedRevision:'1'});assert.equal(saved.revision,'2');
      const values=(await db.query('SELECT revision,integer_value FROM bsmoss_analysis.aggregate_revision WHERE series_id=$1 ORDER BY revision',[rollSeries])).rows;
      assert.deepEqual(values,[{revision:'1',integer_value:'40'},{revision:'2',integer_value:'50'}]);
    });
    await t.test('mapping gaps, aliases and off-grid switches reject the snapshot before publication',async()=>{
      await db.query("UPDATE bsmoss_integration.source_mapping SET valid_from=$1 WHERE id='roll-new'",[snapshotTime(45)]);
      await assert.rejects(snapshotReader.load(rollTarget),/aggregate_mapping_gap/);
      await db.query("UPDATE bsmoss_integration.source_mapping SET valid_to=$1 WHERE id='roll-old'",[snapshotTime(20)]);
      await db.query("UPDATE bsmoss_integration.source_mapping SET valid_from=$1 WHERE id='roll-new'",[snapshotTime(20)]);
      await assert.rejects(snapshotReader.load(rollTarget),/mapping_ambiguous|unaligned_mapping/);
      await db.query("UPDATE bsmoss_integration.source_mapping SET valid_from=$1 WHERE id='roll-new'",[snapshotTime(30)]);
      await db.query("UPDATE bsmoss_integration.source_mapping SET valid_to=$1 WHERE id='roll-old'",[snapshotTime(30)]);
      await db.query(`INSERT INTO bsmoss_integration.source_mapping(workspace_id,id,source_id,external_type,external_id,station_id,service_id,network_object_id,version,valid_from,valid_to)
        VALUES ('w','roll-alias','src','cell','roll-alias','st','svc','roll-cell',1,'2026-01-01Z','2027-01-01Z')`);
      await assert.rejects(snapshotReader.load(rollTarget),/aggregate_subject_mapping_ambiguous/);
      await db.query("DELETE FROM bsmoss_integration.source_mapping WHERE id='roll-alias'");
      assert.equal((await db.query('SELECT count(*)::int AS n FROM bsmoss_analysis.aggregate_revision WHERE series_id=$1',[rollSeries])).rows[0].n,2);
    });
    await db.query(`INSERT INTO bsmoss_resource.station_service VALUES ('w','window-svc','st','op','2026-02-01T00:15:00Z','2026-02-01T00:45:00Z');
      INSERT INTO bsmoss_resource.network_object VALUES ('w','window-cell','st','window-svc','cell');
      INSERT INTO bsmoss_integration.source_mapping(workspace_id,id,source_id,external_type,external_id,station_id,service_id,network_object_id,version,valid_from,valid_to)
      VALUES ('w','window-map','src','cell','window-external','st','window-svc','window-cell',1,'2026-01-01Z','2027-01-01Z')`);
    const windowScope={...scope,serviceIds:[...scope.serviceIds,'window-svc']};
    const windowReader=new PgAggregateSnapshotReader(adapterPool,windowScope),windowStore=new PgMeasurementStore(adapterPool,windowScope,FIRST_METRICS);
    const windowTarget={...snapshotTarget,mappingId:'window-map'};
    await t.test('service mid-period activation/retirement excludes inactive windows and preserves missing active windows',async()=>{
      for(const i of [1,2]) await windowStore.append(draft('window-'+i,{mappingId:'window-map',periodStart:snapshotTime(i*15),periodEnd:snapshotTime((i+1)*15),value:{kind:'integer_delta',value:'10'}}));
      const snapshot=await windowReader.load(windowTarget),result=aggregateIntervals(snapshot.plan,snapshot.inputs);
      assert.equal(result.expectedWindows,2);assert.equal(result.validWindows,2);assert.equal(result.expectedMilliseconds,1800000);
      assert.equal(result.periodMilliseconds,3600000);assert.equal(result.completeness,'preliminary');assert.ok(!result.reasons.includes('missing_windows'));
      await assert.rejects(snapshotReader.load(windowTarget),/object_scope_denied/);
      const id=(await db.query("SELECT id FROM bsmoss_metering.measurement WHERE event_id='window-1'")).rows[0].id;
      await db.query("INSERT INTO bsmoss_metering.quality_decision VALUES ('w','window-quality',$1,2,'rejected','2','fixture','reviewer',now())",[id]);
      const partial=await windowReader.load(windowTarget),value=aggregateIntervals(partial.plan,partial.inputs);
      assert.equal(value.completeness,'partial');assert.equal(value.expectedWindows,2);assert.equal(value.validWindows,1);
    });
    await t.test('inactive service periods return not applicable; unaligned service boundaries cannot split counters',async()=>{
      const inactive=await windowReader.load({...windowTarget,at:snapshotTime(75)}),result=aggregateIntervals(inactive.plan,inactive.inputs);
      assert.equal(result.completeness,'not_applicable');assert.equal(result.value,null);assert.equal(result.expectedWindows,0);
      await db.query("UPDATE bsmoss_resource.station_service SET valid_from=$1 WHERE id='window-svc'",[snapshotTime(5)]);
      await assert.rejects(windowReader.load(windowTarget),/unaligned_service_boundary/);
      await db.query("UPDATE bsmoss_resource.station_service SET valid_from=$1 WHERE id='window-svc'",[snapshotTime(15)]);
    });
    for(const code of ['service.data.downlink_bytes','service.data.total_bytes','service.voice.connected_count','service.voice.attempt_count']){
      const m=FIRST_METRICS.get({code,version:1});await db.query("INSERT INTO bsmoss_catalog.metric_version VALUES ($1,1,$2,$3,$4,'{}')",[code,m.category,m.semantic,m.unit]);
    }
    await db.query(`INSERT INTO bsmoss_resource.network_object VALUES ('w','dependency-cell','st','svc','cell');
      INSERT INTO bsmoss_integration.source_mapping(workspace_id,id,source_id,external_type,external_id,station_id,service_id,network_object_id,version,valid_from,valid_to)
      VALUES ('w','dependency-map','src','cell','dependency-external','st','svc','dependency-cell',1,'2026-01-01Z','2027-01-01Z')`);
    const depTarget={...snapshotTarget,mappingId:'dependency-map',metric:{code:'service.data.total_bytes',version:1}};
    const depPolicy={intervalAggregation:{version:1,inputMode:'dependencies',authorityRef:'fixture://reviewed-dependency-authority'}};
    const down={code:'service.data.downlink_bytes',version:1};
    async function capability(id,metric,policy=capabilityPolicy){await db.query(`INSERT INTO bsmoss_integration.source_capability VALUES ('w',$1,'src',$2,1,'15m','active','fixture://validation',$3,'2026-01-01Z','2027-01-01Z')`,[id,metric.code,policy]);}
    async function depDraft(prefix,metric,i,value,patch={}){return store.append(draft(prefix+i,{mappingId:'dependency-map',metric,componentKey:metric.code,periodStart:snapshotTime(i*15),periodEnd:snapshotTime((i+1)*15),value:{kind:'integer_delta',value},...patch}));}
    let depSeries;
    await t.test('trusted derived total requires target and dependency capabilities and persists exact directional inputs',async()=>{
      await capability('dependency-total-cap',depTarget.metric,depPolicy);
      await assert.rejects(snapshotReader.load(depTarget),/aggregate_capability_unavailable_or_ambiguous/);
      await capability('dependency-down-cap',down);
      for(let i=0;i<4;i++){await depDraft('dep-up-',snapshotTarget.metric,i,'9007199254740993');await depDraft('dep-down-',down,i,'7');}
      const snapshot=await snapshotReader.load(depTarget),result=aggregateIntervals(snapshot.plan,snapshot.inputs);
      assert.equal(snapshot.plan.inputMode,'dependencies');assert.equal(snapshot.inputs.length,8);
      assert.deepEqual(result.value,{kind:'integer',value:String((9007199254740993n+7n)*4n)});assert.equal(result.completeness,'preliminary');
      const saved=await snapshotApi.recompute({...depTarget,expectedRevision:null});depSeries=saved.seriesId;
      assert.equal((await snapshotApi.recompute({...depTarget,expectedRevision:null})).status,'duplicate');
      const persisted=(await db.query('SELECT result_payload,input_manifest FROM bsmoss_analysis.aggregate_revision WHERE series_id=$1 AND revision=1',[depSeries])).rows[0];
      assert.deepEqual(aggregateIntervals(persisted.input_manifest.plan,persisted.input_manifest.inputs),persisted.result_payload);
      assert.equal(persisted.result_payload.evidence.length,8);
    });
    await t.test('derived snapshots reject target-only grants, mismatched native grains, inactive and malformed dependency capabilities',async()=>{
      for(const missing of ['service.data.total_bytes@1','service.data.uplink_bytes@1','service.data.downlink_bytes@1']){
        const reader=new PgAggregateSnapshotReader(adapterPool,{...scope,metricKeys:scope.metricKeys.filter(k=>k!==missing)});await assert.rejects(reader.load(depTarget),/scope_denied/);
      }
      for(const [field,value,error] of [['native_grain','hour',/mixed_native_grain/],['status','validated',/capability_unavailable/],['valid_from',snapshotTime(15),/capability_boundary/]]){
        const before=(await db.query('SELECT * FROM bsmoss_integration.source_capability WHERE id=$1',['dependency-down-cap'])).rows[0];
        try{await db.query('UPDATE bsmoss_integration.source_capability SET '+field+'=$1 WHERE id=$2',[value,'dependency-down-cap']);await assert.rejects(snapshotReader.load(depTarget),error);}
        finally{await db.query('UPDATE bsmoss_integration.source_capability SET '+field+'=$1 WHERE id=$2',[before[field],'dependency-down-cap']);}
      }
      await db.query('UPDATE bsmoss_integration.source_capability SET rules=$1 WHERE id=$2',[depPolicy,'dependency-down-cap']);
      await assert.rejects(snapshotReader.load(depTarget),/dependency_policy_required/);
      await db.query('UPDATE bsmoss_integration.source_capability SET rules=$1 WHERE id=$2',[capabilityPolicy,'dependency-down-cap']);
    });
    async function attestDerived(revision,patch={}){
      const snapshot=await snapshotReader.load(depTarget),base={...snapshot.plan,sourceComplete:false,watermark:snapshot.plan.period.start};delete base.completionEvidence;
      const row={workspace_id:'w',source_id:'src',mapping_id:'dependency-map',station_id:'st',metric_code:depTarget.metric.code,metric_version:1,grain:'hour',
        period_start:snapshotTime(0),period_end:snapshotTime(60),revision,status:'confirmed',input_fingerprint:aggregateIntervals(base,snapshot.inputs).inputFingerprint,
        watermark:snapshotTime(60),evidence_ref:'fixture://derived-completion/'+revision,evidence_sha256:'a'.repeat(64),recorded_by:'reviewed-import',...patch};
      const columns=Object.keys(row);await db.query('INSERT INTO bsmoss_integration.source_completion('+columns.join(',')+') VALUES ('+columns.map((_,i)=>'$'+(i+1)).join(',')+')',Object.values(row));
    }
    await t.test('target completion binds both dependencies and invalidates on any dependency authority or quality revision',async()=>{
      await attestDerived('1');const complete=await snapshotReader.load(depTarget);assert.equal(aggregateIntervals(complete.plan,complete.inputs).completeness,'complete');
      await db.query('UPDATE bsmoss_integration.source_capability SET rules=$1 WHERE id=$2',[{intervalAggregation:{...capabilityPolicy.intervalAggregation,authorityRef:'fixture://new-down-policy'}},'dependency-down-cap']);
      const stale=await snapshotReader.load(depTarget);assert.ok(aggregateIntervals(stale.plan,stale.inputs).reasons.includes('source_confirmation_stale'));
      await attestDerived('2');
      const id=(await db.query("SELECT id FROM bsmoss_metering.measurement WHERE event_id='dep-down-0'")).rows[0].id;
      await db.query("INSERT INTO bsmoss_metering.quality_decision VALUES ('w','dep-quality',$1,2,'pending','2','fixture','reviewer',now())",[id]);
      const partial=await snapshotReader.load(depTarget),result=aggregateIntervals(partial.plan,partial.inputs);
      assert.equal(result.value,null);assert.equal(result.validWindows,3);assert.equal(result.completeness,'partial');assert.ok(result.reasons.includes('missing_dependency'));assert.ok(result.reasons.includes('source_confirmation_stale'));
      await db.query("INSERT INTO bsmoss_metering.quality_decision VALUES ('w','dep-quality-restore',$1,3,'verified','3','fixture','reviewer',now())",[id]);
      const restored=await snapshotReader.load(depTarget);assert.equal(aggregateIntervals(restored.plan,restored.inputs).completeness,'preliminary');
    });
    await t.test('dependency corrections moved to another window retract old facts without replacing them with old revisions',async()=>{
      await depDraft('dep-down-',down,0,'11',{revision:'2',previousRevision:'1',payloadSha256:'c'.repeat(64),periodStart:snapshotTime(60),periodEnd:snapshotTime(75)});
      const snapshot=await snapshotReader.load(depTarget),result=aggregateIntervals(snapshot.plan,snapshot.inputs);assert.equal(snapshot.inputs.length,7);assert.equal(result.validWindows,3);assert.equal(result.value,null);
      const saved=await snapshotApi.recompute({...depTarget,expectedRevision:'1'});assert.equal(saved.revision,'2');
      const versions=(await db.query('SELECT revision,result_payload FROM bsmoss_analysis.aggregate_revision WHERE series_id=$1 ORDER BY revision',[depSeries])).rows;
      assert.ok(versions[0].result_payload.value);assert.equal(versions[1].result_payload.value,null);
      const next=await snapshotReader.load({...depTarget,at:snapshotTime(75)});assert.equal(next.inputs.length,1);assert.equal(next.inputs[0].revision,'2');assert.equal(aggregateIntervals(next.plan,next.inputs).value,null);
    });
    const depRate={...depTarget,metric:{code:'status.voice.connection_rate',version:1}};
    await t.test('reviewed ratio dependencies ignore simultaneous direct ratios and pool exact counts',async()=>{
      await db.query('UPDATE bsmoss_integration.source_capability SET rules=$1 WHERE id=$2',[depPolicy,'snapshot-ratio-cap']);
      const connected={code:'service.voice.connected_count',version:1},attempts={code:'service.voice.attempt_count',version:1};
      await capability('dep-connected-cap',connected);await capability('dep-attempts-cap',attempts);
      for(let i=0;i<4;i++){
        await depDraft('dep-connected-',connected,i,i===0?'1':'9');await depDraft('dep-attempts-',attempts,i,i===0?'100':'10');
        await store.append(draft('dep-direct-ratio-'+i,{mappingId:'dependency-map',metric:depRate.metric,periodStart:snapshotTime(i*15),periodEnd:snapshotTime((i+1)*15),value:{kind:'ratio_parts',numerator:'1',denominator:'1'}}));
      }
      const snapshot=await snapshotReader.load(depRate),result=aggregateIntervals(snapshot.plan,snapshot.inputs);assert.equal(snapshot.inputs.length,8);assert.deepEqual(result.value,{kind:'ratio',numerator:'28',denominator:'130'});
      assert.ok(snapshot.inputs.every(row=>row.metric.code!==depRate.metric.code));
      const saved=await snapshotApi.recompute({...depRate,expectedRevision:null});assert.equal(saved.revision,'1');
      const denied=new PgAggregateSnapshotReader(adapterPool,{...scope,metricKeys:[depRate.metric.code+'@1']});await assert.rejects(denied.load(depRate),/dependency_scope_denied/);
    });
    await t.test('dependency snapshots retain one repeatable-read view through concurrent corrections',async()=>{
      let changed=false;const intercepted={async connect(){const client=await adapterPool.connect();return {async query(sql,args){const rows=await client.query(sql,args);if(!changed&&sql.includes('SELECT m.*,r.payload_sha256')){changed=true;await depDraft('dep-connected-',{code:'service.voice.connected_count',version:1},0,'2',{revision:'2',previousRevision:'1',payloadSha256:'d'.repeat(64)});}return rows;},release(discard){client.release(discard);}};}};
      const before=await new PgAggregateSnapshotReader(intercepted,scope).load(depRate),after=await snapshotReader.load(depRate);
      assert.equal(changed,true);assert.deepEqual(aggregateIntervals(before.plan,before.inputs).value,{kind:'ratio',numerator:'28',denominator:'130'});assert.deepEqual(aggregateIntervals(after.plan,after.inputs).value,{kind:'ratio',numerator:'29',denominator:'130'});
    });
    async function attestSet(revision,status='confirmed',patch={},target=rollTarget) {
      const snapshot=await snapshotReader.load(target),base={...snapshot.plan,sourceComplete:false,watermark:snapshot.plan.period.start};delete base.completionEvidence;
      const object=(await db.query('SELECT station_id,service_id,network_object_id,device_id FROM bsmoss_integration.source_mapping WHERE workspace_id=$1 AND id=$2',['w',target.mappingId])).rows[0];
      const row={workspace_id:'w',id:randomUUID(),source_id:target.sourceId,...object,metric_code:target.metric.code,metric_version:target.metric.version,
        grain:target.grain,period_start:snapshot.plan.period.start,period_end:snapshot.plan.period.end,revision,status,
        input_fingerprint:aggregateIntervals(base,snapshot.inputs).inputFingerprint,mapping_manifest_sha256:mappingSetFingerprint(snapshot.plan.mappingWindows),
        watermark:status==='confirmed'?snapshot.plan.period.end:snapshot.plan.period.start,evidence_ref:'fixture://whole-object/'+revision,
        evidence_sha256:'e'.repeat(64),recorded_by:'reviewed-import',...patch};
      const columns=Object.keys(row);await db.query('INSERT INTO bsmoss_integration.source_completion_set('+columns.join(',')+') VALUES ('+columns.map((_,i)=>'$'+(i+1)).join(',')+')',Object.values(row));
      return row;
    }
    await t.test('whole-object completion reads one snapshot, covers all mappings and persists reproducible proof',async()=>{
      let inserted=false;const intercepted={async connect(){const client=await adapterPool.connect();return {async query(sql,args){const result=await client.query(sql,args);if(!inserted&&sql.includes('SELECT m.*,n.kind')){inserted=true;await attestSet('1');}return result;},release(discard){client.release(discard);}};}};
      const before=await new PgAggregateSnapshotReader(intercepted,scope).load(rollTarget);
      assert.equal(inserted,true);assert.equal(before.plan.completionEvidence,undefined);
      for(const mappingId of ['roll-old','roll-new']) {
        const snapshot=await snapshotReader.load({...rollTarget,mappingId}),result=aggregateIntervals(snapshot.plan,snapshot.inputs);
        assert.equal(result.completeness,'complete');assert.equal(result.completionEvidence.revision,'1');
        assert.equal(result.completionEvidence.mappingSet.sha256,mappingSetFingerprint(result.mappingWindows));
      }
      const saved=await snapshotApi.recompute({...rollTarget,expectedRevision:'2'});assert.equal(saved.revision,'3');
      assert.equal((await snapshotApi.recompute({...rollTarget,mappingId:'roll-new',expectedRevision:'3'})).status,'duplicate');
      const version=(await db.query('SELECT result_payload,input_manifest FROM bsmoss_analysis.aggregate_revision WHERE series_id=$1 AND revision=3',[rollSeries])).rows[0];
      assert.deepEqual(aggregateIntervals(version.input_manifest.plan,version.input_manifest.inputs),version.result_payload);
    });
    await t.test('latest set manifest or fingerprint mismatch and revocation never revive older matching evidence',async()=>{
      await attestSet('2','confirmed',{mapping_manifest_sha256:'0'.repeat(64)});
      let snapshot=await snapshotReader.load(rollTarget),result=aggregateIntervals(snapshot.plan,snapshot.inputs);
      assert.equal(result.completeness,'preliminary');assert.equal(result.completionEvidence.revision,'2');assert.ok(result.reasons.includes('source_confirmation_stale'));
      await attestSet('3');assert.equal((await snapshotReader.load(rollTarget)).plan.sourceComplete,true);
      await attestSet('4','revoked');snapshot=await snapshotReader.load(rollTarget);result=aggregateIntervals(snapshot.plan,snapshot.inputs);
      assert.equal(result.completeness,'preliminary');assert.ok(result.reasons.includes('source_confirmation_revoked'));assert.equal(result.completionEvidence.revision,'4');
      await attestSet('5','confirmed',{input_fingerprint:'0'.repeat(64)});
      snapshot=await snapshotReader.load(rollTarget);assert.equal(snapshot.plan.sourceComplete,false);assert.equal(snapshot.plan.completionEvidence.revision,'5');
      await attestSet('6');
    });
    await t.test('set completion is invalidated by measurement, quality and authority revisions',async()=>{
      await store.append(draft('roll-0',{mappingId:'roll-old',revision:'3',previousRevision:'2',payloadSha256:'c'.repeat(64),periodStart:snapshotTime(0),periodEnd:snapshotTime(15),value:{kind:'integer_delta',value:'30'}}));
      let snapshot=await snapshotReader.load(rollTarget),result=aggregateIntervals(snapshot.plan,snapshot.inputs);
      assert.equal(result.completeness,'preliminary');assert.ok(result.reasons.includes('source_confirmation_stale'));assert.deepEqual(result.value,{kind:'integer',value:'60'});
      await attestSet('7');
      const id=(await db.query("SELECT id FROM bsmoss_metering.measurement WHERE event_id='roll-0' AND event_revision=3")).rows[0].id;
      await db.query("INSERT INTO bsmoss_metering.quality_decision VALUES ('w','set-quality',$1,2,'pending','2','fixture','reviewer',now())",[id]);
      snapshot=await snapshotReader.load(rollTarget);result=aggregateIntervals(snapshot.plan,snapshot.inputs);
      assert.equal(result.completeness,'partial');assert.equal(snapshot.plan.sourceComplete,false);
      await attestSet('8');snapshot=await snapshotReader.load(rollTarget);assert.equal(snapshot.plan.sourceComplete,true);assert.equal(aggregateIntervals(snapshot.plan,snapshot.inputs).completeness,'partial');
      await db.query("INSERT INTO bsmoss_metering.quality_decision VALUES ('w','set-quality-restore',$1,3,'verified','3','fixture','reviewer',now())",[id]);
      assert.equal((await snapshotReader.load(rollTarget)).plan.sourceComplete,false);
      await attestSet('9');
      await db.query("UPDATE bsmoss_integration.source_mapping SET version=3 WHERE id='roll-new'");
      snapshot=await snapshotReader.load(rollTarget);assert.equal(snapshot.plan.sourceComplete,false);assert.ok(aggregateIntervals(snapshot.plan,snapshot.inputs).reasons.includes('source_confirmation_stale'));
      await db.query("UPDATE bsmoss_integration.source_mapping SET version=2 WHERE id='roll-new'");
    });
    await t.test('set ledger scopes object, source, metric, grain and time without segment fallback',async()=>{
      for(const target of [{...rollTarget,at:snapshotTime(75)},{...rollTarget,mappingId:'dependency-map'},{...rollTarget,metric:depTarget.metric},{...rollTarget,grain:'day'}]) {
        const current=await snapshotReader.load(target);assert.equal(current.plan.completionEvidence,undefined);
      }
      const next={...rollTarget,at:snapshotTime(75)},snapshot=await snapshotReader.load(next);
      const binding=aggregateIntervals(snapshot.plan,snapshot.inputs).inputFingerprint;
      await db.query(`INSERT INTO bsmoss_integration.source_completion(workspace_id,source_id,mapping_id,station_id,metric_code,metric_version,grain,period_start,period_end,revision,status,input_fingerprint,watermark,evidence_ref,evidence_sha256,recorded_by)
        VALUES ('w','src','roll-new','st','service.data.uplink_bytes',1,'hour',$1,$2,1,'confirmed',$3,$2,'fixture://single-fallback',$4,'reviewer')`,[snapshot.plan.period.start,snapshot.plan.period.end,binding,'a'.repeat(64)]);
      assert.equal((await snapshotReader.load(next)).plan.sourceComplete,true);
      await attestSet('1','revoked',{},next);
      const revoked=await snapshotReader.load(next);assert.equal(revoked.plan.sourceComplete,false);assert.equal(revoked.plan.completionEvidence.status,'revoked');assert.ok(revoked.plan.completionEvidence.mappingSet);
      // Another source may attest the same physical object, but cannot confirm src.
      await attestSet('10','confirmed',{source_id:'src2'});
      assert.equal((await snapshotReader.load(rollTarget)).plan.completionEvidence.revision,'9');
    });
    await t.test('set proof is read-only to runtime, tenant constrained and unique with null object parts',async()=>{
      for(const sql of ["UPDATE bsmoss_integration.source_completion_set SET status='confirmed'",'DELETE FROM bsmoss_integration.source_completion_set',
        'TRUNCATE bsmoss_integration.source_completion_set','INSERT INTO bsmoss_integration.source_completion_set SELECT * FROM bsmoss_integration.source_completion_set LIMIT 1']) {
        await assert.rejects(adapterPool.query(sql),e=>e.code==='42501');
      }
      for(const patch of [{watermark:snapshotTime(30)},{revision:'0'},{mapping_manifest_sha256:'bad'},{input_fingerprint:'bad'},{evidence_ref:' '},{recorded_by:''},{service_id:null}]) {
        await assert.rejects(attestSet('10','confirmed',patch),e=>e.code==='23514');
      }
      await assert.rejects(attestSet('10','confirmed',{workspace_id:'other'}),e=>e.code==='23503');
      await assert.rejects(attestSet('10','confirmed',{station_id:'foreign'}),e=>e.code==='23503');
      await assert.rejects(attestSet('9'),e=>e.code==='23505');
      const outcomes=await Promise.allSettled([attestSet('10'),attestSet('10')]);
      assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);assert.equal(outcomes.find(r=>r.status==='rejected').reason.code,'23505');
    });
    await t.test('whole-object derived proof binds both metrics across the entire mapping manifest',async()=>{
      const target={...rollTarget,metric:depTarget.metric};
      for(let i=0;i<4;i++)await store.append(draft('set-down-'+i,{mappingId:i<2?'roll-old':'roll-new',metric:down,
        periodStart:snapshotTime(i*15),periodEnd:snapshotTime((i+1)*15),value:{kind:'integer_delta',value:'5'}}));
      await attestSet('1','confirmed',{},target);
      const snapshot=await snapshotReader.load(target),result=aggregateIntervals(snapshot.plan,snapshot.inputs);
      assert.equal(snapshot.inputs.length,8);assert.equal(result.completeness,'complete');assert.deepEqual(result.value,{kind:'integer',value:'80'});
      const saved=await snapshotApi.recompute({...target,expectedRevision:null});
      const version=(await db.query('SELECT result_payload,input_manifest FROM bsmoss_analysis.aggregate_revision WHERE series_id=$1',[saved.seriesId])).rows[0];
      assert.deepEqual(aggregateIntervals(version.input_manifest.plan,version.input_manifest.inputs),version.result_payload);
      const id=(await db.query("SELECT id FROM bsmoss_metering.measurement WHERE event_id='set-down-3'")).rows[0].id;
      await db.query("INSERT INTO bsmoss_metering.quality_decision VALUES ('w','set-derived-quality',$1,2,'pending','2','fixture','reviewer',now())",[id]);
      const changed=await snapshotReader.load(target),partial=aggregateIntervals(changed.plan,changed.inputs);
      assert.equal(partial.value,null);assert.equal(partial.completeness,'partial');assert.equal(partial.validWindows,3);assert.ok(partial.reasons.includes('source_confirmation_stale'));
      const denied=new PgAggregateSnapshotReader(adapterPool,{...scope,metricKeys:scope.metricKeys.filter(k=>k!=='service.data.downlink_bytes@1')});
      await assert.rejects(denied.load(target),/dependency_scope_denied/);
    });
  } finally {
    if (adapterPool) await adapterPool.end();
    await Promise.all(peers.map(c=>c.end()));
    if (db) {try {await db.query("ROLLBACK");} catch {} await db.end();}
    if (created) await admin.query('DROP DATABASE "'+dbName+'" WITH (FORCE)');
    await admin.end();
  }
});
