"use client";

import {useState,type MouseEvent} from "react";
import {BarChart,Tooltip,TooltipTrigger,TooltipContent,type BarChartProps} from "@vxture/design-system";

// Keep the official chart's readout and keyboard navigation; mark the active hour.
export default function AnalysisHourlyChart({metricLabel,formatLabel=label=>label+":00",...props}:BarChartProps&{metricLabel:string;formatLabel?:(label:string)=>string}) {
 const [pointer,setPointer]=useState<{x:number;y:number;height:number;index:number}|null>(null);
 function move(event:MouseEvent<HTMLDivElement>) {
  const target=event.target;
  if(!(target instanceof Element))return;
  const column=target.closest('[role="img"] > div');
  if(!column){if(!target.closest('[role="img"]'))setPointer(null);return;}
  const index=column?.parentElement?Array.from(column.parentElement.children).indexOf(column):-1;
  if(index<0||index>=props.data.length){setPointer(null);return;}
  // The floating tooltip replaces the chart's delayed browser title tooltip.
  column?.removeAttribute("title");
  const bounds=event.currentTarget.getBoundingClientRect(),bar=column.getBoundingClientRect(),plot=column.parentElement!.getBoundingClientRect();
  const next={x:bar.left+bar.width/2-bounds.left,y:plot.top-bounds.top,height:plot.height,index};
  setPointer(previous=>previous?.index===index&&previous.x===next.x&&previous.y===next.y&&previous.height===next.height?previous:next);
 }
 const active=pointer?props.data[pointer.index]:undefined;
 return <div className={"site-analysis-hourly-chart"+(props.data.length===1?" site-analysis-hourly-chart-single":"")} onMouseMove={move} onMouseLeave={()=>setPointer(null)} onKeyDownCapture={event=>{if(event.key==="Escape")setPointer(null);}}>
  <BarChart {...props}/>
  {active&&pointer&&<span aria-hidden="true" className="site-analysis-chart-cursor" style={{left:pointer.x,top:pointer.y,height:pointer.height}}/>}
  <Tooltip open={!!active} onOpenChange={open=>{if(!open)setPointer(null);}} disableHoverableContent>
   <TooltipTrigger asChild><span aria-hidden="true" className="site-analysis-chart-pointer" style={{left:pointer?.x??0,top:pointer?.y??0}}/></TooltipTrigger>
   <TooltipContent side="top" align="center" updatePositionStrategy="always" className="site-analysis-chart-tooltip pointer-events-none" aria-live="off">
    {active&&<span className="flex items-center gap-sm tabular-nums"><span>{formatLabel(active.label)}</span><span>{metricLabel}</span><strong>{props.formatValue?.(active.value)??active.value}</strong></span>}
   </TooltipContent>
  </Tooltip>
 </div>;
}
