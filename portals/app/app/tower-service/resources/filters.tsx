"use client";
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {Button,Label,Select,SelectTrigger,SelectValue,SelectContent,SelectItem,Popover,PopoverContent,PopoverTrigger} from '@vxture/design-system';
import ResetButton from '../../portal/reset-button';
import FilterButton from '../../portal/filter-button';
import type {AnalysisHref} from '../../site-analysis/workspace';
import {sceneNames,siteTypeNames} from '../../sites/labels';
import {facilities} from './vocabulary';

type Filters={siteType:string;scene:string;facility:string};
const defaults:Filters={siteType:'all',scene:'all',facility:'all'};
const choices:{key:keyof Filters;label:string;options:Record<string,string>}[]=[
 {key:'siteType',label:'\u7ad9\u5740\u7c7b\u578b',options:{...siteTypeNames,unknown:'\u7c7b\u578b\u672a\u63d0\u4f9b'}},
 {key:'scene',label:'\u7ad9\u5740\u573a\u666f',options:{all:'\u5168\u90e8\u573a\u666f',...sceneNames,unknown:'\u573a\u666f\u672a\u63d0\u4f9b'}},
 {key:'facility',label:'\u8bbe\u65bd\u5b50\u7c7b',options:{all:'\u5168\u90e8\u8bbe\u65bd',...facilities}}
];
export default function ResourceFilters({value,href}:{value:Filters;href:AnalysisHref}){
 const router=useRouter(),[open,setOpen]=useState(false),[draft,setDraft]=useState<Filters>(()=>({siteType:value.siteType,scene:value.scene,facility:value.facility}));
 const count=choices.filter(({key})=>value[key]!=='all').length;
 return <Popover open={open} onOpenChange={next=>{if(next)setDraft({siteType:value.siteType,scene:value.scene,facility:value.facility});setOpen(next);}}>
 <PopoverTrigger asChild><FilterButton count={count} className="h-control-xl text-body font-normal" aria-label={'\u7ad9\u5740\u660e\u7ec6\u7b5b\u9009'}/></PopoverTrigger>
 <PopoverContent width="xl" align="end" className="site-analysis-filter-panel" aria-label={'\u7ad9\u5740\u660e\u7ec6\u7b5b\u9009\u6761\u4ef6'}><div className="flex min-w-0 flex-col gap-md"><h3 className="text-label font-semibold">{'\u7ad9\u5740\u7b5b\u9009'}</h3><div className="grid grid-cols-2 gap-md">{choices.map(({key,label,options})=><div key={key} className="flex min-w-0 flex-col gap-xs"><Label htmlFor={'resource-filter-'+key}>{label}</Label><Select value={draft[key]} onValueChange={v=>setDraft(current=>({...current,[key]:v}))}><SelectTrigger id={'resource-filter-'+key} aria-label={label} className="h-control-xl text-body font-normal"><SelectValue/></SelectTrigger><SelectContent className="site-analysis-select-options">{Object.entries(options).map(([code,name])=><SelectItem key={code} value={code}>{name}</SelectItem>)}</SelectContent></Select></div>)}</div><div className="flex items-center justify-between gap-sm border-t border-border pt-md"><ResetButton label={'\u6e05\u7a7a\u7b5b\u9009\u6761\u4ef6'} onClick={()=>setDraft({...defaults})}/><Button type="button" className="h-control-xl text-body font-normal" onClick={()=>{router.push(href({...draft,page:1}),{scroll:false});setOpen(false);}}>{'\u5e94\u7528\u7b5b\u9009'}</Button></div></div></PopoverContent>
 </Popover>;
}
