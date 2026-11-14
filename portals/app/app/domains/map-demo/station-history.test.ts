import {test} from 'node:test';
import assert from 'node:assert/strict';
import {peerPortrait,stationDayEvidence,HISTORY_METRICS} from './station-history-rules.ts';
import {stationEvidence,stationHistory} from './station-history-service.ts';
import {parseHistoryQuery,queryHistory} from './history-service.ts';
import {calendarSource,CALENDAR_RULE_VERSION} from './period-rules.ts';
import {analyzeStationPeriod} from './station-period-rules.ts';
import {DEMO_SITES} from './resources.ts';
import {historyHref,historyEvidenceHref} from '../../analysis/history-links.ts';
import {changedRegionHref} from '../../portal/region-scope.ts';
import {syntheticSharing,syntheticSiteType} from './site-attributes.ts';
const site=DEMO_SITES[0],input={site:site.id,city:site.cityId,county:site.countyId,range:'month',month:'2026-10',evidence:'2026-10-25',slot:'18'};
const values=(n:number)=>({bytes:String(n),voiceSeconds:n,sms:n});

test('portrait excludes the subject, uses midrank ties and leaves insufficient or zero-median comparisons unknown',()=>{
  const q=parseHistoryQuery(input),analysis=queryHistory(q);
  const fixture={...analysis,siteRows:[{id:site.id,values:values(20),previous:null},...['a','b','c'].map((id,i)=>({id,values:values(i*10+10),previous:null}))]};
  const p=peerPortrait(fixture,values(20),site.id);
  assert.equal(p.count,3);assert.equal(p.metrics[0].percentile,.5);assert.equal(p.metrics[0].gap,0);
  const few=peerPortrait({...fixture,siteRows:fixture.siteRows.slice(0,3)},values(20),site.id);
  assert.equal(few.count,2);assert.equal(few.metrics[0].median,null);assert.equal(few.metrics[0].percentile,null);
  const zero=peerPortrait({...fixture,siteRows:fixture.siteRows.map(r=>({...r,values:values(0)}))},values(20),site.id);
  assert.equal(zero.metrics[0].median,0);assert.equal(zero.metrics[0].gap,null);
});
test('peer service respects explicit region, operator and same-resource cohort without silently broadening',()=>{
  const q=parseHistoryQuery(input),a=queryHistory(q),s=stationHistory(q,a)!;
  const expected=DEMO_SITES.filter(r=>r.id!==site.id&&r.countyId===site.countyId&&r.profile===site.profile&&syntheticSiteType(r)===syntheticSiteType(site)&&syntheticSharing(r)===syntheticSharing(site));
  assert.equal(s.portrait.count,expected.length);assert.equal(s.peerScope.countyId,site.countyId);
  const province={...q,peerLevel:'province' as const},p=stationHistory(province,a)!;
  assert.equal(p.peerScope.cityId,'all');assert.ok(p.portrait.count>=s.portrait.count);
  const city=stationHistory({...q,peerLevel:'city'},a)!;assert.equal(city.peerScope.cityId,site.cityId);assert.equal(city.peerScope.countyId,'all');
  const impossible=parseHistoryQuery({...input,scene:'mountain'});assert.equal(stationHistory(impossible,queryHistory(impossible)),null);assert.equal(stationEvidence(impossible),null);
});
test('hourly evidence conserves all three counters, service relations and daily history including legacy period waves',()=>{
  const q=parseHistoryQuery(input),e=stationEvidence(q)!,source=calendarSource(site),legacy=analyzeStationPeriod(site,q.query,'day');
  assert.equal(e.sourceVersion,CALENDAR_RULE_VERSION);assert.equal(e.services.length,site.operators.length);
  for(const metric of HISTORY_METRICS) {
    assert.equal(BigInt(e.totals[metric]),e.hours.reduce((n,h)=>n+BigInt(h.values[metric]),0n));
    const daily=source.daily(e.date).reduce((n,r)=>n+BigInt(r.counters[metric]),0n);assert.equal(BigInt(e.totals[metric]),daily);
    assert.equal(BigInt(e.totals[metric]),BigInt(legacy.usage.totals[metric]));
  }
  for(const s of e.services){assert.deepEqual(s.hours[18].wave,stationDayEvidence(site,e.date,s.code,'bytes').services[0].hours[18].wave);assert.ok(s.findings.every(f=>f.windows.every(w=>w.eventId.includes('/'+s.code+'/'))));}
  const aggregate=stationDayEvidence(site,e.date,'all','bytes');
  const raw=aggregate.services.reduce((n,s)=>n+BigInt(s.hours[18].values.bytes),0n);assert.equal(raw,BigInt(source.sample(e.date,18,'all').bytes));
});
test('early history retains all four reference slots, requires three available samples and never backfills outside coverage',()=>{
  const first=stationDayEvidence(site,'2024-11-01','mobile','bytes');
  assert.ok(first.services[0].hours.every(h=>h.references.every(r=>r.value===null&&!r.complete)&&h.wave.status==='insufficient'));
  assert.equal(first.findings.length,24);assert.ok(first.findings.every(f=>f.category==='insufficient'));
  const two=stationDayEvidence(site,'2024-11-15','mobile','bytes');assert.equal(two.services[0].hours[0].wave.status,'insufficient');
  const three=stationDayEvidence(site,'2024-11-22','mobile','bytes');assert.equal(three.services[0].hours[0].wave.references.length,3);assert.notEqual(three.services[0].hours[0].wave.status,'insufficient');assert.equal(three.services[0].hours[0].references[3].value,null);
});
test('day evidence digest binds source, service scope, metric and date while hour selection reopens the same immutable day',()=>{
  const q=parseHistoryQuery(input),a=stationEvidence(q)!,b=stationEvidence({...q,slot:0})!;
  assert.equal(a.evidenceDigest,b.evidenceDigest);assert.equal(b.slot,0);assert.notEqual(a.evidenceDigest,stationEvidence({...q,query:{...q.query,operator:'mobile'}})!.evidenceDigest);
  assert.notEqual(a.evidenceDigest,stationEvidence({...q,metric:'sms'})!.evidenceDigest);assert.notEqual(a.evidenceDigest,stationEvidence({...q,evidence:'2026-10-24'})!.evidenceDigest);
  assert.match(a.referenceId,/^HE-[a-f0-9]{24}$/);assert.ok(a.selected.every(s=>s.hour===18));assert.equal(a.revision,1);
});
test('station evidence rejects forged scope and invalid dates or hours, with no evidence for excluded services',()=>{
  for(const patch of [{evidence:'2026-09-30'},{evidence:'2026-11-01'},{evidence:'2026-02-30'},{slot:'24'},{slot:'-1'},{slot:'1.5'},{slot:['1','2']},{peerLevel:'world'},{workspaceId:'forged'}])assert.throws(()=>parseHistoryQuery({...input,...patch}));
  assert.throws(()=>parseHistoryQuery({evidence:'2026-10-25'}));assert.throws(()=>parseHistoryQuery({slot:'1'}));assert.throws(()=>stationEvidence(parseHistoryQuery({})));
  assert.throws(()=>stationEvidence(parseHistoryQuery({...input,city:'610300',county:'all'})));
  const unsupported=DEMO_SITES.find(s=>!s.operators.includes('other'))!;
  assert.equal(stationEvidence(parseHistoryQuery({...input,site:unsupported.id,city:unsupported.cityId,county:unsupported.countyId,operator:'other'})),null);
});
test('analysis/evidence round trips retain historical context and discard stale station date/hour on scope changes',()=>{
  const q=parseHistoryQuery({...input,peerLevel:'province',metric:'sms',view:'operators',scene:site.profile});
  const href=historyEvidenceHref(q),p=new URL(href,'http://localhost').searchParams;
  assert.equal(href.split('?')[0],'/usage-review/history');const again=parseHistoryQuery(Object.fromEntries(p));assert.deepEqual(again,q);
  assert.equal(historyHref(again),historyHref(q));
  for(const patch of [{site:undefined},{range:'12m'},{range:'month',month:'2026-09'},{site:DEMO_SITES[1].id}]){
    const next=new URL(historyHref(q,patch),'http://localhost');assert.equal(next.searchParams.has('evidence'),false);assert.equal(next.searchParams.has('slot'),false);
  }
  const region=changedRegionHref('/analysis',p.toString(),{cityId:'610300',countyId:'all'});
  assert.ok(!region.includes('site='));assert.ok(!region.includes('evidence='));assert.ok(!region.includes('slot='));assert.ok(!region.includes('peerLevel='));
});
