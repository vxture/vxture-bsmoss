"use client";
import {useState} from 'react';
import {Button} from '@vxture/design-system';
import {useInvestigationLinks} from '../portal/investigation';
import {localReportStore} from './local-store';
export default function SaveLocalReport({endpoint,origin}:{endpoint:string;origin:string}){
 const [state,setState]=useState(''),[busy,setBusy]=useState(false),{carry}=useInvestigationLinks(origin);
 const save=async()=>{if(busy)return;setBusy(true);setState('');let store;
  try{const r=await fetch(endpoint,{cache:'no-store'});if(!r.ok)throw Error('report_fetch_failed');const artifact=await r.json();store=await localReportStore();await store.save(artifact);try{const c=new BroadcastChannel('bsmoss-local-reports');c.postMessage('saved');c.close();}catch{}setState('saved');}
  catch{setState('error');}finally{store?.close();setBusy(false);}
 };
 return <div className="flex min-w-0 flex-wrap items-center gap-sm"><Button variant="outline" disabled={busy} onClick={save}>{busy?'\u6b63\u5728\u4fdd\u5b58\u2026':'\u4fdd\u5b58\u5230\u62a5\u544a\u5e93'}</Button><Button asChild variant="ghost"><a href={carry('/reports')}>{'\u62a5\u544a\u5e93'}</a></Button>
 {state&&<span role="status" className="text-body-small text-muted-foreground">{state==='saved'?'\u5df2\u7559\u5b58\u672c\u673a\uff0c\u53ef\u5728\u62a5\u544a\u5e93\u4e0b\u8f7d\u539f\u6587\u4ef6\u3002':'\u4fdd\u5b58\u672a\u5b8c\u6210\uff0c\u8bf7\u68c0\u67e5\u6765\u6e90\u53ca\u672c\u673a\u5b58\u50a8\u540e\u91cd\u8bd5\u3002'}</span>}</div>;
}
