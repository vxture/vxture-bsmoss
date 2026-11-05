import {calendarSource} from './period-rules.ts';
import {DAY_MS,HISTORY_START,dateNumber,isoDay} from './history-calendar.ts';
import type {HistoryAnalysis,HistoryMetric,HistoryValues} from './history-rules.ts';
import {compareMetric,quantile,sumHistory} from './cohort-rules.ts';
import {evaluateWave,WAVE_POLICY} from './station-period-rules.ts';
import {deriveUsageFindings,type ReferenceSlot,type ReviewWindow} from '../usage-verification/rules.ts';
import type {DemoSite,OperatorFilter} from './types.ts';

export const STATION_HISTORY_VERSION='bsmoss-station-history-v1';
export const HISTORY_METRICS=['bytes','voiceSeconds','sms'] as const;
export function peerPortrait(analysis:HistoryAnalysis,target:HistoryValues,siteId:string) {
  const peers=analysis.siteRows.filter(r=>r.id!==siteId),days=analysis.scope.window.days;
  return {count:peers.length,minimum:3,metrics:HISTORY_METRICS.map(metric=>{
    const sorted=peers.map(r=>Number(r.values[metric])/days).sort((a,b)=>a-b);
    const daily=Number(target[metric])/days,median=quantile(sorted,.5),enough=peers.length>=3;
    const lower=peers.filter(r=>compareMetric(r.values,target,metric)<0).length,equal=peers.filter(r=>compareMetric(r.values,target,metric)===0).length;
    return {metric,daily,mean:sorted.length?sorted.reduce((n,v)=>n+v,0)/sorted.length:null,
      median:enough?median:null,p25:enough?quantile(sorted,.25):null,p75:enough?quantile(sorted,.75):null,
      gap:enough&&median!==null&&median>0?daily/median-1:null,percentile:enough?(lower+equal/2)/peers.length:null};
  })};
}
const startOfHour=(date:string,hour:number)=>date+'T'+String(hour).padStart(2,'0')+':00:00+08:00';
const endOfHour=(start:string)=>new Date(Date.parse(start)+3600000).toISOString();
const counters=(value:{bytes:number;voiceSeconds:number;sms:number}):HistoryValues=>({bytes:String(value.bytes),voiceSeconds:value.voiceSeconds,sms:value.sms});
export function stationDayEvidence(site:DemoSite,date:string,operator:OperatorFilter,metric:HistoryMetric,source=calendarSource(site)) {
  const codes=site.operators.filter(code=>operator==='all'||code===operator);
  const dates=WAVE_POLICY.baselineWeeks.map(weeks=>isoDay(dateNumber(date)-weeks*7*DAY_MS));
  const services=codes.map(code=>{
    const windows:ReviewWindow[]=[],hours=Array.from({length:24},(_,hour)=>{
      const values=counters(source.sample(date,hour,code)),start=startOfHour(date,hour);
      const references:ReferenceSlot[]=dates.map(d=>{
        const at=startOfHour(d,hour),available=d>=HISTORY_START;
        return {start:at,end:endOfHour(at),value:available?String(source.sample(d,hour,code)[metric]):null,
          quality:available?'verified':'missing',complete:available,reason:available?'':'outside_history_coverage'};
      });
      const wave=evaluateWave(String(values[metric]),references.filter(r=>r.complete).map(r=>r.value!),WAVE_POLICY.minimum[metric]);
      windows.push({start,end:endOfHour(start),value:String(values[metric]),quality:'verified',complete:true,reason:'',
        expected:true,due:true,eventId:[STATION_HISTORY_VERSION,site.id,code,metric,date,hour].join('/'),references});
      return {hour,start,end:endOfHour(start),values,references,wave};
    });
    return {code,hours,totals:sumHistory(hours.map(h=>h.values)),findings:deriveUsageFindings(windows,metric)};
  });
  const hours=Array.from({length:24},(_,hour)=>({hour,values:sumHistory(services.map(s=>s.hours[hour].values)),
    flaggedServices:services.filter(s=>s.hours[hour].wave.flagged).length,
    insufficientServices:services.filter(s=>s.hours[hour].wave.status==='insufficient').length}));
  const findings=services.flatMap(s=>s.findings.map(f=>({...f,code:s.code})));
  return {version:STATION_HISTORY_VERSION,date,metric,operator,site:{id:site.id,name:site.name,cityId:site.cityId,countyId:site.countyId},
    operators:site.operators,referenceDates:dates,services,hours,totals:sumHistory(services.map(s=>s.totals)),
    findings,policy:WAVE_POLICY,quality:'complete_synthetic' as const};
}
