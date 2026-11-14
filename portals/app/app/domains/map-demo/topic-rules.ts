import { TOPIC_THRESHOLDS as T } from "../business-parameters/policies.ts";
import {DEFAULT_CAPACITY_PARAMETERS,capacityMetricLevel,type CapacityParameters} from "../capacity/parameters.ts";
export { TOPIC_POLICY } from "../business-parameters/policies.ts";
import { TOPIC_POLICY } from "../business-parameters/policies.ts";
import {siteHour,GIB} from './rules.ts';
import type {DemoSite,HourMetrics,MapQuery,TopicKind,TopicSignal,TopicCounts,TopicAnalysis} from './types.ts';
export const TOPIC_KINDS=['capacity','power','efficiency'] as const;
export function parseTopic(value:string):TopicKind {
  if(!TOPIC_KINDS.includes(value as TopicKind))throw Error('invalid_topic');return value as TopicKind;
}
// Demonstration thresholds are explicit observations, never maintenance orders or diagnoses.
export function evaluateCapacity(m:Pick<HourMetrics,'used'|'capacity'|'attempts'|'connected'>,parameters:CapacityParameters=DEFAULT_CAPACITY_PARAMETERS):TopicSignal {
    const value=m.capacity>0?m.used/m.capacity*100:null,secondary=m.attempts>0?m.connected/m.attempts*100:null;
    const load=capacityMetricLevel(m.capacity>0?m.used/m.capacity:null,'load',parameters),connection=capacityMetricLevel(m.attempts>0?m.connected/m.attempts:null,'connection',parameters);
    const level=load==='critical'||connection==='critical'?'critical':load==='warning'||connection==='warning'?'warning':load==='unknown'||connection==='unknown'?'unknown':'normal';
    return {level,value,secondary};
}
export function evaluateTopic(kind:TopicKind,m:HourMetrics,parameters:CapacityParameters=DEFAULT_CAPACITY_PARAMETERS):TopicSignal {
  if(kind==='capacity')return evaluateCapacity(m,parameters);
  if(kind==='power')return {level:m.power==='battery'||m.temperature>=T.temperatureCriticalC?'critical':m.temperature>=T.temperatureWarningC?'warning':'normal',value:m.power==='battery'?1:0,secondary:m.temperature};
  const value=m.energyWh===null||m.bytes<=0?null:(m.energyWh/1000)/(m.bytes/GIB);
  return {level:value===null?'unknown':value>=T.intensityCritical?'critical':value>=T.intensityWarning?'warning':'normal',value,secondary:m.energyWh===null?null:m.energyWh/1000};
}
const counts=():TopicCounts=>({total:0,normal:0,warning:0,critical:0,unknown:0});
const add=(c:TopicCounts,signal:TopicSignal)=>{c.total++;c[signal.level]++;};
export function analyzeTopic(sites:readonly DemoSite[],q:MapQuery,kind:TopicKind):TopicAnalysis {
  const current=counts(),cities=new Map<string,TopicCounts>();let affectedBytes=0;
  const priority:TopicAnalysis['priority']=[];
  for(const site of sites){
    const m=siteHour(site,q.hour,q.operator),signal=evaluateTopic(kind,m);add(current,signal);
    const city=cities.get(site.cityId)??counts();add(city,signal);cities.set(site.cityId,city);
    if(signal.level==='warning'||signal.level==='critical'){affectedBytes+=m.bytes;priority.push({...signal,id:site.id,name:site.name,cityId:site.cityId,bytes:m.bytes});}
  }
  const severity={critical:0,warning:1,unknown:2,normal:3};
  priority.sort((a,b)=>severity[a.level]-severity[b.level]||(kind==='capacity'?(b.value??0)-(a.value??0)||((a.secondary??100)-(b.secondary??100)):kind==='power'?(b.value??0)-(a.value??0)||(b.secondary??0)-(a.secondary??0):(b.value??0)-(a.value??0))||b.bytes-a.bytes||a.id.localeCompare(b.id));
  return {kind,policyVersion:TOPIC_POLICY,counts:current,affectedBytes,priority:priority.slice(0,6),
    cities:[...cities].map(([cityId,c])=>({cityId,...c})).sort((a,b)=>b.critical-a.critical||b.warning-a.warning||a.cityId.localeCompare(b.cityId)),
    series:Array.from({length:24},(_,hour)=>{const c=counts();for(const site of sites)add(c,evaluateTopic(kind,siteHour(site,hour,q.operator)));return {hour,...c};})};
}
