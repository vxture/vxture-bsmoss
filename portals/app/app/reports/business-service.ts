import {createHash} from 'node:crypto';
import {businessUsageModel} from '../operator-usage/model';
import {DEMO_VERSION} from '../domains/map-demo/rules';
import {HISTORY_VERSION} from '../domains/map-demo/history-calendar';
import {LIBRARY_DATASET,FILE_LIMIT,fileMetadata,type ReportArtifact,type ReportFiles} from './local-rules';
import {generationQuery,generationHref} from './generation-rules';
import {renderBusinessReport} from './business-html';
import type {BusinessReport} from './business-snapshot';
import {operatorNames} from '../sites/labels';
import {analyzeBusinessReport} from './analysis-rules';
import {DEMO_SITES} from '../domains/map-demo/resources';
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
export function businessReportArtifact(input:Record<string,string|string[]|undefined>,names:Record<string,string>=operatorNames):ReportArtifact{
 const q=generationQuery(input),d=businessUsageModel({city:q.city,county:q.county,operator:q.operator,period:q.period,asOf:q.date+'T23:00:00'}),b=d.usage;
 const report:BusinessReport={schema:'business-usage-report-v1',id:'',scope:q,scopeLabel:[d.region,d.cityName,d.countyName].filter(Boolean).join(' / '),sourceVersion:DEMO_VERSION+' / '+HISTORY_VERSION,templateVersion:'bsmoss-business-report-v2',updatedThrough:d.updatedThrough,operatorNames:{all:operatorNames.all,...Object.fromEntries(b.operators.map(p=>[p.code,names[p.code]??operatorNames[p.code]]))},
 window:{start:b.window.start,end:b.window.end},coverage:b.period,sites:b.sites,total:b.total,operators:b.operators,regions:b.regions.length?b.regions:[{id:d.query.county,name:d.countyName??d.region,city:d.query.city,county:d.query.county,sites:b.sites,...b.total}],series:b.series,
 stations:d.rows.map(({name,cityName,countyName,usage:{operators,series,...counters}})=>({name,cityName,countyName,...counters}))};
 const members=new Set(report.stations.map(s=>s.id));report.analysis=analyzeBusinessReport(report,DEMO_SITES.filter(s=>members.has(s.id)));
 report.id='BU-'+hash(JSON.stringify(report)).slice(0,24);
 const files:ReportFiles={dataset:LIBRARY_DATASET,familyKey:hash(JSON.stringify(['business',q.city,q.county,q.operator,b.window.start,b.window.end])),kind:'business',reportId:report.id,period:q.period,start:b.window.start,end:b.window.end,city:q.city,county:q.county,operator:q.operator,site:null,scopeLabel:report.scopeLabel,sourceVersion:report.sourceVersion,templateVersion:report.templateVersion,
 analysisHref:'/customer-use?'+new URLSearchParams({city:q.city,county:q.county,operator:q.operator,period:q.period,asOf:q.date+'T23:00:00'}),reportHref:generationHref(q),
 totals:{bytes:b.total.bytes,voiceSeconds:String(b.total.voiceSeconds),sms:String(b.total.sms),connected:String(b.total.connected)},json:JSON.stringify(report,null,2),html:renderBusinessReport(report)};
 const content=JSON.stringify(files);if(content.length>FILE_LIMIT)throw Error('report_file_too_large');fileMetadata(content);
 return {schema:1,digest:hash(content),content};
}
