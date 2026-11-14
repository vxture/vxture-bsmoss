'use client';
import {SegmentedControl} from "@vxture/design-system";
import {useWorkbench} from '../../domains/map-demo/workbench-store.ts';
export default function PeriodSelector({mode}:{mode:'usage'|'report'}) {
  const state=useWorkbench(),value=mode==='usage'?state.usagePeriod:state.reportPeriod;
  const options=mode==='usage'?['hour','day','week','month'] as const:['day','week','month'] as const;
  const labels={hour:'\u65f6',day:'\u65e5',week:'\u5468',month:'\u6708'};
  return <SegmentedControl ariaLabel={mode==='usage'?'核查周期':'报告周期'} value={value} items={options.map(period=>({value:period,label:labels[period]}))} onChange={period=>mode==='usage'?state.set({usagePeriod:period,playing:false}):state.set({reportPeriod:period as 'day'|'week'|'month',playing:false})}/>;
}
