// Frozen demo calendar. All bounds are Beijing time, end-exclusive.
export const HISTORY_VERSION='tower-demo-history-v1';
export const HISTORY_START='2024-11-01T00:00:00+08:00';
export const HISTORY_END='2026-11-01T00:00:00+08:00';
export const DAY=86400000;
export type HistoryGrain='hour'|'day'|'week'|'month'|'year';
export const historyGrains:HistoryGrain[]=['hour','day','week','month','year'];
export const beijing=(ms:number)=>new Date(ms+8*3600000).toISOString().slice(0,19)+'+08:00';
export const historyDay=(value:string)=>Math.floor((Date.parse(value)-Date.parse(HISTORY_START))/DAY);
export const historyAt=(day:number)=>beijing(Date.parse(HISTORY_START)+day*DAY);
export function calendarPeriod(grain:HistoryGrain,value:string){
 const ms=Date.parse(value.length===10?value+'T00:00:00+08:00':value);
 if(!historyGrains.includes(grain)||!Number.isFinite(ms))throw Error('invalid_history_period');
 const d=new Date(ms+8*3600000);d.setUTCMinutes(0,0,0);if(grain!=='hour')d.setUTCHours(0);
 if(grain==='week')d.setUTCDate(d.getUTCDate()-(d.getUTCDay()||7)+1);
 if(grain==='month'||grain==='year')d.setUTCDate(1);if(grain==='year')d.setUTCMonth(0);
 const start=d.toISOString().slice(0,19)+'+08:00';
 if(grain==='hour')d.setUTCHours(d.getUTCHours()+1);
 if(grain==='day'||grain==='week')d.setUTCDate(d.getUTCDate()+(grain==='week'?7:1));
 if(grain==='month')d.setUTCMonth(d.getUTCMonth()+1);if(grain==='year')d.setUTCFullYear(d.getUTCFullYear()+1);
 return {start,end:d.toISOString().slice(0,19)+'+08:00'};
}
export function historyId(grain:HistoryGrain,value:string){const p=calendarPeriod(grain,value);return HISTORY_VERSION+':'+grain+':'+p.start.slice(0,grain==='hour'?13:10);}
export function parseHistoryId(id:unknown){
 if(typeof id!=='string'||!id.startsWith(HISTORY_VERSION+':'))return null;
 const match=new RegExp('^'+HISTORY_VERSION+':(hour|day|week|month|year):(\\d{4}-\\d{2}-\\d{2}(?:T\\d{2})?)$').exec(id);
 if(!match)throw Error('invalid_history_id');
 const grain=match[1] as HistoryGrain,value=match[2]+(match[1]==='hour'?':00:00+08:00':'T00:00:00+08:00'),period=calendarPeriod(grain,value);
 if(historyId(grain,value)!==id||Date.parse(period.end)<=Date.parse(HISTORY_START)||Date.parse(period.start)>=Date.parse(HISTORY_END))throw Error('invalid_history_range');
 return {id,grain,...period,from:beijing(Math.max(Date.parse(period.start),Date.parse(HISTORY_START))),to:beijing(Math.min(Date.parse(period.end),Date.parse(HISTORY_END))),complete:Date.parse(period.start)>=Date.parse(HISTORY_START)&&Date.parse(period.end)<=Date.parse(HISTORY_END)};
}
export function stepHistory(id:string,direction:-1|1){const p=parseHistoryId(id);if(!p)return null;try{const next=historyId(p.grain,direction<0?beijing(Date.parse(p.start)-1):p.end);return parseHistoryId(next)?.id??null;}catch{return null;}}
export function yearHistory(id:string){const p=parseHistoryId(id);if(!p)return null;const d=new Date(Date.parse(p.start)+8*3600000),month=d.getUTCMonth();
 if(p.grain==='week'){const thursday=new Date(d.getTime()+3*DAY),year=thursday.getUTCFullYear(),jan4=new Date(Date.UTC(year,0,4));jan4.setUTCDate(jan4.getUTCDate()-(jan4.getUTCDay()||7)+1);const week=Math.round((d.getTime()-jan4.getTime())/(7*DAY));const previous=new Date(Date.UTC(year-1,0,4));previous.setUTCDate(previous.getUTCDate()-(previous.getUTCDay()||7)+1+week*7);if(new Date(previous.getTime()+3*DAY).getUTCFullYear()!==year-1)return null;d.setTime(previous.getTime());}
 else{d.setUTCFullYear(d.getUTCFullYear()-1);if(d.getUTCMonth()!==month)return null;}
 try{const result=historyId(p.grain,d.toISOString().slice(0,19)+'+08:00');return parseHistoryId(result)?.id??null;}catch{return null;}}
export function historyWindow(id:string){
 const p=parseHistoryId(id);if(!p)return [];
 const context=p.grain==='hour'?calendarPeriod('day',p.start):p.grain==='day'?calendarPeriod('month',p.start):p.grain==='week'?calendarPeriod('year',p.start):{start:HISTORY_START,end:HISTORY_END};
 const out:string[]=[];let cursor=calendarPeriod(p.grain,context.start).start;
 while(Date.parse(cursor)<Date.parse(context.end)){const key=historyId(p.grain,cursor);try{parseHistoryId(key);out.push(key);}catch{}cursor=calendarPeriod(p.grain,cursor).end;}
 return out;
}
export const DEFAULT_HISTORY_ID=HISTORY_VERSION+':month:2026-10-01';
