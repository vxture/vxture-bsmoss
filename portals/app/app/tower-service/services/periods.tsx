"use client";
import type {ReactNode} from 'react';
import {Button,EmptyState,Icon,PanelCard,Progress} from '@vxture/design-system';
import ActionMenu from '../../portal/action-menu';
import {OperatorLogo,OperatorName} from '../../portal/operator-identity';
import {formatServiceQuantity as format} from '../../domains/tower-service/quantification';
import ServiceChart from './chart';
import {displaySpec} from './matrix';
import {parseHistoryId} from '../../domains/tower-service/history-calendar';
import type {ServicesModel} from './model';

export const periodLabel=(start:string,end:string)=>{
 if(Date.parse(end)-Date.parse(start)<=3600000)return start.slice(5,16).replace('T',' ');
 const last=new Date(Date.parse(end)-1+8*3600000).toISOString().slice(0,10);
 return start.slice(0,10)===last?last:start.slice(0,10)+' / '+last;
};
const names:Record<string,string>={mobile:'\u79fb\u52a8',telecom:'\u7535\u4fe1',unicom:'\u8054\u901a',broadcast:'\u5e7f\u7535',other:'\u5176\u4ed6'};
const safe=(values:(string|null)[])=>values.every(v=>v===null||BigInt(v)<=BigInt(Number.MAX_SAFE_INTEGER)&&BigInt(v)>=BigInt(Number.MIN_SAFE_INTEGER));
export function changeRate(value:string|null){
 if(value===null)return '\u2014';
 if(value==='new'||value==='unchanged')return '\u4e0d\u53ef\u8ba1\u7b97\uff08\u57fa\u671f\u4e3a\u96f6\uff09';
 return (BigInt(value)>0n?'+':'')+format(value,2)+'%';
}
export default function ServicePeriods({model:m,comparisonOnly=false,metricControl,operatorControl,comparisonControl,onPeriod,onDetails}:{model:ServicesModel;comparisonOnly?:boolean;metricControl:ReactNode;operatorControl:ReactNode;comparisonControl:ReactNode;onPeriod:(id:string)=>void;onDetails:(snapshotId:string,operator:string)=>void}){
 const label=(value:string|null)=>value===null?'\u2014':format(value,m.metric?.scale??0);
 const signed=(value:string|null)=>value===null?'\u2014':(BigInt(value)>0n?'+':'')+label(value);
 const currentPeriod=m.snapshot.businessPeriod?periodLabel(m.snapshot.businessPeriod.start,m.snapshot.businessPeriod.end):'\u670d\u52a1\u5468\u671f\u5f85\u63a5\u5165';
 const baselinePeriod=m.baseline?.businessPeriod?periodLabel(m.baseline.businessPeriod.start,m.baseline.businessPeriod.end):null;
 const isRevision=m.comparison?.kind==='revision';
 const baseStatus=!m.source?'\u670d\u52a1\u6570\u636e\u5f85\u63a5\u5165 \u00b7 \u2014 \u8868\u793a\u672a\u63d0\u4f9b':m.comparison?m.comparison.comparable?(isRevision?'\u540c\u671f\u4fee\u8ba2\uff0c\u4e0d\u4f5c\u4e1a\u52a1\u589e\u957f\u89e3\u8bfb':'\u540c\u6307\u6807\u3001\u540c\u5355\u4f4d\u3001\u540c\u53e3\u5f84\u5bf9\u7167'):'\u53e3\u5f84\u6216\u671f\u95f4\u4e0d\u53ef\u6bd4\uff0c\u4e0d\u8ba1\u7b97\u589e\u51cf':m.filters.comparisonMode==='none'?'\u672a\u9009\u62e9\u57fa\u671f':m.filters.comparisonMode==='custom'?'\u8bf7\u9009\u62e9\u5bf9\u6bd4\u5feb\u7167':'\u6682\u65e0'+(m.filters.comparisonMode==='year'?'\u53bb\u5e74\u540c\u671f':'\u4e0a\u4e00\u5468\u671f')+'\u7684\u5b8c\u6574\u53ef\u6bd4\u6570\u636e';
 const status=(m.source&&!m.source.complete?'\u6240\u9009\u81ea\u7136\u671f\u95f4\u6570\u636e\u4e0d\u5b8c\u6574\uff0c\u7528\u91cf\u4e0e\u589e\u5e45\u4e0d\u4f5c\u5b8c\u6574\u671f\u6bd4\u8f83 \u00b7 ':'')+baseStatus;
 // Explicit null separators break the line across uncaptured intervals. No
 // invented period quantities or resampled daily/monthly totals are inserted.
 const points=m.trend.flatMap((row,index)=>index&&Date.parse(m.trend[index-1].end)<Date.parse(row.start)?[{id:null,label:'\u671f\u95f4\u7f3a\u53e3',values:[] as typeof row.values},{id:row.id,label:periodLabel(row.start,row.end),values:row.values}]:[{id:row.id,label:periodLabel(row.start,row.end),values:row.values}]);
 const axisLabels=points.map(row=>{const p=parseHistoryId(row.id);return !p?row.label:p.grain==='hour'?p.start.slice(11,16):p.grain==='month'?p.start.slice(0,7):p.grain==='year'?p.start.slice(0,4):p.start.slice(5,10);});
 const series=m.operators.map(o=>({id:o.operator,name:names[o.operator]??o.operator,values:points.map(p=>p.values.find(v=>v.operator===o.operator)?.quantity??null)}));
 const chartSafe=safe(series.flatMap(s=>s.values)),hasValues=series.some(s=>s.values.some(v=>v!==null));
 const maximum=m.comparisonOperators.flatMap(r=>[r.previous,r.current]).reduce<bigint>((max,value)=>value!==null&&BigInt(value)>max?BigInt(value):max,1n);
 const amount=(id:string|null,operator:string,value:string|null,current:boolean)=><Button size="sm" variant="ghost" className={'service-comparison-amount tabular-nums'+(current?' service-comparison-amount-current':'')} disabled={value===null||!id} onClick={()=>id&&onDetails(id,operator)} aria-label={(current?'\u672c\u671f':'\u57fa\u671f')+' '+names[operator]+' '+label(value)}>{label(value)}</Button>;
 const position=(value:string)=>Number(BigInt(value)*10000n/maximum)/100;
 // Preserve exact readouts; widen only the local gap for tiny nonzero changes.
 const visual=(previous:string|null,current:string|null)=>{
  const before=previous===null?null:position(previous),after=current===null?null:position(current);
  if(previous===null||current===null||previous===current||!m.comparison?.comparable)return {before,after,widened:false};
  const gap=Math.abs((before??0)-(after??0));
  if(gap>=4)return {before,after,widened:false};
  const high=Math.max(4,before??0,after??0),low=high-4;
  return BigInt(current)>BigInt(previous)?{before:low,after:high,widened:true}:{before:high,after:low,widened:true};
 };
 return comparisonOnly?<PanelCard className="service-fit-panel service-comparison-panel" title={'\u8fd0\u8425\u5546\u53d8\u5316\u5bf9\u7167'} icon="chart-bar" description={[m.metric?m.metric.name+' / '+m.metric.unit:'',m.comparison?.comparable&&m.source?.complete?'':status].filter(Boolean).join(' \u00b7 ')} action={<div className="service-panel-actions">{metricControl}{comparisonControl}</div>}>
   <div className="service-comparison-board">
    <div className="service-comparison-key text-body-small text-muted-foreground">
     <span><i className="service-comparison-key-baseline" aria-hidden="true"/>{'\u57fa\u671f\uff1a'}{baselinePeriod??'\u2014'}</span>
     <span><i className="service-comparison-key-current" aria-hidden="true"/>{'\u672c\u671f\uff1a'}{currentPeriod}</span>
     <span className="service-comparison-unit">{'\u5355\u4f4d\uff1a'+(m.metric?.unit??'\u2014')}</span>
    </div>
    <ul className="service-comparison-rows" style={{gridTemplateRows:`repeat(${Math.max(1,m.comparisonOperators.length)},minmax(calc(var(--space-control-md) * 2),1fr))`}} aria-label={'\u8fd0\u8425\u5546\u5468\u671f\u5bf9\u7167'}>
     {m.comparisonOperators.map(r=>{const v=visual(r.previous,r.current);return <li key={r.operator} className="service-comparison-row">
      <div className="service-comparison-identity text-heading-2 font-medium"><OperatorLogo code={r.operator} size="large"/><OperatorName code={r.operator}/></div>
      <div className="service-comparison-pair">
       <div className="service-comparison-amounts"><span className="text-body-small text-muted-foreground">{'\u57fa\u671f'}</span>{amount(m.baseline?.id??null,r.operator,r.previous,false)}<Icon name="arrow-right" size="sm" className="text-muted-foreground"/><span className="text-body-small text-muted-foreground">{'\u672c\u671f'}</span>{amount(m.context.snapshotId,r.operator,r.current,true)}</div>
       <div className="service-comparison-track">
        {v.before!==null&&<span className="service-comparison-baseline-bar" style={{width:v.before+'%'}} title={'\u57fa\u671f '+label(r.previous)} aria-hidden="true"/>}
        <Progress value={v.after??0} aria-label={'\u672c\u671f '+names[r.operator]+' '+label(r.current)} aria-valuetext={label(r.current)+' '+(m.metric?.unit??'')} className={r.current===null?'invisible':undefined}/>
       </div>
      </div>
      <div className="service-comparison-change"><span className="service-comparison-delta tabular-nums">{r.delta!==null&&BigInt(r.delta)!==0n&&<Icon name={BigInt(r.delta)>0n?'arrow-up':'arrow-down'} size="sm" className="text-muted-foreground"/>}{signed(r.delta)}<span className="text-body-small font-normal text-muted-foreground">{m.metric?.unit}</span></span><span className="text-body-small text-muted-foreground">{isRevision?'\u4fee\u8ba2\u5dee\u503c \u00b7 \u589e\u5e45\u4e0d\u9002\u7528':(r.delta===null?'\u589e\u51cf\u5e45\u5ea6 ':r.delta==='0'?'\u65e0\u53d8\u5316 \u00b7 ':'\u8f83\u57fa\u671f ')+changeRate(r.change)}</span></div>
      <div className="service-comparison-actions"><ActionMenu disabled items={[]} label={(names[r.operator]??r.operator)+'\u7684\u64cd\u4f5c\uff08\u6682\u65e0\u64cd\u4f5c\uff09'}/></div>
     </li>;})}
    </ul>
   </div>
  </PanelCard>:(<PanelCard className="service-fit-panel service-trend-panel" title={'\u670d\u52a1\u91cf\u8d8b\u52bf'} icon="chart-bar" description={m.metric?(m.metric.kind==='stock'?'\u671f\u672b\u914d\u7f6e':'\u5b8c\u6574\u671f\u95f4\u7528\u91cf')+' \u00b7 '+m.metric.name+(displaySpec(m.metric.spec)?' \u00b7 '+displaySpec(m.metric.spec):''):'\u6309\u771f\u5b9e\u4e1a\u52a1\u5468\u671f\u5c55\u793a\u5404\u8fd0\u8425\u5546\u670d\u52a1\u6570\u91cf'} action={<div className="service-panel-actions">{operatorControl}{metricControl??<Button variant="outline" size="md" disabled>{'\u670d\u52a1\u6307\u6807\u5f85\u63a5\u5165'}</Button>}</div>}>
   {!m.source?<EmptyState className="service-empty-state" icon="chart-bar" title={'\u6682\u65e0\u53ef\u7528\u670d\u52a1\u671f\u95f4\u5e8f\u5217'} description={'\u63a5\u5165\u670d\u52a1\u914d\u7f6e\u53ca\u5386\u53f2\u7528\u91cf\u540e\uff0c\u5728\u6b64\u67e5\u770b\u8fd0\u8425\u5546\u8d8b\u52bf\u3002'}/>:chartSafe&&hasValues?<ServiceChart key={m.filters.metric+'|'+m.context.operator} kind={m.metric?.kind==='usage'?'bar':'line'} stack={false} step={m.metric?.kind==='stock'} selectedIndex={points.findIndex(p=>p.id===m.context.snapshotId)} title={m.metric?.name??'\u670d\u52a1\u6570\u91cf'} labels={points.map(p=>p.label)} axisLabels={axisLabels} series={series} unit={m.metric?.unit??''} scale={m.metric?.scale??0} onSelect={index=>{const id=points[index]?.id;if(id)onPeriod(id);}}/>:<EmptyState className="service-empty-state" icon="chart-bar" title={chartSafe?'\u6682\u65e0\u53ef\u6bd4\u671f\u95f4\u6570\u636e':'\u6570\u91cf\u8d85\u51fa\u56fe\u793a\u7cbe\u5ea6'} description={'\u4fdd\u7559\u5b9e\u9645\u5feb\u7167\u503c\uff1b\u7f3a\u5931\u671f\u95f4\u4e0d\u8865\u96f6\u3002'}/>}
  </PanelCard>);
}
