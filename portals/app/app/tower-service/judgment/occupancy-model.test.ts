import {test} from 'node:test';
import assert from 'node:assert/strict';
import {previewInventory,previewAccess} from '../../domains/tower-service/preview';
import {generateHistory,historyScope,materializeHistory} from '../../domains/tower-service/history';
import {historyId} from '../../domains/tower-service/history-calendar';
import {occupancyModel} from './occupancy-model';
import {analysisHref} from './analysis-links';
import type {TenantMonthSnapshot} from '../../domains/tower-service/tenancy';
const inventory=previewInventory();inventory.rows=inventory.rows.slice(0,12);
const history=generateHistory(inventory),access=previewAccess('test'),scope=historyScope(history,access,Date.now()),id=historyId('month','2026-10-01');
function result(snapshotId=id,operators=access.operators){const selectedScope={...scope,operators},version=materializeHistory(history,snapshotId,selectedScope,false);return {versions:[version],access:{...access,operators},history,scope:selectedScope};}
test('rolling 12/8/3 windows use exact prior period ends and keep partial current observations',()=>{
 for(const [grain,size,baseline] of [['month',12,'2026-09'],['quarter',8,'2026-09'],['year',3,'2025-12']] as const){const m=occupancyModel({snapshotId:id,grain},result());assert.equal(m.trend.length,size);assert.equal(m.current.baselineMonth,baseline);assert.equal(m.current.month,'2026-10');assert.equal(m.current.asOf,'2026-10-31T23:59:59+08:00');assert.equal(m.current.net,m.current.current!-m.current.baseline!);assert.equal(m.current.customers.reduce((n,c)=>n+c.net!,0),m.current.net);}
 const yearly=occupancyModel({snapshotId:id,grain:'year'},result());assert.equal(yearly.trend[0].label,'2024');assert.equal(yearly.trend[0].added,null);assert.equal(yearly.trend[0].reason,'baseline_missing');
});
test('regional scope reconciles; earliest and missing baseline never substitute older months',()=>{
 const city=history.sites[0].city,m=occupancyModel({snapshotId:id,city},result());assert.ok(m.current.current!<=occupancyModel({snapshotId:id},result()).current.current!);
 const early=historyId('month','2024-11-01'),first=occupancyModel({snapshotId:early},result(early));assert.equal(first.current.reason,'baseline_missing');assert.equal(first.current.net,null);
 const r=result();r.history={...history,months:history.months.filter(m=>m.month!=='2026-09')};const missing=occupancyModel({snapshotId:id},r);assert.equal(missing.current.reason,'baseline_missing');assert.equal(missing.current.net,null);
});
test('quarterly endpoint sets do not accumulate monthly exits and returns',()=>{
 const r=result(),v=r.versions[0],siteId=v.inventory.rows[0].id;
 const sources:TenantMonthSnapshot[]=['2025-12','2026-01','2026-02','2026-03'].map(month=>({id:month,month,revision:1,supersedesId:null,asOf:month+'-'+(month.endsWith('02')?'28':'31')+'T23:59:59+08:00',sourceVersion:'capture-v1',sites:[{siteId,complete:true,tenants:month==='2026-01'?[]:[{customerId:'customer',operator:'mobile',from:'2025-01-01T00:00:00+08:00',to:'2027-01-01T00:00:00+08:00',anchor:'yes',evidence:['source']}]}]}));
 v.id='captured';v.inventory.descriptor={...v.inventory.descriptor,id:'captured',stockAsOf:'2026-03-31T23:59:59+08:00'};v.inventory.rows=v.inventory.rows.slice(0,1);v.inventory.tenancy={snapshots:sources,refs:sources.map(s=>({month:s.month,snapshotId:s.id}))};
 const monthly=occupancyModel({snapshotId:'captured',grain:'month'},r),quarter=occupancyModel({snapshotId:'captured',grain:'quarter'},r);assert.equal(monthly.trend.reduce((n,p)=>n+(p.added??0),0),1);assert.equal(monthly.trend.reduce((n,p)=>n+(p.removed??0),0),1);assert.equal(quarter.current.baselineMonth,'2025-12');assert.equal(quarter.current.added,0);assert.equal(quarter.current.removed,0);assert.equal(quarter.current.net,0);
});
test('restricted access, invalid queries and navigation preserve authority',()=>{
 const m=occupancyModel({snapshotId:id},result(id,['mobile']));assert.equal(m.current.current,null);assert.deepEqual(m.current.customers.map(c=>c.operator),['mobile']);
 for(const input of [{snapshotId:['a','b']},{snapshotId:id,grain:'day'},{snapshotId:id,grants:'all'},{snapshotId:id,city:'invalid'}])assert.throws(()=>occupancyModel(input,result()),/invalid_/);
 const url=new URL(analysisHref({snapshotId:id,city:'610300',county:'all'},'occupancy','quarter'),'http://test');assert.equal(url.searchParams.get('view'),'occupancy');assert.equal(url.searchParams.get('grain'),'quarter');assert.equal(url.searchParams.get('city'),'610300');
});
test('formal captures cannot silently discard an old site without a physical lifecycle',()=>{
 const r=result(),v=r.versions[0],site=v.inventory.rows[0];v.id='formal';v.inventory.descriptor={...v.inventory.descriptor,id:'formal',stockAsOf:'2026-10-31T23:59:59+08:00'};
 const old={...site,id:'retired-site'};const prior=structuredClone(v);prior.id='formal-prior';prior.inventory.descriptor.id=prior.id;prior.inventory.rows=[site,old];r.versions.push(prior);
 const now:TenantMonthSnapshot={id:'now',month:'2026-10',revision:1,supersedesId:null,asOf:'2026-10-31T23:59:59+08:00',sourceVersion:'v1',sites:[{siteId:site.id,complete:true,tenants:[]}]};
 const before={...now,id:'before',month:'2026-09',asOf:'2026-09-30T23:59:59+08:00',sites:[...now.sites,{siteId:old.id,complete:true,tenants:[]}]};v.inventory.rows=[site];v.inventory.tenancy={snapshots:[now,before],refs:[{month:now.month,snapshotId:now.id},{month:before.month,snapshotId:before.id}]};
 const m=occupancyModel({snapshotId:'formal'},r);assert.equal(m.current.current,null);assert.equal(m.current.net,null);assert.equal(m.current.reason,'current_missing');
});
