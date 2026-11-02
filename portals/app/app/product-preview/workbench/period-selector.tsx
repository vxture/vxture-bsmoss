'use client';
import {useWorkbench} from '../../domains/map-demo/workbench-store.ts';
export default function PeriodSelector({mode}:{mode:'usage'|'report'}) {
  const state=useWorkbench(),value=mode==='usage'?state.usagePeriod:state.reportPeriod;
  const options=mode==='usage'?['hour','day','week','month'] as const:['day','week','month'] as const;
  const labels={hour:'\u65f6',day:'\u65e5',week:'\u5468',month:'\u6708'};
  return <div className="mw-usage-period" role="group" aria-label={mode==='usage'?'\u6838\u67e5\u5468\u671f':'\u62a5\u544a\u5468\u671f'}>{options.map(period=><button key={period} aria-pressed={value===period} className={value===period?'active':''} onClick={()=>mode==='usage'?state.set({usagePeriod:period,playing:false}):state.set({reportPeriod:period as 'day'|'week'|'month',playing:false})}>{labels[period]}</button>)}</div>;
}
