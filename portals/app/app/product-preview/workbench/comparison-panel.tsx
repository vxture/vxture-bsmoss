'use client';
import {serializeSelection} from '../../domains/map-demo/geometry.ts';
import dynamic from 'next/dynamic';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {Columns3,X,Plus,Search,ArrowUpRight,LoaderCircle,RotateCcw} from 'lucide-react';
import {useWorkbench} from '../../domains/map-demo/workbench-store.ts';
import {comparisonContextKey,comparisonValue,COMPARE_LIMIT,type ComparisonMetric} from '../../domains/map-demo/comparison-rules.ts';
import type {ComparisonSnapshot,RegionDefinition,SitePoint,OperatorFilter} from '../../domains/map-demo/types.ts';
import {OP_NAMES} from './station-panel.tsx';
const Chart=dynamic(()=>import('./comparison-chart.tsx'),{ssr:false,loading:()=> <div className="mw-comparison-chart"/>});
const COLORS=['#7fcbb3','#d8bb82','#9db7e3','#c3a1ce'];
const METRICS:{key:ComparisonMetric;name:string;unit:string;category?:string}[]=[
  {key:'traffic',name:'\u53cc\u5411\u6d41\u91cf',unit:'GiB',category:'\u7ecf\u8425\u670d\u52a1'},
  {key:'voice',name:'\u901a\u8bdd\u65f6\u957f',unit:'\u5c0f\u65f6'},{key:'sms',name:'\u77ed\u4fe1\u91cf',unit:'\u6761'},
  {key:'connection',name:'\u547c\u53eb\u63a5\u901a\u7387',unit:'%',category:'\u8fd0\u8425\u72b6\u6001'},
  {key:'load',name:'\u8d44\u6e90\u8d1f\u8f7d\u7387',unit:'%'},{key:'latency',name:'\u7f51\u7edc\u65f6\u5ef6',unit:'ms'},
  {key:'energy',name:'\u65f6\u6bb5\u7535\u8017',unit:'kWh',category:'\u8fd0\u884c\u53c2\u6570'},
  {key:'temperature',name:'\u673a\u623f\u6e29\u5ea6',unit:'\u00b0C'},
];
const n=(v:number,digits=2)=>v.toLocaleString('zh-CN',{maximumFractionDigits:digits});
export default function ComparisonPanel({region,candidates,pending,onInspect}:{region:RegionDefinition;candidates:SitePoint[];pending:boolean;onInspect:(id:string)=>void}) {
  const state=useWorkbench();
  const [snapshot,setSnapshot]=useState<ComparisonSnapshot|null>(null),[error,setError]=useState(false),[revision,setRevision]=useState(0);
  const [metric,setMetric]=useState<ComparisonMetric>('traffic'),[showDelta,setShowDelta]=useState(true);
  const idsKey=state.compareIds.join(',');
  const query=useMemo(()=>({regionId:region.id,cityId:state.cityId,countyId:state.countyId,operator:state.operator,hour:state.hour,selection:state.selection??undefined,search:''}),[region.id,state.cityId,state.countyId,state.operator,state.hour,state.selection]);
  const contextKey=comparisonContextKey(query,state.compareIds);
  useEffect(()=>{
    if(!state.compareOpen||!idsKey)return;
    const controller=new AbortController();setError(false);
    const params=new URLSearchParams({regionId:query.regionId,cityId:query.cityId,countyId:query.countyId,operator:query.operator,hour:String(query.hour),sites:idsKey});
    if(query.selection)params.set('selection',serializeSelection(query.selection));
    fetch('/api/product-preview/compare?'+params,{signal:controller.signal}).then(async r=>{if(!r.ok)throw Error('comparison_failed');return r.json();}).then(result=>{if(!controller.signal.aborted)setSnapshot(result);}).catch(()=>{if(!controller.signal.aborted)setError(true);});
    return()=>controller.abort();
  },[query,idsKey,state.compareOpen,revision]);
  const result=snapshot?.contextKey===contextKey?snapshot:null;
  const series=useMemo(()=>result?.entries.flatMap((entry,i)=>entry.detail?[{detail:entry.detail,color:COLORS[i]}]:[])??[],[result]);
  const onHour=useCallback((hour:number)=>useWorkbench.getState().set({hour,playing:false}),[]);
  if(!state.compareOpen)return null;
  const loading=!!idsKey&&!result&&!error,baseline=result?.entries[0]?.detail;
  const selectedMetric=METRICS.find(m=>m.key===metric)!;
  return <aside className="mw-comparison" aria-label={"\u7ad9\u70b9\u5bf9\u6bd4\u5206\u6790"} aria-busy={loading}>
    <header><span><Columns3 size={14}/>{"\u7ad9\u70b9\u5bf9\u6bd4 "}<small>{state.compareIds.length} / {COMPARE_LIMIT}</small></span><div><button disabled={!idsKey} onClick={()=>state.clearComparison()}>{"\u6e05\u7a7a"}</button><button aria-label={"\u6536\u8d77\u7ad9\u70b9\u5bf9\u6bd4"} onClick={()=>state.set({compareOpen:false,search:''})}><X size={16}/></button></div></header>
    <div className="mw-comparison-context"><span>{"2026.10.25 \u00b7 "}{String(state.hour).padStart(2,'0')}{":00\u2014"}{String(state.hour+1).padStart(2,'0')}:00</span><select aria-label={"\u5bf9\u6bd4\u8fd0\u8425\u5546"} value={state.operator} onChange={e=>state.set({operator:e.target.value as OperatorFilter})}><option value="all">{"\u5168\u90e8\u8fd0\u8425\u5546"}</option>{Object.entries(OP_NAMES).map(([code,label])=><option key={code} value={code}>{label}</option>)}</select><label><input type="checkbox" checked={showDelta} onChange={e=>setShowDelta(e.target.checked)}/>{"\u5dee\u503c"}</label></div>
    <div className="mw-comparison-content">
    {!idsKey?<div className="mw-comparison-empty"><Columns3 size={26}/><strong>{"\u9009\u62e9 2\u20134 \u4e2a\u7ad9\u70b9"}</strong><span>{"\u70b9\u51fb\u5730\u56fe\u70b9\u4f4d\uff0c\u6216\u4ece\u4e0b\u65b9\u68c0\u7d22\u52a0\u5165"}</span><small>{"\u76f8\u540c\u65f6\u6bb5 \u00b7 \u76f8\u540c\u8fd0\u8425\u5546\u53e3\u5f84"}</small></div>:error?<div className="mw-comparison-empty" role="alert"><strong>{"\u5bf9\u6bd4\u66f4\u65b0\u5931\u8d25"}</strong><button onClick={()=>setRevision(v=>v+1)}><RotateCcw size={12}/>{"\u91cd\u8bd5"}</button></div>:loading?<div className="mw-comparison-empty"><LoaderCircle size={22} className="mw-spin"/><span>{"\u6b63\u5728\u66f4\u65b0\u5bf9\u6bd4"}</span></div>:result&&<>
    <div className="mw-comparison-table-scroll"><table className="mw-comparison-table"><thead><tr><th><span>{"\u4e09\u7c7b\u6307\u6807"}</span><small>{"\u4ee5\u9996\u7ad9\u4e3a\u57fa\u51c6"}</small></th>{result.entries.map((entry,i)=><th key={entry.id} style={{'--compare-color':COLORS[i]} as React.CSSProperties}><div className="mw-comparison-site"><i/><button title={"\u67e5\u770b\u7ad9\u70b9\u5206\u6790"} disabled={!entry.detail} onClick={()=>onInspect(entry.id)}>{entry.detail?.site.name??entry.id}<ArrowUpRight size={10}/></button><button aria-label={'\u79fb\u9664\u5bf9\u6bd4 '+(entry.detail?.site.name??entry.id)} onClick={()=>state.removeComparison(entry.id)}><X size={12}/></button></div><small>{entry.detail?(entry.detail.current.status==='critical'?'\u5f02\u5e38':entry.detail.current.status==='warning'?'\u5173\u6ce8':'\u5e73\u7a33')+' \u00b7 '+(entry.detail.current.power==='battery'?'\u5907\u7528\u4f9b\u7535':'\u5e02\u7535\u6b63\u5e38'):'\u5f53\u524d\u8303\u56f4\u6216\u8fd0\u8425\u5546\u4e0d\u53ef\u7528'}</small><button className="mw-baseline" disabled={i===0} onClick={()=>state.set({compareIds:[entry.id,...state.compareIds.filter(id=>id!==entry.id)]})}>{i===0?'\u57fa\u51c6\u7ad9\u70b9':'\u8bbe\u4e3a\u57fa\u51c6'}</button></th>)}</tr></thead><tbody>{METRICS.map(m=><tr key={m.key} className={m.category?'mw-category-start':''}><th>{m.category&&<small>{m.category}</small>}<span>{m.name}</span><em>{m.unit}</em></th>{result.entries.map((entry,i)=>{const value=entry.detail?comparisonValue(m.key,entry.detail.current):null,base=baseline?comparisonValue(m.key,baseline.current):null;const delta=value!==null&&base!==null?value-base:null;return <td key={entry.id}><strong>{value===null?(m.key==='energy'&&entry.detail?'\u672a\u5206\u644a':'\u2014'):n(value,m.key==='sms'?0:2)}</strong>{showDelta&&i>0&&delta!==null&&<small className={Math.abs(delta)<0.005?'flat':''}>{Math.abs(delta)<0.005?'\u6301\u5e73':(delta>0?'+':'')+n(delta,m.key==='sms'?0:2)+(m.unit==='%'?' \u4e2a\u767e\u5206\u70b9':' '+m.unit)}</small>}</td>;})}</tr>)}</tbody></table></div>
    {result.entries.length===1&&<p className="mw-comparison-tip">{"\u518d\u52a0\u5165\u4e00\u4e2a\u7ad9\u70b9\uff0c\u67e5\u770b\u540c\u53e3\u5f84\u5dee\u5f02"}</p>}
    <div className="mw-comparison-trend-head"><span>{"24 \u5c0f\u65f6\u8d8b\u52bf "}<small>{"\u70b9\u51fb\u66f2\u7ebf\u533a\u57df\u5207\u6362\u65f6\u6bb5"}</small></span><select aria-label={"\u5bf9\u6bd4\u8d8b\u52bf\u6307\u6807"} value={metric} onChange={e=>setMetric(e.target.value as ComparisonMetric)}>{METRICS.map(m=><option key={m.key} value={m.key}>{m.name+' / '+m.unit}</option>)}</select></div>
    {series.length>0?<><div className="mw-comparison-series">{series.map(({detail,color})=><span key={detail.site.id}><i style={{background:color}}/>{detail.site.name}</span>)}<small>{selectedMetric.unit}</small></div><Chart entries={series} metric={metric} hour={state.hour} onHour={onHour}/></>:<p className="mw-comparison-tip">{"\u5f53\u524d\u8fd0\u8425\u5546\u4e0b\u65e0\u53ef\u5bf9\u6bd4\u6570\u636e\uff0c\u53ef\u5207\u6362\u8fd0\u8425\u5546\u6216\u79fb\u9664\u7ad9\u70b9"}</p>}
    </>}
    <section className="mw-comparison-discovery" aria-label={"\u5bf9\u6bd4\u5019\u9009\u7ad9\u70b9"}><label><Search size={13}/><input aria-label={"\u68c0\u7d22\u5bf9\u6bd4\u7ad9\u70b9"} placeholder={"\u68c0\u7d22\u7ad9\u70b9\u540d\u79f0 / \u7f16\u53f7"} value={state.search} onChange={e=>state.set({search:e.target.value})}/>{state.search&&<button aria-label={"\u6e05\u9664\u5bf9\u6bd4\u68c0\u7d22"} onClick={()=>state.set({search:''})}><X size={12}/></button>}</label><div className="mw-comparison-candidates">{pending?<span>{"\u6b63\u5728\u68c0\u7d22\u2026"}</span>:candidates.filter(p=>!state.compareIds.includes(p.id)).length?candidates.filter(p=>!state.compareIds.includes(p.id)).slice(0,4).map(p=><button key={p.id} disabled={state.compareIds.length>=COMPARE_LIMIT} aria-label={'\u52a0\u5165\u5bf9\u6bd4 '+p.name} onClick={()=>state.addComparison(p.id)}><Plus size={11}/>{p.name}</button>):<span>{state.search?'\u5f53\u524d\u8303\u56f4\u5185\u65e0\u5339\u914d\u7ad9\u70b9':'\u53ef\u7ee7\u7eed\u4ece\u5730\u56fe\u52a0\u5165\u7ad9\u70b9'}</span>}</div></section>
    </div><footer><span>{"\u6a21\u62df\u6570\u636e \u00b7 "}{state.compareIds.length>=COMPARE_LIMIT?'\u5df2\u8fbe 4 \u7ad9\u4e0a\u9650\uff0c\u79fb\u9664\u540e\u53ef\u7ee7\u7eed\u52a0\u5165':'\u70b9\u51fb\u5730\u56fe\u70b9\u4f4d\u52a0\u5165\u5bf9\u6bd4'}</span><small>{"\u5171\u4eab\u7535\u8017\u4e0d\u5206\u644a \u00b7 \u5dee\u503c\u4e0d\u4ee3\u8868\u4f18\u52a3"}</small></footer>
  </aside>;
}
