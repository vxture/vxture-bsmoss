import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {PgSourceReader} from '../../portals/app/app/domains/management/source-reader.ts';
import {sourceManagement} from '../../portals/app/app/domains/management/source-service.ts';
import {decodeAuditCursor} from '../../portals/app/app/domains/management/source-rules.ts';
import {fingerprintOf} from '../../portals/app/app/domains/aggregation/intervals.ts';
import {sourceBinding} from '../../portals/app/app/domains/integration/rules.ts';
import {readPgGrant} from '../../portals/app/app/domains/access/pg-grants.ts';
export async function sourceManagementCases(t,{db,adapterPool}){
 const ws=randomUUID(),foreign=randomUUID(),scope={workspaceId:ws,sourceIds:['source'],stationIds:['A'],serviceIds:['sa'],deviceIds:['da'],metricKeys:['m@1'],allowSiteParameters:false};
 const reader=new PgSourceReader(adapterPool,scope),q={search:'',status:'all',limit:50};
 for(const w of [ws,foreign])await db.query("INSERT INTO bsmoss_integration.source VALUES($1,'source','Fixture source','fixture')",[w]);
 async function register(id,revision='1',patch={},workspace=ws,extra={}){
  const b=sourceBinding({id,revision,sourceId:'source',adapterVersion:'adapter-v1',transformVersion:'mapping-v1',coverageStart:'2026-01-01T00:00:00.000Z',scope:{...scope,workspaceId:workspace,...patch}});
  await db.query(`INSERT INTO bsmoss_integration.source_binding_revision(workspace_id,id,revision,source_id,status,binding,binding_sha256,review_ref,recorded_at)
   VALUES($1,$2,$3,'source',$4,$5,$6,'fixture-review',$7)`,[workspace,id,revision,extra.status??'active',b,extra.digest??fingerprintOf(b),extra.at??'2026-11-06T00:00:00.123456Z']);
 }
 await t.test('source and audit permission seeds grant no role assignments',async()=>{
  const r=await db.query("SELECT p.perm_code FROM local_authz.permission p WHERE p.perm_code IN ('admin.sources.view','admin.configuration_audit.view') AND NOT EXISTS(SELECT 1 FROM local_authz.role_permission rp WHERE rp.permission_id=p.id)");assert.equal(r.rowCount,2);
 });
 await t.test('current registration and historical audit filter each complete revision before LIMIT',async()=>{
  await register('A','1',{stationIds:['A','outside']});await register('A','2');await register('B');await register('B','2',{serviceIds:['outside']});await register('C','1',{},ws,{status:'paused'});await register('foreign','1',{},foreign);
  for(const [dim,id] of [['sourceIds','D'],['deviceIds','E'],['metricKeys','F']]){if(dim==='sourceIds'){await db.query("INSERT INTO bsmoss_integration.source VALUES($1,'other','Other','fixture')",[ws]);const b={id,revision:'1',sourceId:'other',adapterVersion:'v1',transformVersion:'t1',coverageStart:'2026-01-01T00:00:00.000Z',scope:{...scope,sourceIds:['other']}};await db.query("INSERT INTO bsmoss_integration.source_binding_revision(workspace_id,id,revision,source_id,status,binding,binding_sha256,review_ref) VALUES($1,$2,1,'other','active',$3,$4,'fixture')",[ws,id,b,fingerprintOf(b)]);}else await register(id,'1',{[dim]:['outside']});}
  await register('G','1',{allowSiteParameters:true});
  const first=await reader.list({...q,limit:1},false);assert.deepEqual(first.items.map(r=>[r.id,r.revision]),[['A','2']]);assert.equal(first.next,'A');
  const second=await reader.list({...q,limit:1,after:first.next},false);assert.deepEqual(second.items.map(r=>r.id),['C']);assert.equal(second.next,null);assert.equal(second.items[0].status,'paused');
  assert.equal(await reader.read('B'),null);assert.equal(await reader.read('A','1'),null);assert.equal(await reader.read('foreign'),null);assert.ok(await reader.read('B','1'));
  assert.deepEqual((await reader.list(q,true)).items.map(r=>[r.id,r.revision]),[['C','1'],['B','1'],['A','2']]);
 });
 await t.test('audit keyset retains microseconds and no records repeat or disappear across same-time revisions',async()=>{
  await register('H');await register('H','2');await register('I','1',{},ws,{at:'2026-11-06T00:00:00.123457Z'});
  let after;const items=[];do{const r=await reader.list({...q,limit:1,...(after?{after}:{})},true);items.push(...r.items);after=r.next;if(after)assert.match(decodeAuditCursor(after).at,/\.12345[67]Z$/);}while(after);
  assert.deepEqual(items.map(r=>[r.id,r.revision]),[['I','1'],['H','2'],['H','1'],['C','1'],['B','1'],['A','2']]);
 });
 await t.test('source search and paused status filter actual PostgreSQL and list omits full scope or review metadata',async()=>{
  const rows=await reader.list({...q,status:'paused'},false);assert.deepEqual(rows.items.map(r=>r.id),['C']);assert.ok(!Object.hasOwn(rows.items[0],'binding'));assert.ok(!Object.hasOwn(rows.items[0],'reviewRef'));
  assert.equal((await reader.list({...q,search:'%'},false)).items.length,0);assert.equal((await reader.list({...q,search:'adapter-v1'},false)).items.length,4);
  const record=await reader.read('C');assert.equal(record.reviewRef,'fixture-review');assert.equal(record.binding.transformVersion,'mapping-v1');assert.ok(record.databaseActor);assert.equal(record.digest,fingerprintOf(record.binding));
 });
 await t.test('source queries use read-only transactions and SQL failures rollback and release',async()=>{
  let began=false,rolled=false,released=false;
  const pool={connect:async()=>{const c=await adapterPool.connect();return {query:async(sql,args)=>{if(sql==='BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')began=true;if(sql.startsWith('SELECT b.*'))throw Error('fixture_source_sql_failure');if(sql==='ROLLBACK')rolled=true;return c.query(sql,args);},release:()=>{released=true;c.release();}};}};
  await assert.rejects(new PgSourceReader(pool,scope).list(q,false),/fixture_source_sql_failure/);assert.ok(began&&rolled&&released);
  const c=await adapterPool.connect();try{assert.equal((await c.query('SELECT current_user')).rows[0].current_user,'bsmoss_svc');await assert.rejects(c.query("INSERT INTO bsmoss_integration.source_binding_head VALUES($1,'forged',1)",[ws]),e=>e.code==='42501');}finally{c.release();}
 });
 await t.test('real permission revocation after source or audit read denies complete response including missing detail',async()=>{
  const member=randomUUID(),role=(await db.query("INSERT INTO local_authz.role(role_code,name) VALUES($1,'Source reader') RETURNING id",['sources-'+ws])).rows[0].id;
  await db.query("INSERT INTO local_authz.member(id,workspace_id,sub,status) VALUES($1,$2,'source-reader','active')",[member,ws]);await db.query("INSERT INTO local_authz.data_scope(workspace_id,member_id,scope,expires_at) VALUES($1,$2,$3,'2099-01-01Z')",[ws,member,scope]);await db.query('INSERT INTO local_authz.member_role(member_id,role_id) VALUES($1,$2)',[member,role]);
  const ports={now:Date.now,readVerifiedIdentity:async()=>({sub:'source-reader',activeWorkspace:ws,accountStatus:'active',governanceRoles:[],expiresAt:Date.now()+60000}),readCoverage:async()=>({workspaceId:ws,product:'bsmoss',tier:'test',bundled:false,expiresAt:Date.now()+60000}),readLocalGrant:s=>readPgGrant(adapterPool,s.workspaceId,s.sub),featuresFor:()=>['metering']};
  for(const audit of [false,true])for(const missing of [false,true]){
   const perm=audit?'admin.configuration_audit.view':'admin.sources.view';await db.query('INSERT INTO local_authz.role_permission(role_id,permission_id) SELECT $1,id FROM local_authz.permission WHERE perm_code=$2',[role,perm]);
   const revoke=()=>db.query('DELETE FROM local_authz.role_permission WHERE role_id=$1',[role]);
   const service=sourceManagement(ports,{create:s=>{const r=new PgSourceReader(adapterPool,s);return {workspaceId:ws,list:async(q,a)=>{const result=await r.list(q,a);await revoke();return result;},read:async(id,v)=>{const result=await r.read(id,v);await revoke();return result;}};}});
   await assert.rejects(missing?service.read('missing',new URLSearchParams(audit?'revision=1':''),audit):service.list(new URLSearchParams(),audit),/permission_denied/);
  }
 });
 await t.test('corrupt authorized registration and lookahead fail whole page rather than return invented configuration',async()=>{
  await register('J','1',{},ws,{digest:'0'.repeat(64)});
  await assert.rejects(reader.read('J'),/invalid_source_registration/);await assert.rejects(reader.list({...q,after:'H',limit:1},false),/invalid_source_registration/);
 });
}
