'use client';
import {useState} from 'react';
import {parseSelection,serializeSelection,selectionLabel} from '../../domains/map-demo/geometry.ts';
import type {CircleSelection} from '../../domains/map-demo/types.ts';
import { Activity, BarChart3, BoxSelect, X, RotateCcw, ArrowUpRight, LoaderCircle, AlertTriangle, RadioTower } from 'lucide-react';
import type { MapSnapshot, OperatorFilter } from '../../domains/map-demo/types.ts';
import { useWorkbench } from '../../domains/map-demo/workbench-store.ts';
import { GIB } from '../../domains/map-demo/rules.ts';
import { OP_NAMES, OP_COLORS } from './station-panel.tsx';
const n=(value:number,digits=1)=>value.toLocaleString('zh-CN',{maximumFractionDigits:digits});
const rate=(value:number|null)=>value===null?'\u2014':n(value*100,2)+'%';
function CircleScope({selection}:{selection:CircleSelection}) {
  const [radius,setRadius]=useState(String(selection.radiusMeters/1000)),[invalid,setInvalid]=useState(false);
  const apply=(km:number)=>{
    try{const next=parseSelection('circle:'+selection.center.join(',')+','+Math.round(km*1000));useWorkbench.getState().finishSelection(next);}
    catch{setInvalid(true);}
  };
  return <div className="mw-circle-scope"><form onSubmit={e=>{e.preventDefault();apply(Number(radius));}}><span>{'\u534a\u5f84'}</span><input aria-label={'\u5706\u5f62\u9009\u533a\u534a\u5f84'} type="number" min="0.01" max="500" step="0.001" required value={radius} onChange={e=>{setRadius(e.target.value);setInvalid(false);}}/><small>km</small><button type="submit">{'\u5e94\u7528'}</button><div>{[1,3,5,10].map(km=><button type="button" key={km} onClick={()=>apply(km)}>{km+' km'}</button>)}</div></form><small>{selection.center.map(v=>v.toFixed(5)).join(' / ')+' \u00b7 WGS84'}</small>{invalid&&<small role="alert">{'\u8bf7\u4f7f\u7528 0.01\u2014500 km \u7684\u6709\u6548\u534a\u5f84'}</small>}</div>;
}
export default function AreaPanel({snapshot,loading,error,onPick,onRetry}:{snapshot:MapSnapshot|null;loading:boolean;error:boolean;onPick:(id:string)=>void;onRetry:()=>void}) {
  const state=useWorkbench();
  if(!state.selection||!state.selectionOpen||state.drawing)return null;
  const area=snapshot?.area,summary=snapshot?.summary;
  const peak=area?Math.max(1,...area.series.map(s=>s.bytes)):1;
  return <aside className="mw-area-panel" aria-label={'\u533a\u57df\u6846\u9009\u5206\u6790'} aria-busy={loading}>
    <header><span><BoxSelect size={14}/>{'\u533a\u57df\u5206\u6790'}</span><div><button aria-label={'\u91cd\u65b0\u6846\u9009'} title={'\u91cd\u65b0\u6846\u9009'} onClick={()=>state.beginSelection()}><RotateCcw size={13}/></button><button aria-label={'\u6536\u8d77\u533a\u57df\u5206\u6790'} onClick={()=>state.set({selectionOpen:false})}><X size={15}/></button></div></header>
    <div className="mw-area-content">
    <div className="mw-area-context"><span>{selectionLabel(state.selection)}<small>{'2026.10.25 \u00b7 '+String(state.hour).padStart(2,'0')+':00'}</small></span><select aria-label={'\u533a\u57df\u8fd0\u8425\u5546'} value={state.operator} onChange={e=>state.set({operator:e.target.value as OperatorFilter,selectedId:null})}><option value="all">{'\u5168\u90e8\u8fd0\u8425\u5546'}</option>{Object.entries(OP_NAMES).map(([code,label])=><option key={code} value={code}>{label}</option>)}</select></div>
    {!Array.isArray(state.selection)&&state.selection.kind==='circle'&&<CircleScope key={serializeSelection(state.selection)} selection={state.selection}/>}
    {error?<div className="mw-area-empty"><AlertTriangle size={24}/><p>{'\u533a\u57df\u5206\u6790\u66f4\u65b0\u5931\u8d25'}</p><button onClick={onRetry}>{'\u91cd\u8bd5'}</button></div>:!area||!summary?<div className="mw-area-empty"><LoaderCircle size={22} className="mw-spin"/><p>{'\u6b63\u5728\u5206\u6790\u9009\u533a\u7ad9\u7f51'}</p></div>:!summary.count?<div className="mw-area-empty"><RadioTower size={28}/><p>{'\u9009\u533a\u5185\u6682\u65e0\u5339\u914d\u7ad9\u70b9'}</p><small>{'\u53ef\u8c03\u6574\u9009\u6846\u3001\u5730\u57df\u6216\u8fd0\u8425\u5546'}</small><button onClick={()=>state.beginSelection()}>{'\u91cd\u65b0\u6846\u9009'}</button></div>:<>
      <div className="mw-area-total"><div><strong>{n(summary.count,0)}</strong><span>{'\u4e2a\u7269\u7406\u7ad9\u5740'}</span></div><div className="mw-area-status"><span><i className="normal"/>{summary.normal+' \u5e73\u7a33'}</span><span><i className="warning"/>{summary.warning+' \u5173\u6ce8'}</span><span><i className="critical"/>{summary.critical+' \u5f02\u5e38'}</span></div></div>
      <div className="mw-area-section-label"><BarChart3 size={12}/>{'\u7ecf\u8425\u670d\u52a1'}</div>
      <div className="mw-area-kpis"><div><span>{'\u53cc\u5411\u6d41\u91cf'}</span><strong>{n(summary.bytes/GIB)}<small>{'GiB'}</small></strong></div><div><span>{'\u901a\u8bdd\u65f6\u957f'}</span><strong>{n(summary.voiceSeconds/3600)}<small>{'\u5c0f\u65f6'}</small></strong></div><div><span>{'\u77ed\u4fe1\u91cf'}</span><strong>{n(summary.sms,0)}<small>{'\u6761'}</small></strong></div></div>
      <div className="mw-area-secondary"><div><span>{'\u63a5\u901a\u7387'}</span><strong>{rate(summary.connectionRate)}</strong></div><div><span>{'\u8d44\u6e90\u8d1f\u8f7d\u7387'}</span><strong>{rate(summary.load)}</strong></div><div><span>{'\u65f6\u6bb5\u7535\u8017'}</span><strong title={summary.energyWh===null?'\u7269\u7406\u7ad9\u5740\u603b\u8868\u672a\u5206\u644a\u5230\u8fd0\u8425\u5546':undefined}>{summary.energyWh===null?'\u672a\u5206\u644a':n(summary.energyWh/1000)+' kWh'}</strong></div></div>
      <div className="mw-area-section-label"><Activity size={12}/>{'24 \u5c0f\u65f6\u6d41\u91cf'}<small>{'GiB \u00b7 \u70b9\u51fb\u5207\u6362\u65f6\u6bb5'}</small></div>
      <div className="mw-area-bars" role="group" aria-label={'\u533a\u57df24\u5c0f\u65f6\u6d41\u91cf'}>{area.series.map(s=><button key={s.hour} aria-label={String(s.hour).padStart(2,'0')+':00 \u6d41\u91cf '+n(s.bytes/GIB)+' GiB'} aria-pressed={s.hour===state.hour} title={String(s.hour).padStart(2,'0')+':00 \u00b7 '+n(s.bytes/GIB)+' GiB \u00b7 \u901a\u8bdd '+n(s.voiceSeconds/3600)+' \u5c0f\u65f6'} className={s.hour===state.hour?'active':''} onClick={()=>state.set({hour:s.hour,playing:false})}><i style={{height:Math.max(2,s.bytes/peak*100)+'%'}}/></button>)}</div><div className="mw-area-axis"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:00</span></div>
      <div className="mw-area-section-label">{'\u8fd0\u8425\u5546\u6d41\u91cf\u6784\u6210'}<small title={'\u540c\u4e00\u5171\u4eab\u7ad9\u5740\u53ef\u670d\u52a1\u591a\u4e2a\u8fd0\u8425\u5546\uff0c\u670d\u52a1\u7ad9\u6570\u4e0d\u53e0\u52a0'}>{'\u670d\u52a1\u7ad9\u6570 / \u6d41\u91cf'}</small></div>
      <div className="mw-area-operators">{area.operators.map(op=><div key={op.code}><span><i style={{background:OP_COLORS[op.code]}}/>{OP_NAMES[op.code]}</span><small>{op.sites+' \u7ad9'}</small><div><i style={{width:(summary.bytes?op.bytes/summary.bytes*100:0)+'%',background:OP_COLORS[op.code]}}/></div><strong>{n(op.bytes/GIB)+' GiB'}</strong></div>)}</div>
      <div className="mw-area-section-label">{'\u91cd\u70b9\u7ad9\u70b9'}<small>{'\u72b6\u6001\u4f18\u5148 \u00b7 \u6d41\u91cf\u6392\u5e8f'}</small></div>
      <div className="mw-area-ranking">{snapshot.ranking.slice(0,3).map((p,i)=><button key={p.id} onClick={()=>onPick(p.id)}><span className="mw-rank">{String(i+1).padStart(2,'0')}</span><div><strong>{p.name}</strong><small>{n(p.trafficGiB)+' GiB \u00b7 \u8d1f\u8f7d '+n(p.load*100)+'%'}</small></div><i className={p.status}/><ArrowUpRight size={12}/></button>)}</div>
    </>}
    </div>
    <footer><span>{'\u6a21\u62df\u6837\u672c \u00b7 \u5171\u4eab\u7ad9\u5740\u4ec5\u8ba1\u4e00\u6b21'}</span><button onClick={()=>state.clearSelection()}>{'\u6e05\u9664\u9009\u533a'}</button></footer>
  </aside>;
}
