"use client";
import {useEffect,useRef,useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {UsersThreeIcon} from '@phosphor-icons/react';
import {Button,DataTable,Drawer,EmptyState,Icon,PanelCard,SegmentedControl,ShellPageContainer} from '@vxture/design-system';
import PageHeading from '../../portal/page-heading';
import ActionMenu from '../../portal/action-menu';
import {OperatorLogo,OperatorName} from '../../portal/operator-identity';
import {useOperatorCatalog} from '../../portal/operator-identities';
import AnalysisSummary from '../../site-analysis/summary';
import {configurationTime} from '../../settings/configuration-layout';
import {formatServiceQuantity as format} from '../../domains/tower-service/quantification';
import ServiceChart from '../services/chart';
import AnalysisNavigation from './analysis-navigation';
import AnalysisPeriodControls from './analysis-period-controls';
import {analysisHref,sharingMonth,type SharingGrain} from './analysis-links';
import type {OccupancyModel} from './occupancy-model';
import '../../site-analysis/site-analysis.css';
import './judgment.css';
import './sharing.css';
import './occupancy.css';
import SectionHeading from '../../portal/section-heading';

type Customer=OccupancyModel['current']['customers'][number];
const n=(value:number|null)=>value===null?'\u2014':format(String(value));
const signed=(value:number|null)=>value===null?'\u2014':(value>0?'+':'')+n(value);
const blue='var(--color-primary)',lightBlue='color-mix(in srgb,var(--color-primary) 38%,var(--color-background))',ink='var(--color-foreground)';
const reasonText={revision:'\u540c\u671f\u6765\u6e90\u4fee\u8ba2\uff0c\u4e0d\u8ba1\u4e3a\u4e1a\u52a1\u53d8\u5316',current_missing:'\u672c\u671f\u5165\u9a7b\u4f9d\u636e\u4e0d\u5b8c\u6574\uff0c\u53d8\u5316\u5f85\u786e\u8ba4',baseline_missing:'\u7f3a\u5c11\u5b8c\u6574\u57fa\u671f\uff0c\u53d8\u5316\u5f85\u786e\u8ba4',scope_changed:'\u7edf\u8ba1\u8303\u56f4\u4e0d\u4e00\u81f4\uff0c\u6682\u4e0d\u6bd4\u8f83',basis_changed:'\u6765\u6e90\u53e3\u5f84\u4e0d\u4e00\u81f4\uff0c\u6682\u4e0d\u6bd4\u8f83',invalid_order:'\u89c2\u6d4b\u65f6\u95f4\u4e0d\u53ef\u6bd4\uff0c\u6682\u4e0d\u6bd4\u8f83',customer_changed:'\u5ba2\u6237\u5f52\u5c5e\u53d1\u751f\u53d8\u5316\uff0c\u9700\u6838\u5bf9\u8eab\u4efd\u53e3\u5f84'};
const csv=(value:string)=>'"'+(/^[=+\-@\t\r]/.test(value)?"'":'')+value.replace(/"/g,'""')+'"';
export default function OccupancyWorkspace({model:m}:{model:OccupancyModel}){
 const router=useRouter(),[busy,startTransition]=useTransition(),lock=useRef(false);
 const [detail,setDetail]=useState<Customer|null>(null),[chart,setChart]=useState('change');
 const current=m.current,catalog=useOperatorCatalog(),customerName=(code:string)=>catalog.items.find(r=>r.code===code)?.shortName??code;
 const change=(patch:{snapshotId?:string;grain?:SharingGrain})=>{if(lock.current||busy)return;const grain=patch.grain??m.grain,id=sharingMonth(patch.snapshotId??m.context.snapshotId,grain),target=analysisHref({...m.context,snapshotId:id},'occupancy',grain);if(target===analysisHref(m.context,'occupancy',m.grain))return;lock.current=true;startTransition(()=>router.push(target,{scroll:false}));};
 useEffect(()=>{if(!busy)lock.current=false;},[busy,m]);
 useEffect(()=>setDetail(null),[m.context.snapshotId,m.context.city,m.context.county,m.grain]);
 const windowLabel=m.grain==='month'?'\u8fd1 12 \u4e2a\u6708':m.grain==='quarter'?'\u8fd1 8 \u4e2a\u5b63\u5ea6':'\u8fd1 3 \u5e74';
 const period=m.grain==='year'?current.month.slice(0,4)+' \u5e74':m.grain==='quarter'?current.month.slice(0,4)+' \u5e74 \u7b2c '+Math.ceil(Number(current.month.slice(5,7))/3)+' \u5b63\u5ea6':current.month;
 const value=(key:'current'|'added'|'removed'|'net')=>m.trend.map(r=>r[key]===null?null:String(r[key]));
 const series=chart==='size'?[{id:'current',name:'\u671f\u672b\u5165\u9a7b\u5173\u7cfb',values:value('current'),kind:'line' as const}]:[{id:'added',name:'\u65b0\u589e\u5173\u7cfb',values:value('added'),kind:'bar' as const},{id:'removed',name:'\u51cf\u5c11\u5173\u7cfb',values:value('removed'),kind:'bar' as const},{id:'net',name:'\u51c0\u589e\u5173\u7cfb',values:value('net'),kind:'line' as const}];
 const groups=[{id:'added',label:'\u65b0\u589e\u5173\u7cfb',total:current.added,color:blue,items:[{label:'\u5b58\u7eed\u7ad9\u5740\u65b0\u589e',value:current.addedExisting},{label:'\u65b0\u589e\u7ad9\u5740\u5e26\u5165',value:current.addedNewSites}]},{id:'removed',label:'\u51cf\u5c11\u5173\u7cfb',total:current.removed,color:lightBlue,items:[{label:'\u5b58\u7eed\u7ad9\u5740\u51cf\u5c11',value:current.removedExisting},{label:'\u9000\u51fa\u7ad9\u5740\u5e26\u51fa',value:current.removedRetiredSites}]}];
 const exportRows=()=>{
  const rows=[['\u671f\u95f4','\u57fa\u671f\u6708\u4efd','\u5ba2\u6237','\u57fa\u671f\u5165\u9a7b\u5173\u7cfb','\u671f\u672b\u5165\u9a7b\u5173\u7cfb','\u65b0\u589e\u5173\u7cfb','\u51cf\u5c11\u5173\u7cfb','\u51c0\u589e\u5173\u7cfb','\u5b58\u7eed\u7ad9\u5740\u65b0\u589e','\u65b0\u589e\u7ad9\u5740\u5e26\u5165','\u5b58\u7eed\u7ad9\u5740\u51cf\u5c11','\u9000\u51fa\u7ad9\u5740\u5e26\u51fa','\u672c\u671f\u89c2\u6d4b\u65f6\u95f4','\u672c\u671f\u6765\u6e90','\u57fa\u671f\u6765\u6e90','\u5e02','\u53bf'],...current.customers.map(r=>[period,current.baselineMonth,customerName(r.operator),n(r.baseline),n(r.current),n(r.added),n(r.removed),signed(r.net),n(r.addedExisting),n(r.addedNewSites),n(r.removedExisting),n(r.removedRetiredSites),current.asOf??'',current.sourceId??'',current.baselineSourceId??'',m.context.city,m.context.county])];
  const url=URL.createObjectURL(new Blob(['\ufeff'+rows.map(row=>row.map(csv).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='occupancy-change.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 return <ShellPageContainer className="site-analysis-page product-page-inset gap-lg sharing-workspace occupancy-workspace">
  <PageHeading title={'\u5206\u6790\u7814\u5224'} icon="chart-line-up" description={'\u56f4\u7ed5\u7ad9\u5740\u8fd0\u884c\u3001\u8fd0\u8425\u4e0e\u7ecf\u8425\u5f00\u5c55\u4e13\u9898\u5206\u6790'} context={<><span className="text-body-small text-muted-foreground">{'\u6570\u636e\u622a\u81f3 '}<time dateTime={m.snapshot.dataThrough}>{configurationTime(m.snapshot.dataThrough)}</time></span></>} actions={<AnalysisNavigation context={m.context} active="occupancy" grain={m.grain} pending={busy}/>}/>
  <section className="site-analysis-toolbar judgment-analysis-row sharing-analysis-row occupancy-analysis-row" aria-busy={busy}>
   <div className="judgment-analysis-context"><SectionHeading title={'\u5165\u9a7b\u53d8\u5316'} iconVisual={<UsersThreeIcon aria-hidden="true" className="size-icon-xl text-muted-foreground shrink-0"/>}/><AnalysisSummary showIcons={false} label={'\u533a\u57df\u5165\u9a7b\u53d8\u5316\u6982\u51b5'} items={[
    {key:'current',label:'\u671f\u672b\u5165\u9a7b\u5173\u7cfb',shortLabel:'\u671f\u672b',value:n(current.current),unit:'\u6237\u7ad9',icon:'users'},
    {key:'added',label:'\u65b0\u589e\u5165\u9a7b\u5173\u7cfb',shortLabel:'\u65b0\u589e',value:n(current.added),unit:'\u6237\u7ad9',icon:'users'},
    {key:'removed',label:'\u51cf\u5c11\u5165\u9a7b\u5173\u7cfb',shortLabel:'\u51cf\u5c11',value:n(current.removed),unit:'\u6237\u7ad9',icon:'users'},
    {key:'net',label:'\u51c0\u589e\u5165\u9a7b\u5173\u7cfb',shortLabel:'\u51c0\u589e',value:signed(current.net),unit:'\u6237\u7ad9',icon:'users'}
   ]}/></div>
   <span role="status" aria-live="polite" className="analysis-loading">{busy?<><Icon name="refresh" size="md" className="animate-spin"/>{'\u6570\u636e\u52a0\u8f7d\u4e2d\u2026'}</>:null}</span>
   <AnalysisPeriodControls context={m.context} grain={m.grain} snapshots={m.snapshots} date={current.month} busy={busy} onChange={change}/>
  </section>
  <div className="sharing-body" inert={busy} aria-busy={busy}>
   <div className="sharing-period text-body-small text-muted-foreground"><span>{period+(current.asOf?' \u00b7 \u89c2\u6d4b\u81f3 '+configurationTime(current.asOf):' \u00b7 \u5165\u9a7b\u4f9d\u636e\u5f85\u63a5\u5165')}</span><span>{'\u57fa\u671f '+current.baselineMonth+(current.baselineAsOf?' \u00b7 '+configurationTime(current.baselineAsOf):' \u00b7 \u5f85\u63a5\u5165')}</span>{current.reason&&<span>{reasonText[current.reason]}</span>}</div>
   <PanelCard className="sharing-trend-panel occupancy-trend-panel" title={'\u5165\u9a7b\u53d8\u5316\u8d8b\u52bf'} icon="chart-line-up" description={windowLabel+' \u00b7 '+m.range.start+' \u2014 '+m.range.end} action={<SegmentedControl size="md" className="sharing-switch" ariaLabel={'\u5165\u9a7b\u8d8b\u52bf\u6307\u6807'} value={chart} items={[{value:'change',label:'\u589e\u51cf\u53d8\u5316'},{value:'size',label:'\u671f\u672b\u89c4\u6a21'}]} onChange={setChart}/>}>
    {m.trend.some(r=>chart==='size'?r.current!==null:r.comparable)?<ServiceChart labels={m.trend.map(r=>r.label)} axisLabels={m.trend.map(r=>r.label)} series={series} unit={'\u6237\u7ad9'} scale={0} title={'\u533a\u57df\u5165\u9a7b\u53d8\u5316\u8d8b\u52bf'} kind={chart==='size'?'line':'bar'} palette={chart==='size'?[blue]:[blue,lightBlue,ink]} selectedIndex={m.trend.length-1}/>:<EmptyState icon="users" title={'\u5165\u9a7b\u53d8\u5316\u5f85\u786e\u8ba4'} description={current.reason?reasonText[current.reason]:'\u9700\u8981\u8fde\u7eed\u671f\u95f4\u7684\u5b8c\u6574\u5165\u9a7b\u4f9d\u636e'}/>}
   </PanelCard>
   <div className="occupancy-detail-row">
    <PanelCard className="occupancy-composition-panel" title={'\u589e\u51cf\u6784\u6210'} icon="chart-pie" description={'\u6309\u7ad9\u5740\u5728\u4e24\u671f\u7684\u5b58\u7eed\u72b6\u6001\u62c6\u5206'}>
     {groups.map(group=><section className="occupancy-change-group" key={group.id} aria-label={group.label}><div className="occupancy-change-total"><h4 className="font-semibold">{group.label}</h4><strong>{n(group.total)}<small>{' \u6237\u7ad9'}</small></strong></div><dl>{group.items.map((item,i)=><div className="occupancy-change-item" key={item.label}><div><dt>{item.label}</dt><dd>{n(item.value)}</dd></div><div className="occupancy-change-track" role="img" aria-label={item.label+' '+n(item.value)+' \u6237\u7ad9'}><span style={{width:(group.total&&item.value!==null?item.value/group.total*100:0)+'%',backgroundColor:i===0?group.color:ink}}/></div></div>)}</dl></section>)}
    </PanelCard>
    <PanelCard className="occupancy-customer-panel" title={'\u5ba2\u6237\u5165\u9a7b\u53d8\u5316'} icon="users" description={'\u6309\u5177\u4f53\u5ba2\u6237\u4e0e\u7ad9\u5740\u53bb\u91cd\uff0c\u5355\u4f4d\uff1a\u6237\u7ad9'} action={<Button className="sharing-export" onClick={exportRows} disabled={current.current===null}><Icon name="download" size="sm"/>{'\u5bfc\u51fa'}</Button>}>
     <div className="occupancy-customer-table"><DataTable rows={current.customers} rowKey={r=>r.id} columns={[
      {id:'customer',header:'\u5ba2\u6237',cell:r=><Button variant="ghost" className="occupancy-customer-name" onClick={()=>setDetail(r)}><OperatorLogo code={r.operator} size="large"/><span className="font-brand text-heading-3"><OperatorName code={r.operator}/></span></Button>},
      {id:'current',header:'\u671f\u672b\u89c4\u6a21',align:'right',cell:r=><strong>{n(r.current)}</strong>},
      {id:'change',header:<span className="occupancy-change-heading"><span>{'\u65b0\u589e'}</span>{' / '}<span>{'\u51cf\u5c11'}</span></span>,align:'right',cell:r=><div className="occupancy-customer-change"><strong className="text-primary">{n(r.added)}</strong><span className="text-muted-foreground">{n(r.removed)}</span></div>},
      {id:'net',header:'\u51c0\u589e',align:'right',cell:r=><strong>{signed(r.net)}</strong>},
      {id:'actions',header:<span className="sr-only">{'\u64cd\u4f5c'}</span>,align:'center',cell:r=><ActionMenu label={customerName(r.operator)+'\u7684\u5165\u9a7b\u53d8\u5316\u64cd\u4f5c'} items={[{id:'details',label:'\u67e5\u770b\u8be6\u60c5',onSelect:()=>setDetail(r)}]}/>}
     ]}/></div>
    </PanelCard>
   </div>
  </div>

  <Drawer open={!!detail} onClose={()=>setDetail(null)} side="right" width="md" title={'\u5ba2\u6237\u5165\u9a7b\u53d8\u5316\u8be6\u60c5'} closeLabel={'\u5173\u95ed\u5165\u9a7b\u53d8\u5316\u8be6\u60c5'}>{detail&&<div className="flex flex-col gap-lg"><div className="flex items-center gap-md"><OperatorLogo code={detail.operator} size="large"/><h3 className="font-brand text-heading-2"><OperatorName code={detail.operator}/></h3></div><p className="text-body-small text-muted-foreground">{current.baselineMonth+' \u2014 '+current.month+' \u00b7 '+period}</p><dl className="judgment-fields">{[['\u57fa\u671f\u5165\u9a7b\u5173\u7cfb',n(detail.baseline)],['\u671f\u672b\u5165\u9a7b\u5173\u7cfb',n(detail.current)],['\u65b0\u589e\u5173\u7cfb',n(detail.added)],['\u51cf\u5c11\u5173\u7cfb',n(detail.removed)],['\u51c0\u589e\u5173\u7cfb',signed(detail.net)],['\u5b58\u7eed\u7ad9\u5740\u65b0\u589e',n(detail.addedExisting)],['\u65b0\u589e\u7ad9\u5740\u5e26\u5165',n(detail.addedNewSites)],['\u5b58\u7eed\u7ad9\u5740\u51cf\u5c11',n(detail.removedExisting)],['\u9000\u51fa\u7ad9\u5740\u5e26\u51fa',n(detail.removedRetiredSites)]].map(([label,value])=><div key={label}><dt className="text-body-small text-muted-foreground">{label}</dt><dd className="tabular-nums">{value+' \u6237\u7ad9'}</dd></div>)}</dl>{current.reason&&<p>{reasonText[current.reason]}</p>}<p className="text-body-small text-muted-foreground">{'\u672c\u671f\u89c2\u6d4b\uff1a'+(current.asOf?configurationTime(current.asOf):'\u5f85\u63a5\u5165')}</p><dl className="flex flex-col gap-sm text-body-small text-muted-foreground"><dt>{'\u672c\u671f\u6765\u6e90'}</dt><dd className="break-all">{current.sourceId??'\u5f85\u63a5\u5165'}</dd><dt>{'\u57fa\u671f\u6765\u6e90'}</dt><dd className="break-all">{current.baselineSourceId??'\u5f85\u63a5\u5165'}</dd></dl></div>}</Drawer>
 </ShellPageContainer>;
}
