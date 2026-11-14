"use client";
import { useEffect, useRef, useState } from "react";
import { DataTable, EmptyState, NativeSelect, StatusBadge, TableTitleCell } from "@vxture/design-system";
import { ConfigurationFrame, ConfigurationSearch, ConfigurationDetail, ConfigurationCursorPager, ConfigurationReload, configurationRowClick, configurationTime } from "./configuration-layout";
import type { ManagementPage, MemberRecord, MemberSummary, StationRecord } from "../domains/management/rules";
const cities: Record<string,string>={"610100":"\u897f\u5b89\u5e02","610200":"\u94dc\u5ddd\u5e02","610300":"\u5b9d\u9e21\u5e02","610400":"\u54b8\u9633\u5e02","610500":"\u6e2d\u5357\u5e02","610600":"\u5ef6\u5b89\u5e02","610700":"\u6c49\u4e2d\u5e02","610800":"\u6986\u6797\u5e02","610900":"\u5b89\u5eb7\u5e02","611000":"\u5546\u6d1b\u5e02"};
const denied="\u5f53\u524d\u8d26\u53f7\u65e0\u67e5\u770b\u6743\u9650\u6216\u4f1a\u8bdd\u5df2\u5931\u6548\uff0c\u8bf7\u91cd\u65b0\u767b\u5f55\u6216\u8054\u7cfb\u7ba1\u7406\u5458\u3002";
const unavailable="\u6682\u65f6\u65e0\u6cd5\u8bfb\u53d6\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002";
function useRead<T>(url: string | null) {
 const [state,setState]=useState<{url:string|null;data:T|null;error:string;busy:boolean}>({url:null,data:null,error:"",busy:false});
 const [revision,reload]=useState(0);
 const active=useRef<AbortController|null>(null);
 useEffect(()=>{
  const controller=new AbortController(); active.current=controller;
  setState({url,data:null,error:"",busy:!!url});
  if(url) void (async()=>{try {
   const response=await fetch(url,{cache:"no-store",signal:controller.signal});
   if(!response.ok)throw Error([401,403].includes(response.status)?denied:response.status===404?"\u8be5\u6210\u5458\u5f53\u524d\u4e0d\u53ef\u67e5\u770b\u3002":unavailable);
   const data=await response.json() as T;
   if(!controller.signal.aborted)setState({url,data,error:"",busy:false});
  }catch(error){if(!controller.signal.aborted)setState({url,data:null,error:error instanceof Error?error.message:unavailable,busy:false});}})();
  return ()=>controller.abort();
 },[url,revision]);
 return {...(state.url===url?state:{url,data:null,error:"",busy:!!url}),invalidate:(error:string)=>{active.current?.abort();setState({url,data:null,error,busy:false});},reload:()=>{active.current?.abort();setState({url,data:null,error:"",busy:!!url});reload(n=>n+1);}};
}
function usePages(){const [cursors,set]=useState<string[]>([]);return {after:cursors.at(-1),previous:!!cursors.length,reset:()=>set([]),next:(cursor:string)=>set(s=>[...s,cursor]),back:()=>set(s=>s.slice(0,-1))};}
function params(search:string,after:string|undefined,filter:[string,string]){const p=new URLSearchParams({search:search.trim(),[filter[0]]:filter[1]});if(after)p.set("after",after);return p.toString();}
export function JurisdictionWorkspace(){
 const [search,setSearch]=useState(""),[city,setCity]=useState("all"),[selection,setSelection]=useState<string|null>(null),pages=usePages();
 const read=useRead<ManagementPage<StationRecord>>("/api/management/jurisdiction?"+params(search,pages.after,["city",city]));
 const reset=()=>{pages.reset();setSelection(null);},rows=read.data?.items??[],selected=rows.find(row=>row.id===selection),open=(row:StationRecord)=>setSelection(previous=>previous===row.id?null:row.id);
 return <ConfigurationFrame area="access" view="jurisdiction" tools={<ConfigurationSearch value={search} onChange={value=>{reset();setSearch(value);}} onReset={()=>{reset();setSearch("");setCity("all");read.reload();}} filters={<NativeSelect className="h-control-xl text-body" wrapperClassName="w-auto" aria-label={"\u7b5b\u9009\u5730\u5e02"} value={city} onChange={event=>{reset();setCity(event.target.value);}}><option value="all">{"\u5168\u90e8\u5730\u5e02"}</option>{Object.entries(cities).map(([code,name])=><option key={code} value={code}>{name}</option>)}</NativeSelect>}/>}
  footer={<ConfigurationCursorPager previous={pages.previous} next={!!read.data?.next} busy={read.busy} onNext={()=>{setSelection(null);if(read.data?.next)pages.next(read.data.next);}} onPrevious={()=>{setSelection(null);pages.back();}}/>}>
  {read.error&&<div role="alert" className="flex flex-wrap items-center gap-xs text-body-small text-danger-text"><span>{read.error}</span><ConfigurationReload disabled={read.busy} onClick={read.reload}/></div>}
  <div className="site-analysis-table min-w-0 overflow-x-auto" aria-busy={read.busy} onClick={configurationRowClick(rows,open)}><DataTable rows={rows} rowKey={row=>row.id} empty={<EmptyState title={read.busy?"\u6b63\u5728\u8bfb\u53d6":read.error?"\u8d44\u6e90\u8bfb\u53d6\u5931\u8d25":"\u6682\u65e0\u5339\u914d\u7ad9\u5740"}/>} columns={[
   {id:"name",header:"\u7ad9\u5740\u540d\u79f0",cell:row=><TableTitleCell className="site-analysis-site-title" icon="building" title={row.name} description={row.id} onTitleClick={()=>open(row)}/>},
   {id:"region",header:"\u5f52\u5c5e\u533a\u57df",align:"center",cell:row=>cities[row.city]??row.city},
   {id:"services",header:"\u6388\u6743\u670d\u52a1",align:"center",cell:row=>row.services},
   {id:"devices",header:"\u6388\u6743\u8bbe\u5907",align:"center",cell:row=>row.devices},
  ]}/></div>
  <p className="text-body-small text-muted-foreground">{"\u4ec5\u663e\u793a\u6388\u6743\u8d44\u6e90\uff1b\u8d23\u4efb\u7ec4\u7ec7\u4e3b\u6863\u4e0e\u5206\u914d\u5f85\u63a5\u5165\u3002"}</p>
  <ConfigurationDetail open={!!selected} onClose={()=>setSelection(null)} title={selected?.name} description={selected?.id}>{selected&&<dl className="grid min-w-0 gap-lg sm:grid-cols-2">{[["\u6240\u5c5e\u5730\u5e02",cities[selected.city]??selected.city],["\u6388\u6743\u670d\u52a1",selected.services],["\u6388\u6743\u8bbe\u5907",selected.devices]].map(([label,value])=><div key={label}><dt className="text-body-small text-muted-foreground">{label}</dt><dd className="break-all text-body">{value}</dd></div>)}</dl>}</ConfigurationDetail>
 </ConfigurationFrame>;
}
export function MembersWorkspace(){
 const [search,setSearch]=useState(""),[status,setStatus]=useState("all"),[selected,setSelected]=useState<string|null>(null),pages=usePages();
 const read=useRead<ManagementPage<MemberSummary>>("/api/management/members?"+params(search,pages.after,["status",status]));
 const close=()=>setSelected(null),reset=()=>{close();pages.reset();},rows=read.data?.items??[],open=(row:MemberSummary)=>setSelected(previous=>previous===row.id?null:row.id);
 const detail=useRead<MemberRecord>(selected&&read.data&&!read.error?"/api/management/members/"+encodeURIComponent(selected):null);
 useEffect(()=>{if(detail.error===denied){close();read.invalidate(denied);}},[detail.error]);
 return <ConfigurationFrame area="access" view="members" tools={<ConfigurationSearch value={search} onChange={value=>{reset();setSearch(value);}} onReset={()=>{reset();setSearch("");setStatus("all");read.reload();}} filters={<NativeSelect className="h-control-xl text-body" wrapperClassName="w-auto" aria-label={"\u6210\u5458\u72b6\u6001"} value={status} onChange={event=>{reset();setStatus(event.target.value);}}><option value="all">{"\u5168\u90e8\u72b6\u6001"}</option><option value="active">{"\u5df2\u542f\u7528"}</option><option value="inactive">{"\u5df2\u505c\u7528"}</option></NativeSelect>}/>}
  footer={<ConfigurationCursorPager previous={pages.previous} next={!!read.data?.next} busy={read.busy} onNext={()=>{close();if(read.data?.next)pages.next(read.data.next);}} onPrevious={()=>{close();pages.back();}}/>}>
  {read.error&&<div role="alert" className="flex flex-wrap items-center gap-xs text-body-small text-danger-text"><span>{read.error}</span><ConfigurationReload disabled={read.busy} onClick={read.reload}/></div>}
  <div className="site-analysis-table min-w-0 overflow-x-auto" aria-busy={read.busy} onClick={configurationRowClick(rows,open)}><DataTable rows={rows} rowKey={row=>row.id} empty={<EmptyState title={read.busy?"\u6b63\u5728\u8bfb\u53d6":read.error?"\u6210\u5458\u8bfb\u53d6\u5931\u8d25":"\u6682\u65e0\u5339\u914d\u6210\u5458"}/>} columns={[
   {id:"name",header:"\u6210\u5458\u540d\u79f0",cell:row=><TableTitleCell className="site-analysis-site-title" icon="users" title={row.displayName} onTitleClick={()=>open(row)}/>},
   {id:"roles",header:"\u914d\u7f6e\u89d2\u8272",cell:row=>row.roles.map(role=>role.name).join(" / ")||"\u672a\u914d\u7f6e"},
   {id:"scope",header:"\u6388\u6743\u8303\u56f4",align:"center",cell:row=>row.counts.stations+" \u7ad9\u5740 \u00b7 "+row.counts.services+" \u670d\u52a1"},
   {id:"status",header:"\u72b6\u6001",align:"center",cell:row=><StatusBadge tone={row.status==="active"?"info":"neutral"} size="sm">{row.status==="active"?"\u5df2\u542f\u7528":"\u5df2\u505c\u7528"}</StatusBadge>},
   {id:"expiry",header:"\u6388\u6743\u6709\u6548\u671f",align:"center",cell:row=><span className="whitespace-nowrap text-body-small text-muted-foreground">{configurationTime(row.expiresAt)}</span>},
  ]}/></div>
  <p className="text-body-small text-muted-foreground">{"\u5f53\u524d\u4ec5\u4f9b\u67e5\u9605\uff1b\u5b9e\u9645\u8bbf\u95ee\u4ecd\u9700\u6ee1\u8db3\u5e73\u53f0\u8ba2\u9605\u3001\u8d26\u53f7\u72b6\u6001\u4e0e\u6388\u6743\u6709\u6548\u671f\u3002"}</p>
  <ConfigurationDetail open={!!selected&&!!read.data} onClose={close} title={detail.data?.displayName??"\u6210\u5458\u6388\u6743"} description={selected??undefined}>
   {detail.error&&<p role="alert" className="text-body-small text-danger-text">{detail.error}</p>}{detail.busy&&<p role="status" className="text-body-small text-muted-foreground">{"\u6b63\u5728\u8bfb\u53d6"}</p>}{detail.data&&<MemberDetail member={detail.data}/>}</ConfigurationDetail>
 </ConfigurationFrame>;
}
function MemberDetail({member:m}:{member:MemberRecord}){
 const dimensions:[string,readonly string[]][]=[["\u6765\u6e90",m.scope.sourceIds],["\u7ad9\u5740",m.scope.stationIds],["\u670d\u52a1",m.scope.serviceIds],["\u8bbe\u5907",m.scope.deviceIds],["\u6307\u6807",m.scope.metricKeys]];
 return <div className="flex min-w-0 flex-col gap-xl"><dl className="grid min-w-0 gap-lg sm:grid-cols-2">{[["\u6210\u5458\u540d\u79f0",m.displayName],["\u8eab\u4efd\u6807\u8bc6",m.sub],["\u6210\u5458\u72b6\u6001",m.status==="active"?"\u5df2\u542f\u7528":"\u5df2\u505c\u7528"],["\u6570\u636e\u6388\u6743\u81f3",configurationTime(m.expiresAt)]].map(([label,value])=><div key={label} className="min-w-0"><dt className="text-body-small text-muted-foreground">{label}</dt><dd className="break-all text-body">{value}</dd></div>)}</dl>
 <section className="flex flex-col gap-md"><h3 className="text-label font-medium">{"\u914d\u7f6e\u89d2\u8272\u4e0e\u6743\u9650"}</h3>{m.roles.length?m.roles.map(r=><div key={r.code} className="min-w-0 border-b border-dashed border-border pb-md"><p className="font-medium">{r.name}</p><p className="break-all text-body-small text-muted-foreground">{r.code}</p><ul className="mt-sm flex flex-col gap-xs">{r.permissions.map(p=><li key={p} className="break-all text-body-small">{p}</li>)}</ul></div>):<p className="text-body-small text-muted-foreground">{"\u672a\u914d\u7f6e\u4ea7\u54c1\u89d2\u8272"}</p>}</section>
 <section className="flex flex-col gap-lg"><h3 className="text-label font-medium">{"\u6570\u636e\u6388\u6743\u8303\u56f4"}</h3>{dimensions.map(([label,ids])=><details key={label}><summary className="cursor-pointer text-body">{label+" \u00b7 "+ids.length}</summary><ul className="mt-sm flex flex-col gap-xs">{ids.map(id=><li key={id} className="break-all text-body-small text-muted-foreground">{id}</li>)}</ul></details>)}<p className="text-body-small">{"\u7269\u7406\u7ad9\u5740\u53c2\u6570\uff1a"+(m.scope.allowSiteParameters?"\u5141\u8bb8":"\u672a\u6388\u6743")}</p></section></div>;
}
