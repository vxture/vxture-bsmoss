import type {HistoryScope} from '../domains/map-demo/history-rules';
import {DAY_MS,dateNumber,isoDay} from '../domains/map-demo/history-calendar';
export function historyHref(scope:HistoryScope,patch:Record<string,string|undefined>={}) {
  const p=new URLSearchParams({city:scope.query.cityId,county:scope.query.countyId,operator:scope.query.operator,range:scope.range,metric:scope.metric});
  if(scope.site)p.set('site',scope.site);
  if(scope.range==='month')p.set('month',scope.window.start.slice(0,7));
  if(scope.range==='custom'){p.set('from',scope.window.start);p.set('to',isoDay(dateNumber(scope.window.end)-DAY_MS));}
  for(const [key,value] of Object.entries(patch))if(value===undefined)p.delete(key);else p.set(key,value);
  if(p.get('range')!=='month')p.delete('month');
  if(p.get('range')!=='custom'){p.delete('from');p.delete('to');}
  return '/analysis?'+p;
}
