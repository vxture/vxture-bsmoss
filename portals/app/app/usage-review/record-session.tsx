"use client";
import {useState} from 'react';
import {Button,NativeSelect,StatusBadge} from '@vxture/design-system';
import type {LocalReviewRecords} from './use-records';
import {localError} from './record-labels';
import {timeLabel} from './labels';
export default function RecordSession({records:r}:{records:LocalReviewRecords}){
 const [notice,setNotice]=useState('');
 return <div className="flex min-w-0 flex-col gap-sm py-sm"><div className="flex flex-wrap items-center gap-sm">
  <StatusBadge tone="neutral" size="sm">{'\u6f14\u793a\u8bb0\u5f55\u00b7\u672c\u673a'}</StatusBadge><span className="text-body-small text-muted-foreground">{'\u8bbf\u5ba2\u64cd\u4f5c\u4ec5\u4fdd\u5b58\u5728\u672c\u6d4f\u89c8\u5668'}</span>
  {r.data&&<NativeSelect aria-label={'\u8bb0\u5f55\u4f1a\u8bdd'} wrapperClassName="max-w-full w-auto" value={r.selected??r.data.active} disabled={r.busy} onChange={e=>{r.select(e.target.value===r.data!.active?undefined:e.target.value);setNotice('');}}>{r.data.sessions.map(s=><option key={s.id} value={s.id}>{(s.id===r.data!.active?'\u5f53\u524d \u00b7 ':'\u5f52\u6863 \u00b7 ')+timeLabel(s.createdAt)+' \u00b7 '+s.id.slice(0,8)}</option>)}</NativeSelect>}
  <Button variant="ghost" disabled={r.busy} onClick={()=>void r.refresh()}>{'\u91cd\u8bfb\u8bb0\u5f55'}</Button>
  <Button variant="outline" disabled={r.busy} onClick={async()=>{try{await r.newSession();setNotice('\u5df2\u5f00\u59cb\u65b0\u4f1a\u8bdd\uff0c\u65e7\u8bb0\u5f55\u5df2\u5f52\u6863\u4fdd\u7559\u3002');}catch(e){setNotice(localError(e instanceof Error?e.message:''));}}}>{'\u5f00\u59cb\u65b0\u4f1a\u8bdd'}</Button>
 </div>{r.error&&<p role="alert" className="text-body-small text-destructive">{localError(r.error)}</p>}{!r.data&&!r.error&&<p role="status" className="text-body-small text-muted-foreground">{'\u6b63\u5728\u8bfb\u53d6\u672c\u673a\u8bb0\u5f55\u2026'}</p>}{notice&&<p role="status" className="text-body-small text-muted-foreground">{notice}</p>}</div>;
}
