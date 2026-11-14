"use client";
import {useState} from "react";
import {Button,Label,Select,SelectTrigger,SelectValue,SelectContent,SelectItem,Popover,PopoverContent,PopoverTrigger} from "@vxture/design-system";
import {useOperatorNames} from "../portal/operator-identities";
import OperatorIdentity from "../portal/operator-identity";
import ResetButton from "../portal/reset-button";
import FilterButton from "../portal/filter-button";
import {DEFAULT_SITE_QUERY,type SiteQuery} from "../domains/site-registry/rules";
import {sceneNames,siteTypeNames} from "./labels";
type Filters=Pick<SiteQuery,"operator"|"scene"|"siteType"|"maintenance"|"direction">;
const values=(q:Filters):Filters=>({operator:q.operator,scene:q.scene,siteType:q.siteType,maintenance:q.maintenance,direction:q.direction});
export default function SiteFilters({query,onApply}:{query:SiteQuery;onApply:(patch:Filters)=>void}){
 const names=useOperatorNames(),[open,setOpen]=useState(false),[draft,setDraft]=useState<Filters>(()=>values(query));
 const count=[query.siteType,query.scene,query.operator,query.maintenance].filter(v=>v!=="all").length;
 function choice(key:keyof Filters,label:string,options:Record<string,string>){
  return <div className="flex min-w-0 flex-col gap-xs"><Label htmlFor={"asset-filter-"+key}>{label}</Label><Select value={draft[key]} onValueChange={value=>setDraft({...draft,[key]:value})}><SelectTrigger id={"asset-filter-"+key} aria-label={label} className="h-control-xl text-body font-normal"><SelectValue/></SelectTrigger><SelectContent className="site-analysis-select-options">{Object.entries(options).map(([code,name])=><SelectItem key={code} value={code}>{key==="operator"&&code!=="all"?<OperatorIdentity code={code}/>:name}</SelectItem>)}</SelectContent></Select></div>;
 }
 return <Popover open={open} onOpenChange={next=>{if(next)setDraft(values(query));setOpen(next);}}>
  <PopoverTrigger asChild><FilterButton count={count} className="h-control-xl text-body font-normal" aria-label={"\u53f0\u8d26\u7b5b\u9009"}/></PopoverTrigger>
  <PopoverContent width="xl" align="end" className="site-analysis-filter-panel" aria-label={"\u53f0\u8d26\u7b5b\u9009\u6761\u4ef6"}>
   <div className="flex min-w-0 flex-col gap-md"><h3 className="text-label font-semibold">{"\u7ad9\u5740\u7b5b\u9009"}</h3><div className="grid grid-cols-2 gap-md">
    {choice("siteType","\u7ad9\u70b9\u7c7b\u578b",siteTypeNames)}{choice("scene","\u4e1a\u52a1\u573a\u666f",{all:"\u5168\u90e8",...sceneNames})}
    {choice("operator","\u5165\u9a7b\u8fd0\u8425\u5546",Object.fromEntries(["all","mobile","telecom","unicom","broadcast","other"].map(code=>[code,names[code]])))}
    {choice("maintenance","\u8865\u5145\u8d44\u6599",{all:"\u5168\u90e8",maintained:"\u5df2\u7ef4\u62a4",unmaintained:"\u672a\u7ef4\u62a4"})}
    {choice("direction","\u540d\u79f0\u6392\u5e8f",{asc:"\u5347\u5e8f",desc:"\u964d\u5e8f"})}
   </div><div className="flex items-center justify-between gap-sm border-t border-border pt-md"><ResetButton label={"\u6e05\u7a7a\u7b5b\u9009\u6761\u4ef6"} onClick={()=>setDraft(values(DEFAULT_SITE_QUERY))}/><Button className="h-control-xl text-body font-normal" onClick={()=>{onApply(draft);setOpen(false);}}>{"\u5e94\u7528\u7b5b\u9009"}</Button></div></div>
  </PopoverContent>
 </Popover>;
}
