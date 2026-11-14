import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {createHash} from 'node:crypto';
import {defaultVerificationConfiguration,DEFAULT_VERIFICATION_PARAMETERS as D,verificationCommand,verificationParameters} from './parameters';
import {FileVerificationParameterStore} from './parameter-store';
import {verificationParameterService} from './parameter-service';
import {reviewDemo,reviewDemoCases,reviewDemoDetail,REVIEW_DATASET} from './demo';
import {reviewRows} from './list-rules';import {parseReviewQuery} from './query';import {reviewHref} from './links';
import {appendReview,foldReview,evidenceRef,readCaseLog,type ReviewCommand} from './events';
import {recordProjection} from './event-service';import type {AccessPorts} from '../access/resolve';
const at='2026-11-09T00:00:00Z',session='11111111-1111-4111-8111-111111111111';
const custom=(relativeBps=5000)=>({...defaultVerificationConfiguration(),revision:1,parameters:{...D,relativeBps}});
test('query keeps exact page capacity and finding type through deep links and rejects forged variants',()=>{
 const q=parseReviewQuery({period:'month',kind:'missing',pageSize:'10',status:'awaiting_review',page:'3'});
 assert.deepEqual(parseReviewQuery(Object.fromEntries(new URL(reviewHref(q),'http://localhost').searchParams)),q);
 for(const input of [{pageSize:'0'},{pageSize:'1000'},{pageSize:['10','20']},{kind:'fault'},{kind:['up','down']}])assert.throws(()=>parseReviewQuery(input));
 assert.equal(reviewDemo({period:'month',kind:'missing'}).total,30);
});
test('status summaries are the same cohort as sliders and filtering precedes pagination',()=>{
 const model=reviewDemo({period:'month',pageSize:'10'}),c=model.cases[0];
 const cmd:ReviewCommand={commandId:'p7_confirm',caseId:c.id,expectedRevision:0,evidenceRef:evidenceRef(c),action:'confirm',reasonCode:'demand',note:'checked'};
 const events=[appendReview([],cmd,c,at)],logs=[{schema:1 as const,dataset:REVIEW_DATASET,session,caseId:c.id,events}];
 const all=reviewRows(model.cases,model.inputQuery,logs),waiting=reviewRows(model.cases,{...model.inputQuery,status:'awaiting_review',page:99},logs);
 assert.equal(all.rows.length,10);assert.equal(all.states.all,180);assert.equal(all.states.open,179);assert.equal(all.states.awaiting_review,1);assert.equal(waiting.total,1);assert.equal(waiting.page,1);assert.deepEqual(waiting.states,all.states);
 const page2=reviewRows(model.cases,{...model.inputQuery,page:2},logs);assert.ok(page2.rows.every(c=>!all.rows.some(r=>r.id===c.id)));
 const up=reviewRows(model.cases,{...model.inputQuery,kind:'up'},logs);assert.ok(up.rows.every(c=>c.kind==='up'));assert.equal(up.total,30);
});
test('parameters retain exact counters and reject fractional, zero, huge or forged thresholds',()=>{
 assert.deepEqual(verificationParameters({...D,minimumBytes:'9007199254740993'}).minimumBytes,'9007199254740993');
 for(const patch of [{relativeBps:0},{relativeBps:10001},{relativeBps:1.5},{minimumBytes:1024},{minimumBytes:'0'},{minimumBytes:'01'},{minimumSms:'1.5'},{minimumVoiceSeconds:'-1'},{extra:1}])assert.throws(()=>verificationParameters({...D,...patch}));
 assert.throws(()=>verificationCommand({revision:0,parameters:D,workspaceId:'forged'}));
});
test('configured findings re-evaluate the same immutable measurements and keep legacy evidence readable',()=>{
 const original=reviewDemoCases(),configured=reviewDemoCases(custom()),byId=new Map(original.map(c=>[c.id,c]));assert.ok(configured.length<original.length);
 assert.ok(!configured.some(c=>c.kind==='up'||c.kind==='down'));assert.ok(configured.some(c=>c.kind==='zero_run'));
 for(const c of configured){const old=byId.get(c.id)!;assert.equal(c.current,old.current);assert.equal(c.windows[0].value,old.windows[0].value);assert.equal(c.id,old.id);assert.notEqual(c.evidenceDigest,old.evidenceDigest);assert.equal(c.evidenceRevision,2);assert.deepEqual(c.parameters,custom().parameters);}
 assert.deepEqual(reviewDemoCases(),original);
 const c=original.find(c=>c.kind==='up')!;assert.equal(reviewDemoDetail(c.id,{period:'month'},custom())?.retired,true);
});
test('policy change blocks direct approval while preserving original evidence and actual history',()=>{
 const old=reviewDemoCases().find(c=>c.kind==='missing')!,next=reviewDemoCases(custom()).find(c=>c.id===old.id)!;
 const cmd:ReviewCommand={commandId:'policy_confirm',caseId:old.id,expectedRevision:0,evidenceRef:evidenceRef(old),action:'confirm',reasonCode:'source_gap',note:'checked source'};
 const first=appendReview([],cmd,old,at),log={schema:1 as const,dataset:REVIEW_DATASET,session,caseId:old.id,events:[first]};
 assert.equal(recordProjection(log,next).changed,true);assert.throws(()=>appendReview([first],{...cmd,commandId:'approval',action:'approve',reasonCode:undefined,expectedRevision:1,evidenceRef:evidenceRef(next)},next,at),/evidence_changed/);
 const reopened=appendReview([first],{...cmd,commandId:'reopen',action:'reopen',reasonCode:undefined,expectedRevision:1},next,at);
 const confirm=appendReview([first,reopened],{...cmd,commandId:'new_confirm',expectedRevision:2,evidenceRef:evidenceRef(next)},next,at);
 const events=[first,reopened,confirm];assert.equal(foldReview(events).state,'awaiting_review');assert.deepEqual(events[0].evidence,old);assert.deepEqual(readCaseLog({...log,events},REVIEW_DATASET,session).events[2].evidence,next);
});
test('retired history is retained with scope, period, status and reason filters; no fake actions',()=>{
 const m=reviewDemo({period:'month'}),c=m.cases[0],cmd:ReviewCommand={commandId:'retired',caseId:c.id,expectedRevision:0,evidenceRef:evidenceRef(c),action:'confirm',reasonCode:'demand',note:'reviewed'};
 const logs=[{schema:1 as const,dataset:REVIEW_DATASET,session,caseId:c.id,events:[appendReview([],cmd,c,at)]}];
 const result=reviewRows([],m.inputQuery,logs,true);assert.equal(result.total,1);assert.equal(result.rows[0].retired,true);assert.equal(reviewRows([],m.inputQuery,logs).total,0);assert.equal(reviewRows([],m.inputQuery,[],true).total,0);
 assert.equal(reviewRows([],{...m.inputQuery,scope:{...m.inputQuery.scope,cityId:'610200'}},logs,true).total,c.site.cityId==='610200'?1:0);
 assert.equal(reviewRows([],m.inputQuery,logs,true,'holiday').total,0);
});
test('parameter snapshots isolate workspaces, reject stale/concurrent commands and preserve corrupt storage',async()=>{
 const root=await mkdtemp(join(tmpdir(),'p7-verification-'));try{const store=new FileVerificationParameterStore(root,'workspace'),other=new FileVerificationParameterStore(root,'other');
 assert.equal((await store.read()).revision,0);const first=await store.update(0,custom().parameters,'user',async()=>{});assert.equal(first.revision,1);assert.equal((await other.read()).revision,0);
 await assert.rejects(store.update(0,D,'user',async()=>{}),/revision_conflict/);await assert.rejects(store.update(1,D,'user',async()=>{throw Error('revoked');}),/revoked/);assert.equal((await store.read()).revision,1);
 const concurrent=await Promise.allSettled([store.update(1,D,'a',async()=>{}),store.update(1,D,'b',async()=>{})]);assert.equal(concurrent.filter(r=>r.status==='fulfilled').length,1);
 const path=join(root,createHash('sha256').update('workspace').digest('hex'),'parameters.json');await writeFile(path,'{bad');await assert.rejects(store.read());
 }finally{assert.ok(resolve(root).startsWith(resolve(tmpdir())+requireSeparator()));await rm(root,{recursive:true,force:true});}
});
function requireSeparator(){return process.platform==='win32'?'\\':'/';}
test('analysis-rule permissions and commit-time revocation protect configuration edits',async()=>{
 const root=await mkdtemp(join(tmpdir(),'p7-access-'));try{const scope={workspaceId:'w',sourceIds:[],stationIds:[],serviceIds:[],deviceIds:[],metricKeys:[],allowSiteParameters:false};let permissions=['metering.view'];
 const ports:AccessPorts={now:()=>1000,readVerifiedIdentity:async()=>({sub:'user',activeWorkspace:'w',accountStatus:'active',governanceRoles:['workspace:owner'],expiresAt:9000}),readCoverage:async()=>({workspaceId:'w',product:'bsmoss',tier:'test',bundled:false,expiresAt:8000}),readLocalGrant:async()=>({workspaceId:'w',sub:'user',active:true,permissions,scope,expiresAt:8000}),featuresFor:()=>['metering']};
 const service=verificationParameterService(ports,w=>new FileVerificationParameterStore(root,w)),command={revision:0,parameters:D};await service.read();assert.equal(await service.canEdit(),false);await assert.rejects(service.update(command),/permission_denied/);
 permissions=['admin.analysis_rules.view'];await service.read(true);await assert.rejects(service.update(command),/permission_denied/);permissions=['admin.analysis_rules.edit'];assert.equal((await service.update(command)).revision,1);
 let reads=0;ports.readLocalGrant=async()=>({workspaceId:'w',sub:'user',active:true,permissions:++reads===1?['admin.analysis_rules.edit']:[],scope,expiresAt:8000});await assert.rejects(service.update({...command,revision:1}),/permission_denied/);assert.equal((await new FileVerificationParameterStore(root,'w').read()).revision,1);
 }finally{assert.ok(resolve(root).startsWith(resolve(tmpdir())+requireSeparator()));await rm(root,{recursive:true,force:true});}
});
