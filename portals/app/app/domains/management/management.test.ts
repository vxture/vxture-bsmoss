import {test} from 'node:test';
import assert from 'node:assert/strict';
import {managementService} from './service.ts';
import {directoryQuery,jurisdictionQuery,memberRecord,memberSummary} from './rules.ts';
import {managementHttpError} from './http.ts';
import type {AccessPorts,VerifiedIdentity} from '../access/resolve.ts';
import type {ManagementReader} from './pg-reader.ts';
const id='00000000-0000-0000-0000-000000000001';
function fixture(){
 let identity:VerifiedIdentity|null={sub:'u',activeWorkspace:'w',accountStatus:'active',governanceRoles:[],expiresAt:5000};
 const scope={workspaceId:'w',sourceIds:['s'],stationIds:['st'],serviceIds:['svc'],deviceIds:['d'],metricKeys:['m'],allowSiteParameters:false};
 const grant={workspaceId:'w',sub:'u',scope,active:true,permissions:['admin.members.view','admin.jurisdiction.view'],expiresAt:4000};
 let clock=1000,reads=0,creates=0,after=()=>{},missing=false;
 const ports:AccessPorts={now:()=>clock,readVerifiedIdentity:async()=>identity,readCoverage:async()=>({workspaceId:'w',product:'bsmoss',tier:'test',bundled:false,expiresAt:5000}),readLocalGrant:async()=>grant,featuresFor:()=>['metering']};
 const reader:ManagementReader={workspaceId:'w',members:async()=>{reads++;after();return {items:[],next:null,capturedAt:'2026-11-06T00:00:00Z'};},member:async()=>{reads++;after();return missing?null:memberRecord({id,sub:'u',display_name:'Member',status:'active',expires_at:'2027-01-01Z',scope,roles:[]},scope);},jurisdiction:async()=>{reads++;after();return {items:[],next:null,capturedAt:'2026-11-06T00:00:00Z'};}};
 const service=managementService(ports,{create:()=>{creates++;return reader;}});
 return {service,grant,scope,ports,reader,get reads(){return reads;},get creates(){return creates;},setIdentity:(v:VerifiedIdentity|null)=>{identity=v;},setAfter:(v:()=>void)=>{after=v;},expire:()=>clock=6000,missing:()=>missing=true};
}
test('management queries reject unknown, duplicate and unbounded values',()=>{
 for(const q of ['workspace=w','scope=x','status=all&status=active','limit=0','limit=51','limit=01','after=oops','search=*','search=%00'])assert.throws(()=>directoryQuery(new URLSearchParams(q)),/invalid_management_query/);
 for(const q of ['city=foo','city=610100&city=610200','after=*'])assert.throws(()=>jurisdictionQuery(new URLSearchParams(q)),/invalid_management_query/);
 assert.deepEqual(directoryQuery(new URLSearchParams()),{search:'',status:'all',limit:20});
 assert.equal(jurisdictionQuery(new URLSearchParams('city=610100&after=st')).after,'st');
});
test('management requires independent grants even for workspace owner',async()=>{
 for(const permission of ['metering.view','admin.jurisdiction.view']){const f=fixture();f.grant.permissions=[permission];f.setIdentity({sub:'u',activeWorkspace:'w',accountStatus:'active',governanceRoles:['workspace:owner'],expiresAt:5000});await assert.rejects(f.service.members(new URLSearchParams()),/permission_denied/);assert.equal(f.creates,0);}
 const f=fixture();f.grant.permissions=['admin.members.view'];await f.service.members(new URLSearchParams());await assert.rejects(f.service.jurisdiction(new URLSearchParams()),/permission_denied/);
});
test('identity and platform gates run before parsing, store creation or reads',async()=>{
 const f=fixture();f.setIdentity(null);await assert.rejects(f.service.members(new URLSearchParams('scope=x')),/identity_required/);await assert.rejects(f.service.member('invalid',new URLSearchParams('x=1')),/identity_required/);assert.equal(f.creates,0);
 const g=fixture();g.ports.featuresFor=()=>[];await assert.rejects(g.service.members(new URLSearchParams()),/feature_denied/);assert.equal(g.creates,0);
});
test('service machine never receives management access',async()=>{
 const f=fixture();f.setIdentity({kind:'service',sub:'s2s:bsmoss',callerProduct:'bsmoss',activeWorkspace:'w',expiresAt:5000,tokenId:'test'});await assert.rejects(f.service.members(new URLSearchParams()),/permission_denied/);assert.equal(f.reads,0);
});
test('empty page and missing detail still revalidate revocation before returning',async()=>{
 for(const operation of ['members','jurisdiction','member'] as const){const f=fixture();f.missing();f.setAfter(()=>{f.grant.permissions=[];});await assert.rejects(operation==='member'?f.service.member(id):f.service[operation](new URLSearchParams()),/permission_denied/);assert.equal(f.reads,1);}
 const f=fixture();f.missing();await assert.rejects(f.service.member(id),/member_unavailable/);
});
test('identity, scope and expiry changes deny the whole response',async()=>{
 for(const mutation of [(f:ReturnType<typeof fixture>)=>{f.scope.stationIds.push('new');},(f:ReturnType<typeof fixture>)=>f.expire(),(f:ReturnType<typeof fixture>)=>f.setIdentity({sub:'other',activeWorkspace:'w',accountStatus:'active',governanceRoles:[],expiresAt:5000})]){const f=fixture();f.setAfter(()=>mutation(f));await assert.rejects(f.service.members(new URLSearchParams()),/permission_denied|access_expired/);}
});
test('adapter failures propagate rather than returning empty data',async()=>{
 const f=fixture();f.reader.members=async()=>{throw Error('database_failure');};await assert.rejects(f.service.members(new URLSearchParams()),/database_failure/);
});
test('member projection validates the complete scope and never sends it in list summaries',()=>{
 const f=fixture(),row={id,sub:'u',status:'inactive',expires_at:'2020-01-01Z',scope:f.scope,roles:[{code:'r',name:'Role',permissions:['p','p']}]};
 const summary=memberSummary(memberRecord(row,f.scope));assert.ok(!Object.hasOwn(summary,'scope'));assert.equal(summary.counts.stations,1);assert.deepEqual(summary.roles[0].permissions,['p']);
 for(const dim of ['sourceIds','stationIds','serviceIds','deviceIds','metricKeys'] as const)assert.throws(()=>memberRecord({...row,scope:{...f.scope,[dim]:[...f.scope[dim],'outside']}},f.scope),/report_scope_denied/);
 assert.throws(()=>memberRecord({...row,scope:{...f.scope,allowSiteParameters:true}},f.scope),/report_scope_denied/);
});
test('management errors use safe bodies and private cache headers',async()=>{
 for(const [error,status] of [['invalid_management_query',400],['identity_required',401],['permission_denied',403],['member_unavailable',404],['SQL password=secret',503]] as const){const r=managementHttpError(Error(error));assert.equal(r.status,status);assert.equal(r.headers.get('cache-control'),'no-store');assert.ok(r.headers.get('vary')?.includes('Cookie'));assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.ok(!(await r.text()).includes('secret'));}
});
