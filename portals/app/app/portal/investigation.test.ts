import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readInvestigation} from './investigation-server';
import {investigationValue,carryInvestigation,keepInvestigation,mapInvestigationHref} from './investigation-links';
import {relatedReviewHref,relatedDossierHref} from './investigation-targets';
import {reviewDemo,reviewDemoCases} from '../domains/usage-verification/demo';
import {parseReviewQuery} from '../domains/usage-verification/query';
import {reviewHref,reviewParams} from '../domains/usage-verification/links';
import {parseRecordReason} from '../domains/usage-verification/events';
import {changedRegionHref,isRegionPage} from './region-scope';
const session='8c3b637a-e53c-4038-80d7-f0aba583748d',c=reviewDemoCases()[0];
const read=(href:string)=>readInvestigation({investigation:JSON.stringify({v:1,href})}).journey!;
const unpack=(href:string)=>Object.fromEntries(new URL(href,'http://localhost').searchParams);
test('bounded root survives cross-domain roundtrips without growing a return stack',()=>{
 const origin=reviewHref(parseReviewQuery({period:'month',page:'2',operator:c.operator}),c.id)+'&recordSession='+session+'&event=5';
 const dossier=carryInvestigation('/sites/'+c.site.id,origin),j=readInvestigation(unpack(dossier)).journey!;
 assert.equal(j.href,origin);assert.equal(j.source,'uv');
 const map=carryInvestigation('/product-preview?hour=7',dossier,j),ret=readInvestigation(unpack(map)).journey!;
 assert.equal(ret.href,origin);assert.equal(ret.value,j.value);
 assert.equal(keepInvestigation('/usage-review?page=2#review-event-5',j).endsWith('#review-event-5'),true);
 assert.equal(JSON.parse(investigationValue(dossier)).href,'/sites/'+c.site.id+'?');
 assert.deepEqual(readInvestigation({city:'all'}),{input:{city:'all'},journey:undefined});
});
test('only known internal routes and strict scopes are accepted',()=>{
 for(const href of ['/sites?city=610100&view=relations&sort=load&direction=desc&page=3','/sites/SX-DEMO-001?tab=business&period=week&hour=7','/operator-usage?city=610100&period=week&operator=mobile','/analysis?city=610100&county=610113&site=SX-DEMO-001&range=month&month=2026-10&metric=bytes','/capacity?history=1&range=12m','/analysis/report?range=12m&snapshot='+('a'.repeat(64)),'/review-history?recordSession='+session,'/product-preview?city=610100&county=610113&site=SX-DEMO-001&hour=7&usage=week&compare=SX-DEMO-001,SX-DEMO-006'])assert.equal(read(href).href,href);
 for(const href of ['https://example.com','//example.com','/settings','/sites/unknown','/sites?city=610100&county=610300','/sites?page=2&page=3','/sites?__proto__=x','/sites?constructor=x','/sites?investigation=x','/sites#x','/sites?search=%00','/sites?workspaceId=forged','/usage-review?event=1','/usage-review?recordSession=forged','/usage-review/UV-'+('a'.repeat(24)),'/usage-review/history','/analysis?range=month&month=1900-01','/product-preview?usage=year','/product-preview?site=unknown','/product-preview?operator=forged','/product-preview?compare=SX-DEMO-001,SX-DEMO-001','/sites??x','/sites\\evil'])assert.throws(()=>read(href),/invalid_investigation/,href);
 for(const investigation of ['{','x'.repeat(8193),JSON.stringify({v:2,href:'/sites'}),JSON.stringify({v:1,href:'/sites',actor:'forged'}),['x','y']])assert.throws(()=>readInvestigation({investigation}),/invalid_investigation/);
});
test('map root preserves explicit selection and panels, without selecting a default station',()=>{
 const href=mapInvestigationHref({cityId:'610100',countyId:'all',operator:'mobile',hour:7,search:'SX-DEMO',selection:[108.8,34.1,109.1,34.5],topic:'capacity',topicOpen:true,usageOpen:false,reportOpen:true,reportPeriod:'week',compareIds:['SX-DEMO-001','SX-DEMO-006']});
 const q=unpack(href);assert.equal(q.hour,'7');assert.equal(q.site,undefined);assert.equal(q.topic,'capacity');assert.equal(q.report,'week');assert.ok(q.selection);assert.equal(read(href).source,'snapshot');
 const selected=mapInvestigationHref({cityId:'all',countyId:'all',operator:'all',hour:9,search:'',selectedId:'SX-DEMO-001'});assert.equal(unpack(selected).site,'SX-DEMO-001');
});
test('exact station review scope is not fuzzy search and never manufactures findings',()=>{
 const all=reviewDemo({period:'month'}),one=reviewDemo({period:'month',site:'SX-DEMO-001',hour:'7'});
 assert.ok(one.total>0);assert.ok(one.cases.every(v=>v.site.id==='SX-DEMO-001'));assert.ok(one.total<all.total);assert.equal(one.dataset,all.dataset);
 assert.equal(reviewDemo({site:'DEMO-00037',period:'month'}).total,0);
 assert.equal(reviewDemo({site:'SX-DEMO-001',city:'610300',period:'month'}).total,0);
 const q=one.inputQuery;assert.deepEqual(parseReviewQuery(Object.fromEntries(reviewParams(q))),q);
 assert.throws(()=>parseReviewQuery({site:'SX-DEMO-001/evil'}));
 const target=relatedReviewHref(q.scope,q.period,q.site,'bytes');assert.equal(unpack(target).site,q.site);assert.equal(unpack(target).hour,'7');
 const dossier=relatedDossierHref('SX-DEMO-001',q.scope,q.period);assert.equal(unpack(dossier).operator,q.scope.operator);assert.equal(unpack(dossier).period,'month');
});
test('intentional global region change clears investigation and original object context',()=>{
 for(const route of ['/sites/SX-DEMO-001','/usage-review/UV-abc','/usage-review/history','/analysis/report'])assert.equal(isRegionPage(route),true);
 for(const route of ['/settings','/settings/templates','/api/analysis'])assert.equal(isRegionPage(route),false);
 const next=changedRegionHref('/sites','investigation=x&site=SX-DEMO-001&page=2',{cityId:'610300',countyId:'all'});assert.equal(unpack(next).investigation,undefined);assert.equal(unpack(next).site,undefined);assert.equal(unpack(next).city,'610300');
});

test('record-history reason scope is validated and retained only on the record route',()=>{
 assert.equal(parseRecordReason(undefined),'all');assert.equal(parseRecordReason('network'),'network');for(const reason of ['forged',['network','other'],null])assert.throws(()=>parseRecordReason(reason));
 const href='/review-history?recordReason=network&recordSession='+session;assert.equal(read(href).href,href);assert.throws(()=>read('/usage-review?recordReason=network'));assert.throws(()=>read('/review-history?recordReason=forged'));
});
