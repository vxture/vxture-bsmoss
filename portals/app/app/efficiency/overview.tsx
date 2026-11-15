"use client";
import {useState} from 'react';
import Link from 'next/link';
import {PanelCard,SegmentedControl} from '@vxture/design-system';
import AnalysisOverview from '../site-analysis/overview';
import AnalysisHourlyChart from '../site-analysis/hourly-chart';
import AnalysisDonut from '../site-analysis/donut';
import type {AnalysisHref} from '../site-analysis/workspace';
import {n,pct} from '../sites/labels';
import {energyValue,intensityValue,intensityClass,intensityTone,energyPeriodCaption} from './labels';
import type {EfficiencyModel} from './model';
export default function EfficiencyOverview({data,href}:{data:EfficiencyModel;href:AnalysisHref}){
 const [comparison,setComparison]=useState<'energy'|'intensity'>('energy'),[metric,setMetric]=useState<'energy'|'intensity'>('energy');
 const {efficiency:b,query:q}=data,t=b.total,p=b.configuration.parameters,regions=b.regions.length?b.regions:[{id:q.county,name:data.countyName??'',city:q.city,county:q.county,...t}];
 const maxEnergy=Math.max(1,...regions.map(r=>r.energyWh??0)),maxIntensity=Math.max(p.intensityCritical,...regions.map(r=>r.intensity??0));
 const categories=[{key:'normal',label:'\u6b63\u5e38',value:t.evaluable-t.warning-t.critical,tone:'success' as const},{key:'warning',label:'\u5173\u6ce8',value:t.warning,tone:'warning' as const},{key:'critical',label:'\u4e25\u91cd',value:t.critical,tone:'critical' as const}].map(item=>({...item,href:href({energyFilter:item.key,page:1})}));
 return <><AnalysisOverview title={'\u80fd\u6548\u5206\u5e03'} description={energyPeriodCaption(b.period)} icon="lightning" items={[]}
 content={<AnalysisDonut items={categories} totalLabel={'\u53ef\u8bc4\u4f30'} selected={b.filter}/>}
 footer={<div className="site-analysis-overview-footer flex flex-col gap-sm text-body-small text-muted-foreground">
  <div className="flex flex-wrap items-center gap-md"><span>{'\u5df2\u76d1\u6d4b '+n(t.energyKnown)+' \u7ad9 \u00b7 '+pct(t.sites?t.energyKnown/t.sites:null)}</span>{t.sites>t.evaluable&&<span>{'\u4e0d\u53ef\u8bc4\u4f30 '+n(t.sites-t.evaluable)+' \u7ad9'}</span>}</div>
  <div className="flex flex-wrap items-center gap-md">{t.zeroTraffic===0&&t.missing===0?<span>{'\u65e0\u96f6\u6d41\u91cf\u53ca\u7f3a\u6570\u7ad9\u5740'}</span>:<>{t.zeroTraffic>0&&<Link className="site-analysis-tone-warning hover:text-primary" href={href({energyFilter:'zero',page:1})} scroll={false}>{'\u6709\u80fd\u8017\u65e0\u6d41\u91cf '+n(t.zeroTraffic)+' \u7ad9'}</Link>}{t.missing>0&&<Link className="site-analysis-tone-warning hover:text-primary" href={href({energyFilter:'unknown',page:1})} scroll={false}>{'\u80fd\u8017\u7f3a\u6570 '+n(t.missing)+' \u7ad9'}</Link>}</>}</div>
  <div className="flex flex-wrap items-center gap-sm"><span className="site-analysis-tone-warning">{'\u5173\u6ce8 \u2265'+p.intensityWarning}</span><span className="site-analysis-tone-critical">{'\u4e25\u91cd \u2265'+p.intensityCritical+' kWh/GiB'}</span><Link className="text-primary hover:text-primary-hover" href="/settings/rules#monitoring-parameters">{'\u53c2\u6570\u914d\u7f6e'}</Link></div>
 </div>}
 regionTitle={q.city==='all'?'\u5730\u5e02\u6bd4\u8f83':q.county==='all'?'\u533a\u53bf\u6bd4\u8f83':'\u5f53\u524d\u5206\u6790\u8303\u56f4'} regionDescription={comparison==='energy'?'\u7528\u7535\u91cf kWh \u00b7 \u603b\u7ad9\u5740':'\u80fd\u8017\u5f3a\u5ea6 kWh/GiB \u00b7 \u603b\u7ad9\u5740'}
 regionAction={<SegmentedControl className="h-control-xl" size="md" ariaLabel={'\u80fd\u6548\u6bd4\u8f83\u6307\u6807'} value={comparison} onChange={setComparison} items={[{value:'energy',label:'\u7528\u7535\u91cf'},{value:'intensity',label:'\u80fd\u8017\u5f3a\u5ea6'}]}/>}
 backHref={q.city!=='all'?href(q.county!=='all'?{county:'all',page:1}:{city:'all',county:'all',page:1}):undefined}
 regions={regions.map(r=>({key:r.id,label:r.name,href:q.county==='all'?href({city:r.city,county:r.county,page:1}):undefined,value:<><span className="text-muted-foreground">{' | \u5171 '}</span>{n(r.sites)}{' \u7ad9'}</>,meta:<span className={comparison==='intensity'?intensityClass(r.intensity,p):'text-primary'}>{comparison==='energy'?energyValue(r.energyWh):intensityValue(r.intensity)}</span>,progress:comparison==='energy'?(r.energyWh??0)/maxEnergy*100:(r.intensity??0)/maxIntensity*100,progressTone:comparison==='intensity'?intensityTone(r.intensity,p):undefined,
 tooltip:<div className="flex flex-col gap-xs text-body-small"><span>{'\u7528\u7535 '+energyValue(r.energyWh)+' kWh \u00b7 \u5f3a\u5ea6 '+intensityValue(r.intensity)+' kWh/GiB'}</span><span className="site-analysis-severity-counts"><span className="site-analysis-tone-warning">{'\u5173\u6ce8 '+n(r.warning)}</span><span className="site-analysis-tone-critical">{'\u4e25\u91cd '+n(r.critical)}</span></span><span>{'\u7535\u91cf\u8bb0\u5f55 '+n(r.observed)+'/'+n(r.expected)+' \u00b7 \u53ef\u8bc4\u4f30 '+n(r.evaluable)+' \u7ad9'}</span></div>}))}/>
 <PanelCard className="site-analysis-chart-panel" title={b.period.daily?'\u6bcf\u65e5\u53d8\u5316':q.period==='hour'?'\u5c0f\u65f6\u6307\u6807':'\u5c0f\u65f6\u53d8\u5316'} description={energyPeriodCaption(b.period)} icon="chart-line-up" action={<SegmentedControl className="h-control-xl" size="md" ariaLabel={'\u80fd\u6548\u8d8b\u52bf\u6307\u6807'} value={metric} onChange={setMetric} items={[{value:'energy',label:'\u7528\u7535\u91cf'},{value:'intensity',label:'\u80fd\u8017\u5f3a\u5ea6'}]}/>}>
 <AnalysisHourlyChart hideAxis key={q.period+b.period.label+metric} formatLabel={label=>b.period.daily?label:label+':00'} metricLabel={metric==='energy'?'\u7528\u7535\u91cf':'\u80fd\u8017\u5f3a\u5ea6'} data={b.series.filter(s=>(metric==='energy'?s.energyWh:s.intensity)!==null).map(s=>({key:s.key,label:s.label,value:metric==='energy'?s.energyWh!/1000:s.intensity!}))} labelEvery={b.series.length>12?4:1} formatValue={v=>n(v,metric==='energy'?2:3)+(metric==='energy'?' kWh':' kWh/GiB')} aria-label={'\u80fd\u6548\u5468\u671f\u53d8\u5316'}/>
 </PanelCard></>;
}
