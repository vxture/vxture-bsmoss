"use client";
import {useEffect,useRef,useState,type FormEvent} from "react";
import {Button,Input,StatusBadge} from "@vxture/design-system";
import type {JobDetail,RecoverJob,RecoveryResult,RecoveryRecord} from "../../domains/supervision/jobs";
import {reportJson,ReportClientError} from "../../reports/client";
import {taskTime} from "./client";
import {jobLabel,jobError} from "../aggregation/client";
function RecoveryLink({record,onChoose,parent=false}:{record:RecoveryRecord;onChoose(id:string):void;parent?:boolean}) {
 const id=parent?record.originalJobId:record.replacementJobId;
 return <div className="flex min-w-0 flex-col gap-sm border-t border-dashed border-border pt-md">
  <p className="font-medium">{parent?"\u6062\u590d\u81ea":"\u5df2\u590d\u6838\u91cd\u6392"}</p>
  <Button variant="link" className="h-auto justify-start whitespace-normal break-all text-left text-body" onClick={()=>onChoose(id)}>{id}</Button>
  <p className="text-body-small text-muted-foreground">{record.requestedBy+" \u00b7 "+taskTime(record.recordedAt)}</p><p className="break-all text-body-small">{record.reasonRef}</p>
 </div>;
}
export default function AggregationDetail({jobId,epoch,onChoose,onChanged}:{jobId:string;epoch:number;onChoose(id:string):void;onChanged():void}) {
 const [detail,setDetail]=useState<JobDetail|null>(null),[error,setError]=useState(""),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [reason,setReason]=useState(""),[pending,setPending]=useState<RecoverJob|null>(null),[completed,setCompleted]=useState<RecoveryRecord|null>(null);
 const inFlight=useRef(false),controller=useRef<AbortController|null>(null);
 useEffect(()=>()=>controller.current?.abort(),[]);
 useEffect(()=>{const c=new AbortController();setLoading(true);setDetail(null);setError("");
  reportJson<JobDetail>("/api/aggregate-jobs/"+encodeURIComponent(jobId),c.signal).then(r=>{if(!c.signal.aborted)setDetail(r);}).catch(e=>{if(!c.signal.aborted)setError(jobError(e));}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();
 },[jobId,epoch]);
 async function execute(command:RecoverJob) {
  if(inFlight.current)return;inFlight.current=true;setBusy(true);setError("");setPending(command);const c=new AbortController();controller.current=c;
  try {const result=await reportJson<RecoveryResult>("/api/aggregate-jobs/"+encodeURIComponent(jobId)+"/recover",c.signal,command);if(!c.signal.aborted){setPending(null);setCompleted(result.record);onChanged();}}
  catch(e){if(!c.signal.aborted){setError(jobError(e));if(e instanceof ReportClientError&&e.status<500){setPending(null);setDetail(null);}}}
  finally{inFlight.current=false;if(!c.signal.aborted)setBusy(false);}
 }
 function recover(event:FormEvent){event.preventDefault();if(!detail||!reason.trim()||pending)return;void execute({jobId,expectedAttempt:detail.job.attempt,commandId:crypto.randomUUID(),reasonRef:reason.trim()});}
 return <section className="site-analysis-workflow flex min-w-0 flex-col gap-md text-body" aria-busy={loading}>
  <Button variant="outline" className="self-start" onClick={onChanged} disabled={busy||loading}>{"\u5237\u65b0\u6838\u5bf9"}</Button>
  {error&&<p role="alert" className="text-destructive">{error}</p>}
  {pending&&<div className="flex flex-col items-start gap-sm"><p className="text-body-small text-muted-foreground">{"\u7ed3\u679c\u672a\u786e\u8ba4\uff0c\u5df2\u4fdd\u7559\u539f\u91cd\u8bd5\u547d\u4ee4\u3002"}</p><Button variant="outline" disabled={busy} onClick={()=>void execute(pending)}>{busy?"\u5904\u7406\u4e2d":"\u4f7f\u7528\u539f\u547d\u4ee4\u91cd\u8bd5"}</Button></div>}
  {completed&&!detail?.recovery&&<RecoveryLink record={completed} onChoose={onChoose}/>}
  {loading?<p role="status">{"\u6b63\u5728\u8bfb\u53d6\u2026"}</p>:detail&&<>
   <div className="flex flex-wrap items-center gap-sm"><StatusBadge tone={detail.job.status==="dead"?"danger":detail.job.status==="succeeded"?"success":"neutral"}>{jobLabel(detail.job.status)}</StatusBadge><span>{jobLabel(detail.job.target.metric.code)}</span></div>
   <dl className="grid min-w-0 grid-cols-1 gap-md text-body-small sm:grid-cols-2">{[
    ["\u6765\u6e90",detail.job.target.sourceId],["\u6620\u5c04",detail.job.target.mappingId],["\u5468\u671f",jobLabel(detail.job.target.grain)+" \u00b7 "+taskTime(detail.job.target.at)],
    ["\u521b\u5efa\u65f6\u95f4",taskTime(detail.job.createdAt)],["\u6267\u884c\u72b6\u6001",jobLabel(detail.job.readiness)],["\u5df2\u9886\u53d6\uff0f\u4e0a\u9650",detail.job.attempt+" / "+detail.job.maxAttempts],
    ["\u53ef\u6267\u884c\u65f6\u95f4",taskTime(detail.job.availableAt)],...(detail.job.leaseUntil?[["\u79df\u7ea6\u5230\u671f",taskTime(detail.job.leaseUntil)]]:[])
   ].map(([name,value])=><div key={name} className="min-w-0"><dt className="text-muted-foreground">{name}</dt><dd className="break-all">{value}</dd></div>)}</dl>
   <h3 className="text-heading-small">{"\u6267\u884c\u8bb0\u5f55"}</h3>
   {!detail.attempts.length&&<p className="text-body-small text-muted-foreground">{"\u5c1a\u672a\u6267\u884c"}</p>}
   {detail.attempts.map(a=><div key={a.attempt} className="flex min-w-0 flex-col gap-xs border-t border-dashed border-border pt-md text-body-small"><p>{a.attempt+" \u00b7 "+jobLabel(a.outcome)+" \u00b7 "+taskTime(a.recordedAt)}</p>{a.failureCode&&<p className="text-destructive">{jobLabel(a.failureCode)}</p>}{a.resultRef&&<code className="break-all text-muted-foreground">{a.resultRef}</code>}</div>)}
   {detail.recoveredFrom&&<RecoveryLink record={detail.recoveredFrom} onChoose={onChoose} parent/>}
   {detail.recovery?<RecoveryLink record={detail.recovery} onChoose={onChoose}/>:detail.job.status==="dead"&&!completed&&<form className="flex flex-col gap-sm border-t border-dashed border-border pt-md" onSubmit={recover}>
    <h3 className="text-heading-small">{"\u590d\u6838\u540e\u91cd\u6392"}</h3><label className="flex flex-col gap-xs text-body-small">{"\u590d\u6838\u4f9d\u636e"}<Input required maxLength={2048} value={reason} disabled={busy||!!pending} onChange={e=>setReason(e.target.value)} placeholder={"\u5de5\u5355\u6216\u590d\u6838\u8bb0\u5f55\u5f15\u7528"}/></label>
    <Button className="self-start" variant="outline" type="submit" disabled={busy||!!pending||!reason.trim()}>{busy?"\u63d0\u4ea4\u4e2d":"\u590d\u6838\u5e76\u91cd\u6392"}</Button>
   </form>}
  </>}
 </section>;
}
