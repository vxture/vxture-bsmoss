'use client';
import {useRef} from 'react';
import {Button,Icon,Input,SegmentedControl,Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@vxture/design-system';
import {beijing,HISTORY_START,HISTORY_END,parseHistoryId} from '../../domains/tower-service/history-calendar';
import type {SnapshotContext,SnapshotDescriptor} from '../../domains/tower-service/query';
import {configurationTime} from '../../settings/configuration-layout';
import {sharingStep,sharingPeriodId,type SharingGrain} from './analysis-links';
import ResetButton from '../../portal/reset-button';
import {latestPeriodId} from '../../domains/tower-service/period-reset';
export default function AnalysisPeriodControls({context,grain,snapshots,date,busy,onChange:change}:{context:SnapshotContext;grain:SharingGrain;snapshots:SnapshotDescriptor[];date:string;busy:boolean;onChange:(patch:{snapshotId?:string;grain?:SharingGrain})=>void}){
 const input=useRef<HTMLInputElement>(null),p=parseHistoryId(context.snapshotId),quarter=Math.ceil(Number(date.slice(5,7))/3),year=date.slice(0,4);
 const previous=p?sharingStep(context.snapshotId,grain,-1):null,next=p?sharingStep(context.snapshotId,grain,1):null;
 const choose=(value:string)=>{try{change({snapshotId:sharingPeriodId(value,grain)});}catch{}};
 return (
   <div className="sharing-period-tools site-analysis-filters site-analysis-period-tools site-analysis-control-group" inert={busy} role="group" aria-label={'\u5206\u6790\u65f6\u6bb5'}>
    {p?<><div className="site-analysis-datetime relative flex items-center"><Button size="icon-xl" variant="ghost" className="site-analysis-time-icon" aria-label={'\u9009\u62e9\u5206\u6790\u65f6\u95f4'} onClick={()=>{try{input.current?.showPicker();}catch{input.current?.focus();}}}><Icon name="calendar" size="md"/></Button><Input key={date+grain} ref={input} type={grain==='month'?'month':'number'} aria-label={grain==='month'?'\u5206\u6790\u6708\u4efd':'\u5206\u6790\u5e74\u4efd'} value={grain==='month'?date:year} min={grain==='month'?HISTORY_START.slice(0,7):HISTORY_START.slice(0,4)} max={grain==='month'?beijing(Date.parse(HISTORY_END)-1).slice(0,7):beijing(Date.parse(HISTORY_END)-1).slice(0,4)} onChange={event=>{const value=event.target.value;if(grain==='month'){if(/^\d{4}-\d{2}$/.test(value))choose(value+'-01');}else if(/^\d{4}$/.test(value))choose(value+'-'+String(grain==='quarter'?(quarter-1)*3+1:1).padStart(2,'0')+'-01');}}/></div>
     {grain==='quarter'&&<Select value={String(quarter)} onValueChange={q=>choose(year+'-'+String((Number(q)-1)*3+1).padStart(2,'0')+'-01')}><SelectTrigger aria-label={'\u5206\u6790\u5b63\u5ea6'}><SelectValue/></SelectTrigger><SelectContent>{[1,2,3,4].map(q=><SelectItem key={q} value={String(q)}>{'\u7b2c '+q+' \u5b63\u5ea6'}</SelectItem>)}</SelectContent></Select>}
     <SegmentedControl size="md" className="sharing-switch h-control-xl" ariaLabel={'\u5206\u6790\u5468\u671f'} value={grain} items={[{value:'month',label:'\u6708'},{value:'quarter',label:'\u5b63'},{value:'year',label:'\u5e74'}]} onChange={grain=>change({grain:grain as SharingGrain})}/>
     <div className="site-analysis-period-steps site-analysis-control-group"><Button variant="secondary" size="icon-xl" aria-label={'\u4e0a\u4e00\u5468\u671f'} disabled={!previous} onClick={()=>previous&&change({snapshotId:previous})}><Icon name="chevron-left" size="sm"/></Button><Button variant="outline" size="icon-xl" aria-label={'\u4e0b\u4e00\u5468\u671f'} disabled={!next} onClick={()=>next&&change({snapshotId:next})}><Icon name="chevron-right" size="sm"/></Button></div></>:<Select value={context.snapshotId} onValueChange={snapshotId=>change({snapshotId})}><SelectTrigger aria-label={'\u5165\u9a7b\u5feb\u7167'}><SelectValue/></SelectTrigger><SelectContent>{snapshots.filter(s=>!parseHistoryId(s.id)).map(s=><SelectItem key={s.id} value={s.id}>{configurationTime(s.stockAsOf)}</SelectItem>)}</SelectContent></Select>}
    <ResetButton variant="outline" label={'\u590d\u4f4d\u81f3\u6700\u65b0\u5468\u671f'} disabled={busy} onClick={()=>change({snapshotId:latestPeriodId(context.snapshotId,snapshots)})}/>
   </div>
 );
}
