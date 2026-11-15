import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {gzipSync} from 'node:zlib';
import pg from 'pg';
import {inspectBundle,seedDemo,rebuildDemo,resetDemo,recomputeDemoRollups} from './demo-data.mjs';
import {readPgDemoArtifact,readPgDemoPeriods} from '../../portals/app/app/domains/tower-service/demo-artifact.ts';
import {ownerConfiguration,run} from './demo-entry.mjs';

const digest=value=>createHash('sha256').update(value).digest('hex');
test('maintenance owner configuration preserves escaped credential values and fixes the DB destination',()=>{
 const config=ownerConfiguration(['POSTGRES_USER=owner','POSTGRES_DB=bsmoss','POSTGRES_PASSWORD=a=b','PGHOST=external']);
 assert.equal(config.host,'db');assert.equal(config.password,'a=b');
 assert.throws(()=>ownerConfiguration([]),/owner_configuration_missing/);
});
async function fixture(root){
 const path='tower-demo-history-v1-'+'a'.repeat(64)+'.json.gz';
 const daily=Buffer.alloc(24);[1,2,3,4,5,6].forEach((n,i)=>daily.writeUInt32LE(n,i*4));
 const source=gzipSync(JSON.stringify({version:'tower-demo-history-v1',days:3,relations:[{},{}],daily:daily.toString('base64')}));
 await writeFile(join(root,path),source);
 const rows=[{id:'test:day',city:'610100',county:'610113',operator:'mobile',quantities:[21],covered:[0],active:[0]}],rules=[];
 await writeFile(join(root,path+'.summaries-v3.gz'),gzipSync(JSON.stringify({sourceDigest:digest(source),rows,rules,digest:digest(JSON.stringify(rows)),rulesDigest:digest(JSON.stringify(rules))})));
 for(const name of ['published.json.gz','pages/test.json.gz','monitoring-v1/all-all.json.gz']){
  await mkdir(join(root,name,'..'),{recursive:true});await writeFile(join(root,name),gzipSync('{}'));
 }
 return inspectBundle(root);
}
await test('demo lifecycle on an isolated local PostgreSQL database', {timeout:180000},async t=>{
 const connectionString=process.env.TEST_DATABASE_ADMIN_URL;
 assert.ok(connectionString,'TEST_DATABASE_ADMIN_URL required');
 const url=new URL(connectionString);
 assert.ok(['localhost','127.0.0.1','[::1]'].includes(url.hostname),'local cluster required');
 const database='bsmoss_demo_test_'+randomUUID().replaceAll('-',''),admin=new pg.Client({connectionString});
 const root=await mkdtemp(join(tmpdir(),'bsmoss-demo-fixture-'));let db,created=false;
 try {
  await admin.connect();
  if(!(await admin.query("SELECT 1 FROM pg_roles WHERE rolname='bsmoss_svc'")).rowCount)
   await admin.query('CREATE ROLE bsmoss_svc NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE');
  await admin.query('CREATE DATABASE "'+database+'"');created=true;
  url.pathname='/'+database;db=new pg.Client({connectionString:url.href});await db.connect();
  await db.query(await readFile(new URL('../../deploy/database/ddl/90_demo.sql',import.meta.url),'utf8'));
  const bundle=await fixture(root);
  await t.test('seed is idempotent, unpublished data fails closed',async()=>{
   assert.equal(await seedDemo(db,bundle),'seeded');assert.equal(await seedDemo(db,bundle),'unchanged');
   await assert.rejects(readPgDemoArtifact(db,bundle.id,'pages/test.json.gz'),/demo_dataset_not_ready/);
   assert.equal((await db.query('SELECT sum(quantity)::text AS total FROM bsmoss_demo.daily_fact')).rows[0].total,'21');
  });
  await t.test('failed publication rolls back every artifact and summary',async()=>{
   await assert.rejects(rebuildDemo(db,{...bundle,rollups:[...bundle.rollups,...bundle.rollups]}));
   assert.equal((await db.query('SELECT count(*)::int AS n FROM bsmoss_demo.period_rollup')).rows[0].n,0);
   assert.equal((await db.query('SELECT status FROM bsmoss_demo.dataset')).rows[0].status,'seeded');
  });
  await t.test('equal-total fact corruption cannot pass verification',async()=>{
   await db.query('UPDATE bsmoss_demo.daily_fact SET quantity=CASE day WHEN 0 THEN 2 WHEN 1 THEN 1 ELSE quantity END WHERE dataset_id=$1 AND relation=0',[bundle.id]);
   await assert.rejects(rebuildDemo(db,bundle),/demo_fact_digest_mismatch/);
   await db.query('UPDATE bsmoss_demo.daily_fact SET quantity=CASE day WHEN 0 THEN 1 WHEN 1 THEN 2 ELSE quantity END WHERE dataset_id=$1 AND relation=0',[bundle.id]);
  });
  await t.test('publication is atomic, repeatable and checksum verified',async()=>{
   assert.equal(await rebuildDemo(db,bundle),'ready');assert.equal(await rebuildDemo(db,bundle),'unchanged');
   assert.deepEqual(await readPgDemoArtifact(db,bundle.id,'pages/test.json.gz'),bundle.files.find(f=>f.path==='pages/test.json.gz').bytes);
   assert.deepEqual(await readPgDemoPeriods(db,bundle.id,['test:day']),bundle.rollups);
   assert.deepEqual(await readPgDemoPeriods(db,bundle.id,['other:day']),[]);
   assert.equal((await run('verify',{connectionString:url.href},root)).status,'verified');
   await assert.rejects(readPgDemoArtifact(db,bundle.id,'missing'),{code:'ENOENT'});
   await assert.rejects(readPgDemoArtifact(db,'b'.repeat(64),'pages/test.json.gz'),/demo_dataset_not_ready/);
   await db.query('BEGIN');await db.query("UPDATE bsmoss_demo.artifact SET content='AAAA'");
   await assert.rejects(readPgDemoArtifact(db,bundle.id,'pages/test.json.gz'),/demo_artifact_corrupt/);await db.query('ROLLBACK');
  });
  await t.test('runtime can read but cannot seed, publish or reset',async()=>{
   await db.query('SET ROLE bsmoss_svc');
   assert.ok((await readPgDemoArtifact(db,bundle.id,'pages/test.json.gz')).length);
   await assert.rejects(db.query('DELETE FROM bsmoss_demo.dataset'),{code:'42501'});
   await assert.rejects(db.query("UPDATE bsmoss_demo.dataset SET status='ready'"),{code:'42501'});
   await db.query('RESET ROLE');
  });
  await t.test('reset is bounded to an explicitly named dataset',async()=>{
   await assert.rejects(resetDemo(db,''),/explicit_dataset_id_required/);
   assert.equal(await resetDemo(db,'b'.repeat(64)),0);assert.equal(await resetDemo(db,bundle.id),1);
   assert.equal((await db.query('SELECT count(*)::int AS n FROM bsmoss_demo.artifact')).rows[0].n,0);
  });
  if(process.env.BSMOSS_DEMO_TEST_BUNDLE)await t.test('full prepared dataset reconciles in PostgreSQL',async()=>{
   const full=await recomputeDemoRollups(await inspectBundle(process.env.BSMOSS_DEMO_TEST_BUNDLE)),start=performance.now();
   await seedDemo(db,full);const seeded=performance.now();await rebuildDemo(db,full);
   const file=full.files.find(f=>f.path.startsWith('pages/'));
   assert.deepEqual(await readPgDemoArtifact(db,full.id,file.path),file.bytes);
   const times=[];
   for(let i=0;i<25;i++){const at=performance.now();await readPgDemoArtifact(db,full.id,file.path);times.push(performance.now()-at);}
   times.sort((a,b)=>a-b);
   const summary=full.rollups[0],at=performance.now();
   const queried=await readPgDemoPeriods(db,full.id,[summary.id]);
   assert.ok(queried.some(row=>JSON.stringify(row.quantities)===JSON.stringify(summary.quantities)&&row.county===summary.county&&row.operator===summary.operator));
   console.log(JSON.stringify({pageReadP95Ms:Math.round(times[23]*100)/100,periodReadMs:Math.round((performance.now()-at)*100)/100}));
   console.log(JSON.stringify({facts:full.daily.length/4,periods:full.rollups.length,artifacts:full.files.length,seedMs:Math.round(seeded-start),publishMs:Math.round(performance.now()-seeded)}));
   await resetDemo(db,full.id);
  });
 }finally{
  await db?.end();if(created)await admin.query('DROP DATABASE "'+database+'" WITH (FORCE)');await admin.end();
  await rm(root,{recursive:true,force:true});
 }
});
