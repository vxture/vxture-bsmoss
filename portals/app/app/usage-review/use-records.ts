"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {indexedReviewStore} from '../domains/usage-verification/indexeddb-store';
import {submitReview,type ReviewStore,type ReviewRecords} from '../domains/usage-verification/event-service';
import type {ReviewCase} from '../domains/usage-verification/demo';
import type {ReviewCommand} from '../domains/usage-verification/events';
export function useReviewRecords(dataset:string,initialSession?:string){
 const [data,setData]=useState<ReviewRecords>(),[selected,setSelected]=useState(initialSession),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const store=useRef<ReviewStore|null>(null),selectedRef=useRef(selected),alive=useRef(true),gate=useRef(false),channel=useRef<BroadcastChannel|null>(null);
 selectedRef.current=selected;
 const refresh=useCallback(async()=>{try{if(!store.current)return;const value=await store.current.read(dataset,selectedRef.current);if(alive.current){setData(value);setError('');}}catch(e){if(alive.current)setError(e instanceof Error?e.message:'review_storage_unavailable');}},[dataset]);
 useEffect(()=>{
  alive.current=true;let disposed=false,owned:ReviewStore|undefined;
  indexedReviewStore().then(async s=>{owned=s;if(disposed){s.close();return;}store.current=s;await refresh();}).catch(()=>{if(!disposed)setError('review_storage_unavailable');});
  try{channel.current=new BroadcastChannel('bsmoss-demo-review-v1');channel.current.onmessage=()=>{void refresh();};}catch{}
  const focus=()=>{void refresh();};window.addEventListener('focus',focus);
  return()=>{disposed=true;alive.current=false;store.current=null;owned?.close();channel.current?.close();channel.current=null;window.removeEventListener('focus',focus);};
 },[refresh]);
 useEffect(()=>{void refresh();},[selected,refresh]);
 const mutate=async<T,>(run:(s:ReviewStore)=>Promise<T>)=>{
  if(!store.current||gate.current)throw Error('review_storage_unavailable');gate.current=true;setBusy(true);
  try{const result=await run(store.current);channel.current?.postMessage({dataset});await refresh();return result;}
  finally{gate.current=false;if(alive.current)setBusy(false);}
 };
 const perform=(catalog:readonly ReviewCase[],input:ReviewCommand)=>mutate(s=>{
  if(!data||error||selectedRef.current&&selectedRef.current!==data.active)throw Error('review_session_archived');
  return submitReview(s,dataset,selectedRef.current??data.active,catalog,input);
 });
 const newSession=()=>mutate(async s=>{const id=await s.newSession(dataset);selectedRef.current=undefined;setSelected(undefined);return id;});
 return {data,selected,select:setSelected,error,busy,refresh,perform,newSession,readOnly:!data||!!error||busy||!!selected&&selected!==data.active};
}
export type LocalReviewRecords=ReturnType<typeof useReviewRecords>;
