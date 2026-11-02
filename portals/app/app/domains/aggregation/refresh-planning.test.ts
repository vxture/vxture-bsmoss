import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planPeriodicRefresh,planRevisionRefresh} from './refresh-planning.ts';
const grains=['day','week','month'] as const;
test('72-hour periodic scan emits only closed natural Shanghai windows across week and month boundaries',()=>{
 const r=planPeriodicRefresh({now:'2026-11-02T00:00:00+08:00',notBefore:'2026-01-01T00:00:00+08:00',grains});
 assert.equal(r.windows.filter(w=>w.grain==='day').length,3);
 assert.deepEqual(r.windows.find(w=>w.grain==='week')!.period,{start:'2026-10-25T16:00:00.000Z',end:'2026-11-01T16:00:00.000Z'});
 assert.deepEqual(r.windows.find(w=>w.grain==='month')!.period,{start:'2026-09-30T16:00:00.000Z',end:'2026-10-31T16:00:00.000Z'});
 assert.ok(r.windows.every(w=>Date.parse(w.period.end)<=Date.parse(r.scan.end)));
 const midday=planPeriodicRefresh({now:'2026-11-02T12:00:00+08:00',notBefore:'2026-01-01T00:00:00+08:00',grains});
 assert.equal(midday.windows.filter(w=>w.grain==='day').length,3);assert.ok(midday.windows.every(w=>w.period.end!=='2026-11-02T16:00:00.000Z'));
});
test('lookback boundary is exclusive at end, validity intersects without slicing a natural period',()=>{
 const r=planPeriodicRefresh({now:'2026-11-02T00:00:00+08:00',notBefore:'2026-11-01T10:00:00+08:00',grains});
 assert.equal(r.windows.filter(w=>w.grain==='day').length,1);assert.equal(r.windows[0].period.start,'2026-10-31T16:00:00.000Z');assert.equal(r.windows.filter(w=>w.grain==='month').length,0);
 assert.deepEqual(planPeriodicRefresh({now:'2026-11-02T00:00:00+08:00',notBefore:'2026-11-02T00:00:00+08:00',grains}).windows,[]);
 const day=planPeriodicRefresh({now:'2026-11-02T00:00:00+08:00',notBefore:'2026-01-01T00:00:00+08:00',grains:['day'],lookbackHours:24});assert.equal(day.windows.length,1);
});
test('old/new historical revisions and adjacent cumulative intervals deduplicate with exact half-open boundaries',()=>{
 const affected=[{start:'2024-02-29T23:45:00+08:00',end:'2024-03-01T00:00:00+08:00'},{start:'2024-03-01T00:00:00+08:00',end:'2024-03-01T00:15:00+08:00'}];
 const r=planRevisionRefresh({affected:[...affected,...affected],grains});
 assert.equal(r.windows.filter(w=>w.grain==='day').length,2);assert.equal(r.windows.filter(w=>w.grain==='week').length,1);assert.equal(r.windows.filter(w=>w.grain==='month').length,2);
 assert.deepEqual(planRevisionRefresh({affected:[...affected].reverse(),grains:[...grains].reverse()}),planRevisionRefresh({affected,grains}));
 const end=planRevisionRefresh({affected:[affected[0]],grains});assert.equal(end.windows.filter(w=>w.grain==='day').length,1);assert.equal(end.windows.filter(w=>w.grain==='month').length,1);
 assert.deepEqual(planRevisionRefresh({affected:Array(10000).fill(affected[0]),grains,limit:3}),end);
});
test('calendar planning rejects naive timestamps, malformed ranges, duplicate grains and silent truncation',()=>{
 const base={now:'2026-11-02T00:00:00+08:00',notBefore:'2026-01-01T00:00:00+08:00',grains};
 for(const patch of [{now:'2026-11-02T00:00:00'},{lookbackHours:73},{lookbackHours:0},{limit:0},{limit:10001},{notBefore:'2026-11-03T00:00:00+08:00'},{grains:['day','day']},{grains:['hour']},{grains:[]}])assert.throws(()=>planPeriodicRefresh({...base,...patch} as Parameters<typeof planPeriodicRefresh>[0]));
 assert.throws(()=>planPeriodicRefresh({...base,limit:1}),/refresh_bound_exceeded/);
 assert.throws(()=>planRevisionRefresh({affected:[{start:'2024-01-01T00:00:00Z',end:'2026-01-01T00:00:00Z'}],grains,limit:2}),/refresh_bound_exceeded/);
 assert.throws(()=>planRevisionRefresh({affected:[{start:base.now,end:base.notBefore}],grains}));
 assert.deepEqual(planRevisionRefresh({affected:[],grains}).windows,[]);
});
