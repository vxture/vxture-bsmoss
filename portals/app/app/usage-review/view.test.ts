import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readReviewView,reviewWorkspaceHref,reviewRecordsDestination,isReviewRecordsHref} from './view';
import {parseReviewQuery} from '../domains/usage-verification/query';
const session='8c3b637a-e53c-4038-80d7-f0aba583748d';
test('integrated records preserve scope, period, session and reason on one workspace route',()=>{
 const q=parseReviewQuery({city:'610100',county:'610113',period:'week',operator:'mobile',page:'2',search:'SX-DEMO',site:'SX-DEMO-001'});
 const href=reviewWorkspaceHref(q,'records',session,'network'),url=new URL(href,'http://localhost');
 assert.equal(url.pathname,'/usage-review');
 const parsed=readReviewView(Object.fromEntries(url.searchParams));
 assert.equal(parsed.mode,'records');assert.equal(parsed.session,session);assert.equal(parsed.reason,'network');
 assert.deepEqual(parseReviewQuery(parsed.input),q);assert.ok(isReviewRecordsHref(href));
 const cases=readReviewView(Object.fromEntries(new URL(reviewWorkspaceHref(q,'cases',session),'http://localhost').searchParams));
 assert.equal(cases.mode,'cases');assert.equal(cases.reason,'all');assert.deepEqual(parseReviewQuery(cases.input),q);
 assert.equal(readReviewView({view:'records'}).input.period,'month');
 assert.ok(isReviewRecordsHref('/review-history?period=day'));assert.ok(!isReviewRecordsHref('/usage-review?view=cases'));
});
test('workspace rejects invalid and duplicated view, session and record-only reason',()=>{
 for(const input of [{view:'unknown'},{view:['records','cases']},{recordSession:['x','y']},{recordSession:'forged'},{recordReason:'network'},{view:'cases',recordReason:'network'},{view:'records',recordReason:'forged'},{view:'records',recordReason:['network','other']}])assert.throws(()=>readReviewView(input),/invalid_/);
 assert.throws(()=>parseReviewQuery(readReviewView({view:'records',workspace:'forged'}).input));
});
test('legacy records redirect retains raw filters, duplicates and investigation without normalizing invalid input',()=>{
 const origin=JSON.stringify({v:1,href:'/sites?city=610100'});
 const href=reviewRecordsDestination({city:['610100','610300'],recordSession:session,recordReason:'network',investigation:origin});
 const p=new URL(href,'http://localhost').searchParams;
 assert.deepEqual(p.getAll('city'),['610100','610300']);assert.equal(p.get('recordSession'),session);assert.equal(p.get('recordReason'),'network');assert.equal(p.get('investigation'),origin);assert.equal(p.get('view'),'records');
 assert.throws(()=>parseReviewQuery(readReviewView({city:p.getAll('city'),view:'records'}).input));
 assert.deepEqual(new URL(reviewRecordsDestination({view:'cases'}),'http://localhost').searchParams.getAll('view'),['cases','records']);
});
