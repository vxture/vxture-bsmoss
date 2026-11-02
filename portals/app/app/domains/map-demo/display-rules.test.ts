import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaultDisplay,resolveDisplay,reorder,displayedTopicPoints,summaryValue} from './display-rules.ts';
import {parseMapQuery,queryMap} from './service.ts';
import {useWorkbench} from './workbench-store.ts';
const snapshot=(params='')=>queryMap(parseMapQuery(new URLSearchParams(params)));

test('display preferences sanitize storage, retain valid order, limit metrics and ignore data-policy fields',()=>{
  for(const v of [null,[],true,'bad',{version:2},{version:'1'}])assert.deepEqual(resolveDisplay(v),defaultDisplay());
  const p=resolveDisplay({version:1,metrics:['voice','energy','voice','forged','sms','traffic'],topics:{capacity:{mapScope:'attention',sections:['priority','trend','priority','forged'],limit:6,evidence:false,threshold:0},power:{mapScope:'forged',sections:'forged',limit:999,evidence:'false'}},permissions:['*'],hour:3});
  assert.deepEqual(p.metrics,['voice','energy','sms']);
  assert.deepEqual(p.topics.capacity,{mapScope:'attention',sections:['priority','trend'],limit:6,evidence:false});
  assert.deepEqual(p.topics.power,defaultDisplay().topics.power);assert.deepEqual(Object.keys(p),['version','metrics','topics']);
  assert.deepEqual(resolveDisplay({version:1,metrics:[]}).metrics,defaultDisplay().metrics);
  assert.deepEqual(resolveDisplay({version:1,topics:{capacity:{sections:[]}}}).topics.capacity.sections,[]);
});

test('topic defaults and restored arrays are independent across topics and caller objects',()=>{
  const a=defaultDisplay(),b=defaultDisplay();a.topics.capacity.sections.pop();a.metrics.reverse();
  assert.deepEqual(a.topics.power.sections,b.topics.power.sections);assert.equal(b.topics.capacity.sections.length,3);
  const raw={version:1,metrics:['voice'],topics:{power:{sections:['priority']}}};
  const parsed=resolveDisplay(raw);raw.metrics.push('sms');raw.topics.power.sections.push('cities');
  assert.deepEqual(parsed.metrics,['voice']);assert.deepEqual(parsed.topics.power.sections,['priority']);
});

test('reordering preserves enabled items without mutation and handles boundaries',()=>{
  const input=['traffic','energy','voice'];
  assert.deepEqual(reorder(input,'energy',-1),['energy','traffic','voice']);
  assert.deepEqual(reorder(input,'energy',1),['traffic','voice','energy']);
  for(const [key,direction] of [['traffic',-1],['voice',1],['missing',1]] as const)assert.deepEqual(reorder(input,key,direction),input);
  assert.deepEqual(input,['traffic','energy','voice']);
});

test('attention map retains unknown stations, rebuilds point membership only and leaves full analysis intact',()=>{
  const r=snapshot('topic=capacity&hour=18&cityId=610100'),before=structuredClone(r);
  const points=displayedTopicPoints(r.points,'attention');
  assert.ok(points.length>0&&points.length<r.points.length);
  assert.ok(points.every(p=>p.topicLevel==='critical'||p.topicLevel==='warning'||p.topicLevel==='unknown'));
  assert.equal(points.length,r.topic!.counts.critical+r.topic!.counts.warning+r.topic!.counts.unknown);
  assert.deepEqual(r,before);assert.deepEqual(displayedTopicPoints(r.points,'all'),r.points);
  const unknown=snapshot('topic=efficiency&operator=mobile');
  assert.equal(displayedTopicPoints(unknown.points,'attention').length,unknown.summary.count);
  const calm=snapshot('topic=power&hour=0');assert.equal(displayedTopicPoints(calm.points,'attention').length,0);assert.equal(calm.topic!.counts.total,1080);
});

test('summary display converts source counters without replacing unknowns with zero or averaging ratios',()=>{
  const s=snapshot().summary;
  assert.equal(summaryValue('traffic',s).value,s.bytes/1073741824/1024);
  assert.equal(summaryValue('voice',s).value,s.voiceSeconds/3600);assert.equal(summaryValue('sms',s).value,s.sms);
  assert.equal(summaryValue('load',s).value,s.load!*100);assert.equal(summaryValue('connection',s).value,s.connectionRate!*100);
  assert.equal(summaryValue('energy',s).value,s.energyWh!/1000000);
  const op=snapshot('operator=mobile').summary;assert.equal(summaryValue('energy',op).value,null);
  const empty=snapshot('selection=105,32,105.01,32.01').summary;
  assert.equal(summaryValue('connection',empty).value,null);assert.equal(summaryValue('load',empty).value,null);assert.equal(summaryValue('sms',empty).value,0);
});

test('display store updates retain topic scope, geometry, comparison pins and source query results',()=>{
  const state=()=>useWorkbench.getState();
  state().set({cityId:'610100',countyId:'610113',selection:[108.8,34.1,109.1,34.5],compareIds:['a','b'],operator:'mobile',hour:12,topic:'efficiency',topicOpen:true});
  const p=defaultDisplay();p.topics.efficiency={mapScope:'attention',sections:['priority'],evidence:false,limit:6};p.metrics=['voice','sms'];state().set({display:p});
  assert.equal(state().topic,'efficiency');assert.ok(state().topicOpen);assert.equal(state().hour,12);assert.equal(state().operator,'mobile');
  assert.deepEqual(state().selection,[108.8,34.1,109.1,34.5]);assert.deepEqual(state().compareIds,['a','b']);
  state().set({topic:'power'});assert.deepEqual(state().display.topics.power,defaultDisplay().topics.power);
  assert.equal(state().display.topics.efficiency.limit,6);state().set({cityId:'610300',selectedId:null});assert.deepEqual(state().display.metrics,['voice','sms']);
  p.metrics.push('load');assert.deepEqual(state().display.metrics,['voice','sms']);
  assert.throws(()=>parseMapQuery(new URLSearchParams('topic=power&mapScope=attention')));
});
