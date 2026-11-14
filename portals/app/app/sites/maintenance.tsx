"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {Button,Input,Textarea,Label,DetailList,DetailRow} from "@vxture/design-system";
import {emptyFields,maintenanceFor,type AssetKind,type MaintenanceCatalog,type MaintenanceFields} from "../domains/site-registry/maintenance-rules";
import {formatDataTime} from "../domains/data-updates/rules";
const labels={alias:"\u672c\u7ad9\u522b\u540d",locationNote:"\u4f4d\u7f6e\u8865\u5145",note:"\u7ef4\u62a4\u5907\u6ce8"};
export default function AssetMaintenance({kind,id,siteId,catalog,canMaintain,onChange,initialEdit=false}:{kind:AssetKind;id:string;siteId:string;catalog:MaintenanceCatalog;canMaintain:boolean;onChange:(catalog:MaintenanceCatalog)=>void;initialEdit?:boolean}){
 const router=useRouter(),record=maintenanceFor(catalog,kind,id),events=catalog.events.filter(event=>event.kind===kind&&event.id===id);
 const [editing,setEditing]=useState(initialEdit&&canMaintain),[draft,setDraft]=useState<MaintenanceFields>(record??emptyFields()),[revision,setRevision]=useState(record?.revision??0),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[conflict,setConflict]=useState(false);
 function edit(){setDraft(record??emptyFields());setRevision(record?.revision??0);setError("");setNotice("");setConflict(false);setEditing(true);}
 async function reload(){
  setBusy(true);setError("");
  try{const response=await fetch("/api/product-preview/site-registry/"+encodeURIComponent(siteId),{cache:"no-store"});if(!response.ok)throw Error();const data=await response.json();onChange(data.maintenance);setRevision(maintenanceFor(data.maintenance,kind,id)?.revision??0);setConflict(false);setNotice("\u5df2\u8bfb\u53d6\u6700\u65b0\u7248\u672c\uff0c\u8bf7\u6838\u5bf9\u540e\u4fdd\u5b58\u3002");}
  catch{setError("\u6682\u65f6\u65e0\u6cd5\u8bfb\u53d6\uff0c\u672a\u4fdd\u5b58\u5185\u5bb9\u5df2\u4fdd\u7559\u3002");}finally{setBusy(false);}
 }
 async function save(event:React.FormEvent){
  event.preventDefault();if(busy||conflict)return;setBusy(true);setError("");setNotice("");
  try{const response=await fetch("/api/product-preview/site-registry/maintenance",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({kind,id,revision,alias:draft.alias,locationNote:kind==="site"?draft.locationNote:"",note:draft.note})});
   if(response.status===409){setConflict(true);setError("\u8d44\u6599\u5df2\u6709\u66f4\u65b0\uff0c\u8bf7\u8bfb\u53d6\u6700\u65b0\u7248\u672c\u5e76\u6838\u5bf9\u3002");return;}
   if(!response.ok){setError(response.status===403||response.status===404?"\u5f53\u524d\u65e0\u6cd5\u7ef4\u62a4\u6b64\u8d44\u6599\u3002":"\u4fdd\u5b58\u5931\u8d25\uff0c\u672a\u4fdd\u5b58\u5185\u5bb9\u5df2\u4fdd\u7559\u3002");return;}
   const next=await response.json() as MaintenanceCatalog;onChange(next);setRevision(maintenanceFor(next,kind,id)?.revision??0);setEditing(false);setNotice("\u5df2\u4fdd\u5b58\u672c\u7ad9\u8865\u5145\u8d44\u6599");router.refresh();
  }catch{setError("\u4fdd\u5b58\u7ed3\u679c\u672a\u786e\u8ba4\uff0c\u8bf7\u6838\u5bf9\u6700\u65b0\u8d44\u6599\u540e\u91cd\u8bd5\u3002");}finally{setBusy(false);}
 }
 return <section className="flex min-w-0 flex-col gap-md" data-asset-maintenance={kind}>
  <div className="flex items-center justify-between gap-sm"><h4 className="text-label font-semibold">{"\u672c\u7ad9\u8865\u5145\u8d44\u6599"}</h4>{canMaintain&&!editing&&<Button variant="outline" className="h-control-xl text-body font-normal" onClick={edit}>{"\u7ef4\u62a4"}</Button>}</div>
  {notice&&<p role="status" className="text-body-small text-muted-foreground">{notice}</p>}{error&&<p role="alert" className="text-body-small text-warning-text">{error}</p>}
  {editing?<form onSubmit={save} className="site-analysis-workflow flex min-w-0 flex-col gap-md">
   <div className="flex flex-col gap-xs"><Label htmlFor={"asset-alias-"+id}>{"\u672c\u7ad9\u522b\u540d"}</Label><Input id={"asset-alias-"+id} aria-label={"\u672c\u7ad9\u522b\u540d"} maxLength={80} value={draft.alias} onChange={e=>setDraft({...draft,alias:e.target.value})}/></div>
   {kind==="site"&&<div className="flex flex-col gap-xs"><Label htmlFor={"asset-location-"+id}>{"\u4f4d\u7f6e\u8865\u5145"}</Label><Input id={"asset-location-"+id} aria-label={"\u4f4d\u7f6e\u8865\u5145"} maxLength={300} value={draft.locationNote} onChange={e=>setDraft({...draft,locationNote:e.target.value})}/></div>}
   <div className="flex flex-col gap-xs"><Label htmlFor={"asset-note-"+id}>{"\u7ef4\u62a4\u5907\u6ce8"}</Label><Textarea id={"asset-note-"+id} aria-label={"\u7ef4\u62a4\u5907\u6ce8"} maxLength={1000} value={draft.note} onChange={e=>setDraft({...draft,note:e.target.value})}/></div>
   <p className="text-body-small text-muted-foreground">{"\u8865\u5145\u8d44\u6599\u5355\u72ec\u4fdd\u5b58\uff0c\u6765\u6e90\u5b57\u6bb5\u4fdd\u6301\u539f\u503c\u3002"}</p>
   <div className="flex flex-wrap items-center gap-sm">{conflict&&<Button type="button" variant="outline" disabled={busy} onClick={()=>void reload()}>{"\u8bfb\u53d6\u6700\u65b0\u7248\u672c"}</Button>}<Button type="submit" disabled={busy||conflict}>{"\u4fdd\u5b58"}</Button><Button type="button" variant="ghost" disabled={busy} onClick={()=>{setEditing(false);setError("");setNotice("");}}>{"\u53d6\u6d88"}</Button></div>
  </form>:record?<DetailList><DetailRow label={"\u672c\u7ad9\u522b\u540d"}>{record.alias||"\u2014"}</DetailRow>{kind==="site"&&<DetailRow label={"\u4f4d\u7f6e\u8865\u5145"}>{record.locationNote||"\u2014"}</DetailRow>}<DetailRow label={"\u7ef4\u62a4\u5907\u6ce8"}><span className="whitespace-pre-wrap break-all">{record.note||"\u2014"}</span></DetailRow><DetailRow label={"\u6700\u8fd1\u7ef4\u62a4"}>{formatDataTime(record.updatedAt)}</DetailRow></DetailList>:<p className="text-body-small text-muted-foreground">{"\u6682\u65e0\u672c\u7ad9\u8865\u5145\u8d44\u6599"}</p>}
  <details className="text-body-small" data-maintenance-history><summary className="cursor-pointer text-muted-foreground">{"\u7ef4\u62a4\u8bb0\u5f55 \u00b7 "+events.length}</summary><div className="flex min-w-0 flex-col gap-md pt-md">{events.length?events.slice().reverse().map(event=><div key={event.revision} className="flex min-w-0 flex-col gap-xs border-t border-dashed border-border pt-sm"><time className="text-muted-foreground" dateTime={event.at}>{formatDataTime(event.at)}</time>{(Object.keys(labels) as (keyof MaintenanceFields)[]).filter(key=>event.before[key]!==event.after[key]).map(key=><p key={key} className="break-all">{labels[key]+"\uff1a"+(event.before[key]||"\u2014")+" \u2192 "+(event.after[key]||"\u2014")}</p>)}</div>):<p className="text-muted-foreground">{"\u6682\u65e0\u7ef4\u62a4\u8bb0\u5f55"}</p>}</div></details>
 </section>;
}
