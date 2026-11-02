'use client';
import {useEffect,useRef} from 'react';
import * as echarts from 'echarts/core';
import {LineChart} from 'echarts/charts';
import {GridComponent,TooltipComponent,MarkLineComponent} from 'echarts/components';
import {SVGRenderer} from 'echarts/renderers';
echarts.use([LineChart,GridComponent,TooltipComponent,MarkLineComponent,SVGRenderer]);
export interface PeriodChartPoint {label:string;value:number;reference:number|null;flagged:boolean}
export default function StationPeriodChart({points,selected,onSelect,label}:{points:PeriodChartPoint[];selected:number;onSelect:(index:number)=>void;label:string}) {
  const node=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!node.current)return;
    const chart=echarts.init(node.current,undefined,{renderer:'svg'});
    chart.setOption({animationDuration:200,textStyle:{fontFamily:'Arial, Microsoft YaHei, sans-serif'},grid:{left:45,right:10,top:15,bottom:26},
      tooltip:{trigger:'axis',backgroundColor:'#142a30',borderColor:'#3a5b58',textStyle:{color:'#d5dfc6',fontSize:10},valueFormatter:(v:number)=>typeof v==='number'?v.toLocaleString('zh-CN',{maximumFractionDigits:2}):'\u2014'},
      xAxis:{type:'category',boundaryGap:false,data:points.map(p=>p.label),axisLabel:{color:'#779176',fontSize:8,interval:Math.max(0,Math.floor(points.length/5)-1)},axisLine:{lineStyle:{color:'#31413b'}},axisTick:{show:false}},
      yAxis:{type:'value',axisLabel:{color:'#779176',fontSize:8},splitNumber:3,splitLine:{lineStyle:{color:'#293a34',type:'dashed'}}},
      series:[{name:'\u5b9e\u9645\u7528\u91cf',type:'line',data:points.map(p=>({value:p.value,itemStyle:{color:p.flagged?'#d8bb82':'#9bbd8c'}})),smooth:false,symbol:'circle',symbolSize:(_v:unknown,params:{dataIndex:number})=>points[params.dataIndex].flagged?6:2,lineStyle:{color:'#9bbd8c',width:2},areaStyle:{color:'#91ac7e10'},markLine:{silent:true,symbol:'none',label:{show:false},lineStyle:{color:'#c7d5b0',type:'dashed'},data:selected>=0?[{xAxis:selected}]:[]}},
        {name:'\u540c\u661f\u671f\u53c2\u8003',type:'line',data:points.map(p=>p.reference),smooth:false,symbol:'none',lineStyle:{color:'#bca36e',width:1.3,type:'dashed'}}]});
    chart.getZr().on('click',event=>{const pos=chart.convertFromPixel({xAxisIndex:0},event.offsetX);const i=Array.isArray(pos)?pos[0]:pos;if(typeof i==='number'&&Number.isFinite(i))onSelect(Math.max(0,Math.min(points.length-1,Math.round(i))));});
    const observer=new ResizeObserver(()=>chart.resize());observer.observe(node.current);
    return()=>{observer.disconnect();chart.dispose();};
  },[points,selected,onSelect]);
  return <div ref={node} className="mw-station-period-chart" role="img" aria-label={label}/>;
}
