import { inSelection, parseBounds, parseSelection, mapContextKey } from './geometry.ts';
import { analyzeArea } from './area-rules.ts';
import {analyzeOperatorUsage,parseUsagePeriod} from './operator-rules.ts';
import {analyzeDailyReport} from './report-rules.ts';
import {analyzeCalendarUsage,parseReportPeriod} from './period-rules.ts';
import {analyzeCalendarReport} from './period-report-rules.ts';
import {analyzePeriodComparison} from './period-comparison-rules.ts';
import {contributionCollector} from './period-contribution-rules.ts';
import {analyzeStationPeriod} from './station-period-rules.ts';
import {STATION_REPORT_TEMPLATE,type StationReport} from './station-report-rules.ts';
import {createHash} from 'node:crypto';
import { comparisonContextKey, parseComparisonIds } from './comparison-rules.ts';
import {analyzeTopic,evaluateTopic,parseTopic} from './topic-rules.ts';
import { DEMO_REGION, DEMO_SITES } from './resources.ts';
import { DEMO_DATE, DEMO_VERSION, GIB, siteHour, findingsFor } from './rules.ts';
import { OPERATOR_CODES, type MapQuery, type MapSnapshot, type StationDetail, type SitePoint, type OperatorFilter, type ComparisonSnapshot } from './types.ts';

// This adapter owns only synthetic resources. It never reads or writes measurement evidence.
export function parseMapQuery(params: URLSearchParams): MapQuery {
  const allowed = new Set(['regionId','cityId','countyId','operator','hour','bbox','selection','search','topic']);
  for (const key of params.keys()) if (!allowed.has(key) || params.getAll(key).length!==1) throw Error('invalid_query');
  const regionId=params.get('regionId')??DEMO_REGION.id;
  const cityId=params.get('cityId')??'all';
  const countyId=params.get('countyId')??'all';
  if(countyId!=='all'&&!DEMO_REGION.counties.some(c=>c.id===countyId&&c.cityId===cityId)) throw Error('invalid_county');
  const operator=params.get('operator')??'all';
  const hourText=params.get('hour')??'18';
  const hour=Number(hourText);
  if(regionId!==DEMO_REGION.id || (cityId!=='all'&&!DEMO_REGION.cities.some(c=>c.id===cityId))) throw Error('invalid_region');
  if(operator!=='all'&&!OPERATOR_CODES.includes(operator as typeof OPERATOR_CODES[number])) throw Error('invalid_operator');
  if(!/^\d{1,2}$/.test(hourText)||!Number.isInteger(hour)||hour<0||hour>23) throw Error('invalid_hour');
  const search=(params.get('search')??'').trim();
  if(search.length>80) throw Error('invalid_search');
  const bbox=params.has('bbox')?parseBounds(params.get('bbox')!):undefined;
  const selection=params.has('selection')?parseSelection(params.get('selection')!):undefined;
  const topic=params.has('topic')?parseTopic(params.get('topic')!):undefined;
  return {regionId,cityId,countyId,operator:operator as OperatorFilter,hour,bbox,selection,search,...(topic?{topic}:{})};
}

function selectSites(query:MapQuery) {
  return DEMO_SITES.filter(s=>s.regionId===query.regionId&&(query.cityId==='all'||s.cityId===query.cityId)&&(query.countyId==='all'||s.countyId===query.countyId)
    &&(!query.selection||inSelection(s.lng,s.lat,query.selection))&&(query.operator==='all'||s.operators.includes(query.operator))&&(!query.search||s.name.includes(query.search)||s.id.toLowerCase().includes(query.search.toLowerCase())));
}
export function queryMap(query: MapQuery): MapSnapshot {
  const sites=selectSites(query);
  let bytes=0,voiceSeconds=0,sms=0,attempts=0,connected=0,used=0,capacity=0,energyWh=0,normal=0,warning=0,critical=0;
  const points: SitePoint[]=sites.map(site=>{
    const m=siteHour(site,query.hour,query.operator);
    bytes+=m.bytes;voiceSeconds+=m.voiceSeconds;sms+=m.sms;attempts+=m.attempts;connected+=m.connected;used+=m.used;capacity+=m.capacity;energyWh+=m.energyWh??0;
    if(m.status==='normal')normal++;else if(m.status==='warning')warning++;else critical++;
    return {id:site.id,name:site.name,cityId:site.cityId,countyId:site.countyId,lng:site.lng,lat:site.lat,status:m.status,trafficGiB:m.bytes/GIB,load:m.used/m.capacity,energyKWh:m.energyWh===null?null:m.energyWh/1000,...(query.topic?{topicLevel:evaluateTopic(query.topic,m).level}:{})};
  });
  const visible=query.bbox?points.filter(p=>p.lng>=query.bbox![0]&&p.lng<=query.bbox![2]&&p.lat>=query.bbox![1]&&p.lat<=query.bbox![3]):points;
  return {contextKey:mapContextKey(query),area:query.selection?analyzeArea(sites,query):null,topic:query.topic?analyzeTopic(sites,query,query.topic):null,version:DEMO_VERSION,mode:'demo',hour:query.hour,summary:{count:sites.length,normal,warning,critical,bytes,voiceSeconds,sms,connectionRate:attempts?connected/attempts:null,load:capacity?used/capacity:null,energyWh:query.operator==='all'?energyWh:null},
    points:visible.slice(0,1500),visibleCount:visible.length,truncated:visible.length>1500,
    ranking:[...points].sort((a,b)=>(a.status==='critical'?-2:a.status==='warning'?-1:0)-(b.status==='critical'?-2:b.status==='warning'?-1:0)||b.trafficGiB-a.trafficGiB).slice(0,5)};
}

export function queryStation(id: string, query: MapQuery): StationDetail | null {
  const site=DEMO_SITES.find(s=>s.id===id&&s.regionId===query.regionId&&(query.cityId==='all'||s.cityId===query.cityId)&&(query.countyId==='all'||s.countyId===query.countyId)&&(!query.selection||inSelection(s.lng,s.lat,query.selection))&&(query.operator==='all'||s.operators.includes(query.operator)));
  if(!site) return null;
  const series=Array.from({length:24},(_,h)=>siteHour(site,h,query.operator));
  return {version:DEMO_VERSION,site,current:series[query.hour],series,
    operators:site.operators.map(code=>{const m=siteHour(site,query.hour,code);return {code,bytes:m.bytes,connected:m.connected,attempts:m.attempts,load:m.used/m.capacity};}),
    findings:findingsFor(site,series[query.hour])};
}

export function initialWorkbench() {
  const query=parseMapQuery(new URLSearchParams());
  const snapshot=queryMap(query);
  return {scenes:DEMO_SITES.slice(0,6).map(({id,countyId})=>({id,countyId})),region:DEMO_REGION,snapshot:{...snapshot,points:[]}};
}

export function queryStationPeriod(id:string,params:URLSearchParams) {
  if(!/^[A-Za-z0-9-]{1,40}$/.test(id)||params.getAll('period').length>1)throw Error('invalid_station_period');
  const period=parseReportPeriod(params.get('period')??'day'),rest=new URLSearchParams(params);rest.delete('period');
  const query=parseMapQuery(rest),site=selectSites(query).find(s=>s.id===id);
  if(!site)return null;
  const analysis=analyzeStationPeriod(site,query,period);
  const scope={regionId:query.regionId,cityId:query.cityId,countyId:query.countyId,operator:query.operator,search:query.search,selection:query.selection??null};
  const digest=createHash('sha256').update(JSON.stringify({templateVersion:STATION_REPORT_TEMPLATE,scope,analysis})).digest('hex').slice(0,20);
  return {...analysis,report:{id:'DEMO-STATION-'+period.toUpperCase()+'-'+digest,templateVersion:STATION_REPORT_TEMPLATE}};
}

export function queryStationReport(id:string,params:URLSearchParams):StationReport|null {
  const analysis=queryStationPeriod(id,params);if(!analysis)return null;
  const rest=new URLSearchParams(params);rest.delete('period');const query=parseMapQuery(rest);
  return {...analysis.report,mode:'demo',status:'draft',analysis,scope:{regionId:query.regionId,cityId:query.cityId,countyId:query.countyId,operator:query.operator,search:query.search,selection:query.selection??null}};
}

export function parseComparisonQuery(params:URLSearchParams) {
  if(params.getAll('sites').length!==1)throw Error('invalid_comparison');
  const ids=parseComparisonIds(params.get('sites')!);
  const rest=new URLSearchParams(params);rest.delete('sites');
  return {ids,query:parseMapQuery(rest)};
}
export function queryComparison(ids:string[],query:MapQuery):ComparisonSnapshot {
  parseComparisonIds(ids.join(','));
  return {contextKey:comparisonContextKey(query,ids),version:DEMO_VERSION,mode:'demo',hour:query.hour,
    entries:ids.map(id=>({id,detail:queryStation(id,query)}))};
}

export function queryOperatorUsage(params:URLSearchParams) {
  if(params.getAll('period').length>1)throw Error('invalid_period');
  const period=parseUsagePeriod(params.get('period')??'hour');
  const rest=new URLSearchParams(params);rest.delete('period');
  const query=parseMapQuery(rest);
  return analyzeOperatorUsage(selectSites(query),query,period);
}

function calendarQuery(params:URLSearchParams,report=false) {
  if(params.getAll('period').length!==1)throw Error('invalid_period');
  const period=parseReportPeriod(params.get('period')!);
  if(period==='day')throw Error('use_daily_adapter');
  const rest=new URLSearchParams(params);rest.delete('period');
  if(report){
    if(rest.getAll('date').length>1||(rest.has('date')&&rest.get('date')!==DEMO_DATE))throw Error('invalid_report_date');
    rest.delete('date');
  }
  return {period,query:parseMapQuery(rest)};
}
export function queryCalendarUsage(params:URLSearchParams) {
  const {period,query}=calendarQuery(params);return analyzeCalendarUsage(selectSites(query),query,period);
}
export function queryPeriodComparison(params:URLSearchParams) {
  if(params.getAll('period').length>1)throw Error('invalid_period');
  const period=parseReportPeriod(params.get('period')??'day'),rest=new URLSearchParams(params);rest.delete('period');
  const query=parseMapQuery(rest);
  return analyzePeriodComparison(selectSites(query),query,period,undefined,undefined,DEMO_REGION);
}
export function queryCalendarReport(params:URLSearchParams) {
  const {period,query}=calendarQuery(params,true),sites=selectSites(query).slice().sort((a,b)=>a.id.localeCompare(b.id));
  const name=DEMO_REGION.counties.find(c=>c.id===query.countyId)?.name??DEMO_REGION.cities.find(c=>c.id===query.cityId)?.name??DEMO_REGION.name;
  const collector=contributionCollector(sites),base=analyzeCalendarReport(sites,query,period,name,collector.observe);
  const report={...base,comparison:analyzePeriodComparison(sites,query,period,base.usage,collector.counters,DEMO_REGION)};
  const digest=createHash('sha256').update(JSON.stringify({sites:sites.map(s=>s.id),report})).digest('hex').slice(0,20);
  return {id:'DEMO-'+period.toUpperCase()+'-'+digest,...report};
}

export function queryDailyReport(params:URLSearchParams) {
  if(params.getAll('date').length>1||(params.has('date')&&params.get('date')!==DEMO_DATE))throw Error('invalid_report_date');
  const rest=new URLSearchParams(params);rest.delete('date');
  const query=parseMapQuery(rest);
  const sites=selectSites(query).slice().sort((a,b)=>a.id.localeCompare(b.id));
  const name=DEMO_REGION.counties.find(c=>c.id===query.countyId)?.name??DEMO_REGION.cities.find(c=>c.id===query.cityId)?.name??DEMO_REGION.name;
  const collector=contributionCollector(sites),base=analyzeDailyReport(sites,query,name,collector.observe);
  const report={...base,comparison:analyzePeriodComparison(sites,query,'day',base.usage,collector.counters,DEMO_REGION)};
  const digest=createHash('sha256').update(JSON.stringify({sites:sites.map(s=>s.id),report})).digest('hex').slice(0,20);
  return {id:'DEMO-DAY-'+digest,...report};
}
