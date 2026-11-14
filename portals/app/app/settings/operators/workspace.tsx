"use client";
import {useEffect,useRef,useState} from "react";
import {Button,Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle,Icon,Input,ShellPageContainer} from "@vxture/design-system";
import PageHeading from "../../portal/page-heading";
import ResetButton from "../../portal/reset-button";
import {notifyIdentityChange} from "../../portal/operator-identities";
import {DEFAULT_IDENTITIES,GENERIC_LOGO,MAX_IDENTITIES,MAX_LOGO_BYTES,identityRecord,readCatalog,type IdentityAction,type OperatorIdentityCatalog,type OperatorIdentityRecord} from "../../domains/operator-identities/rules";
import "./operators.css";
import "../../site-analysis/site-analysis.css";
const endpoint="/api/management/operator-identities";
function errorText(status:number){return status===409?"\u914d\u7f6e\u5df2\u53d8\u66f4\uff0c\u8bf7\u91cd\u65b0\u52a0\u8f7d\u540e\u518d\u7f16\u8f91\u3002":status===401?"\u8bf7\u767b\u5f55\u540e\u7ef4\u62a4\u8fd0\u8425\u4e3b\u4f53\u914d\u7f6e\u3002":status===403?"\u5f53\u524d\u8d26\u53f7\u6ca1\u6709\u8fd0\u8425\u4e3b\u4f53\u914d\u7f6e\u6743\u9650\u3002":status===400?"\u540d\u79f0\u6216\u56fe\u7247\u65e0\u6548\uff0c\u8bf7\u68c0\u67e5\u540e\u91cd\u8bd5\u3002":status===413?"\u56fe\u7247\u8fc7\u5927\uff0c\u8bf7\u9009\u62e9512KB\u4ee5\u5185\u7684\u56fe\u7247\u3002":"\u914d\u7f6e\u6682\u65f6\u65e0\u6cd5\u4fdd\u5b58\u6216\u8bfb\u53d6\uff0c\u8bf7\u91cd\u8bd5\u3002";}
export default function OperatorConfiguration(){
  const [catalog,setCatalog]=useState<OperatorIdentityCatalog|null>(null),[canEdit,setCanEdit]=useState(false),[error,setError]=useState("");
  const [draft,setDraft]=useState<OperatorIdentityRecord|null>(null),[action,setAction]=useState<IdentityAction>("update"),[revision,setRevision]=useState(0),[saving,setSaving]=useState(false),[uploading,setUploading]=useState(false),[formError,setFormError]=useState("");
  const [notice,setNotice]=useState("");const fileInput=useRef<HTMLInputElement>(null),fileSequence=useRef(0);
  async function load(signal?:AbortSignal){setError("");try{const response=await fetch(endpoint,{cache:"no-store",signal});if(!response.ok)throw Error(errorText(response.status));const data=await response.json();setCatalog(readCatalog(data.catalog));setCanEdit(data.canEdit===true);}catch(error){if(!signal?.aborted)setError(error instanceof Error?error.message:errorText(503));}}
  useEffect(()=>{const abort=new AbortController();void load(abort.signal);return()=>abort.abort();},[]);
  function open(record:OperatorIdentityRecord,nextAction:IdentityAction){if(!catalog)return;fileSequence.current++;setUploading(false);setDraft({...record});setAction(nextAction);setRevision(catalog.revision);setFormError("");setNotice("");}
  function close(){if(saving)return;fileSequence.current++;setUploading(false);setDraft(null);}
  function add(){open({code:"provider_"+crypto.randomUUID().replaceAll("-",""),fullName:"",shortName:"",logo:GENERIC_LOGO},"create");}
  async function upload(file:File){
    const sequence=++fileSequence.current;setUploading(true);setFormError("");
    try{
      if(!["image/png","image/jpeg","image/webp"].includes(file.type)||file.size>MAX_LOGO_BYTES)throw Error("\u8bf7\u9009\u62e9512KB\u4ee5\u5185\u7684PNG\u3001JPG\u6216WebP\u56fe\u7247\u3002");
      const bitmap=await createImageBitmap(file);const width=bitmap.width,height=bitmap.height;bitmap.close();if(width>4096||height>4096||width<16||height<16)throw Error("\u56fe\u7247\u5c3a\u5bf8\u5e94\u572816\u81f34096\u50cf\u7d20\u4e4b\u95f4\u3002");
      const logo=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(Error("\u56fe\u7247\u8bfb\u53d6\u5931\u8d25\uff0c\u8bf7\u91cd\u65b0\u9009\u62e9\u3002"));reader.readAsDataURL(file);});
      identityRecord({...DEFAULT_IDENTITIES[0],logo});
      if(sequence===fileSequence.current)setDraft(current=>current?{...current,logo}:null);
    }catch(error){if(sequence===fileSequence.current)setFormError(error instanceof Error?error.message:"\u56fe\u7247\u65e0\u6548\uff0c\u8bf7\u91cd\u65b0\u9009\u62e9\u3002");}finally{if(sequence===fileSequence.current)setUploading(false);if(fileInput.current)fileInput.current.value="";}
  }
  async function save(){if(!draft||saving||uploading)return;setSaving(true);setFormError("");try{
    const record=identityRecord(draft);
    const response=await fetch(endpoint,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({revision,record,action})});
    if(!response.ok){const body=await response.json().catch(()=>null);throw Error(body?.error==="IDENTITY_CONFLICT"?"\u5168\u79f0\u6216\u7b80\u79f0\u5df2\u5b58\u5728\uff0c\u8bf7\u4fee\u6539\u540e\u91cd\u8bd5\u3002":errorText(response.status));}
    setCatalog(readCatalog(await response.json()));fileSequence.current++;setDraft(null);setNotice(action==="create"?"\u8fd0\u8425\u670d\u52a1\u5546\u5df2\u6dfb\u52a0":"\u8fd0\u8425\u4e3b\u4f53\u914d\u7f6e\u5df2\u4fdd\u5b58");notifyIdentityChange();
  }catch(error){setFormError(error instanceof Error&&error.message.startsWith("invalid_operator")?errorText(400):error instanceof Error?error.message:errorText(503));}finally{setSaving(false);}}
  const preset=draft?DEFAULT_IDENTITIES.find(item=>item.code===draft.code):undefined;
  return <ShellPageContainer className="site-analysis-page gap-lg"><PageHeading title={"\u8fd0\u8425\u4e3b\u4f53"} icon="building-library" description={"\u7edf\u4e00\u7ef4\u62a4\u4e3b\u4f53\u540d\u79f0\u4e0e\u54c1\u724c\u6807\u8bc6"} actions={<Button size="sm" className="h-control-xl text-body" disabled={!canEdit||!catalog||catalog.items.length>=MAX_IDENTITIES} onClick={add}><Icon name="plus" size="sm"/>{"\u6dfb\u52a0\u8fd0\u8425\u670d\u52a1\u5546"}</Button>}/>
    {error&&<div role="alert" className="flex flex-wrap items-center gap-md text-body text-destructive"><span>{error}</span><Button className="h-control-xl text-body" variant="outline" onClick={()=>void load()}>{"\u91cd\u65b0\u52a0\u8f7d"}</Button></div>}
    {notice&&<p role="status" className="text-body text-primary">{notice}</p>}
    {!catalog?<p className="text-body text-muted-foreground">{error?"\u914d\u7f6e\u5c1a\u672a\u52a0\u8f7d":"\u6b63\u5728\u8bfb\u53d6\u914d\u7f6e\u2026"}</p>:<ul className="operator-config-list" aria-label={"\u8fd0\u8425\u4e3b\u4f53\u5217\u8868"}>{catalog.items.map(record=><li className="operator-config-row" key={record.code}>
      <span className="operator-config-logo"><img src={record.logo} alt=""/></span><div className="flex min-w-0 flex-1 flex-col gap-2xs"><span className="text-label text-foreground">{record.shortName}</span><span className="break-words text-body-small text-muted-foreground">{record.fullName}</span></div>
      <Button className="h-control-xl text-body" variant="ghost" size="icon-xl" disabled={!canEdit} aria-label={"\u7f16\u8f91"+record.shortName} title={"\u7f16\u8f91"+record.shortName} onClick={()=>open(record,"update")}><Icon name="edit" size="sm"/></Button>
    </li>)}</ul>}
    <Dialog open={!!draft} onOpenChange={isOpen=>{if(!isOpen)close();}}><DialogContent width="sm" className="operator-config-dialog"><DialogHeader><DialogTitle>{action==="create"?"\u6dfb\u52a0\u8fd0\u8425\u670d\u52a1\u5546":"\u7f16\u8f91\u8fd0\u8425\u4e3b\u4f53"}</DialogTitle><DialogDescription>{action==="create"?"\u586b\u5199\u5168\u79f0\u3001\u7b80\u79f0\u5e76\u8bbe\u7f6e\u54c1\u724c\u6807\u8bc6\u3002":"\u4fee\u6539\u540d\u79f0\u6216\u66ff\u6362\u6807\u8bc6\uff0c\u4fdd\u5b58\u540e\u7edf\u4e00\u751f\u6548\u3002"}</DialogDescription></DialogHeader>
      {draft&&<form className="flex min-w-0 flex-col gap-lg" onSubmit={e=>{e.preventDefault();void save();}}><fieldset disabled={saving} className="flex min-w-0 flex-col gap-lg">
        <div className="operator-config-preview"><img src={draft.logo} alt={(draft.shortName||"\u65b0\u670d\u52a1\u5546")+"\u6807\u8bc6\u9884\u89c8"}/><div className="flex min-w-0 flex-col gap-2xs"><strong className="text-label">{draft.shortName||"\u65b0\u8fd0\u8425\u670d\u52a1\u5546"}</strong><span className="break-words text-body-small text-muted-foreground">{draft.fullName||"\u586b\u5199\u540d\u79f0\u540e\u9884\u89c8"}</span></div></div>
        <label className="flex flex-col gap-xs text-body"><span>{"\u5168\u79f0"}</span><Input className="h-control-xl text-body" aria-label={"\u4e3b\u4f53\u5168\u79f0"} value={draft.fullName} required maxLength={80} onChange={e=>setDraft({...draft,fullName:e.target.value})}/></label>
        <label className="flex flex-col gap-xs text-body"><span>{"\u7b80\u79f0"}</span><Input className="h-control-xl text-body" aria-label={"\u4e3b\u4f53\u7b80\u79f0"} value={draft.shortName} required maxLength={12} onChange={e=>setDraft({...draft,shortName:e.target.value})}/></label>
        <div className="flex flex-col gap-xs"><span className="text-body">{"\u54c1\u724c\u6807\u8bc6"}</span><div className="flex flex-wrap items-center gap-xs"><Button className="h-control-xl text-body" type="button" variant="outline" disabled={uploading} onClick={()=>fileInput.current?.click()}><Icon name="upload" size="sm"/>{uploading?"\u6b63\u5728\u8bfb\u53d6":"\u66f4\u6362Logo"}</Button><input ref={fileInput} type="file" className="sr-only" aria-label={"\u4e0a\u4f20\u4e3b\u4f53Logo"} accept="image/png,image/jpeg,image/webp" onChange={e=>{const file=e.target.files?.[0];if(file)void upload(file);}}/><span className="text-body-small text-muted-foreground">{"PNG / JPG / WebP\uff0c512KB\u4ee5\u5185"}</span></div></div>
      </fieldset>
      {formError&&<div role="alert" className="flex flex-col gap-xs"><p className="text-body-small text-destructive">{formError}</p><Button type="button" variant="ghost" className="h-control-xl self-start text-body" onClick={()=>{close();void load();}}>{"\u91cd\u65b0\u52a0\u8f7d\u914d\u7f6e"}</Button></div>}
      <div className="flex flex-wrap items-center justify-between gap-md"><ResetButton type="button" variant="ghost" label={preset?"\u6062\u590d\u8be5\u4e3b\u4f53\u9ed8\u8ba4\u8bbe\u7f6e":"\u6062\u590d\u9ed8\u8ba4Logo"} disabled={saving||uploading} onClick={()=>{fileSequence.current++;setDraft(preset?{...preset}:{...draft,logo:GENERIC_LOGO});setFormError("");}}/><div className="flex items-center gap-xs"><Button className="h-control-xl text-body" type="button" variant="outline" disabled={saving} onClick={close}>{"\u53d6\u6d88"}</Button><Button className="h-control-xl text-body" type="submit" disabled={saving||uploading}>{saving?"\u6b63\u5728\u4fdd\u5b58":"\u4fdd\u5b58"}</Button></div></div>
      </form>}
    </DialogContent></Dialog>
  </ShellPageContainer>;
}
