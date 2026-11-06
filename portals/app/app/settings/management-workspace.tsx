"use client";
import { useEffect, useRef, useState } from "react";
import { Button, DataTable, Drawer, EmptyState, Icon, InputGroup, InputGroupAddon, InputGroupInput, NativeSelect, PanelCard, ShellPageContainer, StatusBadge } from "@vxture/design-system";
import PageHeading from "../portal/page-heading";
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
function Search({value,onChange,label}:{value:string;onChange:(v:string)=>void;label:string}) {
 return <div className="min-w-0 sm:ml-auto"><InputGroup><InputGroupAddon><Icon name="search" size="sm" /></InputGroupAddon><InputGroupInput aria-label={label} placeholder={label} value={value} maxLength={100} onChange={e=>onChange(e.target.value)} /></InputGroup></div>;
}
function ReadState({error,busy}:{error:string;busy:boolean}){return error?<p role="alert" className="text-body text-destructive">{error}</p>:busy?<p role="status" className="text-body-small text-muted-foreground">{"\u6b63\u5728\u8bfb\u53d6\u2026"}</p>:null;}
function Pager({next,previous,onNext,onPrevious,busy}:{next:string|null|undefined;previous:boolean;onNext:()=>void;onPrevious:()=>void;busy:boolean}) {
 return <nav aria-label={"\u5217\u8868\u7ffb\u9875"} className="flex flex-wrap items-center justify-between gap-lg border-t border-dashed border-border pt-lg"><span className="text-body-small text-muted-foreground">{"\u6bcf\u9875\u6700\u591a20\u6761 \u00b7 \u4ec5\u663e\u793a\u5b8c\u6574\u6388\u6743\u8303\u56f4\u5185\u8bb0\u5f55"}</span><div className="flex gap-md"><Button variant="outline" disabled={!previous||busy} onClick={onPrevious}>{"\u4e0a\u4e00\u9875"}</Button><Button variant="outline" disabled={!next||busy} onClick={onNext}>{"\u4e0b\u4e00\u9875"}</Button></div></nav>;
}
function usePages(){const [cursors,set]=useState<string[]>([]);return {after:cursors.at(-1),previous:!!cursors.length,reset:()=>set([]),next:(cursor:string)=>set(s=>[...s,cursor]),back:()=>set(s=>s.slice(0,-1))};}
function params(search:string,after:string|undefined,filter:[string,string]){const p=new URLSearchParams({search,[filter[0]]:filter[1]});if(after)p.set("after",after);return p.toString();}
export function JurisdictionWorkspace(){
 const [search,setSearch]=useState(""),[city,setCity]=useState("all");const pages=usePages();
 const read=useRead<ManagementPage<StationRecord>>("/api/management/jurisdiction?"+params(search,pages.after,["city",city]));
 return <ShellPageContainer className="gap-lg"><PageHeading title={"\u7ba1\u8f96\u8303\u56f4"} description={"\u67e5\u770b\u5f53\u524d\u8d26\u53f7\u83b7\u6388\u6743\u7684\u7ad9\u5740\u53ca\u5173\u8054\u8d44\u6e90"} actions={<Button variant="outline" onClick={read.reload} disabled={read.busy}>{"\u91cd\u65b0\u8bfb\u53d6"}</Button>} toolbar={<div className="flex flex-wrap items-center gap-lg"><NativeSelect aria-label={"\u7b5b\u9009\u5730\u5e02"} wrapperClassName="w-auto" value={city} onChange={e=>{setCity(e.target.value);pages.reset();}}><option value="all">{"\u5168\u90e8\u5730\u5e02"}</option>{Object.entries(cities).map(([code,name])=><option key={code} value={code}>{name}</option>)}</NativeSelect><Search label={"\u7ad9\u5740\u540d\u79f0 / \u7f16\u7801"} value={search} onChange={v=>{setSearch(v);pages.reset();}} /></div>} />
 <PanelCard title={"\u6388\u6743\u8d44\u6e90"} icon="building"><p className="text-body-small text-muted-foreground">{"\u670d\u52a1\u4e0e\u8bbe\u5907\u6570\u91cf\u4ec5\u8ba1\u5165\u5df2\u6388\u6743\u8bb0\u5f55\uff1b\u6b64\u5904\u5c55\u793a\u4ea7\u54c1\u6570\u636e\u7ba1\u8f96\u8303\u56f4\uff0c\u8d23\u4efb\u7ec4\u7ec7\u5173\u8054\u5c1a\u672a\u63a5\u5165\u3002"}</p></PanelCard>
 <ReadState error={read.error} busy={read.busy}/>
 <DataTable rows={read.data?.items??[]} rowKey={r=>r.id} empty={<EmptyState title={read.busy?"\u6b63\u5728\u8bfb\u53d6":read.error?"\u65e0\u6cd5\u663e\u793a\u8d44\u6e90":"\u6682\u65e0\u5339\u914d\u7ad9\u5740"} description={read.error?"\u8bfb\u53d6\u6210\u529f\u540e\u663e\u793a\u6388\u6743\u8d44\u6e90\u3002":"\u53ef\u8c03\u6574\u68c0\u7d22\u6761\u4ef6\uff0c\u6216\u7531\u7ba1\u7406\u5458\u6838\u5bf9\u7ad9\u5740\u6388\u6743\u3002"}/>} columns={[
 {id:"name",header:"\u7ad9\u5740\u540d\u79f0",cell:r=><span className="font-medium">{r.name}</span>},{id:"code",header:"\u7ad9\u5740\u7f16\u7801",cell:r=><span className="break-all text-muted-foreground">{r.id}</span>},{id:"region",header:"\u5f52\u5c5e\u533a\u57df",cell:r=>"\u9655\u897f\u7701 \u00b7 "+(cities[r.city]??r.city)},{id:"services",header:"\u6388\u6743\u670d\u52a1",cell:r=>r.services},{id:"devices",header:"\u6388\u6743\u8bbe\u5907",cell:r=>r.devices}]} />
 <Pager next={read.data?.next} previous={pages.previous} onNext={()=>read.data?.next&&pages.next(read.data.next)} onPrevious={pages.back} busy={read.busy}/>
 </ShellPageContainer>;
}
export function MembersWorkspace(){
 const [search,setSearch]=useState(""),[status,setStatus]=useState("all"),[selected,setSelected]=useState<string|null>(null);const pages=usePages();
 const read=useRead<ManagementPage<MemberSummary>>("/api/management/members?"+params(search,pages.after,["status",status]));
 const close=()=>setSelected(null);const refresh=()=>{close();read.reload();};
 const detail=useRead<MemberRecord>(selected&&read.data&&!read.error?"/api/management/members/"+selected:null);
 useEffect(()=>{if(detail.error===denied){close();read.invalidate(denied);}},[detail.error]);
 return <ShellPageContainer className="gap-lg"><PageHeading title={"\u6210\u5458\u7ba1\u7406"} description={"\u67e5\u770b\u8303\u56f4\u5185\u6210\u5458\u3001\u5df2\u914d\u7f6e\u89d2\u8272\u4e0e\u6570\u636e\u6388\u6743"} actions={<Button variant="outline" onClick={refresh} disabled={read.busy}>{"\u91cd\u65b0\u8bfb\u53d6"}</Button>} toolbar={<div className="flex flex-wrap items-center gap-lg"><NativeSelect aria-label={"\u6210\u5458\u72b6\u6001"} wrapperClassName="w-auto" value={status} onChange={e=>{close();setStatus(e.target.value);pages.reset();}}><option value="all">{"\u5168\u90e8\u72b6\u6001"}</option><option value="active">{"\u5df2\u542f\u7528"}</option><option value="inactive">{"\u5df2\u505c\u7528"}</option></NativeSelect><Search label={"\u6210\u5458\u540d\u79f0 / \u8eab\u4efd\u6807\u8bc6"} value={search} onChange={v=>{close();setSearch(v);pages.reset();}}/></div>} />
 <PanelCard title={"\u6388\u6743\u76ee\u5f55"} icon="shield-check"><p className="text-body-small text-muted-foreground">{"\u4ec5\u663e\u793a\u5df2\u767b\u8bb0\u4e14\u5b8c\u6574\u6570\u636e\u8303\u56f4\u5728\u60a8\u7ba1\u8f96\u4e4b\u5185\u7684\u6210\u5458\u3002\u89d2\u8272\u6240\u5217\u6743\u9650\u662f\u4ea7\u54c1\u914d\u7f6e\u8bb0\u5f55\uff1b\u5b9e\u9645\u8bbf\u95ee\u8fd8\u9700\u6ee1\u8db3\u5e73\u53f0\u8ba2\u9605\u3001\u8d26\u53f7\u72b6\u6001\u548c\u6388\u6743\u6709\u6548\u671f\u3002"}</p></PanelCard>
 <ReadState error={read.error} busy={read.busy}/>
 <DataTable rows={read.data?.items??[]} rowKey={r=>r.id} empty={<EmptyState title={read.busy?"\u6b63\u5728\u8bfb\u53d6":read.error?"\u65e0\u6cd5\u663e\u793a\u6210\u5458":"\u6682\u65e0\u5339\u914d\u6210\u5458"} description={read.error?"\u8bfb\u53d6\u6210\u529f\u540e\u663e\u793a\u6388\u6743\u76ee\u5f55\u3002":"\u53ef\u8c03\u6574\u6761\u4ef6\uff0c\u6216\u7531\u7ba1\u7406\u5458\u6838\u5bf9\u6210\u5458\u548c\u6570\u636e\u6388\u6743\u3002"}/>} columns={[
 {id:"name",header:"\u6210\u5458\u540d\u79f0",cell:r=><Button variant="ghost" className="h-auto justify-start px-0 text-left" onClick={()=>setSelected(r.id)}>{r.displayName}</Button>},
 {id:"roles",header:"\u914d\u7f6e\u89d2\u8272",cell:r=>r.roles.map(v=>v.name).join(" / ")||"\u672a\u914d\u7f6e"},
 {id:"scope",header:"\u6388\u6743\u8303\u56f4",cell:r=>r.counts.stations+"\u7ad9\u5740 \u00b7 "+r.counts.services+"\u670d\u52a1"},
 {id:"status",header:"\u6210\u5458\u72b6\u6001",cell:r=><StatusBadge tone={r.status==="active"?"info":"neutral"} size="sm">{r.status==="active"?"\u5df2\u542f\u7528":"\u5df2\u505c\u7528"}</StatusBadge>},
 {id:"expiry",header:"\u6570\u636e\u6388\u6743\u81f3",cell:r=><span className="whitespace-nowrap text-body-small text-muted-foreground">{new Date(r.expiresAt).toLocaleString("zh-CN",{hour12:false})}</span>}]} />
 <Pager next={read.data?.next} previous={pages.previous} onNext={()=>{close();if(read.data?.next)pages.next(read.data.next);}} onPrevious={()=>{close();pages.back();}} busy={read.busy}/>
 <Drawer open={!!selected&&!!read.data} onClose={close} title={"\u6210\u5458\u6388\u6743"} side="right" width="lg" className="max-w-full" closeLabel={"\u5173\u95ed\u8be6\u60c5"}><ReadState error={detail.error} busy={detail.busy}/>{detail.data&&<MemberDetail member={detail.data}/>}</Drawer>
 </ShellPageContainer>;
}
function MemberDetail({member:m}:{member:MemberRecord}){
 const dimensions:[string,readonly string[]][]=[["\u6765\u6e90",m.scope.sourceIds],["\u7ad9\u5740",m.scope.stationIds],["\u670d\u52a1",m.scope.serviceIds],["\u8bbe\u5907",m.scope.deviceIds],["\u6307\u6807",m.scope.metricKeys]];
 return <div className="flex min-w-0 flex-col gap-xl"><dl className="grid min-w-0 gap-lg sm:grid-cols-2">{[["\u6210\u5458\u540d\u79f0",m.displayName],["\u8eab\u4efd\u6807\u8bc6",m.sub],["\u6210\u5458\u72b6\u6001",m.status==="active"?"\u5df2\u542f\u7528":"\u5df2\u505c\u7528"],["\u6570\u636e\u6388\u6743\u81f3",new Date(m.expiresAt).toLocaleString("zh-CN",{hour12:false})]].map(([label,value])=><div key={label} className="min-w-0"><dt className="text-body-small text-muted-foreground">{label}</dt><dd className="break-all text-body">{value}</dd></div>)}</dl>
 <section className="flex flex-col gap-md"><h3 className="text-label font-medium">{"\u914d\u7f6e\u89d2\u8272\u4e0e\u6743\u9650"}</h3>{m.roles.length?m.roles.map(r=><div key={r.code} className="min-w-0 border-b border-dashed border-border pb-md"><p className="font-medium">{r.name}</p><p className="break-all text-body-small text-muted-foreground">{r.code}</p><ul className="mt-sm flex flex-col gap-xs">{r.permissions.map(p=><li key={p} className="break-all text-body-small">{p}</li>)}</ul></div>):<p className="text-body-small text-muted-foreground">{"\u672a\u914d\u7f6e\u4ea7\u54c1\u89d2\u8272"}</p>}</section>
 <section className="flex flex-col gap-lg"><h3 className="text-label font-medium">{"\u6570\u636e\u6388\u6743\u8303\u56f4"}</h3>{dimensions.map(([label,ids])=><details key={label}><summary className="cursor-pointer text-body">{label+" \u00b7 "+ids.length}</summary><ul className="mt-sm flex flex-col gap-xs">{ids.map(id=><li key={id} className="break-all text-body-small text-muted-foreground">{id}</li>)}</ul></details>)}<p className="text-body-small">{"\u7269\u7406\u7ad9\u5740\u53c2\u6570\uff1a"+(m.scope.allowSiteParameters?"\u5141\u8bb8":"\u672a\u6388\u6743")}</p></section></div>;
}
