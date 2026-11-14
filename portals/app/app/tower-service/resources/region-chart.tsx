"use client";
import {useEffect,useRef} from 'react';
import {useRouter} from 'next/navigation';
import type {EChartsType} from 'echarts/core';
import {n} from '../../sites/labels';

export interface RegionChartSeries {key:string;label:string;color:string;values:number[]}
export interface RegionChartRow {code:string;name:string;cityName:string;sites:number;total:number;drill:string|null}
export default function RegionChart({rows,series,label}:{rows:RegionChartRow[];series:RegionChartSeries[];label:string}){
 const node=useRef<HTMLDivElement>(null),root=useRef<HTMLDivElement>(null),instance=useRef<EChartsType|null>(null),active=useRef(0),router=useRouter();
 useEffect(()=>{
  let disposed=false,chart:EChartsType|undefined,resize:ResizeObserver|undefined,theme:MutationObserver|undefined,hoverSeriesKey:string|null=null;
  active.current=0;
  void Promise.all([import('echarts/core'),import('echarts/charts'),import('echarts/components'),import('echarts/renderers')]).then(([engine,charts,components,renderers])=>{
   if(disposed||!node.current||!root.current)return;
   engine.use([charts.BarChart,components.GridComponent,components.TooltipComponent,renderers.SVGRenderer]);
   chart=engine.init(node.current,undefined,{renderer:'svg'});instance.current=chart;
   const render=()=>{
    if(!chart||!node.current||!root.current)return;
    const style=getComputedStyle(root.current),fontSize=parseFloat(style.fontSize),space=(token:string)=>parseFloat(getComputedStyle(root.current!.querySelector<HTMLElement>('[data-chart-spacing="'+token+'"]')!).width),medium=space('md'),large=space('lg');
    // Resolve modern theme colors to RGB so ECharts can derive emphasis/blur colors.
    const paletteCanvas=document.createElement('canvas');paletteCanvas.width=paletteCanvas.height=1;
    const paletteContext=paletteCanvas.getContext('2d',{willReadFrequently:true});
    const rgb=(color:string)=>{if(!paletteContext)return color;paletteContext.clearRect(0,0,1,1);paletteContext.fillStyle=color;paletteContext.fillRect(0,0,1,1);const [r,g,b,a]=paletteContext.getImageData(0,0,1,1).data;return 'rgba('+r+','+g+','+b+','+a/255+')';};
    const colors=[...root.current.querySelectorAll<HTMLElement>('[data-region-series]')].map(marker=>rgb(getComputedStyle(marker).backgroundColor)),foreground=style.color,muted=getComputedStyle(root.current.querySelector<HTMLElement>('[data-chart-muted]')!).color,border=getComputedStyle(root.current.querySelector<HTMLElement>('[data-chart-border]')!).borderTopColor;
    const left=Math.ceil(Math.max(...series.flatMap(s=>s.values),1)).toLocaleString().length*fontSize*0.65+medium,width=Math.max(1,node.current.clientWidth-left-medium),perColumn=width/Math.max(rows.length,1),rotate=perColumn<fontSize*4?45:0;
    // Every region keeps its data column; only crowded axis labels are sampled.
    const every=Math.max(1,Math.ceil((rotate?fontSize*2:fontSize*4)/perColumn)),showValues=perColumn/Math.max(series.length,1)>fontSize*3.5;
    chart.setOption({animation:false,textStyle:{fontFamily:style.fontFamily,fontSize,color:foreground},grid:{left,right:medium,top:large,bottom:rotate?fontSize*6:fontSize*3},tooltip:{trigger:'axis',confine:true,appendToBody:false,backgroundColor:getComputedStyle(root.current.querySelector<HTMLElement>('[data-chart-surface]')!).backgroundColor,borderColor:border,textStyle:{color:foreground,fontFamily:style.fontFamily,fontSize},axisPointer:{type:'line',lineStyle:{color:muted,type:'dashed'}},formatter:(params:unknown)=>{
     const point=(Array.isArray(params)?params[0]:params) as {dataIndex?:number}|undefined,row=rows[point?.dataIndex??0],index=point?.dataIndex??0;
     const box=document.createElement('div');box.className='flex flex-col gap-xs text-body-small';
     const title=document.createElement('strong');title.textContent=(row.cityName?row.cityName+' / ':'')+row.name+' \u00b7 \u5171 '+n(row.sites)+' \u7ad9 \u00b7 \u8bbe\u5907 '+n(row.total)+' \u9879';box.append(title);
     for(let s=0;s<series.length;s++){const focused=series[s].key===hoverSeriesKey,line=document.createElement('div');line.className='flex items-center justify-between gap-lg rounded-sm px-xs'+(focused?' bg-muted font-semibold text-foreground':' text-muted-foreground');line.dataset.tooltipActive=String(focused);line.dataset.seriesKey=series[s].key;const name=document.createElement('span');name.className='inline-flex items-center gap-xs';const marker=document.createElement('span');marker.className='resource-region-marker';marker.style.backgroundColor=colors[s];name.append(marker,document.createTextNode(series[s].label));const value=document.createElement('span');value.className='tabular-nums';value.textContent=n(series[s].values[index])+' \u9879';line.append(name,value);box.append(line);}return box;
    }},xAxis:{type:'category',triggerEvent:rows.some(r=>r.drill),data:rows.map(r=>r.code),axisTick:{show:false},axisLine:{lineStyle:{color:border}},axisLabel:{interval:every-1,rotate,color:muted,fontSize,fontFamily:style.fontFamily,formatter:(code:string)=>rows.find(r=>r.code===code)?.name??code,hideOverlap:true}},yAxis:{type:'value',min:0,minInterval:1,splitNumber:3,axisLabel:{color:muted,fontSize,fontFamily:style.fontFamily,formatter:(value:number)=>n(value)},splitLine:{lineStyle:{color:border,type:'dashed'}}},series:series.map((s,index)=>({name:s.label,type:'bar',cursor:rows.some(r=>r.drill)?'pointer':'default',data:s.values,itemStyle:{color:colors[index]},barMaxWidth:large,barCategoryGap:'28%',barGap:'20%',emphasis:{focus:'series'},label:{show:showValues,position:'top',color:muted,fontFamily:style.fontFamily,fontSize,formatter:(point:{dataIndex:number;value:number})=>n(point.value)}}))},true);
   };
   render();resize=new ResizeObserver(()=>{chart?.resize();render();});resize.observe(node.current);
   theme=new MutationObserver(render);theme.observe(document.documentElement,{attributes:true,attributeFilter:['class','style','data-theme']});
   chart.on('click',event=>{const row=event.componentType==='xAxis'?rows.find(r=>r.code===event.value):rows[event.dataIndex];const href=row?.drill;if(href)router.push(href,{scroll:false});});
   chart.on('mouseover',event=>{if(event.componentType!=='series'||event.seriesIndex===undefined)return;hoverSeriesKey=series[event.seriesIndex]?.key??null;chart?.dispatchAction({type:'showTip',seriesIndex:event.seriesIndex,dataIndex:event.dataIndex});});
   chart.on('mouseout',()=>{hoverSeriesKey=null;});
  });
  return()=>{disposed=true;resize?.disconnect();theme?.disconnect();chart?.dispose();instance.current=null;};
 },[rows,series,router]);
 return <div ref={root} className="resource-column-chart text-body-small text-foreground" role="group" aria-label={label}>
 <span className="sr-only" aria-hidden="true">{series.map(s=><span key={s.key} data-region-series={s.key} style={{backgroundColor:s.color}}/>)}<span data-chart-spacing="md" className="inline-block w-md"/><span data-chart-spacing="lg" className="inline-block w-lg"/><span data-chart-muted className="text-muted-foreground"/><span data-chart-border className="border-t border-chart-grid"/><span data-chart-surface className="bg-card"/></span>
 <div ref={node} className="resource-column-plot" role="img" tabIndex={0} aria-label={label+'\uff0c'+rows.length+'\u4e2a\u533a\u5212\uff0c\u5355\u4f4d\uff1a\u9879\u3002\u5de6\u53f3\u65b9\u5411\u952e\u9009\u62e9'+(rows.some(r=>r.drill)?'\uff0c\u56de\u8f66\u4e0b\u94bb\u533a\u53bf':'')} onFocus={()=>instance.current?.dispatchAction({type:'showTip',seriesIndex:0,dataIndex:active.current})} onBlur={()=>instance.current?.dispatchAction({type:'hideTip'})} onKeyDown={event=>{
  if(!rows.length)return;
  if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();active.current=event.key==='Home'?0:event.key==='End'?rows.length-1:Math.max(0,Math.min(rows.length-1,active.current+(event.key==='ArrowRight'?1:-1)));instance.current?.dispatchAction({type:'showTip',seriesIndex:0,dataIndex:active.current});}
  if(event.key==='Enter'){event.preventDefault();const href=rows[active.current].drill;if(href)router.push(href,{scroll:false});}
  if(event.key==='Escape')instance.current?.dispatchAction({type:'hideTip'});
 }}/>
 {!series.length&&<p className="absolute inset-0 flex items-center justify-center text-body-small text-muted-foreground" role="status">{'\u70b9\u51fb\u56fe\u4f8b\u663e\u793a\u5206\u9879'}</p>}
 </div>;
}
