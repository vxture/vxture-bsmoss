'use client';
import Link from 'next/link';
import {useEffect,useRef,useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {LightningIcon} from '@phosphor-icons/react';
import {Button,DataTable,Drawer,EmptyState,Icon,PanelCard,ShellPageContainer} from '@vxture/design-system';
import PageHeading from '../../portal/page-heading';
import ActionMenu from '../../portal/action-menu';
import {OperatorLogo,OperatorName} from '../../portal/operator-identity';
import AnalysisSummary from '../../site-analysis/summary';
import {configurationRowClick,configurationTime} from '../../settings/configuration-layout';
import {formatServiceQuantity as format} from '../../domains/tower-service/quantification';
import {snapshotQuery} from '../../domains/tower-service/query';
import {DEMO_REGION} from '../../domains/map-demo/resources';
import SnapshotControls from '../query-controls';
import ServiceChart from '../services/chart';
import type {EnergyModel} from './energy-model';
import AnalysisNavigation from './analysis-navigation';
import '../../site-analysis/site-analysis.css';
import './judgment.css';
import './energy.css';
import SectionHeading from '../../portal/section-heading';

type Customer=EnergyModel['customers'][number];
const amount=(value:string|null)=>value===null?'\u2014':format(value,3);
const ratio=(value:string|null,total:string|null)=>value===null||total===null||BigInt(total)===0n?'\u2014':format((BigInt(value)*10000n/BigInt(total)).toString(),2)+'%';
const cell=(value:string)=>'"'+(/^[=+\-@\t\r]/.test(value)?"'":'')+value.replace(/"/g,'""')+'"';
export default function EnergyWorkspace({model:m}:{model:EnergyModel}){
 const router=useRouter(),[busy,startTransition]=useTransition(),lock=useRef(false),[detail,setDetail]=useState<Customer|null>(null);
 const a=m.analysis,period=a.period,values={...snapshotQuery(m.context),view:'energy'};
 const href=(patch:Record<string,string|number>={})=>'/tower-service/judgment?'+new URLSearchParams(Object.entries({...values,...patch,operator:'all',view:'energy'}).filter(([k,v])=>k!=='compareSnapshotId'&&String(v)!=='').map(([k,v])=>[k,String(v)]));
 const change=(patch:Record<string,string|number>)=>{if(lock.current)return;const target=href(patch);if(target===href())return;lock.current=true;startTransition(()=>router.push(target,{scroll:false}));};
 useEffect(()=>{if(!busy)lock.current=false;},[busy,m]);
 useEffect(()=>setDetail(null),[m.context.snapshotId,m.context.city,m.context.county]);
 const days=period?(Date.parse(period.end)-Date.parse(period.start))/86400000:0,daily=a.physical!==null&&days?String(BigInt(a.physical)*86400000n/BigInt(Date.parse(period!.end)-Date.parse(period!.start))):null;
 const assigned=a.customerTotals.confirmed===null||a.retained===null?null:(BigInt(a.customerTotals.confirmed)+BigInt(a.retained)).toString();
 const assignedBps=assigned===null||a.physical===null||BigInt(a.physical)===0n?null:(BigInt(assigned)*10000n+BigInt(a.physical)/2n)/BigInt(a.physical);
 const destinations=[
  {id:'measured',label:'\u5ba2\u6237\u72ec\u7acb\u8ba1\u91cf',value:a.customerTotals.measured,color:1},
  {id:'allocated',label:'\u5ba2\u6237\u516c\u5171\u5206\u644a',value:a.customerTotals.allocated,color:2},
  {id:'retained',label:'\u94c1\u5854\u81ea\u7528',value:a.retained,color:3},
  {id:'pending',label:'\u5f85\u786e\u8ba4\u5ba2\u6237\u7528\u7535',value:a.customerTotals.pending,color:4},
  {id:'unallocated',label:'\u516c\u5171\u7528\u7535\u5f85\u5206\u914d',value:a.unallocated,color:5}
 ];
 const allocationGroups=[
  {id:'assigned',label:'\u5df2\u5206\u914d',value:assigned,percentage:assignedBps===null?'\u2014':format(assignedBps.toString(),2)+'%',items:destinations.slice(0,3)},
  {id:'pending',label:'\u5f85\u5206\u914d',value:a.remaining,percentage:assignedBps===null?'\u2014':format((10000n-assignedBps).toString(),2)+'%',items:destinations.slice(3)}
 ];
 const exportRows=()=>{
  const header=['\u5ba2\u6237','\u72ec\u7acb\u8ba1\u91cf(kWh)','\u516c\u5171\u5206\u644a(kWh)','\u5df2\u786e\u8ba4\u5408\u8ba1(kWh)','\u5f85\u786e\u8ba4(kWh)','\u5feb\u7167','\u671f\u95f4\u5f00\u59cb','\u671f\u95f4\u7ed3\u675f'];
  const rows=m.customers.map(r=>[r.name,amount(r.measured),amount(r.allocated),amount(r.confirmed),amount(r.pending),m.context.snapshotId,period?.start??'',period?.end??'']);
  const url=URL.createObjectURL(new Blob(['\ufeff'+[header,...rows].map(r=>r.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download='energy-allocation.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 const number=(value:string|null,warning=false)=><strong className={'tabular-nums whitespace-nowrap'+(warning&&value!==null&&BigInt(value)>0n?' text-warning-text':'')}>{amount(value)}</strong>;
 const detailFields=detail?[
  ['\u72ec\u7acb\u8ba1\u91cf',amount(detail.measured)+' kWh'],['\u516c\u5171\u5206\u644a',amount(detail.allocated)+' kWh'],
  ['\u5df2\u786e\u8ba4\u5408\u8ba1',amount(detail.confirmed)+' kWh'],['\u5f85\u786e\u8ba4',amount(detail.pending)+' kWh'],
  ['\u5206\u8868\u5f85\u786e\u8ba4',amount(detail.pendingMeasured)+' kWh'],['\u5206\u644a\u5f85\u786e\u8ba4',amount(detail.pendingAllocated)+' kWh']
 ]:[];
 return <ShellPageContainer className="site-analysis-page product-page-inset gap-lg energy-workspace">
  <PageHeading title={'\u5206\u6790\u7814\u5224'} icon="chart-line-up" description={'\u56f4\u7ed5\u7ad9\u5740\u8fd0\u884c\u3001\u8fd0\u8425\u4e0e\u7ecf\u8425\u5f00\u5c55\u4e13\u9898\u5206\u6790'}
   context={<><span className="text-body-small text-muted-foreground">{'\u6570\u636e\u622a\u81f3 '}<time dateTime={m.snapshot.dataThrough}>{configurationTime(m.snapshot.dataThrough)}</time></span></>} actions={<AnalysisNavigation context={m.context} active="energy" pending={busy}/>}/>
  <section className="site-analysis-toolbar judgment-analysis-row" aria-busy={busy}>
   <div className="judgment-analysis-context"><SectionHeading title={'\u80fd\u8017\u5206\u6790'} iconVisual={<LightningIcon aria-hidden="true" className="size-icon-xl text-muted-foreground shrink-0"/>}/>
    <AnalysisSummary showIcons={false} label={'\u533a\u57df\u7528\u7535\u6982\u51b5'} items={[
     {key:'physical',label:'\u533a\u57df\u603b\u7528\u7535',shortLabel:'\u603b\u7528\u7535',value:amount(a.physical),unit:'kWh',icon:'chart-bar'},
     {key:'daily',label:'\u6309\u5b9e\u9645\u89c2\u6d4b\u65f6\u957f\u6298\u7b97\u7684\u65e5\u5747\u7528\u7535',shortLabel:'\u65e5\u5747',value:amount(daily),unit:'kWh',icon:'chart-bar'}
    ]}/>
   </div>
   <span role="status" aria-live="polite" className="analysis-loading">{busy?<><Icon name="refresh" size="md" className="animate-spin"/>{'\u6570\u636e\u52a0\u8f7d\u4e2d\u2026'}</>:null}</span>
   <SnapshotControls compact snapshotOnly analysisIcon={null} pending={busy} onNavigate={change} context={m.context} snapshots={m.snapshots} region={DEMO_REGION} href={href}/>
  </section>
  <div className="energy-body" inert={busy} aria-busy={busy}>
    <PanelCard className="energy-trend-panel" title={'\u7528\u7535\u8d8b\u52bf'} icon="chart-line-up" description={'\u5ba2\u6237\u5206\u8868\u4e0e\u516c\u5171\u7528\u7535\u7684\u5468\u671f\u53d8\u5316'} action={<div className="energy-period text-body-small text-muted-foreground"><span>{period?configurationTime(period.start)+' \u2014 '+configurationTime(period.end):'\u8ba1\u91cf\u671f\u95f4\u672a\u63a5\u5165'}</span>{!a.complete&&<span className="text-warning-text">{'\u671f\u95f4\u672a\u5b8c\u7ed3 \u00b7 \u663e\u793a\u5df2\u89c2\u6d4b\u7528\u7535'}</span>}</div>}>
     {a.trend.length?<ServiceChart labels={a.trend.map(p=>p.label)} series={[
      {id:'total',name:'\u603b\u7528\u7535',values:a.trend.map(p=>p.physical)},
      {id:'dedicated',name:'\u5ba2\u6237\u5206\u8868\u7528\u7535',values:a.trend.map(p=>p.dedicated)},
      {id:'common',name:'\u516c\u5171\u7528\u7535',values:a.trend.map(p=>p.common)}
     ]} unit="kWh" scale={3} title={'\u533a\u57df\u7528\u7535\u8d8b\u52bf'} kind={a.trend.length===1?'bar':'line'} legendSummary={<span className="energy-trend-total"><span className="text-muted-foreground">{'\u603b\u7528\u7535'}</span><strong>{amount(a.physical)}</strong><span className="text-muted-foreground">kWh</span></span>}/>:<EmptyState icon="chart-line-up" title={a.whole?'\u603b\u8868\u8d8b\u52bf\u5f85\u63a5\u5165':'\u5f53\u524d\u6743\u9650\u4e0d\u5305\u542b\u6574\u7ad9\u7528\u7535'} description={'\u5ba2\u6237\u8ba1\u91cf\u7ed3\u679c\u5728\u4e0b\u65b9\u5206\u9879\u5c55\u793a\u3002'}/>}
    </PanelCard>
   <div className="energy-allocation-row">
    <PanelCard className="energy-destination-panel" title={'\u7528\u7535\u6784\u6210'} icon="chart-pie" description={'\u6309\u7535\u91cf\u5f52\u5c5e\u72b6\u6001\u7edf\u8ba1'}>
     <div className="energy-composition-total"><span className="text-muted-foreground">{'\u603b\u7528\u7535'}</span><strong>{amount(a.physical)}<small> kWh</small></strong></div>
     {allocationGroups.map(group=><section key={group.id} className="energy-allocation-group" aria-label={group.label}>
      <div className="energy-allocation-heading"><h4 className="font-semibold">{group.label}</h4><span className="text-body-small text-muted-foreground">{group.percentage}</span><strong className={group.id==='pending'?'text-warning-text':''}>{amount(group.value)}<small> kWh</small></strong></div>
      {a.physical!==null&&BigInt(a.physical)>0n&&<div className="energy-composition" role="img" aria-label={group.label+'\uff0c\u5360\u603b\u7528\u7535 '+group.percentage}>{group.items.map(d=><span key={d.id} title={d.label+' '+amount(d.value)+' kWh'} style={{width:(d.value===null?0:Number(BigInt(d.value)*1000000n/BigInt(a.physical!))/10000)+'%',backgroundColor:'var(--chart-'+d.color+')'}}/>)}</div>}
      <dl className="energy-destinations">{group.items.map(d=><div key={d.id}><dt><span className="energy-marker" style={{backgroundColor:'var(--chart-'+d.color+')'}}/>{d.label}</dt><dd>{amount(d.value)}<small> kWh</small></dd></div>)}</dl>
     </section>)}
    </PanelCard>
   <PanelCard className="energy-customer-panel" title={'\u5ba2\u6237\u7528\u7535\u4e0e\u5206\u644a'} icon="users" description={'\u5ba2\u6237\u72ec\u7acb\u8ba1\u91cf\u4e0e\u516c\u5171\u5206\u644a\uff0c\u5355\u4f4d kWh'} action={<Button className="energy-export" disabled={!m.customers.length} onClick={exportRows}><Icon name="download" size="sm"/>{'\u5bfc\u51fa'}</Button>}>
    {m.customers.length?<div className="energy-customer-table" onClick={configurationRowClick(m.customers,setDetail)}><DataTable rows={m.customers} rowKey={r=>r.id} columns={[
     {id:'customer',header:'\u5ba2\u6237',cell:r=><Button variant="ghost" className="energy-customer-name" onClick={()=>setDetail(r)}><OperatorLogo code={r.operator} size="large"/><span className="text-heading-3 font-brand"><OperatorName code={r.operator}/></span></Button>},
     {id:'composition',header:<span className="energy-customer-composition-heading"><span>{'\u5ba2\u6237\u7528\u7535'}</span><span><span className="energy-customer-measured" title={'\u72ec\u7acb\u8ba1\u91cf'}>{'\u8ba1\u91cf'}</span>{'/'}<span className="energy-customer-allocated" title={'\u516c\u5171\u5206\u644a'}>{'\u5206\u644a'}</span></span></span>,align:'right',cell:r=><div className="energy-customer-breakdown"><span className="energy-customer-measured" title={'\u72ec\u7acb\u8ba1\u91cf'}>{number(r.measured)}</span><span className="energy-customer-allocated" title={'\u516c\u5171\u5206\u644a'}>{number(r.allocated)}</span></div>},
     {id:'total',header:'\u5df2\u786e\u8ba4\u5408\u8ba1',align:'right',cell:r=><div className="energy-customer-total">{number(r.confirmed)}<span className="text-body-small text-muted-foreground">{ratio(r.confirmed,a.customerTotals.confirmed)}</span></div>},
     {id:'pending',header:'\u5f85\u786e\u8ba4',align:'right',cell:r=>number(r.pending,true)},
     {id:'actions',header:<span className="sr-only">{'\u64cd\u4f5c'}</span>,align:'center',cell:r=><ActionMenu label={r.name+'\u7684\u64cd\u4f5c'} items={[{id:'details',label:'\u67e5\u770b\u5206\u644a\u8be6\u60c5',onSelect:()=>setDetail(r)}]}/>}
    ]}/></div>:<EmptyState icon="chart-bar" title={'\u5f53\u524d\u533a\u57df\u6ca1\u6709\u5ba2\u6237\u8ba1\u91cf\u8bb0\u5f55'}/>}
   </PanelCard>
   </div>
  </div>

  <Drawer open={!!detail} onClose={()=>setDetail(null)} side="right" width="md" title={detail?detail.name+' \u00b7 \u7528\u7535\u5206\u644a':'\u7528\u7535\u5206\u644a'} closeLabel={'\u5173\u95ed\u5206\u644a\u8be6\u60c5'}>
   {detail&&<div className="flex flex-col gap-lg"><dl className="judgment-fields">{detailFields.map(([label,value])=><div key={label}><dt className="text-body-small text-muted-foreground">{label}</dt><dd className="text-heading-3 font-semibold tabular-nums">{value}</dd></div>)}</dl>
    <h3 className="font-brand text-heading-3">{'\u516c\u5171\u7528\u7535\u5206\u644a\u4f9d\u636e'}</h3>
    {detail.allocatedRecords?<><p>{detail.shareBps===null?'\u6309\u51bb\u7ed3\u534f\u8bae\u8bb0\u5f55\u7684\u6570\u91cf\u6c47\u603b\u3002':'\u9002\u7528\u516c\u5171\u7535\u91cf \u00d7 \u534f\u8bae\u4efd\u989d '+format(String(detail.shareBps),2)+'%'}</p><dl className="judgment-fields"><div><dt className="text-muted-foreground text-body-small">{'\u5df2\u786e\u8ba4\u9002\u7528\u516c\u5171\u7535\u91cf'}</dt><dd>{amount(detail.poolQuantity)+' kWh'}</dd></div><div><dt className="text-muted-foreground text-body-small">{'\u5df2\u786e\u8ba4\u5206\u644a\u7ed3\u679c'}</dt><dd>{amount(detail.allocated)+' kWh'}</dd></div></dl>{detail.ruleRefs.length?detail.ruleRefs.map(ref=><p key={ref} className="break-all text-body-small text-muted-foreground">{ref}</p>):<p className="text-warning-text">{'\u5206\u644a\u534f\u8bae\u5f85\u786e\u8ba4\uff0c\u6682\u672a\u8ba1\u5165\u5df2\u786e\u8ba4\u7528\u7535\u3002'}</p>}</>:<p className="text-muted-foreground">{'\u5f53\u524d\u533a\u57df\u6682\u65e0\u516c\u5171\u5206\u644a\u8bb0\u5f55\u3002'}</p>}
    <h3 className="font-brand text-heading-3">{'\u72ec\u7acb\u8ba1\u91cf\u4f9d\u636e'}</h3><p>{'\u5206\u8868\u8bb0\u5f55 '+format(String(detail.measuredRecords))+' \u6761\uff1b\u5f85\u786e\u8ba4\u8bb0\u5f55 '+format(String(detail.pendingRecords))+' \u6761\u3002'}</p>
    <Button asChild variant="outline"><Link href={'/tower-service/evidence?'+new URLSearchParams({...snapshotQuery(m.context),operator:detail.operator,view:'details',dimension:'all',method:'measured'})}>{'\u67e5\u770b\u5ba2\u6237\u5206\u8868\u4f9d\u636e'}</Link></Button>
    <details><summary className="cursor-pointer text-body-small">{'\u6765\u6e90\u4e0e\u51bb\u7ed3\u7248\u672c'}</summary><div className="flex flex-col gap-sm pt-md text-body-small break-all text-muted-foreground"><p>{m.context.snapshotId}</p><p>{a.sourceVersion}</p>{detail.sourceRefs.map(ref=><p key={ref}>{ref}</p>)}</div></details>
   </div>}
  </Drawer>
 </ShellPageContainer>;
}
