import {createHash} from 'node:crypto';
import {buildHistoryReport} from '../analysis/history-report-service';
import {renderHistoryReport} from '../analysis/history-report-html';
import {businessHref} from '../business-analysis/links';
import {parseBusinessQuery} from '../business-analysis/model';
import {queryDailyReport,queryCalendarReport} from '../domains/map-demo/service';
import {renderDailyReport} from '../domains/map-demo/report-html';
import {renderCalendarReport} from '../domains/map-demo/period-report-html';
import {calendarWindow} from '../domains/map-demo/period-rules';
import {serializeSelection} from '../domains/map-demo/geometry';
import {fileMetadata,LIBRARY_DATASET,FILE_LIMIT,type ReportFiles,type ReportArtifact} from './local-rules';
export function reportArtifact(input:Record<string,string|string[]|undefined>):ReportArtifact {
 const {kind,snapshot,...query}=input;let files:ReportFiles;
 if(kind==='history'){
  const r=buildHistoryReport(query),d=r.payload.data,q=d.scope;
  if(typeof snapshot!=='string'||snapshot!==r.digest)throw Error('report_file_changed');
  files={dataset:LIBRARY_DATASET,familyKey:'',kind,reportId:r.id,period:q.range,start:q.window.start,end:q.window.end,city:q.query.cityId,county:q.query.countyId,operator:q.query.operator,site:q.site??null,
   scopeLabel:[d.region.name,d.region.cities.find(s=>s.id===q.query.cityId)?.name,d.region.counties.find(s=>s.id===q.query.countyId)?.name,d.siteName].filter(Boolean).join(' \u00b7 '),sourceVersion:r.payload.sourceVersion,templateVersion:r.payload.templateVersion,
   analysisHref:r.returnHref,reportHref:r.pageHref,totals:{bytes:String(d.totals.bytes),voiceSeconds:String(d.totals.voiceSeconds),sms:String(d.totals.sms)},json:JSON.stringify(r,null,2),html:renderHistoryReport(r)};
 }else if(kind==='calendar'){
  if(typeof snapshot!=='string'||!/^[a-f0-9]{64}$/.test(snapshot))throw Error('invalid_report_snapshot');
  const {scope:q}=parseBusinessQuery('usage-reports',query),period=q.period as 'day'|'week'|'month';
  const p=new URLSearchParams({cityId:q.cityId,countyId:q.countyId,operator:q.operator,hour:String(q.hour),search:q.search});if(q.selection)p.set('selection',serializeSelection(q.selection));
  if(period!=='day')p.set('period',period);
  const r=period==='day'?queryDailyReport(p):queryCalendarReport(p),window=calendarWindow(period);
  if(createHash('sha256').update(JSON.stringify(r,null,2)).digest('hex')!==snapshot)throw Error('report_file_changed');
  files={dataset:LIBRARY_DATASET,familyKey:'',kind,reportId:r.id,period,start:window.start,end:window.end,city:q.cityId,county:q.countyId,operator:q.operator,site:null,scopeLabel:r.scope.name+(q.search?' \u00b7 '+q.search:'')+(q.selection?' \u00b7 \u9009\u533a':''),sourceVersion:r.usage.version+' / '+r.usage.ruleVersion,templateVersion:r.templateVersion,
   analysisHref:businessHref('operator-usage',q),reportHref:businessHref('usage-reports',q),totals:{bytes:String(r.usage.totals.bytes),voiceSeconds:String(r.usage.totals.voiceSeconds),sms:String(r.usage.totals.sms)},json:JSON.stringify(r,null,2),html:'period'in r?renderCalendarReport(r):renderDailyReport(r)};
 }else throw Error('invalid_report_kind');
 files.familyKey=createHash('sha256').update(JSON.stringify([files.kind,files.city,files.county,files.operator,files.site,files.start,files.end,query.selection??null,query.search??'',query.scene??'all',query.siteType??'all',query.sharing??'all'])).digest('hex');
 const content=JSON.stringify(files);if(content.length>FILE_LIMIT)throw Error('report_file_too_large');fileMetadata(content);
 return {schema:1,digest:createHash('sha256').update(content).digest('hex'),content};
}
