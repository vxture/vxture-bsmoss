import {test} from 'node:test';
import assert from 'node:assert/strict';
import {towerNavigation,towerAnalysisNavigation,towerDomain,towerEntry,towerHome,towerSettings,legacyNavigationTitle} from './tower-navigation';
import {managementSections,managementNavigation} from './management-navigation';
import {portalNavigation} from './navigation';
import {towerMigration} from './tower-migration';
import {towerNavigationHref} from '../tower-service/links';
import {changedRegionHref,isRegionPage} from './region-scope';

test('primary topology is exactly seven business and two management destinations; legacy URLs stay intact',()=>{
 assert.equal(towerNavigation.length,9);assert.equal(towerNavigation.filter(t=>t.domain==='business').length,7);
 assert.deepEqual(towerNavigation.filter(t=>t.domain==='management').map(t=>t.path),[ '/tower-service/sync',towerSettings]);
 assert.equal(towerEntry('/tower-service/evidence')?.id,'services');assert.equal(towerNavigation.some(t=>t.id==='evidence'),false);
 assert.deepEqual(towerAnalysisNavigation.map(t=>t.id),['monitoring','services','judgment']);assert.equal(towerEntry('/monitoring')?.id,'monitoring');
 assert.equal(towerHome,'/tower-service/overview');
 for(const entry of [...portalNavigation(true),...portalNavigation(true,'management')])assert.ok(!entry.href.startsWith('/tower-service/'));
 assert.equal(portalNavigation(true).find(t=>t.id==='home')!.href,'/');
});
test('pathname resolves both backend domains and station details without matching sibling prefixes',()=>{
 assert.equal(towerDomain('/tower-service/sync','data-updates'),'management');
 assert.equal(towerDomain('/tower-service/rules','analysis-rules'),'management');
 assert.equal(towerDomain('/tower-service/resources/A','sites'),'business');
 assert.equal(towerEntry('/tower-service/resources/A')!.id,'resources');
 assert.equal(towerEntry('/tower-service/resources-forged'),undefined);
 assert.equal(towerEntry('/product-preview')?.id,'network');
 assert.equal(towerEntry('/tower-service/network')?.id,'judgment');
 assert.equal(towerEntry('/operations/data-updates')?.id,'data-updates');
 assert.equal(towerEntry('/operations/aggregation')?.id,'data-updates');
 assert.equal(towerEntry('/operations/data-updates-forged'),undefined);
 assert.equal(towerDomain('/settings/operators','operator-identities'),'management');
});
test('all primary business links carry A/B, operator and scope while clearing local selectors',()=>{
 const query='snapshotId=A&compareSnapshotId=B&operator=other&city=610100&county=610116&layer=sharing&search=old&view=reports&page=4';
 for(const t of towerNavigation.filter(t=>t.domain==='business'&&t.id!=='network'&&t.id!=='monitoring'&&t.id!=='reports')){
  const p=new URL(towerNavigationHref(t.path,'/tower-service/network',query),'http://local').searchParams;
  assert.deepEqual(Object.fromEntries(p),{snapshotId:'A',compareSnapshotId:'B',operator:'other',city:'610100',county:'610116'});
 }
});
test('management and original URLs never receive incompatible snapshot queries; repeated values never select a grant',()=>{
 const query='snapshotId=A&compareSnapshotId=B&operator=other&city=610100&county=all';
 for(const t of ['/tower-service/sync?view=logs',towerSettings,'/reports','/settings/operators','/'])assert.equal(towerNavigationHref(t,'/tower-service/resources',query),t);
 const monitoring=new URL(towerNavigationHref('/monitoring','/tower-service/services',query),'http://local');assert.deepEqual(Object.fromEntries(monitoring.searchParams),{city:'610100',county:'all'});
 const old=new URL(towerNavigationHref(towerHome,'/customer-use',query),'http://local').searchParams;
 assert.equal(old.get('snapshotId'),null);assert.equal(old.get('city'),'610100');
 assert.equal(new URL(towerNavigationHref(towerHome,'/tower-service/network','snapshotId=A&snapshotId=B'),'http://local').searchParams.get('snapshotId'),null);
});
test('changing region from a frozen station returns to its list retaining only global snapshot context',()=>{
 assert.equal(isRegionPage('/tower-service/resources/A'),true);
 const url=new URL(changedRegionHref('/tower-service/resources/A','snapshotId=A&compareSnapshotId=B&operator=other&return=old&page=9&search=x',{cityId:'610200',countyId:'all'}),'http://local');
 assert.equal(url.pathname,'/tower-service/resources');
 assert.deepEqual(Object.fromEntries(url.searchParams),{snapshotId:'A',compareSnapshotId:'B',operator:'other',city:'610200',county:'all'});
});
test('backend sidebar has two primary destinations and one secondary collection preserving every old setting',()=>{
 for(const preview of [false,true]){
  const sections=managementSections(preview);assert.equal(sections.length,2);
  assert.deepEqual(sections[0].items.map(t=>t.href),['/tower-service/sync','/tower-service/rules']);
  assert.equal(sections[1].title,legacyNavigationTitle);
  assert.deepEqual(sections[1].items.map(t=>t.href),managementNavigation(preview).flatMap(g=>g.items.map(t=>t.href)));
 }
 assert.equal(towerMigration.sites.state,'partial');assert.equal(towerMigration.monitoring.state,'legacy');
 assert.equal(towerMigration['overview-display'].state,'pending');
});

test('panorama opens the existing full-canvas map with only compatible regional context',()=>{
 const map=towerNavigation.find(t=>t.id==='network')!;assert.equal(map.href,'/product-preview?hour=18');
 const p=new URL(towerNavigationHref(map.href,'/tower-service/judgment','snapshotId=A&compareSnapshotId=B&city=610100&county=610116&operator=other&view=occupancy&grain=month'),'http://local');
 assert.equal(p.pathname,'/product-preview');assert.deepEqual(Object.fromEntries(p.searchParams),{hour:'18',city:'610100',county:'610116',operator:'other'});
 assert.equal(new URL(towerNavigationHref(map.href,'/tower-service/network','city=610100&city=610200&operator=all'),'http://local').searchParams.has('city'),false);
});
