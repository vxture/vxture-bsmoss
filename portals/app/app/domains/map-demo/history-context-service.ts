import {selectHistorySites} from './history-service.ts';
import {analyzeHistoryContext,readContextPeriod,type Context} from './history-context-rules.ts';
import {monthEnd} from './history-calendar.ts';
import type {HistoryAnalysis} from './history-rules.ts';
// Immutable synthetic site/months only; formal data never enters this cache.
const contexts=new Map<string,Context>();
export function queryHistoryContext(analysis:HistoryAnalysis){
  return analyzeHistoryContext(selectHistorySites(analysis.scope),analysis,(site,start,end)=>{
    if(start.slice(8)!=='01'||monthEnd(start.slice(0,7))!==end)return readContextPeriod(site,start,end);
    const key=site.id+'/'+start;let value=contexts.get(key);
    if(!value){value=readContextPeriod(site,start,end);contexts.set(key,value);}return value;
  });
}
