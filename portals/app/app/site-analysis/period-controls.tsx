"use client";
import {useRef} from 'react';
import {useRouter} from 'next/navigation';
import {Button,Icon,Input,SegmentedControl} from '@vxture/design-system';
import type {SiteAnalysisModel} from './model';
import type {AnalysisHref} from './workspace';
export default function AnalysisPeriodControls({data,href,keepScroll=false}:{data:SiteAnalysisModel;href:AnalysisHref;keepScroll?:boolean}){
 const router=useRouter(),q=data.query;
 const navigate=(url:string)=>router.push(url,{scroll:!keepScroll});
 const weekValue=(value:string)=>{const d=new Date(value.slice(0,10)+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+4-(d.getUTCDay()||7));const y=d.getUTCFullYear();const week=Math.ceil(((d.getTime()-Date.UTC(y,0,1))/86400000+1)/7);return y+'-W'+String(week).padStart(2,'0');};
 const weekDate=(value:string)=>{const [year,week]=value.split('-W').map(Number);const d=new Date(Date.UTC(year,0,4));d.setUTCDate(d.getUTCDate()-(d.getUTCDay()||7)+1+(week-1)*7);return d.toISOString().slice(0,10);};
 const timeInput=useRef<HTMLInputElement>(null);

 return ( <div className="site-analysis-period-tools site-analysis-control-group"><div className="site-analysis-datetime relative flex items-center"><Button variant="ghost" aria-label={"\u9009\u62e9\u5206\u6790\u65f6\u95f4"} size="icon-xl" className="site-analysis-time-icon" onClick={()=>timeInput.current?.showPicker()}><Icon name="calendar" size="sm"/></Button><Input ref={timeInput} type={q.period==='hour'?'datetime-local':q.period==='month'?'month':q.period==='week'?'week':'date'} step={q.period==='hour'?'1':undefined} aria-label={"\u5206\u6790\u65f6\u95f4"} value={q.period==='hour'?q.asOf:q.period==='month'?q.asOf.slice(0,7):q.period==='week'?weekValue(q.asOf):q.asOf.slice(0,10)} onChange={e=>{if(e.target.value){const v=e.target.value;navigate(href({asOf:q.period==='hour'?v.slice(0,13)+':00:00':q.period==='month'?v+'-01':q.period==='week'?weekDate(v):v,page:1}));}}}/></div>
 <div className="site-analysis-period-navigation site-analysis-control-group"><SegmentedControl ariaLabel={"\u5206\u6790\u5468\u671f"} size="md" value={q.period} items={[{value:'hour',label:'\u65f6'},{value:'day',label:'\u65e5'},{value:'week',label:'\u5468'},{value:'month',label:'\u6708'}]} onChange={period=>navigate(href({period,page:1}))}/>
 <div className="site-analysis-period-steps site-analysis-control-group"><Button variant="outline" size="icon-xl" title={"\u5207\u6362\u5468\u671f"} aria-label={"\u5411\u524d\u4e00\u4e2a\u5468\u671f"} disabled={!data.previousAsOf} onClick={()=>data.previousAsOf&&navigate(href({asOf:data.previousAsOf,page:1}))}><Icon name="arrow-left" size="sm"/></Button><Button variant="outline" size="icon-xl" title={"\u5207\u6362\u5468\u671f"} aria-label={"\u5411\u540e\u4e00\u4e2a\u5468\u671f"} disabled={!data.nextAsOf} onClick={()=>data.nextAsOf&&navigate(href({asOf:data.nextAsOf,page:1}))}><Icon name="arrow-right" size="sm"/></Button>
 </div></div></div>);
}
