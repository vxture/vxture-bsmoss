'use client';
import {Switch} from '@vxture/design-system';
import ResetButton from "../../portal/reset-button";
import {ArrowUp,ArrowDown,SlidersHorizontal,Database,Phone,MessageSquare,Activity,Gauge,Zap} from 'lucide-react';
import {useWorkbench} from '../../domains/map-demo/workbench-store.ts';
import {SUMMARY_METRICS,TOPIC_SECTIONS,defaultDisplay,reorder,summaryValue,type SummaryMetric,type TopicSection,type TopicDisplay} from '../../domains/map-demo/display-rules.ts';
import type {DemoSummary} from '../../domains/map-demo/types.ts';
const METRICS={traffic:{label:'\u65f6\u6bb5\u6d41\u91cf',category:'\u7ecf\u8425\u670d\u52a1',icon:Database},voice:{label:'\u901a\u8bdd\u65f6\u957f',category:'\u7ecf\u8425\u670d\u52a1',icon:Phone},sms:{label:'\u77ed\u4fe1\u91cf',category:'\u7ecf\u8425\u670d\u52a1',icon:MessageSquare},connection:{label:'\u547c\u53eb\u63a5\u901a\u7387',category:'\u8fd0\u8425\u72b6\u6001',icon:Activity},load:{label:'\u8d44\u6e90\u8d1f\u8f7d\u7387',category:'\u8fd0\u8425\u72b6\u6001',icon:Gauge},energy:{label:'\u65f6\u6bb5\u7535\u8017',category:'\u8fd0\u884c\u53c2\u6570',icon:Zap}};
const SECTIONS:Record<TopicSection,string>={trend:'24 \u5c0f\u65f6\u8d70\u52bf',cities:'\u533a\u57df\u5206\u5e03',priority:'\u4f18\u5148\u6838\u9a8c'};
export function SummaryStrip({summary,current}:{summary:DemoSummary;current:boolean}){
  const metrics=useWorkbench(s=>s.display.metrics);
  return <div className={'mw-metrics-strip '+(!current?'mw-refreshing':'')} aria-label={'\u6982\u89c8\u6307\u6807'} aria-busy={!current}>{metrics.map(key=>{
    const spec=METRICS[key],value=summaryValue(key,summary),Icon=spec.icon;
    return <div key={key}><span><Icon size={12}/>{spec.label}</span><strong>{value.value===null?'\u2014':value.value.toLocaleString('zh-CN',{maximumFractionDigits:value.digits})}<small>{value.unit}</small></strong></div>;
  })}</div>;
}
export function SummarySettings(){
  const state=useWorkbench(),metrics=state.display.metrics;
  const update=(next:SummaryMetric[])=>state.set({display:{...state.display,metrics:next}});
  return <div className="mw-summary-config"><div className="mw-config-heading"><strong>{'\u6982\u89c8\u6307\u6807'}</strong><small>{metrics.length+'/3'}</small></div>
    {(['\u7ecf\u8425\u670d\u52a1','\u8fd0\u8425\u72b6\u6001','\u8fd0\u884c\u53c2\u6570'] as const).map(category=><div key={category} className="mw-config-category"><small>{category}</small>{SUMMARY_METRICS.filter(k=>METRICS[k].category===category).map(key=><label key={key}><span>{METRICS[key].label}</span><Switch aria-label={'\u6982\u89c8\u663e\u793a'+METRICS[key].label} checked={metrics.includes(key)} disabled={metrics.includes(key)?metrics.length===1:metrics.length===3} onCheckedChange={checked =>update((checked === true)?[...metrics,key]:metrics.filter(k=>k!==key))}/></label>)}</div>)}
    <div className="mw-config-order" aria-label={'\u6982\u89c8\u6307\u6807\u987a\u5e8f'}>{metrics.map((key,i)=><div key={key}><span>{String(i+1).padStart(2,'0')+' '+METRICS[key].label}</span><button aria-label={'\u4e0a\u79fb'+METRICS[key].label} disabled={i===0} onClick={()=>update(reorder(metrics,key,-1))}><ArrowUp size={11}/></button><button aria-label={'\u4e0b\u79fb'+METRICS[key].label} disabled={i===metrics.length-1} onClick={()=>update(reorder(metrics,key,1))}><ArrowDown size={11}/></button></div>)}</div>
    <ResetButton className="mw-config-reset" onClick={()=>update(defaultDisplay().metrics)} label={'\u6062\u590d\u6982\u89c8\u9ed8\u8ba4'}/>
  </div>;
}
export function TopicSettings(){
  const state=useWorkbench(),prefs=state.display.topics[state.topic];
  const update=(patch:Partial<TopicDisplay>)=>state.set({display:{...state.display,topics:{...state.display.topics,[state.topic]:{...prefs,...patch}}}});
  return <details className="mw-topic-config"><summary><SlidersHorizontal size={11}/>{'\u663e\u793a\u914d\u7f6e'}<span>{'\u5f53\u524d\u4e13\u9898'}</span></summary><div>
    <div className="mw-config-presets"><button onClick={()=>update(defaultDisplay().topics[state.topic])}>{'\u5b8c\u6574\u5206\u6790'}</button><button onClick={()=>update({mapScope:'attention',sections:['trend','priority'],evidence:false,limit:3})}>{'\u7cbe\u7b80\u89c6\u56fe'}</button></div>
    <label className="mw-config-select"><span>{'\u5730\u56fe\u7ad9\u70b9'}</span><select aria-label={'\u4e13\u9898\u5730\u56fe\u7ad9\u70b9'} value={prefs.mapScope} onChange={e=>update({mapScope:e.target.value as TopicDisplay['mapScope']})}><option value="all">{'\u5168\u90e8\u72b6\u6001'}</option><option value="attention">{'\u5173\u6ce8\u4e0e\u672a\u77e5'}</option></select></label>
    <p>{'\u4ec5\u6539\u53d8\u70b9\u4f4d\u663e\u793a\uff0c\u7edf\u8ba1\u53e3\u5f84\u4e0d\u53d8\uff1b\u672a\u77e5\u59cb\u7ec8\u4fdd\u7559\u3002'}</p>
    <div className="mw-config-heading"><strong>{'\u5206\u6790\u533a\u5757'}</strong><small>{'\u52fe\u9009\u663e\u793a \u00b7 \u7bad\u5934\u6392\u5e8f'}</small></div>
    {TOPIC_SECTIONS.map(key=><label className="mw-config-check" key={key}><span>{SECTIONS[key]}</span><Switch aria-label={'\u663e\u793a'+SECTIONS[key]} checked={prefs.sections.includes(key)} onCheckedChange={checked =>update({sections:(checked === true)?[...prefs.sections,key]:prefs.sections.filter(k=>k!==key)})}/></label>)}
    <div className="mw-config-order" aria-label={'\u4e13\u9898\u533a\u5757\u987a\u5e8f'}>{prefs.sections.map((key,i)=><div key={key}><span>{String(i+1).padStart(2,'0')+' '+SECTIONS[key]}</span><button aria-label={'\u4e0a\u79fb'+SECTIONS[key]} disabled={i===0} onClick={()=>update({sections:reorder(prefs.sections,key,-1)})}><ArrowUp size={11}/></button><button aria-label={'\u4e0b\u79fb'+SECTIONS[key]} disabled={i===prefs.sections.length-1} onClick={()=>update({sections:reorder(prefs.sections,key,1)})}><ArrowDown size={11}/></button></div>)}</div>
    <label className="mw-config-select"><span>{'\u91cd\u70b9\u7ad9\u70b9\u6570\u91cf'}</span><select aria-label={'\u91cd\u70b9\u7ad9\u70b9\u6570\u91cf'} value={prefs.limit} onChange={e=>update({limit:Number(e.target.value) as 3|4|6})}>{[3,4,6].map(n=><option key={n} value={n}>{n+' \u7ad9'}</option>)}</select></label>
    <label className="mw-config-check"><span>{'\u7ad9\u70b9\u6307\u6807\u8bc1\u636e'}</span><Switch aria-label={'\u663e\u793a\u7ad9\u70b9\u6307\u6807\u8bc1\u636e'} checked={prefs.evidence} onCheckedChange={checked =>update({evidence:(checked === true)})}/></label>
    <ResetButton className="mw-config-reset" onClick={()=>update(defaultDisplay().topics[state.topic])} label={'\u6062\u590d\u5f53\u524d\u4e13\u9898\u9ed8\u8ba4'}/><p>{'\u81ea\u52a8\u4fdd\u5b58\u5230\u672c\u673a\u6d4f\u89c8\u5668'}</p>
  </div></details>;
}
