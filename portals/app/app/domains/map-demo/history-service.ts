import { SITE_TYPES, SCENES, SHARING_TYPES } from "../business-parameters/classification.ts";
import {parseMapQuery} from './service.ts';
import {inSelection} from './geometry.ts';
import {DEMO_SITES} from './resources.ts';
import {analyzeHistory,historyMonth,historyWindow,type HistorySample,type HistoryScope} from './history-rules.ts';
import {dateNumber} from './history-calendar.ts';
import {syntheticSharing,syntheticSiteType} from './site-attributes.ts';

// Bounded by this immutable catalog and 24 covered months. No tenant data,
// credentials, user-selected scope or formal evidence enters the cache.
const months=new Map<string,HistorySample[]>();
export function parseHistoryQuery(input:Record<string,string|string[]|undefined>):HistoryScope {
  const allowed=['city','county','operator','site','range','month','from','to','metric','view','groupBy','scene','siteType','sharing','band','sort','page','peerLevel','evidence','slot'];
  for(const [key,value] of Object.entries(input))if(!allowed.includes(key)||typeof value!=='string')throw Error('invalid_history_query');
  const query=parseMapQuery(new URLSearchParams({cityId:input.city as string??'all',countyId:input.county as string??'all',operator:input.operator as string??'all'}));
  const {range,window}=historyWindow(input as Record<string,string>);
  const site=input.site as string|undefined;
  if(site!==undefined&&!/^[A-Za-z0-9-]{1,40}$/.test(site))throw Error('invalid_history_site');
  const metric=input.metric??'bytes';
  if(metric!=='bytes'&&metric!=='voiceSeconds'&&metric!=='sms')throw Error('invalid_history_metric');
  const values={view:input.view??'region',groupBy:input.groupBy??'scene',scene:input.scene??'all',siteType:input.siteType??'all',sharing:input.sharing??'all',band:input.band??'all',sort:input.sort??'total'};
  const options={view:['region','operators','cohorts'],groupBy:['scene','siteType','sharing'],scene:['all',...SCENES],siteType:['all',...SITE_TYPES],sharing:['all',...SHARING_TYPES],band:['all','zero','lower','middleLow','middleHigh','upper','decline','stable','growth','unknown'],sort:['total','intensity','growth','decline']};
  for(const key of Object.keys(values) as (keyof typeof values)[])if(!options[key].includes(values[key] as string))throw Error('invalid_history_filter');
  const pageText=input.page??'1';if(typeof pageText!=='string'||!(/^[1-9]\d{0,3}$/).test(pageText)||Number(pageText)>1000)throw Error('invalid_history_page');
  const peerLevel=input.peerLevel??'scope';
  if(!['scope','city','province'].includes(peerLevel as string))throw Error('invalid_history_peer_scope');
  const evidence=input.evidence as string|undefined,slotText=input.slot as string|undefined;
  if(evidence!==undefined){dateNumber(evidence);if(!site||evidence<window.start||evidence>=window.end)throw Error('invalid_history_evidence_date');}
  if(slotText!==undefined&&(!site||!/^([0-9]|1[0-9]|2[0-3])$/.test(slotText)))throw Error('invalid_history_slot');
  return {query,range,window,metric,...values,page:Number(pageText),peerLevel,...(site?{site}:{}),...(evidence?{evidence}:{}),...(slotText!==undefined?{slot:Number(slotText)}:{})} as HistoryScope;
}
export function selectHistorySites(scope:HistoryScope) {
  const sites=DEMO_SITES.filter(s=>(scope.query.cityId==='all'||s.cityId===scope.query.cityId)&&(scope.query.countyId==='all'||s.countyId===scope.query.countyId)
    &&(scope.query.operator==='all'||s.operators.includes(scope.query.operator))&&(!scope.site||s.id===scope.site)&&(!scope.query.selection||inSelection(s.lng,s.lat,scope.query.selection))
    &&(scope.scene==='all'||s.profile===scope.scene)&&(scope.siteType==='all'||syntheticSiteType(s)===scope.siteType)&&(scope.sharing==='all'||syntheticSharing(s)===scope.sharing));
  if(scope.site&&!DEMO_SITES.some(s=>s.id===scope.site&&(scope.query.cityId==='all'||s.cityId===scope.query.cityId)&&(scope.query.countyId==='all'||s.countyId===scope.query.countyId)))throw Error('history_site_not_in_scope');
  return sites;
}
export function queryHistory(scope:HistoryScope) {
  const sites=selectHistorySites(scope);
  return analyzeHistory(sites,scope,(site,month)=>{
    const key=site.id+'/'+month;
    let value=months.get(key);if(!value){value=historyMonth(site,month);months.set(key,value);}return value;
  });
}
