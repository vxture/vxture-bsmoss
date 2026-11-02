import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analyzeTopic,evaluateTopic,parseTopic,TOPIC_KINDS,TOPIC_POLICY} from './topic-rules.ts';
import {DEMO_SITES} from './resources.ts';
import {GIB,siteHour} from './rules.ts';
import {parseMapQuery,queryMap} from './service.ts';
import {inBounds,inSelection,mapContextKey} from './geometry.ts';
import type {HourMetrics} from './types.ts';
const query=(s='')=>parseMapQuery(new URLSearchParams(s));
const metrics=(patch:Partial<HourMetrics>={})=>({...siteHour(DEMO_SITES[0],0),capacity:10000,used:1000,attempts:10000,connected:9900,...patch});

test('capacity observations use exact boundaries, denominator unknowns and known failure precedence',()=>{
  for(const [used,connected,level] of [[8499,9800,'normal'],[8500,9800,'warning'],[9499,9800,'warning'],[9500,9900,'critical'],[1000,9799,'warning'],[1000,9500,'warning'],[1000,9499,'critical']] as const){
    assert.equal(evaluateTopic('capacity',metrics({used,connected})).level,level);
  }
  assert.deepEqual(evaluateTopic('capacity',metrics({capacity:0,attempts:0})),{level:'unknown',value:null,secondary:null});
  assert.equal(evaluateTopic('capacity',metrics({capacity:0})).level,'unknown');
  assert.equal(evaluateTopic('capacity',metrics({used:8500,attempts:0})).level,'warning');
  assert.equal(evaluateTopic('capacity',metrics({capacity:0,connected:9400})).level,'critical');
});

test('power observations retain physical supply and temperature without inferring battery duration',()=>{
  assert.equal(evaluateTopic('power',metrics({power:'mains',temperature:34.9})).level,'normal');
  assert.equal(evaluateTopic('power',metrics({temperature:35})).level,'warning');
  assert.equal(evaluateTopic('power',metrics({temperature:39.9})).level,'warning');
  assert.equal(evaluateTopic('power',metrics({temperature:40})).level,'critical');
  assert.deepEqual(evaluateTopic('power',metrics({power:'battery',temperature:25})),{level:'critical',value:1,secondary:25});
});

test('efficiency uses physical kWh per GiB with no zero substitution or operator energy allocation',()=>{
  for(const [energyWh,level] of [[149,'normal'],[150,'warning'],[299,'warning'],[300,'critical']] as const){
    const signal=evaluateTopic('efficiency',metrics({bytes:GIB,energyWh}));
    assert.equal(signal.level,level);assert.equal(signal.value,energyWh/1000);
  }
  assert.deepEqual(evaluateTopic('efficiency',metrics({energyWh:null})),{level:'unknown',value:null,secondary:null});
  assert.equal(evaluateTopic('efficiency',metrics({bytes:0})).level,'unknown');
  assert.equal(evaluateTopic('efficiency',metrics({bytes:GIB,energyWh:0})).value,0);
  const op=queryMap(query('topic=efficiency&operator=mobile'));
  assert.equal(op.topic!.counts.unknown,op.summary.count);assert.equal(op.topic!.priority.length,0);
  assert.ok(op.topic!.series.every(h=>h.unknown===h.total));assert.ok(op.points.every(p=>p.topicLevel==='unknown'));
});

test('topic counts conserve physical stations and recompute each hour across the same cohort',()=>{
  for(const kind of TOPIC_KINDS){
    const q=query('topic='+kind+'&hour=12'),r=queryMap(q),topic=r.topic!;
    assert.equal(topic.policyVersion,TOPIC_POLICY);assert.equal(topic.counts.total,1080);
    assert.equal(topic.counts.total,topic.counts.normal+topic.counts.warning+topic.counts.critical+topic.counts.unknown);
    for(const key of ['total','normal','warning','critical','unknown'] as const)assert.equal(topic.cities.reduce((v,c)=>v+c[key],0),topic.counts[key]);
    assert.equal(topic.series.length,24);
    for(const h of topic.series){
      assert.equal(h.total,1080);assert.equal(h.normal+h.warning+h.critical+h.unknown,h.total);
      assert.deepEqual(queryMap({...q,hour:h.hour}).topic!.counts,{total:h.total,normal:h.normal,warning:h.warning,critical:h.critical,unknown:h.unknown});
    }
    for(const p of r.points)assert.equal(p.topicLevel,evaluateTopic(kind,siteHour(DEMO_SITES.find(s=>s.id===p.id)!,12)).level);
  }
  const power=queryMap(query('topic=power&hour=12')).topic!;
  assert.ok(power.counts.critical>0);assert.equal(power.series[10].critical,0);assert.equal(power.series[14].critical,0);
  const urban=DEMO_SITES.find(s=>s.id==='SX-DEMO-001')!;
  assert.equal(evaluateTopic('capacity',siteHour(urban,12)).level,'normal');
  assert.equal(evaluateTopic('capacity',siteHour(urban,18)).level,'warning');
  assert.equal(evaluateTopic('power',siteHour(DEMO_SITES.find(s=>s.id==='SX-DEMO-004')!,12,'mobile')).level,'critical');
});

test('topic scope intersects county, selection, operator and search, while bbox never changes analysis',()=>{
  const params='topic=capacity&cityId=610100&countyId=610113&selection=108.8,34.1,109.1,34.5&operator=mobile&hour=18';
  const q=query(params),r=queryMap(q),expected=DEMO_SITES.filter(s=>s.cityId===q.cityId&&s.countyId===q.countyId&&s.operators.includes('mobile')&&inSelection(s.lng,s.lat,q.selection!));
  assert.ok(expected.length>0&&expected.length<240);assert.equal(r.topic!.counts.total,expected.length);
  assert.equal(r.topic!.counts.total,r.summary.count);
  assert.equal(r.topic!.affectedBytes,expected.reduce((v,s)=>{const m=siteHour(s,18,'mobile'),signal=evaluateTopic('capacity',m);return v+(['warning','critical'].includes(signal.level)?m.bytes:0);},0));
  const moved=queryMap(query(params+'&bbox=105,32,106,33'));
  assert.equal(moved.points.length,0);assert.deepEqual(moved.topic,r.topic);assert.equal(moved.contextKey,r.contextKey);
  const searched=queryMap(query(params+'&search=SX-DEMO-001'));
  assert.equal(searched.topic!.counts.total,1);assert.equal(searched.points[0].id,'SX-DEMO-001');
  const empty=queryMap(query('topic=power&selection=105,32,105.01,32.01'));
  assert.equal(empty.topic!.counts.total,0);assert.equal(empty.topic!.priority.length,0);assert.equal(empty.topic!.cities.length,0);
  assert.ok(empty.topic!.series.every(h=>h.total===0));
});

test('priority is deterministic, limited, affected-only and never counts its traffic as lost traffic',()=>{
  const q=query('topic=capacity&hour=20');
  const a=analyzeTopic(DEMO_SITES,q,'capacity'),b=analyzeTopic([...DEMO_SITES].reverse(),q,'capacity');
  assert.deepEqual(a.priority,b.priority);assert.equal(a.priority.length,6);
  assert.ok(a.priority.every(p=>p.level==='critical'||p.level==='warning'));
  let warnings=false;for(const p of a.priority){if(p.level==='warning')warnings=true;else assert.ok(!warnings);}
  assert.ok(a.affectedBytes>0&&a.affectedBytes<=queryMap(q).summary.bytes);
});

test('topic query is optional, strict and part of snapshot identity',()=>{
  assert.equal(queryMap(query()).topic,null);
  for(const value of ['','CAPACITY','unknown','__proto__']){assert.throws(()=>parseTopic(value));assert.throws(()=>query('topic='+value));}
  assert.throws(()=>query('topic=power&topic=capacity'));
  assert.notEqual(mapContextKey(query()),mapContextKey(query('topic=power')));
  assert.notEqual(mapContextKey(query('topic=power')),mapContextKey(query('topic=efficiency')));
});
