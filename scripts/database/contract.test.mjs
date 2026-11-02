// Creates and removes only a random bsmoss_contract_* database on a local test cluster.
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
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
import { planRefreshJob } from "../../portals/app/app/domains/aggregation/refresh-jobs.ts";
import { PgRefreshJobs } from "../../portals/app/app/domains/aggregation/pg-refresh-jobs.ts";
import { executeRefreshLease } from "../../portals/app/app/domains/aggregation/refresh-execution.ts";
import { enqueueAuthorizedRefresh, enqueuePeriodicRefresh, enqueueRevisionRefresh } from "../../portals/app/app/domains/aggregation/refresh-enqueue.ts";
import { claimAuthorizedRefresh, runRefreshStep } from "../../portals/app/app/domains/aggregation/refresh-supervision.ts";
import { PgStateSnapshotReader } from "../../portals/app/app/domains/aggregation/pg-state-snapshot.ts";
import { PgStateAggregateStore } from "../../portals/app/app/domains/aggregation/pg-state-store.ts";
import { aggregateStatePeriod } from "../../portals/app/app/domains/aggregation/state-period.ts";
import { dispatchInputChange, pendingInputChanges, superviseInputChange, runInputRefreshStep, reopenInputChange } from "../../portals/app/app/domains/aggregation/pg-input-refresh.ts";
import { inputRefreshSubscription } from "../../portals/app/app/domains/aggregation/input-refresh.ts";
import { readRefreshSnapshot } from "../../portals/app/app/domains/aggregation/refresh-snapshot.ts";
import { PgAggregateQueryReader } from "../../portals/app/app/domains/aggregation/pg-query.ts";
import { createAuthorizedAggregateQuery } from "../../portals/app/app/domains/access/aggregate-query.ts";
import { PgGaugeSnapshotReader } from "../../portals/app/app/domains/aggregation/pg-gauge-snapshot.ts";
import { PgGaugeAggregateStore } from "../../portals/app/app/domains/aggregation/pg-gauge-store.ts";
import { aggregateGaugePeriod } from "../../portals/app/app/domains/aggregation/gauge-period.ts";
import { registeredPeriodicCases } from "./registered-periodic.cases.mjs";
import { registeredInputCases } from "./registered-input.cases.mjs";
import { objectRollupCases } from "./object-rollup.cases.mjs";
import { reportSnapshotCases } from "./report-snapshot.cases.mjs";
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
      assert.equal(tables.rows[0].n,47);
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
      const active=await snapshotReader.load(snapshotTarget);assert.equal(active.plan.mappingWindows.length,3);
      assert.ok(active.inputs.every(r=>Date.parse(r.period.start)>=Date.parse(snapshotTime(15))));
      await db.query("UPDATE bsmoss_resource.station_service SET valid_from='2026-01-01Z' WHERE id='svc'");
    });
    await t.test('snapshot rejects coarse/straddling evidence and missing quality instead of silently dropping it',async()=>{
      await store.append(snapshotDraft(3,{revision:'3',previousRevision:'2',payloadSha256:'d'.repeat(64),periodStart:snapshotTime(50),periodEnd:snapshotTime(65)}));
      await assert.rejects(snapshotReader.load(snapshotTarget),/unexpected_or_coarse_window/);
      await store.append(snapshotDraft(3,{revision:'4',previousRevision:'3',payloadSha256:'e'.repeat(64)}));
      // Deliberate owner-only corruption fixture; runtime cannot delete either
      // the captured change or its quality evidence.
      await db.query("DELETE FROM bsmoss_metering.input_change WHERE change_kind='quality' AND measurement_id IN (SELECT id FROM bsmoss_metering.measurement WHERE event_id='snapshot-3' AND event_revision=4)");
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
    const refreshSnapshot=await snapshotReader.load(rollTarget);
    const refreshScope={workspaceId:'w',series:[{sourceId:'src',subjectKey:refreshSnapshot.plan.subjectKey,metricKey:'service.data.uplink_bytes@1'}]};
    const queue=new PgRefreshJobs(adapterPool,refreshScope);
    const jobFor=trigger=>planRefreshJob(refreshSnapshot,rollTarget,trigger);
    let completedJob;
    const forceReady=id=>db.query("UPDATE bsmoss_analysis.refresh_job SET available_at=clock_timestamp()-interval '1 second' WHERE workspace_id='w' AND id=$1",[id]);
    const expire=id=>db.query("UPDATE bsmoss_analysis.refresh_job SET lease_until=clock_timestamp()-interval '1 second' WHERE workspace_id='w' AND id=$1",[id]);
    await t.test('durable refresh jobs dedupe concurrent triggers and compatible mapping anchors without resurrecting completed work',async()=>{
      const job=jobFor('fixture:revision:one');
      const outcomes=await Promise.all([queue.enqueue(job),queue.enqueue(job)]);
      assert.deepEqual(outcomes.map(r=>r.status).sort(),['duplicate','inserted']);assert.equal(new Set(outcomes.map(r=>r.id)).size,1);
      const alternate=planRefreshJob(refreshSnapshot,{...rollTarget,mappingId:'roll-new'},job.triggerRef);
      assert.equal((await queue.enqueue(alternate)).status,'duplicate');
      const lease=await queue.claim();completedJob=lease.id;assert.equal(lease.attempt,1);assert.deepEqual(lease.job,job);
      assert.equal(await queue.claim(),null);
      const renewed=await queue.renew(lease,120);assert.ok(Date.parse(renewed.leaseUntil)>=Date.parse(lease.leaseUntil));
      await queue.succeed(renewed,'fixture://aggregate/'+rollSeries+'/3');
      await assert.rejects(queue.succeed(lease,'fixture://duplicate'),/refresh_lease_lost/);
      assert.equal((await queue.enqueue(job)).status,'duplicate');assert.equal(await queue.claim(),null);
      const receipts=(await db.query('SELECT attempt,outcome,result_ref FROM bsmoss_analysis.refresh_attempt WHERE job_id=$1',[lease.id])).rows;
      assert.deepEqual(receipts,[{attempt:'1',outcome:'succeeded',result_ref:'fixture://aggregate/'+rollSeries+'/3'}]);
      await assert.rejects(queue.enqueue(job,2),/conflicting_refresh_replay/);
    });
    await t.test('competing queue workers claim different rows and foreign scopes cannot claim or finish leases',async()=>{
      for(const trigger of ['fixture:parallel:a','fixture:parallel:b'])await queue.enqueue(jobFor(trigger));
      const [a,b]=await Promise.all([queue.claim(),new PgRefreshJobs(adapterPool,refreshScope).claim()]);assert.ok(a&&b);assert.notEqual(a.id,b.id);assert.notEqual(a.token,b.token);
      const denied=new PgRefreshJobs(adapterPool,{workspaceId:'other',series:refreshScope.series});assert.equal(await denied.claim(),null);
      await assert.rejects(denied.succeed(a,'fixture://foreign'),/refresh_scope_denied/);
      const wrongSubject=new PgRefreshJobs(adapterPool,{workspaceId:'w',series:[{...refreshScope.series[0],subjectKey:'foreign'}]});assert.equal(await wrongSubject.claim(),null);
      await assert.rejects(wrongSubject.enqueue(jobFor('fixture:denied')),/refresh_scope_denied/);
      await queue.succeed(a,'fixture://parallel-a');await queue.succeed(b,'fixture://parallel-b');
    });
    await t.test('refresh failure records bounded retries and reaches terminal dead without leaking raw errors',async()=>{
      const request=await queue.enqueue(jobFor('fixture:retry'),2);
      let lease=await queue.claim();assert.equal(lease.id,request.id);
      await assert.rejects(queue.fail(lease,'Error: secret=value'),/invalid_refresh_failure_code/);
      await queue.fail(lease,'source_unavailable');assert.equal(await queue.claim(),null);
      const pending=(await db.query('SELECT status,available_at>clock_timestamp() AS delayed FROM bsmoss_analysis.refresh_job WHERE id=$1',[lease.id])).rows[0];
      assert.deepEqual(pending,{status:'pending',delayed:true});await forceReady(lease.id);
      lease=await new PgRefreshJobs(adapterPool,refreshScope).claim();assert.equal(lease.attempt,2);
      await queue.fail(lease,'source_unavailable');assert.equal(await queue.claim(),null);
      const receipts=(await db.query('SELECT attempt,outcome,failure_code FROM bsmoss_analysis.refresh_attempt WHERE job_id=$1 ORDER BY attempt',[lease.id])).rows;
      assert.deepEqual(receipts,[{attempt:'1',outcome:'retry',failure_code:'source_unavailable'},{attempt:'2',outcome:'dead',failure_code:'source_unavailable'}]);
      assert.equal((await queue.enqueue(jobFor('fixture:retry'),2)).status,'duplicate');
    });
    await t.test('expired refresh leases are fenced and reclaimed after adapter restart with append-only expiration receipts',async()=>{
      await queue.enqueue(jobFor('fixture:expired'),2);const old=await queue.claim();await expire(old.id);
      await assert.rejects(queue.renew(old),/refresh_lease_lost/);await assert.rejects(queue.succeed(old,'fixture://stale'),/refresh_lease_lost/);
      const replacement=await new PgRefreshJobs(adapterPool,refreshScope).claim();assert.equal(replacement.id,old.id);assert.equal(replacement.attempt,2);assert.notEqual(replacement.token,old.token);
      await assert.rejects(queue.fail(old,'late_failure'),/refresh_lease_lost/);await assert.rejects(queue.succeed({...replacement,token:old.token},'fixture://forged'),/refresh_lease_lost/);
      await queue.succeed(replacement,'fixture://recovered');
      const receipts=(await db.query('SELECT outcome FROM bsmoss_analysis.refresh_attempt WHERE job_id=$1 ORDER BY attempt',[old.id])).rows;
      assert.deepEqual(receipts,[{outcome:'expired'},{outcome:'succeeded'}]);
      await queue.enqueue(jobFor('fixture:expired-final'),1);const final=await queue.claim();await expire(final.id);
      assert.equal(await queue.claim(),null);assert.equal((await db.query('SELECT status FROM bsmoss_analysis.refresh_job WHERE id=$1',[final.id])).rows[0].status,'dead');
      assert.equal((await db.query('SELECT outcome FROM bsmoss_analysis.refresh_attempt WHERE job_id=$1',[final.id])).rows[0].outcome,'expired');
    });
    await t.test('refresh queue locks identity columns and preserves attempt evidence under runtime grants',async()=>{
      for(const sql of ["UPDATE bsmoss_analysis.refresh_job SET subject_key='forged'","UPDATE bsmoss_analysis.refresh_job SET max_attempts=8",
        "UPDATE bsmoss_analysis.refresh_job SET target='{}'",'DELETE FROM bsmoss_analysis.refresh_job','TRUNCATE bsmoss_analysis.refresh_job CASCADE',
        "UPDATE bsmoss_analysis.refresh_attempt SET outcome='succeeded'",'DELETE FROM bsmoss_analysis.refresh_attempt','TRUNCATE bsmoss_analysis.refresh_attempt']) await assert.rejects(adapterPool.query(sql),e=>e.code==='42501');
      await assert.rejects(db.query("INSERT INTO bsmoss_analysis.refresh_attempt(workspace_id,job_id,attempt,lease_token,outcome,result_ref) VALUES ('other',$1,1,$2,'succeeded','fixture://foreign')",[completedJob,randomUUID()]),e=>e.code==='23503');
      await assert.rejects(db.query("UPDATE bsmoss_analysis.refresh_job SET status='leased' WHERE id=$1",[completedJob]),e=>e.code==='23514');
      await assert.rejects(db.query("UPDATE bsmoss_analysis.refresh_job SET attempt=9 WHERE id=$1",[completedJob]),e=>e.code==='23514');
    });
    await t.test('authorized refresh execution commits aggregate revision, outbox and success receipt atomically',async()=>{
      await queue.enqueue(jobFor('fixture:execute:one'));const lease=await queue.claim();
      const result=await executeRefreshLease(adapterPool,snapshotPorts,lease);assert.equal(result.status,'inserted');
      const receipt=(await db.query('SELECT outcome,result_ref FROM bsmoss_analysis.refresh_attempt WHERE job_id=$1',[lease.id])).rows[0];
      assert.deepEqual(receipt,{outcome:'succeeded',result_ref:JSON.stringify(['bsmoss-aggregate',result.seriesId,result.revision])});
      assert.equal((await db.query('SELECT status FROM bsmoss_analysis.refresh_job WHERE id=$1',[lease.id])).rows[0].status,'succeeded');
      const count=(await db.query('SELECT count(*)::int AS n FROM bsmoss_analysis.aggregate_outbox WHERE series_id=$1',[result.seriesId])).rows[0].n;
      await queue.enqueue(jobFor('fixture:execute:replay'));const replay=await queue.claim();
      assert.equal((await executeRefreshLease(adapterPool,snapshotPorts,replay)).status,'duplicate');
      assert.equal((await db.query('SELECT count(*)::int AS n FROM bsmoss_analysis.aggregate_outbox WHERE series_id=$1',[result.seriesId])).rows[0].n,count);
      assert.equal((await db.query('SELECT outcome FROM bsmoss_analysis.refresh_attempt WHERE job_id=$1',[replay.id])).rows[0].outcome,'succeeded');
    });
    await t.test('expired or foreign refresh lease cannot publish or acknowledge any result',async()=>{
      await queue.enqueue(jobFor('fixture:execute:expired'));const lease=await queue.claim();await expire(lease.id);
      const count=(await db.query('SELECT count(*)::int AS n FROM bsmoss_analysis.aggregate_revision')).rows[0].n;
      await assert.rejects(executeRefreshLease(adapterPool,snapshotPorts,lease),/refresh_lease_lost/);
      assert.equal((await db.query('SELECT count(*)::int AS n FROM bsmoss_analysis.aggregate_revision')).rows[0].n,count);
      assert.equal((await db.query('SELECT 1 FROM bsmoss_analysis.refresh_attempt WHERE job_id=$1',[lease.id])).rowCount,0);
      const next=await queue.claim();assert.equal(next.id,lease.id);
      const denied={...snapshotPorts,async readLocalGrant(){return null;}};
      await assert.rejects(executeRefreshLease(adapterPool,denied,next),/permission_denied/);
      const wrong={...next,job:planRefreshJob({...refreshSnapshot,plan:{...refreshSnapshot.plan,subjectKey:'foreign'}},rollTarget,'fixture:foreign')};
      await assert.rejects(executeRefreshLease(adapterPool,snapshotPorts,wrong),/refresh_snapshot_mismatch/);
      await queue.fail(next,'authorization_denied');
      await forceReady(next.id);const last=await queue.claim();await queue.succeed(last,'fixture://cancelled-test');
    });
    await t.test('failure while recording refresh success rolls back aggregate, head and outbox',async()=>{
      await store.append(draft('roll-0',{mappingId:'roll-old',revision:'4',previousRevision:'3',payloadSha256:'d'.repeat(64),periodStart:snapshotTime(0),periodEnd:snapshotTime(15),value:{kind:'integer_delta',value:'40'}}));
      await queue.enqueue(jobFor('fixture:execute:rollback'));const lease=await queue.claim();
      const before=(await db.query('SELECT current_revision FROM bsmoss_analysis.aggregate_series WHERE id=$1',[rollSeries])).rows[0].current_revision;
      const outbox=(await db.query('SELECT count(*)::int AS n FROM bsmoss_analysis.aggregate_outbox WHERE series_id=$1',[rollSeries])).rows[0].n;
      const injected={async connect(){const client=await adapterPool.connect();return {async query(sql,args){if(sql.includes('INSERT INTO bsmoss_analysis.refresh_attempt'))throw Error('fixture_receipt_failure');return client.query(sql,args);},release(discard){client.release(discard);}};},query(...args){return adapterPool.query(...args);}};
      await assert.rejects(executeRefreshLease(injected,snapshotPorts,lease),/fixture_receipt_failure/);
      assert.equal((await db.query('SELECT current_revision FROM bsmoss_analysis.aggregate_series WHERE id=$1',[rollSeries])).rows[0].current_revision,before);
      assert.equal((await db.query('SELECT count(*)::int AS n FROM bsmoss_analysis.aggregate_revision WHERE series_id=$1',[rollSeries])).rows[0].n,Number(before));
      assert.equal((await db.query('SELECT count(*)::int AS n FROM bsmoss_analysis.aggregate_outbox WHERE series_id=$1',[rollSeries])).rows[0].n,outbox);
      assert.equal((await db.query('SELECT 1 FROM bsmoss_analysis.refresh_attempt WHERE job_id=$1',[lease.id])).rowCount,0);
      const recovered=await executeRefreshLease(adapterPool,snapshotPorts,lease);assert.equal(recovered.status,'inserted');assert.equal(recovered.revision,String(Number(before)+1));
    });
    await t.test('refresh expected-head conflict keeps its lease retryable and never overwrites a newer correction',async()=>{
      await store.append(draft('roll-0',{mappingId:'roll-old',revision:'5',previousRevision:'4',payloadSha256:'e'.repeat(64),periodStart:snapshotTime(0),periodEnd:snapshotTime(15),value:{kind:'integer_delta',value:'50'}}));
      await queue.enqueue(jobFor('fixture:execute:head-conflict'));const lease=await queue.claim();let changed=false;
      const intercepted={async connect(){const client=await adapterPool.connect();return {async query(sql,args){const result=await client.query(sql,args);
        if(!changed&&sql.includes('SELECT s.id,r.revision')){changed=true;
          await store.append(draft('roll-0',{mappingId:'roll-old',revision:'6',previousRevision:'5',payloadSha256:'f'.repeat(64),periodStart:snapshotTime(0),periodEnd:snapshotTime(15),value:{kind:'integer_delta',value:'60'}}));
          await snapshotApi.recompute({...rollTarget,expectedRevision:result.rows[0].revision});
        }return result;},release(discard){client.release(discard);}};}};
      await assert.rejects(executeRefreshLease(intercepted,snapshotPorts,lease),e=>e.code==='40001'||/aggregate_revision_conflict/.test(e.message));assert.equal(changed,true);
      assert.equal((await db.query('SELECT 1 FROM bsmoss_analysis.refresh_attempt WHERE job_id=$1',[lease.id])).rowCount,0);
      const current=(await db.query('SELECT r.integer_value FROM bsmoss_analysis.aggregate_series s JOIN bsmoss_analysis.aggregate_revision r ON (r.workspace_id,r.series_id,r.revision)=(s.workspace_id,s.id,s.current_revision) WHERE s.id=$1',[rollSeries])).rows[0];
      assert.equal(current.integer_value,'90');
      const retry=await executeRefreshLease(adapterPool,snapshotPorts,lease);assert.equal(retry.status,'duplicate');
      assert.equal((await db.query('SELECT outcome FROM bsmoss_analysis.refresh_attempt WHERE job_id=$1',[lease.id])).rows[0].outcome,'succeeded');
    });
    await t.test('lease completion checks database expiry after waiting for a row lock',async()=>{
      await queue.enqueue(jobFor('fixture:execute:lock-wait'));const lease=await queue.claim();
      const holder=new Client({connectionString:target.toString()});await holder.connect();
      try {
        await holder.query('BEGIN');await holder.query("SELECT 1 FROM bsmoss_analysis.refresh_job WHERE workspace_id='w' AND id=$1 FOR UPDATE",[lease.id]);
        const outcome=queue.succeed(lease,'fixture://wait-expired').then(()=>({ok:true}),error=>({ok:false,error}));
        await holder.query("UPDATE bsmoss_analysis.refresh_job SET lease_until=clock_timestamp()-interval '1 second' WHERE workspace_id='w' AND id=$1",[lease.id]);
        await holder.query('COMMIT');const result=await outcome;assert.equal(result.ok,false);assert.match(result.error.message,/refresh_lease_lost/);
        assert.equal((await db.query('SELECT 1 FROM bsmoss_analysis.refresh_attempt WHERE job_id=$1',[lease.id])).rowCount,0);
        const retry=await queue.claim();await queue.succeed(retry,'fixture://after-wait');
      } finally {await holder.query('ROLLBACK');await holder.end();}
    });
    await t.test('refresh snapshot cannot adopt a newer head and overwrite its newer facts',async()=>{
      await store.append(draft('roll-0',{mappingId:'roll-old',revision:'7',previousRevision:'6',payloadSha256:'a'.repeat(64),periodStart:snapshotTime(0),periodEnd:snapshotTime(15),value:{kind:'integer_delta',value:'70'}}));
      await queue.enqueue(jobFor('fixture:execute:snapshot-before-head'));const lease=await queue.claim();let corrected=false;
      const before=(await db.query('SELECT current_revision FROM bsmoss_analysis.aggregate_series WHERE id=$1',[rollSeries])).rows[0].current_revision;
      const intercepted={async connect(){const client=await adapterPool.connect();return {async query(sql,args){const result=await client.query(sql,args);
        if(!corrected&&sql.includes('SELECT m.*,r.payload_sha256')){corrected=true;
          await store.append(draft('roll-0',{mappingId:'roll-old',revision:'8',previousRevision:'7',payloadSha256:'b'.repeat(64),periodStart:snapshotTime(0),periodEnd:snapshotTime(15),value:{kind:'integer_delta',value:'80'}}));
          await snapshotApi.recompute({...rollTarget,expectedRevision:before});
        }return result;},release(discard){client.release(discard);}};},query(...args){return adapterPool.query(...args);}};
      let failure;try{await executeRefreshLease(intercepted,snapshotPorts,lease);}catch(error){failure=error;}
      assert.equal(corrected,true);
      const current=(await db.query('SELECT r.integer_value FROM bsmoss_analysis.aggregate_series s JOIN bsmoss_analysis.aggregate_revision r ON (r.workspace_id,r.series_id,r.revision)=(s.workspace_id,s.id,s.current_revision) WHERE s.id=$1',[rollSeries])).rows[0];
      assert.equal(current.integer_value,'110','the older snapshot must not become the current result');
      assert.ok(failure,'the stale execution must leave its task unacknowledged');
      assert.equal((await db.query('SELECT 1 FROM bsmoss_analysis.refresh_attempt WHERE job_id=$1',[lease.id])).rowCount,0);
      const retry=await executeRefreshLease(adapterPool,snapshotPorts,lease);assert.equal(retry.status,'duplicate');
    });
    await t.test('authorized enqueue resolves targets to stable subjects and replays a whole batch',async()=>{
      const input={targets:[rollTarget,{...rollTarget,mappingId:'roll-new'}],triggerRef:'fixture:coordinator:aliases'};
      const first=await enqueueAuthorizedRefresh(adapterPool,snapshotPorts,input);assert.equal(first.requestedTargets,2);assert.equal(first.jobs.length,1);assert.equal(first.jobs[0].status,'inserted');
      const replay=await enqueueAuthorizedRefresh(adapterPool,snapshotPorts,{...input,targets:[...input.targets].reverse()});
      assert.equal(replay.manifestSha256,first.manifestSha256);assert.equal(replay.jobs[0].id,first.jobs[0].id);assert.equal(replay.jobs[0].status,'duplicate');
      const denied={...snapshotPorts,async readLocalGrant(){return {...await snapshotPorts.readLocalGrant(),scope:{...scope,serviceIds:[]}};}};
      await assert.rejects(enqueueAuthorizedRefresh(adapterPool,denied,{targets:[rollTarget],triggerRef:'fixture:coordinator:denied'}),/object_scope_denied/);
      assert.equal((await db.query("SELECT 1 FROM bsmoss_analysis.refresh_job WHERE trigger_ref='fixture:coordinator:denied'")).rowCount,0);
      const lease=await queue.claim();assert.equal(lease.id,first.jobs[0].id);await executeRefreshLease(adapterPool,snapshotPorts,lease);
    });
    await t.test('batch enqueue failure or access expiry leaves no partial queued jobs',async()=>{
      const input={targets:[rollTarget,depTarget],triggerRef:'fixture:coordinator:atomic'};let inserted=0;
      const intercepted={async connect(){const client=await adapterPool.connect();return {async query(sql,args){if(sql.includes('INSERT INTO bsmoss_analysis.refresh_job')&&++inserted===2)throw Error('fixture_queue_failure');return client.query(sql,args);},release(discard){client.release(discard);}};}};
      await assert.rejects(enqueueAuthorizedRefresh(intercepted,snapshotPorts,input),/fixture_queue_failure/);assert.equal(inserted,2);
      assert.equal((await db.query('SELECT 1 FROM bsmoss_analysis.refresh_job WHERE trigger_ref=$1',[input.triggerRef])).rowCount,0);
      const completed=await enqueueAuthorizedRefresh(adapterPool,snapshotPorts,input);assert.equal(completed.jobs.length,2);assert.ok(completed.jobs.every(j=>j.status==='inserted'));
      const allQueue=new PgRefreshJobs(adapterPool,{workspaceId:'w',series:[...refreshScope.series,{sourceId:'src',subjectKey:(await snapshotReader.load(depTarget)).plan.subjectKey,metricKey:depTarget.metric.code+'@1'}]});
      for(let i=0;i<2;i++)await executeRefreshLease(adapterPool,snapshotPorts,await allQueue.claim());
      let clock=Date.now();const timed={...snapshotPorts,now:()=>clock};
      const delayed={async connect(){const client=await adapterPool.connect();return {async query(sql,args){const result=await client.query(sql,args);if(sql.includes('SELECT m.*,r.payload_sha256'))clock+=120000;return result;},release(discard){client.release(discard);}};}};
      await assert.rejects(enqueueAuthorizedRefresh(delayed,timed,{targets:[rollTarget],triggerRef:'fixture:coordinator:expired'}),/access_expired/);
      assert.equal((await db.query("SELECT 1 FROM bsmoss_analysis.refresh_job WHERE trigger_ref='fixture:coordinator:expired'")).rowCount,0);
    });
    await t.test('periodic coordination enqueues closed windows with a replayable server-clock scan trigger',async()=>{
      const clock=Date.parse('2026-02-03T10:05:00Z'),timed={...snapshotPorts,now:()=>clock};
      const seeds=[{sourceId:'src',mappingId:'roll-old',metric:rollTarget.metric,notBefore:'2026-02-01T00:00:00Z',grains:['day']}];
      const first=await enqueuePeriodicRefresh(adapterPool,timed,seeds);assert.equal(first.jobs.length,2);
      const replay=await enqueuePeriodicRefresh(adapterPool,timed,seeds);assert.equal(replay.manifestSha256,first.manifestSha256);assert.ok(replay.jobs.every(j=>j.status==='duplicate'));
      const saved=(await db.query('SELECT target FROM bsmoss_analysis.refresh_job WHERE id=ANY($1::text[])',[first.jobs.map(j=>j.id)])).rows;
      assert.deepEqual(saved.map(j=>j.target.at).sort(),['2026-01-31T16:00:00.000Z','2026-02-01T16:00:00.000Z']);
      assert.ok(saved.every(j=>j.target.grain==='day'));
    });
    await t.test('revision coordination queues old and new object windows beyond the periodic lookback',async()=>{
      const impacts=[{sourceId:'src',mappingId:'roll-old',metric:rollTarget.metric,affected:[{start:'2026-07-31T15:45:00Z',end:'2026-07-31T16:00:00Z'}],grains:['day','month']},
        {sourceId:'src',mappingId:'dependency-map',metric:rollTarget.metric,affected:[{start:'2026-10-20T00:00:00Z',end:'2026-10-20T00:15:00Z'}],grains:['day','month']}];
      const first=await enqueueRevisionRefresh(adapterPool,snapshotPorts,impacts,'fixture:measurement-moved:2');assert.equal(first.jobs.length,4);
      const replay=await enqueueRevisionRefresh(adapterPool,snapshotPorts,[...impacts].reverse(),'fixture:measurement-moved:2');assert.equal(replay.manifestSha256,first.manifestSha256);assert.ok(replay.jobs.every(j=>j.status==='duplicate'));
      const rows=(await db.query('SELECT subject_key,target FROM bsmoss_analysis.refresh_job WHERE id=ANY($1::text[])',[first.jobs.map(j=>j.id)])).rows;
      assert.equal(new Set(rows.map(r=>r.subject_key)).size,2);assert.ok(rows.some(r=>r.target.at==='2026-06-30T16:00:00.000Z'));assert.ok(rows.some(r=>r.target.at==='2026-09-30T16:00:00.000Z'));
      const next=await enqueueRevisionRefresh(adapterPool,snapshotPorts,impacts,'fixture:measurement-moved:3');assert.equal(next.jobs.length,4);assert.ok(next.jobs.every(j=>j.status==='inserted'));
    });
    await db.query(`INSERT INTO bsmoss_resource.station_service VALUES ('w','supervise-svc','st','op','2026-01-01Z','2027-01-01Z');
      INSERT INTO bsmoss_resource.network_object VALUES ('w','supervise-cell','st','supervise-svc','cell');
      INSERT INTO bsmoss_integration.source_mapping(workspace_id,id,source_id,external_type,external_id,station_id,service_id,network_object_id,version,valid_from,valid_to)
      VALUES ('w','supervise-map','src','cell','supervise-external','st','supervise-svc','supervise-cell',1,'2026-01-01Z','2027-01-01Z')`);
    const superviseTarget={...rollTarget,mappingId:'supervise-map'};
    let superviseGrant=true;
    const supervisePorts={...snapshotPorts,async readLocalGrant(){return superviseGrant?{...await snapshotPorts.readLocalGrant(),scope:{...scope,serviceIds:['supervise-svc']}}:null;}};
    await t.test('authorized supervisor claims only currently granted objects and atomically executes one queued job',async()=>{
      const queued=await enqueueAuthorizedRefresh(adapterPool,supervisePorts,{targets:[superviseTarget],triggerRef:'fixture:supervise:success'});
      const denied={...supervisePorts,async readLocalGrant(){return {...await snapshotPorts.readLocalGrant(),scope:{...scope,serviceIds:[],deviceIds:[],allowSiteParameters:false}};}};
      assert.equal(await claimAuthorizedRefresh(adapterPool,denied),null);
      const result=await runRefreshStep(adapterPool,supervisePorts);assert.equal(result.status,'succeeded');assert.equal(result.jobId,queued.jobs[0].id);
      const stored=(await db.query('SELECT result_payload FROM bsmoss_analysis.aggregate_revision WHERE series_id=$1',[result.result.seriesId])).rows[0].result_payload;
      assert.equal(stored.completeness,'missing');assert.equal(stored.value,null);
      assert.equal((await runRefreshStep(adapterPool,supervisePorts)).status,'idle');
    });
    await t.test('supervisor records bounded execution failures without raw error text and can recover',async()=>{
      const queued=await enqueueAuthorizedRefresh(adapterPool,supervisePorts,{targets:[superviseTarget],triggerRef:'fixture:supervise:retry'});
      await db.query("UPDATE bsmoss_integration.source_capability SET status='planned' WHERE id='snapshot-cap'");
      try {
        const result=await runRefreshStep(adapterPool,supervisePorts);assert.equal(result.status,'failure_recorded');assert.equal(result.code,'execution_failed');assert.equal(result.jobId,queued.jobs[0].id);
        const receipt=(await db.query('SELECT outcome,failure_code FROM bsmoss_analysis.refresh_attempt WHERE job_id=$1',[result.jobId])).rows[0];
        assert.deepEqual(receipt,{outcome:'retry',failure_code:'execution_failed'});assert.equal((await runRefreshStep(adapterPool,supervisePorts)).status,'idle');
      } finally {await db.query("UPDATE bsmoss_integration.source_capability SET status='active' WHERE id='snapshot-cap'");}
      await forceReady(queued.jobs[0].id);assert.equal((await runRefreshStep(adapterPool,supervisePorts)).status,'succeeded');
    });
    await t.test('revoked supervisor grants cannot execute or fail a previously claimed lease',async()=>{
      const queued=await enqueueAuthorizedRefresh(adapterPool,supervisePorts,{targets:[superviseTarget],triggerRef:'fixture:supervise:revoked'});
      const lease=await claimAuthorizedRefresh(adapterPool,supervisePorts);assert.equal(lease.id,queued.jobs[0].id);superviseGrant=false;
      try {await assert.rejects(executeRefreshLease(adapterPool,supervisePorts,lease),/permission_denied/);await assert.rejects(runRefreshStep(adapterPool,supervisePorts),/permission_denied/);}
      finally {superviseGrant=true;}
      assert.equal((await db.query('SELECT 1 FROM bsmoss_analysis.refresh_attempt WHERE job_id=$1',[lease.id])).rowCount,0);
      await expire(lease.id);const recovered=await runRefreshStep(adapterPool,supervisePorts);assert.equal(recovered.status,'succeeded');assert.equal(recovered.jobId,lease.id);
      assert.deepEqual((await db.query('SELECT outcome FROM bsmoss_analysis.refresh_attempt WHERE job_id=$1 ORDER BY attempt',[lease.id])).rows,[{outcome:'expired'},{outcome:'succeeded'}]);
    });
    await t.test('supervisor cannot claim an unverified mapping anchor through another job sharing its tuple',async()=>{
      const snapshot=await new PgAggregateSnapshotReader(adapterPool,{...scope,serviceIds:['supervise-svc']}).load(superviseTarget);
      const trustedQueue=new PgRefreshJobs(adapterPool,{workspaceId:'w',series:[{sourceId:'src',subjectKey:snapshot.plan.subjectKey,metricKey:superviseTarget.metric.code+'@1'}]});
      const malformed=await trustedQueue.enqueue(planRefreshJob(snapshot,{...superviseTarget,mappingId:'roll-old'},'fixture:supervise:wrong-anchor'));
      const valid=await enqueueAuthorizedRefresh(adapterPool,supervisePorts,{targets:[superviseTarget],triggerRef:'fixture:supervise:verified-anchor'});
      const result=await runRefreshStep(adapterPool,supervisePorts);assert.equal(result.status,'succeeded');assert.equal(result.jobId,valid.jobs[0].id);
      assert.equal((await db.query('SELECT status FROM bsmoss_analysis.refresh_job WHERE id=$1',[malformed.id])).rows[0].status,'pending');
      assert.equal((await runRefreshStep(adapterPool,supervisePorts)).status,'idle');
    });
    const stateMetric={code:'runtime.device.state',version:1};
    const stateScope={...scope,serviceIds:[],deviceIds:['state-device','whole-device','switch-device','moved-device'],allowSiteParameters:false};
    const stateReader=new PgStateSnapshotReader(adapterPool,stateScope),stateMeasurements=new PgMeasurementStore(adapterPool,stateScope,FIRST_METRICS);
    const statePolicy={stateAggregation:{version:1,authorityRef:'fixture://reviewed-heartbeat',maxHoldMilliseconds:3600000}};
    await db.query(`INSERT INTO bsmoss_integration.source_capability VALUES ('w','state-cap','src','runtime.device.state',1,'event','active','fixture://state-validation',$1,'2026-01-01Z','2027-01-01Z')`,[statePolicy]);
    for(const name of ['state','whole','switch','moved']) {
      await db.query("INSERT INTO bsmoss_resource.device VALUES ('w',$1,'st','controller','tower')",[name+'-device']);
      if(name!=='switch')await db.query(`INSERT INTO bsmoss_integration.source_mapping(workspace_id,id,source_id,external_type,external_id,station_id,device_id,version,valid_from,valid_to)
        VALUES ('w',$1,'src','device',$1,'st',$2,1,'2026-01-01Z','2027-01-01Z')`,[name+'-map',name+'-device']);
    }
    const stateTarget=(name='state')=>({sourceId:'src',mappingId:name+'-map',metric:stateMetric,grain:'hour',at:snapshotTime(0)});
    const stateDraft=(id,at,until,state,patch={})=>draft('state:'+id,{metric:stateMetric,componentKey:'status',mappingId:'state-map',periodStart:snapshotTime(at),periodEnd:snapshotTime(until),value:{kind:'state_event',state,validUntil:snapshotTime(until)},...patch});
    const stateResult=async(target=stateTarget())=>{const s=await stateReader.load(target);return {snapshot:s,result:aggregateStatePeriod(s.plan,s.inputs)};};
    async function stateAttest(revision,status='confirmed',target=stateTarget('whole'),patch={}) {
      const s=await stateReader.load(target),plan={...s.plan,sourceComplete:false,watermark:s.plan.period.start};delete plan.completionEvidence;
      const base=aggregateStatePeriod(plan,s.inputs),object=(await db.query('SELECT station_id,service_id,network_object_id,device_id FROM bsmoss_integration.source_mapping WHERE workspace_id=$1 AND id=$2',['w',target.mappingId])).rows[0];
      const row={workspace_id:'w',id:randomUUID(),source_id:'src',...object,metric_code:stateMetric.code,metric_version:1,grain:'hour',period_start:plan.period.start,period_end:plan.period.end,revision,status,
        input_fingerprint:base.inputFingerprint,mapping_manifest_sha256:mappingSetFingerprint(base.mappingWindows),watermark:status==='confirmed'?plan.period.end:plan.period.start,
        evidence_ref:'fixture://state-proof/'+revision,evidence_sha256:'e'.repeat(64),recorded_by:'reviewed-import',...patch};
      const keys=Object.keys(row);await db.query('INSERT INTO bsmoss_integration.source_completion_set('+keys.join(',')+') VALUES ('+keys.map((_,i)=>'$'+(i+1)).join(',')+')',Object.values(row));
    }
    await t.test('state snapshots retain carry-in, heartbeat expiry, pending blockers and exact durations',async()=>{
      await stateMeasurements.append(stateDraft('carry',-10,20,'running'));
      await stateMeasurements.append(stateDraft('fault',10,35,'fault'));
      await stateMeasurements.append(stateDraft('return',45,60,'running'));
      let {result}=await stateResult();assert.equal(result.value.durationMilliseconds.running,'1500000');assert.equal(result.value.durationMilliseconds.fault,'1500000');assert.equal(result.value.durationMilliseconds.unknown,'600000');assert.equal(result.completeness,'partial');
      await stateAttest('1','confirmed',stateTarget());({result}=await stateResult());assert.equal(result.completeness,'partial');assert.ok(!result.reasons.includes('source_unconfirmed'));
      await stateMeasurements.append(stateDraft('blocker',-5,-1,'standby',{quality:{status:'pending',reason:'fixture',ruleVersion:'1',decidedBy:'worker'}}));
      ({result}=await stateResult());assert.equal(result.value.durationMilliseconds.running,'900000');assert.equal(result.value.durationMilliseconds.unknown,'1200000');assert.ok(result.reasons.includes('pending_quality'));assert.ok(result.reasons.includes('source_confirmation_stale'));
    });
    let stateAggregateStore,stateKey,stateSeries;
    await t.test('state values persist, replay and reconstruct from append-only manifests under runtime role',async()=>{
      await stateMeasurements.append(stateDraft('whole',0,60,'running',{mappingId:'whole-map'}));
      const {snapshot,result}=await stateResult(stateTarget('whole'));stateKey=snapshot.plan;
      stateAggregateStore=new PgStateAggregateStore(adapterPool,{workspaceId:'w',series:[{sourceId:'src',subjectKey:stateKey.subjectKey,metricKey:'runtime.device.state@1'}]});
      const first=await stateAggregateStore.publish(snapshot.plan,snapshot.inputs,null,'state-worker');stateSeries=first.seriesId;assert.equal(first.status,'inserted');
      assert.equal((await stateAggregateStore.publish(snapshot.plan,snapshot.inputs,null,'state-worker')).status,'duplicate');
      const row=(await db.query('SELECT * FROM bsmoss_analysis.aggregate_revision WHERE series_id=$1',[stateSeries])).rows[0];
      assert.equal(row.value_kind,'state');assert.equal(row.integer_value,null);assert.deepEqual(row.state_value,result.value);assert.deepEqual(aggregateStatePeriod(row.input_manifest.plan,row.input_manifest.inputs),row.result_payload);
      assert.deepEqual((await stateAggregateStore.current(stateKey)).result,result);
      assert.equal((await db.query('SELECT count(*)::int AS n FROM bsmoss_analysis.aggregate_outbox WHERE series_id=$1',[stateSeries])).rows[0].n,1);
      await assert.rejects(adapterPool.query("UPDATE bsmoss_analysis.aggregate_revision SET state_value='{}' WHERE series_id=$1",[stateSeries]),e=>e.code==='42501');
    });
    await t.test('state completion binds exact authority and latest object proof with no revoked fallback',async()=>{
      await stateAttest('1');let s=await stateReader.load(stateTarget('whole'));assert.equal(aggregateStatePeriod(s.plan,s.inputs).completeness,'complete');
      await stateAggregateStore.publish(s.plan,s.inputs,'1','state-worker');
      await stateAttest('2','revoked');s=await stateReader.load(stateTarget('whole'));assert.equal(s.plan.sourceComplete,false);assert.ok(aggregateStatePeriod(s.plan,s.inputs).reasons.includes('source_confirmation_revoked'));
      await stateAttest('3');s=await stateReader.load(stateTarget('whole'));assert.equal(s.plan.sourceComplete,true);
      await stateAttest('4','confirmed',stateTarget('whole'),{mapping_manifest_sha256:'0'.repeat(64)});s=await stateReader.load(stateTarget('whole'));assert.equal(s.plan.sourceComplete,false);assert.equal(s.plan.completionEvidence.revision,'4');
      await stateAttest('5');await db.query('UPDATE bsmoss_integration.source_capability SET rules=$1 WHERE id=$2',[{stateAggregation:{...statePolicy.stateAggregation,authorityRef:'fixture://new-authority'}},'state-cap']);
      s=await stateReader.load(stateTarget('whole'));assert.ok(aggregateStatePeriod(s.plan,s.inputs).reasons.includes('source_confirmation_stale'));
      await db.query('UPDATE bsmoss_integration.source_capability SET rules=$1 WHERE id=$2',[statePolicy,'state-cap']);
      await stateAttest('6');const id=(await db.query("SELECT id FROM bsmoss_metering.measurement WHERE event_id='state:whole'")).rows[0].id;
      await db.query("INSERT INTO bsmoss_metering.quality_decision(workspace_id,id,measurement_id,revision,quality,rule_version,reason,decided_by) VALUES ('w',$1,$2,2,'pending','2','review','reviewer')",[randomUUID(),id]);
      s=await stateReader.load(stateTarget('whole'));assert.equal(aggregateStatePeriod(s.plan,s.inputs).completeness,'missing');assert.equal(s.plan.sourceComplete,false);
      await stateAggregateStore.publish(s.plan,s.inputs,'2','state-worker');assert.equal((await stateAggregateStore.readRevision(stateKey,'1')).result.value.durationMilliseconds.running,'3600000');
    });
    await t.test('state source proof reads the same repeatable snapshot as its events',async()=>{
      let inserted=false;const intercepted={async connect(){const client=await adapterPool.connect();return {async query(sql,args){const result=await client.query(sql,args);if(!inserted&&sql.includes('SELECT m.*,r.payload_sha256')){inserted=true;await stateAttest('7');}return result;},release(discard){client.release(discard);}};}};
      const before=await new PgStateSnapshotReader(intercepted,stateScope).load(stateTarget('whole')),after=await stateReader.load(stateTarget('whole'));
      assert.equal(inserted,true);assert.equal(before.plan.completionEvidence.revision,'6');assert.equal(after.plan.completionEvidence.revision,'7');assert.equal(after.plan.sourceComplete,true);assert.equal(aggregateStatePeriod(after.plan,after.inputs).completeness,'missing');
    });
    await t.test('state mappings may switch off grid but cannot carry across a mapping boundary',async()=>{
      for(const [name,version,start,end] of [['switch-old',1,'2026-01-01T00:00:00Z',snapshotTime(17)],['switch-map',2,snapshotTime(17),'2027-01-01T00:00:00Z']])
        await db.query(`INSERT INTO bsmoss_integration.source_mapping(workspace_id,id,source_id,external_type,external_id,station_id,device_id,version,valid_from,valid_to)
          VALUES ('w',$1,'src','device','switch-external','st','switch-device',$2,$3,$4)`,[name,version,start,end]);
      await stateMeasurements.append(stateDraft('switch-old',0,17,'running',{mappingId:'switch-old'}));
      let {result}=await stateResult(stateTarget('switch'));assert.equal(result.value.durationMilliseconds.unknown,String(43*60000));
      await stateMeasurements.append(stateDraft('switch-new',17,60,'standby',{mappingId:'switch-map'}));await stateAttest('1','confirmed',stateTarget('switch'));
      ({result}=await stateResult(stateTarget('switch')));assert.equal(result.completeness,'complete');assert.equal(result.mappingWindows.length,2);assert.equal(result.value.durationMilliseconds.standby,String(43*60000));
      assert.deepEqual((await stateResult({...stateTarget('switch'),mappingId:'switch-old'})).result,result);
    });
    await t.test('latest state event revision retracts old time and device before snapshot filtering',async()=>{
      await stateMeasurements.append(stateDraft('move',0,60,'offline',{mappingId:'moved-map'}));assert.equal((await stateResult(stateTarget('moved'))).result.knownMilliseconds,'3600000');
      await stateMeasurements.append(stateDraft('move',60,120,'offline',{mappingId:'moved-map',revision:'2',previousRevision:'1',payloadSha256:'c'.repeat(64)}));
      assert.equal((await stateResult(stateTarget('moved'))).result.knownMilliseconds,'0');
      await stateMeasurements.append(stateDraft('move',0,60,'fault',{mappingId:'whole-map',revision:'3',previousRevision:'2',payloadSha256:'d'.repeat(64)}));
      const old=await stateResult(stateTarget('moved'));assert.equal(old.snapshot.inputs.length,0);assert.equal(old.result.completeness,'missing');
      assert.ok((await stateReader.load(stateTarget('whole'))).inputs.some(i=>i.eventId==='state:move'&&i.revision==='3'));
    });
    await t.test('state reader requires reviewed policy, physical device scope and bounded authority carry-in',async()=>{
      await assert.rejects(new PgStateSnapshotReader(adapterPool,{...stateScope,deviceIds:[]}).load(stateTarget()),/object_scope_denied/);
      await assert.rejects(stateReader.load({...stateTarget(),mappingId:'snapshot-map'}),/object_scope_denied/);
      const prior=(await db.query("SELECT * FROM bsmoss_integration.source_capability WHERE id='state-cap'")).rows[0];
      for(const [field,value,error] of [['native_grain','15m',/state_policy_required/],['rules',{},/state_policy_required/],['rules',{stateAggregation:{...statePolicy.stateAggregation,maxHoldMilliseconds:0}},/invalid_state_hold_policy/],['status','planned',/aggregate_capability_unavailable/]]) {
        try{await db.query('UPDATE bsmoss_integration.source_capability SET '+field+'=$1 WHERE id=$2',[value,'state-cap']);await assert.rejects(stateReader.load(stateTarget()),error);}
        finally{await db.query('UPDATE bsmoss_integration.source_capability SET '+field+'=$1 WHERE id=$2',[prior[field],'state-cap']);}
      }
      try{await db.query("UPDATE bsmoss_integration.source_capability SET valid_from=$1 WHERE id='state-cap'",[snapshotTime(0)]);
        const s=await stateReader.load(stateTarget());assert.ok(s.inputs.every(i=>i.at>=snapshotTime(0)));assert.equal(aggregateStatePeriod(s.plan,s.inputs).value.durationMilliseconds.unknown,String(20*60000));
      }finally{await db.query("UPDATE bsmoss_integration.source_capability SET valid_from=$1 WHERE id='state-cap'",[prior.valid_from]);}
    });
    await t.test('authorized state refresh atomically publishes typed value, outbox and receipt and replays',async()=>{
      const ports={...snapshotPorts,async readLocalGrant(){return {...await snapshotPorts.readLocalGrant(),scope:stateScope};}};
      const input={targets:[stateTarget('switch')],triggerRef:'fixture:state:queue'};
      const queued=await enqueueAuthorizedRefresh(adapterPool,ports,input),lease=await claimAuthorizedRefresh(adapterPool,ports);assert.equal(lease.id,queued.jobs[0].id);
      const injected={async connect(){const client=await adapterPool.connect();return {async query(sql,args){if(sql.includes('INSERT INTO bsmoss_analysis.refresh_attempt'))throw Error('fixture_state_receipt_failure');return client.query(sql,args);},release(discard){client.release(discard);}};}};
      await assert.rejects(executeRefreshLease(injected,ports,lease),/fixture_state_receipt_failure/);
      assert.equal((await db.query('SELECT 1 FROM bsmoss_analysis.refresh_attempt WHERE job_id=$1',[lease.id])).rowCount,0);
      assert.equal((await db.query('SELECT 1 FROM bsmoss_analysis.aggregate_series WHERE subject_key=$1',[lease.job.subjectKey])).rowCount,0);
      const done=await executeRefreshLease(adapterPool,ports,lease);assert.equal(done.status,'inserted');
      const typed=(await db.query('SELECT value_kind,state_value FROM bsmoss_analysis.aggregate_revision WHERE series_id=$1',[done.seriesId])).rows[0];assert.equal(typed.value_kind,'state');assert.equal(typed.state_value.durationMilliseconds.standby,String(43*60000));
      assert.equal((await db.query('SELECT outcome FROM bsmoss_analysis.refresh_attempt WHERE job_id=$1',[lease.id])).rows[0].outcome,'succeeded');
      await enqueueAuthorizedRefresh(adapterPool,ports,{...input,triggerRef:'fixture:state:queue-replay'});assert.equal((await runRefreshStep(adapterPool,ports)).result.status,'duplicate');
      assert.equal((await db.query('SELECT count(*)::int AS n FROM bsmoss_analysis.aggregate_outbox WHERE series_id=$1',[done.seriesId])).rows[0].n,1);
    });
    await t.test('state refresh cannot pair an old event snapshot with a newer published head',async()=>{
      const ports={...snapshotPorts,async readLocalGrant(){return {...await snapshotPorts.readLocalGrant(),scope:stateScope};}};
      await stateMeasurements.append(stateDraft('switch-new',17,60,'offline',{mappingId:'switch-map',revision:'2',previousRevision:'1',payloadSha256:'c'.repeat(64)}));
      await enqueueAuthorizedRefresh(adapterPool,ports,{targets:[stateTarget('switch')],triggerRef:'fixture:state:race'});
      const lease=await claimAuthorizedRefresh(adapterPool,ports);let changed=false;
      const intercepted={async connect(){const client=await adapterPool.connect();return {async query(sql,args){const result=await client.query(sql,args);
        if(!changed&&sql.includes('SELECT m.*,r.payload_sha256')){changed=true;
          await stateMeasurements.append(stateDraft('switch-new',17,60,'fault',{mappingId:'switch-map',revision:'3',previousRevision:'2',payloadSha256:'d'.repeat(64)}));
          const fresh=await stateReader.load(stateTarget('switch')),store=new PgStateAggregateStore(adapterPool,{workspaceId:'w',series:[{sourceId:'src',subjectKey:fresh.plan.subjectKey,metricKey:'runtime.device.state@1'}]});
          const head=await store.current(fresh.plan);await store.publish(fresh.plan,fresh.inputs,head.revision,'state-worker');
        }return result;},release(discard){client.release(discard);}};}};
      await assert.rejects(executeRefreshLease(intercepted,ports,lease),e=>e.code==='40001'||/aggregate_revision_conflict/.test(e.message));assert.equal(changed,true);
      assert.equal((await db.query('SELECT 1 FROM bsmoss_analysis.refresh_attempt WHERE job_id=$1',[lease.id])).rowCount,0);
      const fresh=await stateReader.load(stateTarget('switch')),store=new PgStateAggregateStore(adapterPool,{workspaceId:'w',series:[{sourceId:'src',subjectKey:fresh.plan.subjectKey,metricKey:'runtime.device.state@1'}]});
      assert.equal((await store.current(fresh.plan)).result.value.durationMilliseconds.fault,String(43*60000));
      assert.equal((await executeRefreshLease(adapterPool,ports,lease)).status,'duplicate');
    });
    await t.test('state revision SQL rejects incomplete, negative and mixed typed values',async()=>{
      const row=(await db.query('SELECT * FROM bsmoss_analysis.aggregate_revision WHERE series_id=$1 AND revision=1',[stateSeries])).rows[0];
      for(const patch of [{state_value:{kind:'state'}},{state_value:{...row.state_value,durationMilliseconds:{...row.state_value.durationMilliseconds,unknown:'-1'}}},{state_value:{...row.state_value,knownTransitions:0.1}},{integer_value:'1'},{value_kind:'integer',integer_value:'1'}]) {
        const candidate={...row,revision:'99',input_fingerprint:'f'.repeat(64),...patch};candidate.result_payload={...row.result_payload,inputFingerprint:candidate.input_fingerprint,value:candidate.state_value};
        const keys=Object.keys(candidate);await assert.rejects(db.query('INSERT INTO bsmoss_analysis.aggregate_revision('+keys.join(',')+') VALUES ('+keys.map((_,i)=>'$'+(i+1)).join(',')+')',Object.values(candidate)),e=>e.code==='23514');
      }
    });
    await db.query(`INSERT INTO bsmoss_resource.station_service VALUES ('w','change-svc','st','op','2026-01-01Z','2027-01-01Z');
      INSERT INTO bsmoss_resource.network_object VALUES ('w','change-old-cell','st','change-svc','cell'),('w','change-new-cell','st','change-svc','cell');
      INSERT INTO bsmoss_integration.source_mapping(workspace_id,id,source_id,external_type,external_id,station_id,service_id,network_object_id,version,valid_from,valid_to)
      VALUES ('w','change-old','src','cell','change-old-external','st','change-svc','change-old-cell',1,'2026-01-01Z','2027-01-01Z'),
      ('w','change-new','src','cell','change-new-external','st','change-svc','change-new-cell',1,'2026-01-01Z','2027-01-01Z')`);
    const changeScope={...scope,serviceIds:['change-svc'],deviceIds:[],allowSiteParameters:false,metricKeys:['service.data.uplink_bytes@1','service.data.downlink_bytes@1','service.data.total_bytes@1']};
    const changePorts={...snapshotPorts,async readLocalGrant(){return {...await snapshotPorts.readLocalGrant(),scope:changeScope};}};
    const changeStore=new PgMeasurementStore(adapterPool,changeScope,FIRST_METRICS),upMetric=snapshotTarget.metric;
    const changePolicy={outputs:[upMetric,depTarget.metric],grains:['day','week','month']};
    const changeDraft=(id,patch={})=>draft('change:'+id,{mappingId:'change-old',...patch});
    const changesFor=async(id)=> (await db.query("SELECT c.* FROM bsmoss_metering.input_change c JOIN bsmoss_metering.measurement m ON (m.workspace_id,m.id)=(c.workspace_id,c.measurement_id) WHERE m.event_id=$1 ORDER BY m.event_revision,c.change_kind",['change:'+id])).rows;
    async function finishChangeJobs(manifest,ports=changePorts){
      const expected=new Set(manifest.jobs.map(job=>job.id));
      for(const job of manifest.jobs){const result=await runRefreshStep(adapterPool,ports);assert.equal(result.status,'succeeded');assert.ok(expected.delete(result.jobId));}
      assert.equal(expected.size,0);
    }
    let initialChange,firstDispatch;
    await t.test('fact and quality outbox capture is atomic, duplicate-safe and read-only to runtime',async()=>{
      const first=await changeStore.append(changeDraft('input'));initialChange=(await changesFor('input'))[0].id;
      assert.equal((await changesFor('input')).length,2);assert.equal((await changeStore.append(changeDraft('input'))).status,'duplicate');assert.equal((await changesFor('input')).length,2);
      await assert.rejects(adapterPool.query("INSERT INTO bsmoss_metering.input_change(workspace_id,measurement_id,change_kind) VALUES ('w',$1,'measurement')",[first.id]),e=>e.code==='42501');
      await assert.rejects(adapterPool.query("DELETE FROM bsmoss_metering.input_change WHERE id=$1",[initialChange]),e=>e.code==='42501');
      await assert.rejects(adapterPool.query("UPDATE bsmoss_metering.input_change SET measurement_id=$1 WHERE id=$2",[first.id,initialChange]),e=>e.code==='42501');
      await db.query(`CREATE FUNCTION public.fixture_outbox_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture_outbox_failure'; END $$;
        CREATE TRIGGER fixture_outbox_fail BEFORE INSERT ON bsmoss_metering.input_change FOR EACH ROW EXECUTE FUNCTION public.fixture_outbox_fail()`);
      try{await assert.rejects(changeStore.append(changeDraft('rollback')),/fixture_outbox_failure/);assert.equal((await db.query("SELECT 1 FROM bsmoss_integration.raw_event WHERE event_id='change:rollback'")).rowCount,0);assert.equal((await changesFor('rollback')).length,0);}
      finally{await db.query('DROP TRIGGER fixture_outbox_fail ON bsmoss_metering.input_change; DROP FUNCTION public.fixture_outbox_fail()');}
    });
    await t.test('durable fact dispatcher derives direct and dependent natural periods and replays its receipt',async()=>{
      await changeStore.append(changeDraft('down',{metric:down,value:{kind:'integer_delta',value:'7'}}));
      firstDispatch=await dispatchInputChange(adapterPool,changePorts,initialChange,changePolicy);assert.equal(firstDispatch.status,'dispatched');assert.equal(firstDispatch.manifest.jobs.length,6);
      assert.equal(firstDispatch.manifest.targets.filter(t=>t.metric.code===depTarget.metric.code).length,3);
      const replay=await dispatchInputChange(adapterPool,changePorts,initialChange,{outputs:[depTarget.metric,upMetric],grains:['month','day','week']});assert.equal(replay.status,'duplicate');assert.deepEqual(replay.manifest,firstDispatch.manifest);
      await assert.rejects(adapterPool.query("UPDATE bsmoss_analysis.input_refresh_receipt SET manifest='{}' WHERE change_id=$1",[initialChange]),e=>e.code==='42501');
      await assert.rejects(adapterPool.query('DELETE FROM bsmoss_analysis.input_refresh_receipt WHERE change_id=$1',[initialChange]),e=>e.code==='42501');
      await assert.rejects(adapterPool.query(`INSERT INTO bsmoss_analysis.input_refresh_receipt(workspace_id,change_id,subscription_sha256,manifest_sha256,manifest,recorded_by)
        VALUES('other',$1,$2,$3,$4,'fixture')`,[initialChange,firstDispatch.manifest.subscriptionSha256,firstDispatch.manifestSha256,firstDispatch.manifest]),e=>e.code==='23503');
      await finishChangeJobs(firstDispatch.manifest);
      const target={...snapshotTarget,mappingId:'change-old',grain:'day'},s=await new PgAggregateSnapshotReader(adapterPool,changeScope).load(target);
      const stored=new PgAggregateStore(adapterPool,{workspaceId:'w',series:[{sourceId:'src',subjectKey:s.plan.subjectKey,metricKey:upMetric.code+'@1'}]});
      assert.deepEqual((await stored.current(s.plan)).result.knownValue,{kind:'integer',value:'100'});
      const discovery=await pendingInputChanges(adapterPool,changePorts,changePolicy);assert.ok(!discovery.changeIds.includes(initialChange));assert.ok(discovery.changeIds.includes((await changesFor('input'))[1].id));
    });
    await t.test('persisted correction moves retract old object and period while scheduling both output metrics',async()=>{
      await changeStore.append(changeDraft('input',{mappingId:'change-new',periodStart:snapshotTime(1440),periodEnd:snapshotTime(1455),revision:'2',previousRevision:'1',payloadSha256:'c'.repeat(64),value:{kind:'integer_delta',value:'130'}}));
      await changeStore.append(changeDraft('down-new',{mappingId:'change-new',metric:down,periodStart:snapshotTime(1440),periodEnd:snapshotTime(1455),value:{kind:'integer_delta',value:'9'}}));
      const change=(await changesFor('input')).find(c=>c.measurement_id!==firstDispatch.manifest.change.measurementId&&c.change_kind==='measurement');
      const dispatched=await dispatchInputChange(adapterPool,changePorts,change.id,changePolicy);assert.equal(dispatched.manifest.jobs.length,12);assert.equal(dispatched.manifest.evidence.length,2);
      await finishChangeJobs(dispatched.manifest);
      const stored=(await db.query(`SELECT s.subject_key,s.period_start,r.result_payload FROM bsmoss_analysis.aggregate_series s JOIN bsmoss_analysis.aggregate_revision r
        ON (r.workspace_id,r.series_id,r.revision)=(s.workspace_id,s.id,s.current_revision) WHERE s.metric_code='service.data.uplink_bytes' AND s.grain='day' AND s.subject_key LIKE '%change-svc%'`)).rows;
      const old=stored.find(row=>row.subject_key.includes('change-old-cell')),next=stored.find(row=>row.subject_key.includes('change-new-cell'));
      assert.equal(old.result_payload.completeness,'missing');assert.equal(next.result_payload.knownValue.value,'130');
      const prior=(await db.query(`SELECT r.result_payload FROM bsmoss_analysis.aggregate_revision r JOIN bsmoss_analysis.aggregate_series s ON (s.workspace_id,s.id)=(r.workspace_id,r.series_id)
        WHERE s.subject_key=$1 AND s.metric_code=$2 AND s.grain='day' AND r.revision=1`,[old.subject_key,upMetric.code])).rows[0];assert.equal(prior.result_payload.knownValue.value,'100');
    });
    await t.test('quality revisions produce their own changes and requeue direct and derived results',async()=>{
      const fact=(await db.query("SELECT * FROM bsmoss_metering.measurement WHERE event_id='change:input' AND event_revision=2")).rows[0];
      await db.query("INSERT INTO bsmoss_metering.quality_decision(workspace_id,id,measurement_id,revision,quality,rule_version,reason,decided_by) VALUES ('w',$1,$2,2,'rejected','2','review','reviewer')",[randomUUID(),fact.id]);
      const change=(await changesFor('input')).find(c=>c.quality_revision==='2'),result=await dispatchInputChange(adapterPool,changePorts,change.id,changePolicy);assert.equal(result.manifest.change.kind,'quality');assert.equal(result.manifest.change.qualityRevision,'2');
      await finishChangeJobs(result.manifest);
      const current=(await db.query(`SELECT r.result_payload FROM bsmoss_analysis.aggregate_series s JOIN bsmoss_analysis.aggregate_revision r
        ON (r.workspace_id,r.series_id,r.revision)=(s.workspace_id,s.id,s.current_revision) WHERE s.subject_key LIKE '%change-new-cell%' AND s.metric_code=$1 AND s.grain='day'`,[depTarget.metric.code])).rows[0];assert.equal(current.result_payload.knownValue,null);assert.ok(current.result_payload.reasons.includes('rejected_quality'));
    });
    await t.test('dispatcher job or receipt failure and expired grants roll back all enqueue and consumption progress',async()=>{
      await changeStore.append(changeDraft('atomic'));const id=(await changesFor('atomic'))[0].id;
      for(const fragment of ['INSERT INTO bsmoss_analysis.refresh_job','INSERT INTO bsmoss_analysis.input_refresh_receipt']) {
        const intercepted={async connect(){const client=await adapterPool.connect();return {async query(sql,args){if(sql.includes(fragment))throw Error('fixture_dispatch_failure');return client.query(sql,args);},release(discard){client.release(discard);}};}};
        const before=(await db.query('SELECT count(*)::int AS n FROM bsmoss_analysis.refresh_job')).rows[0].n;
        await assert.rejects(dispatchInputChange(intercepted,changePorts,id,changePolicy),/fixture_dispatch_failure/);
        assert.equal((await db.query('SELECT count(*)::int AS n FROM bsmoss_analysis.refresh_job')).rows[0].n,before);assert.equal((await db.query('SELECT 1 FROM bsmoss_analysis.input_refresh_receipt WHERE change_id=$1',[id])).rowCount,0);
      }
      let clock=Date.now();const timed={...changePorts,now:()=>clock};
      const delayed={async connect(){const client=await adapterPool.connect();return {async query(sql,args){const result=await client.query(sql,args);if(sql.includes('INSERT INTO bsmoss_analysis.input_refresh_receipt'))clock+=120000;return result;},release(discard){client.release(discard);}};}};
      await assert.rejects(dispatchInputChange(delayed,timed,id,changePolicy),/access_expired/);assert.equal((await db.query('SELECT 1 FROM bsmoss_analysis.input_refresh_receipt WHERE change_id=$1',[id])).rowCount,0);
      const recovered=await dispatchInputChange(adapterPool,changePorts,id,changePolicy);assert.equal(recovered.status,'dispatched');await finishChangeJobs(recovered.manifest);
    });
    await t.test('concurrent dispatch uses a fenced event subscription lock with restart-safe receipts',async()=>{
      const id=(await changesFor('down'))[0].id,sub=inputRefreshSubscription(changeScope,changePolicy).sha256;
      await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[JSON.stringify(['bsmoss-input-refresh-v1','w',id,sub])]);
      try{assert.equal((await dispatchInputChange(adapterPool,changePorts,id,changePolicy)).status,'busy');}
      finally{await db.query('ROLLBACK');}
      const results=await Promise.allSettled([dispatchInputChange(adapterPool,changePorts,id,changePolicy),dispatchInputChange(adapterPool,changePorts,id,changePolicy)]);
      assert.equal(results.filter(r=>r.status==='fulfilled'&&r.value.status==='dispatched').length,1);
      assert.ok(results.every(r=>r.status==='fulfilled'||['40001','23505'].includes(r.reason.code)));
      assert.equal((await dispatchInputChange(adapterPool,changePorts,id,changePolicy)).status,'duplicate');
      assert.equal((await db.query('SELECT count(*)::int AS n FROM bsmoss_analysis.input_refresh_receipt WHERE change_id=$1 AND subscription_sha256=$2',[id,sub])).rows[0].n,1);
      await finishChangeJobs(results.find(r=>r.status==='fulfilled'&&r.value.status==='dispatched').value.manifest);
    });
    await t.test('late-committing input is discoverable after newer changes were consumed without a global offset',async()=>{
      const prior=(await db.query("SELECT * FROM bsmoss_metering.measurement WHERE event_id='change:atomic'")).rows[0];
      const keys=Object.keys(prior),next={...prior,id:randomUUID(),component_key:'late-component',period_start:snapshotTime(30),period_end:snapshotTime(45)};
      await db.query('BEGIN');await db.query('INSERT INTO bsmoss_metering.measurement('+keys.join(',')+') VALUES ('+keys.map((_,i)=>'$'+(i+1)).join(',')+')',keys.map(k=>next[k]));
      await db.query("INSERT INTO bsmoss_metering.quality_decision(workspace_id,id,measurement_id,revision,quality,rule_version,reason,decided_by) VALUES ('w',$1,$2,1,'verified','1','late','reviewer')",[randomUUID(),next.id]);
      const hidden=(await db.query('SELECT id FROM bsmoss_metering.input_change WHERE measurement_id=$1 AND change_kind=$2',[next.id,'measurement'])).rows[0].id;
      assert.ok(!(await pendingInputChanges(adapterPool,changePorts,changePolicy)).changeIds.includes(hidden));
      await changeStore.append(changeDraft('later-commit',{periodStart:snapshotTime(60),periodEnd:snapshotTime(75)}));const later=(await changesFor('later-commit'))[0].id;
      const newer=await dispatchInputChange(adapterPool,changePorts,later,changePolicy);await db.query('COMMIT');
      assert.ok((await pendingInputChanges(adapterPool,changePorts,changePolicy)).changeIds.includes(hidden));
      const old=await dispatchInputChange(adapterPool,changePorts,hidden,changePolicy);assert.equal(old.status,'dispatched');await finishChangeJobs(newer.manifest);await finishChangeJobs(old.manifest);
    });
    await t.test('old and new object grants are both required, and subscription changes cannot erase another scope backlog',async()=>{
      await changeStore.append(changeDraft('denied',{mappingId:'change-new'}));
      const writer=new PgMeasurementStore(adapterPool,{...changeScope,serviceIds:['change-svc','svc']},FIRST_METRICS);
      await writer.append(changeDraft('denied',{mappingId:'snapshot-map',revision:'2',previousRevision:'1',payloadSha256:'c'.repeat(64)}));
      const id=(await changesFor('denied'))[0].id;
      await assert.rejects(dispatchInputChange(adapterPool,changePorts,id,changePolicy),/object_scope_denied/);assert.equal((await db.query('SELECT 1 FROM bsmoss_analysis.input_refresh_receipt WHERE change_id=$1',[id])).rowCount,0);
      const smaller={outputs:[upMetric],grains:['day']},other=await dispatchInputChange(adapterPool,changePorts,initialChange,smaller);assert.equal(other.status,'dispatched');assert.equal(other.manifest.jobs.length,2);
      assert.notEqual(other.manifest.subscriptionSha256,firstDispatch.manifest.subscriptionSha256);await finishChangeJobs(other.manifest);
      const denied={...changePorts,async readLocalGrant(){return null;}};await assert.rejects(dispatchInputChange(adapterPool,denied,initialChange,changePolicy),/permission_denied/);
      await assert.rejects(dispatchInputChange(adapterPool,changePorts,'foreign-change',changePolicy),/input_change_unavailable/);
    });
    await t.test('state outbox dispatcher propagates expired and pending suppression beyond its own validity',async()=>{
      const ports={...snapshotPorts,async readLocalGrant(){return {...await snapshotPorts.readLocalGrant(),scope:{...stateScope,deviceIds:['moved-device']}};}};
      const store=new PgMeasurementStore(adapterPool,{...stateScope,deviceIds:['moved-device']},FIRST_METRICS),p={outputs:[stateMetric],grains:['day']};
      const saved=await store.append(stateDraft('outbox-short',955,956,'fault',{mappingId:'moved-map',quality:{status:'pending',reason:'fixture',ruleVersion:'1',decidedBy:'worker'}}));
      const id=(await db.query('SELECT id FROM bsmoss_metering.input_change WHERE measurement_id=$1 AND change_kind=$2',[saved.id,'measurement'])).rows[0].id;
      const result=await dispatchInputChange(adapterPool,ports,id,p);assert.equal(result.manifest.jobs.length,2);assert.ok(result.manifest.targets.some(t=>t.at==='2026-02-01T16:00:00.000Z'));
      await finishChangeJobs(result.manifest,ports);
    });
    await t.test('dispatcher obeys reviewed ratio input mode and never acknowledges missing dependency authority',async()=>{
      const grant={...changeScope,metricKeys:scope.metricKeys},ports={...changePorts,async readLocalGrant(){return {...await changePorts.readLocalGrant(),scope:grant};}};
      const writer=new PgMeasurementStore(adapterPool,grant,FIRST_METRICS),connected={code:'service.voice.connected_count',version:1};
      const value=await writer.append(changeDraft('count',{metric:connected,value:{kind:'integer_delta',value:'1'}})),p={outputs:[depRate.metric],grains:['day']};
      const id=(await db.query('SELECT id FROM bsmoss_metering.input_change WHERE measurement_id=$1 AND change_kind=$2',[value.id,'measurement'])).rows[0].id;
      await db.query("UPDATE bsmoss_integration.source_capability SET rules=$1 WHERE id='snapshot-ratio-cap'",[capabilityPolicy]);
      try{const result=await dispatchInputChange(adapterPool,ports,id,p);assert.equal(result.status,'dispatched');assert.equal(result.manifest.jobs.length,0);}
      finally{await db.query("UPDATE bsmoss_integration.source_capability SET rules=$1 WHERE id='snapshot-ratio-cap'",[depPolicy]);}
      // A new policy partition is needed to replay under an authority change;
      // capability-change events will be a separate dispatcher extension.
      await changeStore.append(changeDraft('missing-authority',{periodStart:snapshotTime(120),periodEnd:snapshotTime(135)}));
      const missing={outputs:[upMetric,depTarget.metric],grains:['day']},change=(await changesFor('missing-authority'))[0].id;
      await db.query("UPDATE bsmoss_integration.source_capability SET status='planned' WHERE id='dependency-down-cap'");
      try{await assert.rejects(dispatchInputChange(adapterPool,changePorts,change,missing),/aggregate_capability_unavailable/);assert.equal((await db.query('SELECT 1 FROM bsmoss_analysis.input_refresh_receipt WHERE change_id=$1',[change])).rowCount,0);}
      finally{await db.query("UPDATE bsmoss_integration.source_capability SET status='active' WHERE id='dependency-down-cap'");}
    });
    const proofSource='proof-src',proofPeriod={start:'2026-01-31T16:00:00.000Z',end:'2026-02-01T16:00:00.000Z'};
    await db.query(`INSERT INTO bsmoss_integration.source VALUES ('w','proof-src','ProofSource','file');
      INSERT INTO bsmoss_resource.station_service VALUES ('w','proof-svc','st','op','2026-01-01Z','2027-01-01Z');
      INSERT INTO bsmoss_resource.network_object VALUES ('w','proof-cell','st','proof-svc','cell');
      INSERT INTO bsmoss_resource.device VALUES ('w','proof-device','st','controller','tower');
      INSERT INTO bsmoss_integration.source_mapping(workspace_id,id,source_id,external_type,external_id,station_id,service_id,network_object_id,device_id,version,valid_from,valid_to)
      VALUES ('w','proof-cell-map','proof-src','cell','proof-external','st','proof-svc','proof-cell',NULL,1,'2026-01-01Z','2027-01-01Z'),
      ('w','proof-device-map','proof-src','device','proof-physical','st',NULL,NULL,'proof-device',1,'2026-01-01Z','2027-01-01Z')`);
    for(const [code,grain,rules] of [[upMetric.code,'day',capabilityPolicy],[down.code,'day',capabilityPolicy],[depTarget.metric.code,'day',depPolicy],
      [stateMetric.code,'event',{stateAggregation:{version:1,authorityRef:'fixture://proof-state-policy',maxHoldMilliseconds:86400000}}]])
      await db.query(`INSERT INTO bsmoss_integration.source_capability VALUES ('w',$1,'proof-src',$2,1,$3,'active','fixture://proof-validation',$4,'2026-01-01Z','2027-01-01Z')`,['proof-cap:'+code,code,grain,rules]);
    const proofScope={...scope,sourceIds:[proofSource],serviceIds:['proof-svc'],deviceIds:['proof-device','proof-split-device'],allowSiteParameters:false};
    const proofPorts={...snapshotPorts,async readLocalGrant(){return {...await snapshotPorts.readLocalGrant(),scope:proofScope};}},proofWriter=new PgMeasurementStore(adapterPool,proofScope,FIRST_METRICS);
    const proofTarget=(metric=upMetric)=>({sourceId:proofSource,mappingId:metric.code===stateMetric.code?'proof-device-map':'proof-cell-map',metric,grain:'day',at:proofPeriod.start});
    const proofPolicy={outputs:[upMetric,depTarget.metric,stateMetric],grains:['day','week','month']};
    const proofAggregate=async(target)=>{
      const snap=await readRefreshSnapshot(adapterPool,proofScope,target),s={workspaceId:'w',series:[{sourceId:proofSource,subjectKey:snap.plan.subjectKey,metricKey:target.metric.code+'@1'}]};
      return {snap,store:snap.kind==='state'?new PgStateAggregateStore(adapterPool,s):new PgAggregateStore(adapterPool,s)};
    };
    async function appendProof(revision,status='confirmed',target=proofTarget(),legacy=false,patch={}) {
      const snapshot=await readRefreshSnapshot(adapterPool,proofScope,target),base={...snapshot.plan,sourceComplete:false,watermark:snapshot.plan.period.start};delete base.completionEvidence;
      const result=snapshot.kind==='state'?aggregateStatePeriod(base,snapshot.inputs):aggregateIntervals(base,snapshot.inputs),id=randomUUID();
      const object=(await db.query('SELECT station_id,service_id,network_object_id,device_id FROM bsmoss_integration.source_mapping WHERE workspace_id=$1 AND id=$2',['w',target.mappingId])).rows[0];
      const row={workspace_id:'w',id,source_id:proofSource,...(legacy?{mapping_id:target.mappingId,station_id:object.station_id}:object),metric_code:target.metric.code,metric_version:1,
        grain:target.grain,period_start:base.period.start,period_end:base.period.end,revision,status,input_fingerprint:result.inputFingerprint,
        ...(!legacy?{mapping_manifest_sha256:mappingSetFingerprint(snapshot.kind==='state'?result.mappingWindows:base.mappingWindows)}:{}),
        watermark:status==='confirmed'?base.period.end:base.period.start,evidence_ref:'fixture://completion-dispatch/'+revision,evidence_sha256:'e'.repeat(64),recorded_by:'reviewed-import',...patch};
      const keys=Object.keys(row),table=legacy?'source_completion':'source_completion_set';
      await db.query('INSERT INTO bsmoss_integration.'+table+'('+keys.join(',')+') VALUES ('+keys.map((_,i)=>'$'+(i+1)).join(',')+')',Object.values(row));
      const change=(await db.query('SELECT id FROM bsmoss_metering.input_change WHERE workspace_id=$1 AND '+(legacy?'legacy_completion_id':'completion_set_id')+'=$2',['w',id])).rows[0];
      return {id,changeId:change.id,row};
    }
    for(const [id,metric,value] of [['up',upMetric,{kind:'integer_delta',value:'100'}],['down',down,{kind:'integer_delta',value:'7'}],['state',stateMetric,{kind:'state_event',state:'running',validUntil:proofPeriod.end}]])
      await proofWriter.append(draft('proof:'+id,{sourceId:proofSource,mappingId:proofTarget(metric).mappingId,metric,periodStart:proofPeriod.start,periodEnd:proofPeriod.end,value}));
    for(const metric of [upMetric,depTarget.metric,stateMetric]){const {snap,store}=await proofAggregate(proofTarget(metric));await store.publish(snap.plan,snap.inputs,null,'proof-worker');}
    let firstProof,revokedProof;
    await t.test('reviewed completion insertion captures its own durable change and publishes only the exact target',async()=>{
      firstProof=await appendProof('1');assert.equal((await db.query('SELECT change_kind,measurement_id,completion_set_id FROM bsmoss_metering.input_change WHERE id=$1',[firstProof.changeId])).rows[0].change_kind,'completion_set');
      const result=await dispatchInputChange(adapterPool,proofPorts,firstProof.changeId,proofPolicy);assert.equal(result.manifest.jobs.length,1);assert.equal(result.manifest.targets[0].grain,'day');assert.equal(result.manifest.change.completionId,firstProof.id);
      assert.equal(result.manifest.targets[0].metric.code,upMetric.code);await finishChangeJobs(result.manifest,proofPorts);
      const up=await proofAggregate(proofTarget()),total=await proofAggregate(proofTarget(depTarget.metric));assert.equal((await up.store.current(up.snap.plan)).result.completeness,'complete');assert.equal((await total.store.current(total.snap.plan)).revision,'1');
      assert.equal((await dispatchInputChange(adapterPool,proofPorts,firstProof.changeId,proofPolicy)).status,'duplicate');
    });
    await t.test('a latest completion revocation requeues and downgrades current result while history remains complete',async()=>{
      revokedProof=await appendProof('2','revoked');const result=await dispatchInputChange(adapterPool,proofPorts,revokedProof.changeId,proofPolicy);await finishChangeJobs(result.manifest,proofPorts);
      const {snap,store}=await proofAggregate(proofTarget()),head=await store.current(snap.plan);assert.equal(head.result.completeness,'preliminary');assert.ok(head.result.reasons.includes('source_confirmation_revoked'));
      assert.equal((await store.readRevision(snap.plan,'2')).result.completeness,'complete');assert.equal(head.result.knownValue.value,'100');
    });
    await t.test('out-of-order and stale proof changes cannot revive an older confirmation',async()=>{
      await assert.rejects(appendProof('0'),e=>e.code==='23514');
      const stale=await appendProof('3','confirmed',proofTarget(),false,{input_fingerprint:'0'.repeat(64)});const result=await dispatchInputChange(adapterPool,proofPorts,stale.changeId,proofPolicy);await finishChangeJobs(result.manifest,proofPorts);
      const replayed=await dispatchInputChange(adapterPool,proofPorts,firstProof.changeId,{outputs:[upMetric],grains:['day']});await finishChangeJobs(replayed.manifest,proofPorts);
      const {snap,store}=await proofAggregate(proofTarget()),head=await store.current(snap.plan);assert.equal(head.result.completeness,'preliminary');assert.ok(head.result.reasons.includes('source_confirmation_stale'));assert.equal(head.result.completionEvidence.revision,'3');
    });
    await t.test('legacy mapping confirmation capture works and cannot bypass a newer whole-object revocation',async()=>{
      const before=await appendProof('1','confirmed',proofTarget(depTarget.metric),true);
      let result=await dispatchInputChange(adapterPool,proofPorts,before.changeId,proofPolicy);assert.equal(result.manifest.change.kind,'completion');await finishChangeJobs(result.manifest,proofPorts);
      let current=await proofAggregate(proofTarget(depTarget.metric));assert.equal((await current.store.current(current.snap.plan)).result.completeness,'complete');
      const set=await appendProof('1','revoked',proofTarget(depTarget.metric));result=await dispatchInputChange(adapterPool,proofPorts,set.changeId,proofPolicy);await finishChangeJobs(result.manifest,proofPorts);
      const later=await appendProof('2','confirmed',proofTarget(depTarget.metric),true);result=await dispatchInputChange(adapterPool,proofPorts,later.changeId,proofPolicy);await finishChangeJobs(result.manifest,proofPorts);
      current=await proofAggregate(proofTarget(depTarget.metric));assert.equal((await current.store.current(current.snap.plan)).result.completeness,'preliminary');assert.ok((await current.store.current(current.snap.plan)).result.reasons.includes('source_confirmation_revoked'));
    });
    await t.test('state completion and revocation propagate without inferring missing state as running',async()=>{
      const target=proofTarget(stateMetric),full=await appendProof('1','confirmed',target);
      let result=await dispatchInputChange(adapterPool,proofPorts,full.changeId,proofPolicy);await finishChangeJobs(result.manifest,proofPorts);
      let state=await proofAggregate(target);assert.equal((await state.store.current(state.snap.plan)).result.completeness,'complete');
      const revoked=await appendProof('2','revoked',target);result=await dispatchInputChange(adapterPool,proofPorts,revoked.changeId,proofPolicy);await finishChangeJobs(result.manifest,proofPorts);
      state=await proofAggregate(target);assert.equal((await state.store.current(state.snap.plan)).result.completeness,'preliminary');
      const fact=(await db.query("SELECT id FROM bsmoss_metering.measurement WHERE event_id='proof:state'")).rows[0];
      await db.query("INSERT INTO bsmoss_metering.quality_decision(workspace_id,id,measurement_id,revision,quality,rule_version,reason,decided_by) VALUES ('w',$1,$2,2,'pending','2','review','reviewer')",[randomUUID(),fact.id]);
      const incomplete=await appendProof('3','confirmed',target);result=await dispatchInputChange(adapterPool,proofPorts,incomplete.changeId,proofPolicy);await finishChangeJobs(result.manifest,proofPorts);
      state=await proofAggregate(target);const head=await state.store.current(state.snap.plan);assert.equal(head.result.completeness,'missing');assert.equal(head.result.value.durationMilliseconds.unknown,'86400000');
    });
    await t.test('completion capture or consumer receipt failure never leaves partial proof propagation',async()=>{
      await db.query(`CREATE FUNCTION public.fixture_proof_capture_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture_proof_capture_failure'; END $$;
        CREATE TRIGGER fixture_proof_capture_fail BEFORE INSERT ON bsmoss_metering.input_change FOR EACH ROW EXECUTE FUNCTION public.fixture_proof_capture_fail()`);
      try{await assert.rejects(appendProof('4'),/fixture_proof_capture_failure/);assert.equal((await db.query("SELECT 1 FROM bsmoss_integration.source_completion_set WHERE source_id='proof-src' AND metric_code=$1 AND revision=4",[upMetric.code])).rowCount,0);}
      finally{await db.query('DROP TRIGGER fixture_proof_capture_fail ON bsmoss_metering.input_change; DROP FUNCTION public.fixture_proof_capture_fail()');}
      const proof=await appendProof('4'),before=(await db.query('SELECT count(*)::int AS n FROM bsmoss_analysis.refresh_job')).rows[0].n;
      const injected={async connect(){const client=await adapterPool.connect();return {async query(sql,args){if(sql.includes('INSERT INTO bsmoss_analysis.input_refresh_receipt'))throw Error('fixture_proof_receipt_failure');return client.query(sql,args);},release(discard){client.release(discard);}};}};
      await assert.rejects(dispatchInputChange(injected,proofPorts,proof.changeId,proofPolicy),/fixture_proof_receipt_failure/);assert.equal((await db.query('SELECT count(*)::int AS n FROM bsmoss_analysis.refresh_job')).rows[0].n,before);
      assert.equal((await db.query('SELECT 1 FROM bsmoss_analysis.input_refresh_receipt WHERE change_id=$1',[proof.changeId])).rowCount,0);
      const done=await dispatchInputChange(adapterPool,proofPorts,proof.changeId,proofPolicy);await finishChangeJobs(done.manifest,proofPorts);
    });
    await t.test('completion discovery respects exact output grain, source, station, service and device scope',async()=>{
      const hour=await appendProof('5','confirmed',proofTarget(),false,{grain:'hour',period_start:proofPeriod.start,period_end:'2026-01-31T17:00:00.000Z',watermark:'2026-01-31T17:00:00.000Z'});
      const pending=await pendingInputChanges(adapterPool,proofPorts,proofPolicy);assert.ok(!pending.changeIds.includes(hour.changeId));
      const noService={...proofPorts,async readLocalGrant(){return {...await proofPorts.readLocalGrant(),scope:{...proofScope,serviceIds:[]}};}};
      await assert.rejects(dispatchInputChange(adapterPool,noService,firstProof.changeId,proofPolicy),/object_scope_denied/);
      const noSource={...proofPorts,async readLocalGrant(){return {...await proofPorts.readLocalGrant(),scope:{...proofScope,sourceIds:[]}};}};
      await assert.rejects(dispatchInputChange(adapterPool,noSource,firstProof.changeId,proofPolicy),/input_change_unavailable/);
      const state=(await db.query("SELECT c.id FROM bsmoss_metering.input_change c JOIN bsmoss_integration.source_completion_set p ON (p.workspace_id,p.id)=(c.workspace_id,c.completion_set_id) WHERE p.source_id='proof-src' AND p.metric_code=$1 AND p.revision=3",[stateMetric.code])).rows[0];
      const noDevice={...proofPorts,async readLocalGrant(){return {...await proofPorts.readLocalGrant(),scope:{...proofScope,deviceIds:[]}};}};await assert.rejects(dispatchInputChange(adapterPool,noDevice,state.id,proofPolicy),/object_scope_denied/);
      const ignored=await dispatchInputChange(adapterPool,proofPorts,hour.changeId,proofPolicy);assert.equal(ignored.manifest.jobs.length,0);
      await assert.rejects(adapterPool.query("INSERT INTO bsmoss_integration.source_completion_set SELECT * FROM bsmoss_integration.source_completion_set WHERE id=$1",[firstProof.id]),e=>e.code==='42501');
    });
    await t.test('completion change pointers are tenant constrained, mutually exclusive and append-only',async()=>{
      for(const patch of [{measurement_id:'missing',completion_set_id:firstProof.id,change_kind:'completion_set'},
        {completion_set_id:firstProof.id,quality_revision:'1',change_kind:'completion_set'},
        {completion_set_id:firstProof.id,legacy_completion_id:'missing',change_kind:'completion_set'},
        {completion_set_id:firstProof.id,change_kind:'measurement'}]) {
        const row={workspace_id:'w',id:randomUUID(),...patch},keys=Object.keys(row);
        await assert.rejects(db.query('INSERT INTO bsmoss_metering.input_change('+keys.join(',')+') VALUES ('+keys.map((_,i)=>'$'+(i+1)).join(',')+')',Object.values(row)),e=>e.code==='23514');
      }
      await assert.rejects(db.query("INSERT INTO bsmoss_metering.input_change(workspace_id,completion_set_id,change_kind) VALUES ('other',$1,'completion_set')",[firstProof.id]),e=>e.code==='23503');
      await assert.rejects(db.query('DELETE FROM bsmoss_integration.source_completion_set WHERE id=$1',[firstProof.id]),e=>e.code==='23503');
      const row=firstProof.row,keys=Object.keys(row);await assert.rejects(db.query('INSERT INTO bsmoss_integration.source_completion_set('+keys.join(',')+') VALUES ('+keys.map((_,i)=>'$'+(i+1)).join(',')+')',Object.values(row)),e=>e.code==='23505');
      assert.equal((await db.query('SELECT count(*)::int AS n FROM bsmoss_metering.input_change WHERE completion_set_id=$1',[firstProof.id])).rows[0].n,1);
    });
    await t.test('whole-object completion dispatch chooses a deterministic anchor across off-grid state mappings',async()=>{
      const switchAt=new Date(Date.parse(proofPeriod.start)+17*60000).toISOString();
      await db.query("INSERT INTO bsmoss_resource.device VALUES ('w','proof-split-device','st','controller','tower')");
      for(const [id,from,to] of [['proof-state-old',proofPeriod.start,switchAt],['proof-state-new',switchAt,proofPeriod.end]])
        await db.query(`INSERT INTO bsmoss_integration.source_mapping(workspace_id,id,source_id,external_type,external_id,station_id,device_id,version,valid_from,valid_to)
          VALUES ('w',$1,'proof-src','device','proof-split-external','st','proof-split-device',1,$2,$3)`,[id,from,to]);
      for(const [id,start,end,state] of [['proof-state-old',proofPeriod.start,switchAt,'running'],['proof-state-new',switchAt,proofPeriod.end,'standby']])
        await proofWriter.append(draft(id,{sourceId:proofSource,mappingId:id,metric:stateMetric,periodStart:start,periodEnd:end,value:{kind:'state_event',state,validUntil:end}}));
      const target={...proofTarget(stateMetric),mappingId:'proof-state-new'},proof=await appendProof('1','confirmed',target);
      const done=await dispatchInputChange(adapterPool,proofPorts,proof.changeId,proofPolicy);assert.equal(done.manifest.targets[0].mappingId,'proof-state-old');assert.equal(done.manifest.jobs.length,1);
      await finishChangeJobs(done.manifest,proofPorts);
      const {snap,store}=await proofAggregate(target),head=await store.current(snap.plan);assert.equal(head.result.completeness,'complete');assert.equal(head.result.mappingWindows.length,2);assert.equal(head.result.value.durationMilliseconds.standby,String((1440-17)*60000));
      await db.query("UPDATE bsmoss_integration.source_mapping SET version=2 WHERE id='proof-state-new'");
      const stale=await appendProof('2','confirmed',target,false,{mapping_manifest_sha256:'0'.repeat(64)}),again=await dispatchInputChange(adapterPool,proofPorts,stale.changeId,proofPolicy);await finishChangeJobs(again.manifest,proofPorts);
      assert.equal((await store.current(snap.plan)).result.completeness,'preliminary');assert.ok((await store.current(snap.plan)).result.reasons.includes('source_confirmation_stale'));
    });
    await t.test('proof queued from one repeatable snapshot executes against the latest revoked source evidence',async()=>{
      const target=proofTarget(depTarget.metric),second=await appendProof('2','confirmed',target);let changed=false;
      const injected={async connect(){const client=await adapterPool.connect();return {async query(sql,args){const result=await client.query(sql,args);
        if(!changed&&sql.includes('SELECT * FROM bsmoss_integration.source_completion_set WHERE workspace_id=$1 AND id=$2')){changed=true;await appendProof('3','revoked',target);}return result;},release(discard){client.release(discard);}};}};
      const done=await dispatchInputChange(injected,proofPorts,second.changeId,proofPolicy);assert.equal(changed,true);assert.equal(done.manifest.change.revision,'2');assert.equal(done.manifest.change.status,'confirmed');
      await finishChangeJobs(done.manifest,proofPorts);const {snap,store}=await proofAggregate(target),head=await store.current(snap.plan);assert.equal(head.result.completionEvidence.revision,'3');assert.equal(head.result.completeness,'preliminary');
      const latest=(await db.query("SELECT c.id FROM bsmoss_metering.input_change c JOIN bsmoss_integration.source_completion_set p ON (p.workspace_id,p.id)=(c.workspace_id,c.completion_set_id) WHERE p.source_id='proof-src' AND p.metric_code=$1 AND p.revision=3",[depTarget.metric.code])).rows[0];
      assert.ok((await pendingInputChanges(adapterPool,proofPorts,proofPolicy)).changeIds.includes(latest.id));
    });
    await db.query(`INSERT INTO bsmoss_integration.source VALUES ('w','retry-src','RetrySource','file');
      INSERT INTO bsmoss_resource.station_service VALUES ('w','retry-svc','st','op','2026-01-01Z','2027-01-01Z');
      INSERT INTO bsmoss_resource.network_object VALUES ('w','retry-cell','st','retry-svc','cell');
      INSERT INTO bsmoss_integration.source_mapping(workspace_id,id,source_id,external_type,external_id,station_id,service_id,network_object_id,version,valid_from,valid_to)
      VALUES ('w','retry-map','retry-src','cell','retry-external','st','retry-svc','retry-cell',1,'2026-01-01Z','2027-01-01Z')`);
    await db.query(`INSERT INTO bsmoss_integration.source_capability VALUES ('w','retry-cap','retry-src','service.data.uplink_bytes',1,'day','active','fixture://retry-reviewed',$1,'2026-01-01Z','2027-01-01Z')`,[capabilityPolicy]);
    const retryScope={...scope,sourceIds:['retry-src'],serviceIds:['retry-svc'],deviceIds:[],allowSiteParameters:false,metricKeys:[upMetric.code+'@1']};
    const retryPorts={...snapshotPorts,async readLocalGrant(){return {...await snapshotPorts.readLocalGrant(),scope:retryScope};}};
    const retryPolicy={outputs:[upMetric],grains:['day']},retrySub=inputRefreshSubscription(retryScope,retryPolicy).sha256,retryWriter=new PgMeasurementStore(adapterPool,retryScope,FIRST_METRICS);
    // Finish reviewed setup changes before testing poison fact ordering. These
    // have no facts/publications yet and must still get real durable receipts.
    for(const id of (await pendingInputChanges(adapterPool,retryPorts,retryPolicy)).changeIds){const setup=await dispatchInputChange(adapterPool,retryPorts,id,retryPolicy);assert.equal(setup.manifest.jobs.length,0);}
    async function retryFact(name,day=0){const start=new Date(Date.parse('2026-03-01T16:00:00Z')+day*86400000).toISOString(),end=new Date(Date.parse(start)+86400000).toISOString();
      const saved=await retryWriter.append(draft('retry:'+name,{sourceId:'retry-src',mappingId:'retry-map',periodStart:start,periodEnd:end,value:{kind:'integer_delta',value:'100'}}));
      const changes=(await db.query('SELECT id,change_kind FROM bsmoss_metering.input_change WHERE measurement_id=$1 ORDER BY created_at,id',[saved.id])).rows;
      return {id:changes.find(c=>c.change_kind==='measurement').id,qualityId:changes.find(c=>c.change_kind==='quality').id};}
    const retryEvents=async id=>(await db.query('SELECT * FROM bsmoss_analysis.input_dispatch_event WHERE change_id=$1 AND subscription_sha256=$2 ORDER BY revision',[id,retrySub])).rows;
    // Deterministic due-time fixture: only this test pool removes the positive
    // delay at INSERT; real PostgreSQL still owns the gate clock and evidence.
    function retryPool({failWork=false,ready=false,failControl=false,afterControl}={}){return {async connect(){const client=await adapterPool.connect();return {async query(sql,args){
      if(failWork&&sql.includes('INSERT INTO bsmoss_analysis.refresh_job'))throw Error('fixture_private_customer_payload');
      if(sql.includes('INSERT INTO bsmoss_analysis.input_dispatch_event')){if(failControl)throw Error('fixture_control_write_failure');if(ready)sql=sql.replace("clock_timestamp()+$8::int*interval '1 second'","clock_timestamp()+LEAST($8::int,0)*interval '1 second'");}
      const result=await client.query(sql,args);if(afterControl&&sql.includes('INSERT INTO bsmoss_analysis.input_dispatch_event'))afterControl();return result;},release(discard){client.release(discard);}};},query(...args){return adapterPool.query(...args);}};}
    let poison;
    await t.test('supervised input failure rolls back jobs and receipt and durably delays just that subscription',async()=>{
      poison=await retryFact('poison');const before=(await db.query('SELECT count(*)::int AS n FROM bsmoss_analysis.refresh_job')).rows[0].n;
      const result=await superviseInputChange(retryPool({failWork:true}),retryPorts,poison.id,retryPolicy);assert.equal(result.status,'failure_recorded');assert.equal(result.attempt,1);assert.equal(result.code,'evidence_invalid');
      assert.equal((await db.query('SELECT count(*)::int AS n FROM bsmoss_analysis.refresh_job')).rows[0].n,before);assert.equal((await db.query('SELECT 1 FROM bsmoss_analysis.input_refresh_receipt WHERE change_id=$1',[poison.id])).rowCount,0);
      const event=(await retryEvents(poison.id))[0];assert.equal(event.attempt,'1');assert.equal(event.state,'retry');assert.ok(!JSON.stringify(event).includes('fixture_private_customer_payload'));
      assert.equal((await dispatchInputChange(adapterPool,retryPorts,poison.id,retryPolicy)).status,'deferred');assert.ok(!(await pendingInputChanges(adapterPool,retryPorts,retryPolicy)).changeIds.includes(poison.id));
      const other=await pendingInputChanges(adapterPool,retryPorts,{outputs:[upMetric],grains:['day','month']});assert.ok(other.changeIds.includes(poison.id));
    });
    await t.test('input failure exhaustion quarantines without consuming evidence and an explicit reopen resets attempts',async()=>{
      // Owner-only fixture expires the first wait, without a runtime update API.
      await db.query("UPDATE bsmoss_analysis.input_dispatch_event SET available_at=clock_timestamp()-interval '1 second' WHERE change_id=$1",[poison.id]);
      for(let i=2;i<=5;i++){const result=await superviseInputChange(retryPool({failWork:true,ready:true}),retryPorts,poison.id,retryPolicy);assert.equal(result.attempt,i);assert.equal(result.state,i===5?'quarantined':'retry');}
      assert.equal((await retryEvents(poison.id)).length,5);assert.equal((await superviseInputChange(adapterPool,retryPorts,poison.id,retryPolicy)).status,'quarantined');
      assert.ok(!(await pendingInputChanges(adapterPool,retryPorts,retryPolicy)).changeIds.includes(poison.id));assert.equal((await db.query('SELECT 1 FROM bsmoss_analysis.input_refresh_receipt WHERE change_id=$1',[poison.id])).rowCount,0);
      await assert.rejects(reopenInputChange(adapterPool,retryPorts,{changeId:poison.id,policy:retryPolicy,expectedRevision:'4',reasonRef:'review:fix'}),/input_dispatch_revision_conflict/);
      const request={changeId:poison.id,policy:retryPolicy,expectedRevision:'5',reasonRef:'review:fix'},reopened=await reopenInputChange(adapterPool,retryPorts,request);assert.equal(reopened.status,'reopened');assert.equal(reopened.revision,'6');
      assert.equal((await reopenInputChange(adapterPool,retryPorts,request)).status,'duplicate');await assert.rejects(reopenInputChange(adapterPool,retryPorts,{...request,expectedRevision:'4'}),/conflicting_input_reopen_replay/);
      const failed=await superviseInputChange(retryPool({failWork:true,ready:true}),retryPorts,poison.id,retryPolicy);assert.equal(failed.attempt,1);assert.equal(failed.revision,'7');
      const recovered=await superviseInputChange(adapterPool,retryPorts,poison.id,retryPolicy);assert.equal(recovered.status,'dispatched');await finishChangeJobs(recovered.manifest,retryPorts);
      assert.equal((await retryEvents(poison.id)).length,7);assert.equal((await dispatchInputChange(adapterPool,retryPorts,poison.id,retryPolicy)).status,'duplicate');
      await assert.rejects(reopenInputChange(adapterPool,retryPorts,{...request,expectedRevision:'7',reasonRef:'review:another'}),/input_already_dispatched/);
    });
    await t.test('delayed poison changes do not block later authorized input refresh steps',async()=>{
      const bad=await retryFact('blocked',1),good=await retryFact('healthy',2);
      await superviseInputChange(retryPool({failWork:true}),retryPorts,bad.id,retryPolicy);await superviseInputChange(retryPool({failWork:true}),retryPorts,bad.qualityId,retryPolicy);
      // Clear the original poison's initial quality change first, as its
      // independent evidence is also legitimately pending.
      const quality=await superviseInputChange(adapterPool,retryPorts,poison.qualityId,retryPolicy);await finishChangeJobs(quality.manifest,retryPorts);
      const step=await runInputRefreshStep(adapterPool,retryPorts,retryPolicy);assert.equal(step.status,'dispatched');assert.equal(step.changeId,good.id);await finishChangeJobs(step.manifest,retryPorts);
      const last=await runInputRefreshStep(adapterPool,retryPorts,retryPolicy);assert.equal(last.changeId,good.qualityId);await finishChangeJobs(last.manifest,retryPorts);assert.equal((await runInputRefreshStep(adapterPool,retryPorts,retryPolicy)).status,'idle');
    });
    await t.test('failure recording and reopening recheck permissions and never persist after revocation or expiry',async()=>{
      const fact=await retryFact('revoked',3);let reads=0;
      const revoked={...retryPorts,async readLocalGrant(){return ++reads===1?await retryPorts.readLocalGrant():null;}};
      await assert.rejects(superviseInputChange(retryPool({failWork:true}),revoked,fact.id,retryPolicy),/permission_denied/);assert.equal((await retryEvents(fact.id)).length,0);
      let clock=Date.now();const timed={...retryPorts,now:()=>clock};await assert.rejects(superviseInputChange(retryPool({failWork:true,afterControl(){clock+=120000;}}),timed,fact.id,retryPolicy),/access_expired/);assert.equal((await retryEvents(fact.id)).length,0);
      const changed={...retryPorts,async readLocalGrant(){reads++;return {...await retryPorts.readLocalGrant(),scope:reads===1?retryScope:{...retryScope,allowSiteParameters:true}};}};reads=0;
      await assert.rejects(superviseInputChange(retryPool({failWork:true}),changed,fact.id,retryPolicy),/permission_denied/);assert.equal((await retryEvents(fact.id)).length,0);
      const denied={...retryPorts,async readLocalGrant(){return null;}};await assert.rejects(reopenInputChange(adapterPool,denied,{changeId:poison.id,expectedRevision:'5',reasonRef:'unauthorized',policy:retryPolicy}),/permission_denied/);
    });
    await t.test('failure ledger write faults preserve retryability without partial jobs or false consumption',async()=>{
      const fact=await retryFact('control-rollback',4),before=(await db.query('SELECT count(*)::int AS n FROM bsmoss_analysis.refresh_job')).rows[0].n;
      await assert.rejects(superviseInputChange(retryPool({failWork:true,failControl:true}),retryPorts,fact.id,retryPolicy),/fixture_control_write_failure/);assert.equal((await retryEvents(fact.id)).length,0);
      assert.equal((await db.query('SELECT count(*)::int AS n FROM bsmoss_analysis.refresh_job')).rows[0].n,before);assert.equal((await db.query('SELECT 1 FROM bsmoss_analysis.input_refresh_receipt WHERE change_id=$1',[fact.id])).rowCount,0);
      const result=await superviseInputChange(adapterPool,retryPorts,fact.id,retryPolicy);assert.equal(result.status,'dispatched');await finishChangeJobs(result.manifest,retryPorts);
    });
    await t.test('concurrent failing consumers append only one counted attempt under the event fence',async()=>{
      const fact=await retryFact('race',5);
      const outcomes=await Promise.allSettled([superviseInputChange(retryPool({failWork:true}),retryPorts,fact.id,retryPolicy),superviseInputChange(retryPool({failWork:true}),retryPorts,fact.id,retryPolicy)]);
      assert.equal(outcomes.filter(r=>r.status==='fulfilled'&&r.value.status==='failure_recorded').length,1);
      assert.ok(outcomes.every(r=>r.status==='fulfilled'||['40001','23505'].includes(r.reason.code)));assert.equal((await retryEvents(fact.id)).length,1);
      assert.equal((await superviseInputChange(adapterPool,retryPorts,fact.id,retryPolicy)).status,'deferred');
    });
    await t.test('input control history rejects cross-tenant links and bad states and is immutable to runtime',async()=>{
      const sample=(await retryEvents(poison.id))[0];
      await assert.rejects(adapterPool.query('UPDATE bsmoss_analysis.input_dispatch_event SET attempt=0 WHERE change_id=$1',[poison.id]),e=>e.code==='42501');
      await assert.rejects(adapterPool.query('DELETE FROM bsmoss_analysis.input_dispatch_event WHERE change_id=$1',[poison.id]),e=>e.code==='42501');
      for(const patch of [{state:'retry',attempt:'5'},{state:'quarantined',attempt:'4'},{state:'reopened',attempt:'0',failure_code:null,reason_ref:null},{failure_code:'private endpoint'}]) {
        const row={...sample,revision:'99',...patch},keys=Object.keys(row);await assert.rejects(db.query('INSERT INTO bsmoss_analysis.input_dispatch_event('+keys.join(',')+') VALUES ('+keys.map((_,i)=>'$'+(i+1)).join(',')+')',Object.values(row)),e=>e.code==='23514');
      }
      const foreign={...sample,workspace_id:'other'},keys=Object.keys(foreign);await assert.rejects(db.query('INSERT INTO bsmoss_analysis.input_dispatch_event('+keys.join(',')+') VALUES ('+keys.map((_,i)=>'$'+(i+1)).join(',')+')',Object.values(foreign)),e=>e.code==='23503');
    });
    await t.test('planning failures before enqueue are delayed and quarantined without recording forbidden evidence',async()=>{
      const fact=await retryFact('history-limit',6);
      const original=(await db.query('SELECT m.* FROM bsmoss_metering.input_change c JOIN bsmoss_metering.measurement m ON (m.workspace_id,m.id)=(c.workspace_id,c.measurement_id) WHERE c.id=$1',[fact.id])).rows[0];
      await db.query(`INSERT INTO bsmoss_integration.raw_event(workspace_id,source_id,event_id,revision,payload_sha256,payload_uri,occurred_at)
        SELECT 'w','retry-src',$1,n,repeat('a',64),'fixture://history',clock_timestamp() FROM generate_series(2,1001) n`,[original.event_id]);
      await db.query(`INSERT INTO bsmoss_metering.measurement(workspace_id,id,source_id,event_id,event_revision,metric_code,metric_version,component_key,station_id,mapping_id,transform_version,period_start,period_end,value_kind,integer_value)
        SELECT 'w','retry-history:'||n,'retry-src',$1,n,$2,1,$3,'st','retry-map','1',$4,$5,'integer_delta',100 FROM generate_series(2,1001) n`,
        [original.event_id,upMetric.code,original.component_key,original.period_start,original.period_end]);
      const limited=await superviseInputChange(adapterPool,retryPorts,fact.id,retryPolicy);assert.equal(limited.status,'failure_recorded');assert.equal(limited.code,'capacity_limit');
      // A restricted caller must be rejected even when a forbidden historical
      // revision lies beyond the evidence planner's 1000-row return bound.
      await db.query(`INSERT INTO bsmoss_integration.source_mapping(workspace_id,id,source_id,external_type,external_id,station_id,service_id,network_object_id,version,valid_from,valid_to)
        VALUES ('w','retry-denied-map','retry-src','cell','retry-denied','st','svc','cell',1,'2026-01-01Z','2027-01-01Z')`);
      await db.query("UPDATE bsmoss_metering.measurement SET mapping_id='retry-denied-map' WHERE id='retry-history:1001'");
      await assert.rejects(superviseInputChange(adapterPool,retryPorts,fact.id,retryPolicy),/object_scope_denied/);assert.equal((await retryEvents(fact.id)).length,1);
      await assert.rejects(reopenInputChange(adapterPool,retryPorts,{changeId:fact.id,expectedRevision:'1',reasonRef:'review:denied-history',policy:retryPolicy}),/object_scope_denied/);
    });
    await t.test('completion with no mapping can be quarantined and reopened while the full original failure history survives',async()=>{
      const proof=await appendProof('1','confirmed',proofTarget(),false,{period_start:'2025-03-01T16:00:00Z',period_end:'2025-03-02T16:00:00Z',watermark:'2025-03-02T16:00:00Z'});
      // No reviewed mapping exists for this historical window. Authorization
      // still resolves from the proof's stable object, independently of it.
      const first=await superviseInputChange(adapterPool,proofPorts,proof.changeId,proofPolicy);assert.equal(first.code,'source_unavailable');
      await db.query("UPDATE bsmoss_analysis.input_dispatch_event SET available_at=clock_timestamp()-interval '1 second' WHERE change_id=$1",[proof.changeId]);
      for(let i=2;i<=5;i++)assert.equal((await superviseInputChange(retryPool({ready:true}),proofPorts,proof.changeId,proofPolicy)).attempt,i);
      const reopened=await reopenInputChange(adapterPool,proofPorts,{changeId:proof.changeId,expectedRevision:'5',reasonRef:'review:mapping-pending',policy:proofPolicy});assert.equal(reopened.status,'reopened');
      const again=await superviseInputChange(adapterPool,proofPorts,proof.changeId,proofPolicy);assert.equal(again.attempt,1);assert.equal(again.revision,'7');
      assert.equal((await db.query('SELECT 1 FROM bsmoss_analysis.input_refresh_receipt WHERE change_id=$1',[proof.changeId])).rowCount,0);
      assert.equal((await db.query('SELECT 1 FROM bsmoss_analysis.input_dispatch_event WHERE change_id=$1',[proof.changeId])).rowCount,7);
    });
    await db.query(`INSERT INTO bsmoss_integration.source VALUES ('w','query-src','QuerySource','file');
      INSERT INTO bsmoss_resource.station_service VALUES ('w','query-svc','st','op','2026-01-01Z','2027-01-01Z');
      INSERT INTO bsmoss_resource.network_object VALUES ('w','query-cell','st','query-svc','cell');
      INSERT INTO bsmoss_resource.device VALUES ('w','query-device','st','power','tower');
      INSERT INTO bsmoss_integration.source_mapping(workspace_id,id,source_id,external_type,external_id,station_id,service_id,network_object_id,device_id,version,valid_from,valid_to)
      VALUES ('w','query-map','query-src','cell','query-cell','st','query-svc','query-cell',NULL,1,'2026-01-01Z','2027-01-01Z'),
        ('w','query-state-map','query-src','device','query-device','st',NULL,NULL,'query-device',1,'2026-01-01Z','2027-01-01Z')`);
    await db.query(`INSERT INTO bsmoss_integration.source_capability VALUES ('w','query-cap','query-src',$1,1,'day','active','fixture://query-reviewed',$2,'2026-01-01Z','2027-01-01Z')`,[upMetric.code,capabilityPolicy]);
    await db.query(`INSERT INTO bsmoss_integration.source_capability VALUES ('w','query-state-cap','query-src',$1,1,'event','active','fixture://query-state-reviewed',$2,'2026-01-01Z','2027-01-01Z')`,
      [stateMetric.code,{stateAggregation:{version:1,authorityRef:'fixture://query-state-policy',maxHoldMilliseconds:86400000}}]);
    const queryScope={...scope,sourceIds:['query-src'],serviceIds:['query-svc'],deviceIds:['query-device'],allowSiteParameters:false};
    const queryPorts={...snapshotPorts,async readLocalGrant(){return {...await snapshotPorts.readLocalGrant(),permissions:['metering.view'],scope:queryScope};}};
    const queryApi=createAuthorizedAggregateQuery(queryPorts,{create:finite=>new PgAggregateQueryReader(adapterPool,finite)},'interactive');
    const queryTarget={sourceId:'query-src',mappingId:'query-map',metric:upMetric,grain:'day',at:'2026-04-01T16:00:00Z'},queryPeriod={start:'2026-04-01T16:00:00.000Z',end:'2026-04-02T16:00:00.000Z'};
    const queryStateTarget={...queryTarget,mappingId:'query-state-map',metric:stateMetric};
    const queryWriter=new PgMeasurementStore(adapterPool,queryScope,FIRST_METRICS);
    const queryDraft=(name,patch={})=>draft('query:'+name,{sourceId:'query-src',mappingId:'query-map',periodStart:queryPeriod.start,periodEnd:queryPeriod.end,value:{kind:'integer_delta',value:'9007199254740993'},...patch});
    async function publishQueryTarget(target=queryTarget){const snap=await readRefreshSnapshot(adapterPool,queryScope,target),s={workspaceId:'w',series:[{sourceId:target.sourceId,subjectKey:snap.plan.subjectKey,metricKey:target.metric.code+'@1'}]},
      aggregateStore=snap.kind==='state'?new PgStateAggregateStore(adapterPool,s):new PgAggregateStore(adapterPool,s),head=await aggregateStore.current(snap.plan);
      return aggregateStore.publish(snap.plan,snap.inputs,head?.revision??null,'query-fixture-worker');}
    let queryFact;
    await t.test('formal aggregate query needs only view permission and never publishes a missing revision',async()=>{
      queryFact=await queryWriter.append(queryDraft('usage'));
      assert.equal(await queryApi.read(queryTarget),null);
      assert.equal((await db.query("SELECT 1 FROM bsmoss_analysis.aggregate_series WHERE source_id='query-src'")).rowCount,0);
      await publishQueryTarget();const read=await queryApi.read(queryTarget);
      assert.equal(read.selection,'current');assert.equal(read.freshness,'current');assert.equal(read.revision,'1');assert.equal(read.currentRevision,'1');
      assert.equal(read.result.value.value,'9007199254740993');assert.equal(read.result.completeness,'preliminary');assert.deepEqual(read.reasons,[]);
      assert.equal(await queryApi.read({...queryTarget,revision:'999'}),null);
    });
    await t.test('formal query marks input corrections stale without mutating publication and retains exact historical revisions',async()=>{
      await queryWriter.append(queryDraft('usage',{revision:'2',previousRevision:'1',payloadSha256:'c'.repeat(64),value:{kind:'integer_delta',value:'9007199254741093'}}));
      const stale=await queryApi.read(queryTarget);assert.equal(stale.freshness,'stale');assert.deepEqual(stale.reasons,['latest_input_or_authority_changed']);
      assert.equal(stale.result.value.value,'9007199254740993');assert.notEqual(stale.currentInputFingerprint,stale.result.inputFingerprint);
      assert.equal(stale.currentRevision,'1');await publishQueryTarget();
      const latest=await queryApi.read(queryTarget);assert.equal(latest.freshness,'current');assert.equal(latest.revision,'2');assert.equal(latest.result.value.value,'9007199254741093');
      const old=await queryApi.read({...queryTarget,revision:'1'});assert.equal(old.selection,'revision');assert.equal(old.currentRevision,'2');assert.equal(old.freshness,'stale');
      assert.equal(old.result.value.value,'9007199254740993');assert.ok(old.reasons.includes('older_published_revision'));
      assert.equal((await queryApi.read({...queryTarget,revision:'2'})).freshness,'current');
    });
    await t.test('formal query reports reviewed authority changes and completion revocation as stale until recomputed',async()=>{
      await db.query("UPDATE bsmoss_integration.source_capability SET validation_ref='fixture://query-revalidated' WHERE id='query-cap'");
      assert.equal((await queryApi.read(queryTarget)).freshness,'stale');await publishQueryTarget();assert.equal((await queryApi.read(queryTarget)).freshness,'current');
      const snap=await readRefreshSnapshot(adapterPool,queryScope,queryTarget),base=aggregateIntervals(snap.plan,snap.inputs);
      await db.query(`INSERT INTO bsmoss_integration.source_completion_set(workspace_id,id,source_id,station_id,service_id,network_object_id,metric_code,metric_version,grain,period_start,period_end,revision,status,input_fingerprint,mapping_manifest_sha256,watermark,evidence_ref,evidence_sha256,recorded_by)
        VALUES ('w','query-proof','query-src','st','query-svc','query-cell',$1,1,'day',$2,$3,1,'confirmed',$4,$5,$3,'fixture://query-proof',$6,'fixture-reviewer')`,
        [upMetric.code,queryPeriod.start,queryPeriod.end,base.inputFingerprint,mappingSetFingerprint(snap.plan.mappingWindows),'a'.repeat(64)]);
      assert.equal((await queryApi.read(queryTarget)).freshness,'stale');await publishQueryTarget();assert.equal((await queryApi.read(queryTarget)).result.completeness,'complete');
      await db.query(`INSERT INTO bsmoss_integration.source_completion_set SELECT workspace_id,'query-revoked',source_id,station_id,service_id,network_object_id,device_id,metric_code,metric_version,grain,period_start,period_end,2,'revoked',input_fingerprint,mapping_manifest_sha256,period_start,'fixture://query-revoked',evidence_sha256,recorded_by,clock_timestamp() FROM bsmoss_integration.source_completion_set WHERE id='query-proof'`);
      const stale=await queryApi.read(queryTarget);assert.equal(stale.freshness,'stale');assert.equal(stale.result.completeness,'complete');
      await publishQueryTarget();const revised=await queryApi.read(queryTarget);assert.equal(revised.freshness,'current');assert.equal(revised.result.completeness,'preliminary');assert.ok(revised.result.reasons.includes('source_confirmation_revoked'));
    });
    await t.test('formal device state query preserves unknown coverage and detects quality corrections',async()=>{
      const saved=await queryWriter.append(queryDraft('state',{mappingId:'query-state-map',metric:stateMetric,value:{kind:'state_event',state:'running',validUntil:queryPeriod.end}}));
      await publishQueryTarget(queryStateTarget);const current=await queryApi.read(queryStateTarget);assert.equal(current.freshness,'current');assert.equal(current.result.value.kind,'state');assert.equal(current.result.value.durationMilliseconds.running,'86400000');
      await db.query(`INSERT INTO bsmoss_metering.quality_decision VALUES ('w','query-state-rejected',$1,2,'rejected','fixture','fixture','reviewer',clock_timestamp())`,[saved.id]);
      assert.equal((await queryApi.read(queryStateTarget)).freshness,'stale');await publishQueryTarget(queryStateTarget);
      const rejected=await queryApi.read(queryStateTarget);assert.equal(rejected.freshness,'current');assert.equal(rejected.result.completeness,'missing');assert.equal(rejected.result.value.durationMilliseconds.unknown,'86400000');
    });
    await t.test('formal query enforces tenant, source, station, service, device and dependency scope even for historical selectors',async()=>{
      for(const patch of [{sourceIds:[]},{stationIds:[]},{serviceIds:[]},{metricKeys:[]}]){
        const finite={...queryScope,...patch},api=createAuthorizedAggregateQuery({...queryPorts,async readLocalGrant(){return {...await queryPorts.readLocalGrant(),scope:finite};}},{create:s=>new PgAggregateQueryReader(adapterPool,s)},'interactive');
        await assert.rejects(api.read({...queryTarget,revision:'1'}),/scope_denied|mapping_unavailable/);
      }
      await assert.rejects(new PgAggregateQueryReader(adapterPool,{...queryScope,deviceIds:[]}).read(queryStateTarget),/object_scope_denied/);
      await assert.rejects(new PgAggregateQueryReader(adapterPool,{...queryScope,workspaceId:'other'}).read(queryTarget),/mapping_unavailable/);
      const derived={...proofTarget(depTarget.metric),sourceId:proofSource};
      await assert.rejects(new PgAggregateQueryReader(adapterPool,{...proofScope,metricKeys:[depTarget.metric.code+'@1']}).read(derived),/aggregate_dependency_scope_denied/);
    });
    await t.test('formal query uses one read-only snapshot for latest evidence and the published head across concurrent recomputation',async()=>{
      const before=await queryApi.read(queryTarget);let changed=false;
      const observed={async connect(){const client=await adapterPool.connect();return {async query(sql,args){const result=await client.query(sql,args);
        if(!changed&&sql.includes('FROM bsmoss_analysis.aggregate_series s JOIN')){changed=true;await queryWriter.append(queryDraft('usage',{revision:'3',previousRevision:'2',payloadSha256:'d'.repeat(64),value:{kind:'integer_delta',value:'42'}}));await publishQueryTarget();}
        return result;},release(discard){client.release(discard);}};}};
      const consistent=await new PgAggregateQueryReader(observed,queryScope).read(queryTarget);assert.equal(changed,true);
      assert.equal(consistent.revision,before.revision);assert.equal(consistent.currentRevision,before.currentRevision);assert.equal(consistent.freshness,'current');assert.equal(consistent.result.value.value,'9007199254741093');
      const after=await queryApi.read(queryTarget);assert.equal(after.result.value.value,'42');assert.equal(after.freshness,'current');assert.notEqual(after.currentRevision,before.currentRevision);
    });
    await t.test('formal query performs no enqueue, acknowledgment or publication writes and rejects corrupt result identity',async()=>{
      const counts=async()=> (await db.query('SELECT (SELECT count(*) FROM bsmoss_analysis.aggregate_revision) revisions,(SELECT count(*) FROM bsmoss_analysis.refresh_job) jobs,(SELECT count(*) FROM bsmoss_analysis.input_refresh_receipt) receipts,(SELECT count(*) FROM bsmoss_analysis.aggregate_outbox) outbox')).rows[0];
      const before=await counts();await queryApi.read(queryTarget);await queryApi.read(queryStateTarget);assert.deepEqual(await counts(),before);
      const observed={async connect(){const client=await adapterPool.connect();return {async query(sql,args){const result=await client.query(sql,args);if(sql.includes('FROM bsmoss_analysis.aggregate_series s JOIN')&&result.rows[0])result.rows[0].result_payload.sourceId='foreign';return result;},release(discard){client.release(discard);}};}};
      await assert.rejects(new PgAggregateQueryReader(observed,queryScope).read(queryTarget),/aggregate_publication_corrupt/);
    });
    const gaugeMetric={code:'runtime.environment.temperature_c',version:1},gAt=n=>new Date(Date.parse('2026-05-01T16:00:00Z')+n*60000).toISOString();
    const gaugePolicy={gaugeAggregation:{version:1,authorityRef:'fixture://gauge-policy',mode:'sample_mean',scale:3}};
    await db.query(`INSERT INTO bsmoss_integration.source VALUES ('w','gauge-src','GaugeSource','file');
      INSERT INTO bsmoss_catalog.metric_version VALUES ('runtime.environment.temperature_c',1,'runtime_parameter','gauge','degC','{}');
      INSERT INTO bsmoss_resource.device VALUES ('w','gauge-main','st','sensor','tower'),('w','gauge-big','st','sensor','tower'),('w','gauge-moved','st','sensor','tower');
      INSERT INTO bsmoss_integration.source_mapping(workspace_id,id,source_id,external_type,external_id,station_id,device_id,version,valid_from,valid_to)
      VALUES ('w','gauge-main-map','gauge-src','device','gauge-main','st','gauge-main',1,'2026-01-01Z','2027-01-01Z'),
        ('w','gauge-big-map','gauge-src','device','gauge-big','st','gauge-big',1,'2026-01-01Z','2027-01-01Z'),
        ('w','gauge-moved-map','gauge-src','device','gauge-moved','st','gauge-moved',1,'2026-01-01Z','2027-01-01Z')`);
    await db.query(`INSERT INTO bsmoss_integration.source_capability VALUES ('w','gauge-cap','gauge-src',$1,1,'15m','active','fixture://gauge-validated',$2,'2026-01-01Z','2027-01-01Z')`,[gaugeMetric.code,gaugePolicy]);
    const gaugeScope={...scope,sourceIds:['gauge-src'],metricKeys:[gaugeMetric.code+'@1'],serviceIds:[],deviceIds:['gauge-main','gauge-big','gauge-moved'],allowSiteParameters:false};
    const gaugePorts={...snapshotPorts,async readLocalGrant(){return {...await snapshotPorts.readLocalGrant(),scope:gaugeScope};}};
    const gaugeReader=new PgGaugeSnapshotReader(adapterPool,gaugeScope),gaugeWriter=new PgMeasurementStore(adapterPool,gaugeScope,FIRST_METRICS);
    const gaugeTarget=(sensor='main',at=gAt(0))=>({sourceId:'gauge-src',mappingId:'gauge-'+sensor+'-map',metric:gaugeMetric,grain:'hour',at});
    const gaugeDraft=(sensor,n,value,patch={})=>draft('gauge:'+sensor+':'+n,{sourceId:'gauge-src',mappingId:'gauge-'+sensor+'-map',metric:gaugeMetric,componentKey:'temperature',
      periodStart:gAt(n*15),periodEnd:gAt((n+1)*15),value:{kind:'fixed_point',unscaled:value,scale:3},...patch});
    const gaugeView=new PgAggregateQueryReader(adapterPool,gaugeScope);
    async function gaugeAggregate(target=gaugeTarget()){
      const snap=await gaugeReader.load(target),store=new PgGaugeAggregateStore(adapterPool,{workspaceId:'w',series:[{sourceId:'gauge-src',subjectKey:snap.plan.subjectKey,metricKey:gaugeMetric.code+'@1'}]});
      return {snap,store};
    }
    async function publishGauge(target=gaugeTarget()) {const {snap,store}=await gaugeAggregate(target),head=await store.current(snap.plan);return store.publish(snap.plan,snap.inputs,head?.revision??null,'gauge-worker');}
    async function gaugeProof(revision,status='confirmed'){
      const {snap}=await gaugeAggregate(),basePlan={...snap.plan,sourceComplete:false,watermark:gAt(0)};delete basePlan.completionEvidence;
      const base=aggregateGaugePeriod(basePlan,snap.inputs);
      await db.query(`INSERT INTO bsmoss_integration.source_completion_set(workspace_id,id,source_id,station_id,device_id,metric_code,metric_version,grain,period_start,period_end,revision,status,input_fingerprint,mapping_manifest_sha256,watermark,evidence_ref,evidence_sha256,recorded_by)
        VALUES ('w',$1,'gauge-src','st','gauge-main',$2,1,'hour',$3,$4,$5,$6,$7,$8,$9,'fixture://gauge-proof',$10,'fixture-reviewer')`,
        ['gauge-proof:'+revision,gaugeMetric.code,gAt(0),gAt(60),revision,status,base.inputFingerprint,mappingSetFingerprint(base.mappingWindows),status==='confirmed'?gAt(60):gAt(0),'e'.repeat(64)]);
    }
    let gaugeFirst;
    await t.test('gauge fixed precision survives raw persistence, replay, publication and read-only query',async()=>{
      const values=['-9007199254740993','9007199254740995','100','-100'];
      for(let i=0;i<4;i++){const result=await gaugeWriter.append(gaugeDraft('main',i,values[i]));if(!i)gaugeFirst=result;}
      assert.equal((await gaugeWriter.append(gaugeDraft('main',0,values[0]))).status,'duplicate');
      const raw=(await db.query('SELECT unscaled,scale FROM bsmoss_metering.measurement WHERE id=$1',[gaugeFirst.id])).rows[0];assert.equal(raw.unscaled,values[0]);assert.equal(raw.scale,'3');
      const published=await publishGauge();assert.equal(published.status,'inserted');assert.equal((await publishGauge()).status,'duplicate');
      const read=await gaugeView.read(gaugeTarget());assert.equal(read.freshness,'current');assert.equal(read.result.completeness,'preliminary');
      assert.deepEqual(read.result.value.mean,{numerator:'2',denominator:'4'});assert.equal(read.result.value.minimum.observedAt,gAt(0));assert.equal(read.result.coveredMilliseconds,null);
      const typed=(await db.query('SELECT value_kind,gauge_value,integer_value,state_value FROM bsmoss_analysis.aggregate_revision WHERE series_id=$1',[published.seriesId])).rows[0];
      assert.equal(typed.value_kind,'gauge');assert.deepEqual(typed.gauge_value,read.result.value);assert.equal(typed.integer_value,null);assert.equal(typed.state_value,null);
    });
    await t.test('gauge confirmed completeness binds exact quality and policy and revocation remains visible',async()=>{
      await gaugeProof('1');assert.equal((await gaugeView.read(gaugeTarget())).freshness,'stale');await publishGauge();
      const full=await gaugeView.read(gaugeTarget());assert.equal(full.result.completeness,'complete');const revision=full.revision;
      await gaugeProof('2','revoked');const stale=await gaugeView.read(gaugeTarget());assert.equal(stale.result.completeness,'complete');assert.equal(stale.freshness,'stale');
      await publishGauge();assert.equal((await gaugeView.read(gaugeTarget())).result.completeness,'preliminary');
      assert.equal((await gaugeView.read({...gaugeTarget(),revision})).result.completeness,'complete');
      await gaugeProof('3');await db.query('UPDATE bsmoss_integration.source_capability SET rules=$1 WHERE id=$2',[{gaugeAggregation:{...gaugePolicy.gaugeAggregation,authorityRef:'fixture://revalidated-gauge'}},'gauge-cap']);
      let snap=await gaugeReader.load(gaugeTarget());assert.ok(aggregateGaugePeriod(snap.plan,snap.inputs).reasons.includes('source_confirmation_stale'));
      await db.query('UPDATE bsmoss_integration.source_capability SET rules=$1 WHERE id=$2',[gaugePolicy,'gauge-cap']);
      await db.query(`INSERT INTO bsmoss_metering.quality_decision VALUES ('w','gauge-rejected',$1,2,'rejected','fixture','fixture','reviewer',clock_timestamp())`,[gaugeFirst.id]);
      snap=await gaugeReader.load(gaugeTarget());const partial=aggregateGaugePeriod(snap.plan,snap.inputs);assert.equal(partial.completeness,'partial');assert.equal(partial.validWindows,3);assert.ok(partial.reasons.includes('source_confirmation_stale'));
      await publishGauge();assert.equal((await gaugeView.read(gaugeTarget())).result.value.minimum.unscaled,'-100');
    });
    await t.test('reviewed time weighting stores a numerator beyond numeric30 without float truncation',async()=>{
      const huge='9'.repeat(30);for(let i=0;i<4;i++)await gaugeWriter.append(gaugeDraft('big',i,huge));
      await db.query('UPDATE bsmoss_integration.source_capability SET rules=$1 WHERE id=$2',[{gaugeAggregation:{...gaugePolicy.gaugeAggregation,mode:'time_weighted',durationRef:'fixture://explicit-valid-duration'}},'gauge-cap']);
      await publishGauge(gaugeTarget('big'));const read=await gaugeView.read(gaugeTarget('big'));
      assert.deepEqual(read.result.value.mean,{numerator:String(BigInt(huge)*3600000n),denominator:'3600000'});assert.equal(read.result.coveredMilliseconds,'3600000');
      await db.query('UPDATE bsmoss_integration.source_capability SET rules=$1 WHERE id=$2',[gaugePolicy,'gauge-cap']);
      assert.equal((await gaugeView.read(gaugeTarget('big'))).freshness,'stale');
    });
    await t.test('gauge device and calendar corrections retract old samples before filtering and dispatch both windows',async()=>{
      await gaugeWriter.append(gaugeDraft('main',1,'1234',{revision:'2',previousRevision:'1',payloadSha256:'c'.repeat(64),mappingId:'gauge-moved-map',periodStart:gAt(1440),periodEnd:gAt(1455)}));
      const old=await gaugeReader.load(gaugeTarget());assert.equal(old.inputs.length,3);assert.ok(!old.inputs.some(r=>r.eventId==='gauge:main:1'));
      const next=await gaugeReader.load(gaugeTarget('moved',gAt(1440)));assert.equal(next.inputs.length,1);assert.equal(next.inputs[0].unscaled,'1234');
      const change=(await db.query(`SELECT c.id FROM bsmoss_metering.input_change c JOIN bsmoss_metering.measurement m ON (m.workspace_id,m.id)=(c.workspace_id,c.measurement_id) WHERE m.event_id='gauge:main:1' AND m.event_revision=2 AND c.change_kind='measurement'`)).rows[0];
      const result=await dispatchInputChange(adapterPool,gaugePorts,change.id,{outputs:[gaugeMetric],grains:['day']});assert.equal(result.manifest.targets.length,2);await finishChangeJobs(result.manifest,gaugePorts);
      assert.equal((await gaugeView.read({...gaugeTarget(),grain:'day'})).result.validWindows,2);assert.equal((await gaugeView.read({...gaugeTarget('moved',gAt(1440)),grain:'day'})).result.completeness,'partial');
      const empty=await gaugeReader.load(gaugeTarget('moved'));assert.equal(aggregateGaugePeriod(empty.plan,empty.inputs).value,null);
      const denied={...gaugePorts,async readLocalGrant(){return {...await gaugePorts.readLocalGrant(),scope:{...gaugeScope,deviceIds:['gauge-moved']}};}};
      await assert.rejects(dispatchInputChange(adapterPool,denied,change.id,{outputs:[gaugeMetric],grains:['day']}),/object_scope_denied/);
    });
    await t.test('gauge scope and reviewed policies reject wrong attribution, scale, capability and coarse periods',async()=>{
      for(const patch of [{deviceIds:[]},{stationIds:[]},{sourceIds:[]},{metricKeys:[]},{workspaceId:'other'}])await assert.rejects(new PgGaugeSnapshotReader(adapterPool,{...gaugeScope,...patch}).load(gaugeTarget()),/scope_denied|mapping_unavailable/);
      for(const policy of [{...gaugePolicy.gaugeAggregation,mode:'time_weighted'},null]){
        await db.query('UPDATE bsmoss_integration.source_capability SET rules=$1 WHERE id=$2',[{gaugeAggregation:policy},'gauge-cap']);
        await assert.rejects(gaugeReader.load(gaugeTarget()),/gauge_duration_required|gauge_policy_required/);
      }
      await db.query('UPDATE bsmoss_integration.source_capability SET rules=$1 WHERE id=$2',[gaugePolicy,'gauge-cap']);
      await db.query("UPDATE bsmoss_integration.source_capability SET status='planned' WHERE id='gauge-cap'");await assert.rejects(gaugeReader.load(gaugeTarget()),/capability_unavailable/);
      await db.query("UPDATE bsmoss_integration.source_capability SET status='active' WHERE id='gauge-cap'");
      await gaugeWriter.append(gaugeDraft('moved',8,'1',{value:{kind:'fixed_point',unscaled:'1',scale:2}}));
      await assert.rejects(gaugeReader.load(gaugeTarget('moved',gAt(120))),/gauge_scale_mismatch/);
      await gaugeWriter.append(gaugeDraft('moved',12,'1',{periodEnd:gAt(240)}));await assert.rejects(gaugeReader.load(gaugeTarget('moved',gAt(180))),/unexpected_or_coarse_window/);
      await assert.rejects(db.query("UPDATE bsmoss_integration.source_mapping SET service_id='svc' WHERE id='gauge-moved-map'"),/authority_object_immutable/);
      await db.query(`INSERT INTO bsmoss_integration.source_mapping(workspace_id,id,source_id,external_type,external_id,station_id,service_id,device_id,version,valid_from,valid_to)
        VALUES ('w','gauge-bad-map','gauge-src','device','gauge-bad','st','svc','gauge-moved',1,'2026-01-01Z','2027-01-01Z')`);
      await assert.rejects(gaugeReader.load({...gaugeTarget('moved'),mappingId:'gauge-bad-map'}),/mapping_object_mismatch/);
      await assert.rejects(gaugeWriter.append(gaugeDraft('moved',16,'1',{mappingId:'gauge-bad-map'})),/object_scope_denied|mapping_object_mismatch/);
    });
    await t.test('gauge refresh rolls back value outbox and receipt together and preserves idempotent retry',async()=>{
      const target=gaugeTarget('big'),input={targets:[target],triggerRef:'fixture:gauge:atomic'};
      const {snap,store}=await gaugeAggregate(target),before=await store.current(snap.plan);
      await enqueueAuthorizedRefresh(adapterPool,gaugePorts,input);const lease=await claimAuthorizedRefresh(adapterPool,gaugePorts);
      const injected={async connect(){const c=await adapterPool.connect();return {query(sql,args){if(sql.includes('INSERT INTO bsmoss_analysis.refresh_attempt'))throw Error('fixture_gauge_receipt_failure');return c.query(sql,args);},release(discard){c.release(discard);}};}};
      await assert.rejects(executeRefreshLease(injected,gaugePorts,lease),/fixture_gauge_receipt_failure/);
      assert.equal((await store.current(snap.plan)).revision,before.revision);assert.equal((await db.query('SELECT 1 FROM bsmoss_analysis.refresh_attempt WHERE job_id=$1',[lease.id])).rowCount,0);
      const result=await executeRefreshLease(adapterPool,gaugePorts,lease);assert.equal(result.status,'inserted');
      assert.equal((await db.query('SELECT count(*)::int n FROM bsmoss_analysis.aggregate_outbox WHERE series_id=$1',[result.seriesId])).rows[0].n,2);
      await enqueueAuthorizedRefresh(adapterPool,gaugePorts,{...input,triggerRef:'fixture:gauge:atomic:replay'});assert.equal((await runRefreshStep(adapterPool,gaugePorts)).result.status,'duplicate');
    });
    await t.test('gauge refresh cannot overwrite a new head using an older repeatable-read input snapshot',async()=>{
      await gaugeWriter.append(gaugeDraft('big',0,'1',{revision:'2',previousRevision:'1',payloadSha256:'c'.repeat(64)}));
      await enqueueAuthorizedRefresh(adapterPool,gaugePorts,{targets:[gaugeTarget('big')],triggerRef:'fixture:gauge:race'});const lease=await claimAuthorizedRefresh(adapterPool,gaugePorts);let changed=false;
      const intercepted={async connect(){const c=await adapterPool.connect();return {async query(sql,args){const result=await c.query(sql,args);if(!changed&&sql.includes('SELECT m.*,r.payload_sha256')){
        changed=true;await gaugeWriter.append(gaugeDraft('big',0,'2',{revision:'3',previousRevision:'2',payloadSha256:'d'.repeat(64)}));await publishGauge(gaugeTarget('big'));
      }return result;},release(discard){c.release(discard);}};}};
      await assert.rejects(executeRefreshLease(intercepted,gaugePorts,lease),e=>e.code==='40001'||/aggregate_revision_conflict/.test(e.message));assert.equal(changed,true);
      const read=await gaugeView.read(gaugeTarget('big'));assert.equal(read.freshness,'current');assert.equal(read.result.value.minimum.unscaled,'2');
      assert.equal((await executeRefreshLease(adapterPool,gaugePorts,lease)).status,'duplicate');
    });
    await t.test('gauge SQL rejects malformed precision, zero denominator, mixed variants and immutable rewrites',async()=>{
      const row=(await db.query("SELECT * FROM bsmoss_analysis.aggregate_revision WHERE value_kind='gauge' LIMIT 1")).rows[0];
      for(const patch of [{gauge_value:{kind:'gauge'}},{gauge_value:{...row.gauge_value,scale:10}},{gauge_value:{...row.gauge_value,mean:{numerator:'1',denominator:'0'}}},
        {gauge_value:{...row.gauge_value,minimum:{unscaled:'1e3',observedAt:gAt(0)}}},{state_value:{}},{integer_value:'1'}]){
        const candidate={...row,revision:'99',input_fingerprint:'f'.repeat(64),...patch};candidate.result_payload={...row.result_payload,inputFingerprint:candidate.input_fingerprint,value:candidate.gauge_value};
        const keys=Object.keys(candidate);await assert.rejects(db.query('INSERT INTO bsmoss_analysis.aggregate_revision('+keys.join(',')+') VALUES ('+keys.map((_,i)=>'$'+(i+1)).join(',')+')',Object.values(candidate)),e=>e.code==='23514');
      }
      await assert.rejects(adapterPool.query("UPDATE bsmoss_analysis.aggregate_revision SET gauge_value='{}' WHERE series_id=$1",[row.series_id]),e=>e.code==='42501');
      await assert.rejects(adapterPool.query('DELETE FROM bsmoss_analysis.aggregate_revision WHERE series_id=$1',[row.series_id]),e=>e.code==='42501');
    });
    await db.query("INSERT INTO bsmoss_integration.source VALUES ('w','authority-src','AuthoritySource','file')");
    const authorityHistory=async(kind,id)=>(await db.query('SELECT * FROM bsmoss_integration.authority_change WHERE workspace_id=$1 AND entity_kind=$2 AND entity_id=$3 ORDER BY revision',['w',kind,id])).rows;
    async function insertAuthority(kind,id) {
      if(kind==='source_mapping')return db.query(`INSERT INTO bsmoss_integration.source_mapping(workspace_id,id,source_id,external_type,external_id,station_id,version,valid_from,valid_to)
        VALUES ('w',$1,'authority-src','station',$1,'st',900719925474099300000000000001,'2026-01-01Z','2027-01-01Z')`,[id]);
      if(kind==='source_capability')return db.query(`INSERT INTO bsmoss_integration.source_capability VALUES ('w',$1,'authority-src',$2,1,'day','active','fixture://authority-reviewed',$3,'2026-01-01Z','2027-01-01Z')`,[id,upMetric.code,capabilityPolicy]);
      return db.query(`INSERT INTO bsmoss_resource.station_service VALUES ('w',$1,'st','op','2026-01-01Z','2027-01-01Z')`,[id]);
    }
    const authorityTable=kind=>(kind==='station_service'?'bsmoss_resource.':'bsmoss_integration.')+kind;
    await t.test('authority changes retain exact old and new rows, no-op suppression, delete evidence and recreate revisions',async()=>{
      for(const kind of ['source_mapping','source_capability','station_service']) {
        const id='authority:'+kind,table=authorityTable(kind);await insertAuthority(kind,id);
        let rows=await authorityHistory(kind,id);assert.equal(rows.length,1);assert.equal(rows[0].operation,'insert');assert.equal(rows[0].before_snapshot,null);
        if(kind==='source_mapping')assert.equal(rows[0].after_snapshot.version,'900719925474099300000000000001');
        if(kind==='source_capability')assert.equal(rows[0].after_snapshot.metric_version,'1');
        await db.query('UPDATE '+table+' SET valid_to=valid_to WHERE id=$1',[id]);assert.equal((await authorityHistory(kind,id)).length,1);
        await db.query('UPDATE '+table+" SET valid_to='2026-12-01Z' WHERE id=$1",[id]);rows=await authorityHistory(kind,id);assert.equal(rows.length,2);
        assert.deepEqual(rows[1].before_snapshot,rows[0].after_snapshot);assert.ok(rows[1].after_snapshot.valid_to.endsWith('+00:00'));
        await db.query('DELETE FROM '+table+' WHERE id=$1',[id]);rows=await authorityHistory(kind,id);assert.equal(rows[2].operation,'delete');assert.equal(rows[2].after_snapshot,null);assert.deepEqual(rows[2].before_snapshot,rows[1].after_snapshot);
        await insertAuthority(kind,id);rows=await authorityHistory(kind,id);assert.deepEqual(rows.map(r=>r.revision),['1','2','3','4']);
        const bytes=(await db.query("SELECT jsonb_build_object('before',before_snapshot,'after',after_snapshot)::text AS evidence FROM bsmoss_integration.authority_change WHERE id=$1",[rows[2].id])).rows[0].evidence;
        assert.equal(createHash('sha256').update(bytes,'utf8').digest('hex'),rows[2].evidence_sha256);assert.equal(rows[0].database_actor,(await db.query('SELECT session_user AS actor')).rows[0].actor);
      }
    });
    await t.test('authority journal captures capability rules and review references and preserves timezone-independent facts',async()=>{
      const id='authority:source_capability',prior=(await authorityHistory('source_capability',id)).at(-1).after_snapshot;
      await db.query("SET TIME ZONE 'Asia/Shanghai'");
      try {await db.query("UPDATE bsmoss_integration.source_capability SET rules=$1,validation_ref='fixture://authority-revised',status='retired' WHERE id=$2",[{intervalAggregation:{version:1,inputMode:'direct',authorityRef:'fixture://policy-revised'}},id]);}
      finally{await db.query("SET TIME ZONE 'UTC'");}
      const change=(await authorityHistory('source_capability',id)).at(-1);assert.deepEqual(change.before_snapshot,prior);
      assert.equal(change.after_snapshot.status,'retired');assert.equal(change.after_snapshot.validation_ref,'fixture://authority-revised');assert.equal(change.after_snapshot.rules.intervalAggregation.authorityRef,'fixture://policy-revised');
      assert.equal(change.after_snapshot.valid_from,prior.valid_from);
    });
    await t.test('authority journal failures roll back original inserts updates deletes and the complete transaction',async()=>{
      await db.query(`CREATE FUNCTION bsmoss_integration.reject_authority_fixture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.entity_id LIKE 'authority:%' THEN RAISE EXCEPTION 'fixture_authority_capture_failure'; END IF; RETURN NEW; END $$;
        CREATE TRIGGER reject_authority_fixture BEFORE INSERT ON bsmoss_integration.authority_change FOR EACH ROW EXECUTE FUNCTION bsmoss_integration.reject_authority_fixture()`);
      try{
        for(const kind of ['source_mapping','source_capability','station_service']){
          const id='authority:'+kind,table=authorityTable(kind),before=await authorityHistory(kind,id);
          await assert.rejects(insertAuthority(kind,'authority:failed:'+kind),/fixture_authority_capture_failure/);
          assert.equal((await db.query('SELECT 1 FROM '+table+' WHERE id=$1',['authority:failed:'+kind])).rowCount,0);
          await assert.rejects(db.query('UPDATE '+table+" SET valid_to='2026-11-01Z' WHERE id=$1",[id]),/fixture_authority_capture_failure/);
          await assert.rejects(db.query('DELETE FROM '+table+' WHERE id=$1',[id]),/fixture_authority_capture_failure/);
          assert.deepEqual(await authorityHistory(kind,id),before);assert.equal((await db.query('SELECT valid_to FROM '+table+' WHERE id=$1',[id])).rows[0].valid_to.toISOString(),'2027-01-01T00:00:00.000Z');
        }
        await db.query('BEGIN');try{await db.query("INSERT INTO bsmoss_resource.station VALUES ('w','authority-rolled-back','RolledBack','tower','610000','610100')");await assert.rejects(insertAuthority('source_mapping','authority:tx-failed'),/fixture_authority_capture_failure/);}finally{await db.query('ROLLBACK');}
        assert.equal((await db.query("SELECT 1 FROM bsmoss_resource.station WHERE id='authority-rolled-back'")).rowCount,0);
      }finally{await db.query('DROP TRIGGER reject_authority_fixture ON bsmoss_integration.authority_change; DROP FUNCTION bsmoss_integration.reject_authority_fixture()');}
    });
    await t.test('authority runtime cannot mutate master data, forge history, invoke the definer or truncate tracked tables',async()=>{
      for(const kind of ['source_mapping','source_capability','station_service']){
        const table=authorityTable(kind),id='authority:'+kind;
        await assert.rejects(adapterPool.query('INSERT INTO '+table+' SELECT * FROM '+table+' WHERE id=$1',[id]),e=>e.code==='42501');
        for(const sql of ['UPDATE '+table+' SET valid_to=valid_to WHERE id=$1','DELETE FROM '+table+' WHERE id=$1'])await assert.rejects(adapterPool.query(sql,[id]),e=>e.code==='42501');
        await assert.rejects(adapterPool.query('TRUNCATE '+table+' CASCADE'),e=>e.code==='42501');
        await assert.rejects(db.query('TRUNCATE '+table+' CASCADE'),/authority_truncate_forbidden/);
      }
      for(const sql of ["INSERT INTO bsmoss_integration.authority_change SELECT * FROM bsmoss_integration.authority_change LIMIT 1","UPDATE bsmoss_integration.authority_change SET database_actor='spoof'","DELETE FROM bsmoss_integration.authority_change","TRUNCATE bsmoss_integration.authority_change"])
        await assert.rejects(adapterPool.query(sql),e=>e.code==='42501');
      const acl=(await db.query("SELECT has_function_privilege('bsmoss_svc','bsmoss_integration.capture_authority_change()','EXECUTE') AS allowed")).rows[0];assert.equal(acl.allowed,false);
      await assert.rejects(adapterPool.query('SELECT bsmoss_integration.capture_authority_change()'),e=>e.code==='42501');
      await db.query(`CREATE SCHEMA authority_spoof; CREATE TABLE authority_spoof.source_mapping(workspace_id text,id text);
        CREATE TRIGGER fake_capture AFTER INSERT ON authority_spoof.source_mapping FOR EACH ROW EXECUTE FUNCTION bsmoss_integration.capture_authority_change()`);
      try{await assert.rejects(db.query("INSERT INTO authority_spoof.source_mapping VALUES ('w','spoof')"),/unsupported_authority_table/);}
      finally{await db.query('DROP SCHEMA authority_spoof CASCADE');}
    });
    await t.test('authority identities are stable and SQL rejects mismatched tenants malformed operations and altered evidence',async()=>{
      for(const kind of ['source_mapping','source_capability','station_service'])await assert.rejects(db.query('UPDATE '+authorityTable(kind)+" SET id=id||':renamed' WHERE id=$1",['authority:'+kind]),/authority_identity_immutable/);
      const sample=(await authorityHistory('source_mapping','authority:source_mapping'))[1];
      for(const patch of [{workspace_id:'other'},{entity_id:'other'},{operation:'insert'},{operation:'delete'},{before_snapshot:[]},{after_snapshot:{}},{evidence_sha256:'0'.repeat(64)}]){
        const row={...sample,id:randomUUID(),revision:'99',...patch},keys=Object.keys(row);
        await assert.rejects(db.query('INSERT INTO bsmoss_integration.authority_change('+keys.join(',')+') VALUES ('+keys.map((_,i)=>'$'+(i+1)).join(',')+')',Object.values(row)),e=>e.code==='23514');
      }
    });
    await t.test('concurrent authority updates serialize exact before-after revision chains and rollback leaves no ghost revision',async()=>{
      const id='authority:source_mapping',before=await authorityHistory('source_mapping',id),a=new Client({connectionString:target.toString()}),b=new Client({connectionString:target.toString()});peers.push(a,b);await Promise.all([a.connect(),b.connect()]);
      await Promise.all([a.query("UPDATE bsmoss_integration.source_mapping SET version=version+1 WHERE id=$1",[id]),b.query("UPDATE bsmoss_integration.source_mapping SET version=version+1 WHERE id=$1",[id])]);
      let rows=await authorityHistory('source_mapping',id);assert.equal(rows.length,before.length+2);assert.deepEqual(rows.at(-1).before_snapshot,rows.at(-2).after_snapshot);
      assert.equal(rows.at(-1).after_snapshot.version,String(BigInt(before.at(-1).after_snapshot.version)+2n));
      await a.query('BEGIN');try{await a.query("UPDATE bsmoss_integration.source_mapping SET version=version+1 WHERE id=$1",[id]);assert.equal((await authorityHistory('source_mapping',id)).length,rows.length);}finally{await a.query('ROLLBACK');}
      assert.deepEqual(await authorityHistory('source_mapping',id),rows);await db.query("UPDATE bsmoss_integration.source_mapping SET version=version+1 WHERE id=$1",[id]);
      const last=(await authorityHistory('source_mapping',id)).at(-1);assert.equal(last.revision,String(BigInt(rows.at(-1).revision)+1n));
    });
    await db.query(`INSERT INTO bsmoss_integration.source VALUES ('w','flow-src','AuthorityFlow','file');
      INSERT INTO bsmoss_resource.station_service VALUES ('w','flow-svc','st','op','2026-01-01Z','2027-01-01Z');
      INSERT INTO bsmoss_resource.network_object VALUES ('w','flow-cell','st','flow-svc','cell');
      INSERT INTO bsmoss_resource.device VALUES ('w','flow-dev','st','sensor','tower'),('w','flow-empty','st','sensor','tower');
      INSERT INTO bsmoss_integration.source_mapping(workspace_id,id,source_id,external_type,external_id,station_id,service_id,network_object_id,device_id,version,valid_from,valid_to)
      VALUES ('w','flow-cell-map','flow-src','cell','flow-cell','st','flow-svc','flow-cell',NULL,1,'2026-01-01Z','2027-01-01Z'),
        ('w','flow-dev-map','flow-src','device','flow-dev','st',NULL,NULL,'flow-dev',1,'2026-01-01Z','2027-01-01Z'),
        ('w','flow-empty-map','flow-src','device','flow-empty','st',NULL,NULL,'flow-empty',1,'2026-01-01Z','2027-01-01Z')`);
    const flowRatio={code:'status.voice.connection_rate',version:1},flowAttempt={code:'service.voice.attempt_count',version:1};
    const flowDefs=[['up',upMetric,'day',capabilityPolicy],['down',down,'day',capabilityPolicy],['total',depTarget.metric,'day',depPolicy],['ratio',flowRatio,'day',capabilityPolicy],['attempt',flowAttempt,'day',capabilityPolicy],
      ['state',stateMetric,'event',{stateAggregation:{version:1,authorityRef:'fixture://flow-state',maxHoldMilliseconds:86400000}}],['gauge',gaugeMetric,'day',gaugePolicy]];
    for(const [id,ref,native,policy] of flowDefs)await db.query(`INSERT INTO bsmoss_integration.source_capability VALUES ('w',$1,'flow-src',$2,1,$3,'active','fixture://flow-reviewed',$4,'2026-01-01Z','2027-01-01Z')`,['flow-'+id+'-cap',ref.code,native,policy]);
    const flowScope={...scope,sourceIds:['flow-src'],serviceIds:['flow-svc'],deviceIds:['flow-dev','flow-empty'],allowSiteParameters:false};
    const flowPorts={...snapshotPorts,async readLocalGrant(){return {...await snapshotPorts.readLocalGrant(),scope:flowScope};}};
    const flowPolicy={outputs:[upMetric,depTarget.metric,flowRatio,stateMetric,gaugeMetric],grains:['day']},flowWriter=new PgMeasurementStore(adapterPool,flowScope,FIRST_METRICS);
    const flowPeriod={start:'2026-06-01T16:00:00.000Z',end:'2026-06-02T16:00:00.000Z'};
    const flowTarget=(ref=upMetric,map=ref.code.startsWith('runtime.')?'flow-dev-map':'flow-cell-map')=>({sourceId:'flow-src',mappingId:map,metric:ref,grain:'day',at:flowPeriod.start});
    const flowDraft=(name,ref,value,patch={})=>draft('flow:'+name,{sourceId:'flow-src',mappingId:flowTarget(ref).mappingId,metric:ref,periodStart:flowPeriod.start,periodEnd:flowPeriod.end,value,...patch});
    const flowView=new PgAggregateQueryReader(adapterPool,flowScope);
    const latestFlowChange=async(kind,id)=>(await db.query(`SELECT c.id,a.id AS authority_id FROM bsmoss_metering.input_change c JOIN bsmoss_integration.authority_change a
      ON (a.workspace_id,a.id)=(c.workspace_id,c.authority_change_id) WHERE a.workspace_id='w' AND a.entity_kind=$1 AND a.entity_id=$2 ORDER BY a.revision DESC LIMIT 1`,[kind,id])).rows[0];
    async function publishFlow(target=flowTarget()){
      const s=await readRefreshSnapshot(adapterPool,flowScope,target),finite={workspaceId:'w',series:[{sourceId:'flow-src',subjectKey:s.plan.subjectKey,metricKey:target.metric.code+'@1'}]},store=s.kind==='gauge'?new PgGaugeAggregateStore(adapterPool,finite):s.kind==='state'?new PgStateAggregateStore(adapterPool,finite):new PgAggregateStore(adapterPool,finite),head=await store.current(s.plan);
      return store.publish(s.plan,s.inputs,head?.revision??null,'flow-worker');
    }
    for(const id of (await pendingInputChanges(adapterPool,flowPorts,flowPolicy)).changeIds){const setup=await dispatchInputChange(adapterPool,flowPorts,id,flowPolicy);assert.equal(setup.manifest.jobs.length,0);}
    for(const [name,ref,value] of [['up',upMetric,{kind:'integer_delta',value:'100'}],['down',down,{kind:'integer_delta',value:'200'}],['ratio',flowRatio,{kind:'ratio_parts',numerator:'9',denominator:'10'}],
      ['attempt',flowAttempt,{kind:'integer_delta',value:'10'}],['state',stateMetric,{kind:'state_event',state:'running',validUntil:flowPeriod.end}],['gauge',gaugeMetric,{kind:'fixed_point',unscaled:'25000',scale:3}]])await flowWriter.append(flowDraft(name,ref,value));
    for(const ref of flowPolicy.outputs)await publishFlow(flowTarget(ref));
    await publishFlow(flowTarget(gaugeMetric,'flow-empty-map'));
    await t.test('trusted authority generations remain explicit in all persisted semantic manifests and replayable results',async()=>{
      for(const ref of [upMetric,stateMetric,gaugeMetric]){
        const snap=await readRefreshSnapshot(adapterPool,flowScope,flowTarget(ref));
        assert.ok(snap.plan.authorityRevisions.length>=2);
        const key=snap.plan.authorityRevisions.map(r=>r.kind+':'+r.id);
        assert.equal(new Set(key).size,key.length);
        const saved=(await db.query("SELECT r.input_manifest,r.result_payload FROM bsmoss_analysis.aggregate_revision r JOIN bsmoss_analysis.aggregate_series s ON (r.workspace_id,r.series_id)=(s.workspace_id,s.id) WHERE s.workspace_id='w' AND s.source_id='flow-src' AND s.subject_key=$1 AND s.metric_code=$2 AND s.grain='day' AND r.revision=s.current_revision",[snap.plan.subjectKey,ref.code])).rows[0];
        assert.deepEqual(saved.input_manifest.plan.authorityRevisions,snap.plan.authorityRevisions);
        assert.deepEqual(saved.result_payload.authorityRevisions,snap.plan.authorityRevisions);
        const calculate=snap.kind==='state'?aggregateStatePeriod:snap.kind==='gauge'?aggregateGaugePeriod:aggregateIntervals;
        assert.deepEqual(calculate(saved.input_manifest.plan,saved.input_manifest.inputs),saved.result_payload);
        const reversed={...snap.plan,authorityRevisions:[...snap.plan.authorityRevisions].reverse()};
        assert.equal(calculate(reversed,snap.inputs).inputFingerprint,calculate(snap.plan,snap.inputs).inputFingerprint);
        const changed={...snap.plan,authorityRevisions:snap.plan.authorityRevisions.map((r,i)=>i?r:{...r,revision:(BigInt(r.revision)+1n).toString()})};
        assert.notEqual(calculate(changed,snap.inputs).inputFingerprint,calculate(snap.plan,snap.inputs).inputFingerprint);
      }
    });
    await t.test('authority generation changes and policy reversal cannot revive an older complete publication',async()=>{
      const snap=await readRefreshSnapshot(adapterPool,flowScope,flowTarget()),base=aggregateIntervals(snap.plan,snap.inputs);
      await db.query(`INSERT INTO bsmoss_integration.source_completion_set(workspace_id,id,source_id,station_id,service_id,network_object_id,metric_code,metric_version,grain,period_start,period_end,revision,status,input_fingerprint,mapping_manifest_sha256,watermark,evidence_ref,evidence_sha256,recorded_by)
        VALUES ('w','flow-proof','flow-src','st','flow-svc','flow-cell',$1,1,'day',$2,$3,1,'confirmed',$4,$5,$3,'fixture://flow-proof',$6,'fixture-reviewer')`,[upMetric.code,flowPeriod.start,flowPeriod.end,base.inputFingerprint,mappingSetFingerprint(base.mappingWindows),'a'.repeat(64)]);
      await publishFlow();const before=await flowView.read(flowTarget());assert.equal(before.result.completeness,'complete');
      await db.query("UPDATE bsmoss_integration.source_capability SET validation_ref='fixture://flow-revised' WHERE id='flow-up-cap'");
      await db.query("UPDATE bsmoss_integration.source_capability SET validation_ref='fixture://flow-reviewed' WHERE id='flow-up-cap'");
      const stale=await flowView.read(flowTarget());assert.equal(stale.freshness,'stale');assert.notEqual(stale.currentInputFingerprint,before.currentInputFingerprint);
      const event=await latestFlowChange('source_capability','flow-up-cap'),result=await dispatchInputChange(adapterPool,flowPorts,event.id,flowPolicy);
      assert.equal(result.manifest.jobs.length,2);assert.ok((await flowView.read(flowTarget())).reasons.includes('authority_change_invalidated_revision'));
      assert.equal((await dispatchInputChange(adapterPool,flowPorts,event.id,flowPolicy)).status,'duplicate');await finishChangeJobs(result.manifest,flowPorts);
      const after=await flowView.read(flowTarget());assert.equal(after.freshness,'current');assert.equal(after.result.completeness,'preliminary');assert.ok(after.result.reasons.includes('source_confirmation_stale'));
      const history=await flowView.read({...flowTarget(),revision:before.revision});assert.equal(history.result.completeness,'complete');assert.equal(history.freshness,'stale');
    });
    await t.test('retired capability invalidates old head and dependent totals without fabricating results and reactivation recomputes',async()=>{
      await db.query("UPDATE bsmoss_integration.source_capability SET status='retired' WHERE id='flow-up-cap'");const event=await latestFlowChange('source_capability','flow-up-cap');
      const before=(await db.query("SELECT count(*)::int n FROM bsmoss_analysis.aggregate_revision WHERE result_payload->>'sourceId'='flow-src'")).rows[0].n;
      const result=await dispatchInputChange(adapterPool,flowPorts,event.id,flowPolicy);assert.equal(result.manifest.jobs.length,0);assert.equal(result.manifest.evidence.length,2);assert.ok(result.manifest.evidence.every(e=>e.outcome==='authority_unavailable'&&e.invalidated));
      assert.equal((await db.query("SELECT count(*)::int n FROM bsmoss_analysis.aggregate_revision WHERE result_payload->>'sourceId'='flow-src'")).rows[0].n,before);
      await assert.rejects(flowView.read(flowTarget()),/capability_unavailable/);await assert.rejects(flowView.read(flowTarget(depTarget.metric)),/capability_unavailable/);
      await db.query("UPDATE bsmoss_integration.source_capability SET status='active' WHERE id='flow-up-cap'");const restore=await dispatchInputChange(adapterPool,flowPorts,(await latestFlowChange('source_capability','flow-up-cap')).id,flowPolicy);await finishChangeJobs(restore.manifest,flowPorts);
      assert.equal((await flowView.read(flowTarget(depTarget.metric))).result.value.value,'300');assert.equal((await flowView.read(flowTarget())).freshness,'current');
    });
    await t.test('mapping and service validity changes cover old periods and distinguish unavailable from not applicable',async()=>{
      await db.query("UPDATE bsmoss_integration.source_mapping SET valid_to='2026-06-02T04:00:00Z' WHERE id='flow-cell-map'");
      let result=await dispatchInputChange(adapterPool,flowPorts,(await latestFlowChange('source_mapping','flow-cell-map')).id,flowPolicy);assert.equal(result.manifest.jobs.length,0);assert.equal(result.manifest.evidence.length,3);
      await db.query("UPDATE bsmoss_integration.source_mapping SET valid_to='2027-01-01Z' WHERE id='flow-cell-map'");result=await dispatchInputChange(adapterPool,flowPorts,(await latestFlowChange('source_mapping','flow-cell-map')).id,flowPolicy);await finishChangeJobs(result.manifest,flowPorts);
      await db.query('UPDATE bsmoss_resource.station_service SET valid_to=$1 WHERE id=$2',[flowPeriod.start,'flow-svc']);
      result=await dispatchInputChange(adapterPool,flowPorts,(await latestFlowChange('station_service','flow-svc')).id,flowPolicy);assert.equal(result.manifest.jobs.length,3);await finishChangeJobs(result.manifest,flowPorts);
      const inactive=await flowView.read(flowTarget());assert.equal(inactive.freshness,'current');assert.equal(inactive.result.completeness,'not_applicable');assert.equal(inactive.result.value,null);
      await db.query("UPDATE bsmoss_resource.station_service SET valid_to='2027-01-01Z' WHERE id='flow-svc'");result=await dispatchInputChange(adapterPool,flowPorts,(await latestFlowChange('station_service','flow-svc')).id,flowPolicy);await finishChangeJobs(result.manifest,flowPorts);assert.equal((await flowView.read(flowTarget())).result.value.value,'100');
    });
    await t.test('deleted gauge capability and empty mapping invalidate historical results and recreation preserves missing values',async()=>{
      await db.query("DELETE FROM bsmoss_integration.source_mapping WHERE id='flow-empty-map'");let result=await dispatchInputChange(adapterPool,flowPorts,(await latestFlowChange('source_mapping','flow-empty-map')).id,flowPolicy);assert.equal(result.manifest.evidence.length,1);assert.equal(result.manifest.jobs.length,0);assert.equal(result.manifest.evidence[0].outcome,'authority_unavailable');
      await db.query(`INSERT INTO bsmoss_integration.source_mapping(workspace_id,id,source_id,external_type,external_id,station_id,device_id,version,valid_from,valid_to)
        VALUES ('w','flow-empty-map','flow-src','device','flow-empty','st','flow-empty',1,'2026-01-01Z','2027-01-01Z')`);
      result=await dispatchInputChange(adapterPool,flowPorts,(await latestFlowChange('source_mapping','flow-empty-map')).id,flowPolicy);await finishChangeJobs(result.manifest,flowPorts);const missing=await flowView.read(flowTarget(gaugeMetric,'flow-empty-map'));assert.equal(missing.freshness,'current');assert.equal(missing.result.value,null);assert.equal(missing.result.completeness,'missing');
      await db.query("DELETE FROM bsmoss_integration.source_capability WHERE id='flow-gauge-cap'");result=await dispatchInputChange(adapterPool,flowPorts,(await latestFlowChange('source_capability','flow-gauge-cap')).id,flowPolicy);assert.equal(result.manifest.jobs.length,0);assert.equal(result.manifest.evidence.length,2);assert.ok(result.manifest.evidence.every(e=>e.invalidated));
      await db.query(`INSERT INTO bsmoss_integration.source_capability VALUES ('w','flow-gauge-cap','flow-src',$1,1,'day','active','fixture://flow-reviewed',$2,'2026-01-01Z','2027-01-01Z')`,[gaugeMetric.code,gaugePolicy]);
      result=await dispatchInputChange(adapterPool,flowPorts,(await latestFlowChange('source_capability','flow-gauge-cap')).id,flowPolicy);await finishChangeJobs(result.manifest,flowPorts);assert.equal((await flowView.read(flowTarget(gaugeMetric))).freshness,'current');
    });
    await t.test('a direct ratio does not acquire a false dependency invalidation from count capability changes',async()=>{
      const before=await flowView.read(flowTarget(flowRatio));await db.query("UPDATE bsmoss_integration.source_capability SET validation_ref='fixture://attempt-revised' WHERE id='flow-attempt-cap'");
      const result=await dispatchInputChange(adapterPool,flowPorts,(await latestFlowChange('source_capability','flow-attempt-cap')).id,flowPolicy);assert.equal(result.manifest.jobs.length,0);assert.equal(result.manifest.evidence.length,0);
      const after=await flowView.read(flowTarget(flowRatio));assert.equal(after.revision,before.revision);assert.equal(after.freshness,'current');
    });
    await t.test('authority invalidation jobs and receipt are atomic and supervised failures keep durable retry evidence',async()=>{
      await db.query("UPDATE bsmoss_integration.source_capability SET validation_ref='fixture://flow-atomic' WHERE id='flow-up-cap'");const event=await latestFlowChange('source_capability','flow-up-cap');
      const counts=async()=>(await db.query('SELECT (SELECT count(*) FROM bsmoss_analysis.aggregate_authority_invalidation) invalidations,(SELECT count(*) FROM bsmoss_analysis.refresh_job) jobs')).rows[0],before=await counts();
      const injected={async connect(){const c=await adapterPool.connect();return {query(sql,args){if(sql.includes('INSERT INTO bsmoss_analysis.input_refresh_receipt'))throw Error('fixture_authority_receipt_failure');return c.query(sql,args);},release(d){c.release(d);}};}};
      const failed=await superviseInputChange(injected,flowPorts,event.id,flowPolicy);assert.equal(failed.status,'failure_recorded');assert.equal(failed.attempt,1);assert.deepEqual(await counts(),before);assert.equal((await db.query('SELECT 1 FROM bsmoss_analysis.input_refresh_receipt WHERE change_id=$1',[event.id])).rowCount,0);
      assert.equal((await dispatchInputChange(adapterPool,flowPorts,event.id,flowPolicy)).status,'deferred');await db.query("UPDATE bsmoss_analysis.input_dispatch_event SET available_at=clock_timestamp()-interval '1 second' WHERE change_id=$1",[event.id]);
      const recovered=await dispatchInputChange(adapterPool,flowPorts,event.id,flowPolicy);assert.equal(recovered.status,'dispatched');await finishChangeJobs(recovered.manifest,flowPorts);assert.equal((await flowView.read(flowTarget())).freshness,'current');
      await assert.rejects(adapterPool.query('DELETE FROM bsmoss_analysis.aggregate_authority_invalidation'),e=>e.code==='42501');
    });
    await t.test('authority consumption scopes every affected object and dependency and cannot reuse another subscription receipt',async()=>{
      await db.query("UPDATE bsmoss_integration.source_mapping SET version=version+1 WHERE id='flow-cell-map'");const event=await latestFlowChange('source_mapping','flow-cell-map');
      for(const patch of [{sourceIds:[]},{stationIds:[]},{serviceIds:[]}]){const ports={...flowPorts,async readLocalGrant(){return {...await flowPorts.readLocalGrant(),scope:{...flowScope,...patch}};}};await assert.rejects(dispatchInputChange(adapterPool,ports,event.id,flowPolicy),/scope_denied/);}
      const restricted={...flowPorts,async readLocalGrant(){return {...await flowPorts.readLocalGrant(),scope:{...flowScope,metricKeys:flowScope.metricKeys.filter(k=>k!==down.code+'@1')}};}};
      await assert.rejects(dispatchInputChange(adapterPool,restricted,event.id,flowPolicy),/dependency_scope_denied/);
      const result=await dispatchInputChange(adapterPool,flowPorts,event.id,flowPolicy);await finishChangeJobs(result.manifest,flowPorts);
      const other=await dispatchInputChange(adapterPool,flowPorts,event.id,{outputs:[upMetric],grains:['day']});assert.notEqual(other.manifest.subscriptionSha256,result.manifest.subscriptionSha256);await finishChangeJobs(other.manifest,flowPorts);
    });
    await t.test('late authority commits remain discoverable after newer changes were consumed',async()=>{
      const a=new Client({connectionString:target.toString()});peers.push(a);await a.connect();await a.query('BEGIN');let earlier;
      try{await a.query("UPDATE bsmoss_integration.source_capability SET validation_ref='fixture://flow-held' WHERE id='flow-up-cap'");earlier=(await a.query(`SELECT c.id FROM bsmoss_metering.input_change c JOIN bsmoss_integration.authority_change h ON (h.workspace_id,h.id)=(c.workspace_id,c.authority_change_id) WHERE h.entity_id='flow-up-cap' ORDER BY h.revision DESC LIMIT 1`)).rows[0].id;
        assert.ok(!(await pendingInputChanges(adapterPool,flowPorts,flowPolicy)).changeIds.includes(earlier));await db.query("UPDATE bsmoss_integration.source_mapping SET version=version+1 WHERE id='flow-dev-map'");const newer=await dispatchInputChange(adapterPool,flowPorts,(await latestFlowChange('source_mapping','flow-dev-map')).id,flowPolicy);await finishChangeJobs(newer.manifest,flowPorts);
        await a.query('COMMIT');
      }catch(e){await a.query('ROLLBACK');throw e;}
      assert.ok((await pendingInputChanges(adapterPool,flowPorts,flowPolicy)).changeIds.includes(earlier));const result=await dispatchInputChange(adapterPool,flowPorts,earlier,flowPolicy);await finishChangeJobs(result.manifest,flowPorts);
    });
    await t.test('authority input capture failure rolls back the authority row and its audit journal together',async()=>{
      const before=(await authorityHistory('source_mapping','flow-cell-map')).length;
      await db.query(`CREATE FUNCTION bsmoss_metering.reject_authority_input_fixture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.authority_change_id IS NOT NULL THEN RAISE EXCEPTION 'fixture_authority_input_failure'; END IF; RETURN NEW; END $$;
        CREATE TRIGGER reject_authority_input_fixture BEFORE INSERT ON bsmoss_metering.input_change FOR EACH ROW EXECUTE FUNCTION bsmoss_metering.reject_authority_input_fixture()`);
      try{await assert.rejects(db.query("UPDATE bsmoss_integration.source_mapping SET version=version+1 WHERE id='flow-cell-map'"),/fixture_authority_input_failure/);assert.equal((await authorityHistory('source_mapping','flow-cell-map')).length,before);}
      finally{await db.query('DROP TRIGGER reject_authority_input_fixture ON bsmoss_metering.input_change; DROP FUNCTION bsmoss_metering.reject_authority_input_fixture()');}
    });
    await t.test('authority reconciliation cannot invalidate a concurrently newer head from an old repeatable snapshot',async()=>{
      await db.query("UPDATE bsmoss_integration.source_capability SET validation_ref='fixture://flow-head-race' WHERE id='flow-up-cap'");const event=await latestFlowChange('source_capability','flow-up-cap');
      const counts=async()=>(await db.query('SELECT (SELECT count(*) FROM bsmoss_analysis.aggregate_authority_invalidation) invalidations,(SELECT count(*) FROM bsmoss_analysis.refresh_job) jobs')).rows[0],before=await counts();let corrected=false;
      const observed={async connect(){const c=await adapterPool.connect();return {async query(sql,args){const result=await c.query(sql,args);
        if(!corrected&&sql.includes('FROM bsmoss_analysis.aggregate_series s JOIN jsonb_to_recordset')){corrected=true;await flowWriter.append(flowDraft('up',upMetric,{kind:'integer_delta',value:'101'},{revision:'2',previousRevision:'1',payloadSha256:'c'.repeat(64)}));await publishFlow();}
        return result;},release(d){c.release(d);}};}};
      await assert.rejects(dispatchInputChange(observed,flowPorts,event.id,flowPolicy),e=>e.code==='40001'||/aggregate_revision_conflict/.test(e.message));assert.equal(corrected,true);assert.deepEqual(await counts(),before);
      assert.equal((await db.query('SELECT 1 FROM bsmoss_analysis.input_refresh_receipt WHERE change_id=$1',[event.id])).rowCount,0);assert.equal((await flowView.read(flowTarget())).result.value.value,'101');
      const result=await dispatchInputChange(adapterPool,flowPorts,event.id,flowPolicy);await finishChangeJobs(result.manifest,flowPorts);assert.equal((await flowView.read(flowTarget(depTarget.metric))).result.value.value,'301');
    });
    await t.test('authority consumption rechecks permission and complete scope before retaining invalidations jobs or receipts',async()=>{
      await db.query("UPDATE bsmoss_integration.source_capability SET validation_ref='fixture://flow-revoke' WHERE id='flow-gauge-cap'");const event=await latestFlowChange('source_capability','flow-gauge-cap');
      const counts=async()=>(await db.query('SELECT (SELECT count(*) FROM bsmoss_analysis.aggregate_authority_invalidation) invalidations,(SELECT count(*) FROM bsmoss_analysis.refresh_job) jobs,(SELECT count(*) FROM bsmoss_analysis.input_dispatch_event) failures')).rows[0],before=await counts();
      for(const mode of ['permission','scope']){let reads=0;const ports={...flowPorts,async readLocalGrant(){const g=await flowPorts.readLocalGrant();reads++;return reads===1?g:mode==='permission'?{...g,permissions:[]}:{...g,scope:{...flowScope,deviceIds:['flow-dev']}};}};
        await assert.rejects(superviseInputChange(adapterPool,ports,event.id,flowPolicy),/permission_denied/);assert.deepEqual(await counts(),before);}
      assert.equal((await db.query('SELECT 1 FROM bsmoss_analysis.input_refresh_receipt WHERE change_id=$1',[event.id])).rowCount,0);const result=await dispatchInputChange(adapterPool,flowPorts,event.id,flowPolicy);await finishChangeJobs(result.manifest,flowPorts);
      const row=(await db.query('SELECT * FROM bsmoss_analysis.aggregate_authority_invalidation WHERE authority_change_id=$1 LIMIT 1',[event.authority_id])).rows[0];
      await assert.rejects(adapterPool.query("UPDATE bsmoss_analysis.aggregate_authority_invalidation SET reason='awaiting_recompute' WHERE authority_change_id=$1",[event.authority_id]),e=>e.code==='42501');
      for(const patch of [{workspace_id:'other'},{invalidated_revision:'999'},{reason:'normal'}]){const candidate={...row,subscription_sha256:'f'.repeat(64),...patch},keys=Object.keys(candidate);await assert.rejects(db.query('INSERT INTO bsmoss_analysis.aggregate_authority_invalidation('+keys.join(',')+') VALUES ('+keys.map((_,i)=>'$'+(i+1)).join(',')+')',Object.values(candidate)),e=>['23503','23514'].includes(e.code));}
    });
    await t.test('historical mapping capability and service identities cannot be reassigned even after delete and recreate',async()=>{
      await assert.rejects(db.query("UPDATE bsmoss_integration.source_mapping SET device_id='flow-empty' WHERE id='flow-dev-map'"),/authority_object_immutable/);
      await assert.rejects(db.query("UPDATE bsmoss_integration.source_capability SET metric_code=$1 WHERE id='flow-up-cap'",[down.code]),/authority_object_immutable/);
      await db.query("INSERT INTO bsmoss_resource.operator_entity VALUES ('w','flow-other-op','other','Other')");await assert.rejects(db.query("UPDATE bsmoss_resource.station_service SET operator_entity_id='flow-other-op' WHERE id='flow-svc'"),/authority_object_immutable/);
      await db.query("DELETE FROM bsmoss_integration.source_mapping WHERE id='authority:source_mapping'");
      await assert.rejects(db.query(`INSERT INTO bsmoss_integration.source_mapping(workspace_id,id,source_id,external_type,external_id,station_id,device_id,version,valid_from,valid_to)
        VALUES ('w','authority:source_mapping','authority-src','station','authority:source_mapping','st','flow-dev',1,'2026-01-01Z','2027-01-01Z')`),/authority_object_immutable/);
    });
    await registeredPeriodicCases(t,{db,adapterPool,ports:flowPorts,scope:flowScope,upMetric,gaugeMetric,period:flowPeriod,finishChangeJobs});
    await registeredInputCases(t,{db,adapterPool,ports:flowPorts,scope:flowScope,upMetric,period:flowPeriod,writer:flowWriter,draft:flowDraft,finishChangeJobs});
    await objectRollupCases(t,{db,adapterPool,ports:flowPorts});
    await reportSnapshotCases(t,{db,adapterPool,ports:flowPorts});
  } finally {
    if (adapterPool) await adapterPool.end();
    await Promise.all(peers.map(c=>c.end()));
    if (db) {try {await db.query("ROLLBACK");} catch {} await db.end();}
    if (created) await admin.query('DROP DATABASE "'+dbName+'" WITH (FORCE)');
    await admin.end();
  }
});
