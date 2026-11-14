import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,stat,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {previewInventory,previewAccess} from './preview';
import {generateHistory,historyAggregate,historyScope,hourlyShares,relationUsage,materializeHistory,buildHistoryRollups} from './history';
import {readDemoHistory} from './history-store';
import {calendarPeriod,historyId,parseHistoryId,historyWindow,stepHistory,HISTORY_START,HISTORY_END,DEFAULT_HISTORY_ID,DAY} from './history-calendar';
import {inventoryChecks} from './foundation';
import {validateServices,serviceSummary,serviceSummaryReader} from './quantification';
import {evaluateEvidence} from './evidence';
import {summarizeTenancy,tenantMonth} from './tenancy';
import {servicesModel} from '../../tower-service/services/model';
import {evidenceModel} from '../../tower-service/evidence/model';
import {configurationEvidence} from './configuration-evidence';
const base=previewInventory();base.rows=base.rows.slice(0,24);base.expectedSites=base.rows.length;base.expectedDevices=base.rows.reduce((n,s)=>n+s.devices.length,0);
const h=generateHistory(base),scope=historyScope(h,previewAccess('history-test'),Date.now());
test('frozen two-year calendar has 24 complete months, Monday weeks and explicit partial years',()=>{
 assert.equal(h.days,730);assert.equal(historyWindow(DEFAULT_HISTORY_ID).length,24);
 assert.deepEqual(calendarPeriod('week','2026-01-01'),{start:'2025-12-29T00:00:00+08:00',end:'2026-01-05T00:00:00+08:00'});
 assert.equal(Date.parse(calendarPeriod('year','2024-02-29').end)-Date.parse(calendarPeriod('year','2024-02-29').start),366*DAY);
 assert.equal(parseHistoryId(historyId('year','2024-12-01'))!.complete,false);assert.equal(parseHistoryId(historyId('year','2025-01-01'))!.complete,true);
 assert.equal(stepHistory(historyId('hour',HISTORY_START),-1),null);assert.equal(stepHistory(historyId('hour','2026-10-31T23:00:00+08:00'),1),null);
 assert.throws(()=>parseHistoryId('tower-demo-history-v1:day:2026-02-30'),/invalid_history/);
});
test('generation is deterministic, sparse and never mutates original resources',()=>{
 const before=JSON.stringify(base),again=generateHistory(base);assert.deepEqual(h.daily,again.daily);assert.deepEqual(h.configs,again.configs);assert.equal(JSON.stringify(base),before);assert.equal(h.daily.length,h.days*h.relations.length);assert.ok(h.configs.length<h.relations.length*25*2);assert.equal(h.months.length,24);
});
test('hour partitions conserve every integer Wh and reflect within-day shape',()=>{
 for(const n of [0,1,23,24,100003,4294967295]){const hours=hourlyShares(n,7,100);assert.equal(hours.length,24);assert.equal(hours.reduce((a,b)=>a+b,0),n);assert.ok(hours.every(Number.isSafeInteger));}
 const from='2025-08-14T00:00:00+08:00',to='2025-08-15T00:00:00+08:00';const daily=relationUsage(h,0,from,to);let sum=0;for(let hour=0;hour<24;hour++){const start=from.replace('00:00:00',String(hour).padStart(2,'0')+':00:00');sum+=relationUsage(h,0,start,calendarPeriod('hour',start).end);}assert.equal(sum,daily);
});
test('day month quarter and year quantities reconcile with identical operator/site scope',()=>{
 const region={city:'all',county:'all',operator:'all'},annual=historyAggregate(h,historyId('year','2025-01-01'),'supplied-energy',scope,region);let months=0n;
 for(let month=1;month<=12;month++){const date='2025-'+String(month).padStart(2,'0')+'-01',id=historyId('month',date),p=parseHistoryId(id)!;let days=0n;for(let ms=Date.parse(p.start);ms<Date.parse(p.end);ms+=DAY)days+=BigInt(historyAggregate(h,historyId('day',new Date(ms).toISOString()),'supplied-energy',scope,region).quantity!);const value=historyAggregate(h,id,'supplied-energy',scope,region);assert.equal(days,BigInt(value.quantity!));months+=days;}assert.equal(months,BigInt(annual.quantity!));
});
test('weekly totals cross month/year boundaries using the same daily source',()=>{
 const id=historyId('week','2026-01-01'),p=parseHistoryId(id)!,region={city:'all',county:'all',operator:'all'};let total=0n;for(let ms=Date.parse(p.start);ms<Date.parse(p.end);ms+=DAY)total+=BigInt(historyAggregate(h,historyId('day',new Date(ms).toISOString()),'supplied-energy',scope,region).quantity!);assert.equal(historyAggregate(h,id,'supplied-energy',scope,region).quantity,String(total));
});
test('materialized stock/usage use the same aggregates and stock does not sum daily counts',()=>{
 for(const grain of ['hour','day','week','month','year'] as const){const id=historyId(grain,'2025-08-14T09:00:00+08:00'),s=materializeHistory(h,id,scope),c=s.inventory.services!,reader=serviceSummaryReader(c),sites=new Set(s.inventory.rows.map(r=>r.id));assert.ok(inventoryChecks(s.inventory).every(c=>c.passed));validateServices(c);
  for(const m of h.metrics){const actual=reader(m.id,sites).quantity,expected=historyAggregate(h,id,m.id,scope,{city:'all',county:'all',operator:'all'}).quantity;assert.equal(actual,expected,grain+' / '+m.id);assert.deepEqual(reader(m.id,sites),serviceSummary(c,m.id,sites));}
 }
});
test('monthly county rollups conserve quantities and deduplicate coverage identities',()=>{
 const raw=historyAggregate(h,DEFAULT_HISTORY_ID,'supplied-energy',scope,{city:'all',county:'all'}),cached={...h,rollups:buildHistoryRollups(h)};for(const m of h.metrics)assert.deepEqual(historyAggregate(cached,DEFAULT_HISTORY_ID,m.id,scope,{city:'all',county:'all'}),historyAggregate(h,DEFAULT_HISTORY_ID,m.id,scope,{city:'all',county:'all'}));assert.ok(raw.coverage<=h.sites.length);
});
test('operator and organization restrictions apply before materialization and totals',()=>{
 const site=h.sites[0],access={...previewAccess('restricted'),cityIds:[site.city],operators:['mobile'],siteIds:[site.id]},restricted=historyScope(h,access,Date.now()),s=materializeHistory(h,DEFAULT_HISTORY_ID,restricted);assert.ok(s.inventory.rows.every(r=>r.id===site.id));assert.ok(s.inventory.services!.customers.every(c=>c.operator==='mobile'));assert.ok(s.inventory.evidence!.rules.every(r=>r.operator==='mobile'));assert.ok(s.inventory.tenancy!.snapshots.every(m=>m.sites.every(s=>!s.complete&&s.tenants.every(t=>t.operator==='mobile'))));assert.ok(s.inventory.rows.every(s=>s.devices.every(d=>d.owner==='\u94c1\u5854'||d.owner==='mobile')));assert.throws(()=>historyScope(h,{...access,expiresAt:1},Date.now()),/permission_denied/);
});
test('monthly tenancy follows effective occupancy and never invents full-scope sharing',()=>{
 const s=materializeHistory(h,DEFAULT_HISTORY_ID,scope),month=tenantMonth(s.inventory.tenancy,'2026-10')!,totals=summarizeTenancy(month,s.inventory.rows.map(r=>r.id));assert.equal(totals.complete,true);assert.ok(totals.shared!<=totals.occupied!);assert.equal(totals.sharingRate,totals.shared!/totals.occupied!);
});
test('meter evidence matches service Wh for known rules; unconfirmed customer rules stay pending',()=>{
 const s=materializeHistory(h,DEFAULT_HISTORY_ID,scope),evaluation=evaluateEvidence(s.inventory.evidence!,s.inventory.tenancy,new Map(s.inventory.rows.map(r=>[r.id,r.city])));
 for(const operator of ['mobile','telecom','unicom']){const rows=evaluation.rows.filter(r=>r.customer?.operator===operator);assert.ok(rows.every(r=>r.state==='complete'));assert.equal(String(rows.reduce((n,r)=>n+BigInt(r.quantity!),0n)),historyAggregate(h,DEFAULT_HISTORY_ID,'supplied-energy',scope,{city:'all',county:'all',operator}).quantity);}
 assert.ok(evaluation.rows.filter(r=>['broadcast','other'].includes(r.customer!.operator)).every(r=>r.state==='pending'&&r.quantity===null));assert.ok(evaluation.rows.every(r=>r.ruleIds.length===1&&r.sourceRef.includes('daily')));
});
test('configuration evidence reuses scoped end-of-period facts across all grains without new meter records',()=>{
 const operator='mobile',region={city:'all',county:'all',operator};
 for(const grain of ['hour','day','week','month','year'] as const){
  const id=historyId(grain,'2026-10-10T10:00:00+08:00'),snapshot=materializeHistory(h,id,scope),capture=snapshot.inventory.services!;
  const sites=new Set(snapshot.inventory.rows.map(r=>r.id)),rows=configurationEvidence(capture,true,sites,[operator]);
  assert.ok(rows.length>0&&rows.every(r=>r.customer.operator===operator&&r.state==='complete'&&r.sourceRef===r.configuration.sourceRef&&r.configuration.ruleVersion===capture.ruleSetVersion));
  assert.equal(new Set(rows.map(r=>r.configuration.componentId+':'+r.dimension.id)).size,rows.length);
  const sum=rows.filter(r=>r.serviceItemId==='mounting-positions').reduce((n,r)=>n+BigInt(r.quantity!),0n);
  assert.equal(String(sum),historyAggregate(h,id,'mounting-positions',scope,region).quantity);
  assert.ok(snapshot.inventory.evidence!.records.every(r=>r.sourceRef.includes('/daily/')));
  assert.deepEqual(configurationEvidence(capture,false,sites,[operator]),[]);
 }
});
test('configuration summary, detail filters and export share counts; known gaps and pending rules remain explicit',()=>{
 const s=materializeHistory(h,DEFAULT_HISTORY_ID,scope),baseQuery={snapshotId:s.id,city:'all',county:'all'};
 const summary=evidenceModel(baseQuery,[s]),items=summary.groups.flatMap(g=>g.children),mounting=items.find(r=>r.id==='mounting-positions')!;
 assert.deepEqual(summary.configurationGaps,['standby-generators','indoor-coverage-area']);
 for(const gap of summary.configurationGaps){assert.ok(s.inventory.services!.configurations.some(r=>r.serviceItemId===gap));assert.equal(items.find(r=>r.id===gap)!.items,0);}
 const query={...baseQuery,view:'details',service:mounting.id,dimension:'all',method:'configuration',state:'complete'};
 const detail=evidenceModel(query,[s]),exported=evidenceModel(query,[s],scope.operators,true);
 assert.ok(mounting.configuration>0);assert.equal(detail.rowCount,mounting.configuration);assert.equal(exported.rows.length,mounting.configuration);
 const first=exported.rows[0];assert.equal(first.kind,'configuration');assert.equal(evidenceModel({...query,search:first.id},[s]).rowCount,1);
 const serviceDetails=servicesModel({...baseQuery,view:'operators',metric:'mounting-positions',search:first.siteId},[s]);
 assert.ok(serviceDetails.rows.some(r=>r.basisId===first.id));
 const restricted=evidenceModel({...baseQuery,operator:'broadcast',view:'details',dimension:'configuration:mounting-positions',state:'pending'},[s],scope.operators,true);
 assert.ok(restricted.rows.length>0&&restricted.rows.every(r=>r.customer?.operator==='broadcast'&&r.kind==='configuration'&&r.quantity===null&&r.rawQuantity!==null));
 const meter=evidenceModel({...baseQuery,dimension:'Wh:0:customer_dedicated_meter'},[s]);
 assert.equal(meter.totals.applicable,s.inventory.evidence!.items.length);
 assert.ok(summary.totals.applicable>meter.totals.applicable);
});
test('evidence toolbar and grouped completeness reconcile with the visible scope before pagination',()=>{
 const s=materializeHistory(h,DEFAULT_HISTORY_ID,scope),query={snapshotId:s.id,dimension:'all',city:'all',county:'all'};
 const summary=evidenceModel(query,[s]),rows=evidenceModel({...query,view:'details'},[s],scope.operators,true).rows;
 assert.equal(summary.displayCounts.items,rows.length);
 assert.equal(summary.displayCounts.pending,rows.filter(r=>r.state==='pending').length);
 assert.equal(summary.displayCounts.complete,rows.filter(r=>r.customer!==null&&r.state==='complete').length);
 assert.equal(summary.displayCounts.completeness,summary.displayCounts.complete/summary.displayCounts.applicable);
 assert.equal(summary.groups.reduce((n,g)=>n+g.pending,0),summary.displayCounts.pending);
 assert.equal(summary.groups.reduce((n,g)=>n+g.complete,0),summary.displayCounts.complete);
 for(const group of summary.groups){
  assert.equal(group.complete,group.configuration+group.measured+group.allocated);
  assert.equal(group.children.reduce((n,item)=>n+item.items,0),group.items);
 }
 const filteredQuery={...query,view:'details',service:'mounting-positions',state:'pending'};
 const filtered=evidenceModel(filteredQuery,[s]),page=evidenceModel({...filteredQuery,pageSize:'10',page:'2'},[s]);
 assert.ok(filtered.displayCounts.pending>0);
 assert.equal(filtered.displayCounts.pending,filtered.rowCount);
 assert.equal(filtered.displayCounts.complete,0);
 assert.deepEqual(page.displayCounts,filtered.displayCounts);
 assert.equal(evidenceModel({...filteredQuery,search:'no-such-evidence'},[s]).displayCounts.completeness,null);
 const unknown=structuredClone(s);unknown.inventory.evidence!.applicabilityComplete=false;
 assert.equal(evidenceModel(query,[unknown]).displayCounts.completeness,null);
});
test('summary filters, grouped counts and exported evidence share the same operator and status scope',()=>{
 const s=materializeHistory(h,DEFAULT_HISTORY_ID,scope);
 const base={snapshotId:s.id,city:'all',county:'all',dimension:'all',view:'summary'};
 for(const patch of [{operator:'mobile',method:'configuration'},{operator:'broadcast',service:'mounting-positions',state:'pending'},{operator:'all',dimension:'Wh:0:customer_dedicated_meter'},{operator:'mobile',state:'pending'}]){
  const query={...base,...patch},summary=evidenceModel(query,[s]),exported=evidenceModel(query,[s],scope.operators,true),details=evidenceModel({...query,view:'details'},[s]);
  assert.deepEqual(summary.displayCounts,details.displayCounts);
  assert.equal(summary.groups.reduce((n,g)=>n+g.items,0),exported.rows.length);
  assert.equal(summary.groups.reduce((n,g)=>n+g.complete,0),summary.displayCounts.complete);
  assert.equal(summary.groups.reduce((n,g)=>n+g.pending,0),summary.displayCounts.pending);
  assert.equal(summary.displayCounts.items,exported.rows.length);
  if(patch.operator!=='all')assert.ok(exported.rows.every(r=>r.customer?.operator===patch.operator));
  if(patch.service)assert.deepEqual(summary.groups.flatMap(g=>g.children).map(r=>r.id),[patch.service]);
 }
 const restricted=evidenceModel({...base,operator:'all'},[s],['mobile'],true);
 assert.ok(restricted.rows.every(r=>r.customer===null||r.customer.operator==='mobile'));
 assert.equal(restricted.groups.reduce((n,g)=>n+g.items,0),restricted.rows.length);
});
test('24 monthly configuration summaries follow the same source facts and regional boundaries',()=>{
 for(const id of historyWindow(DEFAULT_HISTORY_ID)){
  const snapshot=materializeHistory(h,id,scope,false),capture=snapshot.inventory.services!,site=snapshot.inventory.rows[0];
  if(!site)continue;
  const sites=new Set(snapshot.inventory.rows.filter(r=>r.city===site.city&&r.county===site.county).map(r=>r.id));
  const rows=configurationEvidence(capture,true,sites,['mobile']),region={city:site.city,county:site.county,operator:'mobile'};
  for(const metric of ['mounting-positions','room-area','power-capacity','fiber-core-length']){
   const sum=rows.filter(r=>r.serviceItemId===metric).reduce((n,r)=>n+BigInt(r.quantity!),0n);
   assert.equal(String(sum),historyAggregate(h,id,metric,{...scope,operators:['mobile']},region).quantity,id+' / '+metric);
  }
 }
});
test('period models find adjacent and year baselines from real generated intervals',()=>{
 const current=materializeHistory(h,DEFAULT_HISTORY_ID,scope),previous=materializeHistory(h,stepHistory(DEFAULT_HISTORY_ID,-1)!,scope),year=materializeHistory(h,historyId('month','2025-10-01'),scope),versions=[year,previous,current];assert.equal(servicesModel({snapshotId:current.id,view:'periods',metric:'supplied-energy'},versions).baseline!.id,previous.id);assert.equal(servicesModel({snapshotId:current.id,view:'periods',metric:'supplied-energy',comparisonMode:'year'},versions).baseline!.id,year.id);
});
test('installer is repeatable, read-only verification needs installed files and preserves bytes',async()=>{
 const root=await mkdtemp(join(tmpdir(),'tower-history-'));try{await assert.rejects(readDemoHistory(root,base),/not_installed/);const first=await readDemoHistory(root,base,true),before=await stat(first.path),second=await readDemoHistory(root,base,true);assert.equal(first.digest,second.digest);assert.equal((await stat(first.path)).mtimeMs,before.mtimeMs);assert.equal(second.history.daily.length,h.daily.length);assert.ok(second.history.rollups!.length>0);assert.ok(first.bytes<2000000);}finally{await rm(root,{recursive:true,force:true});}
});
