import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calendarSource,analyzeCalendarUsage} from './period-rules.ts';
import {HISTORY_START,HISTORY_END,dateNumber,yearBefore} from './history-calendar.ts';
import {historyWindow,previousHistoryWindow,analyzeHistory,historyChange} from './history-rules.ts';
import {parseHistoryQuery,queryHistory} from './history-service.ts';
import {DEMO_SITES} from './resources.ts';
const site=DEMO_SITES[5];
const scope=parseHistoryQuery({city:'all',county:'all'});

test('annual coverage has 24 complete months, complete quarter and explicit custom date validation',()=>{
  assert.equal(HISTORY_START,'2024-11-01');assert.equal(HISTORY_END,'2026-11-01');
  assert.deepEqual(scope.window,{start:'2025-11-01',end:'2026-11-01',days:365,grain:'month'});
  assert.equal(previousHistoryWindow(scope.window)?.start,HISTORY_START);
  assert.deepEqual(historyWindow({range:'quarter'}).window,{start:'2026-07-01',end:'2026-10-01',days:92,grain:'month'});
  assert.equal(historyWindow({range:'month',month:'2025-02'}).window.days,28);
  assert.equal(historyWindow({range:'custom',from:'2025-12-31',to:'2026-01-01'}).window.days,2);
  assert.equal(yearBefore('2024-02-29'),'2023-02-28');assert.ok(Number.isFinite(dateNumber('2024-02-29')));
  for(const input of [{range:'custom',from:'2025-02-29',to:'2025-03-01'},{range:'month',month:'2026-13'},{range:'custom',from:'2024-11-01',to:'2026-10-31'},
    {range:'custom',from:'2026-02-02',to:'2026-02-01'},{range:'month',month:'2026-11'},{range:'12m',month:'2026-01'}])assert.throws(()=>historyWindow(input));
});
test('optimized daily rollups equal hourly evidence at old, recent and anchor dates for every counter',()=>{
  for(const date of ['2024-11-01','2025-02-28','2025-12-31','2026-09-01','2026-10-25','2026-10-31']){
    const source=calendarSource(site);
    for(const row of source.daily(date)){
      for(const key of ['bytes','upBytes','downBytes','voiceSeconds','sms','attempts','connected','used','capacity'] as const){
        const expected=Array.from({length:24},(_,h)=>source.sample(date,h,row.code)[key]).reduce((a,b)=>a+b,0);
        assert.equal(row.counters[key],expected,date+'/'+row.code+'/'+key);assert.ok(Number.isSafeInteger(row.counters[key]));
      }
    }
  }
});
test('annual model conserves month, operator and child totals and matches existing calendar month exactly',()=>{
  const annual=analyzeHistory([site],scope),monthScope=parseHistoryQuery({range:'month',month:'2026-10'}),monthly=analyzeHistory([site],monthScope);
  const old=analyzeCalendarUsage([site],scope.query,'month');
  for(const key of ['bytes','voiceSeconds','sms'] as const){
    assert.equal(BigInt(annual.totals[key]),annual.series.reduce((n,r)=>n+BigInt(r[key]),0n));
    assert.equal(BigInt(annual.totals[key]),annual.operators.reduce((n,r)=>n+BigInt(r[key]),0n));
    assert.equal(BigInt(annual.totals[key]),annual.children.reduce((n,r)=>n+BigInt(r[key]),0n));
    assert.equal(BigInt(monthly.totals[key]),BigInt(old.totals[key]));
    assert.equal(BigInt(annual.series.find(r=>r.key==='2026-10')![key]),BigInt(monthly.totals[key]));
  }
  assert.equal(annual.series.length,12);assert.equal(monthly.series.length,31);assert.ok(annual.previous);assert.equal(annual.expectedSiteDays,365);
  assert.ok(new Set(annual.series.map(r=>Number(r.bytes)/new Date(Number(r.key.slice(0,4)),Number(r.key.slice(5,7)),0).getDate())).size>10);
});
test('service scopes enforce parent-child membership, single values and station identity',()=>{
  for(const input of [{city:'all',county:'610113'},{city:['610100']},{operator:'fake'},{range:'12m',unexpected:'x'},{site:'../file'}])assert.throws(()=>parseHistoryQuery(input));
  assert.throws(()=>queryHistory(parseHistoryQuery({city:'610200',site:site.id})));
  const county=queryHistory(parseHistoryQuery({city:site.cityId,county:site.countyId,range:'month',month:'2026-10',operator:'mobile'}));
  assert.equal(county.kind,'site');assert.ok(county.children.every(row=>DEMO_SITES.some(s=>s.id===row.id&&s.countyId===site.countyId)));
  assert.ok(county.operators.every(row=>row.code==='mobile'));
  const one=queryHistory(parseHistoryQuery({city:site.cityId,county:site.countyId,site:site.id,range:'month',month:'2026-10'}));
  assert.equal(one.kind,'operator');assert.equal(one.physicalSites,1);assert.equal(one.children.length,site.operators.length);
  const withoutOther=DEMO_SITES.find(s=>!s.operators.includes('other'))!;
  const inapplicable=queryHistory(parseHistoryQuery({site:withoutOther.id,operator:'other',range:'month',month:'2026-10'}));
  assert.equal(inapplicable.physicalSites,0);assert.equal(inapplicable.children.length,0);
});
test('unavailable baseline and zero baseline stay unknown; unequal periods retain daily normalized change',()=>{
  const old=analyzeHistory([site],parseHistoryQuery({range:'month',month:'2024-11'}));assert.equal(old.previous,null);
  assert.deepEqual(historyChange({bytes:'1',voiceSeconds:0,sms:0},null,'bytes',31,30),{delta:null,rate:null,dailyRate:null});
  const change=historyChange({bytes:'310',voiceSeconds:0,sms:0},{bytes:'300',voiceSeconds:0,sms:0},'bytes',31,30);
  assert.equal(change.delta,'10');assert.equal(change.dailyRate,0);
  assert.equal(historyChange({bytes:'1',voiceSeconds:0,sms:0},{bytes:'0',voiceSeconds:0,sms:0},'bytes',1,1).rate,null);
  const empty=analyzeHistory([],scope);assert.equal(empty.totals.bytes,'0');assert.equal(empty.series.length,12);assert.equal(empty.observedSiteDays,0);
});
test('province annual totals remain exact beyond 53 bits and equal the sum of regional rows',()=>{
  const before=performance.now(),annual=queryHistory(scope);
  assert.ok(BigInt(annual.totals.bytes)>BigInt(Number.MAX_SAFE_INTEGER));
  assert.equal(BigInt(annual.totals.bytes),annual.children.reduce((n,r)=>n+BigInt(r.bytes),0n));
  assert.equal(annual.physicalSites,1080);assert.equal(annual.children.length,10);
  assert.equal(JSON.parse(JSON.stringify(annual)).totals.bytes,annual.totals.bytes);
  const city=queryHistory(parseHistoryQuery({city:'610100'}));assert.equal(city.totals.bytes,annual.children.find(r=>r.id==='610100')!.bytes);
  assert.equal(city.totals.bytes,String(city.children.reduce((n,r)=>n+BigInt(r.bytes),0n)));
  console.info('history cold province and warm city ms:',Math.round(performance.now()-before));
});
