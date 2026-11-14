export const MONITORING_METRICS = ["power", "temperature", "energy"] as const;
export type MonitoringMetric = typeof MONITORING_METRICS[number];
export type RecordState = "observed" | "missing" | "unconnected" | "unknown";
export interface MonitoringEvidence {
 metric: MonitoringMetric;
 connected: boolean | null;
 applicable: boolean | null;
 expected: boolean | null;
 samples: { at: string; value: number | string | null }[];
}
export function validValue(metric: MonitoringMetric, value: unknown): boolean {
 return metric === "power" ? value === "mains" || value === "battery" :
  typeof value === "number" && Number.isFinite(value) && (metric !== "energy" || value >= 0);
}
export function metricEvidence(evidence: MonitoringEvidence) {
 const samples=evidence.samples.filter(s=>Number.isFinite(Date.parse(s.at))&&validValue(evidence.metric,s.value));
 const latest=samples.reduce<string|null>((last,s)=>last===null||Date.parse(s.at)>Date.parse(last)?s.at:last,null);
 // Positive record evidence wins over stale connection metadata. Absence never proves offline.
 const state:RecordState=samples.length?"observed":evidence.connected===false?"unconnected":evidence.expected===true&&evidence.applicable===true?"missing":"unknown";
 return {metric:evidence.metric,state,latest,records:new Set(samples.map(s=>Date.parse(s.at))).size,applicable:evidence.applicable};
}
export function stationEvidence(evidence:MonitoringEvidence[]) {
 const metrics=MONITORING_METRICS.map(metric=>metricEvidence(evidence.find(e=>e.metric===metric)??{metric,connected:null,applicable:null,expected:null,samples:[]}));
 const state:RecordState=metrics.some(m=>m.state==="missing")?"missing":metrics.some(m=>m.state==="observed")?"observed":metrics.every(m=>m.state==="unconnected")?"unconnected":"unknown";
 const latest=metrics.reduce<string|null>((last,m)=>m.latest!==null&&(last===null||Date.parse(m.latest)>Date.parse(last))?m.latest:last,null);
 return {state,latest,metrics,observedMetrics:metrics.filter(m=>m.state==="observed").length};
}
export function monitoringSummary(rows:readonly {id:string;evidence:MonitoringEvidence[]}[]) {
 const unique=new Map<string,MonitoringEvidence[]>();
 for(const row of rows)unique.set(row.id,[...(unique.get(row.id)??[]),...row.evidence]);
 const stations=[...unique].map(([id,evidence])=>({id,...stationEvidence(MONITORING_METRICS.map(metric=>{
  const group=evidence.filter(e=>e.metric===metric);
  const agree=(key:"connected"|"applicable"|"expected")=>group.length&&group.every(e=>e[key]===true)?true:group.length&&group.every(e=>e[key]===false)?false:null;
  return {metric,connected:agree("connected"),applicable:agree("applicable"),expected:agree("expected"),samples:group.flatMap(e=>e.samples)};
 }))}));
 const counts={observed:0,missing:0,unconnected:0,unknown:0};
 for(const row of stations)counts[row.state]++;
 const metrics=MONITORING_METRICS.map(metric=>{
  const all=stations.map(s=>s.metrics.find(m=>m.metric===metric)!);
  const observed=all.filter(m=>m.state==="observed").length;
  const applicable=all.filter(m=>m.applicable===true).length;
  const applicabilityKnown=all.length>0&&all.every(m=>m.applicable!==null);
  return {metric,observed,missing:all.filter(m=>m.state==="missing").length,applicable:applicabilityKnown?applicable:null,
   coverage:applicabilityKnown&&applicable>0?all.filter(m=>m.applicable===true&&m.state==="observed").length/applicable:null};
 });
 return {sites:stations.length,withRecords:stations.filter(s=>s.observedMetrics>0).length,counts,metrics};
}
