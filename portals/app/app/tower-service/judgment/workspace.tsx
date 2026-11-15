'use client';
import Link from 'next/link';
import {useEffect,useRef,useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {FlagIcon,ChartBarIcon} from '@phosphor-icons/react';
import {Button,DataTable,Drawer,EmptyState,Icon,Pagination,Popover,PopoverContent,PopoverTrigger,Select,SelectContent,SelectItem,SelectTrigger,SelectValue,ShellPageContainer,TableTitleCell} from '@vxture/design-system';
import PageHeading from '../../portal/page-heading';
import FilterButton from '../../portal/filter-button';
import ActionMenu from '../../portal/action-menu';
import OperatorIdentity from '../../portal/operator-identity';
import AnalysisSummary from '../../site-analysis/summary';
import {ConfigurationSearch,configurationRowClick,configurationTime} from '../../settings/configuration-layout';
import {DEMO_REGION} from '../../domains/map-demo/resources';
import {snapshotQuery} from '../../domains/tower-service/query';
import {parseHistoryId} from '../../domains/tower-service/history-calendar';
import {formatServiceQuantity as format} from '../../domains/tower-service/quantification';
import type {Finding} from '../../domains/tower-service/judgment';
import SnapshotControls from '../query-controls';
import {serviceName} from '../rule-format';
import ContributionBoard from './contribution-board';
import {label} from './labels';
import type {JudgmentModel} from './model';
import '../../site-analysis/site-analysis.css';
import '../../portal/pagination.css';
import './judgment.css';
import SectionHeading from '../../portal/section-heading';

const views=[{id:'findings',label:'\u5173\u6ce8\u4e8b\u9879',icon:FlagIcon},{id:'contribution',label:'\u53d8\u5316\u8d21\u732e',icon:ChartBarIcon}];
const clean=(value:string)=>value.replace(/\s*\(DEMO\)$/,'');
const csvCell=(value:string)=>'"'+(/^[=+\-@\t\r]/.test(value)?"'":'')+value.replace(/"/g,'""')+'"';
export default function JudgmentWorkspace({model:m}:{model:JudgmentModel}){
 const router=useRouter(),[busy,startTransition]=useTransition(),lock=useRef(false);
 const [detail,setDetail]=useState<Finding|null>(null),[search,setSearch]=useState(m.filters.search),[filterOpen,setFilterOpen]=useState(false),[draft,setDraft]=useState(m.filters.type);
 const values={...snapshotQuery(m.context),...m.filters,view:m.view};
 const href=(patch:Record<string,string|number>={})=>{
  const reset=patch.snapshotId&&patch.snapshotId!==m.context.snapshotId?{compareSnapshotId:'',search:'',page:1,...(!parseHistoryId(m.context.snapshotId)||!parseHistoryId(String(patch.snapshotId))?{metric:'none'}:{})}:{};
  const p=new URLSearchParams(Object.fromEntries(Object.entries({...values,...patch,...reset}).map(([key,value])=>[key,String(value)])));
  p.delete('operatorCount');if(!p.get('compareSnapshotId'))p.delete('compareSnapshotId');if(!p.get('report'))p.delete('report');return '/tower-service/judgment?'+p;
 };
 useEffect(()=>{if(!busy)lock.current=false;},[busy,m]);
 const navigate=(patch:Record<string,string|number>)=>{if(lock.current)return;const target=href(patch);if(target===href())return;lock.current=true;startTransition(()=>router.push(target,{scroll:false}));};
 const change=(patch:Record<string,string|number>)=>navigate({...patch,page:1});
 useEffect(()=>setSearch(m.filters.search),[m.filters.search]);
 useEffect(()=>{if(search===m.filters.search||busy)return;const timer=setTimeout(()=>change({search}),350);return()=>clearTimeout(timer);},[search,m.filters.search,busy]);
 useEffect(()=>setDetail(null),[m.context.snapshotId,m.context.compareSnapshotId,m.context.city,m.context.county,m.context.operator,m.view,m.filters.page,m.filters.search,m.filters.type,m.filters.level]);
 const select=(name:string,value:string,items:{value:string;label:string}[],onChange:(value:string)=>void)=><Select disabled={busy} value={value} onValueChange={onChange}><SelectTrigger className="w-auto max-w-full shrink-0" aria-label={name}><SelectValue/></SelectTrigger><SelectContent>{items.map(item=><SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select>;
 const operators=select('\u8fd0\u8425\u5546',m.context.operator,[{value:'all',label:'\u5168\u90e8\u8fd0\u8425\u5546'},...m.allowedOperators.map(value=>({value,label:label(value)}))],operator=>change({operator}));
 const comparison=select('\u6bd4\u8f83\u57fa\u671f',m.filters.comparisonMode,[{value:'previous',label:'\u4e0a\u4e00\u5468\u671f'},{value:'year',label:'\u53bb\u5e74\u540c\u671f'},{value:'custom',label:'\u6307\u5b9a\u5feb\u7167'},{value:'none',label:'\u4e0d\u6bd4\u8f83'}],comparisonMode=>change({comparisonMode,compareSnapshotId:''}));
 const custom=m.filters.comparisonMode==='custom'?select('\u57fa\u671f\u5feb\u7167',m.context.compareSnapshotId??'none',[{value:'none',label:'\u9009\u62e9\u57fa\u671f'},...m.snapshots.filter(s=>s.id!==m.context.snapshotId).map(s=>({value:s.id,label:s.businessPeriod?.start.slice(0,16).replace('T',' ')??s.stockAsOf.slice(0,16)}))],id=>change({compareSnapshotId:id==='none'?'':id})):null;
 const filters=<Popover open={filterOpen} onOpenChange={open=>{if(open)setDraft(m.filters.type);setFilterOpen(open);}}><PopoverTrigger asChild><FilterButton count={m.filters.type==='all'?0:1}/></PopoverTrigger><PopoverContent align="end" width="sm" aria-label={'\u4e8b\u9879\u7b5b\u9009\u6761\u4ef6'}><label className="flex flex-col gap-sm">{'\u4e8b\u9879\u7c7b\u578b'}{select('\u4e8b\u9879\u7c7b\u578b',draft,[{value:'all',label:'\u5168\u90e8\u7c7b\u578b'},...m.types.map(r=>({value:r.type,label:label(r.type)+' ('+r.count+')'}))],setDraft)}</label><div className="flex justify-end gap-sm mt-md"><Button variant="ghost" onClick={()=>setDraft('all')}>{'\u6e05\u7a7a'}</Button><Button onClick={()=>{change({type:draft});setFilterOpen(false);}}>{'\u5e94\u7528\u7b5b\u9009'}</Button></div></PopoverContent></Popover>;
 const exportFindings=()=>{
  const rows=[['\u7b49\u7ea7','\u5bf9\u8c61','\u8fd0\u8425\u5546','\u4e8b\u9879','\u6307\u6807','\u5b9e\u9645\u503c','\u5355\u4f4d','\u6d89\u53ca\u7ad9\u5740','\u5feb\u7167','\u89c4\u5219\u7248\u672c'],...m.exportRows.map(r=>[label(r.severity),clean(r.customerName),label(r.operator),label(r.type),m.metrics.find(v=>v.id===r.rule.judgment?.metricId)?.name??'',r.actual,unit(r),r.siteIds.join(' / '),m.context.snapshotId,r.rule.id])];
  const url=URL.createObjectURL(new Blob(['\ufeff'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download='judgment-findings.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 const active=views.find(v=>v.id===m.view)??views[0],AnalysisIcon=active.icon,contribution=m.contribution;
 const findingTitle=(r:Finding)=>label(r.type)+' \u00b7 '+(r.rule.judgment?.metricId?(m.metrics.find(v=>v.id===r.rule.judgment?.metricId)?.name??r.rule.judgment.metricId):serviceName(r.rule.service));
 const actual=(r:Finding)=>r.unit==='%'?format(String((BigInt(r.exact.numerator)*100n+BigInt(r.exact.denominator)/2n)/BigInt(r.exact.denominator)),2):format(r.actual.split('.')[0])+(r.actual.includes('.')?'.'+r.actual.split('.')[1].slice(0,6):'');
 const unit=(r:Finding)=>['basis_pending','basis_conflict'].includes(r.type)?'\u6761':label(r.unit);
 return <ShellPageContainer className={'site-analysis-page product-page-inset gap-lg judgment-workspace'+(m.view==='contribution'&&m.filters.dimension!=='sites'?' judgment-workspace-fill':'')}>
  <PageHeading title={'\u667a\u80fd\u7814\u5224'} icon="chart-line-up" description={'\u53d1\u73b0\u91cd\u70b9\u53d8\u5316\uff0c\u5b9a\u4f4d\u6d89\u53ca\u7ad9\u5740\uff0c\u8ffd\u6eaf\u5224\u65ad\u4f9d\u636e'}
   context={<><span className="text-body-small text-muted-foreground">{'\u6570\u636e\u622a\u81f3 '}<time dateTime={m.snapshot.dataThrough}>{configurationTime(m.snapshot.dataThrough)}</time></span></>}
   actions={<nav className="judgment-heading-links" inert={busy} aria-label={'\u667a\u80fd\u7814\u5224\u677f\u5757'}>{views.map(view=><Button asChild variant="outline" key={view.id} className={m.view===view.id?'bg-primary-muted text-primary':undefined}><Link href={href({view:view.id,page:1,search:''})} scroll={false} aria-current={m.view===view.id?'page':undefined} onClick={event=>{event.preventDefault();change({view:view.id,search:''});}}>{view.label}</Link></Button>)}</nav>}/>
  <section className="site-analysis-toolbar judgment-analysis-row" aria-busy={busy}>
   <div className="judgment-analysis-context"><SectionHeading title={active.label} iconVisual={<AnalysisIcon aria-hidden="true" className="size-icon-xl shrink-0 text-muted-foreground"/>}/>
    <AnalysisSummary showIcons={false} label={'\u7814\u5224\u6982\u51b5'} items={contribution?[
     {key:'delta',label:'\u51c0\u53d8\u5316',shortLabel:'\u51c0\u53d8\u5316',value:contribution.total.delta===null?'\u2014':(BigInt(contribution.total.delta)>0n?'+':'')+format(contribution.total.delta,contribution.metric?.scale),unit:contribution.total.delta===null?undefined:contribution.metric?.unit,icon:'chart-bar'},
     {key:'sites',label:'\u53d8\u5316\u7ad9\u5740',shortLabel:'\u53d8\u5316',value:String(contribution.changedSites),unit:'\u7ad9',icon:'building'}
    ]:[
     {key:'attention',label:'\u5173\u6ce8\u4e8b\u9879',shortLabel:'\u5173\u6ce8',value:String(m.totals.attention),unit:'\u9879',icon:'list-checks',tone:'warning'},
     {key:'severe',label:'\u91cd\u70b9\u4e8b\u9879',shortLabel:'\u91cd\u70b9',value:String(m.totals.severe),unit:'\u9879',icon:'list-checks',tone:'critical'},
     {key:'sites',label:'\u6d89\u53ca\u7ad9\u5740\uff08\u53bb\u91cd\uff09',shortLabel:'\u6d89\u53ca',value:format(String(m.totals.sites)),unit:'\u7ad9',icon:'building'}
    ]}/>
   </div>
   <span role="status" aria-live="polite" className="analysis-loading">{busy?<><Icon name="refresh" size="md" className="animate-spin"/>{'\u6570\u636e\u52a0\u8f7d\u4e2d\u2026'}</>:null}</span>
   <SnapshotControls compact snapshotOnly analysisIcon={null} pending={busy} onNavigate={change} context={m.context} snapshots={m.snapshots} region={DEMO_REGION} href={href}/>
  </section>
  <div className="judgment-body" inert={busy} aria-busy={busy}>
   {m.view==='contribution'&&contribution?<ContributionBoard key={m.context.snapshotId+'|'+m.context.compareSnapshotId+'|'+m.filters.metric+'|'+m.context.operator+'|'+m.context.city+'|'+m.context.county} model={m} onChange={change} controls={<>{comparison}{custom}{operators}{m.metrics.length>0&&select('\u5206\u6790\u6307\u6807',m.filters.metric,m.metrics.map(r=>({value:r.id,label:r.name+' / '+r.unit})),metric=>change({metric}))}</>}/>:<section className="judgment-findings site-analysis-section" aria-label={'\u5173\u6ce8\u4e8b\u9879\u6e05\u5355'}>
    <div className="judgment-tools site-analysis-table-tools site-analysis-table-tools-single-line site-analysis-action-row">
     <span className="judgment-evaluation text-body-small text-muted-foreground">{m.rules?'\u5df2\u8bc4\u4f30 '+(m.rules-m.skipped)+' \u6761\u89c4\u5219'+(m.skipped?' \u00b7 '+m.skipped+' \u6761\u5f85\u8bc4\u4f30':''):'\u7814\u5224\u89c4\u5219\u5f85\u63a5\u5165'}</span>
     <ConfigurationSearch value={search} onChange={setSearch} label={'\u641c\u7d22\u5ba2\u6237\u3001\u7ad9\u5740\u6216\u4e8b\u9879'} onReset={()=>{setSearch('');change({search:'',type:'all',level:'all',operator:'all'});}} filters={<>{operators}{select('\u5173\u6ce8\u7b49\u7ea7',m.filters.level,[{value:'all',label:'\u5168\u90e8\u7b49\u7ea7'},{value:'attention',label:'\u5173\u6ce8'},{value:'severe',label:'\u91cd\u70b9'}],level=>change({level}))}{filters}</>} actions={<Button disabled={!m.rowCount} onClick={exportFindings}><Icon name="download" size="sm"/>{'\u5bfc\u51fa'}</Button>}/>
    </div>
    <div className="judgment-comparison-context text-body-small text-muted-foreground"><span>{m.context.businessPeriod?'\u672c\u671f\uff1a'+m.context.businessPeriod.start.slice(0,10):'\u672c\u671f\u5feb\u7167'}</span>{comparison}{custom}<span>{m.context.compareSnapshotId?'\u57fa\u671f\uff1a'+(m.snapshots.find(s=>s.id===m.context.compareSnapshotId)?.businessPeriod?.start.slice(0,10)??m.context.compareSnapshotId):'\u672a\u9009\u62e9\u53ef\u7528\u57fa\u671f\uff0c\u53d8\u5316\u7c7b\u89c4\u5219\u5f85\u8bc4\u4f30'}</span></div>
    {m.rows.length?<div className="judgment-table" onClick={configurationRowClick(m.rows,setDetail)}><DataTable rows={m.rows} rowKey={r=>r.id} columns={[
     {id:'index',header:'#',align:'center',cell:r=>(m.filters.page-1)*m.filters.pageSize+m.rows.indexOf(r)+1},
     {id:'finding',header:'\u5173\u6ce8\u4e8b\u9879',cell:r=><TableTitleCell title={findingTitle(r)} description={clean(r.customerName)} onTitleClick={()=>setDetail(r)}/>},
     {id:'operator',header:'\u8fd0\u8425\u5546',cell:r=><OperatorIdentity code={r.operator}/>},
     {id:'actual',header:'\u5b9e\u9645 / \u9608\u503c',align:'center',cell:r=><div className="flex flex-col gap-xs whitespace-nowrap"><strong title={r.actual+' '+unit(r)} className={r.severity==='severe'?'text-danger-text':'text-warning-text'}>{actual(r)+' '+unit(r)}</strong><span className="text-body-small text-muted-foreground">{label(r.severity)+' \u2265 '+(r.severity==='severe'?r.rule.severe:r.rule.attention)}</span></div>},
     {id:'scope',header:'\u6d89\u53ca\u8303\u56f4',align:'center',cell:r=><span className="whitespace-nowrap tabular-nums">{format(String(r.siteIds.length))+' \u7ad9'}</span>},
     {id:'actions',header:<span className="sr-only">{'\u64cd\u4f5c'}</span>,align:'center',cell:r=><ActionMenu label={findingTitle(r)+'\u7684\u64cd\u4f5c'} items={[{id:'details',label:'\u67e5\u770b\u8be6\u60c5',onSelect:()=>setDetail(r)}]}/>}
    ]}/></div>:<EmptyState icon="list-checks" title={!m.rules?'\u7814\u5224\u89c4\u5219\u5f85\u63a5\u5165':m.skipped===m.rules?'\u5f53\u524d\u8303\u56f4\u6682\u4e0d\u5177\u5907\u8bc4\u4f30\u6761\u4ef6':m.filters.type!=='all'||m.filters.level!=='all'||m.filters.search?'\u5f53\u524d\u7b5b\u9009\u4e0b\u6682\u65e0\u4e8b\u9879':'\u672c\u671f\u672a\u53d1\u73b0\u8fbe\u5230\u9608\u503c\u7684\u4e8b\u9879'} description={!m.rules?'\u63a5\u5165\u5df2\u786e\u8ba4\u89c4\u5219\u540e\u751f\u6210\u5173\u6ce8\u4e8b\u9879\u3002':m.skipped?'\u90e8\u5206\u89c4\u5219\u7f3a\u5c11\u5b8c\u6574\u6765\u6e90\u6216\u53ef\u6bd4\u57fa\u671f\uff0c\u6682\u672a\u53c2\u4e0e\u8bc4\u4f30\u3002':'\u53ef\u5207\u6362\u671f\u95f4\uff0c\u6216\u8fdb\u5165\u53d8\u5316\u8d21\u732e\u67e5\u770b\u5177\u4f53\u589e\u51cf\u3002'}/>}
    <Pagination className="product-pagination site-analysis-pagination site-analysis-action-row" page={m.filters.page} pageCount={Math.max(1,Math.ceil(m.rowCount/m.filters.pageSize))} total={m.rowCount} countLabel={'\u5171\u8ba1\uff1a'+m.rowCount+' \u9879'} pageSize={m.filters.pageSize} pageSizeOptions={[10,20,50,100]} pageSizeLabel={'\u6bcf\u9875\u663e\u793a\u6570\u91cf'} pageSizeOptionTemplate={'\u6bcf\u9875 {size} \u6761'} firstLabel={'\u9996\u9875'} previousLabel={'\u4e0a\u4e00\u9875'} nextLabel={'\u4e0b\u4e00\u9875'} lastLabel={'\u672b\u9875'} onPageChange={page=>navigate({page})} onPageSizeChange={pageSize=>change({pageSize})}/>
   </section>}
  </div>

  <Drawer open={!!detail} onClose={()=>setDetail(null)} side="right" width="md" title={detail?findingTitle(detail):'\u4e8b\u9879\u8be6\u60c5'} description={detail?clean(detail.customerName):undefined} closeLabel={'\u5173\u95ed\u4e8b\u9879\u8be6\u60c5'}>
   {detail&&<div className="flex min-w-0 flex-col gap-lg"><dl className="judgment-fields">{[
    ['\u7b49\u7ea7',label(detail.severity)],['\u5b9e\u9645\u503c',detail.actual+' '+unit(detail)],['\u5173\u6ce8\u9608\u503c',detail.rule.attention??'\u2014'],['\u91cd\u70b9\u9608\u503c',detail.rule.severe??'\u2014'],
    ['\u53d8\u5316\u5bf9\u7167',detail.comparison?detail.comparison.baseline+' \u2192 '+detail.comparison.current+' '+detail.comparison.unit+' ('+detail.comparison.delta+')':'\u4e0d\u9002\u7528'],
    ['\u6838\u67e5\u5efa\u8bae',detail.advice],['\u89c4\u5219\u7248\u672c',detail.rule.id+' / v'+detail.rule.revision],['\u89c4\u5219\u5f15\u7528',detail.rule.reference],['\u9002\u7528\u671f\u95f4',detail.rule.from+' / '+detail.rule.to],['\u672c\u671f\u5feb\u7167',m.context.snapshotId],['\u57fa\u671f\u5feb\u7167',m.context.compareSnapshotId??'\u4e0d\u9002\u7528']
   ].map(([title,value])=><div key={title}><dt className="text-body-small text-muted-foreground">{title}</dt><dd>{value}</dd></div>)}</dl>
   <div className="flex flex-wrap gap-sm"><Button asChild variant="outline"><Link href={detail.href}>{'\u67e5\u770b\u5bf9\u5e94\u4f9d\u636e'}</Link></Button>{detail.type==='service_change'&&<Button variant="outline" onClick={()=>{setDetail(null);change({view:'contribution',metric:detail.rule.judgment!.metricId!,operator:detail.operator});}}>{'\u5206\u6790\u53d8\u5316\u8d21\u732e'}</Button>}</div>
   <h3 className="text-heading-3 font-semibold">{'\u6d89\u53ca\u7ad9\u5740 \u00b7 '+detail.siteIds.length+' \u7ad9'}</h3><div className="judgment-site-links">{detail.siteIds.map(id=><Button asChild variant="ghost" key={id}><Link href={'/tower-service/resources/'+encodeURIComponent(id)+'?'+new URLSearchParams(snapshotQuery({...m.context,snapshotId:detail.siteSnapshots[id]??m.context.snapshotId,compareSnapshotId:null}))}>{id}<Icon name="arrow-right" size="sm"/></Link></Button>)}</div>
   <details><summary className="cursor-pointer text-body-small">{'\u6765\u6e90\u5f15\u7528 \u00b7 '+detail.basisIds.length+' \u6761\u4f9d\u636e'}</summary><div className="flex flex-col gap-sm pt-md break-all text-body-small text-muted-foreground">{detail.sourceRefs.map(ref=><span key={ref}>{ref}</span>)}</div></details>
   </div>}
  </Drawer>
 </ShellPageContainer>;
}
