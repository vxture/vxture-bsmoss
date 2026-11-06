import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analyzeCapacity,capacityObservation,summarizeCapacity,capacityShares} from './capacity-rules';
import {DEMO_SITES} from './resources';
import {siteHour} from './rules';
import {parseMapQuery,selectSites,queryMap} from './service';
import {businessDemo,parseBusinessQuery} from '../../business-analysis/model';
import type {HourMetrics} from './types';
const query=(p='')=>parseMapQuery(new URLSearchParams('topic=capacity&'+p));
const counterKeys=['used','capacity','attempts','connected','failed'] as const;
const metric=(patch:Partial<HourMetrics>)=>({...siteHour(DEMO_SITES[0],18),...patch});

test('capacity ratios weight integer counters; failure reasons overlap and unknown coverage stays separate',()=>{
 const a=metric({capacity:100,used:90,attempts:100,connected:94}),b=metric({capacity:900,used:90,attempts:900,connected:900});
 const result=summarizeCapacity([a,b]);
 assert.equal(result.load,0.18);assert.equal(result.connection,0.994);assert.equal(result.failed,6);
 assert.equal(result.attention,1);assert.equal(result.highLoad,1);assert.equal(result.lowConnection,1);assert.equal(result.both,1);
 const partial=summarizeCapacity([metric({capacity:0,used:0,attempts:100,connected:94}),metric({capacity:100,used:10,attempts:0,connected:0})]);
 assert.equal(partial.capacityKnown,1);assert.equal(partial.connectionKnown,1);assert.equal(partial.attention,1);assert.equal(partial.unknown,1);
 assert.equal(capacityObservation({used:0,capacity:0,attempts:0,connected:0}).connection,null);
 assert.equal(capacityObservation({used:0,capacity:0,attempts:0,connected:0}).load,null);
 assert.equal(capacityObservation({used:85,capacity:100,attempts:100,connected:98}).highLoad,true);
 assert.equal(capacityObservation({used:10,capacity:100,attempts:100,connected:98}).lowConnection,false);
});

test('regional and operator counters conserve totals without adding shared physical station counts',()=>{
 const q=query('hour=20'),data=analyzeCapacity(DEMO_SITES,q);
 assert.equal(data.total.sites,1080);assert.equal(data.regionLevel,'city');
 assert.equal(data.operators.reduce((v,r)=>v+r.sites,0),3902);
 for(const rows of [data.regions,data.operators]){
  for(const key of counterKeys)assert.equal(rows.reduce((v,r)=>v+r[key],0),data.total[key],key);
  assert.ok(Math.abs(rows.reduce((v,r)=>v+r.usedShare!,0)-1)<1e-12);
  assert.ok(Math.abs(rows.reduce((v,r)=>v+r.failedShare!,0)-1)<1e-12);
 }
 assert.equal(data.regions.reduce((v,r)=>v+r.attention,0),data.total.attention);
 assert.ok(data.operators.reduce((v,r)=>v+r.attention,0)>=data.total.attention);
});

test('scope intersections and hierarchical region grouping reuse the full map cohort and strict query',()=>{
 const inputs=[{city:'610100',hour:'12'},{city:'610100',county:'610113',operator:'mobile',hour:'18'},
  {city:'610100',selection:'108.8,34.1,109.1,34.5',operator:'telecom',search:'SX-DEMO',hour:'20'},{search:'not-found'}];
 for(const input of inputs){
  const d=businessDemo('capacity',input),c=d.capacity!,q=parseBusinessQuery('capacity',input).query,sites=selectSites(q),map=queryMap(q);
  assert.equal(c.total.sites,sites.length);assert.equal(c.total.sites,map.summary.count);
  assert.equal(c.total.attention,map.topic!.counts.warning+map.topic!.counts.critical);
  assert.equal(c.total.load,map.summary.load);assert.equal(c.total.connection,map.summary.connectionRate);
  assert.equal(c.regions.reduce((v,r)=>v+r.sites,0),c.total.sites);
  if(q.operator!=='all')assert.ok(c.operators.every(r=>r.code===q.operator));
 }
 assert.equal(businessDemo('capacity',{city:'610100'}).capacity!.regionLevel,'county');
 assert.equal(businessDemo('capacity',{city:'610100',county:'610113'}).capacity!.regionLevel,'current');
 assert.equal(businessDemo('efficiency',{}).capacity,null);
 assert.throws(()=>businessDemo('capacity',{capacity:'forged'}));
});

test('all 24 samples recompute exact ratios and counts; priority evidence matches current map sorting',()=>{
 const q=query('hour=12&operator=mobile'),data=analyzeCapacity(DEMO_SITES,q),map=queryMap(q);
 assert.deepEqual(data.priority.map(p=>p.id),map.topic!.priority.map(p=>p.id));
 for(const row of data.series){
  const expected=queryMap({...q,hour:row.hour}).summary;
  assert.equal(row.load,expected.load);assert.equal(row.connection,expected.connectionRate);
  assert.equal(row.attention,map.topic!.series[row.hour].critical+map.topic!.series[row.hour].warning);
 }
 for(const p of data.priority){const s=DEMO_SITES.find(s=>s.id===p.id)!;
  assert.equal(p.series.length,24);assert.deepEqual(p.current,p.series[12]);
  for(const row of p.series){const m=siteHour(s,row.hour,'mobile');for(const key of ['used','capacity','attempts','connected'] as const)assert.equal(row[key],m[key]);assert.equal(row.failed,m.attempts-m.connected);}
 }
 assert.deepEqual(analyzeCapacity([...DEMO_SITES].reverse(),q).priority,data.priority);
});

test('empty cohorts and zero-failure slices retain unknown denominators instead of invented shares',()=>{
 const data=analyzeCapacity([],query());
 assert.equal(data.total.load,null);assert.equal(data.total.connection,null);assert.equal(data.total.failed,0);
 assert.equal(data.priority.length,0);assert.equal(data.regions.length,0);assert.equal(data.operators.length,0);
 assert.ok(data.series.every(s=>s.load===null&&s.connection===null&&s.attention===0));
 const noFailure=summarizeCapacity([metric({attempts:1,connected:1,used:0,capacity:100})]);assert.equal(noFailure.failed,0);
 assert.equal(noFailure.connection,1);assert.equal(noFailure.load,0);
 assert.deepEqual(capacityShares(noFailure,noFailure),{usedShare:null,failedShare:null});
});
