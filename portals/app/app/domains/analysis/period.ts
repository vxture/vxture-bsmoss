export function analysisTimeBuckets(times:readonly string[],period:'hour'|'day'|'week'|'month') {
 const daily=period==='week'||period==='month',groups=new Map<string,string[]>();
 for(const at of times){const key=daily?at.slice(0,10):at;const group=groups.get(key)??[];group.push(at);groups.set(key,group);}
 return [...groups].map(([key,times])=>({key,label:daily?key.slice(5):key.slice(11,13),hour:Number(times[0].slice(11,13)),times}));
}
export function analysisPeriod(window:{start:string;end:string;asOf:string;times:readonly string[]},period:'hour'|'day'|'week'|'month'){
 const start=new Date(Date.parse(window.start)+8*3600000).toISOString().slice(0,19),end=new Date(Date.parse(window.end)+8*3600000-1).toISOString().slice(0,19),daily=period==='week'||period==='month';
 return {label:period==='hour'?window.asOf.replace('T',' ').slice(0,16):period==='day'?start.slice(0,10):period==='month'?start.slice(0,7):start.slice(0,10)+' ~ '+end.slice(5,10),daily,observed:daily?new Set(window.times.map(at=>at.slice(0,10))).size:window.times.length,expected:(Date.parse(window.end)-Date.parse(window.start))/(daily?86400000:3600000)};
}
export const analysisPeriodCaption=(period:{label:string;observed:number;expected:number;daily:boolean})=>period.label+' \u00b7 \u6709\u6548 '+period.observed+'/'+period.expected+(period.daily?' \u5929':' \u5c0f\u65f6');
