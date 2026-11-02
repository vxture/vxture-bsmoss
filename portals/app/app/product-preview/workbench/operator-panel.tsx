'use client';
import CalendarPanel from './calendar-panel.tsx';
import PeriodSelector from './period-selector.tsx';
import {PeriodComparisonLoader} from './period-comparison.tsx';
import {serializeSelection,selectionLabel} from '../../domains/map-demo/geometry.ts';
import {useEffect,useMemo,useState} from 'react';
import {Table2,X,LoaderCircle,RotateCcw,ChevronDown} from 'lucide-react';
import {useWorkbench} from '../../domains/map-demo/workbench-store.ts';
import {usageContextKey,type OperatorUsage} from '../../domains/map-demo/operator-rules.ts';
import {GIB} from '../../domains/map-demo/rules.ts';
import type {OperatorFilter,RegionDefinition} from '../../domains/map-demo/types.ts';
import {OP_NAMES} from './station-panel.tsx';
const COLORS=['#7fcbb3','#d8bb82','#9db7e3','#c3a1ce','#82b4be'];
const n=(v:number,d=2)=>v.toLocaleString('zh-CN',{maximumFractionDigits:d});
const pct=(v:number|null)=>v===null?'\u2014':n(v*100)+'%';
export default function OperatorPanel({region}:{region:RegionDefinition}) {
  const state=useWorkbench();
  if(!state.usageOpen)return null;
  return state.usagePeriod==='week'||state.usagePeriod==='month'?<CalendarPanel mode="usage" region={region}/>:<DailyOperatorPanel region={region}/>;
}
function DailyOperatorPanel({region}:{region:RegionDefinition}) {
  const state=useWorkbench();
  const [snapshot,setSnapshot]=useState<OperatorUsage|null>(null),[error,setError]=useState(false),[revision,setRevision]=useState(0);
  const [comparisonOpen,setComparisonOpen]=useState(false);
  const [metric,setMetric]=useState<'bytes'|'voiceSeconds'|'sms'>('bytes');
  const query=useMemo(()=>({regionId:region.id,cityId:state.cityId,countyId:state.countyId,operator:state.operator,hour:state.hour,selection:state.selection??undefined,search:''}),[region.id,state.cityId,state.countyId,state.operator,state.hour,state.selection]);
  const period=state.usagePeriod==='hour'?'hour':'day',key=usageContextKey(query,period);
  useEffect(()=>{
    if(!state.usageOpen)return;
    const controller=new AbortController();setError(false);
    const p=new URLSearchParams({regionId:query.regionId,cityId:query.cityId,countyId:query.countyId,operator:query.operator,hour:String(query.hour),period});
    if(query.selection)p.set('selection',serializeSelection(query.selection));
    fetch('/api/product-preview/operators?'+p,{signal:controller.signal}).then(async r=>{if(!r.ok)throw Error('usage_failed');return r.json();}).then(result=>{if(!controller.signal.aborted)setSnapshot(result);}).catch(()=>{if(!controller.signal.aborted)setError(true);});
    return()=>controller.abort();
  },[query,period,state.usageOpen,revision]);
  if(!state.usageOpen)return null;
  const result=snapshot?.contextKey===key?snapshot:null;
  const scope=region.counties.find(c=>c.id===state.countyId)?.name??region.cities.find(c=>c.id===state.cityId)?.name??region.name;
  const scale=metric==='bytes'?GIB:metric==='voiceSeconds'?3600:1;
  const unit=metric==='bytes'?'GiB':metric==='voiceSeconds'?'\u5c0f\u65f6':'\u6761';
  const max=result?Math.max(1,...result.series.map(h=>h.rows.reduce((sum,r)=>sum+r[metric],0))):1;
  return <aside className="mw-comparison mw-operator-panel" aria-label={'\u8fd0\u8425\u5546\u4f7f\u7528\u6838\u67e5'}>
    <header><span><Table2 size={15}/>{'\u8fd0\u8425\u5546\u4f7f\u7528\u6838\u67e5'}</span><div><small>{'\u6a21\u62df\u6570\u636e'}</small><button aria-label={'\u5173\u95ed\u4f7f\u7528\u6838\u67e5'} onClick={()=>state.set({usageOpen:false})}><X size={15}/></button></div></header>
    <div className="mw-comparison-context"><span>{scope+(state.selection?' \xb7 '+selectionLabel(state.selection):'')+' \xb7 '+(period==='day'?'\u5168\u5929\u7d2f\u8ba1':String(state.hour).padStart(2,'0')+':00 \u2014 '+String(state.hour+1).padStart(2,'0')+':00')}</span><PeriodSelector mode="usage"/><select aria-label={'\u6838\u67e5\u8fd0\u8425\u5546'} value={state.operator} onChange={e=>state.set({operator:e.target.value as OperatorFilter,playing:false})}><option value="all">{'\u5168\u90e8\u8fd0\u8425\u5546'}</option>{Object.entries(OP_NAMES).map(([code,name])=><option key={code} value={code}>{name}</option>)}</select></div>
    <div className="mw-comparison-content">
      {error?<div className="mw-comparison-empty"><span>{'\u6838\u67e5\u6570\u636e\u52a0\u8f7d\u5931\u8d25'}</span><button onClick={()=>setRevision(v=>v+1)}><RotateCcw size={13}/>{'\u91cd\u8bd5'}</button></div>:!result?<div className="mw-comparison-empty"><LoaderCircle size={22} className="mw-spin"/><span>{'\u6b63\u5728\u6c47\u603b\u4f7f\u7528\u91cf'}</span></div>:<>
      <div className="mw-usage-summary"><div><small>{'\u7269\u7406\u7ad9\u5740'}</small><strong>{n(result.physicalSites,0)}</strong></div><div><small>{'\u8fd0\u8425\u5546\u670d\u52a1\u5173\u7cfb'}</small><strong>{n(result.serviceRelations,0)}</strong></div><div><small>{'\u5176\u4e2d\u591a\u65b9\u5171\u4eab\u7ad9\u5740'}</small><strong>{n(result.sharedSites,0)}</strong></div><span>{'\u5171\u4eab\u7ad9\u5740\u53bb\u91cd\u7edf\u8ba1'}</span></div>
      <div className="mw-usage-table-scroll"><table className="mw-usage-table"><thead><tr>{['\u8fd0\u8425\u5546 / \u670d\u52a1\u7ad9\u6570','\u53cc\u5411\u6d41\u91cf / GiB','\u901a\u8bdd / \u5c0f\u65f6','\u77ed\u4fe1 / \u6761','\u63a5\u901a\u7387','\u8d1f\u8f7d\u7387'].map(s=><th key={s}>{s}</th>)}</tr></thead><tbody>{result.rows.map((r,i)=><tr key={r.code}><th><span><i style={{background:COLORS[i]}}/>{OP_NAMES[r.code]}</span><small>{n(r.sites,0)+' \u7ad9'}</small></th><td>{n(r.bytes/GIB)}</td><td>{n(r.voiceSeconds/3600)}</td><td>{n(r.sms,0)}</td><td>{pct(r.connectionRate)}</td><td>{pct(r.load)}</td></tr>)}</tbody><tfoot><tr><th>{'\u540c\u8303\u56f4\u6c47\u603b'}</th><td>{n(result.totals.bytes/GIB)}</td><td>{n(result.totals.voiceSeconds/3600)}</td><td>{n(result.totals.sms,0)}</td><td>{pct(result.totals.connectionRate)}</td><td>{pct(result.totals.load)}</td></tr></tfoot></table></div>
      <div className="mw-usage-check"><i/>{Object.values(result.checks).every(v=>v===0)?'\u4e1a\u52a1\u5206\u9879\u4e0e\u6c47\u603b\u4e00\u81f4':'\u5206\u9879\u5b58\u5728\u5dee\u5f02\uff0c\u8bf7\u6838\u9a8c'}<small>{'\u4ec5\u6838\u67e5\u672c\u6f14\u793a\u5185\u5408\u8ba1\u5173\u7cfb'}</small></div>
      <div className="mw-comparison-trend-head"><span>{'24 \u5c0f\u65f6\u4f7f\u7528\u7ed3\u6784'}<small>{'\u70b9\u51fb\u67f1\u5f62\u5b9a\u4f4d\u5c0f\u65f6'}</small></span><select aria-label={'\u4f7f\u7528\u8d8b\u52bf\u6307\u6807'} value={metric} onChange={e=>setMetric(e.target.value as typeof metric)}><option value="bytes">{'\u6d41\u91cf / GiB'}</option><option value="voiceSeconds">{'\u901a\u8bdd / \u5c0f\u65f6'}</option><option value="sms">{'\u77ed\u4fe1 / \u6761'}</option></select></div>
      <div className="mw-usage-bars" aria-label={'\u8fd0\u8425\u5546\u9010\u5c0f\u65f6\u4e1a\u52a1\u91cf'}>{result.series.map(h=><button key={h.hour} className={state.hour===h.hour?'active':''} aria-label={h.hour+':00 '+n(h.rows.reduce((sum,r)=>sum+r[metric],0)/scale)+' '+unit} title={h.hour+':00 / '+h.rows.map(r=>OP_NAMES[r.code]+' '+n(r[metric]/scale)+' '+unit).join(' \xb7 ')} onClick={()=>state.set({hour:h.hour,usagePeriod:'hour',playing:false})}><span style={{height:Math.max(0,h.rows.reduce((sum,r)=>sum+r[metric],0)/max*100)+'%'}}>{h.rows.map((r,i)=><i key={r.code} style={{flex:r[metric],background:COLORS[i]}}/>)}</span></button>)}</div>
      <div className="mw-usage-axis"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:00</span></div>
      <div className="mw-usage-legend">{result.rows.map((r,i)=><span key={r.code}><i style={{background:COLORS[i]}}/>{OP_NAMES[r.code]}</span>)}</div>
      <details className="mw-usage-evidence" key={key}><summary><ChevronDown size={12}/>{'\u8ba1\u7b97\u4f9d\u636e\u4e0e\u539f\u59cb\u8ba1\u6570'}</summary><p>{result.window.start+' \u2192 '+result.window.end+' \xb7 '+result.window.timezone}</p><p>{'\u63a5\u901a\u7387\uff1d\u63a5\u901a\u6b21\u6570\u5408\u8ba1 / \u547c\u53eb\u5c1d\u8bd5\u5408\u8ba1\uff1b\u8d1f\u8f7d\u7387\uff1d\u5360\u7528\u5bb9\u91cf\u6837\u672c\u5408\u8ba1 / \u53ef\u7528\u5bb9\u91cf\u6837\u672c\u5408\u8ba1\u3002\u5168\u5929\u6309\u7b49\u957f\u5c0f\u65f6\u6837\u672c\u8ba1\u7b97\uff0c\u4e0d\u5bf9\u767e\u5206\u6bd4\u53d6\u5e73\u5747\u3002'}</p><p>{'\u6d41\u91cf\uff1d\u4e0a\u884c\u5b57\u8282\uff0b\u4e0b\u884c\u5b57\u8282\uff1b\u901a\u8bdd\u4ee5\u79d2\u7d2f\u8ba1\u3002\u5bb9\u91cf\u4e3a\u573a\u666f\u5185\u5f52\u4e00\u5316\u5bb9\u91cf\u5355\u4f4d\uff0c\u4e0d\u4ee3\u8868\u771f\u5b9e\u8bbe\u5907\u8d44\u6e90\u89c4\u6a21\u3002'}</p>{result.rows.map(r=><div className="mw-usage-evidence-row" key={r.code}><strong>{OP_NAMES[r.code]}</strong><span>{'\u4e0a\u884c '+n(r.upBytes,0)+' B / \u4e0b\u884c '+n(r.downBytes,0)+' B'}</span><span>{'\u901a\u8bdd '+n(r.voiceSeconds,0)+' s / \u77ed\u4fe1 '+n(r.sms,0)+' \u6761'}</span><span>{'\u63a5\u901a '+n(r.connected,0)+' / \u5c1d\u8bd5 '+n(r.attempts,0)}</span><span>{'\u5360\u7528 '+n(r.used,0)+' / \u5bb9\u91cf '+n(r.capacity,0)+' \xb7 '+n(r.samples,0)+' \u7ad9\u65f6\u6837\u672c'}</span></div>)}<p>{'\u6765\u6e90\uff1a\u5408\u6210\u573a\u666f\u5f15\u64ce \xb7 '+result.version+' \xb7 '+result.ruleVersion}</p></details>
      {period==='day'&&<details className="mw-usage-evidence mw-day-comparison" onToggle={e=>setComparisonOpen(e.currentTarget.open)}><summary>{'\u76f8\u90bb\u65e5\u73af\u6bd4'}</summary>{comparisonOpen&&<PeriodComparisonLoader query={query} period="day"/>}</details>}
      <div className="mw-usage-energy"><span>{'\u8fd0\u884c\u53c2\u6570 \xb7 '+(result.energyWh===null?'\u8fd0\u8425\u5546\u7535\u8017\u672a\u5206\u644a':'\u7269\u7406\u7ad9\u5740\u603b\u8868\u7535\u8017 '+n(result.energyWh/1000)+' kWh')}</span><small>{'\u603b\u8868\u7535\u8017\u4e0d\u6309\u4e1a\u52a1\u91cf\u5206\u914d\uff1b\u8fd0\u8425\u5546\u670d\u52a1\u7ad9\u6570\u4e0d\u53ef\u76f8\u52a0\u4f5c\u4e3a\u7269\u7406\u7ad9\u5740\u603b\u6570\u3002'}</small></div>
      {!result.physicalSites&&<p className="mw-comparison-tip">{'\u5f53\u524d\u8303\u56f4\u65e0\u5339\u914d\u7ad9\u5740\uff1b\u6bd4\u7387\u4fdd\u7559\u672a\u77e5\u3002'}</p>}
      </>}
    </div><footer><span>{'\u6a21\u62df\u573a\u666f \xb7 \u7528\u91cf\u6838\u67e5'}</span><small>{'\u7edf\u8ba1\u7ed3\u679c\u4e0d\u5305\u542b\u8d39\u7528'}</small></footer>
  </aside>;
}
