import type {BusinessCounters} from '../domains/business-usage/rules';
import type {GenerationQuery} from './generation-rules';
import type {ReportAnalysis} from './analysis-rules';
export interface BusinessReport {
 schema:'business-usage-report-v1';id:string;scope:GenerationQuery;scopeLabel:string;sourceVersion:string;templateVersion:string;updatedThrough:string|null;operatorNames:Record<string,string>;
 window:{start:string;end:string};coverage:{label:string;daily:boolean;observed:number;expected:number};sites:number;total:BusinessCounters;
 operators:(BusinessCounters&{code:string;sites:number})[];
 regions:(BusinessCounters&{id:string;name:string;city:string;county:string;sites:number})[];
 series:(BusinessCounters&{key:string;label:string})[];
 stations:(BusinessCounters&{id:string;name:string;cityName:string;countyName:string})[];
 analysis?:ReportAnalysis;
}
// Stored snapshots are data, including when their outer checksum is valid.
export function readBusinessReport(value:unknown):BusinessReport{
 const r=value as BusinessReport,keys=['bytes','upBytes','downBytes','voiceSeconds','attempts','connected','sms'] as const;
 const invalid=()=>{throw Error('invalid_business_report');};
 if(!r||r.schema!=='business-usage-report-v1'||typeof r.id!=='string'||!/^BU-[a-f0-9]{24}$/.test(r.id)||!Number.isSafeInteger(r.sites)||r.sites<0||typeof r.scopeLabel!=='string'||!r.operatorNames||Object.values(r.operatorNames).some(v=>typeof v!=='string')||!r.window||![r.window.start,r.window.end].every(v=>typeof v==='string'&&Number.isFinite(Date.parse(v)))||Date.parse(r.window.end)<=Date.parse(r.window.start)||!r.coverage||typeof r.coverage.label!=='string'||!Number.isSafeInteger(r.coverage.observed)||!Number.isSafeInteger(r.coverage.expected)||r.coverage.observed<0||r.coverage.observed>r.coverage.expected)invalid();
 const counters=(row:BusinessCounters)=>{if(!row)invalid();for(const key of keys){const v=row[key];if(key==='bytes'||key==='upBytes'||key==='downBytes'){if(typeof v!=='string'||!/^\d{1,40}$/.test(v))invalid();}else if(typeof v!=='number'||!Number.isSafeInteger(v)||v<0)invalid();}if(BigInt(row.bytes)!==BigInt(row.upBytes)+BigInt(row.downBytes))invalid();};
 counters(r.total);
 for(const rows of [r.operators,r.regions,r.series,r.stations]){
  if(!Array.isArray(rows)||rows.length>10000)invalid();
  const sums=keys.map(()=>0n);for(const row of rows){counters(row);keys.forEach((key,i)=>sums[i]+=BigInt(row[key]));}
  keys.forEach((key,i)=>{if(sums[i]!==BigInt(r.total[key]))invalid();});
 }
 if(r.stations.length!==r.sites||r.stations.some(row=>typeof row.id!=='string'||typeof row.name!=='string'||typeof row.cityName!=='string'||typeof row.countyName!=='string')||r.operators.some(row=>typeof row.code!=='string'||!Number.isSafeInteger(row.sites))||r.regions.some(row=>typeof row.id!=='string'||typeof row.name!=='string')||r.series.some(row=>typeof row.key!=='string'||typeof row.label!=='string'))invalid();
 if(r.templateVersion==='bsmoss-business-report-v2'&&!r.analysis)invalid();
 if(r.analysis){
  const a=r.analysis,o=a.operations,integer=(v:number)=>Number.isSafeInteger(v)&&v>=0,rate=(v:number|null)=>v===null||typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1;
  if(a.version!=='business-report-analysis-v1'||!integer(a.days)||a.days<1||!integer(a.serviceRelations)||a.serviceRelations!==r.operators.reduce((n,p)=>n+p.sites,0)||!integer(a.sharedSites)||a.sharedSites>r.sites||!o||!['used','capacity','physicalSamples','serviceSamples','batterySamples','batterySites'].every(k=>integer(o[k as keyof typeof o] as number))||o.used>o.capacity||o.batterySamples>o.physicalSamples||o.batterySites>r.sites||!rate(o.connectionRate)||!rate(o.load)||o.connectionRate!==(r.total.attempts?r.total.connected/r.total.attempts:null)||o.load!==(o.capacity?o.used/o.capacity:null)||o.energyWh!==null&&!integer(o.energyWh)||r.scope.operator!=='all'&&o.energyWh!==null)invalid();
  for(const k of ['temperatureMean','temperatureMin','temperatureMax','energyPerGiB'] as const)if(o[k]!==null&&(typeof o[k]!=='number'||!Number.isFinite(o[k])))invalid();
  if(!Array.isArray(a.timeline)||a.timeline.length!==r.series.length||a.timeline.some((s,i)=>s.key!==r.series[i].key||!integer(s.used)||!integer(s.capacity)||!rate(s.load)||!rate(s.connectionRate)||s.energyWh!==null&&!integer(s.energyWh))||a.timeline.reduce((n,s)=>n+s.used,0)!==o.used||a.timeline.reduce((n,s)=>n+s.capacity,0)!==o.capacity)invalid();
  if(!Array.isArray(a.operators)||a.operators.length!==r.operators.length||a.operators.some(s=>!r.operators.some(p=>p.code===s.code)||!integer(s.used)||!integer(s.capacity)||!rate(s.load)||!rate(s.connectionRate))||!Array.isArray(a.ranking)||a.ranking.length>5||a.ranking.some(s=>!r.stations.some(p=>p.id===s.id&&p.bytes===s.bytes)||!/^\d+$/.test(s.peakBytes)||typeof s.peakKey!=='string'))invalid();
  if(!Array.isArray(a.cohorts)||a.cohorts.length>100)invalid();
  for(const kind of ['scene','siteType','sharing']){const members=a.cohorts.filter(s=>s.kind===kind);if(members.reduce((n,s)=>n+s.sites,0)!==r.sites)invalid();for(const s of members)counters(s);for(const key of keys)if(members.reduce((n,s)=>n+BigInt(s[key]),0n)!==BigInt(r.total[key]))invalid();}
  const timestamp=(v:string)=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:00:00$/.test(v)&&Number.isFinite(Date.parse(v));
  if(a.busy&&(!timestamp(a.busy.key)||!/^\d+$/.test(a.busy.bytes)||!rate(a.busy.share))||a.highestLoad&&(!timestamp(a.highestLoad.key)||!rate(a.highestLoad.value))||a.lowestConnection&&(!timestamp(a.lowestConnection.key)||!rate(a.lowestConnection.value))||a.ranking.some(s=>typeof s.name!=='string'||!timestamp(s.peakKey))||a.cohorts.some(s=>!['scene','siteType','sharing'].includes(s.kind)||typeof s.code!=='string'||!integer(s.sites)))invalid();
  if(!a.comparisons||Object.keys(a.comparisons).sort().join()!=='previous,year')invalid();for(const c of Object.values(a.comparisons)){if(!c||!integer(c.days)||c.days<1||typeof c.available!=='boolean'||!Number.isFinite(Date.parse(c.start))||!Number.isFinite(Date.parse(c.end))||!c.metrics||!Array.isArray(c.increase)||!Array.isArray(c.decrease)||c.increase.length>5||c.decrease.length>5||!/^\d+$/.test(c.positive)||! /^-?\d+$/.test(c.negative)||[...c.increase,...c.decrease].some(s=>typeof s.id!=='string'||typeof s.name!=='string'||! /^-?\d+$/.test(s.delta)))invalid();if(c.total)counters(c.total);if(c.available!==!!c.total)invalid();for(const key of ['bytes','voiceSeconds','connected','sms'] as const){const m=c.metrics[key];if(!m||m.current!==String(r.total[key])||!/^\d+$/.test(m.previous)||c.total&&m.previous!==String(c.total[key])||m.delta!==(c.available?String(BigInt(m.current)-BigInt(m.previous)):null)||![m.rate,m.dailyRate].every(v=>v===null||typeof v==='number'&&Number.isFinite(v)))invalid();}}
 }
 return r;
}
