import type {ReviewCase} from './demo';
import {appendReview,commandText,foldReview,parseReviewCommand,readCaseLog,type CaseLog,type ReviewEvent} from './events';
export interface ReviewSession {id:string;dataset:string;createdAt:string}
export interface ReviewRecords {active:string;sessions:ReviewSession[];logs:CaseLog[]}
export interface ReviewStore {
 read(dataset:string,session?:string):Promise<ReviewRecords>;
 newSession(dataset:string):Promise<string>;
 append(dataset:string,session:string,current:ReviewCase,input:unknown):Promise<ReviewEvent>;
 close():void;
}
// Invoked within the store transaction, after a current catalogue lookup.
export function decideAppend(dataset:string,session:string,current:ReviewCase,input:unknown,log:unknown,receipt:ReviewEvent|undefined,recordedAt:string){
 const command=parseReviewCommand(input);
 if(current.source!==dataset||current.id!==command.caseId)throw Error('review_not_found');
 const events=log===undefined?[]:readCaseLog(log,dataset,session).events;
 if(receipt){if(commandText(receipt.command)!==commandText(command))throw Error('review_command_conflict');if(!events.some(e=>JSON.stringify(e)===JSON.stringify(receipt)))throw Error('review_storage_corrupt');return {event:receipt,replay:true};}
 return {event:appendReview(events,command,current,recordedAt),replay:false};
}
export async function submitReview(store:ReviewStore,dataset:string,session:string,catalog:readonly ReviewCase[],input:unknown){
 const command=parseReviewCommand(input),current=catalog.find(c=>c.id===command.caseId);
 if(!current||current.source!==dataset)throw Error('review_not_found');
 return store.append(dataset,session,current,command);
}
export function recordProjection(log:CaseLog|undefined,current?:ReviewCase){
 const p=foldReview(log?.events??[]);
 return {...p,changed:!!p.confirmation&&!!current&&(p.confirmation.digest!==current.evidenceDigest||p.confirmation.revision!==current.evidenceRevision||p.confirmation.source!==current.source)};
}
