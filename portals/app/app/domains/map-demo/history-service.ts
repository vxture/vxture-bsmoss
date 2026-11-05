import {parseMapQuery} from './service.ts';
import {inSelection} from './geometry.ts';
import {DEMO_SITES} from './resources.ts';
import {analyzeHistory,historyMonth,historyWindow,type HistorySample,type HistoryScope} from './history-rules.ts';

// Bounded by this immutable catalog and 24 covered months. No tenant data,
// credentials, user-selected scope or formal evidence enters the cache.
const months=new Map<string,HistorySample[]>();
export function parseHistoryQuery(input:Record<string,string|string[]|undefined>):HistoryScope {
  const allowed=['city','county','operator','site','range','month','from','to','metric'];
  for(const [key,value] of Object.entries(input))if(!allowed.includes(key)||typeof value!=='string')throw Error('invalid_history_query');
  const query=parseMapQuery(new URLSearchParams({cityId:input.city as string??'all',countyId:input.county as string??'all',operator:input.operator as string??'all'}));
  const {range,window}=historyWindow(input as Record<string,string>);
  const site=input.site as string|undefined;
  if(site!==undefined&&!/^[A-Za-z0-9-]{1,40}$/.test(site))throw Error('invalid_history_site');
  const metric=input.metric??'bytes';
  if(metric!=='bytes'&&metric!=='voiceSeconds'&&metric!=='sms')throw Error('invalid_history_metric');
  return {query,range,window,metric,...(site?{site}:{})};
}
export function queryHistory(scope:HistoryScope) {
  const sites=DEMO_SITES.filter(s=>(scope.query.cityId==='all'||s.cityId===scope.query.cityId)&&(scope.query.countyId==='all'||s.countyId===scope.query.countyId)
    &&(scope.query.operator==='all'||s.operators.includes(scope.query.operator))&&(!scope.site||s.id===scope.site)&&(!scope.query.selection||inSelection(s.lng,s.lat,scope.query.selection)));
  if(scope.site&&!DEMO_SITES.some(s=>s.id===scope.site&&(scope.query.cityId==='all'||s.cityId===scope.query.cityId)&&(scope.query.countyId==='all'||s.countyId===scope.query.countyId)))throw Error('history_site_not_in_scope');
  return analyzeHistory(sites,scope,(site,month)=>{
    const key=site.id+'/'+month;
    let value=months.get(key);if(!value){value=historyMonth(site,month);months.set(key,value);}return value;
  });
}
