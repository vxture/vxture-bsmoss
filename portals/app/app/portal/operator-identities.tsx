"use client";
import {createContext,useCallback,useContext,useEffect,useMemo,useState,type ReactNode} from "react";
import {defaultCatalog,PARTY_CODES,readCatalog,type OperatorIdentityCatalog} from "../domains/operator-identities/rules";
const Context=createContext<OperatorIdentityCatalog>(defaultCatalog());
export const IDENTITY_CHANGE_EVENT="bsmoss-operator-identities-changed";
export function notifyIdentityChange(){window.dispatchEvent(new Event(IDENTITY_CHANGE_EVENT));if(typeof BroadcastChannel!=="undefined"){const channel=new BroadcastChannel(IDENTITY_CHANGE_EVENT);channel.postMessage("updated");channel.close();}}
export function OperatorIdentitiesProvider({children}:{children:ReactNode}){
  const [catalog,setCatalog]=useState(defaultCatalog);
  const load=useCallback(async(signal?:AbortSignal)=>{try{const response=await fetch("/api/operator-identities",{cache:"no-store",signal});if(response.ok)setCatalog(readCatalog(await response.json()));else if(response.status===401||response.status===403)setCatalog(defaultCatalog());}catch{/* Keep the last successfully loaded display configuration. */}},[]);
  useEffect(()=>{
    const abort=new AbortController();void load(abort.signal);
    const refresh=()=>{if(document.visibilityState==="visible")void load(abort.signal);};
    const channel=typeof BroadcastChannel!=="undefined"?new BroadcastChannel(IDENTITY_CHANGE_EVENT):null;
    if(channel)channel.onmessage=refresh;
    window.addEventListener(IDENTITY_CHANGE_EVENT,refresh);window.addEventListener("focus",refresh);document.addEventListener("visibilitychange",refresh);
    const interval=setInterval(refresh,60000);
    return()=>{abort.abort();clearInterval(interval);channel?.close();window.removeEventListener(IDENTITY_CHANGE_EVENT,refresh);window.removeEventListener("focus",refresh);document.removeEventListener("visibilitychange",refresh);};
  },[load]);
  return <Context.Provider value={catalog}>{children}</Context.Provider>;
}
export function useOperatorCatalog(){return useContext(Context);}
// Existing analysis sources accept five operator codes. Catalog-only additions
// must not create unsupported query choices before source relationships exist.
export function useOperatorNames(includeAll=true){const catalog=useOperatorCatalog();return useMemo(()=>Object.fromEntries([...catalog.items.filter(item=>item.code!=="tower"&&PARTY_CODES.some(code=>code===item.code)).map(item=>[item.code,item.shortName]),...(includeAll?[["all","\u5168\u90e8\u8fd0\u8425\u5546"]]:[])]) as Record<string,string>,[catalog,includeAll]);}
