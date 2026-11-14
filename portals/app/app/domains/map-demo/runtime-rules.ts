import { TOPIC_THRESHOLDS as T } from "../business-parameters/policies";
import {siteHour,GIB,DEMO_DATE,DEMO_VERSION} from './rules';
import {analyzeTopic,TOPIC_POLICY} from './topic-rules';
import {resourceScope,type ResourceGraph} from '../site-registry/resource-rules';
import type {DemoSite,MapQuery,TopicLevel} from './types';

export const RUNTIME_MODEL='bsmoss-runtime-energy-coverage-v1';
export type RuntimeSample={energyWh:number|null;bytes:number;temperature:number|null;power:'mains'|'battery'|null};
export function runtimeObservation(m:RuntimeSample,allocated=true){
 const intensity=m.energyWh!==null&&m.bytes>0?(m.energyWh/1000)/(m.bytes/GIB):null;
 const powerLevel:TopicLevel=m.power==='battery'||m.temperature!==null&&m.temperature>=T.temperatureCriticalC?'critical':m.temperature!==null&&m.temperature>=T.temperatureWarningC?'warning':m.power===null||m.temperature===null?'unknown':'normal';
 const efficiencyLevel:TopicLevel=intensity===null?'unknown':intensity>=T.intensityCritical?'critical':intensity>=T.intensityWarning?'warning':'normal';
 return {...m,intensity,powerLevel,efficiencyLevel,energyUnknown:m.energyWh===null?(allocated?'missing':'unallocated'):null,
  zeroTraffic:m.energyWh!==null&&m.bytes===0};
}
export function summarizeRuntime(samples:readonly RuntimeSample[],allocated=true){
 let energy=0,energyKnown=0,pairedBytes=0,bytes=0,powerKnown=0,temperatureKnown=0,battery=0,mains=0,temperatureMax:number|null=null,efficiencyKnown=0,zeroTraffic=0,missingEnergy=0,unallocated=0,powerAttention=0,efficiencyAttention=0;
 for(const m of samples){
  const o=runtimeObservation(m,allocated);bytes+=m.bytes;
  if(m.energyWh!==null){energy+=m.energyWh;energyKnown++;pairedBytes+=m.bytes;}else if(allocated)missingEnergy++;else unallocated++;
  if(m.power!==null)powerKnown++;if(m.power==='battery')battery++;if(m.power==='mains')mains++;
  if(m.temperature!==null){temperatureKnown++;temperatureMax=temperatureMax===null?m.temperature:Math.max(temperatureMax,m.temperature);}
  efficiencyKnown+=Number(o.intensity!==null);zeroTraffic+=Number(o.zeroTraffic);
  powerAttention+=Number(o.powerLevel==='critical'||o.powerLevel==='warning');efficiencyAttention+=Number(o.efficiencyLevel==='critical'||o.efficiencyLevel==='warning');
 }
 return {sites:samples.length,energyWh:energyKnown>0?energy:null,energyKnown,pairedBytes,bytes,powerKnown,temperatureKnown,battery,mains,temperatureMax,efficiencyKnown,zeroTraffic,missingEnergy,unallocated,powerAttention,efficiencyAttention,
  intensity:energyKnown>0&&pairedBytes>0?(energy/1000)/(pairedBytes/GIB):null};
}
export function runtimeResourceCoverage(graphs:readonly ResourceGraph[],q:Pick<MapQuery,'operator'>){
 const devices=new Map(graphs.flatMap(g=>resourceScope(g,q.operator).devices).map(d=>[d.id,d]));
 const unknown=[...devices.values()].filter(d=>d.state==='unknown').length;
 return {devices:devices.size,known:devices.size-unknown,unknown,version:graphs[0]?.version??null};
}
export function analyzeRuntime(sites:readonly DemoSite[],q:MapQuery,graphs:readonly ResourceGraph[]){
 const ids=new Set(sites.map(s=>s.id));graphs=graphs.filter(g=>ids.has(g.physical.id));
 const allocated=q.operator==='all',aggregate=(members:readonly DemoSite[],hour:number)=>summarizeRuntime(members.map(s=>siteHour(s,hour,q.operator)),allocated);
 const total=aggregate(sites,q.hour),regionLevel=q.cityId==='all'?'city':q.countyId==='all'?'county':'current';
 const groups=new Map<string,DemoSite[]>();for(const s of sites){const id=regionLevel==='city'?s.cityId:s.countyId;const members=groups.get(id)??[];members.push(s);groups.set(id,members);}
 const regions=[...groups].map(([id,members])=>{const r=aggregate(members,q.hour);return {id,...r,energyShare:r.energyWh!==null&&total.energyWh!==null&&total.energyWh>0?r.energyWh/total.energyWh:null};})
  .sort((a,b)=>b.powerAttention-a.powerAttention||b.efficiencyAttention-a.efficiencyAttention||(b.energyWh??-1)-(a.energyWh??-1)||a.id.localeCompare(b.id));
 const kind=q.topic==='power'?'power':'efficiency';
 const priority=analyzeTopic(sites,q,kind).priority.map(p=>{
  const site=sites.find(s=>s.id===p.id)!;
  const series=Array.from({length:24},(_,hour)=>({hour,...runtimeObservation(siteHour(site,hour,q.operator),allocated)}));
  const graph=graphs.find(g=>g.physical.id===site.id);
  return {id:site.id,name:site.name,current:series[q.hour],series,resources:runtimeResourceCoverage(graph?[graph]:[],q)};
 });
 return {version:RUNTIME_MODEL,sourceVersion:DEMO_VERSION,policyVersion:TOPIC_POLICY,observedAt:DEMO_DATE+'T'+String(q.hour).padStart(2,'0')+':00:00+08:00',
  kind,allocated,total,regionLevel,regions,resources:runtimeResourceCoverage(graphs,q),priority,series:Array.from({length:24},(_,hour)=>({hour,...aggregate(sites,hour)}))};
}
export type RuntimeAnalysis=ReturnType<typeof analyzeRuntime>;
