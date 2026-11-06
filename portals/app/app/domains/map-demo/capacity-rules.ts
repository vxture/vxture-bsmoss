import { TOPIC_THRESHOLDS as T } from "../business-parameters/policies";
import {siteHour,DEMO_DATE,DEMO_VERSION} from './rules';
import {analyzeTopic,evaluateTopic,TOPIC_POLICY} from './topic-rules';
import {OPERATOR_CODES,type DemoSite,type HourMetrics,type MapQuery} from './types';

export const CAPACITY_MODEL='bsmoss-capacity-contributions-v1';
type Counters=Pick<HourMetrics,'used'|'capacity'|'attempts'|'connected'>;
export function capacityObservation(m:Counters){
 const load=m.capacity>0?m.used/m.capacity:null,connection=m.attempts>0?m.connected/m.attempts:null;
 return {...m,failed:m.attempts-m.connected,load,connection,
  highLoad:load!==null&&load>=T.loadWarningPct/100,lowConnection:connection!==null&&connection<T.connectionWarningPct/100};
}
export function summarizeCapacity(metrics:readonly HourMetrics[]){
 let used=0,capacity=0,attempts=0,connected=0,capacityKnown=0,connectionKnown=0,highLoad=0,lowConnection=0,both=0,attention=0,unknown=0;
 for(const m of metrics){
  const o=capacityObservation(m),signal=evaluateTopic('capacity',m);
  used+=m.used;capacity+=m.capacity;attempts+=m.attempts;connected+=m.connected;
  capacityKnown+=Number(o.load!==null);connectionKnown+=Number(o.connection!==null);
  highLoad+=Number(o.highLoad);lowConnection+=Number(o.lowConnection);both+=Number(o.highLoad&&o.lowConnection);
  attention+=Number(signal.level==='critical'||signal.level==='warning');unknown+=Number(signal.level==='unknown');
 }
 return {sites:metrics.length,...capacityObservation({used,capacity,attempts,connected}),capacityKnown,connectionKnown,highLoad,lowConnection,both,attention,unknown};
}
const aggregate=(sites:readonly DemoSite[],hour:number,operator:MapQuery['operator'])=>summarizeCapacity(sites.map(site=>siteHour(site,hour,operator)));
export function capacityShares(row:{used:number;failed:number},total:{used:number;failed:number}){
 return {usedShare:total.used>0?row.used/total.used:null,failedShare:total.failed>0?row.failed/total.failed:null};
}
export function analyzeCapacity(sites:readonly DemoSite[],q:MapQuery){
 const total=aggregate(sites,q.hour,q.operator);
 const withShares=(members:readonly DemoSite[],operator=q.operator)=>{
  const row=aggregate(members,q.hour,operator);
  return {...row,...capacityShares(row,total)};
 };
 const regionLevel=q.cityId==='all'?'city':q.countyId==='all'?'county':'current';
 const groups=new Map<string,DemoSite[]>();
 for(const s of sites){const id=regionLevel==='city'?s.cityId:s.countyId;const group=groups.get(id)??[];group.push(s);groups.set(id,group);}
 const regions=[...groups].map(([id,members])=>({id,...withShares(members)})).sort((a,b)=>b.failed-a.failed||b.used-a.used||a.id.localeCompare(b.id));
 const operators=OPERATOR_CODES.filter(code=>q.operator==='all'||q.operator===code).map(code=>({code,...withShares(sites.filter(s=>s.operators.includes(code)),code)})).filter(r=>r.sites>0);
 const topic=analyzeTopic(sites,q,'capacity');
 const priority=topic.priority.map(p=>{
  const site=sites.find(s=>s.id===p.id)!;
  const series=Array.from({length:24},(_,hour)=>{const m=siteHour(site,hour,q.operator);return {hour,...capacityObservation({used:m.used,capacity:m.capacity,attempts:m.attempts,connected:m.connected}),level:evaluateTopic('capacity',m).level};});
  return {id:site.id,name:site.name,cityId:site.cityId,countyId:site.countyId,current:series[q.hour],series};
 });
 return {version:CAPACITY_MODEL,sourceVersion:DEMO_VERSION,policyVersion:TOPIC_POLICY,observedAt:DEMO_DATE+'T'+String(q.hour).padStart(2,'0')+':00:00+08:00',
  regionLevel,total,regions,operators,priority,series:Array.from({length:24},(_,hour)=>({hour,...aggregate(sites,hour,q.operator)}))};
}
export type CapacityAnalysis=ReturnType<typeof analyzeCapacity>;
