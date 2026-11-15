"use client";
import {useEffect,useRef,useState,useTransition,type CSSProperties} from 'react';
import {useRouter} from 'next/navigation';
import {ShareNetworkIcon} from '@phosphor-icons/react';
import {Button,DataTable,Drawer,EmptyState,Icon,PanelCard,SegmentedControl,ShellPageContainer,Tooltip,TooltipTrigger,TooltipContent} from '@vxture/design-system';
import PageHeading from '../../portal/page-heading';
import ActionMenu from '../../portal/action-menu';
import {OperatorLogo,OperatorName} from '../../portal/operator-identity';
import AnalysisSummary from '../../site-analysis/summary';
import {configurationTime} from '../../settings/configuration-layout';
import {formatServiceQuantity as format} from '../../domains/tower-service/quantification';
import ServiceChart from '../services/chart';
import AnalysisNavigation from './analysis-navigation';
import AnalysisPeriodControls from './analysis-period-controls';
import {analysisHref,sharingMonth,type SharingGrain} from './analysis-links';
import type {SharingModel} from './sharing-model';
import '../../site-analysis/site-analysis.css';
import './judgment.css';
import './sharing.css';
import SectionHeading from '../../portal/section-heading';

type Customer=SharingModel['current']['customers'][number];
const n=(value:number|null)=>value===null?'\u2014':format(String(value));
const percent=(value:number|null)=>value===null?'\u2014':format(String(value),2)+'%';
const bucketNames={vacant:'\u672a\u5165\u9a7b',single:'\u5355\u79df\u6237',double:'\u53cc\u79df\u6237',triple:'\u4e09\u79df\u6237',quadruple:'\u56db\u79df\u6237',fivePlus:'\u4e94\u79df\u6237\u53ca\u4ee5\u4e0a'};
const colors=['var(--color-muted-foreground)','var(--color-primary)','color-mix(in srgb,var(--color-primary) 70%,var(--color-background))','color-mix(in srgb,var(--color-primary) 55%,var(--color-background))','color-mix(in srgb,var(--color-primary) 40%,var(--color-background))','color-mix(in srgb,var(--color-primary) 25%,var(--color-background))'];
const csv=(value:string)=>'"'+(/^[=+\-@\t\r]/.test(value)?"'":'')+value.replace(/"/g,'""')+'"';
export default function SharingWorkspace({model:m}:{model:SharingModel}){
 const router=useRouter(),[busy,startTransition]=useTransition(),lock=useRef(false);
 const [detail,setDetail]=useState<Customer|null>(null),[chart,setChart]=useState('rate');
 const current=m.current,structureMax=Math.max(1,...current.buckets.map(b=>b.count??0)),date=current.month,quarter=Math.ceil(Number(date.slice(5,7))/3),year=date.slice(0,4);
 const change=(patch:{snapshotId?:string;grain?:SharingGrain})=>{if(lock.current||busy)return;const grain=patch.grain??m.grain,id=sharingMonth(patch.snapshotId??m.context.snapshotId,grain),target=analysisHref({...m.context,snapshotId:id},'sharing',grain);if(target===analysisHref(m.context,'sharing',m.grain))return;lock.current=true;startTransition(()=>router.push(target,{scroll:false}));};
 useEffect(()=>{if(!busy)lock.current=false;},[busy,m]);
 useEffect(()=>setDetail(null),[m.context.snapshotId,m.context.city,m.context.county,m.grain]);
 const exportRows=()=>{
  const rows=[['\u5ba2\u6237','\u5165\u9a7b\u7ad9\u5740','\u5171\u4eab\u7ad9\u5740','\u5171\u4eab\u5360\u6bd4(%)','\u5355\u79df\u6237\u7ad9\u5740','\u53cc\u79df\u6237\u7ad9\u5740','\u4e09\u79df\u6237\u7ad9\u5740','\u56db\u79df\u6237\u7ad9\u5740','\u4e94\u79df\u6237\u53ca\u4ee5\u4e0a\u7ad9\u5740','\u89c2\u6d4b\u65f6\u95f4','\u4f9d\u636e\u7248\u672c'],...current.customers.map(r=>[r.operator,n(r.covered),n(r.shared),r.rateBps===null?'\u2014':format(String(r.rateBps),2),n(r.single),n(r.double),n(r.triple),n(r.quadruple),n(r.fivePlus),m.source.asOf??'',m.source.id??''])];
  const url=URL.createObjectURL(new Blob(['\ufeff'+rows.map(row=>row.map(csv).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='sharing-analysis.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 const period=m.grain==='year'?year+' \u5e74':m.grain==='quarter'?year+' \u5e74 \u7b2c '+quarter+' \u5b63\u5ea6':date;
 const windowLabel=m.grain==='month'?'\u8fd1 12 \u4e2a\u6708':m.grain==='quarter'?'\u8fd1 8 \u4e2a\u5b63\u5ea6':'\u8fd1 3 \u5e74';
 const trendDescription=windowLabel+' \u00b7 '+m.range.start+' \u2014 '+m.range.end+' \u00b7 \u671f\u672b\u72b6\u6001';

 const rates=m.trend.map(r=>r.rateBps).filter((v):v is number=>v!==null),valueRange=chart==='rate'&&rates.length?{min:Math.max(0,Math.floor(Math.min(...rates)/100)-1),max:Math.min(100,Math.ceil(Math.max(...rates)/100)+1)}:undefined;
 const chartLabels=m.trend.map(r=>r.label),series=chart==='rate'?[{id:'rate',name:'\u5171\u4eab\u7387',values:m.trend.map(r=>r.rateBps===null?null:String(r.rateBps))}]:(['single','double','triple','quadruple','fivePlus'] as const).map(id=>({id,name:bucketNames[id],values:m.trend.map(r=>{const value=r.buckets.find(b=>b.id===id)?.count;return value===null||value===undefined?null:String(value);})}));
 return <ShellPageContainer className="site-analysis-page product-page-inset gap-lg sharing-workspace">
  <PageHeading title={'\u667a\u80fd\u7814\u5224'} icon="chart-line-up" description={'\u56f4\u7ed5\u7ad9\u5740\u8fd0\u884c\u3001\u8fd0\u8425\u4e0e\u7ecf\u8425\u5f00\u5c55\u4e13\u9898\u5206\u6790'} context={<><span className="text-body-small text-muted-foreground">{'\u6570\u636e\u622a\u81f3 '}<time dateTime={m.snapshot.dataThrough}>{configurationTime(m.snapshot.dataThrough)}</time></span></>} actions={<AnalysisNavigation context={m.context} active="sharing" grain={m.grain} pending={busy}/>}/>
  <section className="site-analysis-toolbar judgment-analysis-row sharing-analysis-row" aria-busy={busy}>
   <div className="judgment-analysis-context"><SectionHeading title={'\u5171\u4eab\u5206\u6790'} iconVisual={<ShareNetworkIcon aria-hidden="true" className="size-icon-xl text-muted-foreground shrink-0"/>}/><AnalysisSummary showIcons={false} label={'\u533a\u57df\u5171\u4eab\u6982\u51b5'} items={[
    {key:'occupied',label:'\u5df2\u5165\u9a7b\u7ad9\u5740',shortLabel:'\u5df2\u5165\u9a7b',value:n(current.occupied),unit:'\u7ad9',icon:'building'},
    {key:'shared',label:'\u81f3\u5c11\u4e24\u6237\u5171\u540c\u5165\u9a7b\u7684\u7ad9\u5740',shortLabel:'\u5171\u4eab',value:n(current.shared),unit:'\u7ad9',icon:'share'},
    {key:'rate',label:'\u5171\u4eab\u7ad9\u5740\u5360\u5df2\u5165\u9a7b\u7ad9\u5740\u7684\u6bd4\u4f8b',shortLabel:'\u5171\u4eab\u7387',value:percent(current.rateBps),icon:'share'},
    {key:'average',label:'\u5df2\u5165\u9a7b\u7ad9\u5740\u7684\u5e73\u5747\u79df\u6237\u6570',shortLabel:'\u5e73\u5747\u79df\u6237',value:current.averageHundredths===null?'\u2014':format(String(current.averageHundredths),2),unit:'\u6237/\u7ad9',icon:'users'}
   ]}/></div>
   <span role="status" aria-live="polite" className="analysis-loading">{busy?<><Icon name="refresh" size="md" className="animate-spin"/>{'\u6570\u636e\u52a0\u8f7d\u4e2d\u2026'}</>:null}</span>
   <AnalysisPeriodControls context={m.context} grain={m.grain} snapshots={m.snapshots} date={date} busy={busy} onChange={change}/>
  </section>
  <div className="sharing-body" inert={busy} aria-busy={busy}>
   <div className="sharing-period text-body-small text-muted-foreground"><span>{period+(m.source.asOf?' \u00b7 \u89c2\u6d4b\u81f3 '+configurationTime(m.source.asOf):' \u00b7 \u5165\u9a7b\u4f9d\u636e\u5f85\u63a5\u5165')}</span>{current.unknownSites>0&&<span>{n(current.unknownSites)+' \u7ad9\u5165\u9a7b\u4fe1\u606f\u5f85\u786e\u8ba4'}</span>}{m.grain!=='month'&&<span>{'\u5f53\u524d\u671f\u95f4\u622a\u81f3\u6700\u65b0\u89c2\u6d4b\u6570\u636e\uff1b\u5386\u53f2\u81ea '+m.range.availableSince+' \u63a5\u5165'}</span>}</div>
   <PanelCard className="sharing-trend-panel" title={'\u5171\u4eab\u8d8b\u52bf'} icon="chart-line-up" description={trendDescription} action={<SegmentedControl size="md" className="sharing-switch" ariaLabel={'\u5171\u4eab\u8d8b\u52bf\u6307\u6807'} value={chart} items={[{value:'rate',label:'\u5171\u4eab\u7387'},{value:'structure',label:'\u5165\u9a7b\u7ed3\u6784'}]} onChange={setChart}/>}>
    {m.trend.some(r=>r.complete)?<ServiceChart labels={chartLabels} axisLabels={chartLabels} series={series} valueRange={valueRange} palette={chart==='rate'?[colors[1]]:colors.slice(1)} unit={chart==='rate'?'%':'\u7ad9'} scale={chart==='rate'?2:0} title={'\u533a\u57df\u5171\u4eab\u8d8b\u52bf'} kind={chart==='rate'?'line':'bar'} selectedIndex={m.trend.length-1} legendSummary={<span className="sharing-trend-summary text-muted-foreground">{m.change.rateBps!==null?'\u8f83\u4e0a\u671f '+(m.change.rateBps>0?'+':'')+format(String(m.change.rateBps),2)+' \u4e2a\u767e\u5206\u70b9':''}</span>}/>:<EmptyState icon="share" title={m.source.id?'\u5165\u9a7b\u4fe1\u606f\u5f85\u786e\u8ba4':'\u5165\u9a7b\u5386\u53f2\u5f85\u63a5\u5165'} description={'\u5171\u4eab\u6c34\u5e73\u9700\u8981\u5b8c\u6574\u7684\u5ba2\u6237\u5165\u9a7b\u5173\u7cfb\u4e0e\u6709\u6548\u671f\u3002'}/>}
   </PanelCard>
   <div className="sharing-detail-row">
    <PanelCard className="sharing-composition-panel" title={'\u5165\u9a7b\u7ed3\u6784'} icon="chart-pie" description={'\u6309\u5177\u4f53\u5ba2\u6237\u53bb\u91cd\u7edf\u8ba1\u7ad9\u5740'}>
     <div className="sharing-composition-chart" role="group" aria-label={'\u5165\u9a7b\u7ed3\u6784'}>{current.buckets.map((bucket,index)=>{const name=bucketNames[bucket.id as keyof typeof bucketNames],share=bucket.count!==null&&current.siteCount?format(String(Math.round(bucket.count*10000/current.siteCount)),2)+'%':'\u2014';return <Tooltip key={bucket.id}><TooltipTrigger asChild><div tabIndex={0} className="sharing-column" aria-label={name+'\uff1a'+n(bucket.count)+' \u7ad9\uff0c\u5360\u6bd4 '+share} style={{'--sharing-color':colors[index],'--sharing-ratio':bucket.count!==null?bucket.count/structureMax:0} as CSSProperties}><div className="sharing-column-plot"><div className="sharing-column-value"><strong>{n(bucket.count)}</strong><small>{share}</small></div><div className="sharing-column-bar"/></div><span className="sharing-column-label">{name}</span></div></TooltipTrigger><TooltipContent variant="surface" side="top"><div className="flex flex-col gap-xs text-body-small"><strong>{name}</strong><span>{'\u7ad9\u5740\u6570\uff1a'+n(bucket.count)+(bucket.count===null?'':' \u7ad9')}</span><span>{'\u5360\u533a\u57df\u7ad9\u5740\uff1a'+share}</span><span className="text-muted-foreground">{period}</span></div></TooltipContent></Tooltip>;})}</div>
     {!current.complete&&<p className="text-body-small text-muted-foreground">{'\u5165\u9a7b\u6765\u6e90\u4e0d\u5b8c\u6574\uff0c\u6682\u4e0d\u8ba1\u7b97\u5171\u4eab\u7387\u4e0e\u7ed3\u6784\u5360\u6bd4\u3002'}</p>}
    </PanelCard>
    <PanelCard className="sharing-customer-panel" title={'\u5ba2\u6237\u5171\u4eab\u60c5\u51b5'} icon="users" description={'\u5404\u5ba2\u6237\u5165\u9a7b\u7ad9\u5740\u53ef\u91cd\u53e0\uff0c\u8986\u76d6\u6570\u4e0d\u76f8\u52a0'} action={<Button className="sharing-export" onClick={exportRows} disabled={!m.source.id}><Icon name="download" size="sm"/>{'\u5bfc\u51fa'}</Button>}>
     {m.source.id?<div className="sharing-customer-table"><DataTable rows={current.customers} rowKey={r=>r.id} columns={[
      {id:'customer',header:'\u5ba2\u6237',cell:r=><Button variant="ghost" className="sharing-customer-name" onClick={()=>setDetail(r)}><OperatorLogo code={r.operator} size="large"/><span className="text-heading-3 font-brand"><OperatorName code={r.operator}/></span></Button>},
      {id:'covered',header:'\u5165\u9a7b\u7ad9\u5740',align:'right',cell:r=><strong className="tabular-nums">{n(r.covered)}</strong>},
      {id:'rate',header:'\u5171\u4eab\u5360\u6bd4',align:'right',cell:r=><strong className="tabular-nums">{percent(r.rateBps)}</strong>},
      {id:'actions',header:<span className="sr-only">{'\u64cd\u4f5c'}</span>,align:'center',cell:r=><ActionMenu label={r.operator+'\u7684\u5171\u4eab\u64cd\u4f5c'} items={[{id:'details',label:'\u67e5\u770b\u8be6\u60c5',onSelect:()=>setDetail(r)}]}/>}
     ]}/></div>:<EmptyState icon="users" title={'\u5ba2\u6237\u5165\u9a7b\u4f9d\u636e\u5f85\u63a5\u5165'} description={'\u8bbe\u5907\u5f52\u5c5e\u4e0e\u54c1\u724c\u6807\u7b7e\u4e0d\u80fd\u4ee3\u66ff\u5ba2\u6237\u5165\u9a7b\u5173\u7cfb\u3002'}/>}
    </PanelCard>
   </div>
  </div>

  <Drawer open={!!detail} onClose={()=>setDetail(null)} side="right" width="md" title={'\u5ba2\u6237\u5171\u4eab\u8be6\u60c5'} closeLabel={'\u5173\u95ed\u5171\u4eab\u8be6\u60c5'}>{detail&&<div className="flex flex-col gap-lg"><div className="flex items-center gap-md"><OperatorLogo code={detail.operator} size="large"/><h3 className="font-brand text-heading-2"><OperatorName code={detail.operator}/></h3></div><dl className="judgment-fields">{[['\u5165\u9a7b\u7ad9\u5740',n(detail.covered)+' \u7ad9'],['\u5171\u4eab\u7ad9\u5740',n(detail.shared)+' \u7ad9'],['\u5171\u4eab\u5360\u6bd4',percent(detail.rateBps)],['\u5355\u79df\u6237\u7ad9\u5740',n(detail.single)+' \u7ad9'],['\u53cc\u79df\u6237\u7ad9\u5740',n(detail.double)+' \u7ad9'],['\u4e09\u79df\u6237\u7ad9\u5740',n(detail.triple)+' \u7ad9'],['\u56db\u79df\u6237\u7ad9\u5740',n(detail.quadruple)+' \u7ad9'],['\u4e94\u79df\u6237\u53ca\u4ee5\u4e0a\u7ad9\u5740',n(detail.fivePlus)+' \u7ad9'],['\u89c2\u6d4b\u65f6\u95f4',m.source.asOf?configurationTime(m.source.asOf):'\u5f85\u63a5\u5165']].map(([label,value])=><div key={label}><dt className="text-body-small text-muted-foreground">{label}</dt><dd className="tabular-nums">{value}</dd></div>)}</dl><p className="text-body-small text-muted-foreground">{'\u5171\u4eab\u7ad9\u5740\u5305\u542b\u53cc\u79df\u6237\u4e0e\u4e09\u79df\u6237\u53ca\u4ee5\u4e0a\u7ad9\u5740\uff1b\u4e0d\u8868\u793a\u8be5\u5ba2\u6237\u7684\u8bbe\u5907\u6570\u91cf\u6216\u53ef\u51fa\u79df\u5bb9\u91cf\u3002'}</p><p className="break-all text-body-small text-muted-foreground">{m.source.id}</p></div>}</Drawer>
 </ShellPageContainer>;
}
