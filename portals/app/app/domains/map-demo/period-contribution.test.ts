import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildPeriodContribution,contributionCollector,BUSINESS_KEYS,type BusinessCounters} from './period-contribution-rules.ts';
import {analyzePeriodComparison,type PeriodComparison} from './period-comparison-rules.ts';
import {calendarWindow} from './period-rules.ts';
import {DEMO_SITES,DEMO_REGION} from './resources.ts';
import {siteHour} from './rules.ts';
import {parseMapQuery,queryPeriodComparison,queryDailyReport,queryCalendarReport} from './service.ts';
import {renderPeriodContribution} from './period-contribution-html.ts';
import type {DemoSite} from './types.ts';
const q=parseMapQuery(new URLSearchParams());
const counters=(v:bigint):BusinessCounters=>({bytes:v,voiceSeconds:v,sms:v});
function fixture(values:[bigint,bigint][],period:'day'|'month'='day') {
  const sites=values.map((_,i):DemoSite=>({...DEMO_SITES[0],id:'TEST-'+String(i).padStart(2,'0'),name:'Name '+i,cityId:i<4?'a':'b',countyId:'county-'+Math.floor(i/2)}));
  const current=new Map(sites.map((s,i)=>[s.id,counters(values[i][0])])),previous=new Map(sites.map((s,i)=>[s.id,counters(values[i][1])]));
  const c=String(values.reduce((n,v)=>n+v[0],0n)),p=String(values.reduce((n,v)=>n+v[1],0n));
  const comparison={comparable:true,current:{days:calendarWindow(period).dates.length},previous:{days:calendarWindow(period,'previous').dates.length},metrics:Object.fromEntries(BUSINESS_KEYS.map(k=>[k,{current:c,previous:p}]))} as PeriodComparison;
  return {sites,current,previous,comparison,result:buildPeriodContribution(sites,current,previous,comparison)};
}
test('opposing contributions stay finite when net is zero and add to whole-scope percentage points',()=>{
  const f=fixture([[150n,100n],[50n,100n]]),g=f.result.levels!.site.bytes;
  assert.equal(g.total.net,'0');assert.equal(g.total.positive,'50');assert.equal(g.total.negative,'-50');assert.equal(g.total.points,0);
  assert.equal(g.total.increase[0].points,25);assert.equal(g.total.decrease[0].points,-25);
  assert.equal(g.total.increased,1);assert.equal(g.total.decreased,1);assert.equal(g.total.unchanged,0);
});
test('daily contribution uses exact unequal-month rational scaling and may reverse total direction',()=>{
  const f=fixture([[305n,300n],[310n,300n]],'month'),g=f.result.levels!.site.bytes;
  assert.equal(g.total.increase.length,2);assert.equal(g.daily.increase.length,0);assert.equal(g.daily.decrease[0].id,'TEST-00');assert.equal(g.daily.unchanged,1);
  assert.equal(g.daily.denominator,930);assert.equal(g.daily.net,'-150');assert.equal(g.daily.points,-150/(600*31)*100);
});
test('top lists preserve exact tails, >53-bit sums and deterministic ties at every level',()=>{
  const big=9007199254740993n,f=fixture(Array.from({length:16},(_,i)=>[big+BigInt(i<8?100:-100),big]));
  for(const level of ['site','city','county'] as const)for(const key of BUSINESS_KEYS){
    const g=f.result.levels![level][key];assert.equal(g.ranking.length,Math.min(5,g.count));
    assert.equal(g.ranking.reduce((n,r)=>n+BigInt(r.current),BigInt(g.rankingRemainder)),big*16n);
    for(const v of [g.total,g.daily]){
      assert.equal(BigInt(v.positive)+BigInt(v.negative),BigInt(v.net));
      assert.equal(v.increase.reduce((n,r)=>n+BigInt(r.delta),BigInt(v.increaseRemainder)),BigInt(v.positive));
      assert.equal(v.decrease.reduce((n,r)=>n+BigInt(r.delta),BigInt(v.decreaseRemainder)),BigInt(v.negative));
      assert.equal(v.increased+v.decreased+v.unchanged,g.count);
    }
  }
  assert.equal(f.result.levels!.site.bytes.ranking[0].id,'TEST-00');assert.equal(f.result.levels!.site.bytes.total.increaseRemainder,'300');
});
test('zero baseline and zero business keep contribution points and shares undefined',()=>{
  for(const values of [[[10n,0n],[0n,0n]],[[0n,0n],[0n,0n]]] as [bigint,bigint][][]){
    const g=fixture(values).result.levels!.site.bytes;assert.equal(g.total.points,null);assert.ok(g.ranking.every(r=>r.points===null));
    if(values[0][0]===0n)assert.ok(g.ranking.every(r=>r.share===null));
    assert.ok(!/NaN|Infinity/.test(JSON.stringify(g)));
  }
});
test('mismatched site evidence or aggregate counters suppresses all contribution output',()=>{
  const f=fixture([[10n,1n],[20n,2n]]);
  const build=()=>buildPeriodContribution(f.sites,f.current,f.previous,f.comparison);
  f.current.get('TEST-00')!.bytes++;assert.equal(build().status,'evidence_mismatch');assert.equal(build().levels,null);
  f.current.delete('TEST-00');assert.equal(build().status,'evidence_mismatch');
  assert.equal(buildPeriodContribution([...f.sites,f.sites[0]],f.current,f.previous,f.comparison).status,'evidence_mismatch');
  f.comparison.comparable=false;assert.equal(build().status,'unavailable');
});
test('collector rejects invalid observations without touching source metrics',()=>{
  const s=DEMO_SITES[0],collector=contributionCollector([s]),m=siteHour(s,18),copy=structuredClone(m);collector.observe(s,m);assert.deepEqual(m,copy);assert.equal(collector.counters.get(s.id)!.bytes,BigInt(m.bytes));
  assert.throws(()=>collector.observe({...s,id:'missing'},m));assert.throws(()=>collector.observe(s,{...m,bytes:Number.MAX_SAFE_INTEGER+1}));
});
test('dated source samples reconcile at site, county and city for all three business metrics',()=>{
  const sites=DEMO_SITES.slice(0,6),r=analyzePeriodComparison(sites,q,'month',undefined,undefined,DEMO_REGION);
  assert.equal(r.contribution!.status,'matched');
  for(const level of ['city','county','site'] as const)for(const key of BUSINESS_KEYS){
    const g=r.contribution!.levels![level][key];assert.equal(g.total.net,r.metrics[key].delta);
    assert.equal(g.ranking.reduce((n,v)=>n+BigInt(v.current),BigInt(g.rankingRemainder)),BigInt(r.metrics[key].current));
    assert.ok(Math.abs(g.daily.points!-r.metrics[key].dailyRate!*100)<1e-10);
  }
  assert.ok(r.contribution!.levels!.city.bytes.ranking.every(r=>DEMO_REGION.cities.some(c=>c.name===r.name)));
});
test('day/week/month reports reuse the identical scoped contribution and preserve null operator energy',()=>{
  const scope='cityId=610100&countyId=610113&operator=other&search=SX-DEMO-006&selection=circle:108.953,34.231,5000';
  for(const period of ['day','week','month'] as const){
    const r=queryPeriodComparison(new URLSearchParams(scope+'&period='+period)),report=period==='day'?queryDailyReport(new URLSearchParams(scope)):queryCalendarReport(new URLSearchParams(scope+'&period='+period));
    assert.equal(r.current.physicalSites,1);assert.equal(r.energy,null);assert.equal(r.contribution!.levels!.site.bytes.count,1);assert.deepEqual(report.comparison,r);
    assert.deepEqual(queryPeriodComparison(new URLSearchParams(scope+'&period='+period+'&bbox=105,32,106,33&hour=1&topic=power')),r);
  }
});
test('offline contribution includes both bases, tails, raw evidence and escapes site names',()=>{
  const r=queryPeriodComparison(new URLSearchParams('period=day&search=SX-DEMO-006')),html=renderPeriodContribution(r);
  assert.ok(html.includes(r.contribution!.version));assert.ok(html.includes(r.metrics.bytes.previous));assert.ok(html.includes('denominator 1'));
  r.contribution!.levels!.site.bytes.ranking[0].name='<script>alert(1)</script>';assert.ok(renderPeriodContribution(r).includes('&lt;script&gt;'));assert.ok(!renderPeriodContribution(r).includes('<script>'));
});
