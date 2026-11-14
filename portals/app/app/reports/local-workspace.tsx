"use client";
import { ViewModeSwitch } from "@vxture/design-system";
import {useCallback,useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {Button,DataTable,EmptyState,Icon,InputGroup,InputGroupAddon,InputGroupInput,Pagination,PanelCard,SegmentedControl,TableTitleCell,Select,SelectTrigger,SelectValue,SelectContent,SelectItem,ListCard,ListCardGrid} from '@vxture/design-system';
import ActionMenu from '../portal/action-menu';
import PageHeading from '../portal/page-heading';
import CentreSwitch from './centre-switch';
import ResetButton from '../portal/reset-button';
import OperatorIdentity from '../portal/operator-identity';
import {useOperatorNames} from '../portal/operator-identities';
import {InvestigationReturn,useInvestigationLinks} from '../portal/investigation';
import {localReportStore} from './local-store';
import {filterLibrary,libraryHref,type LibraryQuery,type ReportFiles,type SavedReport} from './local-rules';
import ReportFileView from './file-view';
import {timeLabel} from '../usage-review/labels';
import '../site-analysis/site-analysis.css';
import '../portal/pagination.css';
type Row={saved:SavedReport;files:ReportFiles};
const periodNames:Record<string,string>={all:'\u5168\u90e8',day:'\u65e5\u62a5',week:'\u5468\u62a5',month:'\u6708\u62a5',history:'\u5386\u53f2\u5206\u6790'};
function download(row:Row,format:'html'|'json'){
 const url=URL.createObjectURL(new Blob([row.files[format]],{type:format==='html'?'text/html;charset=utf-8':'application/json;charset=utf-8'})),a=document.createElement('a');
 a.href=url;a.download='bsmoss-'+row.files.reportId+'-'+row.saved.digest.slice(0,12)+'.'+format;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export default function LocalReportWorkspace({query:q}:{query:LibraryQuery}){
 const names=useOperatorNames(),router=useRouter(),[rows,setRows]=useState<Row[]|null>(null),[error,setError]=useState(false),[page,setPage]=useState(1),[size,setSize]=useState(20),[search,setSearch]=useState(q.search),[view,setView]=useState<'list'|'cards'>('list');
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null),composing=useRef(false),epoch=useRef(0);
 const {keep}=useInvestigationLinks(libraryHref(q));
 const cancel=()=>{if(timer.current!==null){clearTimeout(timer.current);timer.current=null;}};
 const navigate=(patch:Partial<LibraryQuery>)=>{cancel();router.replace(keep(libraryHref(q,patch)),{scroll:false});};
 const read=useCallback(async()=>{const request=++epoch.current;let store;try{store=await localReportStore();const data=await store.read();if(request===epoch.current){setRows(data);setError(false);}}catch{if(request===epoch.current)setError(true);}finally{store?.close();}},[]);
 useEffect(()=>{setPage(1);setSearch(q.search);},[q.city,q.county,q.operator,q.period,q.search]);
 useEffect(()=>{void read();const reload=()=>void read();window.addEventListener('focus',reload);let channel:BroadcastChannel|undefined;try{channel=new BroadcastChannel('bsmoss-local-reports');channel.onmessage=reload;}catch{}
 return()=>{epoch.current++;cancel();window.removeEventListener('focus',reload);channel?.close();};},[read]);
 const queue=(value:string)=>{cancel();if(!composing.current)timer.current=setTimeout(()=>navigate({search:value,saved:undefined}),300);};
 const filtered=filterLibrary(rows??[],q),selected=q.saved?(rows??[]).find(r=>r.saved.digest===q.saved):undefined;
 const inScope=selected&&filterLibrary([selected],{...q,period:'all',search:''}).length===1;
 const versions=selected&&inScope?(rows??[]).filter(r=>r.files.familyKey===selected.files.familyKey).sort((a,b)=>b.saved.savedAt.localeCompare(a.saved.savedAt)):[];
 const pages=Math.max(1,Math.ceil(filtered.length/size)),current=Math.min(page,pages),visible=filtered.slice((current-1)*size,current*size);
 const open=(row:Row)=>navigate({saved:row.saved.digest});
 const newHref=keep('/reports/new?'+new URLSearchParams({city:q.city,county:q.county,operator:q.operator}));
 const controls=<Select value={q.operator} onValueChange={operator=>navigate({operator,saved:undefined})}><SelectTrigger aria-label={"\u62a5\u544a\u8fd0\u8425\u5546"} className="site-analysis-operator-select w-auto"><SelectValue/></SelectTrigger><SelectContent className="site-analysis-operator-options">{Object.entries(names).map(([code,name])=><SelectItem key={code} value={code}>{code==='all'?name:<OperatorIdentity code={code}/>}</SelectItem>)}</SelectContent></Select>;
 const actions=(row:Row)=><ActionMenu label={row.files.scopeLabel+'\u7684\u64cd\u4f5c'} items={[{id:'open',label:'\u67e5\u770b\u62a5\u544a',onSelect:()=>open(row)},{id:'html',label:'\u4e0b\u8f7d HTML',onSelect:()=>download(row,'html')},{id:'json',label:'\u4e0b\u8f7d JSON',onSelect:()=>download(row,'json')}]}/>;
 return <div data-local-report-library className="site-analysis-page product-page-inset flex min-w-0 flex-col gap-lg">
 <PageHeading icon="file-text" title={"\u62a5\u544a\u4e2d\u5fc3"} description={"\u67e5\u9605\u5168\u90e8\u5df2\u5165\u5e93\u62a5\u544a\u4e0e\u5386\u53f2\u7248\u672c"} context={<span>{"\u6f14\u793a \u00b7 \u672c\u673a\u7559\u5b58"}</span>} actions={<Button asChild size="xl"><Link href={newHref}><Icon name="newspaper" size="sm"/>{"\u751f\u6210\u62a5\u544a"}</Link></Button>}/>
 {!q.saved&&<section className="site-analysis-toolbar"><div className="site-analysis-filters site-analysis-action-row"><CentreSwitch scope={q}/><div className="site-analysis-control-group">{controls}<Button size="icon-xl" variant="ghost" aria-label={"\u91cd\u8bfb\u62a5\u544a\u5e93"} onClick={()=>void read()}><Icon name="refresh" size="sm"/></Button></div></div></section>}
 <InvestigationReturn source="history" description={"\u5df2\u4fdd\u5b58\u62a5\u544a \u00b7 \u6309\u7559\u5b58\u7248\u672c\u67e5\u9605"}/>
 {q.saved?<><div className="site-analysis-table-tools site-analysis-action-row"><Button size="xl" variant="ghost" onClick={()=>navigate({saved:undefined})}><Icon name="arrow-left" size="sm"/>{"\u8fd4\u56de\u62a5\u544a\u5217\u8868"}</Button>{selected&&inScope&&<div className="site-analysis-control-group"><Button size="xl" variant="ghost" onClick={()=>download(selected,'html')}>{"\u4e0b\u8f7d HTML"}</Button><Button size="xl" variant="ghost" onClick={()=>download(selected,'json')}>{"\u4e0b\u8f7d JSON"}</Button></div>}</div>
 {error?<EmptyState title={"\u62a5\u544a\u5e93\u6682\u4e0d\u53ef\u8bfb"} action={<Button size="xl" onClick={()=>void read()}>{"\u91cd\u8bd5"}</Button>}/>:rows===null?<EmptyState title={"\u6b63\u5728\u8bfb\u53d6\u62a5\u544a"}/>:!selected||!inScope?<EmptyState title={"\u5f53\u524d\u8303\u56f4\u6ca1\u6709\u8be5\u62a5\u544a\u7248\u672c"} description={"\u8bf7\u8fd4\u56de\u5217\u8868\u6838\u5bf9\u533a\u57df\u548c\u7559\u5b58\u7248\u672c\u3002"}/>:<>
 <PanelCard icon="file-text" title={selected.files.scopeLabel+' \u00b7 '+(selected.files.kind==='history'?'\u5386\u53f2\u5206\u6790':periodNames[selected.files.period]??'\u7528\u91cf\u62a5\u544a')} description={selected.files.start.slice(0,10)+' \u2014 '+selected.files.end.slice(0,10)+'\uff08\u7ed3\u675f\u8fb9\u754c\u4e0d\u542b\uff09'}>
 <div className="flex flex-wrap items-center justify-between gap-md text-body-small"><span className="inline-flex flex-wrap items-center gap-sm"><OperatorIdentity code={selected.files.operator}/><span>{"\u4fdd\u5b58\u4e8e "+timeLabel(selected.saved.savedAt)}</span></span><span className="break-all text-muted-foreground">{selected.files.reportId}</span></div>
 {versions.length>1&&<div className="site-analysis-table-tools site-analysis-action-row"><span>{"\u540c\u8303\u56f4\u7248\u672c"}</span><Select value={selected.saved.digest} onValueChange={saved=>navigate({saved})}><SelectTrigger aria-label={"\u62a5\u544a\u7248\u672c"} className="w-auto"><SelectValue/></SelectTrigger><SelectContent>{versions.map(row=><SelectItem key={row.saved.digest} value={row.saved.digest}>{timeLabel(row.saved.savedAt)+' \u00b7 '+row.saved.digest.slice(0,8)}</SelectItem>)}</SelectContent></Select></div>}
 </PanelCard>
 <ReportFileView key={selected.saved.digest} files={selected.files}/>
 <details className="text-body-small text-muted-foreground"><summary className="cursor-pointer">{"\u7248\u672c\u4e0e\u6765\u6e90"}</summary><dl className="mt-md flex flex-col gap-sm break-all">{[['\u62a5\u544a\u7f16\u53f7',selected.files.reportId],['\u5185\u5bb9\u6458\u8981',selected.saved.digest],['\u6765\u6e90\u7248\u672c',selected.files.sourceVersion],['\u6a21\u677f\u7248\u672c',selected.files.templateVersion]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><Button asChild variant="ghost" size="xl"><a href={keep(selected.files.analysisHref)}>{"\u67e5\u770b\u539f\u5206\u6790\u6761\u4ef6"}</a></Button></details>
 </>}</>:<PanelCard title={"\u62a5\u544a\u5e93"} description={"\u5168\u90e8\u5386\u53f2\u5468\u671f \u00b7 \u4fdd\u5b58\u65f6\u95f4\u5012\u5e8f"} icon="file-text" className="site-analysis-table-panel">
 <div className="site-analysis-table-tools site-analysis-action-row">
 <div className="site-analysis-table-filters"><ViewModeSwitch value={view} onChange={setView} className="site-analysis-view-switch" labels={{list:'\u5217\u8868',cards:'\u5361\u7247'}}/><div className="site-analysis-occupancy-scroll"><SegmentedControl className="site-analysis-occupancy site-analysis-occupancy-auto [--analysis-facet-columns:5]" size="md" ariaLabel={"\u62a5\u544a\u7c7b\u522b"} value={q.period} onChange={period=>navigate({period,saved:undefined})} items={['all','day','week','month','history'].map(value=>({value,label:<span className="site-analysis-occupancy-label"><span>{periodNames[value]}</span><span className="tabular-nums">{filterLibrary(rows??[],{...q,search:'',period:value}).length}</span></span>}))}/></div></div>
 <form className="site-analysis-search" onSubmit={e=>{e.preventDefault();navigate({search,saved:undefined});}}>
 <InputGroup className="site-analysis-search-field"><InputGroupAddon><Icon name="search" size="sm"/></InputGroupAddon><InputGroupInput aria-label={"\u62a5\u544a\u68c0\u7d22"} placeholder={"\u8303\u56f4 / \u7f16\u53f7 / \u65e5\u671f"} maxLength={100} value={search} onCompositionStart={()=>{composing.current=true;cancel();}} onCompositionEnd={e=>{composing.current=false;queue(e.currentTarget.value);}} onChange={e=>{setSearch(e.target.value);queue(e.target.value);}}/></InputGroup>
 <ResetButton label={"\u91cd\u7f6e\u62a5\u544a\u7b5b\u9009"} onClick={()=>{cancel();setSearch('');setView('list');navigate({period:'all',operator:'all',search:'',saved:undefined});}}/></form></div>

 {error?<EmptyState title={"\u62a5\u544a\u5e93\u6682\u4e0d\u53ef\u8bfb"} description={"\u5b58\u50a8\u4e0d\u53ef\u7528\u6216\u6587\u4ef6\u6821\u9a8c\u5931\u8d25\uff0c\u65e7\u62a5\u544a\u672a\u88ab\u6e05\u7a7a\u3002"} action={<Button size="xl" onClick={()=>void read()}>{"\u91cd\u8bd5"}</Button>}/>:rows===null?<EmptyState title={"\u6b63\u5728\u8bfb\u53d6\u62a5\u544a\u5e93"}/>:filtered.length===0?<EmptyState title={rows.length?'\u5f53\u524d\u7b5b\u9009\u6ca1\u6709\u62a5\u544a':'\u62a5\u544a\u5e93\u6682\u65e0\u62a5\u544a'} description={rows.length?"\u8bf7\u8c03\u6574\u533a\u57df\u3001\u7c7b\u522b\u6216\u5173\u952e\u8bcd\u3002":"\u751f\u6210\u62a5\u544a\u5e76\u786e\u8ba4\u5165\u5e93\u540e\uff0c\u53ef\u5728\u8fd9\u91cc\u53cd\u590d\u67e5\u9605\u3002"} action={<Button asChild size="xl"><Link href={newHref}>{"\u751f\u6210\u62a5\u544a"}</Link></Button>}/>:view==='list'?<div className="site-analysis-table"><DataTable indexStart={(current-1)*size+1} rows={visible} rowKey={r=>r.saved.digest} columns={[
 {id:'name',header:'\u62a5\u544a',cell:r=><TableTitleCell className="site-analysis-site-title" icon="file-text" title={r.files.scopeLabel} description={(periodNames[r.files.kind==='history'?'history':r.files.period]??r.files.period)+' \u00b7 '+r.files.start.slice(0,10)+' \u00b7 '+names[r.files.operator]} onTitleClick={()=>open(r)}/>},
 {id:'period',header:'\u7c7b\u522b',cell:r=>periodNames[r.files.kind==='history'?'history':r.files.period]??r.files.period},
 {id:'operator',header:'\u8fd0\u8425\u5546',cell:r=><OperatorIdentity code={r.files.operator}/>},
 {id:'window',header:'\u6570\u636e\u5468\u671f',cell:r=><span className="whitespace-nowrap">{r.files.start.slice(0,10)+' \u2014 '+new Date(Date.parse(r.files.end)-1+8*3600000).toISOString().slice(0,10)}</span>},
 {id:'saved',header:'\u4fdd\u5b58\u65f6\u95f4',cell:r=>timeLabel(r.saved.savedAt)}
 ]} rowActions={actions} labels={{rowActions:'\u64cd\u4f5c'}}/></div>:<ListCardGrid className="site-analysis-card-grid">{visible.map(row=><ListCard key={row.saved.digest} className="site-analysis-card-surface" title={row.files.scopeLabel} description={row.files.start.slice(0,10)+' \u00b7 '+(periodNames[row.files.period]??'\u5386\u53f2\u5206\u6790')} icon="file-text" onTitleClick={()=>open(row)} meta={<div className="flex flex-col gap-sm text-body-small"><OperatorIdentity code={row.files.operator}/><span>{timeLabel(row.saved.savedAt)}</span></div>} actions={actions(row)}/>)}</ListCardGrid>}
 {rows!==null&&!error&&<Pagination className="product-pagination site-analysis-pagination site-analysis-action-row" page={current} pageCount={pages} total={filtered.length} countLabel={"\u5171\u8ba1\uff1a"+filtered.length+" \u4efd\u62a5\u544a"} pageSize={size} pageSizeOptions={[10,20,50]} pageSizeLabel={"\u6bcf\u9875\u663e\u793a\u6570\u91cf"} pageSizeOptionTemplate={"\u6bcf\u9875 {size} \u6761"} onPageSizeChange={value=>{setSize(value);setPage(1);}} onPageChange={setPage} firstLabel={"\u9996\u9875"} previousLabel={"\u4e0a\u4e00\u9875"} nextLabel={"\u4e0b\u4e00\u9875"} lastLabel={"\u672b\u9875"}/>}
 </PanelCard>}
 <p className="text-body-small text-muted-foreground">{"\u6f14\u793a\u62a5\u544a\u4fdd\u5b58\u5728\u5f53\u524d\u6d4f\u89c8\u5668\uff1b\u67e5\u9605\u548c\u4e0b\u8f7d\u4f7f\u7528\u4fdd\u5b58\u7248\u672c\uff0c\u6e05\u7406\u6d4f\u89c8\u5668\u6570\u636e\u4f1a\u5f71\u54cd\u672c\u673a\u7559\u5b58\u3002"}</p>
 </div>;
}
