import {parseRecordReason} from '../domains/usage-verification/events';
import {validSession} from '../domains/usage-verification/indexeddb-store';
import {reviewParams} from '../domains/usage-verification/links';
import type {ReviewQuery} from '../domains/usage-verification/query';
export type ReviewView = 'cases' | 'records';
export function readReviewView(input:Record<string,string|string[]|undefined>){
 const {view='cases',recordSession,recordReason,...filter}=input;
 if(view!=='cases'&&view!=='records'||recordReason!==undefined&&view!=='records')throw Error('invalid_review_query');
 if(recordSession!==undefined&&(typeof recordSession!=='string'||!validSession(recordSession)))throw Error('invalid_review_query');
 return {mode:view as ReviewView,session:recordSession as string|undefined,reason:parseRecordReason(recordReason),input:view==='records'?{period:'month',...filter}:filter};
}
export function reviewWorkspaceHref(query:ReviewQuery,mode:ReviewView='cases',session?:string,reason='all'){
 const p=reviewParams(query);
 if(session)p.set('recordSession',session);
 if(mode==='records'){p.set('view','records');p.set('recordReason',reason);}
 return '/usage-review?'+p;
}
export function reviewRecordsDestination(input:Record<string,string|string[]|undefined>){
 const p=new URLSearchParams();
 for(const [key,raw] of Object.entries(input))for(const value of Array.isArray(raw)?raw:raw===undefined?[]:[raw])p.append(key,value);
 // Preserve duplicate input for canonical validation, including conflicting views.
 p.append('view','records');
 return '/usage-review?'+p;
}
export function isReviewRecordsHref(href:string){
 const [path,query]=href.split('?');
 return path==='/review-history'||path==='/usage-review'&&new URLSearchParams(query).get('view')==='records';
}
