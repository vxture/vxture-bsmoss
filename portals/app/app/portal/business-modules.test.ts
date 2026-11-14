import {test} from 'node:test';
import assert from 'node:assert/strict';
import {businessModuleIds,businessModuleForPath,moduleFunctions,moduleFunctionHref,activeModuleFunction} from './business-modules';
import {towerNavigation,towerEntry} from './tower-navigation';
import {portalNavigation} from './navigation';

test('seven primary modules own mounted routes and preserve unresolved work',()=>{
 assert.deepEqual(towerNavigation.filter(t=>t.domain==='business').map(t=>t.id).sort(),[...businessModuleIds].sort());
 const assignments={overview:['/','/board'],monitoring:['/monitoring'],services:['/usage-review','/review-history'],judgment:['/tower-service/network','/capacity','/efficiency','/analysis','/sharing'],resources:['/sites','/customer-use','/operator-usage'],reports:['/reports/new','/usage-reports','/reports/tasks']};
 for(const [owner,paths] of Object.entries(assignments))for(const path of paths)assert.equal(towerEntry(path)?.id,owner,path);
 for(const path of ['/operations/data-updates','/operations/aggregation','/capacity-forged','/unknown'])assert.equal(businessModuleForPath(path),undefined,path);
 // All formerly visible business pages are mounted or explicitly retained.
 for(const entry of portalNavigation(true))assert.ok(businessModuleForPath(new URL(entry.href,'http://local').pathname)||entry.id==='data-updates',entry.id);
 for(const [owner,items] of Object.entries(moduleFunctions))for(const item of items)assert.equal(businessModuleForPath(new URL(item.href,'http://local').pathname),owner);
});
test('secondary navigation identifies query-based views and nested original details',()=>{
 for(const [module,path,query,id] of [
  ['reports','/reports','view=tasks','tasks'],['reports','/reports/new','city=all','generation'],
  ['services','/usage-review','view=records','review-records'],['services','/usage-review/CASE-1','','usage-review'],
  ['resources','/sites/SITE-1','','sites'],['services','/tower-service/services','view=summary','services'],
  ['judgment','/tower-service/judgment','','energy'],['judgment','/tower-service/judgment','view=contribution','contribution'],
  ['judgment','/tower-service/network','layer=services&mode=difference','regions'],
 ] as const)assert.equal(activeModuleFunction(module,path,query),id);
});
test('original pages receive only compatible Header scope, not snapshots or local filters',()=>{
 const query='snapshotId=tower-demo-history-v1%3Amonth%3A2026-10-01&compareSnapshotId=B&operator=mobile&city=610100&county=610113&metric=energy&search=x&page=9&grain=year';
 for(const target of ['/capacity','/efficiency','/analysis','/sites','/customer-use','/usage-review?view=records','/reports/new']){
  const p=new URL(moduleFunctionHref(target,'/tower-service/judgment',query),'http://local').searchParams;
  assert.equal(p.get('city'),'610100');assert.equal(p.get('county'),'610113');
  for(const key of ['snapshotId','compareSnapshotId','operator','metric','search','page','grain'])assert.equal(p.has(key),false,key);
 }
 const duplicate=new URL(moduleFunctionHref('/capacity','/tower-service/judgment','city=610100&city=610200&county=all'),'http://local');assert.equal(duplicate.searchParams.has('city'),false);
});
test('snapshot analysis and report entry retain their actual context with compatible period projection',()=>{
 const query='snapshotId=tower-demo-history-v1%3Ayear%3A2026-01-01&compareSnapshotId=B&operator=mobile&city=610100&county=all&grain=year';
 const sharing=new URL(moduleFunctionHref('/tower-service/judgment?view=sharing','/tower-service/services',query),'http://local');
 assert.equal(sharing.searchParams.get('snapshotId'),'tower-demo-history-v1:month:2026-10-01');assert.equal(sharing.searchParams.get('grain'),'year');assert.equal(sharing.searchParams.get('operator'),'all');assert.equal(sharing.searchParams.has('compareSnapshotId'),false);
 const report=new URL(moduleFunctionHref('/reports?view=tower','/tower-service/services',query),'http://local');
 assert.equal(report.searchParams.get('snapshotId'),'tower-demo-history-v1:year:2026-01-01');assert.equal(report.searchParams.get('city'),'610100');assert.equal(report.searchParams.get('view'),'tower');
 assert.equal(new URL(moduleFunctionHref('/tower-service/services','/usage-review','period=day&city=610100&county=all'),'http://local').searchParams.has('snapshotId'),false);
 const regional=new URL(moduleFunctionHref('/tower-service/network','/tower-service/judgment',query+'&view=energy&metric=supplied-energy'),'http://local');
 assert.deepEqual(Object.fromEntries(regional.searchParams),{snapshotId:'tower-demo-history-v1:year:2026-01-01',compareSnapshotId:'B',operator:'mobile',city:'610100',county:'all'});
});
