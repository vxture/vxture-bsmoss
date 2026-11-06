"use client";
import {createContext,useContext,type ReactNode} from 'react';
import {Button,Icon} from '@vxture/design-system';
import {carryInvestigation,keepInvestigation,type Investigation} from './investigation-links';
const Context=createContext<Investigation|undefined>(undefined);
export function InvestigationProvider({journey,children}:{journey?:Investigation;children:ReactNode}){return <Context.Provider value={journey}>{children}</Context.Provider>;}
export const useInvestigation=()=>useContext(Context);
export function useInvestigationLinks(origin:string){const j=useInvestigation();return {carry:(href:string)=>carryInvestigation(href,origin,j),keep:(href:string)=>keepInvestigation(href,j),journey:j};}
export function InvestigationReturn({source,compact=false,description}:{description?:string;source:Investigation['source'];compact?:boolean}){
 const j=useInvestigation();if(!j&&source!=='uv')return null;
 return <div data-investigation className="flex min-w-0 flex-wrap items-center gap-sm text-body-small text-muted-foreground">
  {j&&<Button asChild variant="ghost" size="sm"><a href={j.href} {...(j.href.startsWith('/product-preview?')?{target:'_blank',rel:'noopener noreferrer'}:{})}><Icon name="arrow-left" size="sm"/>{j.label}</a></Button>}
  <span className={compact?"hidden xl:inline":undefined} title={source==='snapshot'?"\u7ad9\u7f51\u5feb\u7167\u6765\u6e90\uff1b\u5173\u8054\u8c03\u67e5\u4e0d\u7b49\u540c\u4e8e\u539f\u6838\u9a8c\u8bc1\u636e":undefined}>{description??(compact?"\u7ad9\u7f51\u5feb\u7167":source==='uv'?'\u72ec\u7acb\u6838\u9a8c\u573a\u666f\u5e93\uff1b\u4e0e\u7ad9\u7f51\u5feb\u7167\u3001\u7ecf\u8425\u5386\u53f2\u5206\u5f00\u3002':j?.source==='uv'?'\u5173\u8054\u8c03\u67e5\uff1a\u5f53\u524d\u6765\u6e90\u4e0d\u540c\u4e8e\u539f\u6838\u9a8c\uff0c\u539f\u91cf\u4e0e\u7ed3\u8bba\u4ecd\u4ee5\u539f\u6838\u9a8c\u4f9d\u636e\u4e3a\u51c6\u3002':source==='history'?'\u7ecf\u8425\u5386\u53f2\u6765\u6e90 \u00b7 \u6309\u6240\u9009\u5468\u671f\u5206\u6790':'\u7ad9\u7f51\u5feb\u7167\u6765\u6e90 \u00b7 \u6309\u9875\u9762\u5468\u671f\u8c03\u67e5')}</span>
 </div>;
}
