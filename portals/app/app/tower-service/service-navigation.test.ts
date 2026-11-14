import {test} from 'node:test';
import assert from 'node:assert/strict';
import {legacyEvidenceHref,serviceReturnHref,serviceViewHref,serviceViews} from './service-navigation';
import {previewSeed} from '../domains/tower-service/preview';
import {serviceFixture} from '../domains/tower-service/quantification.fixture';
import {evidenceFixture} from '../domains/tower-service/evidence.fixture';
import {evidenceModel} from './evidence/model';
import {servicesModel} from './services/model';

test('five service views share one route without carrying incompatible local filters',()=>{
 assert.deepEqual(serviceViews.map(v=>v.value),['operators','periods','comparison','summary','details']);
 const values={view:'comparison',snapshotId:'A',compareSnapshotId:'B',operator:'other',city:'610100',county:'all',metric:'energy',comparisonMode:'custom',page:4,search:'old'};
 const back='/tower-service/services?'+new URLSearchParams(Object.entries(values).map(([k,v])=>[k,String(v)]));
 const url=new URL(serviceViewHref(values,'details',back),'http://local');
 assert.equal(url.pathname,'/tower-service/services');
 for(const key of ['snapshotId','compareSnapshotId','operator','city','county'])assert.equal(url.searchParams.get(key),values[key as keyof typeof values]);
 assert.equal(url.searchParams.has('metric'),false);assert.equal(url.searchParams.has('comparisonMode'),false);
 assert.equal(url.searchParams.get('dimension'),'all');assert.equal(url.searchParams.get('returnTo'),back);
 const evidence={view:'details',snapshotId:'A',operator:'other',city:'610100',county:'all',method:'configuration',dimension:'configuration:mount',service:'mount',state:'pending'};
 const returned=serviceViewHref(evidence,'comparison',url.pathname+url.search,back);
 assert.equal(returned,back);
 const periods=new URL(serviceViewHref(evidence,'periods',url.pathname+url.search),'http://local');
 assert.equal(periods.searchParams.has('dimension'),false);assert.equal(periods.searchParams.has('method'),false);
 assert.equal(periods.searchParams.get('comparisonMode'),'previous');
});

test('legacy evidence links retain duplicate inputs for validation and select summary by default',()=>{
 const p=new URL(legacyEvidenceHref({operator:['mobile','other'],dimension:'Wh:0:customer_dedicated_meter',search:'a b'}),'http://local');
 assert.equal(p.pathname,'/tower-service/services');assert.equal(p.searchParams.get('view'),'summary');
 assert.deepEqual(p.searchParams.getAll('operator'),['mobile','other']);assert.equal(p.searchParams.get('search'),'a b');
});

test('return context only accepts local analysis pages and never external or nested navigation',()=>{
 for(const value of ['https://example.com','//example.com','/tower-service/services-evil?view=operators','/tower-service/services?view=details','/tower-service/services?view=operators&returnTo=x','/tower-service/services?operator=all&operator=mobile','/tower-service/services?view=operators#x',['/tower-service/services?view=operators']])assert.equal(serviceReturnHref(value),null);
 assert.equal(serviceReturnHref('/tower-service/services?view=comparison&snapshotId=A&metric=energy'),'/tower-service/services?view=comparison&snapshotId=A&metric=energy');
});

test('metric drill follows explicit basis links without borrowing other services or operators',()=>{
 const seed=previewSeed('service-evidence-bridge'),inventory=seed.snapshots[0].inventory,site=inventory.rows[0].id;
 const e=evidenceFixture(site),s=serviceFixture(site,inventory.rows[1].id);
 s.customers.push({id:'customer-a',name:'Acceptance mobile customer',operator:'mobile'});s.usage[0].customerId='customer-a';s.usage[0].basisId='basis-a';inventory.services=s;inventory.evidence=e.capture;inventory.tenancy=e.tenancy;
 const m=evidenceModel({view:'details',serviceMetric:'energy',dimension:'all'},seed.snapshots);
 assert.deepEqual(m.rows.map(r=>r.id),['basis-a']);assert.equal(m.displayCounts.items,1);
 assert.equal(evidenceModel({view:'details',serviceMetric:'energy',operator:'other'},seed.snapshots).rows.length,0);
 assert.equal(evidenceModel({view:'details',serviceMetric:'energy'},seed.snapshots,['other']).rows.length,0);
 assert.throws(()=>evidenceModel({view:'details',serviceMetric:'forged'},seed.snapshots),/invalid_evidence_metric/);
 const targets=servicesModel({},seed.snapshots).evidenceTargets;
 assert.equal(targets.mount.service,'all');assert.equal(targets.mount.dimension,'all');
 assert.equal(targets.energy.service,'power-qa');
});
