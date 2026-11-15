"use client";
import {useOperatorNames} from "../portal/operator-identities";
import {useState} from 'react';
import {BarChart,Button,DataTable,DetailList,DetailRow,EmptyState,NativeSelect,PanelCard,Progress,SegmentedControl,StatusBadge,TableTitleCell} from '@vxture/design-system';
import MetricRowsCard from '../portal/metric-rows-card';
import type {RuntimeAnalysis} from '../domains/map-demo/runtime-rules';
import type {RegionDefinition} from '../domains/map-demo/types';
import {n,operatorNames} from '../sites/labels';
import {businessHref,businessMapHref,type BusinessScope} from './links';
import {relatedDossierHref} from '../portal/investigation-targets';
import {useInvestigationLinks} from '../portal/investigation';

type Metric='energyWh'|'intensity'|'battery'|'attention';
const items=[{value:'energyWh' as const,label:'\u7535\u8017'},{value:'intensity' as const,label:'\u80fd\u6548\u5f3a\u5ea6'},{value:'battery' as const,label:'\u5907\u7528\u4f9b\u7535'},{value:'attention' as const,label:'\u5173\u6ce8\u7ad9\u6570'}];
const energy=(v:number|null)=>v===null?'\u672a\u77e5':n(v/1000,2);
const intensity=(v:number|null)=>v===null?'\u672a\u77e5':n(v,3);
const supply=(v:string|null)=>v==='battery'?'\u5907\u7528\u4f9b\u7535':v==='mains'?'\u5e02\u7535':'\u672a\u77e5';
const levelNames={normal:'\u5e73\u7a33',warning:'\u5173\u6ce8',critical:'\u4e25\u91cd',unknown:'\u672a\u77e5'};
function Coverage({known,total}:{known:number;total:number}){
 return <div className="flex flex-col gap-xs"><span className="text-body-small tabular-nums text-muted-foreground">{n(known)+' / '+n(total)}</span>{total>0&&<Progress value={known/total*100} aria-label={'\u5df2\u77e5\u8986\u76d6'}/>}</div>;
}
export default function RuntimePanel({data,q,region,pending,navigate}:{data:RuntimeAnalysis;q:BusinessScope;region:RegionDefinition;pending:boolean;navigate:(patch:Partial<BusinessScope>)=>void}){
 const operatorNames=useOperatorNames();
 const [metric,setMetric]=useState<Metric>('attention'),[selected,setSelected]=useState(''),[hour,setHour]=useState(q.hour);
 const {carry}=useInvestigationLinks(businessHref('efficiency',q)),total=data.total;
 const evidence=data.priority.find(s=>s.id===selected),o=evidence?.series[hour],scope={...q,hour};
 const value=(s:RuntimeAnalysis['series'][number])=>metric==='attention'?s[data.kind==='power'?'powerAttention':'efficiencyAttention']:s[metric];
 const chart=data.series.filter(s=>value(s)!==null).map(s=>({key:String(s.hour),label:String(s.hour).padStart(2,'0'),value:metric==='energyWh'?value(s)!/1000:value(s)!}));
 const coverage=[
  {id:'energy',name:'\u7ad9\u5740\u7535\u8017',known:total.energyKnown,total:total.sites,reason:!data.allocated?'\u8fd0\u8425\u5546\u5206\u8868\u672a\u91c7\u96c6\uff0c\u672a\u5206\u644a':'\u7f3a\u5c11\u7535\u8017 '+n(total.missingEnergy)+' \u5ea7'},
  {id:'power',name:'\u7ad9\u7ea7\u4f9b\u7535',known:total.powerKnown,total:total.sites,reason:'\u7269\u7406\u7ad9\u5740\u65f6\u70b9\u72b6\u6001\uff0c\u4e0d\u4ee3\u8868\u8bbe\u5907\u5065\u5eb7'},
  {id:'temperature',name:'\u673a\u623f\u6e29\u5ea6',known:total.temperatureKnown,total:total.sites,reason:'\u7ad9\u7ea7\u6e29\u5ea6\u6837\u672c\uff0c\u4e0d\u63a8\u65ad\u7a7a\u8c03\u8fd0\u884c\u72b6\u6001'},
  {id:'efficiency',name:'\u5355\u7ad9\u80fd\u6548\u53ef\u8bc4\u4f30',known:total.efficiencyKnown,total:total.sites,reason:'\u7535\u8017\u7f3a\u5931 '+n(total.missingEnergy)+' \u00b7 \u672a\u5206\u644a '+n(total.unallocated)+' \u00b7 \u96f6\u6d41\u91cf '+n(total.zeroTraffic)},
  {id:'devices',name:'\u72ec\u7acb\u8bbe\u5907\u72b6\u6001',known:data.resources.known,total:data.resources.devices,reason:n(data.resources.unknown)+' \u9879\u672a\u91c7\u96c6\uff1b\u7ad9\u7ea7\u89c2\u6d4b\u4e0d\u4ee3\u66ff\u9065\u6d4b'},
 ];
 return <div data-runtime-energy={data.version} className="flex min-w-0 flex-col gap-lg">
  <div className="grid min-w-0 gap-md lg:grid-cols-3">
   <MetricRowsCard title={'\u7ad9\u5740\u7535\u8017'} icon="lightning" description={'\u5f53\u524d\u5c0f\u65f6\u533a\u95f4 \u00b7 \u5df2\u89c2\u6d4b\u603b\u91cf'} metrics={[{key:'energy',label:'\u7535\u8017 / kWh',value:energy(total.energyWh)},{key:'coverage',label:'\u7535\u8017\u5df2\u91c7\u96c6 / \u7ad9\u5740',value:n(total.energyKnown)+' / '+n(total.sites)}]}/>
   <MetricRowsCard title={'\u80fd\u6548\u5f3a\u5ea6'} icon="gauge" description={'\u7535\u8017\u4e0e\u5bf9\u5e94\u6d41\u91cf\u5148\u6c47\u603b\u518d\u8ba1\u7b97'} metrics={[{key:'intensity',label:'\u6c47\u603b\u5f3a\u5ea6 / kWh/GiB',value:intensity(total.intensity)},{key:'raw',label:'\u5bf9\u5e94\u6d41\u91cf / GiB',value:total.energyKnown?n(total.pairedBytes/1073741824,2):'\u672a\u77e5'}]}/>
   <MetricRowsCard title={'\u4f9b\u7535\u4e0e\u73af\u5883'} icon="shield-check" description={'\u6240\u9009\u7ad9\u7fa4\u7684\u7269\u7406\u89c2\u6d4b'} metrics={[{key:'power',label:'\u5907\u7528\u4f9b\u7535 / \u5ea7',value:n(total.battery)},{key:'temp',label:'\u6700\u9ad8\u673a\u623f\u6e29\u5ea6 / \u00b0C',value:total.temperatureMax===null?'\u672a\u77e5':n(total.temperatureMax,1)}]}/>
  </div>
  <PanelCard title={'\u6570\u636e\u8986\u76d6\u4e0e\u672a\u77e5\u539f\u56e0'} icon="search" className="min-w-0" description={'\u5df2\u77e5\u3001\u672a\u91c7\u96c6\u3001\u672a\u5206\u644a\u5206\u522b\u8868\u8fbe'}>
   <DataTable rows={coverage} rowKey={r=>r.id} columns={[
    {id:'name',header:'\u89c2\u6d4b\u7ef4\u5ea6',cell:r=>r.name},{id:'coverage',header:'\u5df2\u77e5 / \u8303\u56f4',cell:r=><Coverage known={r.known} total={r.total}/>},
    {id:'reason',header:'\u8986\u76d6\u8bf4\u660e',cell:r=>r.reason},
   ]}/>
   <p className="pt-md text-body-small text-muted-foreground">{'\u8bbe\u5907\u6570\u91cf\u590d\u7528\u8d44\u6e90\u56fe\uff0c\u5171\u7528\u8bbe\u65bd\u6bcf\u7ad9\u53ea\u8ba1\u4e00\u6b21\uff1b\u8fd0\u8425\u5546\u5207\u7247\u5305\u542b\u5173\u8054\u5171\u7528\u8bbe\u65bd\u53ca\u672c\u65b9\u65e0\u7ebf\u8bbe\u5907\u3002\u7f3a\u5c11\u9065\u6d4b\u4e0d\u7b49\u540c\u6545\u969c\u6216\u6b63\u5e38\u3002'}</p>
  </PanelCard>
  <PanelCard title={'\u533a\u57df\u8fd0\u884c\u5bf9\u6bd4'} icon="city" className="min-w-0" description={'\u540c\u8303\u56f4\u7269\u7406\u7ad9\u5740 \u00b7 \u4f18\u5148\u5c55\u793a\u5173\u6ce8\u8f83\u591a\u533a\u57df'}>
   <DataTable rows={data.regions} rowKey={r=>r.id} columns={[
    {id:'region',header:'\u533a\u57df',cell:r=><Button variant="link" disabled={pending||data.regionLevel==='current'} onClick={()=>navigate(data.regionLevel==='city'?{cityId:r.id,countyId:'all'}:{countyId:r.id})}>{(data.regionLevel==='city'?region.cities:region.counties).find(x=>x.id===r.id)?.name??r.id}</Button>},
    {id:'sites',header:'\u7ad9\u5740',cell:r=>n(r.sites)}, {id:'energy',header:'\u7535\u8017 / kWh',align:'right',cell:r=>energy(r.energyWh)},
    {id:'share',header:'\u7535\u8017\u8d21\u732e',cell:r=>r.energyShare===null?'\u672a\u77e5':<div className="flex flex-col gap-xs"><span className="text-body-small text-muted-foreground">{n(r.energyShare*100,1)+'%'}</span><Progress value={r.energyShare*100} aria-label={'\u533a\u57df\u7535\u8017\u8d21\u732e'}/></div>},
    {id:'intensity',header:'kWh/GiB',cell:r=>intensity(r.intensity)}, {id:'power',header:'\u5907\u7528\u4f9b\u7535 / \u5ea7',cell:r=>n(r.battery)},
    {id:'temp',header:'\u6700\u9ad8\u6e29\u5ea6 / \u00b0C',cell:r=>r.temperatureMax===null?'\u672a\u77e5':n(r.temperatureMax,1)},
    {id:'coverage',header:'\u80fd\u6548\u53ef\u8bc4\u4f30 / \u7ad9\u5740',cell:r=>n(r.efficiencyKnown)+' / '+n(r.sites)},
   ]} empty={<EmptyState title={'\u5f53\u524d\u8303\u56f4\u6682\u65e0\u7ad9\u5740'}/>}/>
   <p className="pt-md text-body-small text-muted-foreground">{'\u8d21\u732e\u5206\u6bcd\u4e3a\u5f53\u524d\u8303\u56f4\u5df2\u89c2\u6d4b\u7535\u8017\uff0c\u96f6\u5206\u6bcd\u672a\u77e5\u3002\u6c47\u603b\u5f3a\u5ea6\u53ea\u5339\u914d\u7535\u8017\u5df2\u91c7\u96c6\u7ad9\u5740\u53ca\u5176\u6d41\u91cf\uff0c\u96f6\u6d41\u91cf\u7ad9\u7535\u8017\u4ecd\u8ba1\u5165\u5206\u5b50\uff1b\u90e8\u5206\u8986\u76d6\u4e0d\u4ee3\u8868\u5168\u91cf\u3002\u5907\u7528\u4f9b\u7535\u662f\u5f53\u524d\u65f6\u70b9\u7ad9\u6570\uff0c\u4e0d\u662f\u6545\u969c\u6b21\u6570\u3001\u6301\u7eed\u65f6\u95f4\u6216\u5269\u4f59\u7eed\u822a\u3002'}</p>
  </PanelCard>
  <PanelCard title={'24\u5c0f\u65f6\u65f6\u70b9\u8d8b\u52bf'} icon="chart-bar" className="min-w-0" description={'\u6bcf\u5c0f\u65f6\u72ec\u7acb\u6837\u672c \u00b7 \u4e0d\u63a8\u65ad\u4e8b\u4ef6\u6301\u7eed\u65f6\u95f4'}>
   <div className="flex flex-wrap justify-end gap-sm pb-md"><SegmentedControl className="h-control-xl" ariaLabel={'\u8fd0\u884c\u8d8b\u52bf\u6307\u6807'} value={metric} onChange={setMetric} items={items}/></div>
   {chart.length?<div className="min-w-0 overflow-x-auto"><BarChart className="min-w-panel-lg" data={chart} labelEvery={4} formatValue={v=>n(v,metric==='intensity'?3:metric==='energyWh'?2:0)+(metric==='energyWh'?' kWh':metric==='intensity'?' kWh/GiB':' \u5ea7')} peakLabel={'\u5cf0\u503c'} aria-label={'\u8fd0\u884c\u80fd\u654824\u5c0f\u65f6\u8d8b\u52bf'}/></div>:<EmptyState title={'\u8be5\u6307\u6807\u6682\u65e0\u53ef\u8bc4\u4f30\u6837\u672c'}/>}
  </PanelCard>
  <PanelCard title={'\u91cd\u70b9\u7ad9\u5740\u8bc1\u636e'} icon="building" className="min-w-0" description={'\u5f53\u524d\u4e13\u9898\u524d\u516d\u5173\u6ce8\u5bf9\u8c61 \u00b7 \u6cbf\u5730\u56fe\u539f\u6392\u5e8f'}>
   <DataTable rows={data.priority} rowKey={r=>r.id} columns={[
    {id:'site',header:'\u7ad9\u5740',cell:r=><TableTitleCell title={r.name} description={r.id} onTitleClick={()=>{setSelected(r.id);setHour(q.hour);}}/>},
    {id:'level',header:'\u4e13\u9898\u72b6\u6001',cell:r=><StatusBadge size="sm" tone={(data.kind==='power'?r.current.powerLevel:r.current.efficiencyLevel)==='critical'?'danger':'warning'}>{levelNames[data.kind==='power'?r.current.powerLevel:r.current.efficiencyLevel]}</StatusBadge>},
    {id:'energy',header:'\u7535\u8017 / kWh',cell:r=>energy(r.current.energyWh)}, {id:'intensity',header:'kWh/GiB',cell:r=>intensity(r.current.intensity)},
    {id:'power',header:'\u4f9b\u7535',cell:r=>supply(r.current.power)}, {id:'temp',header:'\u6e29\u5ea6 / \u00b0C',cell:r=>r.current.temperature===null?'\u672a\u77e5':n(r.current.temperature,1)},
   ]} empty={<EmptyState title={!data.allocated&&data.kind==='efficiency'?'\u8fd0\u8425\u5546\u7535\u8017\u672a\u5206\u644a\uff0c\u6682\u65e0\u53ef\u8bc4\u4f30\u91cd\u70b9':'\u5f53\u524d\u65f6\u70b9\u672a\u547d\u4e2d\u5173\u6ce8\u89c4\u5219'} description={'\u672a\u77e5\u6570\u636e\u4e0d\u4f5c\u4e3a\u6b63\u5e38\u6216\u5f02\u5e38\u7ed3\u8bba\u3002'}/>}/>
   {evidence&&o?<section aria-label={'\u8fd0\u884c\u7ad9\u5740\u65f6\u6bb5\u8bc1\u636e'} className="mt-lg flex min-w-0 flex-col gap-md border-t border-dashed border-border pt-lg">
    <div className="flex flex-wrap items-center justify-between gap-sm"><h3 className="text-heading-3">{evidence.name}</h3><Button variant="ghost" size="sm" onClick={()=>setSelected('')}>{'\u6536\u8d77\u8bc1\u636e'}</Button></div>
    <div className="flex flex-wrap items-center gap-sm">
     <NativeSelect aria-label={'\u8bc1\u636e\u65f6\u70b9'} wrapperClassName="w-auto" value={hour} onChange={e=>setHour(Number(e.target.value))}>{evidence.series.map(s=><option key={s.hour} value={s.hour}>{String(s.hour).padStart(2,'0')+':00'}</option>)}</NativeSelect>
     <Button asChild variant="outline"><a href={carry(relatedDossierHref(evidence.id,scope,'day','runtime'))}>{'\u8fd0\u884c\u6863\u6848'}</a></Button>
     <Button asChild variant="outline"><a href={carry(relatedDossierHref(evidence.id,scope,'day','resources'))}>{'\u8d44\u6e90\u8bbe\u5907'}</a></Button>
     <Button asChild variant="outline"><a href={carry(businessMapHref('efficiency',scope,evidence.id))} target="_blank" rel="noopener noreferrer">{'\u5730\u56fe\u5b9a\u4f4d'}</a></Button>
    </div>
    <p className="break-words text-body-small text-muted-foreground">{operatorNames[q.operator]+' \u00b7 '+data.observedAt.slice(0,10)+' '+String(hour).padStart(2,'0')+':00 \u00b7 '+data.sourceVersion+' \u00b7 '+data.policyVersion}</p>
    <DetailList columns={3}><DetailRow label={'\u4f9b\u7535\u72b6\u6001'}>{supply(o.power)}</DetailRow><DetailRow label={'\u7535\u8017 / kWh'}>{energy(o.energyWh)}</DetailRow><DetailRow label={'\u72ec\u7acb\u8bbe\u5907\u72b6\u6001'}>{n(evidence.resources.unknown)+' / '+n(evidence.resources.devices)+' \u672a\u91c7\u96c6'}</DetailRow></DetailList>
    <p className="text-body-small text-muted-foreground">{'\u8bc1\u636e\u65f6\u70b9\u4ec5\u6539\u53d8\u672c\u7ad9\u8c03\u67e5\uff0c\u4e0d\u6539\u53d8\u4e0a\u65b9\u6574\u4f53\u5206\u6790\u65f6\u70b9\u3002\u7ad9\u7ea7\u4f9b\u7535\u3001\u6e29\u5ea6\u4e0d\u4ee3\u8868\u8bbe\u5907\u5728\u7ebf\u6216\u7535\u6c60\u5065\u5eb7\uff0c\u76f8\u5173\u53d8\u5316\u4e0d\u8bc1\u660e\u539f\u56e0\u3002'}</p>
    <DataTable rows={evidence.series} rowKey={r=>String(r.hour)} columns={[
     {id:'hour',header:'\u65f6\u70b9',cell:r=><Button variant={hour===r.hour?'secondary':'link'} size="sm" onClick={()=>setHour(r.hour)}>{String(r.hour).padStart(2,'0')+':00'}</Button>},
     {id:'power',header:'\u4f9b\u7535',cell:r=>supply(r.power)},{id:'temp',header:'\u6e29\u5ea6 / \u00b0C',cell:r=>r.temperature===null?'\u672a\u77e5':n(r.temperature,1)},
     {id:'energy',header:'\u539f\u59cb\u7535\u8017 / Wh',cell:r=>r.energyWh===null?'\u672a\u77e5':n(r.energyWh)}, {id:'bytes',header:'\u539f\u59cb\u6d41\u91cf / \u5b57\u8282',cell:r=>n(r.bytes)},
     {id:'intensity',header:'kWh/GiB',cell:r=>intensity(r.intensity)}, {id:'level',header:'\u5f53\u524d\u4e13\u9898',cell:r=>levelNames[data.kind==='power'?r.powerLevel:r.efficiencyLevel]},
    ]}/>
   </section>:data.priority.length>0?<p className="pt-md text-body-small text-muted-foreground">{'\u9009\u62e9\u7ad9\u5740\u67e5\u770b24\u5c0f\u65f6\u539f\u59cb\u7535\u8017\u3001\u6d41\u91cf\u4e0e\u7269\u7406\u89c2\u6d4b\u3002'}</p>:null}
  </PanelCard>
 </div>;
}
