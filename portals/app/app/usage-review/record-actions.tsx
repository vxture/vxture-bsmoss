"use client";
import {useEffect,useRef,useState} from 'react';
import {Button,Collapsible,CollapsibleTrigger,CollapsibleContent,DataTable,NativeSelect,PanelCard,StatusBadge,Textarea} from '@vxture/design-system';
import type {ReviewCase} from '../domains/usage-verification/demo';
import {evidenceRef,type ReviewAction,type ReviewCommand,type Reason} from '../domains/usage-verification/events';
import {recordProjection} from '../domains/usage-verification/event-service';
import type {LocalReviewRecords} from './use-records';
import {actionNames,causeNames,localError} from './record-labels';
import {quantity,statusNames,timeLabel,windowLabel} from './labels';
import RecordSession from './record-session';
export default function RecordActions({item,records:r,eventNumber,retired=false}:{item:ReviewCase;records:LocalReviewRecords;eventNumber?:number;retired?:boolean}){
 const log=r.data?.logs.find(l=>l.caseId===item.id),p=recordProjection(log,item),[action,setAction]=useState<ReviewAction>('confirm'),[reason,setReason]=useState<Reason>('demand'),[note,setNote]=useState(''),[notice,setNotice]=useState(''),[failure,setFailure]=useState('');
 const retry=useRef<ReviewCommand|null>(null),gate=useRef(false);
 const [draftRevision,setDraftRevision]=useState<number|null>(null),draftStale=draftRevision!==null&&draftRevision!==p.revision;
 useEffect(()=>{if(eventNumber&&log?.events.some(e=>e.revision===eventNumber))document.getElementById('review-event-'+eventNumber)?.scrollIntoView({block:'start'});},[eventNumber,log?.events.length]);
 const actions:ReviewAction[]=p.state==='open'?['confirm']:p.state==='awaiting_review'?['approve','return','reopen']:['reopen'];
 const chosen=draftRevision!==null?action:actions.includes(action)?action:actions[0],locked=!!retry.current,options=actions.includes(chosen)?actions:[chosen,...actions];
 const submit=async()=>{
  if(gate.current||draftStale&&!retry.current)return;gate.current=true;setNotice('');setFailure('');
  const input=retry.current??{commandId:crypto.randomUUID(),caseId:item.id,expectedRevision:p.revision,evidenceRef:chosen==='return'||chosen==='reopen'?p.confirmation??evidenceRef(item):evidenceRef(item),action:chosen,...(chosen==='confirm'?{reasonCode:reason as Reason}:{}),note};
  retry.current=input;
  try{const e=await r.perform([item],input);retry.current=null;setNote('');setDraftRevision(null);setNotice(actionNames[e.command.action]+'\u5df2\u4fdd\u5b58 \u00b7 \u7b2c'+e.revision+'\u6761\u8bb0\u5f55');}
  catch(e){const code=e instanceof Error?e.message:'';if(!['review_storage_unavailable','AbortError','QuotaExceededError'].includes(code))retry.current=null;setFailure(code);}
  finally{gate.current=false;}
 };
 return <><PanelCard title={'\u539f\u56e0\u4e0e\u590d\u6838'} icon="list-checks"><RecordSession records={r}/>
  <div className="flex flex-wrap items-center gap-sm py-md"><StatusBadge tone={p.state==='closed'?'success':'neutral'} size="sm">{statusNames[p.state]}</StatusBadge><span className="text-body-small text-muted-foreground">{'\u8bb0\u5f55\u7248\u672c '+p.revision+(p.reason?' \u00b7 '+causeNames[p.reason]:'')}</span></div>
  {p.changed&&<p role="alert" className="pb-md text-body-small text-destructive">{p.state==='open'?'\u4f9d\u636e\u5df2\u53d8\u5316\uff0c\u8bf7\u57fa\u4e8e\u5f53\u524d\u4f9d\u636e\u91cd\u65b0\u786e\u8ba4\u3002\u65e7\u8bb0\u5f55\u4e0e\u539f\u8bc1\u636e\u4fdd\u7559\u3002':'\u4f9d\u636e\u5df2\u53d8\u5316\uff0c\u9700\u91cd\u65b0\u6253\u5f00\u6838\u9a8c\u3002\u65e7\u786e\u8ba4\u4e0e\u539f\u8bc1\u636e\u4fdd\u7559\u3002'}</p>}
  {retired?<p className="text-body-small text-muted-foreground">{'\u5f53\u524d\u89c4\u5219\u672a\u547d\u4e2d\uff0c\u4ec5\u67e5\u770b\u5386\u53f2\u8bb0\u5f55\u4e0e\u5f53\u65f6\u8bc1\u636e\u3002'}</p>:r.data&&r.selected&&r.selected!==r.data.active?<p className="text-body-small text-muted-foreground">{'\u5f52\u6863\u4f1a\u8bdd\u4ec5\u4f9b\u67e5\u770b\u3002'}</p>:<form aria-label={'\u539f\u56e0\u4e0e\u590d\u6838\u64cd\u4f5c'} onSubmit={e=>{e.preventDefault();void submit();}} className="flex flex-col gap-md">
   <label className="flex flex-col gap-sm text-body-small">{'\u64cd\u4f5c'}<NativeSelect aria-label={'\u6838\u9a8c\u52a8\u4f5c'} value={chosen} disabled={r.readOnly||locked||draftStale} onChange={e=>{setAction(e.target.value as ReviewAction);setDraftRevision(p.revision);}}>{options.map(a=><option key={a} value={a}>{actionNames[a]}</option>)}</NativeSelect></label>
   {chosen==='confirm'&&<label className="flex flex-col gap-sm text-body-small">{'\u539f\u56e0'}<NativeSelect aria-label={'\u786e\u8ba4\u539f\u56e0'} value={reason} disabled={r.readOnly||locked||draftStale} onChange={e=>{setReason(e.target.value as Reason);setAction(chosen);setDraftRevision(v=>v??p.revision);}}>{Object.entries(causeNames).map(([k,v])=><option key={k} value={k}>{v}</option>)}</NativeSelect></label>}
   <label className="flex flex-col gap-sm text-body-small">{'\u8bf4\u660e'}<Textarea aria-label={'\u6838\u9a8c\u8bf4\u660e'} required minLength={1} maxLength={2000} rows={4} value={note} disabled={r.readOnly||locked||draftStale} onChange={e=>{setNote(e.target.value);setAction(chosen);setDraftRevision(v=>v??p.revision);}} placeholder={'\u8bb0\u5f55\u5224\u65ad\u4f9d\u636e\u3001\u6838\u5bf9\u8fc7\u7a0b\u4e0e\u590d\u6838\u610f\u89c1'}/></label>
   <Button type="submit" disabled={r.readOnly||draftStale&&!locked||!note.trim()||p.changed&&chosen==='approve'}>{locked?'\u91cd\u8bd5\u539f\u64cd\u4f5c':actionNames[chosen]}</Button>
   {draftStale&&!locked&&<div role="alert" className="text-body-small text-destructive"><p>{"\u8bb0\u5f55\u5df2\u88ab\u5176\u4ed6\u9875\u9762\u66f4\u65b0\uff0c\u8349\u7a3f\u4e0d\u4f1a\u81ea\u52a8\u6539\u4e3a\u53e6\u4e00\u4e2a\u64cd\u4f5c\u3002"}</p><Button variant="ghost" onClick={()=>{retry.current=null;setDraftRevision(null);setNote("");setFailure("");}}>{"\u653e\u5f03\u8349\u7a3f\u5e76\u6838\u5bf9\u6700\u65b0\u72b6\u6001"}</Button></div>}
   {locked&&<p className="text-body-small text-muted-foreground">{'\u7ed3\u679c\u5c1a\u672a\u786e\u8ba4\uff0c\u91cd\u8bd5\u6cbf\u7528\u540c\u4e00\u547d\u4ee4\u3002\u786e\u8ba4\u7ed3\u679c\u524d\u4e0d\u4fee\u6539\u5185\u5bb9\u3002'}</p>}
  </form>}
  {notice&&<p role="status" className="pt-md text-body-small text-muted-foreground">{notice}</p>}{failure&&<p role="alert" className="pt-md text-body-small text-destructive">{localError(failure)}</p>}
  <p className="pt-md text-body-small text-muted-foreground">{'\u5df2\u590d\u6838\u4ec5\u8868\u793a\u89e3\u91ca\u5b8c\u6210\u6838\u9a8c\uff0c\u4e0d\u8868\u793a\u6570\u636e\u8865\u9f50\u3001\u8bbe\u5907\u4fee\u590d\u6216\u4e1a\u52a1\u6062\u590d\u3002'}</p>
 </PanelCard><PanelCard title={'\u64cd\u4f5c\u5386\u53f2'} icon="clock"><div className="flex min-w-0 flex-col gap-lg">
  {r.data&&!log?.events.length&&<p className="text-body-small text-muted-foreground">{'\u5c1a\u65e0\u4eba\u5de5\u64cd\u4f5c\u8bb0\u5f55\u3002'}</p>}
  {r.data&&eventNumber&&!log?.events.some(e=>e.revision===eventNumber)&&<p role="alert" className="text-body-small text-destructive">{'\u6240\u9009\u5386\u53f2\u4e8b\u4ef6\u4e0d\u5b58\u5728\u3002'}</p>}
  {[...(log?.events??[])].reverse().map(e=><article id={'review-event-'+e.revision} key={e.revision} className="min-w-0 border-b border-dashed border-border pb-lg">
   <div className="flex flex-wrap items-center gap-sm"><strong className="text-body">{actionNames[e.command.action]}</strong><StatusBadge tone="neutral" size="sm">{statusNames[e.state]}</StatusBadge><span className="text-body-small text-muted-foreground">{'#'+e.revision+(eventNumber===e.revision?' \u00b7 \u5f53\u524d\u67e5\u770b':'')}</span></div>
   <p className="pt-sm text-body-small text-muted-foreground">{'\u6f14\u793a\u8bbf\u5ba2 \u00b7 '+timeLabel(e.recordedAt)}</p>{e.command.reasonCode&&<p className="pt-sm text-body-small">{causeNames[e.command.reasonCode]}</p>}<p className="pt-sm whitespace-pre-wrap break-words text-body">{e.command.note}</p>
   <Collapsible defaultOpen={eventNumber===e.revision}><CollapsibleTrigger asChild><Button variant="link">{'\u67e5\u770b\u5f53\u65f6\u8bc1\u636e'}</Button></CollapsibleTrigger><CollapsibleContent><div className="min-w-0 break-all py-md text-body-small text-muted-foreground"><p>{e.evidence.source+' / '+e.evidence.policyVersion+' / '+e.evidence.baselineVersion}</p><p>{'\u8bc1\u636e '+e.evidence.evidenceRevision+' \u00b7 '+e.evidence.evidenceDigest}</p></div><DataTable rows={e.evidence.windows} rowKey={w=>w.start} columns={[{id:'time',header:'\u7a97\u53e3',cell:w=>windowLabel(w.start,w.end)},{id:'value',header:'\u6709\u6548\u91cf',cell:w=>quantity(w.usable?w.value:null,e.evidence.metric)},{id:'refs',header:'\u56db\u5468\u53c2\u8003\u539f\u503c',cell:w=>(w.references.map(v=>v.value??'\u7f3a\u5931').join(' / '))}]}/><details className="pt-md text-body-small"><summary>{'\u5b8c\u6574\u539f\u59cb\u4f9d\u636e'}</summary><pre className="max-w-full overflow-auto py-sm">{JSON.stringify(e.evidence,null,2)}</pre></details></CollapsibleContent></Collapsible>
  </article>)}
 </div></PanelCard></>;
}
