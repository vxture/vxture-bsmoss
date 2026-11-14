"use client";
import {useEffect,useRef,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {UsersThreeIcon,ChartPieSliceIcon,ChartLineUpIcon} from '@phosphor-icons/react';
import {Button,Icon,Select,SelectTrigger,SelectValue,SelectContent,SelectItem,ShellPageContainer} from '@vxture/design-system';
import ServiceNavigation from '../service-view-navigation';
import {SERVICE_PATH} from '../service-navigation';
import {saveServicePosition,useServicePosition} from '../service-presentation';
import PageHeading from '../../portal/page-heading';
import {configurationTime} from '../../settings/configuration-layout';
import SnapshotControls from '../query-controls';
import {DEMO_REGION} from '../../domains/map-demo/resources';
import {snapshotQuery} from '../../domains/tower-service/query';
import {formatServiceQuantity as format} from '../../domains/tower-service/quantification';
import ServicePeriods from './periods';
import ServiceMatrix,{displaySpec} from './matrix';
import {parseHistoryId} from '../../domains/tower-service/history-calendar';
import AnalysisSummary from '../../site-analysis/summary';
import type {ServicesModel} from './model';
import '../../site-analysis/site-analysis.css';
import '../../portal/pagination.css';
import './services.css';
import SectionHeading from '../../portal/section-heading';

const views=[{value:'operators',label:'\u6309\u8fd0\u8425\u5546',icon:UsersThreeIcon},{value:'periods',label:'\u5468\u671f\u53d8\u5316',icon:ChartLineUpIcon},{value:'comparison',label:'\u53d8\u5316\u5bf9\u6bd4',icon:ChartPieSliceIcon}];
const operatorNames:Record<string,string>={mobile:'\u79fb\u52a8',telecom:'\u7535\u4fe1',unicom:'\u8054\u901a',broadcast:'\u5e7f\u7535',other:'\u5176\u4ed6'};
export default function ServiceWorkspace({model:m}:{model:ServicesModel}){
 const router=useRouter(),[busy,startTransition]=useTransition();
 const values={...snapshotQuery(m.context),...m.filters,view:m.view};
 const href=(patch:Record<string,string|number>={})=>{const reset=patch.snapshotId&&patch.snapshotId!==m.context.snapshotId?{metric:parseHistoryId(m.context.snapshotId)&&parseHistoryId(patch.snapshotId)||m.trend.some(r=>r.id===patch.snapshotId&&r.compatible)?m.filters.metric:'none',category:'all',ownership:'all',search:'',page:1}:{};const p=new URLSearchParams(Object.fromEntries(Object.entries({...values,...patch,...reset}).map(([k,v])=>[k,String(v)])));p.delete('operatorCount');if(p.get('snapshotId')===p.get('compareSnapshotId'))p.delete('compareSnapshotId');if(!p.get('compareSnapshotId'))p.delete('compareSnapshotId');return '/tower-service/services?'+p;};
 const navigationLock=useRef(false);
 useEffect(()=>{if(!busy)navigationLock.current=false;},[busy,m]);
 const change=(patch:Record<string,string|number>)=>{if(navigationLock.current)return;const target=href({...patch,page:1});if(target===href())return;navigationLock.current=true;startTransition(()=>router.push(target,{scroll:false}));};
 useServicePosition(href());
 const go=(target:string)=>{if(navigationLock.current)return;navigationLock.current=true;saveServicePosition(href());startTransition(()=>router.push(target,{scroll:false}));};
 const activeView=views.find(v=>v.value===m.view)!,AnalysisIcon=activeView.icon;
 const select=(label:string,value:string,items:{value:string;label:string}[],onChange:(value:string)=>void)=><Select disabled={busy} value={value} onValueChange={onChange}><SelectTrigger className="w-auto max-w-full shrink-0" aria-label={label}><SelectValue/></SelectTrigger><SelectContent>{items.map(r=><SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent></Select>;
 const metricSelect=m.metrics.length?select('\u670d\u52a1\u5ea6\u91cf\u4e0e\u89c4\u683c',m.filters.metric,m.metrics.map(v=>({value:v.id,label:v.name+(displaySpec(v.spec)?' \u00b7 '+displaySpec(v.spec):'')+' / '+v.unit})),metric=>change({metric,category:'all',ownership:'all'})):null;
 const operatorSelect=select('\u8fd0\u8425\u5546',m.context.operator,[{value:'all',label:'\u5168\u90e8\u8fd0\u8425\u5546'},...m.allowedOperators.map(value=>({value,label:operatorNames[value]??value}))],operator=>change({operator}));
 const compareSelect=m.snapshots.length>1?select('\u5bf9\u6bd4\u5feb\u7167',m.context.compareSnapshotId??'none',[{value:'none',label:'\u4e0d\u5bf9\u6bd4'},...m.snapshots.filter(s=>s.id!==m.context.snapshotId&&(!parseHistoryId(m.context.snapshotId)||parseHistoryId(s.id))).map(s=>({value:s.id,label:s.stockAsOf.slice(0,16).replace('T',' ')+' / '+s.id.slice(-8)}))],value=>change({comparisonMode:value==='none'?'none':'custom',compareSnapshotId:value==='none'?'':value})):null;
 const openEvidence=(snapshotId:string,metric:string,operator=m.context.operator)=>{const target=m.evidenceTargets[metric];if(!target)return;const p=new URLSearchParams({...snapshotQuery(m.context),snapshotId,operator,view:'details',serviceMetric:metric,service:target.service,dimension:target.dimension,returnTo:href()});if(p.get('compareSnapshotId')===snapshotId)p.delete('compareSnapshotId');go(SERVICE_PATH+'?'+p);};
 const matrixPanel=<ServiceMatrix model={m} operatorControl={operatorSelect} onDetails={(metric,operator)=>openEvidence(m.context.snapshotId,metric,operator)}/>;
 const comparisonControls=<div className="service-panel-actions">{select('\u5bf9\u7167\u65b9\u5f0f',m.filters.comparisonMode,[{value:'previous',label:'\u4e0a\u4e00\u5468\u671f'},{value:'year',label:'\u53bb\u5e74\u540c\u671f'},{value:'custom',label:'\u6307\u5b9a\u5feb\u7167'},{value:'none',label:'\u4e0d\u5bf9\u6bd4'}],comparisonMode=>change({comparisonMode,compareSnapshotId:''}))}{m.filters.comparisonMode==='custom'&&(compareSelect??<Button variant="outline" size="md" disabled>{'\u6682\u65e0\u57fa\u671f\u5feb\u7167'}</Button>)}</div>;
 const openPeriodDetails=(snapshotId:string,operator:string)=>openEvidence(snapshotId,m.filters.metric,operator);
 const periodPanels=<ServicePeriods comparisonOnly={m.view==='comparison'} model={m} metricControl={metricSelect} operatorControl={operatorSelect} comparisonControl={comparisonControls} onPeriod={snapshotId=>change({snapshotId,compareSnapshotId:''})} onDetails={openPeriodDetails}/>;
 return <ShellPageContainer className={'site-analysis-page product-page-inset flex min-w-0 flex-col gap-lg service-workspace'+(m.view==='operators'?' service-workspace-open':' site-analysis-page-fill')}>
  <PageHeading title={'\u670d\u52a1\u91cf\u5316'} icon="users" description={'\u670d\u52a1\u6570\u91cf\u3001\u5468\u671f\u53d8\u5316\u4e0e\u4f9d\u636e\u8ffd\u6eaf'} context={<><span className="text-body-small text-muted-foreground">{'\u6570\u636e\u622a\u81f3 '}<time dateTime={m.snapshot.dataThrough}>{configurationTime(m.snapshot.dataThrough)}</time></span></>} actions={<ServiceNavigation values={values} currentHref={href()} busy={busy} onNavigate={go}/>}/>
  <section className="site-analysis-toolbar service-analysis-row" data-loading={busy} aria-busy={busy}><div className="service-analysis-context"><div className="service-analysis-heading"><SectionHeading title={activeView.label} iconVisual={<AnalysisIcon aria-hidden="true" className="size-icon-xl shrink-0 text-muted-foreground"/>}/></div><div className="service-analysis-summary" role="status"><AnalysisSummary showIcons={false} label={"\u670d\u52a1\u5feb\u7167\u6982\u51b5"} items={m.view!=='operators'&&m.metric?[{key:'quantity',label:m.metric.kind==='stock'?'\u672c\u671f\u914d\u7f6e':'\u672c\u671f\u7528\u91cf',shortLabel:m.metric.kind==='stock'?'\u672c\u671f\u914d\u7f6e':'\u672c\u671f\u7528\u91cf',value:m.totals.quantity===null?'\u2014':format(m.totals.quantity,m.metric.scale),unit:m.metric.unit,icon:'chart-bar' as const},...(m.comparison?.comparable?[{key:'delta',label:m.comparison.kind==='revision'?'\u4fee\u8ba2\u5dee\u503c':'\u8f83\u57fa\u671f',shortLabel:m.comparison.kind==='revision'?'\u4fee\u8ba2\u5dee\u503c':'\u8f83\u57fa\u671f',value:m.comparison.quantity.delta===null?'\u2014':(BigInt(m.comparison.quantity.delta)>0n?'+':'')+format(m.comparison.quantity.delta,m.metric.scale),unit:m.metric.unit,icon:'chart-bar' as const}]:[])]:[{key:"sites",label:m.source?"\u670d\u52a1\u8986\u76d6":"\u7269\u7406\u5e95\u6570",shortLabel:m.source?"\u670d\u52a1\u8986\u76d6":"\u7269\u7406\u5e95\u6570",value:m.source?(m.totals.coverage===null?"\u5f85\u786e\u8ba4":format(String(m.totals.coverage))):format(String(m.physicalSites)),unit:m.source&&m.totals.coverage===null?undefined:"\u7ad9",icon:"building"}]} note={m.source?(m.view==='operators'?"\u5206\u7c7b\u5206\u5355\u4f4d\u8ba1\u91cf":m.metric?.kind==="usage"?"\u671f\u95f4\u7528\u91cf":"\u671f\u672b\u914d\u7f6e"):"\u670d\u52a1\u6765\u6e90\u5f85\u63a5\u5165"}/></div></div><span role="status" aria-live="polite" className="service-analysis-loading">{busy?<><Icon name="refresh" size="md" className="animate-spin"/>{'\u6570\u636e\u52a0\u8f7d\u4e2d\u2026'}</>:null}</span><SnapshotControls pending={busy} onNavigate={change} compact snapshotOnly analysisIcon={null} context={m.context} snapshots={m.snapshots} region={DEMO_REGION} href={href}/></section>
  <div className={'service-page-body service-view-'+m.view} aria-busy={busy} inert={busy}>{m.view==='operators'?matrixPanel:periodPanels}</div>

 </ShellPageContainer>;
}
