"use client";
import Link from 'next/link';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {Button,Icon,PanelCard,SegmentedControl,EmptyState,ToggleGroup,ToggleGroupItem} from '@vxture/design-system';
import {useOperatorNames} from '../../portal/operator-identities';
import type {BaselineModel} from './baseline-model';
import type {AnalysisHref} from '../../site-analysis/workspace';
import {facilities} from './vocabulary';
import RegionChart from './region-chart';

const palette=['var(--color-chart-1)','var(--color-chart-2)','var(--color-chart-3)','var(--color-chart-4)','var(--color-chart-5)','var(--color-chart-6)'];
type Region=BaselineModel['regions'][number];
export default function ResourceRegions({model:m,href}:{model:BaselineModel;href:AnalysisHref}){
 const router=useRouter(),names=useOperatorNames(),{regionLevel,regionRanking,resourceView}=m.filters;
 const [hidden,setHidden]=useState<Record<string,string[]>>({}),tower=resourceView==='tower',rows=m.chartRegions;
 const unclassified=m.regions.some(r=>r.facilities>Object.values(r.categories).reduce((a,b)=>a+b,0));
 const series=tower?[...Object.entries(facilities).map(([key,label],index)=>({key,label,color:palette[index]})),...(unclassified?[{key:'unclassified',label:'\u5176\u4ed6\u8bbe\u65bd',color:palette[5]}]:[])]:m.customerCounts.map(c=>({key:c.code,label:names[c.code]??c.code,color:palette[Math.max(0,['mobile','telecom','unicom','broadcast','other'].indexOf(c.code))%palette.length]}));
 const visible=series.filter(s=>!hidden[resourceView]?.includes(s.key));
 const value=(r:Region,key:string)=>tower?(key==='unclassified'?r.facilities-Object.values(r.categories).reduce((a,b)=>a+b,0):r.categories[key]??0):r.operators[key]??0;
 const total=(r:Region)=>tower?r.facilities:r.customerDevices;
 const drill=(r:Region)=>regionLevel==='city'&&r.code!=='unknown'?href({city:r.city,county:'all',regionRanking:'all',page:1}):null;
 const change=(patch:Record<string,string|number>)=>router.push(href({...patch,page:1}),{scroll:false});
 const back=m.context.city!=='all'?href(m.context.county==='all'?{city:'all',county:'all',regionRanking:'all',page:1}:{county:'all',regionRanking:'all',page:1}):null;
 const heading=regionLevel==='city'?'\u5730\u5e02\u5206\u5e03':'\u533a\u53bf\u5206\u5e03';
 return <div className="resource-page-body resource-region-body">
 <PanelCard title={heading} icon="chart-bar" className="resource-fit-panel resource-region-panel" action={<div className="resource-region-controls">
 {back&&<Button asChild variant="ghost" size="md" className="resource-region-back"><Link href={back}><Icon name="arrow-left" size="sm"/>{'\u8fd4\u56de\u4e0a\u7ea7'}</Link></Button>}
 <SegmentedControl ariaLabel={'\u533a\u57df\u6392\u540d'} value={regionRanking} onChange={regionRanking=>change({regionRanking})} items={[{value:'all',label:m.context.city==='all'?'\u5168\u90e8\u5e02\u7ea7':'\u5168\u90e8\u533a\u53bf'},{value:'top',label:'\u524d10\u53bf'},{value:'bottom',label:'\u540e10\u53bf'}]}/>
 <SegmentedControl ariaLabel={'\u533a\u57df\u8d44\u6e90\u89c6\u56fe'} value={resourceView} onChange={resourceView=>change({resourceView})} items={[{value:'tower',icon:'building',label:'\u94c1\u5854'},{value:'operators',icon:'users',label:'\u8fd0\u8425\u5546'}]}/>
 </div>}>
 <div className="resource-region-legend text-body-small"><ToggleGroup type="multiple" size="sm" variant="default" aria-label={'\u67f1\u72b6\u56fe\u56fe\u4f8b'} value={visible.map(s=>s.key)} onValueChange={selected=>setHidden(previous=>({...previous,[resourceView]:series.filter(s=>!selected.includes(s.key)).map(s=>s.key)}))}>{series.map(s=><ToggleGroupItem key={s.key} value={s.key} aria-label={s.label} className="resource-region-legend-item"><span className="resource-region-marker" style={{backgroundColor:s.color}}/>{s.label}</ToggleGroupItem>)}</ToggleGroup><span className="ml-auto whitespace-nowrap text-muted-foreground">{'\u5355\u4f4d\uff1a\u9879'}</span></div>
 {rows.length?<RegionChart rows={rows.map(r=>({code:r.code,name:r.name,cityName:regionLevel==='county'&&m.context.city==='all'?r.cityName:'',sites:r.sites,total:total(r),drill:drill(r)}))} series={visible.map(s=>({...s,values:rows.map(r=>value(r,s.key))}))} label={heading+'\u67f1\u72b6\u56fe'}/>:<EmptyState title={'\u5f53\u524d\u8303\u56f4\u6682\u65e0\u8d44\u6e90'}/>}
 <p className="resource-panel-note text-body-small text-muted-foreground">{(regionRanking==='all'?(regionLevel==='city'?'\u70b9\u51fb\u4e0b\u94bb\u533a\u53bf \u00b7 ':''):(tower?'\u94c1\u5854':'\u5ba2\u6237')+'\u8bbe\u5907\u603b\u91cf'+(regionRanking==='top'?'\u964d\u5e8f':'\u5347\u5e8f')+' \u00b7 ')+'\u56fe\u4f8b\u70b9\u51fb\u663e\u9690\uff0c\u60ac\u505c\u663e\u793a\u6570\u503c'}</p>
 </PanelCard></div>;
}
