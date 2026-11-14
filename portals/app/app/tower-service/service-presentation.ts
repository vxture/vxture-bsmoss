'use client';
import {useEffect,useState,type Dispatch,type SetStateAction} from 'react';

// Tab-local view preferences do not become snapshot facts or shared filters.
export function useServicePresentation<T>(key:string,initial:T):[T,Dispatch<SetStateAction<T>>]{
 const [value,setValue]=useState(initial),[ready,setReady]=useState(false);
 useEffect(()=>{try{const saved=sessionStorage.getItem(key);if(saved!==null)setValue(JSON.parse(saved));}catch{}setReady(true);},[key]);
 useEffect(()=>{if(ready)try{sessionStorage.setItem(key,JSON.stringify(value));}catch{}},[key,value,ready]);
 return [value,setValue];
}
export function saveServicePosition(href:string){
 const content=document.querySelector('.product-workspace-content');
 try{sessionStorage.setItem('service-position:'+href,String(content?.scrollTop??0));}catch{}
}
export function useServicePosition(href:string){
 useEffect(()=>{let frame=0;try{const saved=sessionStorage.getItem('service-position:'+href);if(saved!==null)frame=requestAnimationFrame(()=>{const content=document.querySelector('.product-workspace-content');if(content)content.scrollTop=Number(saved);sessionStorage.removeItem('service-position:'+href);});}catch{}return ()=>cancelAnimationFrame(frame);},[href]);
}
