"use client";
import {useState} from 'react';
import {DataTable,Icon,SegmentedControl} from '@vxture/design-system';
import OperatorIdentity from '../portal/operator-identity';
import AnalysisHourlyChart from '../site-analysis/hourly-chart';
import {usageMetrics,usageShare,type UsageMetric} from '../domains/business-usage/rules';
import {analysisPeriodCaption} from '../domains/analysis/period';
import {n,pct} from '../sites/labels';
import {usageNames,usageUnits,usageNumber,usageValue,usageIcons,usageShortNames} from './labels';
import type {BusinessUsageModel} from './model';
export default function BusinessUsageDetail({row,total,period,metric:controlledMetric}:{row:Omit<BusinessUsageModel['rows'][number],'devices'>;total:BusinessUsageModel['usage']['total'];period:BusinessUsageModel['usage']['period'];metric?:UsageMetric}){
 const [localMetric,setMetric]=useState<UsageMetric>('bytes'),metric=controlledMetric??localMetric,u=row.usage;
 return <div className="flex min-w-0 flex-col gap-lg"><p className="text-body-small text-muted-foreground">{analysisPeriodCaption(period)+' \u00b7 '+row.cityName+' / '+row.countyName}</p>
 <div className="grid grid-cols-2 gap-md">{usageMetrics.map(key=><div key={key}><p className="text-body-small text-muted-foreground">{usageNames[key]}</p><p className="text-label tabular-nums text-primary">{usageValue(u[key],key)+' '+usageUnits[key]}</p></div>)}</div>
 <p className="text-body-small text-muted-foreground">{'\u4e0a\u4f20 '+usageValue(u.upBytes,'bytes')+' GiB \u00b7 \u4e0b\u8f7d '+usageValue(u.downBytes,'bytes')+' GiB'}</p>
 <p className="text-body-small">{'\u6d41\u91cf\u8d21\u732e '+pct(usageShare(u,total,'bytes'))+' \u00b7 \u547c\u53eb\u5c1d\u8bd5 '+n(u.attempts)+' \u6b21'}</p>
 <div className="min-w-0 overflow-x-auto"><DataTable rows={u.operators} rowKey={r=>r.code} columns={[{id:'operator',header:'\u8fd0\u8425\u5546',cell:r=><OperatorIdentity code={r.code}/>},{id:'traffic',header:'\u6d41\u91cf GiB',align:'center',cell:r=>usageValue(r.bytes,'bytes')},{id:'voice',header:'\u901a\u8bdd \u5c0f\u65f6',align:'center',cell:r=>usageValue(r.voiceSeconds,'voiceSeconds')},{id:'connected',header:'\u63a5\u901a \u6b21',align:'center',cell:r=>n(r.connected)},{id:'sms',header:'\u77ed\u4fe1 \u6761',align:'center',cell:r=>n(r.sms)}]}/></div>
 <div>{controlledMetric===undefined&&<SegmentedControl className="h-control-xl site-analysis-occupancy site-analysis-occupancy-auto [--analysis-facet-columns:4]" size="md" ariaLabel={'\u7ad9\u5740\u7528\u91cf\u8d8b\u52bf\u6307\u6807'} value={metric} onChange={setMetric} items={usageMetrics.map(value=>({value,ariaLabel:usageNames[value],label:<span className="site-analysis-occupancy-label"><Icon name={usageIcons[value]} size="sm"/><span>{usageShortNames[value]}</span></span>}))}/>}<AnalysisHourlyChart hideAxis key={row.id+metric+period.label} metricLabel={usageNames[metric]} formatLabel={label=>period.daily?label:label+':00'} data={u.series.map(r=>({key:r.key,label:r.label,value:usageNumber(r[metric],metric)}))} labelEvery={u.series.length>12?4:1} formatValue={value=>n(value,metric==='bytes'||metric==='voiceSeconds'?2:0)+' '+usageUnits[metric]} aria-label={'\u7ad9\u5740\u7528\u91cf\u53d8\u5316'}/></div>
 <details className="text-body-small"><summary className="cursor-pointer text-muted-foreground">{'\u539f\u59cb\u8ba1\u6570'}</summary><div className="mt-md min-w-0 overflow-x-auto"><DataTable rows={u.series} rowKey={r=>r.key} columns={[{id:'at',header:'\u65f6\u95f4',cell:r=>period.daily?r.key:r.key.slice(11,16)},{id:'bytes',header:'\u6d41\u91cf Bytes',cell:r=>r.bytes},{id:'up',header:'\u4e0a\u4f20 Bytes',cell:r=>r.upBytes},{id:'down',header:'\u4e0b\u8f7d Bytes',cell:r=>r.downBytes},{id:'voice',header:'\u901a\u8bdd \u79d2',cell:r=>n(r.voiceSeconds)},{id:'attempts',header:'\u5c1d\u8bd5 \u6b21',cell:r=>n(r.attempts)},{id:'connected',header:'\u63a5\u901a \u6b21',cell:r=>n(r.connected)},{id:'sms',header:'\u77ed\u4fe1 \u6761',cell:r=>n(r.sms)}]}/></div></details>
 </div>;
}
