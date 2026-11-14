import {test} from 'node:test';
import assert from 'node:assert/strict';
import {previewSeed,previewInventory,previewAccess} from './preview';
import {serviceFixture} from './quantification.fixture';
import {contributionAnalysis} from './contribution';
import {generateHistory,materializeHistory,historyScope} from './history';
import {historyId,stepHistory} from './history-calendar';
import {judgmentFindings} from './judgment';
import {evidenceModel} from '../../tower-service/evidence/model';
import {judgmentModel} from '../../tower-service/judgment/model';

function fixture(){
 const snapshot=previewSeed('contribution-test').snapshots[0];snapshot.inventory.rows=snapshot.inventory.rows.slice(0,2);
 const versions=['2026-09','2026-10'].map((month,index)=>{
  const s=structuredClone(snapshot),start=month+'-01T00:00:00+08:00',end='2026-'+String(10+index).padStart(2,'0')+'-01T00:00:00+08:00';
  const c=serviceFixture(s.inventory.rows[0].id,s.inventory.rows[1].id),config=c.configurations[0];c.period={start,end};c.stockAsOf=end;c.dataThrough=end;c.usage=[];
  c.configurations=s.inventory.rows.map((site,i)=>({...config,id:'config-'+i,componentId:'component-'+i,siteId:site.id,from:start,quantity:String(index?(i?40:60):50)}));
  s.id=month;s.inventory.services=c;s.inventory.descriptor={...s.inventory.descriptor,id:s.id,businessPeriod:c.period,stockAsOf:end,dataThrough:end,periodComplete:true};return s;
 });
 const [before,current]=versions,context={snapshotId:current.id,compareSnapshotId:before.id,operator:'all',city:'all',county:'all',businessPeriod:current.inventory.descriptor.businessPeriod};
 return {current,before,context};
}
test('contribution separates positive/negative movement even when net change is zero',()=>{
 const f=fixture(),r=contributionAnalysis(f.current,f.before,f.context,'mount',['other','mobile']);
 assert.equal(r.total.delta,'0');assert.equal(r.positive,'10');assert.equal(r.negative,'-10');assert.deepEqual(r.sites.map(s=>s.contribution).sort(),['-1000','1000']);
 for(const rows of [r.sites,r.regions,r.operators])assert.equal(rows.reduce((n,s)=>n+BigInt(s.delta!),0n),BigInt(r.total.delta!));
 assert.equal(r.changedSites,2);
});
test('contribution preserves integer precision, zero baselines and unavailable captures',()=>{
 const f=fixture();f.before.inventory.services!.configurations.forEach(r=>r.quantity='900719925474099300001');f.current.inventory.services!.configurations.forEach(r=>r.quantity='900719925474099300002');
 let r=contributionAnalysis(f.current,f.before,f.context,'mount',['other']);assert.equal(r.total.delta,'2');assert.equal(r.positive,'2');
 f.before.inventory.services!.configurations.forEach(r=>r.quantity='0');r=contributionAnalysis(f.current,f.before,f.context,'mount',['other']);assert.equal(r.total.contribution,null);assert.ok(r.sites.every(s=>s.contribution===null));
 r=contributionAnalysis(f.current,undefined,f.context,'mount',['other']);assert.equal(r.total.delta,null);assert.equal(r.positive,null);assert.equal(r.reason,'baseline');
 f.before.inventory.services!.configComplete=false;r=contributionAnalysis(f.current,f.before,f.context,'mount',['other']);assert.equal(r.total.delta,null);assert.equal(r.reason,'quantity');
});
test('contribution includes removals from the prior scope and never sums dangling current facts',()=>{
 const f=fixture(),id=f.before.inventory.rows[0].id;f.current.inventory.rows=f.current.inventory.rows.slice(1);
 const r=contributionAnalysis(f.current,f.before,f.context,'mount',['other']);assert.equal(r.total.current,'40');assert.equal(r.total.delta,'-60');assert.equal(r.negative,'-60');
 const removed=r.sites.find(s=>s.id===id)!;assert.equal(removed.current,'0');assert.equal(removed.delta,'-50');assert.equal(removed.snapshotId,f.before.id);
});
test('different unit, scope, revision and incomplete periods retain distinct semantics',()=>{
 const f=fixture();f.before.inventory.services!.metrics[0].unit='different';let r=contributionAnalysis(f.current,f.before,f.context,'mount',['other']);assert.equal(r.total.delta,null);assert.equal(r.reason,'basis');
 f.before=structuredClone(f.current);f.before.id='revision-before';r=contributionAnalysis(f.current,f.before,f.context,'mount',['other']);assert.equal(r.revision,true);assert.equal(r.total.delta,'0');
 f.before.inventory.services!.periodComplete=false;r=contributionAnalysis(f.current,f.before,f.context,'mount',['other']);assert.equal(r.comparable,false);
});
test('operator and region filters constrain every contribution read before aggregation',()=>{
 const f=fixture(),r=contributionAnalysis(f.current,f.before,{...f.context,operator:'mobile'},'mount',['mobile']);assert.equal(r.total.current,'0');assert.equal(r.total.delta,'0');assert.deepEqual(r.operators.map(r=>r.id),['mobile']);
 const empty=contributionAnalysis(f.current,f.before,{...f.context,city:'absent'},'mount',['other']);assert.equal(empty.total.current,'0');assert.equal(empty.sites.length,0);
});
test('history assessment policy is scoped, valid and reconciles pending configuration/meter evidence',()=>{
 const base=previewInventory();base.rows=base.rows.slice(0,24);base.expectedSites=24;base.expectedDevices=base.rows.flatMap(r=>r.devices).length;
 const h=generateHistory(base),scope=historyScope(h,previewAccess('assessment'),Date.now()),id=historyId('month','2026-10-01'),current=materializeHistory(h,id,scope),before=materializeHistory(h,stepHistory(id,-1)!,scope);
 const context={snapshotId:id,compareSnapshotId:before.id,operator:'all',city:'all',county:'all',businessPeriod:current.inventory.descriptor.businessPeriod};
 const findings=judgmentFindings(current,before,context),evidence=evidenceModel({snapshotId:id,view:'summary',dimension:'all'},[before,current]);
 assert.ok(findings.rules>0);assert.equal(findings.findings.filter(f=>f.type==='basis_pending').reduce((n,f)=>n+Number(f.actual),0),evidence.displayCounts.pending);
 assert.ok(findings.findings.some(f=>f.type==='basis_pending'&&f.basisIds.some(id=>id.includes(':config:'))));
 const m=judgmentModel({snapshotId:id,view:'contribution'},[before,current]);assert.equal(m.context.compareSnapshotId,before.id);assert.equal(m.contribution!.total.current,m.contribution!.operators.reduce((n,r)=>n+BigInt(r.current!),0n).toString());
 assert.ok(judgmentModel({snapshotId:id,comparisonMode:'none'},[before,current]).skipped>0);
 const restricted=materializeHistory(h,id,{...scope,operators:['mobile']});assert.ok(restricted.inventory.judgmentRules!.every(r=>r.operator==='mobile'));
});
