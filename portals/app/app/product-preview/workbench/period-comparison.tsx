'use client';
import {SegmentedControl} from "@vxture/design-system";
import {useEffect,useMemo,useState} from 'react';
import {PeriodContributionView} from './period-contribution.tsx';
import {LoaderCircle,RotateCcw} from 'lucide-react';
import {serializeSelection} from '../../domains/map-demo/geometry.ts';
import {periodComparisonContextKey,type PeriodComparison} from '../../domains/map-demo/period-comparison-rules.ts';
import {COMPARISON_REASONS,COMPARISON_METRICS,changeLabel,signed,windowLabel} from '../../domains/map-demo/period-comparison-display.ts';
import type {MapQuery} from '../../domains/map-demo/types.ts';
import type {ReportPeriod} from '../../domains/map-demo/period-rules.ts';
const n=(v:number,d=2)=>v.toLocaleString('zh-CN',{maximumFractionDigits:d});
const pct=(v:number|null)=>v===null?'\u2014':n(v*100)+'%';
export function PeriodComparisonView({data,onPick}:{data:PeriodComparison;onPick?:(id:string)=>void}) {
  const [view,setView]=useState<'overview'|'contribution'>('overview');
  const [daily,setDaily]=useState(false),c=data.current,p=data.previous;
  return <section className={'mw-period-comparison'+(view==='contribution'?' is-contribution':'')} aria-label={'\u5468\u671f\u73af\u6bd4\u5206\u6790'}>
    <div className="mw-comparison-trend-head"><span>{'\u76f8\u90bb\u5b8c\u6574\u5468\u671f'}<small>{COMPARISON_REASONS[data.reason]}</small></span><SegmentedControl ariaLabel="环比显示口径" value={daily?'daily':'total'} onChange={value=>setDaily(value==='daily')} items={[{value:'total',label:'总量'},{value:'daily',label:'日均'}]}/></div>
    <SegmentedControl ariaLabel="分析内容" value={view} onChange={setView} items={[{value:'overview',label:'环比概览'},{value:'contribution',label:'排行与贡献'}]}/>
    <div className="mw-period-windows"><div><small>{'\u672c\u671f \xb7 '+c.days+' \u5929'}</small><strong>{windowLabel(c.window)}</strong></div><div><small>{'\u57fa\u671f \xb7 '+p.days+' \u5929'}</small><strong>{windowLabel(p.window)}</strong></div></div>
    {view==='overview'?<>
    <div className="mw-usage-table-scroll"><table className="mw-usage-table mw-period-table"><thead><tr><th>{daily?'\u65e5\u5747\u6307\u6807':'\u5468\u671f\u6307\u6807'}</th><th>{'\u672c\u671f'}</th><th>{'\u57fa\u671f'}</th><th>{'\u73af\u6bd4'}</th></tr></thead><tbody>{COMPARISON_METRICS.map(m=>{
      const change=data.metrics[m.key];return <tr key={m.key}><th>{m.label}<small>{m.unit+(daily?' / \u65e5':'')}</small></th><td>{n(Number(change.current)/m.scale/(daily?c.days:1))}</td><td>{n(Number(change.previous)/m.scale/(daily?p.days:1))}</td><td data-change={change.status}>{changeLabel(change,daily)}</td></tr>;
    })}<tr><th>{'\u603b\u8868\u7535\u8017'}<small>{'kWh'+(daily?' / \u65e5':'')}</small></th><td>{c.energyWh===null?'\u672a\u5206\u644a':n(c.energyWh/1000/(daily?c.days:1))}</td><td>{p.energyWh===null?'\u672a\u5206\u644a':n(p.energyWh/1000/(daily?p.days:1))}</td><td>{data.energy?changeLabel(data.energy,daily):'\u2014'}</td></tr></tbody></table></div>
    <div className="mw-period-points">{([{key:'connection',label:'\u63a5\u901a\u7387'},{key:'load',label:'\u5bb9\u91cf\u6837\u672c\u8d1f\u8f7d'}] as const).map(m=>{const r=data.rates[m.key];return <div key={m.key}><small>{m.label}</small><strong>{r.points===null?'\u2014':signed(r.points)+' \u4e2a\u767e\u5206\u70b9'}</strong><span>{pct(r.current)+' / '+pct(r.previous)}</span></div>;})}</div>
    <p className="mw-period-note">{c.days!==p.days?'\u6708\u4efd\u5929\u6570\u4e0d\u540c\uff0c\u5efa\u8bae\u540c\u65f6\u67e5\u770b\u65e5\u5747\u73af\u6bd4\u3002':'\u603b\u91cf\u4e0e\u65e5\u5747\u72ec\u7acb\u8ba1\u7b97\uff1b\u6bd4\u7387\u5408\u5e76\u5206\u5b50\u5206\u6bcd\u3002'}{'\u4e0a\u5347\u6216\u4e0b\u964d\u4ec5\u8868\u793a\u6570\u503c\u65b9\u5411\u3002'}</p>
    <details className="mw-usage-evidence"><summary>{'\u5bf9\u6bd4\u4f9d\u636e\u4e0e\u539f\u59cb\u8ba1\u6570'}</summary><p>{'\u7269\u7406\u7ad9\u5740 '+c.physicalSites+' / '+p.physicalSites+'\uff1b\u670d\u52a1\u5173\u7cfb '+c.serviceRelations+' / '+p.serviceRelations}</p><p>{'\u672c\u671f\u6837\u672c '+n(c.observedSamples,0)+' / '+n(c.expectedSamples,0)+'\uff1b\u57fa\u671f\u6837\u672c '+n(p.observedSamples,0)+' / '+n(p.expectedSamples,0)}</p><p>{'\u670d\u52a1\u6837\u672c \u00b7 \u672c\u671f '+n(c.observedServiceSamples,0)+' / '+n(c.expectedServiceSamples,0)+' \u00b7 \u57fa\u671f '+n(p.observedServiceSamples,0)+' / '+n(p.expectedServiceSamples,0)}</p>{COMPARISON_METRICS.map(m=><p key={m.key}>{m.label+' '+data.metrics[m.key].current+' / '+data.metrics[m.key].previous+' / \u5dee\u503c '+(data.metrics[m.key].delta??'\u4e0d\u53ef\u6bd4')}</p>)}<p>{c.window.start+' \u2192 '+c.window.end+' / '+p.window.start+' \u2192 '+p.window.end+' / Asia/Shanghai'}</p><p>{data.version+' / '+c.ruleVersion}</p><p>{'\u53cc\u671f\u6309\u56fa\u5b9a\u7ad9\u5740\u4e0e\u670d\u52a1\u5173\u7cfb\u5bf9\u6bd4\uff1b\u6765\u6e90\u5b8c\u6210\u72b6\u6001\u4ee5\u8d28\u91cf\u8bb0\u5f55\u4e3a\u51c6\u3002\u65e0\u540c\u6bd4\u57fa\u671f\uff0c\u4e0d\u8f93\u51fa\u540c\u6bd4\u3002'}</p></details>
    </>:<PeriodContributionView data={data} daily={daily} onPick={onPick}/>}
  </section>;
}
export function PeriodComparisonLoader({query,period,onPick}:{query:MapQuery;period:ReportPeriod;onPick?:(id:string)=>void}) {
  const [snapshot,setSnapshot]=useState<PeriodComparison|null>(null),[error,setError]=useState(false),[revision,setRevision]=useState(0);
  const key=periodComparisonContextKey(query,period);
  const params=useMemo(()=>{
    const p=new URLSearchParams({regionId:query.regionId,cityId:query.cityId,countyId:query.countyId,operator:query.operator,search:query.search,period});
    if(query.selection)p.set('selection',serializeSelection(query.selection));return p.toString();
  },[query.regionId,query.cityId,query.countyId,query.operator,query.search,query.selection,period]);
  useEffect(()=>{
    const controller=new AbortController();setError(false);
    fetch('/api/product-preview/period-comparison?'+params,{signal:controller.signal}).then(async r=>{if(!r.ok)throw Error('comparison_failed');return r.json();}).then(result=>{if(!controller.signal.aborted)setSnapshot(result);}).catch(()=>{if(!controller.signal.aborted)setError(true);});
    return()=>controller.abort();
  },[params,revision]);
  if(error)return <div className="mw-comparison-empty"><span>{'\u73af\u6bd4\u52a0\u8f7d\u5931\u8d25'}</span><button onClick={()=>setRevision(v=>v+1)}><RotateCcw size={13}/>{'\u91cd\u8bd5'}</button></div>;
  return snapshot?.contextKey===key?<PeriodComparisonView data={snapshot} onPick={onPick}/>:<div className="mw-comparison-empty"><LoaderCircle size={20} className="mw-spin"/><span>{'\u6b63\u5728\u6c47\u603b\u57fa\u671f'}</span></div>;
}
