import {test} from 'node:test';
import assert from 'node:assert/strict';
import {businessReportArtifact} from './business-service';
import {checkArtifact,fileMetadata,filterLibrary,localReportQuery,sha256} from './local-rules';
import {generationQuery} from './generation-rules';
import {businessUsageModel} from '../operator-usage/model';
import {sumUsage} from '../domains/business-usage/rules';
import {POST} from '../api/product-preview/business-report/route';
import {queryDailyReport} from '../domains/map-demo/service';
import {queryCalendarReport} from '../domains/map-demo/service';
import {analysisSections} from './analysis-content';
import type {BusinessReport} from './business-snapshot';
const base={city:'610100',county:'610116',operator:'mobile',date:'2026-10-25'};
test('restored report chapters match original daily and calendar operational evidence',()=>{
 for(const period of ['day','week','month'] as const)for(const operator of ['all','mobile']){
  const files=fileMetadata(businessReportArtifact({...base,operator,period}).content),r=JSON.parse(files.json) as BusinessReport,a=r.analysis!;
  const params=new URLSearchParams({cityId:base.city,countyId:base.county,operator,...(period==='day'?{}:{period})}),old=period==='day'?queryDailyReport(params):queryCalendarReport(params);
  assert.equal(a.operations.connectionRate,old.usage.totals.connectionRate);assert.equal(a.operations.load,old.usage.totals.load);assert.equal(a.operations.energyWh,old.usage.energyWh);
  assert.ok(Math.abs(a.operations.temperatureMean!-old.runtime.temperatureMean!)<1e-9);assert.equal(a.operations.temperatureMin,old.runtime.temperatureMin);assert.equal(a.operations.temperatureMax,old.runtime.temperatureMax);assert.equal(a.operations.batterySamples,old.runtime.batterySiteHours);assert.equal(a.operations.batterySites,old.runtime.batterySites);
  assert.equal(a.busy?.bytes,String(old.busy?.bytes));assert.equal(a.highestLoad?.value,old.highestLoad?.value);assert.equal(a.lowestConnection?.value,old.lowestConnection?.value);assert.deepEqual(a.ranking.map(s=>s.id),old.ranking.map(s=>s.id));
  assert.equal(a.comparisons.previous.metrics.bytes.previous,old.comparison!.metrics.bytes.previous);assert.equal(a.comparisons.previous.metrics.bytes.dailyRate,old.comparison!.metrics.bytes.dailyRate);
  for(const section of analysisSections(r))assert.ok(files.html.includes(section.title));
 }
});
test('arbitrary dates retain comparison bounds, exact movement and missing-year semantics; v1 files remain readable',async()=>{
 const report=(date:string,period='month')=>JSON.parse(fileMetadata(businessReportArtifact({...base,date,period}).content).json) as BusinessReport;
 const feb=report('2025-02-12'),a=feb.analysis!;
 assert.equal(a.days,28);assert.equal(a.comparisons.previous.days,31);assert.equal(a.comparisons.previous.start,'2025-01-01');assert.equal(a.comparisons.previous.end,'2025-02-01');assert.equal(a.comparisons.year.available,false);
 assert.equal(BigInt(a.comparisons.previous.positive)+BigInt(a.comparisons.previous.negative),BigInt(a.comparisons.previous.metrics.bytes.delta!));
 const source=businessUsageModel({city:base.city,county:base.county,operator:base.operator,period:'month',asOf:'2025-01-12T23:00:00'});assert.deepEqual(a.comparisons.previous.total,source.usage.total);
 const annual=report('2026-10-25','day');assert.equal(annual.analysis!.comparisons.year.start,'2025-10-25');assert.equal(annual.analysis!.comparisons.year.end,'2025-10-26');assert.equal(annual.analysis!.comparisons.year.available,true);
 const partial=report('2024-11-01','week');assert.equal(partial.analysis!.comparisons.previous.available,false);assert.equal(partial.analysis!.comparisons.year.available,false);
 const artifact=businessReportArtifact({...base,period:'day'}),files=fileMetadata(artifact.content),old=JSON.parse(files.json);delete old.analysis;old.templateVersion='bsmoss-business-report-v1';const content=JSON.stringify({...files,templateVersion:old.templateVersion,json:JSON.stringify(old)});assert.ok(await checkArtifact({schema:1,digest:await sha256(content),content}));
 const bad=JSON.parse(files.json);bad.analysis.operations.used++;const tampered=JSON.stringify({...files,json:JSON.stringify(bad)});await assert.rejects(checkArtifact({schema:1,digest:await sha256(tampered),content:tampered}),/invalid_business_report/);
});
test('business reports freeze exact P5 four-metric values and complete members for arbitrary calendar periods',async()=>{
 for(const [period,date] of [['day','2026-10-25'],['week','2026-10-25'],['month','2025-02-12'],['week','2024-11-01']] as const){
  const q={...base,period,date},artifact=businessReportArtifact(q),{files}=await checkArtifact(artifact),report=JSON.parse(files.json),source=businessUsageModel({city:base.city,county:base.county,operator:base.operator,period,asOf:date+'T23:00:00'});
  assert.deepEqual(report.total,source.usage.total);assert.equal(report.stations.length,source.rows.length);assert.deepEqual(sumUsage(report.stations),report.total);
  for(const name of ['operators','regions','series'])assert.deepEqual(sumUsage(report[name]),report.total);
  assert.equal(files.totals.connected,String(report.total.connected));assert.equal(report.series.length,source.usage.series.length);assert.ok(files.html.includes(report.id));
  assert.ok(!files.html.includes('<script'));assert.ok(files.html.includes('--body-font-size'));assert.equal(businessReportArtifact(q).digest,artifact.digest);
 }
});
test('report files retain separate calendar snapshots and immutable branding versions',async()=>{
 const first=businessReportArtifact({...base,period:'day'}),changed=businessReportArtifact({...base,period:'day'}, {mobile:'Custom <Mobile>'}),other=businessReportArtifact({...base,period:'day',date:'2026-10-24'});
 const a=fileMetadata(first.content),b=fileMetadata(changed.content),c=fileMetadata(other.content);
 assert.equal(a.familyKey,b.familyKey);assert.notEqual(first.digest,changed.digest);assert.notEqual(a.familyKey,c.familyKey);
 assert.ok(b.html.includes('Custom &lt;Mobile&gt;'));assert.ok(!b.html.includes('Custom <Mobile>'));assert.equal(JSON.parse(b.json).operatorNames.mobile,'Custom <Mobile>');
 const rows=[first,changed,other].map((artifact,i)=>({saved:{...artifact,savedAt:'2026-11-09T0'+i+':00:00Z'},files:fileMetadata(artifact.content)}));
 assert.equal(filterLibrary(rows,localReportQuery({})).length,3);assert.equal(filterLibrary(rows,localReportQuery({period:'day'})).length,3);
 assert.equal(filterLibrary(rows,localReportQuery({period:'history'})).length,0);assert.equal(filterLibrary(rows,localReportQuery({search:'2026-10-24'})).length,1);
 await assert.rejects(checkArtifact({...first,content:first.content+' '}),/report_file_changed/);
});
test('generation validates explicit dates, calendar bounds, scopes and rejects accidental table filters',()=>{
 for(const q of [{period:'hour'},{date:'2026-02-30'},{date:'2026-11-01'},{date:'2024-10-31'},{county:'610116',city:'610300'},{search:'x'},{period:['day']},{actor:'x'}])assert.throws(()=>generationQuery(q),/invalid_|outside_history/);
 assert.equal(generationQuery({date:'2025-02-28'}).date,'2025-02-28');
});
test('stored business payloads reject inconsistent exact counters even with a recomputed outer checksum',async()=>{
 const artifact=businessReportArtifact({...base,period:'day'}),files=fileMetadata(artifact.content),report=JSON.parse(files.json);
 report.total.connected+=1;
 const content=JSON.stringify({...files,json:JSON.stringify(report)});
 await assert.rejects(checkArtifact({schema:1,digest:await sha256(content),content}),/invalid_business_report/);
 const changed=JSON.stringify({...files,totals:{...files.totals,connected:'1'}});
 await assert.rejects(checkArtifact({schema:1,digest:await sha256(changed),content:changed}),/invalid_report_file/);
});
test('generation endpoint is unavailable outside preview and bounds invalid requests',async()=>{
 const previous=process.env.BSMOSS_PRODUCT_PREVIEW;
 try{
  process.env.BSMOSS_PRODUCT_PREVIEW='off';assert.equal((await POST(new Request('http://localhost/api/product-preview/business-report',{method:'POST'}))).status,404);
  process.env.BSMOSS_PRODUCT_PREVIEW='on';
  assert.equal((await POST(new Request('http://localhost/api/product-preview/business-report',{method:'POST',headers:{'Content-Type':'text/plain'},body:'{}'}))).status,415);
  assert.equal((await POST(new Request('http://localhost/api/product-preview/business-report',{method:'POST',headers:{'Content-Type':'application/json'},body:'x'.repeat(4097)}))).status,413);
  assert.equal((await POST(new Request('http://localhost/api/product-preview/business-report',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}bad'}))).status,400);
 }finally{if(previous===undefined)delete process.env.BSMOSS_PRODUCT_PREVIEW;else process.env.BSMOSS_PRODUCT_PREVIEW=previous;}
});
