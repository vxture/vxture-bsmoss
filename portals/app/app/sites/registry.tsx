"use client";
import { ViewModeSwitch } from "@vxture/design-system";
import {useEffect,useRef,useState,useTransition,type MouseEvent} from "react";
import {useRouter} from "next/navigation";
import {Button,DataTable,Dialog,DialogContent,DialogTitle,DialogDescription,Icon,InputGroup,InputGroupAddon,InputGroupInput,ListCard,ListCardGrid,PanelCard,Pagination,TableTitleCell,type DataTableColumn} from "@vxture/design-system";
import ActionMenu from '../portal/action-menu';
import type {AssetRegistry,AssetDetail,AssetRow} from "../domains/site-registry/asset-model";
import {DEFAULT_SITE_QUERY,siteDetailHref,siteListHref,siteQueryString,type SiteQuery} from "../domains/site-registry/rules";
import {formatDataTime} from "../domains/data-updates/rules";
import PageHeading from "../portal/page-heading";
import ResetButton from "../portal/reset-button";
import OperatorIdentity from "../portal/operator-identity";
import {InvestigationReturn,useInvestigationLinks} from "../portal/investigation";
import {SiteDetailContent} from "./dossier";
import SiteFilters from "./filters";
import {n,sceneNames,siteTypeNames} from "./labels";
import "../site-analysis/site-analysis.css";
import "../portal/pagination.css";
function Inspection({entry,edit,section,query,deep}:{entry:AssetRow;edit:boolean;section:"overview"|"devices";query:SiteQuery;deep:string}){
 const [data,setData]=useState<AssetDetail|null>(null),[error,setError]=useState(false),[epoch,setEpoch]=useState(0),key=siteQueryString(query);
 useEffect(()=>{
  const controller=new AbortController();setData(null);setError(false);
  void fetch("/api/product-preview/site-registry/"+encodeURIComponent(entry.site.id)+"?"+key,{signal:controller.signal,cache:"no-store"}).then(async response=>{if(!response.ok)throw Error("detail_failed");const result=await response.json() as AssetDetail;if(result.kind!=="site-assets")throw Error("invalid_detail");return result;}).then(result=>{if(!controller.signal.aborted)setData(result);}).catch(()=>{if(!controller.signal.aborted)setError(true);});
  return ()=>controller.abort();
 },[entry.site.id,key,epoch]);
 return <><div className="flex items-center justify-between gap-md"><span className="text-body-small text-muted-foreground">{entry.site.cityName+" / "+entry.site.countyName}</span><Button asChild variant="ghost" className="h-control-xl text-body"><a href={deep}>{"\u5b8c\u6574\u6863\u6848"}<Icon name="arrow-right" size="sm"/></a></Button></div>
  {!data&&!error&&<p role="status" className="text-body-small text-muted-foreground">{"\u6b63\u5728\u8bfb\u53d6\u8d44\u6599\u2026"}</p>}
  {error&&<div role="alert" className="flex items-center justify-between gap-md"><p>{"\u6682\u65f6\u65e0\u6cd5\u8bfb\u53d6\u8d44\u6599"}</p><Button variant="outline" className="h-control-xl text-body" onClick={()=>setEpoch(n=>n+1)}>{"\u91cd\u8bd5"}</Button></div>}
  {data&&<SiteDetailContent data={data} compact initialSection={section} initialEdit={edit}/>}
 </>;
}
export default function SiteRegistry({data}:{data:AssetRegistry}){
 const router=useRouter(),q=data.query,[pending,start]=useTransition(),queryKey=siteQueryString(q);
 const [search,setSearch]=useState(q.search),[view,setView]=useState<"list"|"cards">("list"),[selected,setSelected]=useState<{entry:AssetRow;edit:boolean;section:"overview"|"devices"}|null>(null);
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null),composing=useRef(false),draft=useRef<string|null>(null),current=useRef<SiteQuery>(q);current.current=q;
 const {keep,carry}=useInvestigationLinks(siteListHref(q));
 const cancel=()=>{if(timer.current!==null){clearTimeout(timer.current);timer.current=null;}};
 useEffect(()=>{if(draft.current===null||draft.current===q.search){draft.current=null;setSearch(q.search);}setSelected(null);},[queryKey]);
 useEffect(()=>()=>{if(timer.current!==null)clearTimeout(timer.current);},[]);
 const navigate=(patch:Partial<SiteQuery>)=>{cancel();setSelected(null);start(()=>router.replace(keep(siteListHref(current.current,{search:draft.current??current.current.search,page:1,...patch})),{scroll:false}));};
 const commit=(value:string)=>navigate({search:value});
 const queue=(value:string)=>{cancel();if(!composing.current)timer.current=setTimeout(()=>commit(value),300);};
 const entries=data.rows;
 const open=(entry:AssetRow,edit=false,section:"overview"|"devices"="overview")=>setSelected(previous=>previous?.entry.id===entry.id&&previous.edit===edit&&previous.section===section?null:{entry,edit,section});
 const deep=(entry:AssetRow)=>carry(siteDetailHref(entry.site.id,q));
 const devices=(entry:AssetRow)=>open(entry,false,"devices");
 const menu=(entry:AssetRow)=><ActionMenu label={entry.name+"\u7684\u64cd\u4f5c"} items={[
  {id:"detail",label:"\u67e5\u770b\u8d44\u6599",icon:"search",onSelect:()=>open(entry)},
  ...(data.canMaintain?[{id:"maintain",label:"\u7ef4\u62a4\u8865\u5145\u8d44\u6599",icon:"edit" as const,onSelect:()=>open(entry,true)}]:[]),
  {id:"devices",label:"\u6240\u5c5e\u8bbe\u5907",icon:"stack" as const,onSelect:()=>devices(entry)},
  {id:"dossier",label:"\u7ad9\u5740\u6863\u6848",icon:"file-text",onSelect:()=>router.push(deep(entry))}
 ]}/>;
 const title=(entry:AssetRow)=><TableTitleCell className="site-analysis-site-title" icon="map-pin" title={entry.maintenance?.alias||entry.name} description={entry.code} onTitleClick={()=>router.push(deep(entry))}/>;
 const maintained=(entry:AssetRow)=><span className="whitespace-nowrap text-body-small text-muted-foreground">{formatDataTime(entry.maintenance?.updatedAt??null)}</span>;
 const columns:DataTableColumn<AssetRow>[]=[
  {id:"name",header:"\u7ad9\u5740",sortable:true,cell:title},
   {id:"region",header:"\u533a\u57df",cell:(entry:AssetRow)=><span className="whitespace-nowrap">{entry.site.cityName+" / "+entry.site.countyName}</span>},
   {id:"type",header:"\u7c7b\u578b\uff0f\u573a\u666f",align:"center",cell:(entry:AssetRow)=><div className="flex flex-col items-center gap-xs text-center"><span className="font-semibold whitespace-nowrap">{siteTypeNames[entry.site.siteType]}</span><span className="text-body-small text-muted-foreground whitespace-nowrap">{sceneNames[entry.site.profile]}</span></div>},
   {id:"operators",header:"\u5165\u9a7b\u8fd0\u8425\u5546",align:"center",cell:(entry:AssetRow)=><div className="flex items-center justify-center gap-sm whitespace-nowrap">{entry.site.operators.map(code=><OperatorIdentity key={code} code={code}/>)}</div>},
   {id:"devices",header:"\u8bbe\u5907",align:"center" as const,cell:(entry:AssetRow)=><Button variant="ghost" className="h-control-xl text-body font-normal tabular-nums" onClick={()=>devices(entry)}>{n(entry.deviceCount)}</Button>},
  {id:"maintained",header:"\u6700\u8fd1\u7ef4\u62a4",cell:maintained},
 ];
 const rowClick=(event:MouseEvent)=>{const target=event.target as HTMLElement;if(target.closest("button,a,[role=menuitem]"))return;const row=target.closest("tbody > tr");if(!row)return;const entry=entries[Array.from(row.parentElement!.children).indexOf(row)];if(entry)open(entry);};
 return <div className="site-analysis-page product-page-inset flex min-w-0 flex-col gap-lg" data-sites-mode="demo" aria-busy={pending}>
  <PageHeading icon="building" title={"\u7ad9\u5740\u7ba1\u7406"} description={"\u7ba1\u7406\u7ad9\u5740\u8d44\u6599\u3001\u8bbe\u5907\u5f52\u5c5e\u4e0e\u540c\u6b65\u7ef4\u62a4\u4fe1\u606f"} context={<span>{"\u8d44\u6599\u66f4\u65b0\u81f3 "}<time dateTime={data.source.through??undefined} className="tabular-nums">{formatDataTime(data.source.through)}</time></span>}/>
  <InvestigationReturn source="snapshot"/>
  <PanelCard className="site-analysis-table-panel" title={"\u7ad9\u5740\u53f0\u8d26"} icon="building">
   <div className="site-analysis-table-tools site-analysis-table-tools-single-line site-analysis-action-row">
    <div className="site-analysis-table-filters"><ViewModeSwitch className="site-analysis-view-switch" value={view} onChange={setView} ariaLabel={"\u53f0\u8d26\u5c55\u793a\u65b9\u5f0f"} labels={{list:"\u5217\u8868\u89c6\u56fe",cards:"\u5361\u7247\u89c6\u56fe"}}/>
    </div>
    <form className="site-analysis-search" role="search" onSubmit={event=>{event.preventDefault();if(!composing.current)commit(search);}}>
     <InputGroup className="site-analysis-search-field"><InputGroupAddon><Icon name="search" size="sm"/></InputGroupAddon><InputGroupInput aria-label={"\u641c\u7d22\u53f0\u8d26"} placeholder={"\u540d\u79f0\uff0f\u7f16\u7801\uff0f\u5730\u5740\uff0f\u5907\u6ce8"} value={search} onChange={event=>{draft.current=event.target.value;setSearch(event.target.value);queue(event.target.value);}} onCompositionStart={()=>{composing.current=true;cancel();}} onCompositionEnd={event=>{composing.current=false;queue(event.currentTarget.value);}}/></InputGroup>
     <SiteFilters query={q} onApply={patch=>navigate({...patch,search})}/>
     <ResetButton variant="outline" label={"\u91cd\u7f6e\u53f0\u8d26\u7b5b\u9009\u4e0e\u67e5\u8be2"} onClick={()=>{draft.current="";setSearch("");navigate({...DEFAULT_SITE_QUERY,view:q.view,city:q.city,county:q.county,pageSize:q.pageSize});}}/>
    </form>
   </div>
   {view==="list"?<div className="site-analysis-table min-w-0 overflow-x-auto" onClick={rowClick}><DataTable rows={entries} rowKey={entry=>entry.id} columns={columns} indexStart={(q.page-1)*q.pageSize+1} labels={{rowActions:"\u64cd\u4f5c"}} rowActions={menu} sort={{columnId:"name",direction:q.direction}} onSortChange={sort=>navigate({direction:sort.direction})} empty={<p className="py-lg text-body-small text-muted-foreground">{"\u6ca1\u6709\u5339\u914d\u7684\u8d44\u6599"}</p>}/></div>:<ListCardGrid className="site-analysis-card-grid">{entries.map(entry=><article key={entry.id} className="site-analysis-site-card" aria-label={entry.name} onClick={event=>{if(!(event.target as HTMLElement).closest("button,a,[role=menuitem]"))open(entry);}}>
    <ListCard className="site-analysis-card-surface" title={entry.maintenance?.alias||entry.name} description={entry.code} icon="map-pin" onTitleClick={()=>router.push(deep(entry))} actions={menu(entry)} meta={<div className="site-analysis-card-details">
     <div className="site-analysis-card-metrics"><span className="text-body-small text-muted-foreground">{siteTypeNames[entry.site.siteType]+" \u00b7 "+sceneNames[entry.site.profile]}</span><span className="site-analysis-card-resources">{"\u8bbe\u5907 "+n(entry.deviceCount)}</span></div>
     <p className="text-body-small text-muted-foreground">{"\u6700\u8fd1\u7ef4\u62a4 "+formatDataTime(entry.maintenance?.updatedAt??null)}</p>
     <div className="site-analysis-card-location"><Icon name="map-pin" size="sm"/><span>{entry.site.cityName+" / "+entry.site.countyName}</span></div>
    </div>}/>
   </article>)}</ListCardGrid>}
   {view==="cards"&&!entries.length&&<p className="py-lg text-body-small text-muted-foreground">{"\u6ca1\u6709\u5339\u914d\u7684\u8d44\u6599"}</p>}
   <Pagination className="product-pagination site-analysis-pagination site-analysis-action-row" page={q.page} pageCount={data.pages} total={data.count} countLabel={"\u5171\u8ba1\uff1a"+n(data.count)+" \u4e2a\u7ad9\u5740"} pageSize={q.pageSize} pageSizeOptions={[10,20,50,100]} pageSizeLabel={"\u6bcf\u9875\u663e\u793a\u6570\u91cf"} pageSizeOptionTemplate={"\u6bcf\u9875 {size} \u6761"} onPageSizeChange={pageSize=>navigate({pageSize})} onPageChange={page=>navigate({page})} firstLabel={"\u9996\u9875"} previousLabel={"\u4e0a\u4e00\u9875"} nextLabel={"\u4e0b\u4e00\u9875"} lastLabel={"\u672b\u9875"}/>
  </PanelCard>
  <Dialog modal={false} open={!!selected} onOpenChange={open=>{if(!open)setSelected(null);}}><DialogContent className="site-analysis-detail" width="sm" onOpenAutoFocus={event=>event.preventDefault()} onInteractOutside={event=>{const target=event.target;if(!(target instanceof Element))return;const selector=".site-analysis-table tbody > tr,.site-analysis-site-card",trigger=target.closest('[role="menu"]')?.getAttribute("aria-labelledby");if(target.closest(selector)||(trigger&&document.getElementById(trigger)?.closest(selector)))event.preventDefault();}}>
   <div className="pr-xl"><DialogTitle>{selected?.entry.name}</DialogTitle><DialogDescription>{selected?.entry.code}</DialogDescription></div>
   {selected&&<Inspection key={selected.entry.id+"-"+selected.edit+"-"+selected.section} entry={selected.entry} edit={selected.edit} section={selected.section} query={q} deep={deep(selected.entry)}/>}
  </DialogContent></Dialog>
 </div>;
}
