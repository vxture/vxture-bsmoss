import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {reportArtifact} from './local-service';
import {checkArtifact,fileMetadata,filterLibrary,libraryHref,localReportQuery,sha256} from './local-rules';
import {buildHistoryReport} from '../analysis/history-report-service';
import {queryDailyReport,queryCalendarReport} from '../domains/map-demo/service';
import {readInvestigation} from '../portal/investigation-server';
const scope={city:'610100',county:'610113',operator:'mobile'};
const digest=(r:unknown)=>createHash('sha256').update(JSON.stringify(r,null,2)).digest('hex');
test('calendar day/week/month artifacts retain exact counters, source file and immutable digest',async()=>{
 for(const period of ['day','week','month']){
  const p=new URLSearchParams({cityId:scope.city,countyId:scope.county,operator:scope.operator,...(period==='day'?{}:{period})});
  const report=period==='day'?queryDailyReport(p):queryCalendarReport(p);
  const input={kind:'calendar',...scope,period,snapshot:digest(report)},a=reportArtifact(input),{files:f}=await checkArtifact(a);
  assert.deepEqual(JSON.parse(f.json),JSON.parse(JSON.stringify(report)));assert.equal(f.totals.bytes,String(report.usage.totals.bytes));assert.equal(f.period,period);
  assert.equal(f.html.includes(report.id),true);assert.equal(f.operator,'mobile');assert.equal(reportArtifact(input).digest,a.digest);
  assert.throws(()=>reportArtifact({...input,snapshot:'0'.repeat(64)}),/report_file_changed/);
  assert.throws(()=>reportArtifact({...input,snapshot:undefined}),/invalid_report_snapshot/);
 }
});
test('historical report artifact binds full scope, members, all three metrics and pinned snapshot',async()=>{
 const query={...scope,site:'SX-DEMO-001',range:'month',month:'2026-10',metric:'sms'},r=buildHistoryReport(query),a=reportArtifact({...query,kind:'history',snapshot:r.digest}),{files:f}=await checkArtifact(a);
 assert.deepEqual(JSON.parse(f.json),JSON.parse(JSON.stringify(r)));assert.equal(f.site,'SX-DEMO-001');assert.equal(f.sourceVersion,r.payload.sourceVersion);assert.equal(f.reportHref,r.pageHref);
 assert.equal(r.payload.data.cross.members.length,1);for(const k of ['bytes','voiceSeconds','sms'] as const)assert.equal(f.totals[k],String(r.payload.data.totals[k]));
 const otherQuery={...query,metric:'bytes'},other=buildHistoryReport(otherQuery),second=reportArtifact({...otherQuery,kind:'history',snapshot:other.digest});assert.equal(fileMetadata(second.content).familyKey,f.familyKey);assert.notEqual(second.digest,a.digest);
 assert.throws(()=>reportArtifact({...query,kind:'history',snapshot:'a'.repeat(64)}),/report_file_changed/);
});
test('local artifact corruption, unknown schema and foreign or executable links fail closed',async()=>{
 const r=buildHistoryReport({...scope,site:'SX-DEMO-001',range:'month',month:'2026-10'}),a=reportArtifact({...scope,site:'SX-DEMO-001',range:'month',month:'2026-10',kind:'history',snapshot:r.digest});
 await assert.rejects(checkArtifact({...a,content:a.content+' '}),/report_file_changed/);await assert.rejects(checkArtifact({...a,schema:2}),/invalid_report_artifact/);await assert.rejects(checkArtifact({...a,actor:'forged'}),/invalid_report_artifact/);
 for(const href of ['https://evil.example','//evil.example','javascript:alert(1)','/settings','/analysis?x=1#hash'])assert.throws(()=>fileMetadata(JSON.stringify({...fileMetadata(a.content),reportHref:href})),/invalid_report_link/);
 const f=fileMetadata(a.content);await assert.rejects(checkArtifact({schema:1,content:JSON.stringify({...f,dataset:'formal'}),digest:await sha256(JSON.stringify({...f,dataset:'formal'}))}),/invalid_report_file/);
});
test('library only lists actual rows with explicit region/operator/period/search and retains version return',async()=>{
 const r=buildHistoryReport({...scope,site:'SX-DEMO-001',range:'month',month:'2026-10'}),a=reportArtifact({...scope,site:'SX-DEMO-001',range:'month',month:'2026-10',kind:'history',snapshot:r.digest}),{files}=await checkArtifact(a),rows=[{files,saved:{...a,savedAt:'2026-11-06T01:00:00.000Z'}}];
 const q=localReportQuery({...scope,saved:a.digest});assert.equal(filterLibrary(rows,q).length,1);assert.equal(filterLibrary(rows,{...q,operator:'telecom'}).length,0);assert.equal(filterLibrary(rows,{...q,city:'610300'}).length,0);assert.equal(filterLibrary(rows,{...q,period:'day'}).length,0);assert.equal(filterLibrary(rows,{...q,search:'no-match'}).length,0);assert.deepEqual(filterLibrary([],q),[]);
 assert.equal(new URL(libraryHref(q,{saved:undefined}),'http://localhost').searchParams.has('saved'),false);
 const href=libraryHref(q);assert.equal(readInvestigation({investigation:JSON.stringify({v:1,href})}).journey?.href,href);
 for(const input of [{saved:'bad'},{period:'year'},{actor:'forged'},{search:['x','y']},{search:'x'.repeat(101)}])assert.throws(()=>localReportQuery(input),/invalid_library_query/);
});
