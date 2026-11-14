import {DEMO_REGION,DEMO_SITES} from '../domains/map-demo/resources';
import {previewAvailability} from '../domains/data-updates/preview';
import {HISTORY_START,HISTORY_END,HISTORY_VERSION,monthEnd} from '../domains/map-demo/history-calendar';
import {parseHistoryQuery,queryHistory} from '../domains/map-demo/history-service';
import type {HistoryAnalysis} from '../domains/map-demo/history-rules';
import generated from './generated-history.json';
import {CALENDAR_RULE_VERSION} from '../domains/map-demo/period-rules';
import {analyzeCohorts} from '../domains/map-demo/cohort-rules';
import {stationHistory} from '../domains/map-demo/station-history-service';
import {queryHistoryContext} from '../domains/map-demo/history-context-service';
import type {HistoryContext} from '../domains/map-demo/history-context-rules';
import type {HistoryScope} from '../domains/map-demo/history-rules';
export function historyAnalysis(scope:HistoryScope) {
  const prepared=generated as unknown as {version?:string;calendarVersion?:string;analysis?:HistoryAnalysis};
  const displayScope={metric:scope.metric,view:scope.view,groupBy:scope.groupBy,band:scope.band,sort:scope.sort,page:scope.page};
  return prepared.version===HISTORY_VERSION&&prepared.calendarVersion===CALENDAR_RULE_VERSION&&JSON.stringify({...prepared.analysis?.scope,...displayScope})===JSON.stringify(scope)
    ?{...prepared.analysis!,scope}:queryHistory(scope);
}
export function contextForHistory(result:HistoryAnalysis){
  const prepared=generated as unknown as {version?:string;calendarVersion?:string;analysis:HistoryAnalysis;context?:HistoryContext};
  const s=result.scope,p=prepared.analysis?.scope;
  return prepared.context&&prepared.version===HISTORY_VERSION&&prepared.calendarVersion===CALENDAR_RULE_VERSION&&p&&JSON.stringify({...p,metric:s.metric,view:s.view,groupBy:s.groupBy,band:s.band,sort:s.sort,page:s.page})===JSON.stringify(s)?prepared.context:queryHistoryContext(result);
}
export function historyPresentation(result:HistoryAnalysis,context=contextForHistory(result)) {
  const scope=result.scope;
  const sites=new Map(DEMO_SITES.map(s=>[s.id,s]));
  const children=result.children.map(r=>({...r,name:result.kind==='city'?DEMO_REGION.cities.find(c=>c.id===r.id)!.name
    :result.kind==='county'?DEMO_REGION.counties.find(c=>c.id===r.id)!.name:result.kind==='site'?sites.get(r.id)!.name:r.id}));
  const months:string[]=[];for(let d=HISTORY_START;d<HISTORY_END;d=monthEnd(d.slice(0,7)))months.push(d.slice(0,7));
  const cohorts=analyzeCohorts(result,DEMO_SITES),{siteRows:serverRows,...summary}=result;
  return {...summary,dataUpdate:previewAvailability('history'),children,cohorts,months,cross:{...context,members:[...context.members].sort((a,b)=>Number(b.values[scope.metric])-Number(a.values[scope.metric])||a.id.localeCompare(b.id)).slice(0,20)},station:scope.site?stationHistory(scope,result):null,siteName:scope.site?sites.get(scope.site)!.name:null,
    region:{id:DEMO_REGION.id,name:DEMO_REGION.name,cities:DEMO_REGION.cities.map(({id,name})=>({id,name})),counties:DEMO_REGION.counties.map(({id,cityId,name})=>({id,cityId,name}))}};
}
export function historyModel(input:Record<string,string|string[]|undefined>){return historyPresentation(historyAnalysis(parseHistoryQuery(input)));}
export type HistoryModel=ReturnType<typeof historyModel>;
