"use client";
import type {ReactNode} from 'react';
import {useRouter} from 'next/navigation';
import {Button,Icon,PanelCard,SectionHeader,SegmentedControl,Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@vxture/design-system';
import AnalysisOverview from '../site-analysis/overview';
import AnalysisSummary from '../site-analysis/summary';
import AnalysisPeriodControls from '../site-analysis/period-controls';
import AnalysisHourlyChart from '../site-analysis/hourly-chart';
import AnalysisDonut from '../site-analysis/donut';
import {OperatorLogo,OperatorName} from '../portal/operator-identity';
import OperatorIdentity from '../portal/operator-identity';
import {useOperatorNames} from '../portal/operator-identities';
import ResetButton from '../portal/reset-button';
import type {AnalysisHref} from '../site-analysis/workspace';
import {analysisPeriodCaption} from '../domains/analysis/period';
import {usageMetrics,usageShare,sumUsage} from '../domains/business-usage/rules';
import {n,pct} from '../sites/labels';
import {usageNames,usageUnits,usageNumber,usageIcons,usageShortNames,compactUsage,compactUsageValue} from '../operator-usage/labels';
import type {CustomerUseModel} from './model';
type Props={data:CustomerUseModel;href:AnalysisHref};
export const customerSections=[{id:'occupancy',label:'\u5ba2\u6237\u5165\u9a7b'},{id:'sharing',label:'\u7ad9\u5740\u5171\u4eab'},{id:'usage',label:'\u4e1a\u52a1\u7528\u91cf'}];
function Section({id,title,description,children}:{id:string;title:string;description:string;children:ReactNode}){
 return <section id={id} aria-label={title} data-customer-section={id} className="site-analysis-section flex min-w-0 flex-col gap-lg"><SectionHeader level={2} title={title} description={description}/>{children}</section>;
}
function regionScope(data:CustomerUseModel){const q=data.query;return {rows:data.regions.length?data.regions:[{id:q.county,name:data.countyName??'',city:q.city,county:q.county,count:data.summary.sites,sharing:data.sharing,...data.usage.total}],title:q.city==='all'?'\u5730\u5e02\u5206\u5e03':q.county==='all'?'\u533a\u53bf\u5206\u5e03':'\u5f53\u524d\u533a\u53bf'};}
function regionHref(href:AnalysisHref,id:string){return (patch:Record<string,string|number>={})=>href(patch)+'#'+id;}
function back(data:CustomerUseModel,href:AnalysisHref){const q=data.query;return q.city!=='all'?href(q.county!=='all'?{county:'all',page:1}:{city:'all',county:'all',page:1}):undefined;}
export function CustomerScope({data,href}:Props){
 const router=useRouter(),names=useOperatorNames();
 return <div className="site-analysis-filters site-analysis-action-row"><nav aria-label={'\u5ba2\u6237\u4f7f\u7528\u677f\u5757'} className="flex min-w-0 flex-wrap items-center gap-sm">{customerSections.map(section=><Button key={section.id} asChild variant="ghost" size="xl"><a href={'#'+section.id}>{section.label}</a></Button>)}<Button asChild variant="ghost" size="xl"><a href="#site-details">{'\u7ad9\u5740\u660e\u7ec6'}</a></Button></nav><div className="flex flex-wrap items-center gap-sm"><Select value={data.query.operator} onValueChange={operator=>router.push(href({operator,page:1}),{scroll:false})}><SelectTrigger aria-label={'\u8fd0\u8425\u5546'} className="site-analysis-operator-select w-auto"><SelectValue/></SelectTrigger><SelectContent className="site-analysis-operator-options">{['all','mobile','telecom','unicom','broadcast','other'].map(code=><SelectItem key={code} value={code}>{code==='all'?names[code]:<OperatorIdentity code={code}/>}</SelectItem>)}</SelectContent></Select><ResetButton variant="outline" label={'\u91cd\u7f6e\u516c\u5171\u7b5b\u9009'} href={href({operator:'all',tenancy:'all',operatorCount:'all',search:'',site:'all',status:'all',scene:'all',siteType:'all',page:1})}/></div></div>;
}
export function CustomerOccupancy({data,href}:Props){
 const regions=regionScope(data),links=regionHref(href,'occupancy'),max=Math.max(1,...data.operators.map(row=>row.sites)),maxRegion=Math.max(1,...regions.rows.map(row=>row.count));
 return <Section id="occupancy" title={'\u5ba2\u6237\u5165\u9a7b'} description={'\u8d44\u6e90\u5feb\u7167 '+data.resourceAt.replace('T',' ')}>
 <AnalysisSummary label={'\u5165\u9a7b\u6982\u51b5'} items={[{key:'sites',label:'\u5165\u9a7b\u7ad9\u5740',shortLabel:'\u5165\u9a7b',icon:'building',value:n(data.summary.sites),unit:'\u7ad9'},{key:'devices',label:'\u5173\u8054\u8bbe\u5907',shortLabel:'\u8bbe\u5907',icon:'database',value:n(data.summary.resources),unit:'\u53f0'}]}/>
 <AnalysisOverview title={'\u8fd0\u8425\u5546\u5165\u9a7b'} description={'\u5165\u9a7b\u7ad9\u5740\u4e0e\u5173\u8054\u8bbe\u5907'} icon="users" items={data.operators.map(row=>({key:row.code,label:row.code,labelContent:<OperatorName code={row.code}/>,icon:<OperatorLogo code={row.code} size="large"/>,value:<span className="inline-flex flex-wrap items-baseline justify-end gap-sm"><span>{n(row.sites)+' \u7ad9'}</span><span className="text-body-small text-muted-foreground">{'| '+n(row.resources)+' \u8bbe\u5907'}</span></span>,progress:row.sites/max*100}))}
 regionClassName="sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2" regionTitle={regions.title} regionDescription={'\u5165\u9a7b\u7ad9\u5740 \u00b7 \u70b9\u51fb\u4e0b\u94bb'} backHref={back(data,links)} regions={regions.rows.map(row=>({key:row.id,label:row.name,href:data.query.county==='all'?links({city:row.city,county:row.county,page:1}):undefined,value:n(row.count)+' \u7ad9',meta:<span className="text-body-small text-muted-foreground">{pct(data.summary.sites?row.count/data.summary.sites:null)+' |'}</span>,progress:row.count/maxRegion*100}))}/>
 </Section>;
}
export function CustomerSharing({data,href}:Props){
 const regions=regionScope(data),links=regionHref(href,'sharing'),labels:Record<string,string>={single:'1\u5bb6\u5165\u9a7b',double:'2\u5bb6\u5165\u9a7b',multi:'3\u5bb6\u53ca\u4ee5\u4e0a'},tones=['muted','secondary','primary'] as const;
 return <Section id="sharing" title={'\u7ad9\u5740\u5171\u4eab'} description={'\u8d44\u6e90\u5feb\u7167 '+data.resourceAt.replace('T',' ')}>
 <AnalysisSummary label={'\u5171\u4eab\u6982\u51b5'} items={[{key:'sites',label:'\u5171\u4eab\u7ad9\u5740',shortLabel:'\u5171\u4eab',icon:'users',value:n(data.sharing.sharedSites),unit:'\u7ad9'},{key:'rate',label:'\u5171\u4eab\u7387',shortLabel:'\u5171\u4eab\u7387',icon:'chart-pie',value:pct(data.sharing.sharingRate)}]}/>
 <AnalysisOverview title={'\u5165\u9a7b\u7ed3\u6784'} description={'\u70b9\u51fb\u5206\u7c7b\u67e5\u770b\u5bf9\u5e94\u7ad9\u5740'} icon="chart-pie" items={[]} content={<AnalysisDonut totalLabel={'\u5165\u9a7b\u7ad9\u5740'} label={'\u5165\u9a7b\u7ed3\u6784\u7b5b\u9009'} scroll selected={data.tenancy} items={data.sharing.distribution.map((row,index)=>({key:row.key,label:labels[row.key],value:row.sites,tone:tones[index],href:href({tenancy:row.key,operatorCount:'all',search:'',page:1})+'#site-details'}))}/>}
 regionClassName="sm:grid-cols-2" regionTitle={regions.title} regionDescription={'\u5171\u4eab\u7387 \u00b7 \u5171\u4eab\u7ad9\u5740 / \u5165\u9a7b\u7ad9\u5740'} backHref={back(data,links)} regions={regions.rows.map(row=>({key:row.id,label:row.name,href:data.query.county==='all'?links({city:row.city,county:row.county,page:1}):undefined,value:n(row.sharing.sharedSites)+' / '+n(row.count)+' \u7ad9',meta:<span className="text-primary text-body-small whitespace-nowrap">{pct(row.sharing.sharingRate)+' |'}</span>,progress:(row.sharing.sharingRate??0)*100}))}/>
 </Section>;
}
export function CustomerUsage({data,href}:Props){
 const router=useRouter(),b=data.usage,q=data.query,metric=b.sort,regions=regionScope(data),links=regionHref(href,'usage'),caption=analysisPeriodCaption(b.period),max=Math.max(1,...regions.rows.map(row=>Number(row[metric])));
 return <Section id="usage" title={'\u4e1a\u52a1\u7528\u91cf'} description={caption}>
 <div className="site-analysis-filters site-analysis-action-row"><div className="min-w-0 max-w-full overflow-x-auto"><SegmentedControl className="site-analysis-occupancy site-analysis-occupancy-auto [--analysis-facet-columns:4]" size="md" ariaLabel={'\u4e1a\u52a1\u6307\u6807'} value={metric} onChange={usageSort=>router.push(href({usageSort,page:1}),{scroll:false})} items={usageMetrics.map(value=>({value,ariaLabel:usageNames[value],label:<span className="site-analysis-occupancy-label"><Icon name={usageIcons[value]} size="sm"/><span>{usageShortNames[value]}</span></span>}))}/></div><div className="site-analysis-time-tools"><AnalysisPeriodControls data={data} href={href} keepScroll/><ResetButton variant="outline" label={'\u91cd\u7f6e\u4e1a\u52a1\u5468\u671f\u4e0e\u6307\u6807'} href={href({usageSort:'bytes',period:'day',asOf:data.date+'T23:00:00',page:1})+'#usage'}/></div></div>
 <AnalysisSummary label={'\u4e1a\u52a1\u6982\u51b5'} items={usageMetrics.map(key=>({key,label:usageNames[key],shortLabel:usageShortNames[key],icon:usageIcons[key],...compactUsage(b.total[key],key)}))}/>
 <AnalysisOverview title={'\u8fd0\u8425\u5546\u8d21\u732e'} description={usageNames[metric]+' \u00b7 \u7528\u91cf\u4e0e\u5360\u6bd4'} icon="chart-bar" items={data.operators.map(operator=>{const row=b.operators.find(r=>r.code===operator.code)??sumUsage([]);return {key:operator.code,label:operator.code,labelContent:<OperatorName code={operator.code}/>,icon:<OperatorLogo code={operator.code} size="large"/>,value:<span className="inline-flex flex-wrap items-baseline justify-end gap-sm"><span>{compactUsageValue(row[metric],metric)}</span><span className="text-body-small text-muted-foreground">{pct(usageShare(row,b.total,metric))}</span></span>,progress:(usageShare(row,b.total,metric)??0)*100};})}
 regionClassName="sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2" regionTitle={regions.title} regionDescription={usageNames[metric]+' \u00b7 \u540c\u4e00\u4e1a\u52a1\u5468\u671f'} backHref={back(data,links)} regions={regions.rows.map(row=>({key:row.id,label:row.name,href:q.county==='all'?links({city:row.city,county:row.county,page:1}):undefined,value:compactUsageValue(row[metric],metric),meta:<span className="text-body-small text-muted-foreground">{pct(usageShare(row,b.total,metric))+' |'}</span>,progress:Number(row[metric])/max*100}))}/>
 <PanelCard title={'\u7528\u91cf\u8d8b\u52bf'} description={usageNames[metric]+' \u00b7 '+caption} icon="chart-line-up" className="site-analysis-chart-panel"><AnalysisHourlyChart hideAxis key={q.period+b.period.label+metric} metricLabel={usageNames[metric]} formatLabel={label=>b.period.daily?label:label+':00'} data={b.series.map(row=>({key:row.key,label:row.label,value:usageNumber(row[metric],metric)}))} labelEvery={b.series.length>12?4:1} formatValue={value=>n(value,2)+' '+usageUnits[metric]} aria-label={'\u4e1a\u52a1\u7528\u91cf\u53d8\u5316'}/></PanelCard>
 </Section>;
}
