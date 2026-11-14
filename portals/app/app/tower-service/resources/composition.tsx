"use client";
import Link from 'next/link';
import {CellTowerIcon,LightningIcon,BatteryVerticalFullIcon,GaugeIcon,ThermometerIcon} from '@phosphor-icons/react';
import {Button,Icon,PanelCard,Progress,Tooltip,TooltipTrigger,TooltipContent} from '@vxture/design-system';
import {OperatorLogo,OperatorName} from '../../portal/operator-identity';
import type {AnalysisHref} from '../../site-analysis/workspace';
import type {BaselineModel} from './baseline-model';
import {n} from '../../sites/labels';
import type {Facility} from './vocabulary';
const icons={tower:CellTowerIcon,power:LightningIcon,storage:BatteryVerticalFullIcon,meter:GaugeIcon,environment:ThermometerIcon};
export default function ResourceComposition({model:m,href}:{model:BaselineModel;href:AnalysisHref}){
 const t=m.resourceTotals;
 return <div className="resource-composition resource-page-body">
 <PanelCard className="resource-fit-panel" title={'\u94c1\u5854\u8d44\u6e90'} icon="building" description={n(t.facilities)+' \u9879\u8bbe\u5907 \u00b7 \u6309\u8bbe\u65bd\u7c7b\u578b'} action={<Button asChild variant="ghost" size="sm"><Link href={href({view:'sites',facility:'all',page:1})}>{'\u7ad9\u5740\u660e\u7ec6'}<Icon name="arrow-right" size="sm"/></Link></Button>}>
 <div className="site-analysis-distribution resource-distribution">{m.facilityCounts.map(c=>{const FacilityIcon=icons[c.key as Facility];return <div key={c.key} className="site-analysis-distribution-entry site-analysis-distribution-entry-with-icon"><span className="site-analysis-distribution-icon" aria-hidden="true"><FacilityIcon/></span><div className="site-analysis-distribution-row"><div className="flex items-center justify-between gap-sm"><Link className="text-label hover:text-primary" href={href({view:'sites',facility:c.key,page:1,search:''})}>{c.label}</Link><span className="tabular-nums text-primary">{n(c.count)+' \u9879'}<span className="ml-sm text-body-small text-muted-foreground">{t.facilities?(c.count/t.facilities*100).toFixed(1)+'%':'\u2014'}</span></span></div><Progress value={t.facilities?c.count/t.facilities*100:0} aria-label={c.label} aria-valuetext={n(c.count)+' \u9879'}/></div></div>;})}</div>
 <p className="resource-panel-note text-body-small text-muted-foreground">{m.context.operator==='all'?'\u6309\u7269\u7406\u8bbe\u5907\u7f16\u7801\u53bb\u91cd':'\u6240\u9009\u8fd0\u8425\u5546\u5173\u8054\u7ad9\u5740\u5185\u7684\u94c1\u5854\u8bbe\u65bd\uff0c\u975e\u5ba2\u6237\u72ec\u5360\u914d\u7f6e'}</p>
 </PanelCard>
 <PanelCard className="resource-fit-panel resource-customer" title={'\u5ba2\u6237\u8d44\u6e90'} icon="users" description={n(t.customerDevices)+' \u9879\u8bbe\u5907 \u00b7 \u6309\u5f52\u5c5e\u8fd0\u8425\u5546'}>
 <div className="site-analysis-distribution resource-distribution">{m.customerCounts.map(c=><div key={c.code} className="site-analysis-distribution-entry site-analysis-distribution-entry-with-icon"><span className="site-analysis-distribution-icon" aria-hidden="true"><OperatorLogo code={c.code} size="large"/></span><div className="site-analysis-distribution-row"><div className="flex items-center justify-between gap-sm"><Link className="text-label hover:text-primary" href={href({operator:c.code,view:'sites',facility:'all',page:1,search:''})}><OperatorName code={c.code}/></Link><Tooltip><TooltipTrigger asChild><span tabIndex={0} className="cursor-help tabular-nums resource-customer-text" aria-label={c.code+' '+n(c.count)+' \u9879\u5ba2\u6237\u8bbe\u5907'}>{n(c.count)+' \u9879'}<span className="ml-sm text-body-small text-muted-foreground">{t.customerDevices?(c.count/t.customerDevices*100).toFixed(1)+'%':'\u2014'}</span></span></TooltipTrigger><TooltipContent variant="surface"><div className="flex flex-col gap-xs text-body-small">{c.categories.length?c.categories.map(r=><span key={r.category}>{r.category+' '+n(r.count)+' \u9879'}</span>):<span>{'\u6682\u65e0\u8bbe\u5907'}</span>}</div></TooltipContent></Tooltip></div><Progress value={t.customerDevices?c.count/t.customerDevices*100:0} aria-label={c.code+'\u5ba2\u6237\u8bbe\u5907'} aria-valuetext={n(c.count)+' \u9879'}/></div></div>)}</div>
 <p className="resource-panel-note text-body-small text-muted-foreground">{'\u6309\u8bbe\u5907\u5f52\u5c5e\u7edf\u8ba1\uff1b\u4e0d\u4ee3\u8868\u79df\u7528\u6570\u91cf\u6216\u8ba1\u91cf\u7528\u91cf'}</p>
 </PanelCard></div>;
}
