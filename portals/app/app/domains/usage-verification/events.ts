import type {ReviewCase} from './demo';
import {deriveUsageFindings} from './rules';
export const REVIEW_REASONS=['demand','holiday','network','planned_stop','source_gap','mapping','history','false_positive','other'] as const;
export function parseRecordReason(value:unknown):string {if(value===undefined)return 'all';if(typeof value!=='string'||!['all',...REVIEW_REASONS].includes(value))throw Error('invalid_review_reason');return value;}
export type Reason=typeof REVIEW_REASONS[number];
export type ReviewState='open'|'awaiting_review'|'closed';
export type ReviewAction='confirm'|'approve'|'return'|'reopen';
export interface EvidenceRef {revision:number;digest:string;source:string}
export interface ReviewCommand {commandId:string;caseId:string;expectedRevision:number;evidenceRef:EvidenceRef;action:ReviewAction;reasonCode?:Reason;note:string}
export interface ReviewEvent {revision:number;command:ReviewCommand;actor:'demo-visitor';recordedAt:string;evidence:ReviewCase;state:ReviewState}
export interface CaseLog {schema:1;dataset:string;session:string;caseId:string;events:ReviewEvent[]}
export const evidenceRef=(c:ReviewCase):EvidenceRef=>({revision:c.evidenceRevision,digest:c.evidenceDigest,source:c.source});
const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const keys=(v:Record<string,unknown>,allowed:string[],required=allowed)=>{if(Object.keys(v).some(k=>!allowed.includes(k))||required.some(k=>!Object.hasOwn(v,k)))throw Error('invalid_review_command');};
export function parseReviewCommand(value:unknown):ReviewCommand {
 if(!plain(value))throw Error('invalid_review_command');
 keys(value,['commandId','caseId','expectedRevision','evidenceRef','action','reasonCode','note'],['commandId','caseId','expectedRevision','evidenceRef','action','note']);
 if(typeof value.commandId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(value.commandId)||typeof value.caseId!=='string'||!/^UV-[a-f0-9]{24}$/.test(value.caseId)||!Number.isSafeInteger(value.expectedRevision)||Number(value.expectedRevision)<0||!['confirm','approve','return','reopen'].includes(String(value.action)))throw Error('invalid_review_command');
 if(!plain(value.evidenceRef))throw Error('invalid_review_command');keys(value.evidenceRef,['revision','digest','source']);
 const ref=value.evidenceRef;
 if(!Number.isSafeInteger(ref.revision)||Number(ref.revision)<1||typeof ref.digest!=='string'||!/^[a-f0-9]{64}$/.test(ref.digest)||typeof ref.source!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(ref.source))throw Error('invalid_review_command');
 if(typeof value.note!=='string'||value.note.trim().length<1||value.note.trim().length>2000)throw Error('invalid_review_note');
 if(value.action==='confirm'?!REVIEW_REASONS.includes(value.reasonCode as Reason):value.reasonCode!==undefined)throw Error('invalid_review_reason');
 return {commandId:value.commandId,caseId:value.caseId,expectedRevision:Number(value.expectedRevision),evidenceRef:{revision:Number(ref.revision),digest:ref.digest,source:ref.source},action:value.action as ReviewAction,...(value.action==='confirm'?{reasonCode:value.reasonCode as Reason}:{}),note:value.note.trim()};
}
export const commandText=(c:ReviewCommand)=>JSON.stringify(parseReviewCommand(c));
export const sameEvidence=(a:EvidenceRef,b:EvidenceRef)=>a.source===b.source&&a.revision===b.revision&&a.digest===b.digest;
function validateEvidence(c:ReviewCase){
 if(!c||!['bytes','voiceSeconds','sms'].includes(c.metric)||!c.site||typeof c.site.id!=='string'||typeof c.site.name!=='string'||!Array.isArray(c.windows)||!c.windows.length||c.windows.length>24||!Number.isSafeInteger(c.evidenceRevision)||c.evidenceRevision<1||!/^UV-[a-f0-9]{24}$/.test(c.id)||!/^[a-f0-9]{64}$/.test(c.evidenceDigest))throw Error('review_storage_corrupt');
 const derived=deriveUsageFindings(c.windows,c.metric,c.parameters);
 if(derived.length!==1||JSON.stringify(derived[0])!==JSON.stringify({kind:c.kind,category:c.category,start:c.start,end:c.end,windows:c.windows,current:c.current,referenceNumerator:c.referenceNumerator,deltaNumerator:c.deltaNumerator}))throw Error('review_storage_corrupt');
}
function nextState(state:ReviewState,action:ReviewAction):ReviewState {
 if(action==='confirm'&&state==='open')return 'awaiting_review';
 if(action==='approve'&&state==='awaiting_review')return 'closed';
 if(action==='return'&&state==='awaiting_review'||action==='reopen'&&state!=='open')return 'open';
 throw Error('review_invalid_transition');
}
export function foldReview(events:readonly ReviewEvent[]) {
 let state:ReviewState='open',reason:Reason|undefined,confirmation:EvidenceRef|undefined;
 const commands=new Set<string>();
 for(const [i,e] of events.entries()){
  const c=parseReviewCommand(e.command);
  validateEvidence(e.evidence);
  if(e.revision!==i+1||c.expectedRevision!==i||commands.has(c.commandId)||e.actor!=='demo-visitor'||typeof e.recordedAt!=='string'||!Number.isFinite(Date.parse(e.recordedAt))||!e.evidence||e.evidence.id!==c.caseId||!sameEvidence(c.evidenceRef,evidenceRef(e.evidence)))throw Error('review_storage_corrupt');
  if(c.action==='approve'&&(!confirmation||!sameEvidence(confirmation,c.evidenceRef)))throw Error('review_storage_corrupt');
  state=nextState(state,c.action);if(state!==e.state)throw Error('review_storage_corrupt');
  if(c.action==='confirm'){reason=c.reasonCode;confirmation=c.evidenceRef;}
  commands.add(c.commandId);
 }
 return {state,revision:events.length,reason,confirmation,last:events.at(-1)};
}
export function appendReview(events:readonly ReviewEvent[],input:unknown,current:ReviewCase,recordedAt:string):ReviewEvent {
 validateEvidence(current);
 const command=parseReviewCommand(input),p=foldReview(events);
 if(command.caseId!==current.id||events.some(e=>e.command.caseId!==current.id))throw Error('review_not_found');
 if(p.revision!==command.expectedRevision)throw Error('review_revision_conflict');
 const state=nextState(p.state,command.action),ref=evidenceRef(current);
 if((command.action==='confirm'||command.action==='approve')&&!sameEvidence(command.evidenceRef,ref))throw Error('review_evidence_changed');
 if(command.action==='approve'&&(!p.confirmation||!sameEvidence(p.confirmation,ref)))throw Error('review_evidence_changed');
 // A return/reopen may explicitly refer to the old saved evidence. New reasons
 // always bind to the current adapter snapshot, never client-supplied counters.
 const evidence=sameEvidence(command.evidenceRef,ref)?current:events.find(e=>sameEvidence(command.evidenceRef,evidenceRef(e.evidence)))?.evidence;
 if(!evidence)throw Error('review_evidence_changed');
 if(!Number.isFinite(Date.parse(recordedAt)))throw Error('invalid_review_time');
 return {revision:p.revision+1,command,actor:'demo-visitor',recordedAt,evidence:structuredClone(evidence),state};
}
export function readCaseLog(value:unknown,dataset:string,session:string):CaseLog {
 try{
  if(!plain(value)||value.schema!==1||value.dataset!==dataset||value.session!==session||typeof value.caseId!=='string'||!/^UV-[a-f0-9]{24}$/.test(value.caseId)||!Array.isArray(value.events)||value.events.length<1)throw Error();
  foldReview(value.events as ReviewEvent[]);
  for(const e of value.events as ReviewEvent[])if(e.command.caseId!==value.caseId||e.evidence.source!==dataset)throw Error();
  return value as unknown as CaseLog;
 }catch{throw Error('review_storage_corrupt');}
}
