import {test} from 'node:test';
import assert from 'node:assert/strict';
import {queryOperatorUsage,parseMapQuery,queryMap} from './service.ts';
import {usageContextKey} from './operator-rules.ts';
const read=(s='')=>queryOperatorUsage(new URLSearchParams(s));

test('hour usage conserves business counters and agrees with the same map cohort',()=>{
  const params='cityId=610100&countyId=610113&selection=108.8,34.1,109.1,34.5&hour=18';
  const r=read(params),map=queryMap(parseMapQuery(new URLSearchParams(params)));
  assert.equal(r.physicalSites,map.summary.count);assert.ok(r.physicalSites>0);
  for(const key of ['bytes','voiceSeconds','sms','connectionRate','load'] as const)assert.equal(r.totals[key],map.summary[key]);
  assert.equal(r.energyWh,map.summary.energyWh);
  assert.deepEqual(r.checks,{bytesDelta:0,voiceSecondsDelta:0,smsDelta:0});
  assert.equal(r.totals.upBytes+r.totals.downBytes,r.totals.bytes);
  for(const key of ['bytes','voiceSeconds','sms'] as const)assert.equal(r.rows.reduce((n,row)=>n+row[key],0),r.totals[key]);
  assert.equal(r.series[18].rows.reduce((n,row)=>n+row.bytes,0),r.totals.bytes);
});
test('day counters are the sum of 24 hours while physical and service counts are not multiplied',()=>{
  const base='search=SX-DEMO-006',day=read(base+'&period=day'),hours=Array.from({length:24},(_,h)=>read(base+'&hour='+h));
  assert.equal(day.physicalSites,1);assert.equal(day.sharedSites,1);assert.equal(day.serviceRelations,5);assert.equal(day.samples,120);
  for(const key of ['bytes','voiceSeconds','sms','attempts','connected','used','capacity'] as const){
    assert.equal(day.totals[key],hours.reduce((n,h)=>n+h.totals[key],0));
    for(const row of day.rows)assert.equal(row[key],hours.reduce((n,h)=>n+h.rows.find(r=>r.code===row.code)![key],0));
  }
  assert.equal(day.energyWh,hours.reduce((n,h)=>n+h.energyWh!,0));
  assert.ok(day.rows.every(r=>r.sites===1&&r.samples===24));
});
test('ratios pool numerator and denominator rather than average operator percentages',()=>{
  const r=read('cityId=610100&hour=20&period=day');
  const sum=(key:'attempts'|'connected'|'used'|'capacity')=>r.rows.reduce((n,row)=>n+row[key],0);
  assert.equal(r.totals.connectionRate,sum('connected')/sum('attempts'));
  assert.equal(r.totals.load,sum('used')/sum('capacity'));
  assert.notEqual(r.totals.connectionRate,r.rows.reduce((n,row)=>n+row.connectionRate!,0)/r.rows.length);
  assert.notEqual(r.totals.load,r.rows.reduce((n,row)=>n+row.load!,0)/r.rows.length);
});
test('single operator scope equals its all-operator row and never allocates physical energy',()=>{
  const all=read('cityId=610100&period=day'),one=read('cityId=610100&period=day&operator=other');
  assert.equal(one.rows.length,1);assert.equal(one.rows[0].code,'other');assert.equal(one.energyWh,null);
  assert.deepEqual(one.rows[0],all.rows.find(r=>r.code==='other'));
  assert.equal(one.physicalSites,one.rows[0].sites);assert.equal(one.serviceRelations,one.physicalSites);
  assert.ok(one.series.every(h=>h.rows.length===1&&h.rows[0].code==='other'));
});
test('camera bounds do not affect analysis; city, county, search and selection remain intersected',()=>{
  const base='cityId=610100&countyId=610113&selection=108.8,34.1,109.1,34.5&period=day';
  assert.deepEqual(read(base),read(base+'&bbox=105,32,106,33'));
  const scoped=read(base+'&search=SX-DEMO-001&operator=mobile');assert.equal(scoped.physicalSites,1);
  assert.equal(read(base+'&search=SX-DEMO-004').physicalSites,0);
  assert.equal(read('cityId=610300&search=SX-DEMO-001').physicalSites,0);
});
test('empty scopes retain zero counters and unknown rates',()=>{
  const r=read('search=nonexistent&period=day');
  assert.equal(r.physicalSites,0);assert.equal(r.samples,0);assert.equal(r.energyWh,0);
  assert.equal(r.totals.connectionRate,null);assert.equal(r.totals.load,null);
  assert.ok(r.rows.every(row=>row.bytes===0&&row.connectionRate===null&&row.load===null));
  assert.ok(r.series.every(h=>h.rows.every(row=>row.bytes===0)));
});
test('half-open Shanghai windows cover midnight correctly; request boundaries reject forged values',()=>{
  const day=read('period=day'),last=read('hour=23');
  assert.equal(day.window.start,'2026-10-25T00:00:00+08:00');assert.equal(day.window.end,'2026-10-26T00:00:00+08:00');
  assert.equal(last.window.start,'2026-10-25T23:00:00+08:00');assert.equal(last.window.end,day.window.end);
  for(const params of ['period=week','period=','period=day&period=hour','workspaceId=forged','countyId=610113','hour=24','operator=forged'])assert.throws(()=>read(params));
  const q=parseMapQuery(new URLSearchParams());assert.notEqual(usageContextKey(q,'day'),usageContextKey(q,'hour'));
  assert.notEqual(usageContextKey(q,'day'),usageContextKey({...q,operator:'other'},'day'));
  assert.equal(usageContextKey(q,'day'),usageContextKey({...q,bbox:[105,32,106,33],topic:'power'},'day'));
});
