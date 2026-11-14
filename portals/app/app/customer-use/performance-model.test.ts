import {test} from 'node:test';
import assert from 'node:assert/strict';
import {servicePerformanceModel} from './performance-model';
import {readCustomerMode} from './mode';
import {physicalEnergy} from './performance-labels';
test('stage3 province and city conserve exact whole-site energy and keep unconnected evidence null',()=>{
 const data=servicePerformanceModel({}),b=data.performance;
 assert.equal(data.summary.sites,1080);
 assert.equal(b.total.energyRecords,1080*24);
 assert.equal(b.total.batterySites,180);
 assert.equal(b.regions.reduce((n,row)=>n+row.sites,0),1080);
 assert.equal(String(b.regions.reduce((n,row)=>n+BigInt(row.observedEnergyWh!),0n)),b.total.observedEnergyWh);
 assert.equal(String(b.series.reduce((n,row)=>n+BigInt(row.observedEnergyWh!),0n)),b.total.observedEnergyWh);
 const city=servicePerformanceModel({city:'610100'});
 assert.equal(city.performance.total.observedEnergyWh,b.regions.find(row=>row.id==='610100')!.observedEnergyWh);
 for(const key of ['customerEnergyWh','meterBinding','maintenance','assurance'] as const)assert.equal(b[key],null);
 assert.ok(Object.values(b.impact).every(value=>value===null));
});
test('stage3 periods affect totals, regions, trends and detailed evidence together',()=>{
 const day=servicePerformanceModel({city:'610200'}),week=servicePerformanceModel({city:'610200',period:'week'}),month=servicePerformanceModel({city:'610200',period:'month'});
 assert.equal(day.performance.window.times.length,24);assert.equal(week.performance.window.times.length,168);assert.equal(month.performance.window.times.length,744);
 assert.equal(week.performance.series.length,7);assert.equal(month.performance.series.length,31);
 assert.equal(month.performance.evidence[0].records.length,744);
 for(const row of month.performance.evidence)assert.equal(String(row.records.reduce((n,record)=>n+BigInt(record.energyWh!),0n)),row.observedEnergyWh);
 assert.ok(BigInt(month.performance.total.observedEnergyWh!)>BigInt(week.performance.total.observedEnergyWh!));
 assert.ok(BigInt(week.performance.total.observedEnergyWh!)>BigInt(day.performance.total.observedEnergyWh!));
 assert.equal(month.performance.regions[0].observedEnergyWh,month.performance.total.observedEnergyWh);
 const hour=servicePerformanceModel({city:'610200',period:'hour',asOf:'2026-10-25T15:00:00'});
 assert.equal(hour.performance.total.batterySites,0);assert.equal(hour.performance.series.length,1);
});
test('stage3 local filters and pages do not change province totals or leak every record',()=>{
 const base=servicePerformanceModel({city:'610100'}),filtered=servicePerformanceModel({city:'610100',search:'SX-DEMO-001',supplyFilter:'all'});
 assert.equal(filtered.rows.length,1);assert.deepEqual(filtered.performance.total,base.performance.total);
 const battery=servicePerformanceModel({city:'610100',supplyFilter:'battery',pageSize:'10',page:'2'});
 assert.equal(battery.rows.length,base.performance.total.batterySites);assert.equal(battery.performance.evidence.length,10);
 assert.deepEqual(battery.performance.evidence.map(row=>row.id),battery.rows.slice(10,20).map(row=>row.id));
 assert.equal(servicePerformanceModel({city:'610100',supplyFilter:'missing'}).rows.length,0);
});
test('stage3 physical energy cannot be allocated by brand or communication state; invalid queries remain rejected',()=>{
 const base=servicePerformanceModel({city:'610200'}),brand=servicePerformanceModel({city:'610200',operator:'mobile',operatorCount:'5',status:'critical'});
 assert.deepEqual(brand.performance.total,base.performance.total);assert.equal(brand.query.operator,'all');assert.equal(brand.query.status,'all');
 for(const input of [{supplyFilter:'bad'},{operator:'bad'},{city:['all','610100']},{period:'bad'},{workspaceId:'other'}])assert.throws(()=>servicePerformanceModel(input),/^Error: invalid_/);
 assert.equal(readCustomerMode({section:'performance',period:'month'}).mode,'performance');
 assert.equal(physicalEnergy('0').value,'0.00');assert.equal(physicalEnergy(null).text,'\u5f85\u63a5\u5165');assert.equal(physicalEnergy('1234567890123456789').value,'1,234,567,890,123,456.79');
});
