import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {PgManagementReader} from '../../portals/app/app/domains/management/pg-reader.ts';
import {managementService} from '../../portals/app/app/domains/management/service.ts';
import {readPgGrant} from '../../portals/app/app/domains/access/pg-grants.ts';
export async function managementCases(t,{db,adapterPool}){
 const ws=randomUUID(),foreign=randomUUID();
 const scope={workspaceId:ws,sourceIds:['src'],stationIds:['A','B'],serviceIds:['sa'],deviceIds:['da'],metricKeys:['m'],allowSiteParameters:false};
 const uuid=n=>'99000000-0000-0000-0000-'+n.toString().padStart(12,'0');
 async function member(n,patch={},workspace=ws,withScope=true){const id=uuid(n);await db.query('INSERT INTO local_authz.member(id,workspace_id,sub,display_name,status) VALUES($1,$2,$3,$4,$5)',[id,workspace,'management-'+n,'Member '+n,n===4?'inactive':'active']);if(withScope)await db.query("INSERT INTO local_authz.data_scope(workspace_id,member_id,scope,expires_at) VALUES($1,$2,$3,$4)",[workspace,id,{...scope,workspaceId:workspace,...patch},n===4?'2020-01-01Z':'2099-01-01Z']);return id;}
 const reader=new PgManagementReader(adapterPool,scope);let role;
 await t.test('management permission seeds confer no roles or member assignments',async()=>{
  const result=await db.query("SELECT p.perm_code FROM local_authz.permission p WHERE p.perm_code IN ('admin.members.view','admin.jurisdiction.view') AND NOT EXISTS(SELECT 1 FROM local_authz.role_permission rp WHERE rp.permission_id=p.id)");assert.equal(result.rowCount,2);
 });
 await t.test('member SQL filters full five-dimensional scope before pagination and lookahead',async()=>{
  await member(1,{stationIds:['A','outside']});await member(2);await member(3,{serviceIds:['outside']});await member(4);await member(5,{},foreign);await member(6,{},ws,false);await member(7,{allowSiteParameters:true});await member(8,{extra:true});await member(9,{stationIds:'A'});
  const first=await reader.members({search:'',status:'all',limit:1});assert.deepEqual(first.items.map(r=>r.id),[uuid(2)]);assert.equal(first.next,uuid(2));assert.ok(!Object.hasOwn(first.items[0],'scope'));assert.ok(Number.isFinite(Date.parse(first.capturedAt)));
  const second=await reader.members({search:'',status:'all',limit:1,after:first.next});assert.deepEqual(second.items.map(r=>r.id),[uuid(4)]);assert.equal(second.next,null);assert.equal(second.items[0].status,'inactive');assert.ok(Date.parse(second.items[0].expiresAt)<Date.now());
  for(const n of [1,3,5,6,7,8,9])assert.equal(await reader.member(uuid(n)),null);
 });
 await t.test('member search, status and tenant isolation work in actual PostgreSQL',async()=>{
  assert.deepEqual((await reader.members({search:'Member 4',status:'inactive',limit:20})).items.map(r=>r.id),[uuid(4)]);
  assert.deepEqual((await reader.members({search:'',status:'active',limit:20})).items.map(r=>r.id),[uuid(2)]);
  assert.equal((await reader.members({search:'%',status:'all',limit:20})).items.length,0);
  for(const dim of ['sourceIds','deviceIds','metricKeys']){await member({sourceIds:10,deviceIds:11,metricKeys:12}[dim],{[dim]:['outside']});assert.equal(await reader.member(uuid({sourceIds:10,deviceIds:11,metricKeys:12}[dim])),null);}
 });
 await t.test('member detail returns only its configured roles and permissions',async()=>{
  role=(await db.query("INSERT INTO local_authz.role(role_code,name) VALUES($1,'Scoped reader') RETURNING id",['management-'+ws])).rows[0].id;
  await db.query('INSERT INTO local_authz.member_role(member_id,role_id) VALUES($1,$2)',[uuid(2),role]);
  await db.query("INSERT INTO local_authz.role_permission(role_id,permission_id) SELECT $1,id FROM local_authz.permission WHERE perm_code='metering.view'",[role]);
  await db.query("INSERT INTO local_authz.role(role_code,name) VALUES($1,'Unassigned secret role')",['unassigned-'+ws]);
  const record=await reader.member(uuid(2));assert.deepEqual(record.roles,[{code:'management-'+ws,name:'Scoped reader',permissions:['metering.view']}]);assert.deepEqual(record.scope,scope);
 });
 await t.test('station jurisdiction excludes foreign and unauthorized resources and counts only authorized relations',async()=>{
  for(const workspace of [ws,foreign]){
   for(const id of ['A','B','C'])await db.query("INSERT INTO bsmoss_resource.station VALUES($1,$2,$3,'tower','610000',$4)",[workspace,id,'Station '+id,id==='A'?'610100':'610200']);
   await db.query("INSERT INTO bsmoss_resource.operator_entity VALUES($1,'op','mobile','Operator')",[workspace]);
   for(const id of ['sa','hidden'])await db.query("INSERT INTO bsmoss_resource.station_service VALUES($1,$2,'A','op','2026-01-01Z','2027-01-01Z')",[workspace,id]);
   for(const id of ['da','hidden'])await db.query("INSERT INTO bsmoss_resource.device VALUES($1,$2,'A','meter','tower')",[workspace,id]);
  }
  const first=await reader.jurisdiction({search:'',city:'all',limit:1});assert.deepEqual(first.items,[{id:'A',name:'Station A',province:'610000',city:'610100',services:1,devices:1}]);assert.equal(first.next,'A');
  const next=await reader.jurisdiction({search:'',city:'all',limit:1,after:'A'});assert.deepEqual(next.items.map(r=>r.id),['B']);assert.equal(next.next,null);
  assert.deepEqual((await reader.jurisdiction({search:'',city:'610200',limit:20})).items.map(r=>r.id),['B']);assert.equal((await reader.jurisdiction({search:'%',city:'all',limit:20})).items.length,0);
 });
 await t.test('management reads operate as unprivileged runtime and reject writes',async()=>{
  const client=await adapterPool.connect();try{const role=await client.query('SELECT current_user');assert.equal(role.rows[0].current_user,'bsmoss_svc');await assert.rejects(client.query('UPDATE local_authz.member SET status=status WHERE workspace_id=$1',[ws]),e=>e.code==='42501');}finally{client.release();}
 });
 await t.test('SQL failure rolls back and releases the read snapshot without pretending the list is empty',async()=>{
  let failed=false,released=false,rolledBack=false;
  const pool={connect:async()=>{const c=await adapterPool.connect();return {query:async(sql,args)=>{if(sql.startsWith('SELECT m.id')&&!failed){failed=true;throw Error('fixture_sql_failure');}if(sql==='ROLLBACK')rolledBack=true;return c.query(sql,args);},release:()=>{released=true;c.release();}};}};
  await assert.rejects(new PgManagementReader(pool,scope).members({search:'',status:'all',limit:20}),/fixture_sql_failure/);assert.ok(rolledBack&&released);assert.ok((await reader.members({search:'',status:'all',limit:20})).items.length);
 });
 await t.test('real stored permission revoked after a read prevents returning its data',async()=>{
  await db.query("INSERT INTO local_authz.role_permission(role_id,permission_id) SELECT $1,id FROM local_authz.permission WHERE perm_code='admin.members.view'",[role]);
  const ports={now:Date.now,readVerifiedIdentity:async()=>({sub:'management-2',activeWorkspace:ws,accountStatus:'active',governanceRoles:[],expiresAt:Date.now()+60000}),readCoverage:async()=>({workspaceId:ws,product:'bsmoss',tier:'test',bundled:false,expiresAt:Date.now()+60000}),readLocalGrant:subject=>readPgGrant(adapterPool,subject.workspaceId,subject.sub),featuresFor:()=>['metering']};
  let reads=0;const service=managementService(ports,{create:authorized=>{const r=new PgManagementReader(adapterPool,authorized);return {workspaceId:ws,member:id=>r.member(id),jurisdiction:q=>r.jurisdiction(q),members:async q=>{const result=await r.members(q);reads++;await db.query("DELETE FROM local_authz.role_permission WHERE role_id=$1 AND permission_id=(SELECT id FROM local_authz.permission WHERE perm_code='admin.members.view')",[role]);return result;}};}});
  await assert.rejects(service.members(new URLSearchParams()),/permission_denied/);assert.equal(reads,1);
 });
}
