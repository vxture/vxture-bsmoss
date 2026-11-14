"use client";
import {useEffect,useState} from "react";
import {Button,StatusBadge} from "@vxture/design-system";
import type {ReportJobDetail,ReportJobKind} from "../../domains/supervision/report-jobs";
import {taskTime} from "../../operations/data-updates/client";
import {reportJson} from "../client";
import {reportJobLabel as label,reportJobError} from "./client";
import {ReportRecovery} from "./recovery";
export default function Inspection({id,kind,epoch,refresh,onChoose}:{id:string;kind:ReportJobKind;epoch:number;refresh():void;onChoose(id:string):void}){
 const [detail,setDetail]=useState<ReportJobDetail|null>(null),[error,setError]=useState(""),[loading,setLoading]=useState(true);
 useEffect(()=>{const c=new AbortController();setDetail(null);setError("");setLoading(true);
  reportJson<ReportJobDetail>("/api/report-jobs/"+encodeURIComponent(id)+"?kind="+kind,c.signal).then(value=>{if(!c.signal.aborted)setDetail(value);}).catch(e=>{if(!c.signal.aborted)setError(reportJobError(e));}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();
 },[id,kind,epoch]);
 const job=detail?.job;
 return <section className="site-analysis-workflow flex min-w-0 flex-col gap-md text-body" aria-busy={loading}>
  <Button className="self-start" variant="outline" disabled={loading} onClick={refresh}>{"\u5237\u65b0\u6838\u5bf9"}</Button>
  {error&&<p role="alert" className="text-body-small text-destructive">{error}</p>}{loading&&<p role="status" className="text-body-small text-muted-foreground">{"\u6b63\u5728\u8bfb\u53d6\u2026"}</p>}
  {job&&<>
   <div className="flex flex-wrap items-center gap-sm"><StatusBadge tone={job.status==="dead"?"danger":job.status==="succeeded"?"success":"neutral"}>{label(job.status)}</StatusBadge><span>{job.registration?.templateCode??label(job.kind)}</span></div>
   <dl className="grid min-w-0 grid-cols-1 gap-md text-body-small sm:grid-cols-2">{[
    ["\u6267\u884c\u72b6\u6001",label(job.readiness)],["\u5c1d\u8bd5\uff0f\u4e0a\u9650",job.attempt+" / "+job.maxAttempts],["\u53ef\u6267\u884c\u65f6\u95f4",taskTime(job.availableAt)],
    ["\u521b\u5efa\u65f6\u95f4",taskTime(job.createdAt)],["\u66f4\u65b0\u65f6\u95f4",taskTime(job.updatedAt)],["\u8bf7\u6c42\u4e3b\u4f53",job.requestedBy],
    ...(job.registration?[["\u539f\u767b\u8bb0",job.registration.id+" \u00b7 r"+job.registration.revision],["\u5f53\u524d\u767b\u8bb0\u7248\u672c",job.registration.currentRevision??"\u4e0d\u53ef\u7528"]]:[]),
    ...(job.publication?[["\u7ed1\u5b9a\u53d1\u5e03\u4e8b\u4ef6","r"+job.publication.revision],["\u6e32\u67d3\u7248\u672c",job.publication.rendererVersion]]:[])
   ].map(([name,value])=><div key={name} className="min-w-0"><dt className="text-muted-foreground">{name}</dt><dd className="break-all">{value}</dd></div>)}<div className="min-w-0 sm:col-span-2"><dt className="text-muted-foreground">{"\u5468\u671f"}</dt><dd className="flex flex-wrap items-center gap-xs"><span>{label(job.grain)}</span><span className="whitespace-nowrap tabular-nums">{taskTime(job.period.start)}</span><span>{"\u2014"}</span><span className="whitespace-nowrap tabular-nums">{taskTime(job.period.end)}</span></dd></div></dl>
   <h3 className="text-heading-small">{"\u6267\u884c\u8bb0\u5f55"}</h3>
   {!detail.attempts.length&&<p className="text-body-small text-muted-foreground">{"\u6682\u65e0\u6267\u884c\u8bb0\u5f55"}</p>}
   {detail.attempts.map(a=><div key={a.attempt} className="flex min-w-0 flex-col gap-xs border-t border-dashed border-border pt-md text-body-small"><p>{a.attempt+" \u00b7 "+label(a.outcome)+" \u00b7 "+taskTime(a.recordedAt)}</p><p className={a.failureCode?"text-destructive":"text-muted-foreground"}>{a.failureCode?label(a.failureCode):a.generationStatus?label(a.generationStatus):"\u5236\u54c1\u5df2\u4fdd\u5b58"}</p><p className="break-all text-muted-foreground">{a.recordedBy}</p></div>)}
   {job.result&&<div className="flex min-w-0 flex-col items-start gap-sm border-t border-dashed border-border pt-md text-body-small">
    <h3 className="text-heading-small">{job.kind==="generation"?"\u751f\u6210\u7ed3\u679c":"\u7ed1\u5b9a\u62a5\u544a"}</h3>
    <Button asChild variant="outline"><a href={"/reports?report="+encodeURIComponent(job.result.reportId)+"&revision="+encodeURIComponent(job.result.revision)}>{"\u6253\u5f00\u62a5\u544a r"+job.result.revision}</a></Button>
    <p className="break-all text-muted-foreground">{job.result.reportId}</p>{job.result.currentRevision&&<p className="text-muted-foreground">{"\u6267\u884c\u65f6\u6700\u65b0\u4fee\u8ba2 r"+job.result.currentRevision}</p>}
    <details className="max-w-full"><summary className="cursor-pointer text-muted-foreground">{"\u6458\u8981\u4e0e\u5236\u54c1\u5f15\u7528"}</summary><dl className="mt-sm flex min-w-0 flex-col gap-sm break-all"><div><dt>manifestSha256</dt><dd>{job.result.manifestSha256}</dd></div><div><dt>artifactSha256</dt><dd>{job.artifactSha256??"\u2014"}</dd></div></dl></details>
    <p className="text-muted-foreground">{"\u67e5\u9605\u548c\u4e0b\u8f7d\u6743\u9650\u5355\u72ec\u6838\u9a8c\u3002"}</p>
   </div>}
   <ReportRecovery detail={detail} onChoose={onChoose} onChanged={refresh} onRejected={()=>{setDetail(null);setError("\u4efb\u52a1\u6216\u6743\u9650\u5df2\u53d8\u5316\uff0c\u8bf7\u5237\u65b0\u6838\u5bf9\u3002");}}/>
  </>}
 </section>;
}
