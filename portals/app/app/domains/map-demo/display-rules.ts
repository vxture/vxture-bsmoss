import type {DemoSummary,SitePoint,TopicKind} from './types.ts';
export const DISPLAY_KEY='bsmoss.map-display.v1';
export const SUMMARY_METRICS=['traffic','voice','sms','connection','load','energy'] as const;
export type SummaryMetric=typeof SUMMARY_METRICS[number];
export const TOPIC_SECTIONS=['trend','cities','priority'] as const;
export type TopicSection=typeof TOPIC_SECTIONS[number];
export interface TopicDisplay {mapScope:'all'|'attention';sections:TopicSection[];evidence:boolean;limit:3|4|6}
export interface DisplayPreferences {version:1;metrics:SummaryMetric[];topics:Record<TopicKind,TopicDisplay>}
const object=(v:unknown):Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const unique=<T extends string>(v:unknown,allowed:readonly T[]):T[]=>Array.isArray(v)?[...new Set(v.filter((k):k is T=>typeof k==='string'&&allowed.includes(k as T)))]:[];
const topicDefault=():TopicDisplay=>({mapScope:'all',sections:[...TOPIC_SECTIONS],evidence:true,limit:4});
export function defaultDisplay():DisplayPreferences {
  return {version:1,metrics:['traffic','connection','energy'],topics:{capacity:topicDefault(),power:topicDefault(),efficiency:topicDefault()}};
}
// Stored display preferences never become query permissions, thresholds or data scope.
export function resolveDisplay(value:unknown):DisplayPreferences {
  const result=defaultDisplay(),input=object(value);if(input.version!==1)return result;
  const metrics=unique(input.metrics,SUMMARY_METRICS).slice(0,3);if(metrics.length)result.metrics=metrics;
  const topics=object(input.topics);
  for(const kind of ['capacity','power','efficiency'] as const){
    const topic=object(topics[kind]),current=result.topics[kind];
    if(topic.mapScope==='all'||topic.mapScope==='attention')current.mapScope=topic.mapScope;
    if(Array.isArray(topic.sections))current.sections=unique(topic.sections,TOPIC_SECTIONS);
    if(typeof topic.evidence==='boolean')current.evidence=topic.evidence;
    if(topic.limit===3||topic.limit===4||topic.limit===6)current.limit=topic.limit;
  }
  return result;
}
export function reorder<T>(items:readonly T[],item:T,direction:-1|1):T[] {
  const result=[...items],index=result.indexOf(item),target=index+direction;
  if(index>=0&&target>=0&&target<result.length)[result[index],result[target]]=[result[target],result[index]];
  return result;
}
export function displayedTopicPoints(points:readonly SitePoint[],scope:TopicDisplay['mapScope']):SitePoint[] {
  return points.filter(p=>scope==='all'||p.topicLevel==='critical'||p.topicLevel==='warning'||p.topicLevel==='unknown');
}
export function summaryValue(metric:SummaryMetric,s:DemoSummary):{value:number|null;unit:string;digits:number} {
  switch(metric){
    case 'traffic':return {value:s.bytes/1073741824/1024,unit:'TiB',digits:2};
    case 'voice':return {value:s.voiceSeconds/3600,unit:'h',digits:1};
    case 'sms':return {value:s.sms,unit:'\u6761',digits:0};
    case 'connection':return {value:s.connectionRate===null?null:s.connectionRate*100,unit:'%',digits:2};
    case 'load':return {value:s.load===null?null:s.load*100,unit:'%',digits:1};
    case 'energy':return {value:s.energyWh===null?null:s.energyWh/1000000,unit:s.energyWh===null?'\u672a\u5206\u644a':'MWh',digits:2};
  }
}
