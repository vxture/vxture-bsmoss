"use client";
import {useEffect,useState,type CSSProperties,type MouseEvent} from "react";
import {Button,DataTable,Dialog,DialogContent,DialogTitle,DialogDescription,EmptyState,Icon,PanelCard,SegmentedControl,Select,SelectTrigger,SelectValue,SelectContent,SelectItem,StatusBadge,TableTitleCell} from "@vxture/design-system";
import type {UpdateList} from "../../domains/data-updates/contracts";
import type {JobListPage,JobStateFilter} from "../../domains/supervision/jobs";
import {taskTime} from "./client";
import {jobLabel} from "../aggregation/client";
import {updateJson,updateReadError} from "./client";
import {selectionFromUrl,selectionHref,type TaskSelection} from "./links";
import ReceivedDetail from "./received-detail";
import AggregationDetail from "./aggregation-detail";
import ResetButton from "../../portal/reset-button";
type Row={id:string;name:string;description:string;createdAt:string;state:string|null;attempts:string|null};
export default function TaskList(){
 const [selection,setSelection]=useState<TaskSelection>({kind:"received",id:null}),[invalid,setInvalid]=useState(false),[epoch,setEpoch]=useState(0);
 const [cursor,setCursor]=useState<string|null>(null),[previous,setPrevious]=useState<(string|null)[]>([]),[status,setStatus]=useState<JobStateFilter>("all");
 const [rows,setRows]=useState<Row[]>([]),[next,setNext]=useState<string|null>(null),[error,setError]=useState(""),[loading,setLoading]=useState(true);
 useEffect(()=>{const read=()=>{try{setSelection(selectionFromUrl(window.location.href));setInvalid(false);}catch{setSelection({kind:"received",id:null});setInvalid(true);}setCursor(null);setPrevious([]);};read();window.addEventListener("popstate",read);return()=>window.removeEventListener("popstate",read);},[]);
 useEffect(()=>{
  const c=new AbortController();setLoading(true);setError("");setRows([]);setNext(null);
  const after=cursor?"&after="+encodeURIComponent(cursor):"";
  const read=async()=>{try{
   if(selection.kind==="received"){const result=await updateJson<UpdateList>("/api/data-updates?limit=10"+after,c.signal);if(!c.signal.aborted){setNext(result.next);setRows(result.items.map(r=>({id:r.id,name:r.partitionId,description:r.id.slice(0,12),createdAt:r.createdAt,state:null,attempts:null})));}}
   else{const result=await updateJson<JobListPage>("/api/aggregate-jobs?limit=20&status="+status+after,c.signal);if(!c.signal.aborted){setNext(result.next);setRows(result.items.map(r=>({id:r.id,name:jobLabel(r.target.metric.code),description:r.target.sourceId+" \u00b7 "+jobLabel(r.target.grain),createdAt:r.createdAt,state:r.status,attempts:r.attempt+" / "+r.maxAttempts})));}}
  }catch(e){if(!c.signal.aborted)setError(updateReadError(e));}finally{if(!c.signal.aborted)setLoading(false);}};void read();return()=>c.abort();
 },[selection.kind,cursor,status,epoch]);
 function choose(value:TaskSelection){window.history.pushState(null,"",selectionHref(value));setSelection(value);setInvalid(false);}
 function changeKind(kind:TaskSelection["kind"]){setCursor(null);setPrevious([]);setStatus("all");choose({kind,id:null});}
 function refresh(){setEpoch(n=>n+1);}
 function close(){choose({...selection,id:null});}
 function rowClick(event:MouseEvent){if((event.target as HTMLElement).closest("button,a"))return;const row=(event.target as HTMLElement).closest("tbody > tr");if(!row)return;const entry=rows[Array.from(row.parentElement!.children).indexOf(row)];if(entry)choose({...selection,id:selection.id===entry.id?null:entry.id});}
 return <>
  <PanelCard title={"\u6307\u6807\u5904\u7406\u4efb\u52a1"} icon="list-checks" className="site-analysis-table-panel">
   <div className="site-analysis-table-tools site-analysis-table-tools-single-line site-analysis-action-row">
    <div className="site-analysis-table-filters"><div className="site-analysis-occupancy-scroll" style={{"--analysis-facet-columns":2} as CSSProperties}><SegmentedControl size="md" className="h-control-xl site-analysis-occupancy site-analysis-occupancy-auto" ariaLabel={"\u4efb\u52a1\u7c7b\u578b"} value={selection.kind} onChange={changeKind} items={[{value:"received",label:<span className="site-analysis-occupancy-label"><Icon name="list-checks" size="sm"/>{"\u63a5\u6536\u4efb\u52a1"}</span>},{value:"aggregation",label:<span className="site-analysis-occupancy-label"><Icon name="database" size="sm"/>{"\u805a\u5408\u4efb\u52a1"}</span>}]}/></div></div>
    <div className="site-analysis-search">
     {selection.kind==="aggregation"&&<Select value={status} onValueChange={value=>{setStatus(value as JobStateFilter);setCursor(null);setPrevious([]);close();}}><SelectTrigger className="h-control-xl w-auto gap-sm text-body" aria-label={"\u4efb\u52a1\u72b6\u6001"}><SelectValue/></SelectTrigger><SelectContent>{(["all","pending","leased","dead","succeeded"] as const).map(s=><SelectItem key={s} value={s}>{jobLabel(s)}</SelectItem>)}</SelectContent></Select>}
     <Button variant="outline" size="icon-md" className="size-control-xl" aria-label={"\u5237\u65b0\u4efb\u52a1"} title={"\u5237\u65b0\u4efb\u52a1"} disabled={loading} onClick={refresh}><Icon name="refresh" size="sm"/></Button>
     <ResetButton variant="outline" label={"\u91cd\u7f6e\u4efb\u52a1\u7b5b\u9009"} onClick={()=>{setStatus("all");setCursor(null);setPrevious([]);close();}}/>
    </div>
   </div>
   {invalid&&<p role="alert" className="text-body-small text-destructive">{"\u4efb\u52a1\u94fe\u63a5\u65e0\u6548\uff0c\u8bf7\u4ece\u5217\u8868\u9009\u62e9\u3002"}</p>}
   {error&&<p role="alert" className="text-body-small text-destructive">{error}</p>}
   <div className="site-analysis-table min-w-0 overflow-x-auto" onClick={rowClick} aria-busy={loading}><DataTable rows={rows} rowKey={r=>r.id} indexStart={previous.length*(selection.kind==="received"?10:20)+1} columns={[
    {id:"name",header:selection.kind==="received"?"\u6765\u6e90\u4efb\u52a1\u7ec4":"\u6307\u6807\uff0f\u6765\u6e90",cell:r=><TableTitleCell title={r.name} description={r.description} onTitleClick={()=>choose({...selection,id:selection.id===r.id?null:r.id})}/>},
    {id:"created",header:"\u63d0\u4ea4\u65f6\u95f4",cell:r=><time className="whitespace-nowrap tabular-nums" dateTime={r.createdAt}>{taskTime(r.createdAt)}</time>},
    ...(selection.kind==="aggregation"?[
     {id:"attempt",header:"\u6267\u884c\uff0f\u4e0a\u9650",align:"center" as const,cell:(r:Row)=><span className="whitespace-nowrap tabular-nums">{r.attempts}</span>},
     {id:"state",header:"\u72b6\u6001",align:"center" as const,cell:(r:Row)=><StatusBadge tone={r.state==="dead"?"danger":r.state==="succeeded"?"success":"neutral"}>{jobLabel(r.state!)}</StatusBadge>}
    ]:[])
   ]} empty={<EmptyState title={loading?"\u6b63\u5728\u8bfb\u53d6\u2026":error?"\u4efb\u52a1\u6682\u4e0d\u53ef\u7528":"\u6682\u65e0\u4efb\u52a1\u8bb0\u5f55"}/>}/></div>
   <nav aria-label={"\u4efb\u52a1\u5206\u9875"} className="site-analysis-action-row flex items-center justify-end gap-sm text-body">
    <Button className="h-control-xl text-body" variant="ghost" disabled={loading||!previous.length} onClick={()=>{setCursor(previous.at(-1)!);setPrevious(p=>p.slice(0,-1));close();}}>{"\u4e0a\u4e00\u9875"}</Button><span className="tabular-nums">{previous.length+1}</span>
    <Button className="h-control-xl text-body" variant="ghost" disabled={loading||!next} onClick={()=>{setPrevious(p=>[...p,cursor]);setCursor(next);close();}}>{"\u4e0b\u4e00\u9875"}</Button>
   </nav>
  </PanelCard>
  <Dialog modal={false} open={!!selection.id} onOpenChange={open=>{if(!open)close();}}><DialogContent className="site-analysis-detail" width="sm" onOpenAutoFocus={e=>e.preventDefault()} onInteractOutside={e=>{if(e.target instanceof Element&&e.target.closest(".site-analysis-table tbody > tr"))e.preventDefault();}}>
   <div className="pr-xl"><DialogTitle>{selection.kind==="received"?"\u63a5\u6536\u4efb\u52a1":"\u805a\u5408\u4efb\u52a1"}</DialogTitle><DialogDescription className="break-all">{selection.id}</DialogDescription></div>
   {selection.id&&(selection.kind==="received"?<ReceivedDetail key={selection.id} id={selection.id} epoch={epoch} onChooseJob={id=>{setCursor(null);setPrevious([]);choose({kind:"aggregation",id});}}/>:<AggregationDetail key={selection.id} jobId={selection.id} epoch={epoch} onChoose={id=>choose({kind:"aggregation",id})} onChanged={refresh}/>)}
  </DialogContent></Dialog>
 </>;
}
