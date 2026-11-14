import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readSnapshotContext,snapshotQuery,snapshotNeighbors,snapshotComparison,compareQuantity,type SnapshotDescriptor} from './query';
const fixture=(id:string,start:string,end:string):SnapshotDescriptor=>({id,dataset:'energy',mode:'demo',sourceVersion:id,mappingVersion:'v1',stockAsOf:start,businessPeriod:{start,end},dataThrough:end,syncedAt:null,publishedAt:null,periodComplete:true,ruleSetVersion:'r1'});
const a=fixture('a','2026-10-01T00:00:00+08:00','2026-11-01T00:00:00+08:00');
const b=fixture('b','2026-09-01T00:00:00+08:00','2026-10-01T00:00:00+08:00');
test('snapshot navigation sorts actual timestamps and revisions independently of catalogue order',()=>{
 const revision={...a,id:'revision',syncedAt:'2026-11-11T10:00:00+08:00'};
 const newer={...a,id:'newer',stockAsOf:'2026-10-02T00:00:00+08:00'};
 const catalog=[revision,newer,b,a],original=catalog.map(s=>s.id);
 assert.deepEqual(snapshotNeighbors(catalog,'a'),{previous:'b',next:'revision'});
 assert.deepEqual(snapshotNeighbors(catalog,'revision'),{previous:'a',next:'newer'});
 assert.deepEqual(snapshotNeighbors(catalog,'b'),{previous:null,next:'a'});
 assert.deepEqual(snapshotNeighbors(catalog,'newer'),{previous:'revision',next:null});
 assert.deepEqual(catalog.map(s=>s.id),original);
});
test('snapshot navigation has no target for missing versions or empty boundaries',()=>{
 for(const [catalog,id] of [[[],'a'],[[a],'a'],[[a,b],'missing']] as const)assert.deepEqual(snapshotNeighbors(catalog,id),{previous:null,next:null});
 const tied={...a,id:'z'};
 assert.deepEqual(snapshotNeighbors([tied,a],'a'),{previous:null,next:'z'});
});
test('snapshot context rejects duplicate, forged and out-of-scope versions and regions',()=>{
 const scope={snapshotIds:['a'],operators:['mobile'],regions:[{city:'610100',county:'all'}]};
 const input={operator:'mobile',city:'610100'};
 const context=readSnapshotContext(input,[a,b],scope);
 assert.deepEqual(snapshotQuery(context),{snapshotId:'a',operator:'mobile',city:'610100',county:'all'});
 for(const patch of [{snapshotId:'b'},{compareSnapshotId:'b'},{compareSnapshotId:'a'},{snapshotId:['a','a']},{operator:'all'},{city:'all'},{county:'610116'},{workspaceId:'forged'}])assert.throws(()=>readSnapshotContext({...input,...patch},[a,b],scope),/invalid_/);
 const both={...scope,snapshotIds:['a','b']};assert.equal(readSnapshotContext({...input,compareSnapshotId:'b'},[a,b],both).compareSnapshotId,'b');
});
test('revision, month, year and incompatible comparisons remain distinct',()=>{
 assert.equal(snapshotComparison(a,b).kind,'month');assert.equal(snapshotComparison(a,b).comparable,true);
 assert.equal(snapshotComparison(a,{...a,id:'revision'}).changeAllowed,false);
 assert.equal(snapshotComparison(a,fixture('year','2025-10-01T00:00:00+08:00','2025-11-01T00:00:00+08:00')).kind,'year');
 assert.equal(snapshotComparison(a,{...b,periodComplete:false}).comparable,false);
 assert.equal(snapshotComparison(a,{...b,mappingVersion:'v2'}).comparable,false);
 assert.equal(snapshotComparison(a,{...b,ruleSetVersion:'r2'}).comparable,false);
 assert.equal(snapshotComparison(a,{...b,businessPeriod:null}).comparable,false);
 assert.equal(snapshotComparison(a,fixture('short','2026-09-01T00:00:00+08:00','2026-09-16T00:00:00+08:00')).comparable,false);
});
test('quantity differences preserve exact integers, unknowns and zero baselines',()=>{
 assert.deepEqual(compareQuantity('90071992547409930','90071992547409929',true),{delta:'1',change:'0'});
 assert.deepEqual(compareQuantity('135','100',true),{delta:'35',change:'3500'});
 assert.equal(compareQuantity('10','0',true).change,'new');assert.equal(compareQuantity('0','0',true).change,'unchanged');
 assert.deepEqual(compareQuantity(null,'0',true),{delta:null,change:null});assert.equal(compareQuantity('10','5',false).delta,null);
});
