"use client";
import { ViewModeSwitch } from "@vxture/design-system";
import Link from 'next/link';
import {useEffect,useRef,useState,useTransition,type ReactNode} from 'react';
import {useRouter} from 'next/navigation';
import {RowsIcon,StackIcon} from '@phosphor-icons/react';
import {Button,Icon,PanelCard,Drawer,Popover,PopoverTrigger,PopoverContent,Select,SelectTrigger,SelectValue,SelectContent,SelectItem,DataTable,TableTitleCell,Progress,Pagination,EmptyState,ShellPageContainer} from '@vxture/design-system';
import ResetButton from '../../portal/reset-button';
import ServiceNavigation from '../service-view-navigation';
import {serviceViews} from '../service-navigation';
import PageHeading from '../../portal/page-heading';
import AnalysisSummary from '../../site-analysis/summary';
import ActionMenu from '../../portal/action-menu';
import FilterButton from '../../portal/filter-button';
import EvidenceSummary from './summary';
import {labels,name,customerName,ruleFields,serviceName,operatorNames} from '../rule-format';
import {ConfigurationSearch,ConfigurationDetail,configurationRowClick,configurationTime} from '../../settings/configuration-layout';
import SnapshotControls from '../query-controls';
import {DEMO_REGION} from '../../domains/map-demo/resources';
import {snapshotQuery} from '../../domains/tower-service/query';
import {formatServiceQuantity as format} from '../../domains/tower-service/quantification';
import type {RuleVersion} from '../../domains/tower-service/foundation';
import type {EvidenceModel} from './model';
import '../../site-analysis/site-analysis.css';
import '../../portal/pagination.css';

import './evidence.css';
import SectionHeading from '../../portal/section-heading';

const evidenceName=(value:string)=>value==='configuration'?'\u914d\u7f6e\u8bb0\u5f55':value==='configuration_rule_pending'?'\u914d\u7f6e\u53e3\u5f84\u5f85\u786e\u8ba4':name(value);
function Fields({title,rows}:{title:string;rows:[string,ReactNode][]}){return <section className="flex min-w-0 flex-col gap-md"><h3 className="text-heading-3 font-semibold">{title}</h3><dl className="evidence-fields">{rows.map(([label,value])=><div key={label}><dt className="text-body-small text-muted-foreground">{label}</dt><dd className="break-words">{value}</dd></div>)}</dl></section>;}
export default function EvidenceWorkspace({model:m,returnTo}:{model:EvidenceModel;returnTo?:string|null}){
 const router=useRouter(),[busy,startTransition]=useTransition(),lock=useRef(false);
 const [detail,setDetail]=useState<EvidenceModel['rows'][number]|null>(null),[ruleDetail,setRuleDetail]=useState<RuleVersion|null>(null),[search,setSearch]=useState(m.filters.search),[layout,setLayout]=useState<'list'|'cards'>('list'),[filterOpen,setFilterOpen]=useState(false),[draft,setDraft]=useState({serviceMetric:m.filters.serviceMetric,method:m.filters.method,dimension:m.filters.dimension,service:m.filters.service,state:m.filters.state});
 const {ruleA: _a,ruleB: _b,...detailFilters}=m.filters;
 const values={...snapshotQuery(m.context),...detailFilters,view:m.view};
 const href=(patch:Record<string,string|number>={})=>{
  const reset=patch.snapshotId&&patch.snapshotId!==m.context.snapshotId?{serviceMetric:'all',dimension:'none',service:'all',method:'all',state:'all',search:'',page:1}:{};
  const p=new URLSearchParams(Object.fromEntries(Object.entries({...values,...patch,...reset}).map(([k,v])=>[k,String(v)])));
  p.delete('operatorCount');if(!p.get('compareSnapshotId'))p.delete('compareSnapshotId');if(returnTo)p.set('returnTo',returnTo);return '/tower-service/services?'+p;
 };
 useEffect(()=>{if(!busy)lock.current=false;},[busy,m]);
 const navigate=(patch:Record<string,string|number>)=>{if(lock.current)return;const target=href(patch);if(target===href())return;lock.current=true;startTransition(()=>router.push(target,{scroll:false}));};
 const change=(patch:Record<string,string|number>)=>navigate({...patch,page:1});
 useEffect(()=>setSearch(m.filters.search),[m.filters.search]);
 useEffect(()=>{if(search===m.filters.search||busy)return;const timer=setTimeout(()=>change({search}),350);return ()=>clearTimeout(timer);},[search,m.filters.search,busy]);
 useEffect(()=>{setDetail(null);setRuleDetail(null);},[m.context.snapshotId,m.context.operator,m.context.city,m.context.county,m.filters.page,m.filters.state,m.filters.service,m.filters.dimension,m.filters.search,m.view]);
 const go=(target:string)=>{if(lock.current)return;lock.current=true;startTransition(()=>router.push(target,{scroll:false}));};
 const viewLabel=serviceViews.find(v=>v.value===m.view)?.label;
 const select=(label:string,value:string,items:{value:string;label:string}[],onChange:(s:string)=>void)=><Select disabled={busy} value={value} onValueChange={onChange}><SelectTrigger className="w-auto max-w-full" aria-label={label}><SelectValue/></SelectTrigger><SelectContent>{items.map(r=><SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent></Select>;
 const quantity=(r:EvidenceModel['rows'][number],raw=false)=>{const value=raw?r.rawQuantity:r.quantity;return r.kind==='configuration'&&value===null?'\u5f85\u786e\u8ba4':format(value,r.dimension.scale)+(value===null?'':' '+r.dimension.unit);};
 const filterCount=[m.filters.method!=='all',(m.filters.service!=='all'||m.filters.serviceMetric!=='all'),!['all','none'].includes(m.filters.dimension),m.view==='summary'&&m.filters.state!=='all'].filter(Boolean).length;
 const operatorFilter=select('\u8fd0\u8425\u5546',m.context.operator,['all',...m.allowedOperators].map(value=>({value,label:operatorNames[value]??value})),operator=>change({operator}));
 const filters=<Popover open={filterOpen} onOpenChange={open=>{if(open)setDraft({serviceMetric:m.filters.serviceMetric,method:m.filters.method,dimension:m.filters.dimension,service:m.filters.service,state:m.filters.state});setFilterOpen(open);}}>
  <PopoverTrigger asChild><FilterButton count={filterCount}/></PopoverTrigger>
  <PopoverContent width="xl" align="end" className="site-analysis-filter-panel" aria-label={'\u4f9d\u636e\u7b5b\u9009\u6761\u4ef6'}><div className="grid grid-cols-2 gap-md">
   <label className="flex flex-col gap-xs">{'\u4f9d\u636e\u65b9\u5f0f'}{select('\u4f9d\u636e\u65b9\u5f0f',draft.method,['all',...(m.configurationGaps.length?['configuration']:[]),'measured','allocated','estimated','unassigned'].map(value=>({value,label:evidenceName(value)})),method=>setDraft({...draft,method}))}</label>
   <label className="flex flex-col gap-xs">{'\u670d\u52a1\u7c7b\u578b'}{select('\u670d\u52a1\u7c7b\u578b',draft.service,[{value:'all',label:name('all')},...m.services.map(value=>({value,label:serviceName(value)}))],service=>setDraft({...draft,service}))}</label>
   {m.view==='summary'&&<label className="flex flex-col gap-xs">{'\u4f9d\u636e\u72b6\u6001'}{select('\u4f9d\u636e\u72b6\u6001',draft.state,['all',...m.facets.map(f=>f.value)].map(value=>({value,label:name(value)})),state=>setDraft({...draft,state}))}</label>}
   {m.dimensions.length>0&&<label className="col-span-2 flex flex-col gap-xs">{'\u8ba1\u91cf\u5355\u4f4d\u4e0e\u8fb9\u754c'}{select('\u7b5b\u9009\u8ba1\u91cf\u7ef4\u5ea6',draft.dimension,[{value:'all',label:'\u5168\u90e8\u8ba1\u91cf\u7ef4\u5ea6'},...m.dimensions.map(r=>({value:r.id,label:(r.serviceItemId?serviceName(r.serviceItemId):name(r.boundary))+' / '+r.unit+(r.serviceItemId?'':' / '+r.scale)}))],dimension=>setDraft({...draft,dimension}))}</label>}
  </div><div className="flex justify-end gap-sm border-t border-border mt-md pt-md"><Button variant="ghost" onClick={()=>setDraft({serviceMetric:'all',method:'all',service:'all',dimension:'all',state:'all'})}>{'\u6e05\u7a7a'}</Button><Button onClick={()=>{change({...draft,...(draft.service!==m.filters.service?{serviceMetric:'all'}:{})});setFilterOpen(false);}}>{'\u5e94\u7528\u7b5b\u9009'}</Button></div></PopoverContent>
 </Popover>;
 const detailColumns=[
  {id:'index',header:'#',align:'center' as const,cell:(r:EvidenceModel['rows'][number])=>(m.filters.page-1)*m.filters.pageSize+m.rows.indexOf(r)+1},
  {id:'site',header:'\u7ad9\u5740',cell:(r:EvidenceModel['rows'][number])=><TableTitleCell title={r.siteName} description={r.siteId} onTitleClick={()=>router.push('/tower-service/resources/'+encodeURIComponent(r.siteId)+'?'+new URLSearchParams(snapshotQuery(m.context)))}/>},
  {id:'customer',header:'\u5ba2\u6237 / \u670d\u52a1',cell:(r:EvidenceModel['rows'][number])=><TableTitleCell title={customerName(r.customer?.name??'\u5f85\u5f52\u5c5e')} description={serviceName(r.serviceItemId)}/>},
  {id:'object',header:'\u4f9d\u636e\u5bf9\u8c61 / \u671f\u95f4',cell:(r:EvidenceModel['rows'][number])=><TableTitleCell title={r.kind==='meter'?name(r.meter.role):'\u670d\u52a1\u914d\u7f6e'} description={configurationTime(r.from).slice(0,16)+' / '+configurationTime(r.to).slice(0,16)}/>},
  {id:'quantity',header:'\u6570\u91cf / \u7528\u91cf',align:'center' as const,cell:(r:EvidenceModel['rows'][number])=><span className="tabular-nums whitespace-nowrap">{quantity(r)}</span>},
  {id:'method',header:'\u65b9\u5f0f',align:'center' as const,cell:(r:EvidenceModel['rows'][number])=>evidenceName(r.method)},
  {id:'state',header:'\u72b6\u6001',align:'center' as const,cell:(r:EvidenceModel['rows'][number])=><span className={r.state==='conflict'?'text-danger-text':r.state==='pending'?'text-warning-text':'text-muted-foreground'}>{name(r.state)}</span>},
  {id:'actions',header:<span className="sr-only">{'\u64cd\u4f5c'}</span>,align:'center' as const,cell:(r:EvidenceModel['rows'][number])=><ActionMenu label={r.siteName+'\u7684\u4f9d\u636e\u64cd\u4f5c'} items={[{id:'trace',label:'\u67e5\u770b\u4f9d\u636e',onSelect:()=>setDetail(r)}]}/>}
 ];
 const exportHref=()=>{const p=new URL(href(),'http://local').searchParams;p.delete('returnTo');return '/api/product-preview/tower-evidence/export?'+p;};
 const exportButton=<Button asChild><a href={exportHref()} download><Icon name="download" size="sm"/>{'\u5bfc\u51fa'}</a></Button>;
 const reset=()=>{setSearch('');change({operator:'all',search:'',state:'all',method:'all',serviceMetric:'all',service:'all',dimension:'all'});};
 const summaryTools=<>{operatorFilter}{filters}<ResetButton variant="outline" label={'\u91cd\u7f6e\u7b5b\u9009\u4e0e\u67e5\u8be2'} onClick={reset}/>{exportButton}</>;
 const details=<section className="evidence-details site-analysis-section min-w-0"><div className="evidence-tools site-analysis-table-tools-single-line site-analysis-action-row">
  <ViewModeSwitch value={layout} onChange={setLayout} labels={{list:'\u5217\u8868',cards:'\u5361\u7247'}} ariaLabel={'\u4f9d\u636e\u663e\u793a\u65b9\u5f0f'}/>
  <ConfigurationSearch value={search} onChange={setSearch} label={'\u641c\u7d22\u7ad9\u5740\u3001\u5ba2\u6237\u6216\u4f9d\u636e'} onReset={reset} filters={<>
   {operatorFilter}
   {select('\u4f9d\u636e\u72b6\u6001',m.filters.state,['all',...m.facets.map(f=>f.value)].map(value=>({value,label:name(value)})),state=>change({state}))}{filters}</>} actions={<>
    {exportButton}
   </>}/>
 </div>
 {m.rows.length?layout==='list'?<div className="site-analysis-table evidence-table" onClick={configurationRowClick(m.rows,setDetail)}><DataTable rows={m.rows} rowKey={r=>r.id} columns={detailColumns}/></div>:<div className="evidence-card-grid">{m.rows.map(r=><PanelCard key={r.id} title={r.siteName} icon="list-checks" description={customerName(r.customer?.name??'\u5f85\u5f52\u5c5e')}><div className="flex flex-col gap-md"><span>{serviceName(r.serviceItemId)}</span><strong className="text-heading-2 tabular-nums">{quantity(r)}</strong><span className="text-body-small text-muted-foreground">{evidenceName(r.method)+' \u00b7 '+name(r.state)}</span><Button variant="outline" onClick={()=>setDetail(r)}>{'\u67e5\u770b\u4f9d\u636e'}</Button></div></PanelCard>)}</div>:<EmptyState title={m.source?'\u5f53\u524d\u7b5b\u9009\u65e0\u5339\u914d\u4f9d\u636e':'\u5f53\u524d\u5feb\u7167\u5c1a\u672a\u63a5\u5165\u8ba1\u91cf\u4f9d\u636e'} description={'\u7f3a\u5c11\u4f9d\u636e\u4e0d\u4ee3\u8868\u670d\u52a1\u6570\u91cf\u4e3a\u96f6\u3002'}/>}
 <Pagination className="product-pagination site-analysis-pagination site-analysis-action-row" page={m.filters.page} pageCount={Math.max(1,Math.ceil(m.rowCount/m.filters.pageSize))} total={m.rowCount} countLabel={'\u5171\u8ba1\uff1a'+m.rowCount+' \u6761'} pageSize={m.filters.pageSize} pageSizeOptions={[10,20,50,100]} pageSizeLabel={'\u6bcf\u9875\u663e\u793a\u6570\u91cf'} pageSizeOptionTemplate={'\u6bcf\u9875 {size} \u6761'} firstLabel={'\u9996\u9875'} previousLabel={'\u4e0a\u4e00\u9875'} nextLabel={'\u4e0b\u4e00\u9875'} lastLabel={'\u672b\u9875'} onPageSizeChange={pageSize=>change({pageSize})} onPageChange={page=>navigate({page})}/>
 </section>;
 const ruleLabel=(r:RuleVersion)=>[operatorNames[r.operator]??r.operator,serviceName(r.service),r.reference,'v'+r.revision+' \u00b7 '+r.from].join(' / ');
 const ruleRows=(r:RuleVersion|null):[string,string][]=>[['\u8fd0\u8425\u5546',r?operatorNames[r.operator]??r.operator:'--'],...ruleFields(r).map(([label,value]):[string,string]=>[label,label==='\u670d\u52a1'&&r?serviceName(r.service):label==='\u5ba2\u6237'&&r?customerName(m.ruleCustomers[r.customerId]??value):value])];
 const reconciliation=detail?.kind==='meter'?m.reconciliation.find(r=>r.meterId===detail.meterId||r.meterId===detail.meter.parentId):null;
 return <ShellPageContainer className="site-analysis-page product-page-inset gap-lg evidence-workspace">
 <PageHeading title={'\u670d\u52a1\u91cf\u5316'} icon="users" description={'\u670d\u52a1\u6570\u91cf\u3001\u5468\u671f\u53d8\u5316\u4e0e\u4f9d\u636e\u8ffd\u6eaf'}
 context={<><span className="text-body-small text-muted-foreground">{'\u6570\u636e\u622a\u81f3 '}<time dateTime={m.snapshot.dataThrough}>{configurationTime(m.snapshot.dataThrough)}</time></span></>}
 actions={<ServiceNavigation values={values} currentHref={href()} returnTo={returnTo} busy={busy} onNavigate={go}/>}/>
 {returnTo&&(m.filters.service!=='all'||m.filters.serviceMetric!=='all')&&<Button asChild variant="ghost" size="md" className="self-start" disabled={busy}><Link href={returnTo} scroll={false} onClick={event=>{event.preventDefault();go(returnTo);}}><Icon name="arrow-left" size="sm"/>{"\u8fd4\u56de"+serviceViews.find(v=>v.value===(new URL(returnTo,'http://local').searchParams.get('view')??'operators'))?.label}</Link></Button>}
 <section className="site-analysis-toolbar evidence-analysis-row" aria-busy={busy}>
 <div className="evidence-analysis-context"><SectionHeading title={viewLabel} iconVisual={m.view==='summary'?<StackIcon aria-hidden="true" className="size-icon-xl shrink-0 text-muted-foreground"/>:<RowsIcon aria-hidden="true" className="size-icon-xl shrink-0 text-muted-foreground"/>}/><AnalysisSummary showIcons={false} label={'\u4f9d\u636e\u6982\u51b5'} items={[{key:'items',label:'\u5df2\u6355\u83b7\u4f9d\u636e',shortLabel:'\u5df2\u6355\u83b7',value:format(String(m.displayCounts.items)),unit:'\u6761',icon:'database',description:'\u6309\u5f53\u524d\u5217\u8868\u8303\u56f4\u7edf\u8ba1\uff0c\u4e0d\u53d7\u5206\u9875\u5f71\u54cd\u3002'},{key:'pending',label:'\u5f85\u786e\u8ba4\u4f9d\u636e',shortLabel:'\u5f85\u786e\u8ba4',value:format(String(m.displayCounts.pending)),unit:'\u6761',icon:'list-checks',tone:'warning',description:'\u4e0e\u5217\u8868\u7684\u5f85\u786e\u8ba4\u72b6\u6001\u4e00\u81f4\uff0c\u51b2\u7a81\u3001\u4f30\u7b97\u548c\u5f85\u5f52\u5c5e\u5355\u72ec\u7edf\u8ba1\u3002'},{key:'completeness',label:'\u4f9d\u636e\u5b8c\u6574\u7387',shortLabel:'\u5b8c\u6574\u7387',value:m.displayCounts.completeness===null?'\u2014':(m.displayCounts.completeness*100).toFixed(1),unit:m.displayCounts.completeness===null?undefined:'%',icon:'list-checks',description:'\u5b8c\u6574\u914d\u7f6e\u3001\u5b9e\u6d4b\u548c\u5206\u644a\u8ba1\u5165\u5206\u5b50\uff1b\u6309\u5df2\u6355\u83b7\u5ba2\u6237\u8bb0\u5f55\u8ba1\u7b97\uff0c\u4f30\u7b97\u4e0d\u8ba1\u5165\u5b8c\u6574\uff0c\u5f85\u63a5\u5165\u9879\u76ee\u4e0d\u8fdb\u5165\u5206\u6bcd\u3002'}]} note={m.context.operator==='all'?undefined:operatorNames[m.context.operator]}/></div>
 <span className="evidence-loading" role="status" aria-live="polite">{busy?<><Icon name="refresh" size="md" className="animate-spin"/>{'\u6570\u636e\u52a0\u8f7d\u4e2d\u2026'}</>:null}</span>
 <SnapshotControls compact snapshotOnly analysisIcon={null} pending={busy} onNavigate={change} context={m.context} snapshots={m.snapshots} region={DEMO_REGION} href={href}/>
 </section>
 <div className="evidence-body" inert={busy} aria-busy={busy}>{m.view==='summary'?<EvidenceSummary model={m} tools={summaryTools} onDetails={patch=>change({view:'details',...patch})}/>:details}</div>

 <Drawer open={!!detail} onClose={()=>setDetail(null)} side="right" width="sm" title={detail?.siteName??'\u8ba1\u91cf\u4f9d\u636e'} closeLabel={'\u5173\u95ed\u4f9d\u636e'}>{detail?.kind==='configuration'?<div className="flex min-w-0 flex-col gap-xl">
 <Fields title={'\u914d\u7f6e\u4f9d\u636e'} rows={[
 ['\u5ba2\u6237',customerName(detail.customer.name)],['\u670d\u52a1',serviceName(detail.serviceItemId)],
 ['\u72b6\u6001',detail.state==='complete'?name(detail.state):evidenceName(detail.reason)],['\u671f\u672b\u914d\u7f6e\u91cf',detail.quantity===null?'\u5f85\u786e\u8ba4':quantity(detail)],['\u539f\u59cb\u914d\u7f6e\u91cf',quantity(detail,true)],
 ['\u7edf\u8ba1\u65f6\u70b9',configurationTime(detail.stockAsOf)],['\u914d\u7f6e\u6709\u6548\u671f',configurationTime(detail.from)+' / '+configurationTime(detail.to)],['\u7edf\u8ba1\u65b9\u6cd5','\u53d6\u5feb\u7167\u671f\u672b\u4ecd\u6709\u6548\u7684\u5ba2\u6237\u914d\u7f6e\u3002']
 ]}/>
 <Fields title={'\u6765\u6e90\u4e0e\u534f\u8bae'} rows={[
 ['\u914d\u7f6e\u5bf9\u8c61',detail.configuration.componentId],['\u6765\u6e90\u5f15\u7528',detail.sourceRef],['\u5feb\u7167\u7248\u672c',m.context.snapshotId],
 ['\u6765\u6e90\u7248\u672c',detail.sourceVersion],['\u6620\u5c04\u7248\u672c',detail.mappingVersion],['\u534f\u8bae\u7248\u672c',detail.configuration.agreementVersion??'\u5f85\u786e\u8ba4'],['\u53e3\u5f84\u7248\u672c',detail.configuration.ruleVersion??'\u5f85\u786e\u8ba4']
 ]}/>
 </div>:detail&&<div className="flex min-w-0 flex-col gap-xl">
 <Fields title={'\u7ed3\u679c\u4e0e\u63a8\u5bfc'} rows={[
 ['\u4f9d\u636e\u65b9\u5f0f',name(detail.method)],['\u72b6\u6001',name(detail.state)+(detail.reason==='complete'?'':' / '+name(detail.reason))],['\u671f\u95f4',configurationTime(detail.from)+' / '+configurationTime(detail.to)],['\u6570\u91cf / \u7528\u91cf',quantity(detail)],['\u539f\u59cb\u533a\u95f4\u91cf',quantity(detail,true)],
 ['\u8ba1\u7b97\u6b65\u9aa4',detail.records[0]?.kind==='cumulative'?'\u9010\u6bb5\uff08\u672b\u8bfb\u6570 - \u521d\u8bfb\u6570\uff09\u00d7 \u500d\u7387\uff0c\u540c\u5355\u4f4d\u6c42\u548c':'\u53ef\u9760\u533a\u95f4\u91cf \u00d7 \u500d\u7387\uff0c\u540c\u5355\u4f4d\u6c42\u548c'],
 ...(detail.method==='allocated'?[['\u5206\u644a\u6bd4\u4f8b',detail.rule?.metering?.allocationBps!==null&&detail.rule?.metering?.allocationBps!==undefined?detail.rule.metering.allocationBps/100+'%':'\u5f85\u786e\u8ba4'] as [string,string]]:[]),
 ...(detail.method==='estimated'?[['\u4f30\u7b97\u6388\u6743',detail.rule?.metering?.estimateRef??'\u5f85\u786e\u8ba4'] as [string,string]]:[])
 ]}/>
 <Fields title={'\u6765\u6e90\u4e0e\u539f\u59cb\u8bb0\u5f55'} rows={[[ '\u8ba1\u91cf\u5bf9\u8c61',detail.meterId],['\u8fb9\u754c',name(detail.meter.boundary)+' / '+name(detail.meter.role)],['\u6765\u6e90\u5f15\u7528',detail.sourceRef],['\u5feb\u7167\u7248\u672c',m.context.snapshotId],['\u6e90\u7248\u672c',m.source?.sourceVersion??'--']]}/>
 <div className="overflow-x-auto"><DataTable rows={detail.records} rowKey={r=>r.id} columns={[{id:'time',header:'\u8bb0\u5f55\u533a\u95f4',cell:r=>configurationTime(r.from)+' / '+configurationTime(r.to)},{id:'input',header:'\u8f93\u5165\u8bfb\u6570',cell:r=>r.kind==='interval'?r.quantity??'--':(r.startValue??'--')+' / '+(r.endValue??'--')},{id:'multiplier',header:'\u500d\u7387',cell:r=>r.multiplier},{id:'reliable',header:'\u53ef\u9760\u6027',cell:r=>r.reliable?'\u53ef\u9760':'\u5f85\u6838\u5bf9'},{id:'epoch',header:'\u8868\u8ba1\u6bb5',cell:r=>r.epoch+' / '+name(r.event)},{id:'source',header:'\u539f\u59cb\u6765\u6e90',cell:r=>r.sourceRef}]}/></div>
 {reconciliation&&reconciliation.sub!==null&&<Fields title={'\u603b\u5206\u8868\u6838\u5bf9'} rows={[[ '\u603b\u8868\u91cf',format(reconciliation.total,reconciliation.scale)+' '+reconciliation.unit],['\u5206\u8868\u91cf',format(reconciliation.sub,reconciliation.scale)+' '+reconciliation.unit],['\u5f85\u89e3\u91ca\u5dee\u989d',format(reconciliation.difference,reconciliation.scale)+' '+reconciliation.unit],['\u8bf4\u660e','\u4e0d\u81ea\u52a8\u8ba4\u5b9a\u635f\u8017\u6216\u5206\u644a']]}/>}
 <Fields title={'\u5ba2\u6237\u4e0e\u670d\u52a1\u5f52\u5c5e'} rows={[[ '\u5ba2\u6237',customerName(detail.customer?.name??'\u5f85\u5f52\u5c5e')],['\u670d\u52a1',serviceName(detail.serviceItemId)],['\u6709\u6548\u7ed1\u5b9a',detail.binding?detail.binding.id+' / '+configurationTime(detail.binding.from)+' / '+configurationTime(detail.binding.to):'\u5f85\u63a5\u5165'],['\u7ed1\u5b9a\u6765\u6e90',detail.binding?.sourceRef??'--']]}/>
 <Fields title={'\u51bb\u7ed3\u534f\u8bae\u4e0e\u5171\u4eab\u6761\u4ef6'} rows={[[ '\u534f\u8bae\u5f15\u7528',detail.rule?.reference??'\u5f85\u786e\u8ba4'],['\u89c4\u5219\u7248\u672c',(detail.rule?.id??detail.ruleIds.join(' / '))||'\u5f85\u786e\u8ba4'],['\u6709\u6548\u671f',detail.rule?detail.rule.from+' / '+detail.rule.to:'\u5f85\u786e\u8ba4'],['\u6620\u5c04\u7248\u672c',m.source?.mappingVersion??'--'],['\u89c4\u5219\u96c6\u7248\u672c',m.source?.ruleSetVersion??'--'],['\u6708\u5ea6\u79df\u6237',detail.sharing.month?detail.sharing.month+' / '+(detail.sharing.tenantSnapshotId??'\u5f85\u63a5\u5165')+' / '+(detail.sharing.tenants??'--')+' \u6237':'\u4e0d\u9002\u7528'],['\u951a\u5b9a\u79df\u6237',name(detail.sharing.anchor)],['\u5171\u4eab\u6863\u4f4d',name(detail.sharing.state)+(detail.sharing.factorBps===null?'':' / '+detail.sharing.factorBps/100+'%')],['\u6708\u5185\u7b56\u7565',name(detail.rule?.monthPolicy??'pending')],['\u5171\u4eab\u89c4\u5219',detail.sharing.ruleId??'--']]}/>
 {detail.rule&&<Button variant="outline" onClick={()=>setRuleDetail(detail.rule)}>{'\u67e5\u770b\u5b8c\u6574\u51bb\u7ed3\u89c4\u5219'}</Button>}
 </div>}</Drawer>
 <ConfigurationDetail open={!!ruleDetail} onClose={()=>setRuleDetail(null)} title={'\u51bb\u7ed3\u53e3\u5f84\u8be6\u60c5'} description={ruleDetail?.id}>{ruleDetail&&<Fields title={ruleLabel(ruleDetail)} rows={ruleRows(ruleDetail)}/>}</ConfigurationDetail>
 </ShellPageContainer>;
}
