"use client";
import {useCallback,useEffect,useRef,useState} from "react";

export interface ParameterConfiguration<P> {revision:number;parameters:P;updatedAt:string|null;updatedBy:string|null}
export interface ParameterEditorOptions<P> {
 endpoint:string;
 defaults:Readonly<P>;
 read:(raw:unknown)=>ParameterConfiguration<P>;
 toDraft:(parameters:Readonly<P>)=>Record<string,string|boolean>;
 validate:(draft:Record<string,string|boolean>)=>P;
 validationMessage:string;
 savedMessage:string;
 notify:()=>void;
}
const requestMessage=(status:number)=>status===409?"\u914d\u7f6e\u5df2\u53d8\u5316\uff0c\u8bf7\u91cd\u65b0\u52a0\u8f7d\u540e\u4fdd\u5b58\u3002":status===401?"\u8bf7\u767b\u5f55\u540e\u7ef4\u62a4\u5206\u6790\u53c2\u6570\u3002":status===403?"\u6ca1\u6709\u5206\u6790\u53c2\u6570\u7ef4\u62a4\u6743\u9650\u3002":"\u53c2\u6570\u6682\u65f6\u4e0d\u53ef\u7528\uff0c\u8bf7\u91cd\u8bd5\u3002";

// Only the editor lifecycle is shared; each domain retains its validator and API.
export function useParameterEditor<P>(options:ParameterEditorOptions<P>) {
 const [configuration,setConfiguration]=useState<ParameterConfiguration<P>|null>(null),[draft,setDraft]=useState<Record<string,string|boolean>|null>(null),[canEdit,setCanEdit]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const inFlight=useRef(false),mounted=useRef(false),epoch=useRef(0);
 const load=useCallback(async(signal?:AbortSignal)=>{
  if(inFlight.current)return;
  const request=++epoch.current;
  inFlight.current=true;setBusy(true);setError("");setNotice("");
  try {
   const response=await fetch(options.endpoint,{cache:"no-store",signal});
   if(!response.ok)throw Error(requestMessage(response.status));
   const body=await response.json(),next=options.read(body.configuration);
   if(signal?.aborted||!mounted.current||request!==epoch.current)return;
   setConfiguration(next);setDraft(options.toDraft(next.parameters));setCanEdit(body.canEdit===true);
  } catch(cause) {
   if(!signal?.aborted&&mounted.current&&request===epoch.current){setCanEdit(false);setError(cause instanceof Error?cause.message:requestMessage(503));}
  } finally {if(request===epoch.current){inFlight.current=false;if(!signal?.aborted&&mounted.current)setBusy(false);}}
 },[options]);
 useEffect(()=>{mounted.current=true;const controller=new AbortController();void load(controller.signal);return()=>{mounted.current=false;epoch.current++;inFlight.current=false;controller.abort();};},[load]);
 const dirty=!!draft&&!!configuration&&JSON.stringify(draft)!==JSON.stringify(options.toDraft(configuration.parameters));
 const change=(key:string,value:string|boolean)=>{if(busy||!canEdit)return;setDraft(previous=>previous?{...previous,[key]:value}:previous);setNotice("");};
 const cancel=()=>{if(configuration&&!busy){setDraft(options.toDraft(configuration.parameters));if(canEdit)setError("");setNotice("");}};
 const reset=()=>{if(!busy&&canEdit){setDraft(options.toDraft(options.defaults));setError("");setNotice("\u5df2\u586b\u5165\u9ed8\u8ba4\u503c\uff0c\u4fdd\u5b58\u540e\u751f\u6548\u3002");}};
 async function save(){
  if(!configuration||!draft||!canEdit||inFlight.current||!dirty)return;
  let parameters:P;
  setError("");setNotice("");
  try {parameters=options.validate(draft);} catch {setError(options.validationMessage);return;}
  inFlight.current=true;setBusy(true);
  try {
   const response=await fetch(options.endpoint,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({revision:configuration.revision,parameters})});
   if(!response.ok){if([401,403,409].includes(response.status))setCanEdit(false);throw Error(response.status===400?options.validationMessage:requestMessage(response.status));}
   const next=options.read(await response.json());
   if(!mounted.current)return;
   setConfiguration(next);setDraft(options.toDraft(next.parameters));setNotice(options.savedMessage);options.notify();
  } catch(cause) {if(mounted.current)setError(cause instanceof Error?cause.message:requestMessage(503));}
  finally {inFlight.current=false;if(mounted.current)setBusy(false);}
 }
 return {configuration,draft,canEdit,busy,error,notice,dirty,change,cancel,reset,save,reload:()=>void load()};
}
