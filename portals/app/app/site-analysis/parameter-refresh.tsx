"use client";
import {useEffect,useRef} from "react";
import {useRouter} from "next/navigation";
import {readMonitoringConfiguration} from "../domains/monitoring/parameters";
import {readCapacityConfiguration} from "../domains/capacity/parameters";
import {readVerificationConfiguration} from "../domains/usage-verification/parameters";
type ParameterKind="monitoring"|"capacity"|"verification";
const parameterEvent=(kind:ParameterKind)=>"bsmoss-"+kind+"-parameters-changed";
export function notifyAnalysisParameters(kind:ParameterKind){const event=parameterEvent(kind);window.dispatchEvent(new Event(event));if(typeof BroadcastChannel!=="undefined"){const channel=new BroadcastChannel(event);channel.postMessage("updated");channel.close();}}
export default function AnalysisParameterRefresh({kind,revision}:{kind:ParameterKind;revision:number}){
 const event=parameterEvent(kind),readConfiguration=kind==="monitoring"?readMonitoringConfiguration:kind==="verification"?readVerificationConfiguration:readCapacityConfiguration;
 const router=useRouter(),current=useRef(revision);current.current=revision;
 useEffect(()=>{const abort=new AbortController();let busy=false;
  const refresh=async()=>{if(busy||document.visibilityState!=="visible")return;busy=true;try{const response=await fetch("/api/"+kind+"-parameters",{cache:"no-store",signal:abort.signal});if(response.ok&&readConfiguration(await response.json()).revision!==current.current)router.refresh();}catch{/* A read failure must not replace the server-assessed configuration. */}finally{busy=false;}};
  const changed=()=>void refresh(),channel=typeof BroadcastChannel!=="undefined"?new BroadcastChannel(event):null;
  if(channel)channel.onmessage=changed;window.addEventListener(event,changed);window.addEventListener("focus",changed);document.addEventListener("visibilitychange",changed);const timer=setInterval(changed,60000);void refresh();
  return()=>{abort.abort();clearInterval(timer);channel?.close();window.removeEventListener(event,changed);window.removeEventListener("focus",changed);document.removeEventListener("visibilitychange",changed);};
 },[router,event,kind,readConfiguration]);return null;
}
