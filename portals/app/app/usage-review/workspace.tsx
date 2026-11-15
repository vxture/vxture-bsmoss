"use client";
import AnalysisParameterRefresh from "../site-analysis/parameter-refresh";
import {useEffect,useRef,useState,useTransition,type CSSProperties} from 'react';
import {useRouter} from 'next/navigation';
import {Button,DataTable,EmptyState,Icon,InputGroup,InputGroupAddon,InputGroupInput,PanelCard,Pagination,SegmentedControl,Select,SelectTrigger,SelectValue,SelectContent,SelectItem,StatusBadge,TableTitleCell,Dialog,DialogContent,DialogTitle,DialogDescription} from '@vxture/design-system';
import ActionMenu from '../portal/action-menu';
import PageHeading from '../portal/page-heading';
import {formatDataTime} from '../domains/data-updates/rules';
import ResetButton from '../portal/reset-button';
import OperatorIdentity from '../portal/operator-identity';
import {useOperatorNames} from '../portal/operator-identities';
import AnalysisSummary from '../site-analysis/summary';
import {InvestigationReturn,useInvestigationLinks} from '../portal/investigation';
import {relatedDossierHref} from '../portal/investigation-targets';
import {reviewHref,reviewMapHref} from '../domains/usage-verification/links';
import {reviewWorkspaceHref,type ReviewView} from './view';
import {reviewRows} from '../domains/usage-verification/list-rules';
import type {ReviewListModel,ReviewCase} from '../domains/usage-verification/demo';
import type {ReviewQuery} from '../domains/usage-verification/query';
import {useReviewRecords} from './use-records';
import RecordSession from './record-session';
import {ReviewEvidence} from './detail';
import {FindingBadge} from './finding-badge';
export {FindingBadge} from './finding-badge';
import {kindNames,categoryNames,metricNames,statusNames,quantity,deviation,timeLabel,windowLabel} from './labels';
import {causeNames,actionNames} from './record-labels';
import '../site-analysis/site-analysis.css';
import '../portal/pagination.css';
import './review.css';
function QuantityValue({ value, metric, denominator = 1, warning = false }: { value: string | null; metric: Parameters<typeof quantity>[1]; denominator?: number; warning?: boolean }) {
 const text = quantity(value, metric, denominator), split = text.lastIndexOf(' ');
 return <span className="inline-flex items-baseline gap-2xs whitespace-nowrap tabular-nums"><span className={warning && value !== null ? 'text-warning-text' : 'text-muted-foreground'}>{split < 0 ? text : text.slice(0, split)}</span>{split >= 0 && <span className="text-muted-foreground">{text.slice(split + 1)}</span>}</span>;
}
const stateIcons={all:'stack',open:'search',awaiting_review:'clock',closed:'shield-check'} as const;
export default function ReviewWorkspace({model,initialSession,mode='cases',initialReason='all'}:{model:ReviewListModel;initialSession?:string;mode?:'cases'|'records';initialReason?:string}){
 const records=useReviewRecords(model.dataset,initialSession),router=useRouter(),operatorNames=useOperatorNames(),[pending,start]=useTransition();
 const list=reviewRows(model.cases,model.inputQuery,records.data?.logs??[],mode==='records',initialReason),q={...model.inputQuery,page:list.page},size=q.pageSize??20;
 const [search,setSearch]=useState(q.scope.search),[selected,setSelected]=useState<string|null>(null),[selectedEvent,setSelectedEvent]=useState<number>();
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null),composing=useRef(false),current=useRef(q);current.current=q;
 const rawHref=(query:ReviewQuery,nextMode:ReviewView=mode,reason=initialReason)=>reviewWorkspaceHref(query,nextMode,records.selected,reason);
 const {keep,carry}=useInvestigationLinks(rawHref(q));
 const cancel=()=>{if(timer.current){clearTimeout(timer.current);timer.current=null;}};
 useEffect(()=>{setSearch(model.inputQuery.scope.search);setSelected(null);},[model.inputQuery]);
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
 const navigate=(patch:Partial<ReviewQuery>={},scope:Partial<ReviewQuery['scope']>={},reason=initialReason)=>{cancel();setSelected(null);start(()=>router.replace(keep(rawHref({...current.current,page:1,...patch,scope:{...current.current.scope,...scope}},mode,reason)),{scroll:false}));};
 const commit=(value:string)=>navigate({}, {search:value});
 const queue=(value:string)=>{cancel();if(!composing.current)timer.current=setTimeout(()=>commit(value),300);};
 const open=(id:string,event?:number)=>{setSelected(v=>v===id&&event===selectedEvent?null:id);setSelectedEvent(event);};
 const chosen=model.cases.find(c=>c.id===selected)??records.data?.logs.find(l=>l.caseId===selected)?.events.at(-1)?.evidence;
 const retired=!!chosen&&!model.cases.some(c=>c.id===chosen.id);
 const deep=(c:ReviewCase,event?:number)=>carry(reviewHref(q,c.id)+(records.selected?'&recordSession='+records.selected:'')+(event?'&event='+event+'#review-event-'+event:''));
 const dossier=(c:ReviewCase)=>carry(relatedDossierHref(c.site.id,{...q.scope,operator:c.operator,hour:Number(timeLabel(c.start).slice(11,13))},q.period));
 const menu=(c:ReviewCase)=><ActionMenu label={c.site.name+'\u7684\u64cd\u4f5c'} items={[{id:'evidence',label:'\u67e5\u770b\u8bc1\u636e',icon:'search',onSelect:()=>open(c.id)},{id:'page',label:'\u72ec\u7acb\u9875\u67e5\u770b',icon:'file-text',onSelect:()=>router.push(deep(c))},{id:'site',label:'\u7ad9\u5740\u6863\u6848',icon:'building',onSelect:()=>router.push(dossier(c))},{id:'map',label:'\u5730\u56fe\u5b9a\u4f4d',icon:'map-pin',onSelect:()=>window.open(carry(reviewMapHref({...q,scope:{...q.scope,operator:c.operator,hour:Number(timeLabel(c.start).slice(11,13))}},c.site.id)),'_blank','noopener,noreferrer')}]}/>;
 function choice(label:string,value:string,options:Record<string,string>,change:(value:string)=>void){return <Select value={value} onValueChange={change}><SelectTrigger aria-label={label} className="w-auto h-control-xl text-body"><SelectValue/></SelectTrigger><SelectContent className="site-analysis-select-options">{Object.entries(options).map(([k,v])=><SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>;}
 const rowClick=(event:React.MouseEvent)=>{const target=event.target as HTMLElement;if(target.closest('button,a,[role=menuitem]'))return;const row=target.closest('tbody > tr');if(!row)return;const c=list.rows[Array.from(row.parentElement!.children).indexOf(row)];if(c)open(c.id,mode==='records'?c.review.revision:undefined);};
 return <div data-usage-review="list" data-review-mode={mode} data-review-history={mode==='records'?'':undefined} className="site-analysis-page product-page-inset flex min-w-0 flex-col gap-lg" aria-busy={pending}>
 <AnalysisParameterRefresh kind="verification" revision={model.configuration.revision}/><PageHeading icon="search" title={'\u7528\u91cf\u6838\u9a8c'} description={'\u6838\u5bf9\u7528\u91cf\u53d8\u5316\u4e0e\u6570\u636e\u4f9d\u636e\uff0c\u8bb0\u5f55\u539f\u56e0\u5e76\u5b8c\u6210\u590d\u6838'} context={<span>{'\u6570\u636e\u66f4\u65b0\u81f3 '}<time dateTime={model.cutoff} className="tabular-nums">{formatDataTime(model.cutoff)}</time></span>}/>
 <section className="site-analysis-toolbar" aria-label={'\u6838\u9a8c\u8303\u56f4'}><div className="site-analysis-filters site-analysis-action-row">
 {records.data&&<AnalysisSummary items={(['open','awaiting_review','closed'] as const).map(key=>({key,label:statusNames[key],shortLabel:statusNames[key],icon:stateIcons[key],value:String(list.states[key]),unit:'\u9879'}))}/>}
 <div className="site-analysis-time-tools"><Select value={q.scope.operator} onValueChange={operator=>navigate({}, {operator:operator as ReviewQuery['scope']['operator']})}><SelectTrigger aria-label={'\u6838\u9a8c\u8fd0\u8425\u5546'} className="site-analysis-operator-select w-auto"><SelectValue/></SelectTrigger><SelectContent className="site-analysis-operator-options">{Object.keys(operatorNames).filter(c=>['all','mobile','telecom','unicom','broadcast','other'].includes(c)).map(code=><SelectItem key={code} value={code}>{code==='all'?operatorNames.all:<OperatorIdentity code={code}/>}</SelectItem>)}</SelectContent></Select>
 <SegmentedControl className="h-control-xl" size="md" ariaLabel={'\u6838\u9a8c\u5468\u671f'} value={q.period} onChange={period=>navigate({period})} items={[{value:'day',label:'\u65e5'},{value:'week',label:'\u5468'},{value:'month',label:'\u6708'}]}/>
 <ResetButton variant="outline" label={'\u91cd\u7f6e\u6838\u9a8c\u8303\u56f4'} onClick={()=>navigate({period:'day',metric:'all',category:'all',kind:'all',status:'all',site:undefined},{operator:'all',search:'',selection:undefined},'all')}/></div></div></section>
 <PanelCard className="site-analysis-table-panel" title={mode==='cases'?'\u6838\u9a8c\u6e05\u5355':'\u6838\u9a8c\u8bb0\u5f55'} description={mode==='cases'?'\u53d1\u73b0\u7ebf\u7d22 \u2192 \u6838\u5bf9\u8bc1\u636e \u2192 \u786e\u8ba4\u539f\u56e0 \u2192 \u4eba\u5de5\u590d\u6838':'\u4fdd\u7559\u4eba\u5de5\u64cd\u4f5c\u3001\u539f\u59cb\u4f9d\u636e\u4e0e\u5386\u53f2\u4f1a\u8bdd'} icon="list-checks">
 <div className="site-analysis-table-tools site-analysis-action-row site-analysis-table-tools-single-line" role="region" aria-label={'\u6838\u9a8c\u8868\u683c\u64cd\u4f5c'} tabIndex={0}><div className="site-analysis-table-filters">
 <div className="site-analysis-occupancy-scroll" style={{'--analysis-facet-columns':2} as CSSProperties}><SegmentedControl size="md" className="h-control-xl site-analysis-occupancy site-analysis-occupancy-auto" ariaLabel={'\u6838\u9a8c\u5de5\u4f5c\u533a'} value={mode} items={[{value:'cases',ariaLabel:'\u6838\u9a8c\u6e05\u5355',label:<span className="site-analysis-occupancy-label"><Icon name="search" size="sm"/>{'\u6e05\u5355'}</span>},{value:'records',ariaLabel:'\u6838\u9a8c\u8bb0\u5f55',label:<span className="site-analysis-occupancy-label"><Icon name="clock" size="sm"/>{'\u8bb0\u5f55'}</span>}]} onChange={next=>{cancel();router.push(keep(rawHref({...q,page:1},next)),{scroll:false});}}/></div>
 <div className="site-analysis-occupancy-scroll" style={{'--analysis-facet-columns':4} as CSSProperties}><SegmentedControl size="md" className="h-control-xl site-analysis-occupancy site-analysis-occupancy-auto" ariaLabel={'\u6838\u9a8c\u72b6\u6001'} value={q.status} onChange={status=>navigate({status})} items={(['all','open','awaiting_review','closed'] as const).map(value=>({value,label:<span className="site-analysis-occupancy-label"><span>{value==='all'?"\u5168\u90e8":statusNames[value]}</span><span className="tabular-nums">{records.data?list.states[value]:'\u2014'}</span></span>}))}/></div>
 </div>
 <form className="site-analysis-search" role="search" onSubmit={e=>{e.preventDefault();if(!composing.current)commit(search);}}><InputGroup className="site-analysis-search-field"><InputGroupAddon><Icon name="search" size="sm"/></InputGroupAddon><InputGroupInput aria-label={'\u641c\u7d22\u6838\u9a8c\u7ad9\u5740'} placeholder={'\u7ad9\u5740\u540d\u79f0\u6216\u7f16\u7801'} value={search} onCompositionStart={()=>{composing.current=true;cancel();}} onCompositionEnd={e=>{composing.current=false;queue(e.currentTarget.value);}} onChange={e=>{setSearch(e.target.value);queue(e.target.value);}}/></InputGroup>
 <div className="site-analysis-control-group">
 {choice('\u53d1\u73b0\u7c7b\u522b',q.category,categoryNames,category=>navigate({category:category as ReviewQuery['category'],kind:'all'}))}
 {choice('\u53d1\u73b0\u7c7b\u578b',q.kind??'all',{'all':'\u5168\u90e8\u7c7b\u578b',...kindNames},kind=>navigate({kind:kind as ReviewQuery['kind']}))}
 {choice('\u6838\u9a8c\u6307\u6807',q.metric,metricNames,metric=>navigate({metric:metric as ReviewQuery['metric']}))}
 {mode==='records'&&choice('\u8bb0\u5f55\u539f\u56e0',initialReason,{'all':'\u5168\u90e8\u539f\u56e0',...causeNames},reason=>navigate({}, {},reason))}
 {q.site&&<Button variant="ghost" className="h-control-xl text-body" onClick={()=>navigate({site:undefined})}>{q.site}<Icon name="x" size="sm"/></Button>}
 {q.scope.selection&&<Button variant="ghost" className="h-control-xl text-body" onClick={()=>navigate({}, {selection:undefined})}>{'\u6e05\u9664\u9009\u533a'}</Button>}
 </div>
<ResetButton variant="outline" label={'\u91cd\u7f6e\u8868\u683c\u7b5b\u9009\u4e0e\u67e5\u8be2'} onClick={()=>{setSearch('');navigate({metric:'all',category:'all',kind:'all',status:'all',site:undefined},{search:''},'all');}}/></form></div>
 {records.error?<EmptyState title={'\u672c\u673a\u8bb0\u5f55\u4e0d\u53ef\u8bfb'} description={'\u8bf7\u68c0\u67e5\u5b58\u50a8\u540e\u91cd\u8bfb\uff0c\u539f\u8bb0\u5f55\u4fdd\u7559\u3002'}/>:!records.data?<EmptyState title={'\u6b63\u5728\u8bfb\u53d6\u6838\u9a8c\u8bb0\u5f55'}/>:<div className="site-analysis-table min-w-0 overflow-x-auto" onClick={rowClick}><DataTable rows={list.rows} rowKey={c=>c.id} indexStart={(list.page-1)*size+1} labels={{rowActions:'\u64cd\u4f5c'}} rowActions={menu} columns={[
 {id:'site',header:'\u7ad9\u5740',align:'left',cell:c=><TableTitleCell className="site-analysis-site-title" icon="map-pin" title={c.site.name} description={c.site.id} onTitleClick={()=>open(c.id,mode==='records'?c.review.revision:undefined)}/>},
 {id:'subject',header:'\u6838\u9a8c\u9879',align:'center',cell:c=><TableTitleCell layout="stacked" title={<OperatorIdentity code={c.operator}/>} description={<span className="inline-flex items-baseline gap-2xs whitespace-nowrap"><span>{metricNames[c.metric]}</span><span className="tabular-nums">{deviation(c.current,c.referenceNumerator)}</span></span>}/>},
 ...(mode==='cases'?[{id:'finding',header:'\u53d1\u73b0',align:'center' as const,cell:(c:typeof list.rows[number])=><div className="flex flex-col items-center gap-xs text-center"><FindingBadge item={c}/><span className="text-body-small text-muted-foreground">{windowLabel(c.start,c.end)}</span></div>},{id:'quantity',header:'\u5b9e\u9645 / \u53c2\u8003',align:'center' as const,cell:(c:typeof list.rows[number])=><TableTitleCell className="whitespace-nowrap tabular-nums" layout="stacked" title={<QuantityValue value={c.current} metric={c.metric} warning={c.category==='business'}/>} description={c.referenceNumerator===null?'\u53c2\u8003\u4e0d\u8db3':<QuantityValue value={c.referenceNumerator} metric={c.metric} denominator={2}/>}/>}]:[{id:'action',header:'\u6700\u8fd1\u64cd\u4f5c',align:'center' as const,cell:(c:typeof list.rows[number])=><TableTitleCell layout="stacked" title={actionNames[c.review.last!.command.action]} description={c.review.reason?causeNames[c.review.reason]:'\u2014'}/>},{id:'actor',header:'\u8bb0\u5f55\u4eba / \u65f6\u95f4',align:'center' as const,cell:(c:typeof list.rows[number])=><TableTitleCell layout="stacked" title={'\u6f14\u793a\u8bbf\u5ba2'} description={timeLabel(c.review.last!.recordedAt)}/>}]),
 {id:'state',header:'\u72b6\u6001',align:'center',cell:c=><div className="flex flex-col items-center gap-xs text-center"><StatusBadge tone={c.review.state==='closed'?'success':c.review.state==='awaiting_review'?'info':'neutral'} size="sm">{statusNames[c.review.state]}</StatusBadge>{(c.retired||c.review.changed)&&<span className="text-body-small text-warning-text">{c.retired?'\u5f53\u524d\u89c4\u5219\u672a\u547d\u4e2d':'\u4f9d\u636e\u5df2\u53d8\u5316'}</span>}</div>}
 ]} empty={<EmptyState title={mode==='cases'?'\u5f53\u524d\u8303\u56f4\u6682\u65e0\u6838\u9a8c\u7ebf\u7d22':'\u5f53\u524d\u8303\u56f4\u6682\u65e0\u4eba\u5de5\u8bb0\u5f55'} description={mode==='cases'?'\u8c03\u6574\u5468\u671f\u3001\u6307\u6807\u6216\u7b5b\u9009\u6761\u4ef6\u3002':'\u786e\u8ba4\u539f\u56e0\u540e\uff0c\u8fd9\u91cc\u663e\u793a\u5b9e\u9645\u64cd\u4f5c\u8bb0\u5f55\u3002'}/>}/></div>}
 <Pagination className="product-pagination site-analysis-pagination site-analysis-action-row" page={list.page} pageCount={list.pages} total={list.total} countLabel={'\u5171\u8ba1\uff1a'+list.total+' \u9879'} pageSize={size} pageSizeOptions={[10,20,50,100]} pageSizeLabel={'\u6bcf\u9875\u663e\u793a\u6570\u91cf'} pageSizeOptionTemplate={'\u6bcf\u9875 {size} \u6761'} onPageSizeChange={pageSize=>navigate({pageSize})} onPageChange={page=>navigate({page})} firstLabel={'\u9996\u9875'} previousLabel={'\u4e0a\u4e00\u9875'} nextLabel={'\u4e0b\u4e00\u9875'} lastLabel={'\u672b\u9875'}/>
 </PanelCard>
 <details className="text-body-small text-muted-foreground"><summary className="cursor-pointer">{'\u8bb0\u5f55\u4f1a\u8bdd\u4e0e\u6570\u636e\u8bf4\u660e'}</summary><div className="flex min-w-0 flex-col gap-md pt-md"><RecordSession records={records}/><InvestigationReturn source="uv"/><p>{'\u65e5\u3001\u5468\u3001\u6708\u7b5b\u9009\u6574\u4e2a\u6e05\u5355\u4e0e\u8bb0\u5f55\uff1b\u53d1\u73b0\u6309\u5b9e\u9645\u5c0f\u65f6\u7a97\u53e3\u5224\u5b9a\uff0c\u5f53\u524d\u6837\u4f8b\u622a\u81f3 2026-10-31\u3002'}</p></div></details>
 <Dialog modal={false} open={!!chosen} onOpenChange={value=>{if(!value)setSelected(null);}}><DialogContent className="site-analysis-detail site-analysis-detail-wide" width="lg" onOpenAutoFocus={e=>e.preventDefault()} onInteractOutside={e=>{if(e.target instanceof Element&&(e.target.closest('.site-analysis-table tbody > tr')||e.target.closest('[role="menu"]')))e.preventDefault();}}><div className="pr-xl"><DialogTitle>{chosen?.site.name}</DialogTitle><DialogDescription>{chosen?.site.id}</DialogDescription></div>{chosen&&<ReviewEvidence key={chosen.id} embedded listHref={rawHref(q)} retired={retired} records={records} recordSession={records.selected} eventNumber={selectedEvent} model={{item:chosen,query:q,region:model.region,cutoff:model.cutoff,retired,configuration:model.configuration}}/>}</DialogContent></Dialog>
 </div>;
}
