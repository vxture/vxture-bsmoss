'use client';
import {useEffect,useRef} from 'react';
import * as echarts from 'echarts/core';
import {LineChart} from 'echarts/charts';
import {GridComponent,TooltipComponent,MarkLineComponent} from 'echarts/components';
import {SVGRenderer} from 'echarts/renderers';
import {comparisonValue,type ComparisonMetric} from '../../domains/map-demo/comparison-rules.ts';
import type {StationDetail} from '../../domains/map-demo/types.ts';
echarts.use([LineChart,GridComponent,TooltipComponent,MarkLineComponent,SVGRenderer]);
export const COMPARE_COLORS=['#7fcbb3','#d8bb82','#9db7e3','#c3a1ce'];
export default function ComparisonChart({entries,metric,hour,onHour}:{entries:{detail:StationDetail;color:string}[];metric:ComparisonMetric;hour:number;onHour:(hour:number)=>void}) {
  const node=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!node.current)return;
    const chart=echarts.init(node.current,undefined,{renderer:'svg'});
    chart.setOption({animationDuration:200,grid:{left:38,right:15,top:12,bottom:23},
      tooltip:{trigger:'axis',confine:true,backgroundColor:'#142a30',borderColor:'#3a5b58',textStyle:{color:'#d8e4cd',fontSize:10},valueFormatter:(v:number)=>typeof v==='number'?v.toLocaleString('zh-CN',{maximumFractionDigits:2}):'\u2014'},
      xAxis:{type:'category',boundaryGap:false,data:Array.from({length:24},(_,h)=>String(h).padStart(2,'0')+':00'),axisLabel:{color:'#799581',fontSize:8,interval:5},axisTick:{show:false},axisLine:{lineStyle:{color:'#344a40'}}},
      yAxis:{type:'value',max:metric==='load'||metric==='connection'?100:undefined,splitNumber:3,axisLabel:{color:'#799581',fontSize:8},splitLine:{lineStyle:{color:'#344a4044',type:'dashed'}}},
      series:entries.map(({detail,color},index)=>({type:'line',name:detail.site.name,data:detail.series.map(m=>comparisonValue(metric,m)),smooth:0.25,connectNulls:false,symbol:'none',lineStyle:{color,width:1.8},itemStyle:{color},
        ...(index===0?{markLine:{silent:true,symbol:'none',label:{show:false},lineStyle:{color:'#c6d8a8',type:'dashed',width:1},data:[{xAxis:hour}]}}:{})}))});
    chart.getZr().on('click',event=>{if(!chart.containPixel({gridIndex:0},[event.offsetX,event.offsetY]))return;const value=chart.convertFromPixel({xAxisIndex:0},event.offsetX);if(typeof value==='number'&&Number.isFinite(value))onHour(Math.max(0,Math.min(23,Math.round(value))));});
    const observer=new ResizeObserver(()=>chart.resize());observer.observe(node.current);
    return()=>{observer.disconnect();chart.dispose();};
  },[entries,metric,hour,onHour]);
  return <div ref={node} className="mw-comparison-chart" role="img" aria-label={"\u7ad9\u70b924\u5c0f\u65f6\u5bf9\u6bd4\u8d8b\u52bf"}/>;
}
