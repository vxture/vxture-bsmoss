import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analyzeCohorts,contribution,growthBand,sumHistory} from './cohort-rules.ts';
import {parseHistoryQuery,queryHistory} from './history-service.ts';
import {analyzeHistory,type HistoryScope} from './history-rules.ts';
import {DEMO_SITES} from './resources.ts';
import {syntheticSharing,syntheticSiteType} from './site-attributes.ts';
import {historyModel} from '../../analysis/history-model.ts';
const value=(bytes:string|number)=>({bytes:String(bytes),voiceSeconds:Number(bytes),sms:Number(bytes)});
const q=parseHistoryQuery({range:'month',month:'2026-10',city:'610100',county:'610113',view:'cohorts'});
test('operator contributions preserve cancellation, negative sign, shares and zero-baseline unknown',()=>{
  const total=value(200),previous=value(200);
  const a=contribution(value(130),value(100),total,previous,'bytes'),b=contribution(value(70),value(100),total,previous,'bytes');
  assert.equal(a.growthPoints,15);assert.equal(b.growthPoints,-15);assert.equal(a.growthPoints!+b.growthPoints!,0);
  assert.ok(Math.abs(a.shareShift!-15)<1e-12);assert.ok(Math.abs(b.shareShift!+15)<1e-12);
  assert.equal(contribution(value(1),value(0),value(1),value(0),'bytes').growthPoints,null);
  assert.equal(contribution(value(0),null,value(0),null,'bytes').share,null);
  assert.equal(contribution(value(1),null,value(1),null,'bytes').delta,null);
  assert.equal(sumHistory([{bytes:'9007199254740993',voiceSeconds:1,sms:1},{bytes:'3',voiceSeconds:1,sms:1}]).bytes,'9007199254740996');
});
test('daily growth bands handle exact thresholds, unequal durations and unavailable baselines',()=>{
  assert.equal(growthBand(value(110),value(100),'bytes',10,10),'growth');
  assert.equal(growthBand(value(90),value(100),'bytes',10,10),'decline');
  assert.equal(growthBand(value(109),value(100),'bytes',10,10),'stable');
  assert.equal(growthBand(value(310),value(300),'bytes',31,30),'stable');
  assert.equal(growthBand(value(0),value(0),'bytes',1,1),'unknown');
  assert.equal(growthBand(value(0),value(100),'bytes',1,1),'decline');
  assert.equal(growthBand(value(1),null,'bytes',1,1),'unknown');
});
test('cohort groupings and both distributions partition sites and conserve every business metric',()=>{
  const analysis=queryHistory(q);
  for(const metric of ['bytes','voiceSeconds','sms'] as const)for(const groupBy of ['scene','siteType','sharing'] as const){
    const cohort=analyzeCohorts({...analysis,scope:{...q,metric,groupBy}},DEMO_SITES);
    assert.equal(cohort.groups.reduce((n,r)=>n+r.sites,0),analysis.physicalSites);
    assert.equal(cohort.distribution.reduce((n,r)=>n+r.count,0),analysis.physicalSites);
    assert.equal(cohort.growth.reduce((n,r)=>n+r.count,0),analysis.physicalSites);
    for(const key of ['bytes','voiceSeconds','sms'] as const){
      assert.equal(BigInt(analysis.totals[key]),cohort.groups.reduce((n,r)=>n+BigInt(r.totals[key]),0n));
      assert.equal(BigInt(analysis.totals[key]),cohort.distribution.reduce((n,r)=>n+BigInt(r.totals[key]),0n));
    }
    assert.ok(cohort.groups.every(r=>r.p25!<=r.median!&&r.median!<=r.p75!));
    const sumPoints=cohort.groups.reduce((n,r)=>n+r.contribution.growthPoints!,0);
    assert.ok(Math.abs(sumPoints-(Number(analysis.totals[metric])/Number(analysis.previous![metric])-1)*100)<1e-10);
  }
});
test('zero, tied quantiles and missing baseline are explicit and never split ties arbitrarily',()=>{
  const catalog=DEMO_SITES.slice(0,5),base=analyzeHistory(catalog,q,site=>site.operators.map(code=>({code,values:value(10)})));
  const rows=catalog.map((s,i)=>({id:s.id,values:value(i===0?0:100),previous:null}));
  const c=analyzeCohorts({...base,previous:null,previousWindow:null,siteRows:rows,totals:sumHistory(rows.map(r=>r.values))},catalog);
  assert.equal(c.stats.p25,c.stats.p75);assert.equal(c.distribution.find(r=>r.id==='lower')!.count,4);
  assert.equal(c.distribution.find(r=>r.id==='upper')!.count,0);assert.equal(c.distribution.find(r=>r.id==='zero')!.count,1);
  assert.equal(c.growth.find(r=>r.id==='unknown')!.count,5);
  const empty=analyzeCohorts({...base,siteRows:[],totals:value(0)},catalog);assert.equal(empty.stats.p50,null);assert.equal(empty.stats.topShare,null);
});
test('resource filters intersect, preserve physical sharing and use the same attributes as the registry',()=>{
  const all=queryHistory(q);
  const scope=parseHistoryQuery({...{city:'610100',county:'610113',range:'month',month:'2026-10'},view:'cohorts',scene:'urban',siteType:'rooftop',sharing:'multi',operator:'mobile'});
  const result=queryHistory(scope),expected=DEMO_SITES.filter(s=>s.countyId==='610113'&&s.profile==='urban'&&s.operators.length>=3&&s.operators.includes('mobile'));
  assert.equal(result.physicalSites,expected.length);assert.ok(result.siteRows.every(r=>expected.some(s=>s.id===r.id)));
  assert.equal(syntheticSiteType(DEMO_SITES[0]),'rooftop');
  assert.equal(syntheticSharing({...DEMO_SITES[0],operators:['mobile','telecom']}),'dual');
  const impossible=queryHistory(parseHistoryQuery({city:'610100',scene:'urban',siteType:'ground',range:'month',month:'2026-10'}));assert.equal(impossible.physicalSites,0);
  assert.ok(all.physicalSites>=result.physicalSites);
  for(const input of [{scene:'fake'},{sharing:'shared'},{siteType:'tower'},{view:'fake'},{band:'fake'},{page:'0'},{page:'1.5'},{groupBy:'operator'},{sort:'fake'},{view:['cohorts']}])assert.throws(()=>parseHistoryQuery(input));
});
test('distribution selection affects member list only, pagination bounds and ordering stay deterministic',()=>{
  const scope=parseHistoryQuery({city:'610100',range:'month',month:'2026-10',view:'cohorts',band:'growth',sort:'growth',page:'1000'}),analysis=queryHistory(scope);
  const c=analyzeCohorts(analysis,DEMO_SITES);
  assert.equal(c.count,c.growth.find(r=>r.id==='growth')!.count);assert.equal(c.page,c.pageCount);assert.ok(c.members.every(r=>r.growth==='growth'));
  for(let i=1;i<c.members.length;i++)assert.ok(c.members[i-1].change.dailyRate!>=c.members[i].change.dailyRate!);
  assert.equal(c.distribution.reduce((n,r)=>n+r.count,0),analysis.physicalSites);
  const plain=analyzeCohorts({...analysis,scope:{...scope,band:'all',page:1}},DEMO_SITES);assert.equal(plain.members.length,20);
});
test('prepared province and scoped model keep per-site aggregates server-side and preserve operator baselines',()=>{
  const prepared=historyModel({view:'cohorts',metric:'sms'});
  assert.equal(Object.hasOwn(prepared,'siteRows'),false);assert.equal(prepared.cohorts.members.length,20);
  assert.equal(prepared.version,'bsmoss-history-v3');assert.equal(prepared.physicalSites,1080);
  assert.equal(prepared.operators.reduce((n,r)=>n+BigInt(r.previous!.bytes),0n),BigInt(prepared.previous!.bytes));
  const city=historyModel({city:'610100',range:'month',month:'2026-10',scene:'urban',view:'operators'});
  assert.ok(city.cohorts.members.every(r=>r.scene==='urban'));assert.ok(city.operators.every(r=>r.previous!==null));
});
