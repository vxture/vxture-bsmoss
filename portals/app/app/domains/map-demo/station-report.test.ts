import {test} from 'node:test';
import assert from 'node:assert/strict';
import {queryStationPeriod,queryStationReport} from './service.ts';
import {renderStationReport} from './station-report-html.ts';
import {evaluateWave} from './station-period-rules.ts';
import {waveLabel} from './station-period-display.ts';
const params=(s='')=>new URLSearchParams(s);
test('station report preserves the panel snapshot and deterministic scoped reference',()=>{
  for(const period of ['day','week','month']){
    const p=params('period='+period+'&cityId=610300'),r=queryStationReport('SX-DEMO-003',p)!;
    assert.deepEqual(r.analysis,queryStationPeriod('SX-DEMO-003',p));assert.equal(r.id,r.analysis.report!.id);
    assert.match(r.id,new RegExp('^DEMO-STATION-'+period.toUpperCase()+'-[a-f0-9]{20}$'));
    assert.equal(r.mode,'demo');assert.equal(r.status,'draft');
    assert.deepEqual(queryStationReport('SX-DEMO-003',params(p+'&hour=2&topic=power&bbox=105,32,106,33')),r);
    for(const suffix of ['&operator=mobile','&selection=circle:107.2,34.36,100000','&search=SX-DEMO-003']){
      const changed=queryStationReport('SX-DEMO-003',params(p+suffix))!;assert.ok(changed);assert.notEqual(changed.id,r.id);
    }
  }
  assert.notEqual(queryStationReport('SX-DEMO-001',params())!.id,queryStationReport('SX-DEMO-003',params())!.id);
  assert.equal(queryStationReport('SX-DEMO-003',params('cityId=610100')),null);
  for(const p of ['period=year','period=day&period=month','baseline=2026-10-01','date=2026-10-25','relativeBps=1','workspaceId=forged'])assert.throws(()=>queryStationReport('SX-DEMO-003',params(p)));
});
test('offline station HTML includes all waves beyond the panel top eight and exact hourly reference evidence',()=>{
  const r=queryStationReport('SX-DEMO-003',params('period=month'))!,html=renderStationReport(r);
  assert.equal((html.match(/<h2>/g)??[]).length,6);assert.equal((html.match(/<svg /g)??[]).length,3);
  assert.ok(r.analysis.findings.bytes.count>8);assert.ok(html.includes(r.id));assert.ok(html.includes(r.templateVersion));
  for(const h of r.analysis.hours)for(const metric of ['bytes','voiceSeconds','sms'] as const){
    const w=h.waves[metric];assert.ok(html.includes(w.references.join(' / ')));assert.ok(html.includes(h.baselineDates.join(' / ')));assert.ok(html.includes(w.current+' / '+w.referenceNumerator+' / '+w.deltaNumerator));
  }
  assert.ok(html.includes(r.analysis.changes.bytes.previous));assert.ok(html.includes(r.analysis.changes.bytes.delta!));
  assert.doesNotMatch(html,/<script|<link|<iframe|\son\w+=|https?:\/\/(?!www\.w3\.org\/2000\/svg)/i);
  assert.equal((html.match(/<details open>/g)??[]).length,4);
});
test('station HTML escapes names, scope and report identity, leaves operator energy unknown',()=>{
  const r=queryStationReport('SX-DEMO-006',params('operator=other'))!;
  r.analysis.site.name='<img src=x onerror=alert(1)>';r.scope.search='</p><script>alert(1)</script>';r.id='x"<&';
  const html=renderStationReport(r);assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));assert.ok(html.includes('&lt;/p&gt;&lt;script&gt;'));assert.ok(html.includes('x&quot;&lt;&amp;'));
  assert.doesNotMatch(html,/<script|<img/);assert.equal(r.analysis.usage.energyWh,null);assert.ok(r.analysis.hours.every(h=>h.energyWh===null));
});
test('offline wave labels distinguish zero and missing references without fabricated percentages',()=>{
  const zero=Array(4).fill('0');
  for(const w of [evaluateWave('20',zero,'1'),evaluateWave('0',zero,'1'),evaluateWave('20',[],'1')]){
    assert.equal(w.rate,null);assert.doesNotMatch(waveLabel(w),/NaN|Infinity|%/);
  }
  assert.notEqual(waveLabel(evaluateWave('20',zero,'1')),waveLabel(evaluateWave('0',zero,'1')));
});
