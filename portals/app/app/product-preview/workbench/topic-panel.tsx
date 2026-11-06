'use client';
import { TOPIC_POLICY_TEXT as RULES } from "../../domains/business-parameters/presentation";
import BusinessPageLink from './business-page-link';
import {selectionLabel} from '../../domains/map-demo/geometry.ts';
import {Radar,X,Activity,Zap,Leaf,ArrowUpRight,Columns3,LoaderCircle,RotateCcw} from 'lucide-react';
import {useWorkbench} from '../../domains/map-demo/workbench-store.ts';
import type {MapSnapshot,RegionDefinition,TopicKind,OperatorFilter,TopicSignal} from '../../domains/map-demo/types.ts';
import {GIB} from '../../domains/map-demo/rules.ts';
import {TopicSettings} from './display-controls.tsx';
import {OP_NAMES} from './station-panel.tsx';
export const TOPIC_NAMES:Record<TopicKind,string>={capacity:'\u5bb9\u91cf\u4e0e\u8d28\u91cf',power:'\u4f9b\u7535\u4fdd\u969c',efficiency:'\u80fd\u6548\u89c2\u5bdf'};

const ACTIONS:Record<TopicKind,string>={capacity:'\u6838\u9a8c\u8d44\u6e90\u8d1f\u8f7d\u4e0e\u63a5\u901a\u8d28\u91cf\uff0c\u7ed3\u5408\u4e1a\u52a1\u9700\u6c42\u590d\u6838\u5bb9\u91cf\u3002',power:'\u6838\u9a8c\u5e02\u7535\u3001\u5907\u7528\u7535\u6e90\u4e0e\u673a\u623f\u6e29\u5ea6\uff0c\u7ed3\u5408\u73b0\u573a\u8bb0\u5f55\u786e\u8ba4\u3002',efficiency:'\u7ed3\u5408\u7ad9\u578b\u3001\u4e1a\u52a1\u7ed3\u6784\u548c\u57fa\u7840\u529f\u8017\u590d\u6838\uff0c\u907f\u514d\u53ea\u6309\u80fd\u8017\u5dee\u503c\u5224\u4f18\u52a3\u3002'};
const n=(v:number,digits=1)=>v.toLocaleString('zh-CN',{maximumFractionDigits:digits});
function evidence(kind:TopicKind,s:TopicSignal){
  const value=s.value===null?'\u2014':n(s.value,kind==='efficiency'?3:1),secondary=s.secondary===null?'\u2014':n(s.secondary,1);
  return kind==='capacity'?'\u8d1f\u8f7d '+value+'% \u00b7 \u63a5\u901a '+secondary+'%':kind==='power'?(s.value===1?'\u5907\u7528\u4f9b\u7535':'\u5e02\u7535\u6b63\u5e38')+' \u00b7 '+secondary+'\u00b0C':value+' kWh/GiB \u00b7 '+secondary+' kWh';
}
export default function TopicPanel({region,snapshot,loading,error,onPick,onRetry}:{region:RegionDefinition;snapshot:MapSnapshot|null;loading:boolean;error:boolean;onPick:(id:string)=>void;onRetry:()=>void}) {
  const state=useWorkbench();if(!state.topicOpen)return null;
  const topic=snapshot?.topic,c=topic?.counts,affected=c?c.critical+c.warning:0,evaluated=c?c.total-c.unknown:0;
  const prefs=state.display.topics[state.topic];
  const peak=topic?Math.max(1,...topic.series.map(s=>s.critical+s.warning)):1;
  const scope=region.counties.find(r=>r.id===state.countyId)?.name??region.cities.find(r=>r.id===state.cityId)?.name??region.name;
  return <aside className="mw-topic-panel" aria-label={"\u4e13\u9898\u5206\u6790"} aria-busy={loading}>
    <header><span><Radar size={15}/>{"\u4e13\u9898\u5206\u6790"}</span><div className="flex items-center gap-sm"><BusinessPageLink kind={state.topic === 'capacity' ? 'capacity' : 'efficiency'}/><button aria-label={"\u6536\u8d77\u4e13\u9898\u5206\u6790"} onClick={()=>state.set({topicOpen:false})}><X size={16}/></button></div></header>
    <div className="mw-topic-tabs" role="group" aria-label={"\u9009\u62e9\u4e13\u9898"}>{([{key:'capacity',icon:Activity},{key:'power',icon:Zap},{key:'efficiency',icon:Leaf}] as const).map(t=><button key={t.key} aria-pressed={state.topic===t.key} className={state.topic===t.key?'active':''} onClick={()=>state.set({topic:t.key})}><t.icon size={12}/>{TOPIC_NAMES[t.key]}</button>)}</div>
    <div className="mw-topic-content">
    <div className="mw-topic-context"><span>{scope}{state.selection?' \u00b7 '+selectionLabel(state.selection):''}<small>{"2026.10.25 \u00b7 "}{String(state.hour).padStart(2,'0')}:00</small></span><select aria-label={"\u4e13\u9898\u8fd0\u8425\u5546"} value={state.operator} onChange={e=>state.set({operator:e.target.value as OperatorFilter,selectedId:null})}><option value="all">{"\u5168\u90e8\u8fd0\u8425\u5546"}</option>{Object.entries(OP_NAMES).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></div>
    <TopicSettings/>
    {state.display.topics[state.topic].mapScope==='attention'&&<div className="mw-topic-display-note">{'\u5730\u56fe\u805a\u7126\u5173\u6ce8\u4e0e\u672a\u77e5 \u00b7 \u7edf\u8ba1\u4ecd\u542b\u5168\u90e8\u72b6\u6001'}</div>}
    {error?<div className="mw-topic-empty" role="alert"><p>{"\u4e13\u9898\u66f4\u65b0\u5931\u8d25"}</p><button onClick={onRetry}><RotateCcw size={12}/>{"\u91cd\u8bd5"}</button></div>:!topic||!c?<div className="mw-topic-empty"><LoaderCircle size={24} className="mw-spin"/><p>{"\u6b63\u5728\u5206\u6790\u7ad9\u7f51\u4e13\u9898"}</p></div>:<>
      <div className="mw-topic-total"><div><strong>{n(c.total,0)}</strong><span>{"\u89c2\u5bdf\u7ad9\u5740"}</span></div><div><strong>{evaluated?n(affected/evaluated*100,1)+'%':'\u2014'}</strong><span>{"\u5df2\u8bc4\u4f30\u4e2d\u5173\u6ce8\u5360\u6bd4"}</span></div></div>
      <div className="mw-topic-counts"><div><i className="critical"/><strong>{c.critical}</strong><span>{"\u4e25\u91cd"}</span></div><div><i className="warning"/><strong>{c.warning}</strong><span>{"\u5173\u6ce8"}</span></div><div><i className="normal"/><strong>{c.normal}</strong><span>{"\u5e73\u7a33"}</span></div><div><i className="unknown"/><strong>{c.unknown}</strong><span>{"\u672a\u77e5"}</span></div></div>
      <details className="mw-topic-policy"><summary>{"\u5224\u5b9a\u89c4\u5219 "}<span>{"\u5224\u5b9a\u53e3\u5f84"}</span></summary><p>{RULES[state.topic]}</p></details>
      {state.topic==='efficiency'&&state.operator!=='all'&&<div className="mw-topic-unallocated"><strong>{"\u8fd0\u8425\u5546\u7535\u8017\u672a\u5206\u644a\uff0c\u5f53\u524d\u4e0d\u53ef\u8bc4\u4f30"}</strong><button onClick={()=>state.set({operator:'all'})}>{"\u67e5\u770b\u7269\u7406\u7ad9\u5740\u53e3\u5f84"}<ArrowUpRight size={11}/></button></div>}
      {prefs.sections.map(section=><div key={section} className="mw-topic-block" data-section={section}>{section==='trend'?<>      <div className="mw-topic-section"><span>{"24 \u5c0f\u65f6\u5173\u6ce8\u7ad9\u6570"}</span><small>{"\u6309\u5f53\u5c0f\u65f6\u91cd\u65b0\u5224\u5b9a \u00b7 \u70b9\u51fb\u5207\u65f6\u6bb5"}</small></div>
      <div className="mw-topic-bars" role="group" aria-label={"\u4e13\u989824\u5c0f\u65f6\u5173\u6ce8\u7ad9\u6570"}>{topic.series.map(s=><button key={s.hour} aria-label={String(s.hour).padStart(2,'0')+':00 \u4e25\u91cd '+s.critical+' \u5173\u6ce8 '+s.warning+' \u672a\u77e5 '+s.unknown} aria-pressed={s.hour===state.hour} title={String(s.hour).padStart(2,'0')+':00 \u00b7 \u4e25\u91cd '+s.critical+' \u00b7 \u5173\u6ce8 '+s.warning+' \u00b7 \u672a\u77e5 '+s.unknown} className={s.hour===state.hour?'active':''} onClick={()=>state.set({hour:s.hour,playing:false})}><span style={{height:Math.max(3,(s.critical+s.warning)/peak*100)+'%'}}>{s.critical+s.warning?<><i className="critical" style={{flex:s.critical}}/><i className="warning" style={{flex:s.warning}}/></>:<i className={s.unknown?'unknown':'normal'} style={{flex:1}}/>}</span></button>)}</div><div className="mw-topic-axis"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:00</span></div>
</>:section==='cities'?<>      <div className="mw-topic-section"><span>{"\u533a\u57df\u5206\u5e03"}</span><small>{"\u4e25\u91cd\uff0b\u5173\u6ce8 / \u89c2\u5bdf\u7ad9\u5740"}</small></div>
      <div className="mw-topic-cities">{topic.cities.slice(0,4).map(city=><button key={city.cityId} aria-label={'\u67e5\u770b'+(region.cities.find(r=>r.id===city.cityId)?.name??city.cityId)+'\u4e13\u9898'} onClick={()=>{if(state.cityId===city.cityId)return;state.set({cityId:city.cityId,selectedId:null,search:''});}}><span>{region.cities.find(r=>r.id===city.cityId)?.name}</span><div><i className="critical" style={{width:city.critical/city.total*100+'%'}}/><i className="warning" style={{width:city.warning/city.total*100+'%'}}/><i className="unknown" style={{width:city.unknown/city.total*100+'%'}}/></div><strong>{city.unknown===city.total?'\u672a\u77e5':city.critical+city.warning} / {city.total}</strong></button>)}</div>
</>:<>      <div className="mw-topic-section"><span>{"\u4f18\u5148\u6838\u9a8c"}</span><small>{n(topic.affectedBytes/GIB)+' GiB \u00b7 \u5173\u6ce8\u7ad9\u4e1a\u52a1\u91cf'}</small></div>
      <div className="mw-topic-priority">{topic.priority.slice(0,prefs.limit).map((p,i)=><div key={p.id}><span className="mw-rank">{String(i+1).padStart(2,'0')}</span><button aria-label={'\u5206\u6790\u4e13\u9898\u7ad9\u70b9 '+p.name} onClick={()=>onPick(p.id)}><strong><i className={p.level}/>{p.name}</strong>{prefs.evidence&&<small>{evidence(state.topic,p)}</small>}</button><button className="mw-topic-compare" aria-label={'\u52a0\u5165\u5bf9\u6bd4 '+p.name} title={state.compareIds.length>=4&&!state.compareIds.includes(p.id)?'\u5df2\u8fbe\u56db\u7ad9\u4e0a\u9650':'\u52a0\u5165\u5bf9\u6bd4'} disabled={state.compareIds.length>=4&&!state.compareIds.includes(p.id)} onClick={()=>state.addComparison(p.id)}><Columns3 size={13}/></button></div>)}</div>
      {!topic.priority.length&&<p className="mw-topic-note">{!c.total?'\u5f53\u524d\u8303\u56f4\u6682\u65e0\u7ad9\u70b9':!evaluated?'\u5f53\u524d\u53e3\u5f84\u65e0\u53ef\u8bc4\u4f30\u6570\u636e':'\u5f53\u524d\u65f6\u6bb5\u672a\u547d\u4e2d\u5173\u6ce8\u89c4\u5219\uff0c\u53ef\u67e5\u770b\u5176\u4ed6\u5c0f\u65f6\u3002'}</p>}
      {topic.priority.length>0&&<p className="mw-topic-note">{ACTIONS[state.topic]}</p>}
</>}</div>)}
    </>}
    </div><footer><span>{"\u6a21\u62df\u89c4\u5219 \u00b7 \u4e0d\u66ff\u4ee3\u6545\u969c\u8bca\u65ad"}</span><span>{"\u7269\u7406\u7ad9\u5740\u4ec5\u8ba1\u4e00\u6b21"}</span></footer>
  </aside>;
}
