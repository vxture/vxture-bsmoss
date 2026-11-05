import {calendarSource} from './period-rules.ts';
import {DAY_MS,HISTORY_END,HISTORY_START,HISTORY_VERSION,dateNumber,isoDay,monthEnd,yearBefore} from './history-calendar.ts';
import type {DemoSite,MapQuery,Operator} from './types.ts';

export type HistoryRange='12m'|'year'|'quarter'|'month'|'custom';
export type HistoryMetric='bytes'|'voiceSeconds'|'sms';
export type HistoryValues={bytes:string;voiceSeconds:number;sms:number};
type Exact={bytes:bigint;voiceSeconds:number;sms:number};
export type HistorySample={code:Operator;values:HistoryValues};
export interface HistoryWindow {start:string;end:string;days:number;grain:'month'|'day'}
export interface HistoryScope {query:MapQuery;range:HistoryRange;window:HistoryWindow;metric:HistoryMetric;site?:string}
export const emptyHistory=():Exact=>({bytes:0n,voiceSeconds:0,sms:0});
function add(target:Exact,value:HistoryValues) {
  target.bytes+=BigInt(value.bytes);target.voiceSeconds+=value.voiceSeconds;target.sms+=value.sms;
  if(!Number.isSafeInteger(target.voiceSeconds)||!Number.isSafeInteger(target.sms))throw Error('history_counter_overflow');
}
const serialize=(v:Exact):HistoryValues=>({...v,bytes:String(v.bytes)});
export function historyWindow(input:{range?:string;month?:string;from?:string;to?:string}):{range:HistoryRange;window:HistoryWindow} {
  const range=input.range??'12m';
  if(!['12m','year','quarter','month','custom'].includes(range))throw Error('invalid_history_range');
  if(range!=='month'&&input.month!==undefined||range!=='custom'&&(input.from!==undefined||input.to!==undefined))throw Error('conflicting_history_window');
  let start=yearBefore(HISTORY_END),end=HISTORY_END;
  if(range==='year')start=HISTORY_END.slice(0,4)+'-01-01';
  if(range==='quarter'){
    const d=new Date(dateNumber(HISTORY_END)),quarter=Math.floor(d.getUTCMonth()/3);
    end=isoDay(Date.UTC(d.getUTCFullYear(),quarter*3,1));
    start=isoDay(Date.UTC(d.getUTCFullYear(),quarter*3-3,1));
  }
  if(range==='month'){
    const month=input.month??isoDay(dateNumber(HISTORY_END)-DAY_MS).slice(0,7);
    start=month+'-01';end=monthEnd(month);
  }
  if(range==='custom'){
    if(!input.from||!input.to)throw Error('missing_history_dates');
    start=input.from;end=isoDay(dateNumber(input.to)+DAY_MS);
  }
  const days=(dateNumber(end)-dateNumber(start))/DAY_MS;
  if(start<HISTORY_START||end>HISTORY_END||days<1||days>366)throw Error('invalid_history_window');
  return {range:range as HistoryRange,window:{start,end,days,grain:range==='month'||days<=62?'day':'month'}};
}
export function previousHistoryWindow(window:HistoryWindow):HistoryWindow|null {
  const start=yearBefore(window.start),end=yearBefore(window.end);
  if(start<HISTORY_START||end>HISTORY_END||start>=end)return null;
  return {...window,start,end,days:(dateNumber(end)-dateNumber(start))/DAY_MS};
}
export function historyDaily(source:ReturnType<typeof calendarSource>,date:string):HistorySample[] {
  return source.daily(date).map(({code,counters})=>({code,values:{bytes:String(counters.bytes),voiceSeconds:counters.voiceSeconds,sms:counters.sms}}));
}
export function historyMonth(site:DemoSite,month:string,source=calendarSource(site)):HistorySample[] {
  const rows=new Map<Operator,Exact>();
  const end=monthEnd(month);
  for(let d=dateNumber(month+'-01');d<dateNumber(end);d+=DAY_MS){
    for(const row of historyDaily(source,isoDay(d))){
      if(!rows.has(row.code))rows.set(row.code,emptyHistory());add(rows.get(row.code)!,row.values);
    }
  }
  return [...rows].map(([code,v])=>({code,values:serialize(v)}));
}
export function historyChange(current:HistoryValues,previous:HistoryValues|null,key:HistoryMetric,currentDays:number,previousDays:number) {
  if(!previous)return {delta:null,rate:null,dailyRate:null};
  const a=key==='bytes'?BigInt(current.bytes):BigInt(current[key]),b=key==='bytes'?BigInt(previous.bytes):BigInt(previous[key]);
  return {delta:String(a-b),rate:b===0n?null:Number(a-b)/Number(b),dailyRate:b===0n?null:(Number(a)/currentDays)/(Number(b)/previousDays)-1};
}
// The reader can cache ONLY immutable, isolated synthetic site/month rollups.
// Authorization and scope selection belong to the service, never this cache.
export function analyzeHistory(sites:readonly DemoSite[],scope:HistoryScope,readMonth=historyMonth) {
  const kind:'city'|'county'|'site'|'operator'=scope.site?'operator':scope.query.countyId!=='all'?'site':scope.query.cityId!=='all'?'county':'city';
  const previous=previousHistoryWindow(scope.window);
  function collect(window:HistoryWindow,seriesEnabled:boolean) {
    const total=emptyHistory(),series=new Map<string,Exact>(),children=new Map<string,{total:Exact;sites:Set<string>}>(),operators=new Map<Operator,Exact>();
    for(const site of sites){
      const source=calendarSource(site);
      let cursor=window.start;
      while(cursor<window.end){
        const month=cursor.slice(0,7),limit=monthEnd(month),end=limit<window.end?limit:window.end;
        const whole=window.grain==='month'&&cursor===month+'-01'&&end===limit;
        const rows=whole?readMonth(site,month):historyDaily(source,cursor);
        for(const {code,values} of rows){
          if(scope.query.operator!=='all'&&scope.query.operator!==code)continue;
          add(total,values);
          if(!operators.has(code))operators.set(code,emptyHistory());add(operators.get(code)!,values);
          if(seriesEnabled){const key=window.grain==='month'?month:cursor;if(!series.has(key))series.set(key,emptyHistory());add(series.get(key)!,values);}
          const key=kind==='city'?site.cityId:kind==='county'?site.countyId:kind==='site'?site.id:code;
          if(!children.has(key))children.set(key,{total:emptyHistory(),sites:new Set()});
          const child=children.get(key)!;add(child.total,values);child.sites.add(site.id);
        }
        cursor=whole?end:isoDay(dateNumber(cursor)+DAY_MS);
      }
    }
    // Empty scopes still retain the selected temporal axis, not fabricated data.
    if(seriesEnabled)for(let d=window.start;d<window.end;d=window.grain==='month'?monthEnd(d.slice(0,7)):isoDay(dateNumber(d)+DAY_MS)){
      const key=window.grain==='month'?d.slice(0,7):d;if(!series.has(key))series.set(key,emptyHistory());
    }
    return {total:serialize(total),series:[...series].sort(([a],[b])=>a.localeCompare(b)).map(([key,v])=>({key,...serialize(v)})),
      children:[...children].map(([id,v])=>({id,sites:v.sites.size,...serialize(v.total)})),operators:[...operators].map(([code,v])=>({code,...serialize(v)}))};
  }
  const current=collect(scope.window,true),base=previous?collect(previous,false):null;
  return {mode:'demo' as const,version:HISTORY_VERSION,cutoff:HISTORY_END+'T00:00:00+08:00',coverage:{start:HISTORY_START,end:HISTORY_END},scope,
    physicalSites:sites.length,serviceRelations:sites.reduce((n,s)=>n+(scope.query.operator==='all'?s.operators.length:1),0),
    expectedSiteDays:sites.length*scope.window.days,observedSiteDays:sites.length*scope.window.days,
    totals:current.total,previous:base?.total??null,previousWindow:previous,series:current.series,operators:current.operators,kind,
    children:current.children.map(row=>({...row,previous:base?.children.find(r=>r.id===row.id)??null}))};
}
export type HistoryAnalysis=ReturnType<typeof analyzeHistory>;
