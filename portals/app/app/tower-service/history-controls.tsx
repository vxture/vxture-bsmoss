"use client";
import {useEffect,useRef,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {Button,Icon,Input,SegmentedControl,Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@vxture/design-system';
import type {SnapshotDescriptor} from '../domains/tower-service/query';
import type {AnalysisHref} from '../site-analysis/workspace';
import ResetButton from '../portal/reset-button';
import {latestPeriodId} from '../domains/tower-service/period-reset';
import {HISTORY_START,historyGrains,historyId,parseHistoryId,stepHistory,type HistoryGrain} from '../domains/tower-service/history-calendar';
const labels={hour:'\u65f6',day:'\u65e5',week:'\u5468',month:'\u6708',year:'\u5e74'};
export default function HistoryControls({id,href,snapshots,pending=false,onNavigate}:{id:string;href:AnalysisHref;snapshots:SnapshotDescriptor[];pending?:boolean;onNavigate?:(patch:Record<string,string|number>)=>void}){
 const router=useRouter(),input=useRef<HTMLInputElement>(null),p=parseHistoryId(id)!;
 const [loading,startTransition]=useTransition(),lock=useRef(false),busy=pending||loading;
 useEffect(()=>{if(!busy)lock.current=false;},[busy,id]);
 const change=(target:string,reset=false)=>{if(lock.current||busy||target===id&&!reset)return;const patch={snapshotId:target,compareSnapshotId:'',page:1};if(href(patch)===href())return;lock.current=true;if(onNavigate)onNavigate(patch);else startTransition(()=>router.push(href(patch),{scroll:false}));};
 const previous=stepHistory(id,-1),next=stepHistory(id,1),date=p.from.slice(0,10),value=p.grain==='hour'?p.from.slice(0,16):p.grain==='month'?p.from.slice(0,7):p.grain==='year'?p.from.slice(0,4):date;
 const choose=(grain:HistoryGrain,value:string)=>{try{const id=historyId(grain,value);if(parseHistoryId(id))change(id);}catch{}};
 return <><span role="status" aria-live="polite" className="analysis-loading">{loading?<><Icon name="refresh" size="md" className="animate-spin"/>{'\u6570\u636e\u52a0\u8f7d\u4e2d\u2026'}</>:null}</span><div inert={busy} aria-busy={busy} className="site-analysis-period-tools site-analysis-control-group tower-history-controls" role="group" aria-label={'\u5206\u6790\u65f6\u6bb5'}>
  <div className="site-analysis-datetime relative flex items-center"><Button size="icon-xl" variant="ghost" className="site-analysis-time-icon" aria-label={'\u9009\u62e9\u5206\u6790\u65f6\u95f4'} onClick={()=>{try{input.current?.showPicker();}catch{input.current?.focus();}}}><Icon name="calendar" size="md"/></Button><Input key={id} ref={input} type={p.grain==='hour'?'datetime-local':p.grain==='month'?'month':p.grain==='year'?'number':'date'} step={p.grain==='hour'?3600:1} aria-label={'\u5206\u6790\u65f6\u95f4'} value={value} min={p.grain==='year'?'2024':p.grain==='month'?'2024-11':p.grain==='hour'?HISTORY_START.slice(0,16):HISTORY_START.slice(0,10)} max={p.grain==='year'?'2026':p.grain==='month'?'2026-10':p.grain==='hour'?'2026-10-31T23:00':'2026-10-31'} onChange={e=>{const v=e.target.value;if(v)choose(p.grain,p.grain==='year'?v+'-01-01':p.grain==='month'?v+'-01':p.grain==='hour'?v+':00+08:00':v);}}/></div>
  <SegmentedControl size="md" ariaLabel={'\u5206\u6790\u5468\u671f'} value={p.grain} items={historyGrains.map(value=>({value,label:labels[value]}))} onChange={grain=>choose(grain as HistoryGrain,p.from)}/>
  <div className="site-analysis-period-steps site-analysis-control-group"><Button size="icon-xl" variant="outline" aria-label={'\u4e0a\u4e00\u5468\u671f'} disabled={!previous} onClick={()=>previous&&change(previous)}><Icon name="chevron-left" size="sm"/></Button><Button size="icon-xl" variant="outline" aria-label={'\u4e0b\u4e00\u5468\u671f'} disabled={!next} onClick={()=>next&&change(next)}><Icon name="chevron-right" size="sm"/></Button></div>
  <ResetButton variant="outline" label={'\u590d\u4f4d\u81f3\u6700\u65b0\u5468\u671f'} disabled={busy} onClick={()=>change(latestPeriodId(id,snapshots),true)}/>
 </div></>;
}
