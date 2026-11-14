"use client";
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {ToggleGroup,ToggleGroupItem} from '@vxture/design-system';
import type {EChartsType} from 'echarts/core';
import {formatServiceQuantity} from '../../domains/tower-service/quantification';

export type ServiceSeries={id:string;name:string;values:(string|null)[];kind?:'bar'|'line'};
// Values retain integer precision for labels. Unsafe integers are never plotted
// as rounded quantities; the surrounding matrix remains the exact readout.
export default function ServiceChart({labels,series,unit,scale,title,links,onSelect,kind='bar',selectedIndex,axisLabels,stack=false,step=false,legendSummary,palette,valueRange}:{labels:string[];series:ServiceSeries[];unit:string;scale:number;title:string;links?:string[];onSelect?:(index:number)=>void;kind?:'bar'|'line';selectedIndex?:number;axisLabels?:string[];stack?:boolean;step?:boolean;legendSummary?:ReactNode;palette?:string[];valueRange?:{min:number;max:number}}){
 const root=useRef<HTMLDivElement>(null),plot=useRef<HTMLDivElement>(null),instance=useRef<EChartsType|null>(null),active=useRef(0);
 const [hidden,setHidden]=useState<string[]>([]),visible=series.filter(s=>!hidden.includes(s.id));
 const signature=JSON.stringify({labels,axisLabels,series:visible,unit,scale,kind,selectedIndex,stack,step,palette,valueRange});
 const select=useRef(onSelect);select.current=onSelect;
 useEffect(()=>{
  let disposed=false,chart:EChartsType|undefined,resize:ResizeObserver|undefined,theme:MutationObserver|undefined;
  active.current=0;
  void Promise.all([import('echarts/core'),import('echarts/charts'),import('echarts/components'),import('echarts/renderers')]).then(([engine,charts,components,renderers])=>{
   if(disposed||!plot.current||!root.current)return;
   engine.use([charts.BarChart,charts.LineChart,components.GridComponent,components.TooltipComponent,renderers.SVGRenderer]);
   chart=engine.init(plot.current,undefined,{renderer:'svg'});instance.current=chart;
   const render=()=>{
    if(!root.current||!plot.current||!chart)return;
    const element=root.current,style=getComputedStyle(element),fontSize=parseFloat(style.fontSize);
    const read=(name:string)=>getComputedStyle(element.querySelector<HTMLElement>('[data-chart-'+name+']')!);
    const gap=parseFloat(read('spacing').width),ink=style.color,muted=read('muted').color,border=read('border').borderTopColor;
    const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d',{willReadFrequently:true});
    const rgb=(value:string)=>{if(!ctx)return value;ctx.clearRect(0,0,1,1);ctx.fillStyle=value;ctx.fillRect(0,0,1,1);const [r,g,b,a]=ctx.getImageData(0,0,1,1).data;return 'rgba('+r+','+g+','+b+','+a/255+')';};
    const colors=visible.map(s=>rgb(getComputedStyle(element.querySelector<HTMLElement>('[data-service-color="'+s.id+'"]')!).backgroundColor));
    const rotate=kind==='line'||axisLabels?0:plot.current.clientWidth/Math.max(labels.length,1)<fontSize*4?45:0;
    chart.setOption({animation:false,textStyle:{fontFamily:style.fontFamily,fontSize,color:ink},grid:{left:gap*4,right:gap,top:gap*3,bottom:rotate?fontSize*5:fontSize*3},tooltip:{trigger:'axis',confine:true,backgroundColor:read('surface').backgroundColor,borderColor:border,textStyle:{color:ink,fontFamily:style.fontFamily,fontSize},axisPointer:{type:'line',lineStyle:{color:muted,type:'dashed'}},formatter:(params:unknown)=>{
     const points=params as {dataIndex:number}[],index=points[0]?.dataIndex??0,box=document.createElement('div');box.className='flex flex-col gap-xs text-body-small';const heading=document.createElement('strong');heading.textContent=labels[index];box.append(heading);
     for(const s of visible){const line=document.createElement('div');line.className='flex items-center justify-between gap-lg';const name=document.createElement('span');name.textContent=s.name;const value=document.createElement('strong');value.className='tabular-nums';value.textContent=s.values[index]===null?'\u5f85\u786e\u8ba4':formatServiceQuantity(s.values[index],scale)+' '+unit;line.append(name,value);box.append(line);}return box;
    }},xAxis:{type:'category',boundaryGap:kind==='bar',data:labels,axisTick:{show:false},axisLine:{lineStyle:{color:border}},axisLabel:{interval:kind==='line'||axisLabels?'auto':0,rotate,hideOverlap:true,color:muted,fontSize,formatter:(label:string,index:number)=>axisLabels?.[index]??label.replace(/^\d{4}-/,'').replace(/ \/ \d{4}-/,'~')}},yAxis:{type:'value',splitNumber:3,min:valueRange?.min,max:valueRange?.max,minInterval:scale?undefined:1,axisLabel:{color:muted,fontSize},splitLine:{lineStyle:{color:border,type:'dashed'}}},series:visible.map((s,i)=>({id:s.id,type:s.kind??kind,stack:stack?'usage':undefined,step:step?'end':false,name:s.name,data:s.values.map(value=>value===null?null:Number(value)/10**scale),connectNulls:false,symbol:'circle',symbolSize:(_value:unknown,params:{dataIndex:number})=>params.dataIndex===selectedIndex?gap:gap/2,itemStyle:{color:colors[i]},lineStyle:{color:colors[i]},barMaxWidth:gap*2,label:{show:!stack&&(s.kind??kind)==='bar'&&plot.current!.clientWidth/Math.max(labels.length,1)/Math.max(visible.length,1)>fontSize*3.5,position:'top',color:muted,fontSize,formatter:(point:{dataIndex:number})=>s.values[point.dataIndex]===null?'':formatServiceQuantity(s.values[point.dataIndex],scale)},emphasis:{focus:'series'},cursor:select.current?'pointer':'default'}))},true);
   };
   render();resize=new ResizeObserver(()=>{chart?.resize();render();});resize.observe(plot.current);
   theme=new MutationObserver(render);theme.observe(document.documentElement,{attributes:true,attributeFilter:['class','style','data-theme']});
   chart.on('click',event=>{if(event.dataIndex!==undefined)select.current?.(event.dataIndex);});
  });
  return()=>{disposed=true;resize?.disconnect();theme?.disconnect();chart?.dispose();instance.current=null;};
 },[signature]);
 return <div ref={root} className="service-chart text-body-small text-foreground">
  <span className="sr-only" aria-hidden="true"><span data-chart-spacing className="inline-block w-md"/><span data-chart-muted className="text-muted-foreground"/><span data-chart-border className="border-t border-chart-grid"/><span data-chart-surface className="bg-card"/>{series.map((s,i)=><span key={s.id} data-service-color={s.id} style={{backgroundColor:palette?.[i]??'var(--chart-'+(i%6+1)+')'}}/>)}</span>
  <div className="flex flex-wrap items-center justify-between gap-sm"><ToggleGroup type="multiple" value={visible.map(s=>s.id)} onValueChange={ids=>setHidden(series.filter(s=>!ids.includes(s.id)).map(s=>s.id))} aria-label={title+'\u56fe\u4f8b'}>{series.map((s,i)=><ToggleGroupItem size="sm" key={s.id} value={s.id} className="service-legend-item"><span className="service-legend-marker" style={{backgroundColor:palette?.[i]??'var(--chart-'+(i%6+1)+')'}}/>{s.name}</ToggleGroupItem>)}</ToggleGroup>{legendSummary??<span className="text-muted-foreground">{'\u5355\u4f4d\uff1a'+unit}</span>}</div>
  <div ref={plot} className="service-chart-plot" role="img" tabIndex={0} aria-label={title+'\uff0c\u5de6\u53f3\u65b9\u5411\u952e\u67e5\u770b'+(onSelect?'\uff0c\u56de\u8f66\u4e0b\u94bb':'')} onFocus={()=>instance.current?.dispatchAction({type:'showTip',seriesIndex:0,dataIndex:active.current})} onBlur={()=>instance.current?.dispatchAction({type:'hideTip'})} onKeyDown={event=>{
   if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();active.current=event.key==='Home'?0:event.key==='End'?labels.length-1:Math.max(0,Math.min(labels.length-1,active.current+(event.key==='ArrowRight'?1:-1)));instance.current?.dispatchAction({type:'showTip',seriesIndex:0,dataIndex:active.current});}
   if(event.key==='Enter'&&labels.length){event.preventDefault();onSelect?.(active.current);}if(event.key==='Escape')instance.current?.dispatchAction({type:'hideTip'});
  }}/>
  {!visible.length&&<p role="status" className="text-muted-foreground">{'\u70b9\u51fb\u56fe\u4f8b\u663e\u793a\u5206\u9879'}</p>}
  {links&&<span className="sr-only">{links.map((link,i)=><a key={link} href={link}>{labels[i]}</a>)}</span>}
 </div>;
}
