"use client";
import {useEffect,useState,type MouseEvent} from "react";
import {Button,DataTable,Dialog,DialogContent,DialogTitle,DialogDescription,EmptyState,Icon,PanelCard,SegmentedControl,Select,SelectTrigger,SelectValue,SelectContent,SelectItem,StatusBadge,TableTitleCell} from "@vxture/design-system";
import type {ReportJobPage,ReportJobState} from "../../domains/supervision/report-jobs";
import {taskTime} from "../../operations/data-updates/client";
import ResetButton from "../../portal/reset-button";
import {reportJson} from "../client";
import {taskHref,taskFromUrl,type TaskQuery} from "../centre-links";
import {reportJobLabel as label,reportJobError} from "./client";
import Inspection from "./inspection";
export default function ReportJobsWorkspace({initialQuery,invalidLink=false}:{initialQuery:TaskQuery;invalidLink?:boolean}){
 const [query,setQuery]=useState(initialQuery),[invalid,setInvalid]=useState(invalidLink),[cursor,setCursor]=useState<string|null>(null),[pages,setPages]=useState<(string|null)[]>([]),[epoch,setEpoch]=useState(0);
 const [page,setPage]=useState<ReportJobPage|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const initialKey=JSON.stringify(initialQuery);
 useEffect(()=>{setQuery(initialQuery);setInvalid(invalidLink);setCursor(null);setPages([]);},[initialKey,invalidLink]);
 useEffect(()=>{const read=()=>{try{setQuery(taskFromUrl(window.location.href));setInvalid(false);}catch{setQuery({kind:"generation",status:"all",job:null});setInvalid(true);}setCursor(null);setPages([]);};window.addEventListener("popstate",read);return()=>window.removeEventListener("popstate",read);},[]);
 useEffect(()=>{const c=new AbortController();setPage(null);setLoading(true);setError("");
  reportJson<ReportJobPage>("/api/report-jobs?kind="+query.kind+"&status="+query.status+"&limit=20"+(cursor?"&after="+encodeURIComponent(cursor):""),c.signal).then(value=>{if(!c.signal.aborted)setPage(value);}).catch(e=>{if(!c.signal.aborted)setError(reportJobError(e));}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();
 },[query.kind,query.status,cursor,epoch]);
 function choose(next:TaskQuery){window.history.pushState(null,"",taskHref(next,Object.fromEntries(new URL(window.location.href).searchParams)));setQuery(next);setInvalid(false);}
 function filter(patch:Partial<TaskQuery>){setCursor(null);setPages([]);choose({...query,...patch,job:null});}
 function refresh(){setEpoch(n=>n+1);}
 function open(id:string){choose({...query,job:query.job===id?null:id});}
 function rowClick(e:MouseEvent){const target=e.target as HTMLElement;if(target.closest("button,a"))return;const row=target.closest("tbody > tr");if(!row)return;const entry=page?.items[Array.from(row.parentElement!.children).indexOf(row)];if(entry)open(entry.id);}
 const rows=page?.items??[];
 return <>
  <PanelCard title={"\u4efb\u52a1\u8bb0\u5f55"} icon="list-checks" className="site-analysis-table-panel">
   <div className="site-analysis-table-tools site-analysis-table-tools-single-line site-analysis-action-row">
    <div className="site-analysis-table-filters"><div className="site-analysis-occupancy-scroll"><SegmentedControl size="md" className="h-control-xl site-analysis-occupancy site-analysis-occupancy-auto [--analysis-facet-columns:2]" ariaLabel={"\u62a5\u544a\u4efb\u52a1\u7c7b\u578b"} value={query.kind} onChange={kind=>filter({kind})} items={[{value:"generation",label:<span className="site-analysis-occupancy-label"><Icon name="newspaper" size="sm"/>{"\u751f\u6210"}</span>},{value:"export",label:<span className="site-analysis-occupancy-label"><Icon name="file-text" size="sm"/>{"\u5bfc\u51fa"}</span>}]}/></div></div>
    <div className="site-analysis-search"><Select value={query.status} onValueChange={status=>filter({status:status as ReportJobState})}><SelectTrigger className="h-control-xl w-auto gap-sm text-body" aria-label={"\u4efb\u52a1\u72b6\u6001"}><SelectValue/></SelectTrigger><SelectContent>{(["all","pending","dead","succeeded"] as const).map(s=><SelectItem key={s} value={s}>{label(s)}</SelectItem>)}</SelectContent></Select>
     <Button variant="outline" size="icon-md" className="size-control-xl" disabled={loading} aria-label={"\u5237\u65b0\u4efb\u52a1"} title={"\u5237\u65b0\u4efb\u52a1"} onClick={refresh}><Icon name="refresh" size="sm"/></Button><ResetButton variant="outline" label={"\u91cd\u7f6e\u4efb\u52a1\u7b5b\u9009"} onClick={()=>filter({status:"all"})}/>
    </div>
   </div>
   {invalid&&<p role="alert" className="text-body-small text-destructive">{"\u4efb\u52a1\u94fe\u63a5\u65e0\u6548\uff0c\u8bf7\u4ece\u5217\u8868\u9009\u62e9\u3002"}</p>}{error&&<p role="alert" className="text-body-small text-destructive">{error}</p>}
   <div className="site-analysis-table min-w-0 overflow-x-auto" onClick={rowClick} aria-busy={loading}><DataTable rows={rows} rowKey={r=>r.id} indexStart={pages.length*20+1} columns={[
    {id:"name",header:"\u62a5\u544a\u4efb\u52a1",cell:r=><TableTitleCell title={r.registration?.templateCode??label(r.kind)} description={r.id.length>24?r.id.slice(0,12):r.id} onTitleClick={()=>open(r.id)}/>},
    {id:"period",header:"\u6570\u636e\u5468\u671f",cell:r=><span className="whitespace-nowrap">{label(r.grain)+" \u00b7 "+taskTime(r.period.start).slice(0,10)}</span>},
    {id:"created",header:"\u63d0\u4ea4\u65f6\u95f4",cell:r=><time className="whitespace-nowrap tabular-nums" dateTime={r.createdAt}>{taskTime(r.createdAt)}</time>},
    {id:"attempt",header:"\u5c1d\u8bd5\uff0f\u4e0a\u9650",align:"center",cell:r=><span className="tabular-nums whitespace-nowrap">{r.attempt+" / "+r.maxAttempts}</span>},
    {id:"status",header:"\u72b6\u6001",align:"center",cell:r=><StatusBadge tone={r.status==="dead"?"danger":r.status==="succeeded"?"success":"neutral"}>{label(r.status)}</StatusBadge>}
   ]} empty={<EmptyState title={loading?"\u6b63\u5728\u8bfb\u53d6\u2026":error?"\u4efb\u52a1\u6682\u4e0d\u53ef\u7528":"\u6682\u65e0\u4efb\u52a1\u8bb0\u5f55"}/>}/></div>
   <nav aria-label={"\u4efb\u52a1\u5206\u9875"} className="site-analysis-action-row flex items-center justify-end gap-sm text-body"><Button className="h-control-xl text-body" variant="ghost" disabled={loading||!pages.length} onClick={()=>{setCursor(pages.at(-1)!);setPages(p=>p.slice(0,-1));choose({...query,job:null});}}>{"\u4e0a\u4e00\u9875"}</Button><span className="tabular-nums">{pages.length+1}</span><Button className="h-control-xl text-body" variant="ghost" disabled={loading||!page?.next} onClick={()=>{setPages(p=>[...p,cursor]);setCursor(page!.next);choose({...query,job:null});}}>{"\u4e0b\u4e00\u9875"}</Button></nav>
  </PanelCard>
  <Dialog modal={false} open={!!query.job} onOpenChange={open=>{if(!open)choose({...query,job:null});}}><DialogContent className="site-analysis-detail" width="sm" onOpenAutoFocus={e=>e.preventDefault()} onInteractOutside={e=>{if(e.target instanceof Element&&e.target.closest(".site-analysis-table tbody > tr"))e.preventDefault();}}>
   <div className="pr-xl"><DialogTitle>{label(query.kind)}</DialogTitle><DialogDescription className="break-all">{query.job}</DialogDescription></div>
   {query.job&&<Inspection key={query.kind+query.job} id={query.job} kind={query.kind} epoch={epoch} refresh={refresh} onChoose={job=>choose({...query,job})}/>}
  </DialogContent></Dialog>
 </>;
}
