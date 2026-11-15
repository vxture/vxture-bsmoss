import {defaultMonitoringConfiguration,readMonitoringConfiguration,monitoringConfigurationPolicy,type MonitoringConfiguration} from "../domains/monitoring/parameters";
import {reviewRuntime,summarizeReviews} from "../domains/monitoring/runtime-rules";
import {siteAnalysisModel} from "../site-analysis/model";
import {DEMO_SITES} from "../domains/map-demo/resources";
import {DEMO_DATE,siteHour} from "../domains/map-demo/rules";
import {MONITORING_METRICS,stationEvidence,monitoringSummary,type MonitoringEvidence,type RecordState} from "../domains/monitoring/rules";

import {analysisWindow as monitoringWindow} from "../site-analysis/time-window";
export {monitoringWindow};
const catalog=new Map(DEMO_SITES.map(site=>[site.id,site]));
const observationWindows=new Map<string,Map<string,ReturnType<typeof observeSite>>>();
function observeSite(id:string,window:ReturnType<typeof monitoringWindow>,configuration:MonitoringConfiguration){
 const site=catalog.get(id)!;
 const context=Array.from({length:Number(window.asOf.slice(11,13))+1},(_,hour)=>{
  const value=siteHour(site,hour,"all");return {at:DEMO_DATE+"T"+String(hour).padStart(2,"0")+":00:00+08:00",power:value.power,temperature:value.temperature,energyWh:value.energyWh,bytes:value.bytes};
 });
 const byTime=new Map(context.map(value=>[value.at,value]));
 const evidence:MonitoringEvidence[]=MONITORING_METRICS.map(metric=>({metric,connected:null,applicable:null,expected:null,
  samples:window.times.map(at=>{const time=at+"+08:00",value=byTime.get(time)!;return {at:time,value:metric==="energy"?value.energyWh:value[metric]};})}));
 return {id,evidence,...stationEvidence(evidence),runtime:reviewRuntime(context,window.asOf+"+08:00",window.start,null,configuration.parameters,monitoringConfigurationPolicy(configuration))};
}
export function monitoringModel(input:Record<string,string|string[]|undefined>,rawConfiguration:MonitoringConfiguration=defaultMonitoringConfiguration()) {
 const configuration=readMonitoringConfiguration(rawConfiguration);
 const {recordState="all",runtimeFilter="all",...baseInput}=input;
 if(typeof runtimeFilter!=="string"||!["all","current","warning","critical","period","data","alarm"].includes(runtimeFilter))throw Error("invalid_runtime_filter");
 if(typeof recordState!=="string"||!["all","observed","missing","unconnected","unknown"].includes(recordState))throw Error("invalid_record_state");
 // Reuse query validation, pagination and physical-site resource identities.
 const physicalInput={...baseInput,operator:"all",operatorCount:"all",sharing:"all"};
 const details=siteAnalysisModel({...physicalInput,asOf:baseInput.asOf??DEMO_DATE+"T23:00:00"});
 const scope=details.query.search?siteAnalysisModel({...physicalInput,search:""}):details;
 const window=monitoringWindow(details.requestedAsOf,details.query.period);
 const key=JSON.stringify([window.start,window.times,configuration]);
 let observationsBySite=observationWindows.get(key);
 if(!observationsBySite){observationsBySite=new Map();observationWindows.set(key,observationsBySite);if(observationWindows.size>4)observationWindows.delete(observationWindows.keys().next().value!);}
 const observations=scope.rows.map(row=>{
  let observation=observationsBySite.get(row.id);
  if(!observation){observation=observeSite(row.id,window,configuration);observationsBySite.set(row.id,observation);}
  return observation;
 });
 const byId=new Map(observations.map(row=>[row.id,row]));
 const searched=details.rows.map(row=>({...row,monitoring:byId.get(row.id)!}));
 const facets=["all","observed","missing","unconnected","unknown"].map(value=>({value,count:searched.filter(row=>value==="all"||row.monitoring.state===value).length}));
 const recordRows=searched.filter(row=>recordState==="all"||row.monitoring.state===recordState);
 const matches=(row:typeof searched[number],value:string)=>value==="all"||value==="warning"&&row.monitoring.runtime.level==="warning"||value==="critical"&&row.monitoring.runtime.level==="critical"||value==="current"&&["warning","critical"].includes(row.monitoring.runtime.level)||value==="period"&&row.monitoring.runtime.periodAbnormal||value==="data"&&!row.monitoring.runtime.current?.complete||value==="alarm"&&(row.monitoring.runtime.alarms.open??0)>0;
 const runtimeFacets=["all","warning","critical","alarm","data","period","current"].map(value=>({value,count:recordRows.filter(row=>matches(row,value)).length}));
 const rows=recordRows.filter(row=>matches(row,runtimeFilter)).sort((a,b)=>{
  const rank={critical:0,warning:1,unknown:2,normal:3};const x=a.monitoring.runtime,y=b.monitoring.runtime;
  return rank[x.level]-rank[y.level]||Number(y.periodAbnormal)-Number(x.periodAbnormal)||y.clues.length-x.clues.length||a.id.localeCompare(b.id);
 });
 const summary=monitoringSummary(observations),runtimeSummary=summarizeReviews(observations);
 const runtimeRegions=scope.regions.map(region=>({...region,...summarizeReviews(observations.filter(row=>{const site=catalog.get(row.id)!;return scope.query.city==="all"?site.cityId===region.id:site.countyId===region.id;}))}));
 // Detailed time series are sent only for the visible page, not the whole province.
 const page=Math.min(details.query.page,Math.max(1,Math.ceil(rows.length/details.query.pageSize)));
 const visible=new Set(rows.slice((page-1)*details.query.pageSize,page*details.query.pageSize).map(row=>row.id));
 const present=({evidence,runtime,...row}:typeof observations[number])=>({...row,runtime:{...runtime,context:visible.has(row.id)?runtime.context:[],series:[]}});
 const clientObservations=observations.map(present);
 const clientById=new Map(clientObservations.map(row=>[row.id,row]));
 const clientRows=rows.map(({monitoring,...row})=>({...row,monitoring:clientById.get(row.id)!}));
 const regions=scope.regions.map(region=>({...region,...monitoringSummary(observations.filter(obs=>{
  const site=catalog.get(obs.id)!;return scope.query.city==="all"?site.cityId===region.id:site.countyId===region.id;
 }))}));
 return {...details,rows:clientRows,query:{...details.query,asOf:window.asOf},summary:scope.summary,regions:scope.regions,snapshotAt:window.asOf,adjusted:window.adjusted,
  previousAsOf:window.previousAsOf,nextAsOf:window.nextAsOf,
  monitoring:{configuration,summary,regions,observations:clientObservations,facets,runtimeSummary,runtimeRegions,runtimeFacets,runtimeFilter:runtimeFilter as "all"|"current"|"warning"|"critical"|"period"|"data"|"alarm",recordState:recordState as RecordState|"all",window}};
}
export type MonitoringModel=ReturnType<typeof monitoringModel>;
export function monitoringPage(model:MonitoringModel){
 const {rows,query,monitoring}=model,total=rows.length,page=Math.min(query.page,Math.max(1,Math.ceil(total/query.pageSize)));
 const visible=rows.slice((page-1)*query.pageSize,page*query.pageSize),ids=new Set(visible.map(row=>row.id));
 return {...model,pagination:{page,total},rows:visible.map(({monitoring:_,...row})=>row),monitoring:{...monitoring,observations:monitoring.observations.filter(row=>ids.has(row.id))}};
}
export type MonitoringPage=ReturnType<typeof monitoringPage>;
