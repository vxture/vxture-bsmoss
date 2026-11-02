'use client';
import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, MarkLineComponent } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';
import type { HourMetrics } from '../../domains/map-demo/types.ts';
import { GIB } from '../../domains/map-demo/rules.ts';
echarts.use([LineChart,GridComponent,TooltipComponent,MarkLineComponent,SVGRenderer]);
export default function TrendChart({series,hour,kind,onHour}:{series:HourMetrics[];hour:number;kind:'runtime'|'business'|'energy';onHour:(h:number)=>void}) {
  const node=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!node.current)return;
    const chart=echarts.init(node.current,undefined,{renderer:'svg'});
    const primary=kind==='energy'?series.map(s=>s.energyWh===null?null:s.energyWh/1000):kind==='business'?series.map(s=>s.bytes/GIB):series.map(s=>Math.round(s.used/s.capacity*1000)/10);
    const secondary=kind==='energy'?series.map(s=>s.temperature):kind==='business'?series.map(s=>s.voiceSeconds/3600):series.map(s=>s.attempts?s.connected/s.attempts*100:null);
    const names=kind==='energy'?['\u7535\u8017 kWh','\u6e29\u5ea6 \u00b0C']:kind==='business'?['\u6d41\u91cf GiB','\u901a\u8bdd \u5c0f\u65f6']:['\u8d1f\u8f7d\u7387 %','\u63a5\u901a\u7387 %'];
    chart.setOption({animationDuration:350,textStyle:{fontFamily:'Arial, Microsoft YaHei, sans-serif'},
      grid:{left:35,right:35,top:18,bottom:26},
      tooltip:{trigger:'axis',backgroundColor:'#142a30',borderColor:'#3a5b58',textStyle:{color:'#e6eee9',fontSize:11},valueFormatter:(value:number)=>typeof value==='number'?value.toFixed(2):'\u2014'},
      xAxis:{type:'category',boundaryGap:false,data:series.map(s=>String(s.hour).padStart(2,'0')+':00'),axisLabel:{color:'#6f8d91',fontSize:9,interval:5},axisLine:{lineStyle:{color:'#2a3d42'}},axisTick:{show:false}},
      yAxis:[{type:'value',axisLabel:{color:'#769496',fontSize:9},splitNumber:3,splitLine:{lineStyle:{color:'#26373b',type:'dashed'}},max:kind==='runtime'?100:undefined},
        {type:'value',axisLabel:{color:'#887f65',fontSize:9},splitLine:{show:false},min:kind==='runtime'?80:undefined,max:kind==='runtime'?100:undefined,splitNumber:3}],
      series:[{name:names[0],type:'line',data:primary,smooth:0.35,symbol:'none',lineStyle:{color:'#75d7b3',width:2},itemStyle:{color:'#75d7b3'},areaStyle:{color:new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:'rgba(91,201,161,0.24)'},{offset:1,color:'rgba(91,201,161,0)'}])},
        markLine:{silent:true,symbol:'none',label:{show:false},lineStyle:{color:'#b9dcc5',type:'dashed',width:1},data:[{xAxis:hour}]}},
        {name:names[1],type:'line',yAxisIndex:1,data:secondary,smooth:0.35,symbol:'none',lineStyle:{color:'#c5ad77',width:1.5,type:'dashed'},itemStyle:{color:'#c5ad77'}}]});
    chart.getZr().on('click',event=>{const p=chart.convertFromPixel({xAxisIndex:0},event.offsetX);const index=Array.isArray(p)?p[0]:p;if(typeof index==='number'&&Number.isFinite(index))onHour(Math.max(0,Math.min(23,Math.round(index))));});
    const observer=new ResizeObserver(()=>chart.resize());observer.observe(node.current);
    return ()=>{observer.disconnect();chart.dispose();};
  },[series,hour,kind,onHour]);
  return <div ref={node} className="mw-trend-chart" role="img" aria-label={kind==='business'?'\u7ad9\u70b924\u5c0f\u65f6\u6d41\u91cf\u4e0e\u901a\u8bdd\u8d8b\u52bf':kind==='energy'?'\u7ad9\u70b924\u5c0f\u65f6\u7535\u8017\u4e0e\u6e29\u5ea6\u8d8b\u52bf':'\u7ad9\u70b924\u5c0f\u65f6\u8d1f\u8f7d\u7387\u4e0e\u63a5\u901a\u7387\u8d8b\u52bf'}/>;
}
