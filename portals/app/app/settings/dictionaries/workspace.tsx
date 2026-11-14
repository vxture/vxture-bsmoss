"use client";
import {useRef,useState,type MouseEvent} from "react";
import {useRouter} from "next/navigation";
import {DataTable,Dialog,DialogContent,DialogTitle,DialogDescription,EmptyState,Icon,InputGroup,InputGroupAddon,InputGroupInput,PanelCard,Pagination,SegmentedControl,Select,SelectContent,SelectItem,SelectTrigger,SelectValue,ShellPageContainer,StatusBadge,TableTitleCell,type DataTableColumn} from "@vxture/design-system";
import PageHeading from "../../portal/page-heading";
import ResetButton from "../../portal/reset-button";
import {ClassificationDetail,MetricDetail} from "./details";
import {dictionaryGroups,dictionaryRows,word,type DictionaryRow,type DictionaryView} from "./model";
import "../../site-analysis/site-analysis.css";
import "../../portal/pagination.css";

export default function DictionaryWorkspace({view}:{view:DictionaryView}) {
 const router=useRouter(),[search,setSearch]=useState(""),[draft,setDraft]=useState(""),[group,setGroup]=useState("all"),[page,setPage]=useState(1),[size,setSize]=useState(20),[selection,setSelection]=useState<string|null>(null);
 const composing=useRef(false),classifications=view==="classifications";
 const rows=dictionaryRows(view,search,group),pages=Math.max(1,Math.ceil(rows.length/size)),current=Math.min(page,pages),visible=rows.slice((current-1)*size,current*size),selected=visible.find(row=>row.id===selection);
 const updateSearch=(value:string)=>{setSearch(value);setPage(1);setSelection(null);};
 const open=(row:DictionaryRow)=>setSelection(previous=>previous===row.id?null:row.id);
 const rowClick=(event:MouseEvent)=>{const target=event.target as HTMLElement;if(target.closest("button,a"))return;const row=target.closest("tbody > tr");if(!row)return;const entry=visible[Array.from(row.parentElement!.children).indexOf(row)];if(entry)open(entry);};
 const columns:DataTableColumn<DictionaryRow>[]=[
  {id:"name",header:"\u540d\u79f0",cell:row=><TableTitleCell className="site-analysis-site-title" icon={classifications?"building":"list-checks"} title={row.name} description={row.code} onTitleClick={()=>open(row)}/>},
  {id:"group",header:classifications?"\u5206\u7c7b\u7ef4\u5ea6":"\u6307\u6807\u5206\u7c7b",align:"center",cell:row=>row.group},
  {id:"definition",header:classifications?"\u5206\u7c7b\u5b9a\u4e49":"\u57fa\u672c\u5355\u4f4d",align:classifications?"left":"center",cell:row=><span className={classifications?"whitespace-normal":"whitespace-nowrap"}>{row.summary}</span>},
  ...(classifications?[]:[
   {id:"version",header:"\u5b9a\u4e49\u7248\u672c",align:"center" as const,cell:(row:DictionaryRow)=><span className="whitespace-nowrap text-body-small text-muted-foreground">{row.version}</span>},
   {id:"lifecycle",header:"\u63a5\u5165\u72b6\u6001",align:"center" as const,cell:(row:DictionaryRow)=><StatusBadge tone="neutral" size="sm">{word(row.metric!.lifecycle)}</StatusBadge>},
  ]),
 ];
 return <ShellPageContainer className="site-analysis-page gap-lg">
  <PageHeading icon="list-checks" title={"\u4e1a\u52a1\u5b57\u5178"} description={"\u67e5\u9605\u7ad9\u5740\u5206\u7c7b\u4e0e\u6307\u6807\u5b9a\u4e49"} context={<span>{"\u53ea\u8bfb\u89c4\u8303"}</span>}/>
  <PanelCard className="site-analysis-table-panel" title={classifications?"\u7ad9\u5740\u5206\u7c7b":"\u6307\u6807\u5b57\u5178"} icon={classifications?"building":"list-checks"}>
   <div className="site-analysis-table-tools site-analysis-table-tools-single-line site-analysis-action-row">
    <div className="site-analysis-table-filters"><div className="site-analysis-occupancy-scroll"><SegmentedControl size="md" className="site-analysis-occupancy site-analysis-occupancy-auto [--analysis-facet-columns:2]" ariaLabel={"\u4e1a\u52a1\u5b57\u5178\u7c7b\u522b"} value={view} onChange={next=>router.push("/settings/dictionaries?view="+next,{scroll:false})} items={[{value:"classifications",label:<span className="site-analysis-occupancy-label"><Icon name="building" size="sm"/>{"\u7ad9\u5740\u5206\u7c7b"}</span>},{value:"metrics",label:<span className="site-analysis-occupancy-label"><Icon name="list-checks" size="sm"/>{"\u6307\u6807\u5b57\u5178"}</span>}]}/></div></div>
    <form className="site-analysis-search" role="search" onSubmit={event=>{event.preventDefault();if(!composing.current)updateSearch(draft);}}>
     <InputGroup className="site-analysis-search-field"><InputGroupAddon><Icon name="search" size="sm"/></InputGroupAddon><InputGroupInput aria-label={"\u641c\u7d22\u5b57\u5178"} placeholder={"\u540d\u79f0\uff0f\u7f16\u7801\uff0f\u5173\u952e\u8bcd"} value={draft} onChange={event=>{setDraft(event.target.value);if(!composing.current)updateSearch(event.target.value);}} onCompositionStart={()=>{composing.current=true;}} onCompositionEnd={event=>{composing.current=false;updateSearch(event.currentTarget.value);}}/></InputGroup>
     <Select value={group} onValueChange={value=>{setGroup(value);setPage(1);setSelection(null);}}><SelectTrigger aria-label={"\u5b57\u5178\u5206\u7c7b"} className="h-control-xl w-auto gap-sm text-body"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">{"\u5168\u90e8\u5206\u7c7b"}</SelectItem>{dictionaryGroups(view).map(item=><SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select>
     <ResetButton variant="outline" label={"\u91cd\u7f6e\u5b57\u5178\u7b5b\u9009\u4e0e\u67e5\u8be2"} onClick={()=>{setDraft("");setGroup("all");updateSearch("");}}/>
    </form>
   </div>
   <div className="site-analysis-table min-w-0 overflow-x-auto" onClick={rowClick}><DataTable rows={visible} rowKey={row=>row.id} columns={columns} indexStart={(current-1)*size+1} empty={<EmptyState title={"\u6ca1\u6709\u5339\u914d\u5b9a\u4e49"} description={"\u8bf7\u8c03\u6574\u5206\u7c7b\u6216\u641c\u7d22\u6761\u4ef6"}/>}/></div>
   <Pagination className="product-pagination site-analysis-pagination site-analysis-action-row" page={current} pageCount={pages} total={rows.length} countLabel={"\u5171\u8ba1\uff1a"+rows.length+" \u9879\u5b9a\u4e49"} pageSize={size} pageSizeOptions={[10,20,50]} pageSizeLabel={"\u6bcf\u9875\u663e\u793a\u6570\u91cf"} pageSizeOptionTemplate={"\u6bcf\u9875 {size} \u6761"} onPageSizeChange={value=>{setSize(value);setPage(1);setSelection(null);}} onPageChange={value=>{setPage(value);setSelection(null);}} firstLabel={"\u9996\u9875"} previousLabel={"\u4e0a\u4e00\u9875"} nextLabel={"\u4e0b\u4e00\u9875"} lastLabel={"\u672b\u9875"}/>
  </PanelCard>
  <Dialog modal={false} open={!!selected} onOpenChange={open=>{if(!open)setSelection(null);}}><DialogContent className="site-analysis-detail" width="sm" onOpenAutoFocus={event=>event.preventDefault()} onInteractOutside={event=>{if(event.target instanceof Element&&event.target.closest(".site-analysis-table tbody > tr"))event.preventDefault();}}>
   <div className="pr-xl"><DialogTitle>{selected?.name}</DialogTitle><DialogDescription>{selected?.code}</DialogDescription></div>
   {selected?.definition&&<ClassificationDetail key={selected.id} definition={selected.definition}/>}
   {selected?.metric&&<MetricDetail key={selected.id} metric={selected.metric}/>}
  </DialogContent></Dialog>
 </ShellPageContainer>;
}
