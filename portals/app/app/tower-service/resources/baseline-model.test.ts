import {test} from 'node:test';
import assert from 'node:assert/strict';
import {baselineModel} from './baseline-model';
import {previewSeed,previewAccess} from '../../domains/tower-service/preview';
import {visibleRows,inventoryChecks} from '../../domains/tower-service/foundation';
import {scopeTenancy} from '../../domains/tower-service/tenancy';

test('city and county chart levels reconcile equipment breakdowns and keep the same frozen scope',()=>{
 const versions=previewSeed('regional-bars').snapshots;
 for(const regionLevel of ['city','county'])for(const resourceView of ['compare','tower','operators'])for(const operator of ['all','mobile','other']){
  const model=baselineModel({view:'regions',city:regionLevel==='county'?'610100':'all',resourceView,operator},versions);
  assert.equal(model.regions.reduce((sum,r)=>sum+r.sites,0),model.resourceTotals.sites);
  assert.equal(model.regions.reduce((sum,r)=>sum+r.facilities,0),model.resourceTotals.facilities);
  assert.equal(model.regions.reduce((sum,r)=>sum+r.customerDevices,0),model.resourceTotals.customerDevices);
  for(const r of model.regions){
   assert.equal(Object.values(r.categories).reduce((a,b)=>a+b,0),r.facilities);
   assert.equal(Object.values(r.operators).reduce((a,b)=>a+b,0),r.customerDevices);
   if(operator!=='all')assert.deepEqual(Object.keys(r.operators),[operator]);
   if(regionLevel==='county')assert.notEqual(r.county,'all');
  }
 }
 const county=baselineModel({view:'regions',regionRanking:'top'},versions);
 assert.ok(county.regions.length>10);assert.equal(county.resourceTotals.sites,1080);
 const city=baselineModel({view:'regions',city:'610100'},versions);
 assert.equal(city.filters.regionLevel,'county');assert.equal(city.regions.reduce((sum,r)=>sum+r.customerDevices,0),864);
 const selected=baselineModel({view:'regions',city:'610100',county:'610116'},versions);
 assert.equal(selected.regions.length,1);assert.equal(selected.regions[0].sites,62);
 for(const query of [{regionLevel:'district'},{resourceView:'map'},{regionRanking:'first'},{regionRanking:['top','bottom']},{regionLevel:['city','county']},{resourceView:['tower','operators']}])assert.throws(()=>baselineModel(query,versions),/invalid_/);
});

test('county rankings limit only the chart and follow current ownership totals and parent scope',()=>{
 const versions=previewSeed('county-rankings').snapshots;
 for(const resourceView of ['tower','operators']){
  const top=baselineModel({view:'regions',regionRanking:'top',resourceView},versions),bottom=baselineModel({view:'regions',regionRanking:'bottom',resourceView},versions);
  assert.equal(top.regions.length,98);assert.equal(top.chartRegions.length,10);assert.equal(bottom.chartRegions.length,10);
  assert.equal(top.resourceTotals.sites,1080);assert.deepEqual(top.resourceTotals,bottom.resourceTotals);
  const metric=(r:typeof top.regions[number])=>resourceView==='tower'?r.facilities:r.customerDevices;
  assert.ok(top.chartRegions.every((r,i)=>!i||metric(r)<=metric(top.chartRegions[i-1])));
  assert.ok(bottom.chartRegions.every((r,i)=>!i||metric(r)>=metric(bottom.chartRegions[i-1])));
  assert.ok(top.chartRegions.every(r=>!bottom.chartRegions.some(b=>b.code===r.code)));
  for(const ranking of ['top','bottom']){
   const city=baselineModel({view:'regions',city:'610300',regionRanking:ranking,resourceView},versions);
   assert.equal(city.regions.length,12);assert.equal(city.chartRegions.length,10);assert.ok(city.chartRegions.every(r=>r.city==='610300'));
  }
 }
 const legacy=baselineModel({view:'regions',regionLevel:'county',resourceView:'compare'},versions);
 assert.equal(legacy.filters.resourceView,'tower');assert.equal(legacy.filters.regionLevel,'city');assert.equal(legacy.chartRegions.length,10);
 assert.equal(baselineModel({view:'regions',city:'610200',regionRanking:'top'},versions).chartRegions.length,4);
});

test('same-version province cities and facility subtypes reconcile; local search and filters never change totals',()=>{const versions=previewSeed('test').snapshots,all=baselineModel({},versions);assert.equal(all.data.rollup.totals.sites,1080);assert.equal(all.data.rollup.totals.infrastructure,5400);assert.equal(all.regions.reduce((n,r)=>n+r.sites,0),1080);assert.equal(all.regions.reduce((n,r)=>n+r.facilities,0),5400);assert.ok(all.facilityCounts.every(c=>c.count===1080));for(const key of ['siteType','scene','facility']){const value=key==='siteType'?'ground':key==='scene'?'urban':'tower',local=baselineModel({[key]:value,search:'SX-DEMO-001',pageSize:'10'},versions);assert.deepEqual(local.data.rollup,all.data.rollup);}const city=baselineModel({city:'610100',view:'regions'},versions);assert.equal(city.regions.reduce((n,r)=>n+r.sites,0),240);assert.equal(city.data.rollup.totals.infrastructure,1200);});
test('brand scope retains whole-site physical resources, no fabricated tenancy or backfilled old attributes',()=>{const versions=previewSeed('test').snapshots;delete versions[0].inventory.rows[0].attributes;const all=baselineModel({},versions);assert.equal(all.metadata[versions[0].inventory.rows[0].id],null);assert.equal(all.missingAttributes,1);assert.equal(all.tenancy.sharingRate,null);assert.equal(all.tenantVersion,null);assert.equal(all.months.length,0);const other=baselineModel({operator:'other'},versions);assert.equal(other.data.rollup.totals.sites,120);assert.equal(other.data.rollup.totals.infrastructure,600);assert.ok(other.data.rows.every(r=>!('graph'in r)));const second=baselineModel({page:'2',pageSize:'10'},versions);assert.deepEqual(second.data.evidence.map(e=>e.siteId),second.data.rows.slice(10,20).map(r=>r.id));});
test('unknown geography remains explicit, missing regions are not zero-filled, sorts retain totals',()=>{const versions=previewSeed('test').snapshots,inventory=versions[0].inventory;inventory.rows[0].city='unknown';inventory.rows[0].county='unknown';inventory.rows[0].cityName='';inventory.rows[0].countyName='';assert.ok(inventoryChecks(inventory).every(c=>c.passed));const model=baselineModel({view:'regions',metric:'tower',sort:'value',direction:'desc'},versions);assert.equal(model.regions.at(-1)!.code,'unknown');assert.equal(model.regions.at(-1)!.sites,1);assert.equal(model.regions.reduce((n,r)=>n+r.value!,0),1080);inventory.rows=inventory.rows.filter(r=>r.city==='610100');assert.equal(baselineModel({},versions).regions.length,1);});
test('all local and global query dimensions reject duplicate, forged or unknown values',()=>{const versions=previewSeed('test').snapshots;for(const input of [{view:['sites','regions']},{siteType:'invented'},{scene:['urban','urban']},{facility:'customer'},{metric:'amount'},{sort:'name'},{direction:'up'},{month:'2026-09'},{anchor:'false'},{tenantCount:'6'},{workspaceId:'forged'},{snapshotId:['bad','bad']},{view:'sharing',search:['same','same']},{view:'regions',operatorCount:'unknown'},{view:'regions',search:'x'.repeat(81)}])assert.throws(()=>baselineModel(input,versions),/invalid_/);});
test('operator filtering changes member sites but never recomputes full tenants from selected brand',()=>{const versions=previewSeed('test').snapshots,inventory=versions[0].inventory,id=inventory.rows[0].id;const fact={id:'month-r1',month:'2026-10',revision:1,supersedesId:null,sourceVersion:'local-test',asOf:'2026-10-25T18:00:00+08:00',sites:inventory.rows.map(r=>({siteId:r.id,complete:true,tenants:[{customerId:r.id+'-a',operator:'mobile',from:'2026-10-01',to:'2026-11-01',anchor:'yes' as const,evidence:['a']},{customerId:r.id+'-b',operator:'other',from:'2026-10-01',to:'2026-11-01',anchor:'no' as const,evidence:['b']}]}))};inventory.tenancy={snapshots:[fact],refs:[{month:fact.month,snapshotId:fact.id}]};assert.equal(baselineModel({operator:'mobile'},versions).tenancy.rows.find(r=>r.siteId===id)!.count,2);const access={...previewAccess('test'),operators:['mobile']};inventory.rows=visibleRows(inventory.rows,access);inventory.tenancy=scopeTenancy(inventory.tenancy,new Set(inventory.rows.map(r=>r.id)),access.operators);assert.equal(baselineModel({operator:'mobile'},versions).tenancy.sharingRate,null);});

test('resource perspectives reconcile both owners at province, city and county; brand narrows only customer equipment',()=>{
 const versions=previewSeed('perspectives').snapshots;
 for(const query of [{view:'composition'},{view:'regions',city:'610100'},{view:'regions',city:'610100',county:'610116'},{view:'composition',operator:'other'},{view:'regions',operator:'mobile'}]){
  const model=baselineModel(query,versions),total=model.resourceTotals;
  assert.equal(model.regions.reduce((sum,r)=>sum+r.facilities,0),total.facilities);
  assert.equal(model.regions.reduce((sum,r)=>sum+r.customerDevices,0),total.customerDevices);
  assert.equal(model.customerCounts.reduce((sum,r)=>sum+r.count,0),total.customerDevices);
  assert.equal(model.facilityCounts.reduce((sum,r)=>sum+r.count,0),total.facilities);
  if(query.operator)assert.ok(model.customerCounts.every(r=>r.code===query.operator));
 }
 const all=baselineModel({view:'composition'},versions);assert.equal(all.resourceTotals.customerDevices,3902);
 const filtered=baselineModel({view:'composition',operator:'other',search:'missing',facility:'tower'},versions);
 assert.equal(filtered.resourceTotals.facilities,600);assert.equal(filtered.resourceTotals.customerDevices,120);
 assert.equal(filtered.customerCounts[0].sites,120);
});
test('customer resource deltas use the selected frozen versions, keeping zero valid and unknown geography explicit',()=>{
 const versions=previewSeed('deltas').snapshots,prior=versions[0],current=structuredClone(prior);
 current.id='resource-revision';current.inventory.descriptor.id=current.id;current.inventory.rows[0].devices=current.inventory.rows[0].devices.filter(d=>d.owner!=='other');
 versions.push(current);
 const model=baselineModel({view:'composition',snapshotId:current.id,compareSnapshotId:prior.id},versions);assert.equal(model.customerDelta,'0');
 const device=current.inventory.rows[0].devices.find(d=>d.owner==='mobile')!;current.inventory.rows[0].devices=current.inventory.rows[0].devices.filter(d=>d.id!==device.id);
 assert.equal(baselineModel({view:'composition',snapshotId:current.id,compareSnapshotId:prior.id,operator:'mobile'},versions).customerDelta,'-1');
 current.inventory.rows[0].city='unknown';current.inventory.rows[0].county='unknown';current.inventory.rows[0].cityName='';
 const unknown=baselineModel({view:'regions',snapshotId:current.id},versions).regions.find(r=>r.code==='unknown')!;assert.equal(unknown.facilities,5);assert.equal(unknown.customerDevices,3);
});
