"use client";
import {useEffect,useRef,type CSSProperties} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {Button} from '@vxture/design-system';
import type {EChartsType} from 'echarts/core';
import {n,pct} from '../sites/labels';
export interface AnalysisDonutItem {key:string;label:string;value:number;tone:'success'|'warning'|'critical'|'primary'|'secondary'|'muted';href:string}
const categoryColor={primary:'var(--color-primary)',secondary:'var(--color-primary-hover)',muted:'var(--color-muted-foreground)',success:'var(--color-success)',warning:'var(--color-warning)',critical:'var(--color-destructive)'};
export default function AnalysisDonut({items,totalLabel,selected,label="\u80fd\u6548\u7b49\u7ea7\u7b5b\u9009",scroll=false}:{items:AnalysisDonutItem[];totalLabel:string;selected?:string;label?:string;scroll?:boolean}){
 const node=useRef<HTMLDivElement>(null),root=useRef<HTMLDivElement>(null),router=useRouter();
 const total=items.reduce((sum,item)=>sum+item.value,0);
 useEffect(()=>{
  let disposed=false,chart:EChartsType|undefined,resize:ResizeObserver|undefined,theme:MutationObserver|undefined;
  void Promise.all([import('echarts/core'),import('echarts/charts'),import('echarts/renderers')]).then(([engine,charts,renderers])=>{
   if(disposed||!node.current)return;engine.use([charts.PieChart,renderers.SVGRenderer]);chart=engine.init(node.current,undefined,{renderer:'svg'});
   const render=()=>{if(!chart||!root.current)return;const markers=[...root.current.querySelectorAll<HTMLElement>('[data-analysis-donut-key]')];
    chart.setOption({animation:false,series:[{type:'pie',radius:['70%','92%'],center:['50%','50%'],label:{show:false},labelLine:{show:false},stillShowZeroSum:false,emphasis:{scale:false},emptyCircleStyle:{color:getComputedStyle(node.current!).getPropertyValue('--border').trim()},data:items.map((item,index)=>({name:item.label,value:item.value,itemStyle:{color:getComputedStyle(markers[index]).backgroundColor}}))}]});
   };render();resize=new ResizeObserver(()=>{chart?.resize();render();});resize.observe(node.current);
   theme=new MutationObserver(render);theme.observe(document.documentElement,{attributes:true,attributeFilter:['class','style','data-theme']});
   chart.on('click',event=>{const item=items[event.dataIndex];if(item)router.push(item.href,{scroll});});
  });
  return()=>{disposed=true;resize?.disconnect();theme?.disconnect();chart?.dispose();};
 },[items,router,scroll]);
 return <div ref={root} className="site-analysis-donut">
  <div className="site-analysis-donut-figure"><div ref={node} className="site-analysis-donut-plot" role="img" aria-label={totalLabel+' '+n(total)+' \u7ad9\uff1b'+items.map(item=>item.label+' '+n(item.value)+' \u7ad9 '+pct(total?item.value/total:null)).join('\uff1b')}/><div className="site-analysis-donut-center" aria-hidden="true"><span className="text-body-small text-muted-foreground">{totalLabel}</span><strong className="text-heading-small tabular-nums">{n(total)}</strong><span className="text-body-small text-muted-foreground">{'\u7ad9'}</span></div></div>
  <div className="site-analysis-donut-legend" aria-label={label}>{items.map(item=><Button key={item.key} asChild variant="ghost" className="site-analysis-donut-legend-row"><Link href={item.href} scroll={scroll} aria-current={selected===item.key?'true':undefined} aria-label={item.label+'\uff0c'+n(item.value)+' \u7ad9\uff0c'+pct(total?item.value/total:null)}><span className="flex items-center gap-sm"><span data-analysis-donut-key={item.key} className="site-analysis-donut-marker" style={{backgroundColor:categoryColor[item.tone]} as CSSProperties}/><span>{item.label}</span></span><span className={'tabular-nums '+(item.tone==='success'?'text-success-text':['warning','critical'].includes(item.tone)?'site-analysis-tone-'+item.tone:'text-primary')}>{n(item.value)}{' \u7ad9'}</span><span className="text-body-small tabular-nums text-muted-foreground">{pct(total?item.value/total:null)}</span></Link></Button>)}</div>
 </div>;
}
