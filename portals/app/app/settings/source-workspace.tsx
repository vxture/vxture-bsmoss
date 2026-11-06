"use client";
import { useEffect,useRef,useState } from "react";
import { Button,DataTable,Drawer,EmptyState,Icon,InputGroup,InputGroupAddon,InputGroupInput,NativeSelect,PanelCard,ShellPageContainer,StatusBadge } from "@vxture/design-system";
import PageHeading from "../portal/page-heading";
import type { ManagementPage } from "../domains/management/rules";
import type { SourceRecord,SourceSummary } from "../domains/management/source-rules";
const denied="\u5f53\u524d\u8d26\u53f7\u65e0\u67e5\u770b\u6743\u9650\u6216\u4f1a\u8bdd\u5df2\u5931\u6548\uff0c\u8bf7\u91cd\u65b0\u767b\u5f55\u6216\u8054\u7cfb\u7ba1\u7406\u5458\u3002";
function useSourceRead<T>(url:string|null){
 const [state,setState]=useState<{url:string|null;data:T|null;error:string;status:number;busy:boolean}>({url:null,data:null,error:"",status:0,busy:false}),[revision,setRevision]=useState(0);
 const active=useRef<AbortController|null>(null);
 useEffect(()=>{const controller=new AbortController();active.current=controller;setState({url,data:null,error:"",status:0,busy:!!url});
  if(url)void(async()=>{try{const response=await fetch(url,{cache:"no-store",signal:controller.signal});
   if(!response.ok){if(!controller.signal.aborted)setState({url,data:null,error:[401,403].includes(response.status)?denied:response.status===404?"\u8be5\u914d\u7f6e\u7248\u672c\u5f53\u524d\u4e0d\u53ef\u67e5\u770b\u3002":"\u6682\u65f6\u65e0\u6cd5\u8bfb\u53d6\u914d\u7f6e\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002",status:response.status,busy:false});return;}
   const data=await response.json() as T;if(!controller.signal.aborted)setState({url,data,error:"",status:0,busy:false});
  }catch{if(!controller.signal.aborted)setState({url,data:null,error:"\u6682\u65f6\u65e0\u6cd5\u8bfb\u53d6\u914d\u7f6e\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002",status:503,busy:false});}})();return()=>controller.abort();
 },[url,revision]);
 return {...(state.url===url?state:{url,data:null,error:"",status:0,busy:!!url}),reload:()=>setRevision(v=>v+1),invalidate:()=>{active.current?.abort();setState({url,data:null,error:denied,status:403,busy:false});}};
}
const time=(v:string)=>new Date(v).toLocaleString("zh-CN",{hour12:false});
export default function SourceWorkspace({audit=false}:{audit?:boolean}){
 const [search,setSearch]=useState(""),[status,setStatus]=useState("all"),[cursors,setCursors]=useState<string[]>([]),[selected,setSelected]=useState<SourceSummary|null>(null);
 const endpoint="/api/management/"+(audit?"configuration-audit":"source-configurations"),params=new URLSearchParams({search:search.trim(),status});if(cursors.length)params.set("after",cursors.at(-1)!);
 const read=useSourceRead<ManagementPage<SourceSummary>>(endpoint+"?"+params.toString());
 const detail=useSourceRead<SourceRecord>(selected&&read.data&&!read.error?endpoint+"/"+encodeURIComponent(selected.id)+(audit?"?revision="+encodeURIComponent(selected.revision):""):null);
 useEffect(()=>{if([401,403].includes(detail.status)){setSelected(null);read.invalidate();}},[detail.status]);
 const reset=()=>{setCursors([]);setSelected(null);};
 return <ShellPageContainer className="gap-lg"><PageHeading title={audit?"\u914d\u7f6e\u5ba1\u8ba1":"\u6765\u6e90\u914d\u7f6e"} description={audit?"\u8ffd\u6eaf\u6765\u6e90\u914d\u7f6e\u7684\u4e0d\u53ef\u53d8\u7248\u672c\u3001\u767b\u8bb0\u4f9d\u636e\u4e0e\u6570\u636e\u8303\u56f4":"\u6838\u5bf9\u6765\u6e90\u767b\u8bb0\u72b6\u6001\u3001\u9002\u914d\u4e0e\u6620\u5c04\u7248\u672c\u53ca\u6570\u636e\u8303\u56f4"}
  actions={<Button variant="outline" disabled={read.busy} onClick={()=>{setSelected(null);read.reload();}}>{"\u91cd\u65b0\u8bfb\u53d6"}</Button>}
  toolbar={<div className="flex flex-wrap items-center gap-lg"><NativeSelect aria-label={"\u767b\u8bb0\u72b6\u6001"} wrapperClassName="w-auto" value={status} onChange={e=>{reset();setStatus(e.target.value);}}><option value="all">{"\u5168\u90e8\u767b\u8bb0\u72b6\u6001"}</option><option value="active">{"\u767b\u8bb0\u542f\u7528"}</option><option value="paused">{"\u767b\u8bb0\u6682\u505c"}</option></NativeSelect>
  <div className="min-w-0 sm:ml-auto"><InputGroup><InputGroupAddon><Icon name="search" size="sm"/></InputGroupAddon><InputGroupInput aria-label={"\u68c0\u7d22\u6765\u6e90\u914d\u7f6e"} placeholder={"\u914d\u7f6e / \u6765\u6e90 / \u7248\u672c"} maxLength={100} value={search} onChange={e=>{reset();setSearch(e.target.value);}}/></InputGroup></div></div>}/>
  <PanelCard title={audit?"\u5ba1\u8ba1\u8986\u76d6":"\u767b\u8bb0\u53e3\u5f84"} icon={audit?"list-checks":"database"}><p className="text-body-small text-muted-foreground">{audit?"\u5f53\u524d\u8986\u76d6\u6765\u6e90\u914d\u7f6e\u7248\u672c\u8bb0\u5f55\uff1b\u767b\u8bb0\u4f9d\u636e\u4e3a\u5f15\u7528\u6807\u8bc6\uff0c\u6570\u636e\u5e93\u8bb0\u5f55\u4e3b\u4f53\u4e0d\u7b49\u4e8e\u4e1a\u52a1\u5ba1\u6279\u4eba\u3002\u6210\u5458\u3001\u6a21\u677f\u7b49\u5176\u4ed6\u914d\u7f6e\u5ba1\u8ba1\u5c1a\u672a\u6c47\u603b\u3002":"\u4ec5\u5c55\u793a\u5b8c\u6574\u6570\u636e\u8303\u56f4\u5728\u60a8\u6388\u6743\u4e4b\u5185\u7684\u5f53\u524d\u767b\u8bb0\u7248\u672c\u3002\u767b\u8bb0\u542f\u7528\u4e0d\u4ee3\u8868\u8fde\u63a5\u6b63\u5e38\u3001\u6570\u636e\u5b8c\u6574\u6216\u5df2\u5b8c\u6210\u751f\u4ea7\u63a5\u5165\uff1b\u8fde\u63a5\u6838\u9a8c\u5c1a\u672a\u63a5\u5165\u3002"}</p></PanelCard>
  {read.error&&<p role="alert" className="text-body-small text-danger-text">{read.error}</p>}
  <div aria-busy={read.busy}><DataTable rows={read.data?.items??[]} rowKey={r=>JSON.stringify([r.id,r.revision])} empty={<EmptyState title={read.busy?"\u6b63\u5728\u8bfb\u53d6":read.error?"\u65e0\u6cd5\u663e\u793a\u914d\u7f6e":audit?"\u6682\u65e0\u5339\u914d\u7248\u672c\u8bb0\u5f55":"\u6682\u65e0\u5339\u914d\u6765\u6e90\u914d\u7f6e"} description={"\u53ef\u8c03\u6574\u68c0\u7d22\u6761\u4ef6\uff0c\u6216\u7531\u7ba1\u7406\u5458\u6838\u5bf9\u6765\u6e90\u767b\u8bb0\u53ca\u67e5\u770b\u6743\u9650\u3002"}/>} columns={[
   {id:"id",header:"\u6765\u6e90\u914d\u7f6e",cell:r=><div className="flex min-w-0 flex-col gap-xs"><Button variant="ghost" className="h-auto justify-start whitespace-normal break-all px-0 text-left" onClick={()=>setSelected(r)}>{r.id}</Button><span className="break-all text-body-small text-muted-foreground">{r.sourceId}</span></div>},
   {id:"version",header:"\u767b\u8bb0\u7248\u672c",cell:r=>"v"+r.revision},
   {id:"status",header:"\u767b\u8bb0\u72b6\u6001",cell:r=><StatusBadge tone={r.status==="active"?"info":"neutral"} size="sm">{r.status==="active"?"\u767b\u8bb0\u542f\u7528":"\u767b\u8bb0\u6682\u505c"}</StatusBadge>},
   {id:"scope",header:"\u914d\u7f6e\u8303\u56f4",cell:r=><span className="text-body-small">{r.counts.stations+"\u7ad9\u5740 \u00b7 "+r.counts.metrics+"\u6307\u6807"}</span>},
   {id:"at",header:"\u767b\u8bb0\u65f6\u95f4",cell:r=><span className="whitespace-nowrap text-body-small text-muted-foreground">{time(r.recordedAt)}</span>},
  ]}/></div>
  <nav aria-label={"\u914d\u7f6e\u76ee\u5f55\u5206\u9875"} className="flex flex-wrap items-center justify-between gap-lg"><span className="text-body-small text-muted-foreground">{audit?"\u6309\u767b\u8bb0\u65f6\u95f4\u5012\u5e8f \u00b7 \u6bcf\u987520\u9879":"\u5f53\u524d\u767b\u8bb0\u7248\u672c \u00b7 \u6bcf\u987520\u9879"}</span><div className="flex items-center gap-md"><Button variant="outline" disabled={!cursors.length||read.busy} onClick={()=>{setSelected(null);setCursors(v=>v.slice(0,-1));}}>{"\u4e0a\u4e00\u9875"}</Button><Button variant="outline" disabled={!read.data?.next||read.busy} onClick={()=>{if(read.data?.next){setSelected(null);setCursors(v=>[...v,read.data!.next!]);}}}>{"\u4e0b\u4e00\u9875"}</Button></div></nav>
  <Drawer open={!!selected&&!!read.data} onClose={()=>setSelected(null)} title={audit?"\u914d\u7f6e\u7248\u672c":"\u6765\u6e90\u8be6\u60c5"} side="right" width="lg" className="max-w-full" closeLabel={"\u5173\u95ed\u8be6\u60c5"}>
   {detail.error&&<p role="alert" className="text-body-small text-danger-text">{detail.error}</p>}{detail.busy&&<p role="status" className="text-body-small text-muted-foreground">{"\u6b63\u5728\u8bfb\u53d6\u914d\u7f6e\u8be6\u60c5"}</p>}{detail.data&&<SourceDetail record={detail.data}/>}</Drawer>
 </ShellPageContainer>;
}
function SourceDetail({record:r}:{record:SourceRecord}){
 const facts=[["\u914d\u7f6e\u6807\u8bc6",r.id],["\u6765\u6e90\u6807\u8bc6",r.sourceId],["\u767b\u8bb0\u7248\u672c","v"+r.revision],["\u767b\u8bb0\u72b6\u6001",r.status==="active"?"\u767b\u8bb0\u542f\u7528":"\u767b\u8bb0\u6682\u505c"],["\u9002\u914d\u7248\u672c",r.adapterVersion],["\u8f6c\u6362\u6620\u5c04\u7248\u672c",r.transformVersion],["\u8986\u76d6\u8d77\u70b9",time(r.binding.coverageStart)],["\u767b\u8bb0\u65f6\u95f4",time(r.recordedAt)],["\u767b\u8bb0\u4f9d\u636e",r.reviewRef],["\u6570\u636e\u5e93\u8bb0\u5f55\u4e3b\u4f53",r.databaseActor],["\u914d\u7f6e\u6458\u8981 SHA-256",r.digest]];
 const dimensions:[string,readonly string[]][]=[["\u6765\u6e90",r.binding.scope.sourceIds],["\u7ad9\u5740",r.binding.scope.stationIds],["\u670d\u52a1",r.binding.scope.serviceIds],["\u8bbe\u5907",r.binding.scope.deviceIds],["\u6307\u6807",r.binding.scope.metricKeys]];
 return <div className="flex min-w-0 flex-col gap-xl"><dl className="grid min-w-0 gap-lg sm:grid-cols-2">{facts.map(([label,value])=><div key={label} className="min-w-0"><dt className="text-body-small text-muted-foreground">{label}</dt><dd className="break-all text-body">{value}</dd></div>)}</dl>
  <section className="flex flex-col gap-lg border-t border-dashed border-border pt-lg"><h3 className="text-label font-medium">{"\u5b8c\u6574\u914d\u7f6e\u8303\u56f4"}</h3>{dimensions.map(([label,ids])=><details key={label}><summary className="cursor-pointer text-body">{label+" \u00b7 "+ids.length}</summary><ul className="mt-sm flex flex-col gap-xs">{ids.map(id=><li key={id} className="break-all text-body-small text-muted-foreground">{id}</li>)}</ul></details>)}<p className="text-body-small">{"\u7269\u7406\u7ad9\u5740\u53c2\u6570\uff1a"+(r.binding.scope.allowSiteParameters?"\u5141\u8bb8":"\u672a\u6388\u6743")}</p></section>
  <p className="text-body-small text-muted-foreground">{"\u672c\u9875\u4e3a\u5df2\u767b\u8bb0\u914d\u7f6e\u7684\u53ea\u8bfb\u8bb0\u5f55\u3002\u8986\u76d6\u8d77\u70b9\u4e0d\u4ee3\u8868\u5df2\u63a5\u6536\u622a\u81f3\uff1b\u767b\u8bb0\u4f9d\u636e\u9700\u5355\u72ec\u6838\u5bf9\u539f\u4ef6\u4e0e\u4e1a\u52a1\u7b7e\u8ba4\u3002"}</p>
 </div>;
}
