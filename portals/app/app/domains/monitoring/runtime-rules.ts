import {DEFAULT_MONITORING_PARAMETERS,type MonitoringParameters} from "./parameters";
import {TOPIC_POLICY} from "../business-parameters/policies";
export const RUNTIME_REVIEW_POLICY=TOPIC_POLICY+"/monitoring-review-v1";
export interface RuntimeRecord {at:string;power:"mains"|"battery"|null;temperature:number|null;energyWh:number|null;bytes:number|null}
export type RuntimeLevel="normal"|"warning"|"critical"|"unknown";
export type SignalKind="battery"|"temperature"|"intensity";
export interface RuntimeSignal {kind:SignalKind;level:"warning"|"critical";value:number;threshold:number|null;unit:string}
const finite=(value:number|null):value is number=>value!==null&&Number.isFinite(value);
export function assessRuntime(record:RuntimeRecord,T:Readonly<MonitoringParameters>=DEFAULT_MONITORING_PARAMETERS) {
 const signals:RuntimeSignal[]=[];
 if(T.batteryAttention&&record.power==="battery")signals.push({kind:"battery",level:"warning",value:1,threshold:null,unit:""});
 if(finite(record.temperature)&&record.temperature>=T.temperatureWarningC)signals.push({kind:"temperature",level:record.temperature>=T.temperatureCriticalC?"critical":"warning",value:record.temperature,threshold:record.temperature>=T.temperatureCriticalC?T.temperatureCriticalC:T.temperatureWarningC,unit:"C"});
 const intensity=finite(record.energyWh)&&record.energyWh>=0&&finite(record.bytes)&&record.bytes>0?(record.energyWh/1000)/(record.bytes/1073741824):null;
 if(intensity!==null&&intensity>=T.intensityWarning)signals.push({kind:"intensity",level:intensity>=T.intensityCritical?"critical":"warning",value:intensity,threshold:intensity>=T.intensityCritical?T.intensityCritical:T.intensityWarning,unit:"kWh/GiB"});
 const complete=(record.power==="battery"||record.power==="mains")&&finite(record.temperature)&&finite(record.energyWh)&&record.energyWh>=0;
 const level:RuntimeLevel=signals.some(s=>s.level==="critical")?"critical":signals.length?"warning":complete?"normal":"unknown";
 return {...record,intensity,complete,level,signals};
}
export interface SourceAlarm {id:string;startedAt:string;endedAt:string|null;title:string}
export function alarmEvidence(events:readonly SourceAlarm[]|null,asOf:string,windowStart:string) {
 if(events===null)return {connected:false,open:null,period:null};
 const end=Date.parse(asOf),start=Date.parse(windowStart),unique=new Map(events.map(e=>[e.id,e]));
 const valid=[...unique.values()].filter(e=>Number.isFinite(Date.parse(e.startedAt))&&Date.parse(e.startedAt)<=end&&(e.endedAt===null||Number.isFinite(Date.parse(e.endedAt))&&Date.parse(e.endedAt)>=Date.parse(e.startedAt)));
 return {connected:true,open:valid.filter(e=>e.endedAt===null||Date.parse(e.endedAt)>end).length,period:valid.filter(e=>e.endedAt===null||Date.parse(e.endedAt)>start).length};
}
export function reviewRuntime(records:readonly RuntimeRecord[],asOf:string,windowStart:string,alarms:readonly SourceAlarm[]|null=null,parameters:Readonly<MonitoringParameters>=DEFAULT_MONITORING_PARAMETERS,policy:string=RUNTIME_REVIEW_POLICY) {
 const end=Date.parse(asOf),start=Date.parse(windowStart);
 const context=[...new Map(records.filter(r=>Number.isFinite(Date.parse(r.at))&&Date.parse(r.at)<=end).map(r=>[Date.parse(r.at),r])).values()].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)).map(record=>assessRuntime(record,parameters));
 const series=context.filter(r=>Date.parse(r.at)>=start);
 const latest=context.at(-1)??null;
 // An old observation cannot stand in for an assessed current hour.
 const current=latest&&Date.parse(latest.at)===end?latest:null;
 const clues:{id:string;kind:SignalKind;level:"warning"|"critical";firstSeen:string;lastSeen:string;clearedAt:string|null;hits:number;max:number;unit:string}[]=[];
 for(const row of series)for(const signal of row.signals){
  const previous=clues.findLast(clue=>clue.kind===signal.kind);
  if(previous&&Date.parse(row.at)-Date.parse(previous.lastSeen)===3600000){previous.lastSeen=row.at;previous.hits++;previous.max=Math.max(previous.max,signal.value);if(signal.level==="critical")previous.level="critical";}
  else clues.push({id:signal.kind+"/"+row.at,kind:signal.kind,level:signal.level,firstSeen:row.at,lastSeen:row.at,clearedAt:null,hits:1,max:signal.value,unit:signal.unit});
 }
 for(const clue of clues){const next=series.find(r=>Date.parse(r.at)===Date.parse(clue.lastSeen)+3600000);const assessable=next&&(clue.kind==="battery"?(next.power==="mains"||next.power==="battery"):clue.kind==="temperature"?finite(next.temperature):next.intensity!==null);
  if(next&&assessable&&!next.signals.some(s=>s.kind===clue.kind))clue.clearedAt=next.at;
 }
 return {policy,current,level:current?.level??"unknown",latest:latest?.at??null,context,series,clues,
  periodAbnormal:series.some(r=>r.signals.length>0),currentSignals:current?.signals??[],alarms:alarmEvidence(alarms,asOf,windowStart)};
}
export type RuntimeReview=ReturnType<typeof reviewRuntime>;
export function summarizeReviews(rows:readonly {id:string;runtime:RuntimeReview}[]) {
 const unique=[...new Map(rows.map(row=>[row.id,row])).values()];
 const levels={normal:0,warning:0,critical:0,unknown:0};for(const row of unique)levels[row.runtime.level]++;
 const periodAbnormal=unique.filter(row=>row.runtime.periodAbnormal).length;
 const critical=unique.filter(row=>row.runtime.clues.some(clue=>clue.level==="critical")).length;
 const periodLevels={warning:periodAbnormal-critical,critical};
 return {sites:unique.length,levels,periodLevels,currentAbnormal:levels.warning+levels.critical,periodAbnormal,
  alarmSites:unique.length&&unique.every(row=>row.runtime.alarms.connected)?unique.filter(row=>(row.runtime.alarms.open??0)>0).length:null,
  dataIncomplete:unique.filter(row=>!row.runtime.current?.complete).length,
  signals:(["battery","temperature","intensity"] as const).map(kind=>{
   const critical=unique.filter(row=>row.runtime.clues.some(c=>c.kind===kind&&c.level==="critical")).length;
   const period=unique.filter(row=>row.runtime.clues.some(c=>c.kind===kind)).length;
   const monitored=unique.filter(row=>row.runtime.series.some(sample=>kind==="battery"?(sample.power==="battery"||sample.power==="mains"):kind==="temperature"?finite(sample.temperature):sample.intensity!==null)).length;
   return {kind,current:unique.filter(row=>row.runtime.currentSignals.some(s=>s.kind===kind)).length,period,warning:period-critical,critical,monitored,monitoredShare:unique.length?monitored/unique.length:null};
  })};
}
