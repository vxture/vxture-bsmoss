import {DEMO_REGION,DEMO_SITES} from '../domains/map-demo/resources';
import {HISTORY_START,HISTORY_END,HISTORY_VERSION,monthEnd} from '../domains/map-demo/history-calendar';
import {parseHistoryQuery,queryHistory} from '../domains/map-demo/history-service';
import type {HistoryAnalysis} from '../domains/map-demo/history-rules';
import generated from './generated-history.json';
import {CALENDAR_RULE_VERSION} from '../domains/map-demo/period-rules';
export function historyModel(input:Record<string,string|string[]|undefined>) {
  const scope=parseHistoryQuery(input);
  const prepared=generated as unknown as {version?:string;calendarVersion?:string;analysis?:HistoryAnalysis};
  const result=prepared.version===HISTORY_VERSION&&prepared.calendarVersion===CALENDAR_RULE_VERSION&&JSON.stringify({...prepared.analysis?.scope,metric:scope.metric})===JSON.stringify(scope)
    ?{...prepared.analysis!,scope}:queryHistory(scope);
  const sites=new Map(DEMO_SITES.map(s=>[s.id,s]));
  const children=result.children.map(r=>({...r,name:result.kind==='city'?DEMO_REGION.cities.find(c=>c.id===r.id)!.name
    :result.kind==='county'?DEMO_REGION.counties.find(c=>c.id===r.id)!.name:result.kind==='site'?sites.get(r.id)!.name:r.id}));
  const months:string[]=[];for(let d=HISTORY_START;d<HISTORY_END;d=monthEnd(d.slice(0,7)))months.push(d.slice(0,7));
  return {...result,children,months,siteName:scope.site?sites.get(scope.site)!.name:null,
    region:{id:DEMO_REGION.id,name:DEMO_REGION.name,cities:DEMO_REGION.cities.map(({id,name})=>({id,name})),counties:DEMO_REGION.counties.map(({id,cityId,name})=>({id,cityId,name}))}};
}
export type HistoryModel=ReturnType<typeof historyModel>;
