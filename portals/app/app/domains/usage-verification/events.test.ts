import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reviewDemoCases,REVIEW_DATASET,reviewDemo} from './demo';
import {appendReview,foldReview,readCaseLog,evidenceRef,parseReviewCommand,type ReviewAction,type ReviewCommand,type ReviewEvent} from './events';
import {decideAppend,recordProjection} from './event-service';
import {reviewRows} from './list-rules';
const cases=reviewDemoCases(),item=cases[0],session='11111111-1111-4111-8111-111111111111',at='2026-11-05T12:00:00Z';
const cmd=(action:ReviewAction,revision:number,patch:Partial<ReviewCommand>={}):ReviewCommand=>({commandId:'command_'+revision,caseId:item.id,expectedRevision:revision,evidenceRef:evidenceRef(item),action,...(action==='confirm'?{reasonCode:'demand' as const}:{}),note:'Checked source windows',...patch});
const log=(events:ReviewEvent[])=>({schema:1 as const,dataset:REVIEW_DATASET,session,caseId:item.id,events});
test('confirm, return, reconfirm, approve and reopen append immutable evidence and retain reasons',()=>{
 const original=structuredClone(item),events:ReviewEvent[]=[];
 for(const action of ['confirm','return','confirm','approve','reopen','confirm'] as ReviewAction[])events.push(appendReview(events,cmd(action,events.length),item,at));
 assert.equal(foldReview(events).state,'awaiting_review');assert.equal(foldReview(events).revision,6);assert.equal(foldReview(events).reason,'demand');
 assert.deepEqual(events[0].evidence,original);assert.notEqual(events[0].evidence,item);assert.deepEqual(item,original);
 assert.deepEqual(readCaseLog(log(events),REVIEW_DATASET,session),log(events));
});
test('illegal transitions and stale expected revisions cannot overwrite a projection',()=>{
 assert.throws(()=>appendReview([],cmd('approve',0),item,at),/invalid_transition/);
 assert.throws(()=>appendReview([],cmd('reopen',0),item,at),/invalid_transition/);
 const e=appendReview([],cmd('confirm',0),item,at);
 assert.throws(()=>appendReview([e],cmd('confirm',1),item,at),/invalid_transition/);
 assert.throws(()=>appendReview([e],cmd('approve',0),item,at),/revision_conflict/);
 assert.equal(foldReview([e]).state,'awaiting_review');
});
test('an exact command replay returns the original receipt after later actions without rolling back state',()=>{
 const first=appendReview([],cmd('confirm',0),item,at),second=appendReview([first],cmd('approve',1),item,at),events=[first,second];
 const replay=decideAppend(REVIEW_DATASET,session,item,cmd('confirm',0),log(events),first,at);
 assert.equal(replay.replay,true);assert.deepEqual(replay.event,first);assert.equal(foldReview(events).state,'closed');
 assert.throws(()=>decideAppend(REVIEW_DATASET,session,item,cmd('confirm',0,{note:'Changed content'}),log(events),first,at),/command_conflict/);
 assert.throws(()=>decideAppend(REVIEW_DATASET,session,item,cmd('confirm',0),undefined,first,at),/storage_corrupt/);
});
test('a new evidence version blocks approval until reopen and current-evidence confirmation',()=>{
 const first=appendReview([],cmd('confirm',0),item,at),changed={...structuredClone(item),evidenceRevision:2,evidenceDigest:'a'.repeat(64)};
 assert.equal(recordProjection(log([first]),changed).changed,true);
 assert.throws(()=>appendReview([first],cmd('approve',1),changed,at),/evidence_changed/);
 assert.throws(()=>appendReview([first],cmd('approve',1,{evidenceRef:evidenceRef(changed)}),changed,at),/evidence_changed/);
 const reopened=appendReview([first],cmd('reopen',1),changed,at);
 const confirmation=appendReview([first,reopened],cmd('confirm',2,{evidenceRef:evidenceRef(changed)}),changed,at);
 const approved=appendReview([first,reopened,confirmation],cmd('approve',3,{evidenceRef:evidenceRef(changed)}),changed,at);
 assert.equal(foldReview([first,reopened,confirmation,approved]).state,'closed');assert.equal(first.evidence.evidenceDigest,item.evidenceDigest);assert.equal(approved.evidence.evidenceRevision,2);
});
test('strict commands reject client authority, malformed evidence, invalid reasons and unsafe revisions',()=>{
 for(const patch of [{actor:'owner'},{workspace:'any'},{targetStatus:'closed'},{recordedAt:at},{note:'  '},{note:'x'.repeat(2001)},{reasonCode:'unauthorized'},{expectedRevision:-1},{expectedRevision:Number.MAX_SAFE_INTEGER+1},{evidenceRef:{...evidenceRef(item),digest:'bad'}},{evidenceRef:{...evidenceRef(item),values:'fake'}}])assert.throws(()=>parseReviewCommand({...cmd('confirm',0),...patch}),/invalid_review/);
 assert.throws(()=>parseReviewCommand({...cmd('approve',1),reasonCode:'demand'}),/invalid_review/);
 assert.equal(parseReviewCommand(cmd('confirm',0,{note:'  Checked  '})).note,'Checked');
});
test('corrupt or cross-session records are rejected rather than rebuilt as empty successes',()=>{
 const event=appendReview([],cmd('confirm',0),item,at);
 const mutations:((v:ReturnType<typeof log>)=>void)[]=[v=>{v.schema=2 as 1;},v=>{v.events[0].revision=3;},v=>{v.events[0].state='closed';},v=>{v.events[0].actor='forged' as 'demo-visitor';},v=>{v.events[0].evidence.windows=[];},v=>{v.caseId=cases[1].id;},v=>{v.session='another';},v=>{v.dataset='other';}];
 for(const mutate of mutations){const v=structuredClone(log([event]));mutate(v);assert.throws(()=>readCaseLog(v,REVIEW_DATASET,session),/storage_corrupt/);}
});
test('local state filtering occurs before pagination and record lists contain actual actions only',()=>{
 const model=reviewDemo({period:'month'}),first=model.cases[0],event=appendReview([],cmd('confirm',0,{caseId:first.id,evidenceRef:evidenceRef(first)}),first,at),logs=[{schema:1 as const,dataset:REVIEW_DATASET,session,caseId:first.id,events:[event]}];
 const waiting=reviewRows(model.cases,{...model.inputQuery,status:'awaiting_review',page:999},logs);
 assert.equal(waiting.total,1);assert.equal(waiting.page,1);assert.equal(waiting.rows[0].id,first.id);
 assert.equal(reviewRows(model.cases,model.inputQuery,[],true).total,0);assert.equal(reviewRows(model.cases,model.inputQuery,logs,true,'demand').total,1);assert.equal(reviewRows(model.cases,model.inputQuery,logs,true,'holiday').total,0);
 assert.equal(reviewRows([],model.inputQuery,logs,true).total,0);
});
