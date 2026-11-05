import type {HistoryScope} from '../domains/map-demo/history-rules';
import {DAY_MS,dateNumber,isoDay} from '../domains/map-demo/history-calendar';
export function historyHref(scope:HistoryScope,patch:Record<string,string|undefined>={}) {
  const p=new URLSearchParams({city:scope.query.cityId,county:scope.query.countyId,operator:scope.query.operator,range:scope.range,metric:scope.metric});
  for(const key of ['view','groupBy','scene','siteType','sharing','band','sort'] as const)if(scope[key]!==({view:'region',groupBy:'scene',scene:'all',siteType:'all',sharing:'all',band:'all',sort:'total'} as const)[key])p.set(key,scope[key]);
  if(scope.page>1)p.set('page',String(scope.page));
  if(scope.site)p.set('site',scope.site);
  if(scope.peerLevel!=='scope')p.set('peerLevel',scope.peerLevel);
  if(scope.evidence)p.set('evidence',scope.evidence);
  if(scope.slot!==undefined)p.set('slot',String(scope.slot));
  if(scope.range==='month')p.set('month',scope.window.start.slice(0,7));
  if(scope.range==='custom'){p.set('from',scope.window.start);p.set('to',isoDay(dateNumber(scope.window.end)-DAY_MS));}
  for(const [key,value] of Object.entries(patch))if(value===undefined)p.delete(key);else p.set(key,value);
  if(Object.keys(patch).some(key=>key!=='page')&&patch.page===undefined)p.delete('page');
  if(p.get('range')!=='month')p.delete('month');
  if(p.get('range')!=='custom'){p.delete('from');p.delete('to');}
  if(!p.has('site')||['range','month','from','to'].some(key=>Object.hasOwn(patch,key))){p.delete('evidence');p.delete('slot');}
  if(Object.hasOwn(patch,'site')&&patch.site!==scope.site){p.delete('evidence');p.delete('slot');}
  return '/analysis?'+p;
}
export const historyEvidenceHref=(scope:HistoryScope,patch:Record<string,string|undefined>={})=>historyHref(scope,patch).replace('/analysis?','/usage-review/history?');
