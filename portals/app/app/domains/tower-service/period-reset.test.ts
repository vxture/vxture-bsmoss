import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {latestPeriodId} from './period-reset';
import {HISTORY_VERSION} from './history-calendar';
import type {SnapshotDescriptor} from './query';

test('history reset keeps the grain and uses the frozen latest observation',()=>{
 for(const [grain,start,end] of [
  ['hour','2025-01-01T00','2026-10-31T23'],['day','2025-01-01','2026-10-31'],
  ['week','2025-01-06','2026-10-26'],['month','2025-01-01','2026-10-01'],['year','2025-01-01','2026-01-01']
 ])assert.equal(latestPeriodId(HISTORY_VERSION+':'+grain+':'+start,[]),HISTORY_VERSION+':'+grain+':'+end);
});
const snapshot=(id:string,stockAsOf:string,syncedAt:string|null=null):SnapshotDescriptor=>({id,stockAsOf,syncedAt,dataset:'production',mode:'production',sourceVersion:id,mappingVersion:'v1',businessPeriod:null,dataThrough:stockAsOf,publishedAt:null,periodComplete:null,ruleSetVersion:null});
test('capture reset selects the newest authorized capture then its revision without mutating the catalog',()=>{
 const catalog=[snapshot('old','2026-09-01T00:00:00Z'),snapshot('new','2026-10-01T00:00:00Z','2026-10-02T00:00:00Z'),snapshot('revision','2026-10-01T00:00:00Z','2026-10-03T00:00:00Z')];
 assert.equal(latestPeriodId('old',catalog),'revision');
 assert.deepEqual(catalog.map(s=>s.id),['old','new','revision']);
 assert.equal(latestPeriodId('revision',[catalog[0]]),'old');
 assert.equal(latestPeriodId('current',[]),'current');
});
