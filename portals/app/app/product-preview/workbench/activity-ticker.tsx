'use client';
import { Activity, Pause, Play } from 'lucide-react';
import { useState } from 'react';
import type { MapSnapshot } from '../../domains/map-demo/types.ts';
export default function ActivityTicker({snapshot,onPick}:{snapshot:MapSnapshot;onPick:(id:string)=>void}) {
  const [paused,setPaused]=useState(false);
  const hour=String(snapshot.hour).padStart(2,'0')+':00';
  const items=snapshot.ranking.map(p=>({id:p.id,status:p.status,name:p.name,message:p.status==='critical'?'\u4f9b\u7535\u5f02\u5e38':p.status==='warning'?'\u8fd0\u884c\u5173\u6ce8':'\u8fd0\u884c\u5e73\u7a33',value:p.trafficGiB.toFixed(1)+' GiB',load:(p.load*100).toFixed(1)+'%'}));
  return <div className={'mw-ticker '+(paused?'paused':'')} aria-label={'\u5e95\u90e8\u7ad9\u7f51\u52a8\u6001'}>
    <div className="mw-ticker-label"><Activity size={13}/><span>{'\u7ad9\u7f51\u52a8\u6001'}</span><button title={paused?'\u7ee7\u7eed\u6eda\u52a8':'\u6682\u505c\u6eda\u52a8'} aria-label={paused?'\u7ee7\u7eed\u6eda\u52a8':'\u6682\u505c\u6eda\u52a8'} onClick={()=>setPaused(!paused)}>{paused?<Play size={10}/>:<Pause size={10}/>}</button></div>
    <div className="mw-ticker-window"><div className="mw-ticker-track">{[0,1].map(copy=><div className="mw-ticker-group" key={copy} aria-hidden={copy===1?true:undefined}><span className="mw-ticker-summary"><small>{hour}</small><span>{'\u9655\u897f'}</span><strong>{snapshot.summary.count+' \u7ad9'}</strong><span>{'\u5173\u6ce8 '+snapshot.summary.warning}</span><span>{'\u5f02\u5e38 '+snapshot.summary.critical}</span></span>{items.map(item=><button tabIndex={copy===1?-1:0} key={item.id} onClick={()=>onPick(item.id)}><i className={item.status}/><span>{item.name}</span><small>{item.message}</small><strong>{item.value}</strong><span className="mw-ticker-load">{item.load}</span></button>)}</div>)}</div></div><span className="mw-ticker-clock">{hour+' CST'}</span>
  </div>;
}
