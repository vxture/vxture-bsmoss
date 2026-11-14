import {test} from "node:test";
import assert from "node:assert/strict";
import {assessRuntime,reviewRuntime,alarmEvidence,summarizeReviews,type RuntimeRecord} from "./runtime-rules";
const at=(hour:number)=>`2026-10-25T${String(hour).padStart(2,"0")}:00:00+08:00`;
const record=(hour:number,patch:Partial<RuntimeRecord>={}):RuntimeRecord=>({at:at(hour),power:"mains",temperature:25,energyWh:100,bytes:1073741824,...patch});
test("runtime references classify battery as attention and preserve temperature/intensity boundaries",()=>{
 assert.equal(assessRuntime(record(0)).level,"normal");
 assert.equal(assessRuntime(record(0,{power:"battery"})).level,"warning");
 assert.equal(assessRuntime(record(0,{temperature:35})).level,"warning");
 assert.equal(assessRuntime(record(0,{temperature:40})).level,"critical");
 assert.equal(assessRuntime(record(0,{energyWh:150})).level,"warning");
 assert.equal(assessRuntime(record(0,{energyWh:300})).level,"critical");
 assert.equal(assessRuntime(record(0,{energyWh:0})).intensity,0);
 assert.equal(assessRuntime(record(0,{bytes:0})).intensity,null);
 assert.equal(assessRuntime(record(0,{temperature:null})).level,"unknown");
 assert.equal(assessRuntime(record(0,{energyWh:-1})).complete,false);
 assert.equal(assessRuntime(record(0,{energyWh:NaN})).complete,false);
});
test("current uses exact endpoint, deduplicates timestamps and excludes future samples",()=>{
 const r=reviewRuntime([record(0,{temperature:40}),record(1),record(1),record(2,{temperature:50})],at(1),at(0));
 assert.equal(r.context.length,2);assert.equal(r.level,"normal");assert.equal(r.periodAbnormal,true);
 assert.equal(r.clues[0].clearedAt,at(1));assert.equal(r.alarms.open,null);
 const stale=reviewRuntime([record(0)],at(1),at(0));assert.equal(stale.current,null);assert.equal(stale.level,"unknown");
});
test("rule runs merge only consecutive hours; invalid or missing observations never prove recovery",()=>{
 const r=reviewRuntime([record(0,{temperature:35}),record(1,{temperature:41}),record(2,{temperature:NaN}),record(4,{temperature:36}),record(5)],at(5),at(0));
 assert.equal(r.clues.length,2);assert.equal(r.clues[0].hits,2);assert.equal(r.clues[0].level,"critical");assert.equal(r.clues[0].clearedAt,null);
 assert.equal(r.clues[1].clearedAt,at(5));
 const hour=reviewRuntime([record(0,{power:"battery"}),record(1)],at(1),at(1));
 assert.equal(hour.periodAbnormal,false);assert.equal(hour.clues.length,0);assert.equal(hour.context.length,2);assert.equal(hour.series.length,1);
});
test("alarm source unknown differs from confirmed empty; historical as-of respects evidence intervals",()=>{
 assert.equal(alarmEvidence(null,at(2),at(0)).open,null);
 assert.equal(alarmEvidence([],at(2),at(0)).open,0);
 const events=[{id:"A",startedAt:at(0),endedAt:at(3),title:"source"},{id:"B",startedAt:at(4),endedAt:null,title:"future"}];
 assert.deepEqual(alarmEvidence([...events,events[0]],at(2),at(0)),{connected:true,open:1,period:1});
 assert.deepEqual(alarmEvidence(events,at(3),at(3)),{connected:true,open:0,period:0});
});
test("summary deduplicates stations and keeps current, historical and incomplete evidence separate",()=>{
 const a={id:"A",runtime:reviewRuntime([record(0,{temperature:40}),record(1)],at(1),at(0))};
 const b={id:"B",runtime:reviewRuntime([record(1,{power:"battery",temperature:null})],at(1),at(0))};
 const r=summarizeReviews([a,a,b]);assert.equal(r.sites,2);assert.equal(r.currentAbnormal,1);assert.equal(r.periodAbnormal,2);assert.equal(r.dataIncomplete,1);assert.equal(r.alarmSites,null);
});
test("period signal severity is exclusive per station, while valid monitoring uses the regional station denominator",()=>{
 const a={id:"A",runtime:reviewRuntime([record(0,{temperature:35}),record(1,{temperature:40}),record(2,{temperature:36})],at(2),at(0))};
 const b={id:"B",runtime:reviewRuntime([record(2,{temperature:35,power:"battery",bytes:0})],at(2),at(0))};
 const c={id:"C",runtime:reviewRuntime([record(2,{temperature:null,power:null,bytes:null})],at(2),at(0))};
 const summary=summarizeReviews([a,a,b,c]);
 const temperature=summary.signals.find(s=>s.kind==="temperature")!;
 assert.equal(temperature.warning,1);assert.equal(temperature.critical,1);assert.equal(temperature.period,2);
 assert.equal(temperature.monitored,2);assert.equal(temperature.monitoredShare,2/3);
 const battery=summary.signals.find(s=>s.kind==="battery")!;
 assert.equal(battery.warning,1);assert.equal(battery.critical,0);
 const intensity=summary.signals.find(s=>s.kind==="intensity")!;
 assert.equal(intensity.monitored,1);assert.equal(intensity.monitoredShare,1/3);
 const hour=summarizeReviews([{id:"A",runtime:reviewRuntime([record(0,{temperature:40}),record(1),record(2,{temperature:50})],at(1),at(1))}]);
 assert.equal(hour.signals[1].warning,0);assert.equal(hour.signals[1].critical,0);assert.equal(hour.signals[1].monitoredShare,1);
 assert.equal(summarizeReviews([]).signals[0].monitoredShare,null);
 const unknown=summarizeReviews([{id:"D",runtime:reviewRuntime([],at(1),at(1))}]);
 assert.equal(unknown.signals[0].monitored,0);assert.equal(unknown.signals[0].monitoredShare,0);
});
test("regional period severity counts each station once across overlapping signals and recovered hours",()=>{
 const a={id:"A",runtime:reviewRuntime([record(0,{power:"battery",temperature:40,energyWh:300}),record(1)],at(1),at(0))};
 const b={id:"B",runtime:reviewRuntime([record(0,{power:"battery",temperature:35}),record(1)],at(1),at(0))};
 const c={id:"C",runtime:reviewRuntime([record(1)],at(1),at(0))};
 const summary=summarizeReviews([a,a,b,c]);
 assert.deepEqual(summary.periodLevels,{warning:1,critical:1});
 assert.equal(summary.periodAbnormal,2);assert.equal(summary.currentAbnormal,0);
 assert.ok(summary.signals.reduce((sum,s)=>sum+s.period,0)>summary.periodAbnormal);
 assert.deepEqual(summarizeReviews([]).periodLevels,{warning:0,critical:0});
});
