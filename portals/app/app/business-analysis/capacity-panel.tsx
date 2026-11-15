"use client";
import {useOperatorNames} from "../portal/operator-identities";
import {useState} from 'react';
import {BarChart,Button,DataTable,DetailList,DetailRow,EmptyState,NativeSelect,PanelCard,Progress,SegmentedControl,StatusBadge,TableTitleCell} from '@vxture/design-system';
import MetricRowsCard from '../portal/metric-rows-card';
import type {CapacityAnalysis} from '../domains/map-demo/capacity-rules';
import type {RegionDefinition} from '../domains/map-demo/types';
import {n,pct,operatorNames} from '../sites/labels';
import {businessHref,businessMapHref,type BusinessScope} from './links';
import {relatedDossierHref,relatedReviewHref} from '../portal/investigation-targets';
import {useInvestigationLinks} from '../portal/investigation';

type Metric='attention'|'load'|'connection';
const metricItems=[{value:'attention' as const,label:'\u5173\u6ce8\u7ad9\u6570'},{value:'load' as const,label:'\u8d1f\u8f7d\u7387'},{value:'connection' as const,label:'\u63a5\u901a\u7387'}];
const reasons=(o:{highLoad:boolean;lowConnection:boolean;load:number|null;connection:number|null})=>[o.highLoad?'\u9ad8\u8d1f\u8f7d':null,o.lowConnection?'\u4f4e\u63a5\u901a':null,o.load===null?'\u5bb9\u91cf\u672a\u77e5':null,o.connection===null?'\u63a5\u901a\u672a\u77e5':null].filter(Boolean).join(' / ')||'\u672a\u547d\u4e2d';
function Ratio({value,label}:{value:number|null;label:string}){
 return <div className="flex min-w-0 flex-col gap-xs"><span className="text-body-small tabular-nums text-muted-foreground">{pct(value)}</span>{value!==null&&<Progress value={value*100} aria-label={label}/>}</div>;
}
export default function CapacityPanel({data,q,region,pending,navigate}:{data:CapacityAnalysis;q:BusinessScope;region:RegionDefinition;pending:boolean;navigate:(patch:Partial<BusinessScope>)=>void}){
 const operatorNames=useOperatorNames();
 const [view,setView]=useState<'regions'|'operators'>('regions'),[metric,setMetric]=useState<Metric>('attention'),[selected,setSelected]=useState('');
 const [evidenceHour,setEvidenceHour]=useState(q.hour);
 const {carry}=useInvestigationLinks(businessHref('capacity',q));
 const total=data.total,evidence=data.priority.find(s=>s.id===selected);
 const evidenceScope={...q,hour:evidenceHour},observation=evidence?.series[evidenceHour];
 const rows:(Omit<CapacityAnalysis['regions'][number],'id'>&{key:string;name:string})[]=view==='regions'?data.regions.map(r=>({...r,key:r.id,name:(data.regionLevel==='city'?region.cities:region.counties).find(c=>c.id===r.id)?.name??r.id})):
  data.operators.map(r=>({...r,key:r.code,name:operatorNames[r.code]}));
 const drill=(key:string)=>view==='operators'?navigate({operator:key as BusinessScope['operator']}):data.regionLevel==='city'?navigate({cityId:key,countyId:'all'}):data.regionLevel==='county'?navigate({countyId:key}):undefined;
 const chart=data.series.filter(s=>s[metric]!==null).map(s=>({key:String(s.hour),label:String(s.hour).padStart(2,'0'),value:metric==='attention'?s.attention:(s[metric]??0)*100}));
 return <div data-capacity-contributions={data.version} className="flex min-w-0 flex-col gap-lg">
  <div className="grid min-w-0 gap-md lg:grid-cols-3">
   <MetricRowsCard title={'\u5bb9\u91cf\u8d1f\u8f7d'} icon="gauge" description={'\u6309\u914d\u7f6e\u5bb9\u91cf\u52a0\u6743'} metrics={[
    {key:'load',label:'\u6c47\u603b\u8d1f\u8f7d\u7387',value:pct(total.load)},
    {key:'raw',label:'\u5360\u7528 / \u5bb9\u91cf',value:n(total.used)+' / '+n(total.capacity)},
   ]}/>
   <MetricRowsCard title={'\u547c\u53eb\u8d28\u91cf'} icon="users" description={'\u6309\u547c\u53eb\u5c1d\u8bd5\u52a0\u6743'} metrics={[
    {key:'connection',label:'\u6c47\u603b\u63a5\u901a\u7387',value:pct(total.connection)},
    {key:'raw',label:'\u63a5\u901a / \u5c1d\u8bd5',value:n(total.connected)+' / '+n(total.attempts)},
   ]}/>
   <MetricRowsCard title={'\u672a\u63a5\u901a\u5206\u6790'} icon="flag" description={'\u5c1d\u8bd5\u51cf\u63a5\u901a\uff0c\u4e0d\u7b49\u540c\u6d41\u5931\u4e1a\u52a1\u91cf'} metrics={[
    {key:'failed',label:'\u672a\u63a5\u901a\u547c\u53eb',value:n(total.failed)},
    {key:'rate',label:'\u5360\u547c\u53eb\u5c1d\u8bd5',value:pct(total.attempts>0?total.failed/total.attempts:null)},
   ]}/>
  </div>
  <PanelCard title={'\u98ce\u9669\u7ed3\u6784\u4e0e\u8986\u76d6'} icon="shield-check" className="min-w-0">
   <DetailList columns={3}>
    <DetailRow label={'\u9ad8\u8d1f\u8f7d\u7ad9\u5740'}>{n(total.highLoad)+' \u5ea7 \u00b7 \u8d1f\u8f7d \u226585%'}</DetailRow>
    <DetailRow label={'\u4f4e\u63a5\u901a\u7ad9\u5740'}>{n(total.lowConnection)+' \u5ea7 \u00b7 \u63a5\u901a\u7387 <98%'}</DetailRow>
    <DetailRow label={'\u53cc\u547d\u4e2d'}>{n(total.both)+' \u5ea7 \u00b7 \u4e0d\u91cd\u590d\u8ba1\u5165\u7efc\u5408\u5173\u6ce8'}</DetailRow>
    <DetailRow label={'\u5bb9\u91cf\u53ef\u8bc4\u4f30'}>{n(total.capacityKnown)+' / '+n(total.sites)+' \u5ea7'}</DetailRow>
    <DetailRow label={'\u63a5\u901a\u53ef\u8bc4\u4f30'}>{n(total.connectionKnown)+' / '+n(total.sites)+' \u5ea7'}</DetailRow>
    <DetailRow label={'\u7efc\u5408\u5173\u6ce8'}>{n(total.attention)+' \u5ea7 \u00b7 \u5404\u7ef4\u5ea6\u8986\u76d6\u72ec\u7acb\u8ba1\u7b97'}</DetailRow>
   </DetailList>
  </PanelCard>
  <PanelCard title={'\u8d21\u732e\u5206\u6790'} icon="city" className="min-w-0" description={view==='regions'?'\u5730\u57df\u4e92\u65a5\u5206\u7ec4 \u00b7 \u6309\u672a\u63a5\u901a\u547c\u53eb\u6570\u964d\u5e8f':'\u670d\u52a1\u5173\u7cfb\u5207\u7247 \u00b7 \u5171\u4eab\u7ad9\u5740\u8de8\u8fd0\u8425\u5546\u4e0d\u76f8\u52a0'}>
   <div className="flex flex-wrap justify-end gap-sm pb-md"><SegmentedControl className="h-control-xl" ariaLabel={'\u8d21\u732e\u5206\u6790\u89c6\u89d2'} value={view} onChange={setView} items={[{value:'regions',label:'\u533a\u57df',icon:'city'},{value:'operators',label:'\u8fd0\u8425\u5546',icon:'users'}]}/></div>
   <DataTable rows={rows} rowKey={r=>r.key} columns={[
    {id:'name',header:view==='regions'?'\u533a\u57df':'\u8fd0\u8425\u5546',cell:r=><Button variant="link" disabled={pending||(view==='regions'&&data.regionLevel==='current')} onClick={()=>drill(r.key)}>{r.name}</Button>},
    {id:'sites',header:'\u7ad9\u5740 / \u5173\u6ce8',cell:r=>n(r.sites)+' / '+n(r.attention)},
    {id:'load',header:'\u8d1f\u8f7d\u7387',cell:r=><Ratio value={r.load} label={r.name+'\u8d1f\u8f7d\u7387'}/>},
    {id:'usedShare',header:'\u5360\u7528\u8d21\u732e',cell:r=><Ratio value={r.usedShare} label={r.name+'\u5360\u7528\u8d21\u732e'}/>},
    {id:'connection',header:'\u63a5\u901a\u7387',cell:r=><Ratio value={r.connection} label={r.name+'\u63a5\u901a\u7387'}/>},
    {id:'failed',header:'\u672a\u63a5\u901a\u547c\u53eb',align:'right',cell:r=>n(r.failed)},
    {id:'failedShare',header:'\u672a\u63a5\u901a\u8d21\u732e',cell:r=><Ratio value={r.failedShare} label={r.name+'\u672a\u63a5\u901a\u8d21\u732e'}/>},
   ]} empty={<EmptyState title={'\u5f53\u524d\u8303\u56f4\u6682\u65e0\u7ad9\u5740'}/>}/>
   <p className="pt-md text-body-small text-muted-foreground">{'\u8d21\u732e\u5206\u6bcd\u4e3a\u5f53\u524d\u8303\u56f4\u603b\u5360\u7528\u3001\u603b\u672a\u63a5\u901a\u547c\u53eb\uff1b\u5206\u6bcd\u4e3a\u96f6\u65f6\u672a\u77e5\u3002\u6bd4\u7387\u6309\u539f\u59cb\u91cf\u6c47\u603b\uff0c\u4e0d\u5e73\u5747\u5404\u7ad9\u767e\u5206\u6bd4\u3002\u533a\u57df\u4e0e\u8fd0\u8425\u5546\u4e3a\u72ec\u7acb\u5207\u7247\uff0c\u5173\u6ce8\u7ad9\u6570\u4e0d\u53ef\u8de8\u89c6\u89d2\u76f8\u52a0\u3002'}</p>
  </PanelCard>
  <PanelCard title={'24\u5c0f\u65f6\u65f6\u70b9\u8d8b\u52bf'} icon="chart-bar" className="min-w-0" description={'\u540c\u4e00\u7ad9\u5740\u8303\u56f4 \u00b7 \u5404\u65f6\u70b9\u72ec\u7acb\u5224\u5b9a\uff0c\u4e0d\u5f53\u4f5c\u8fde\u7eed\u6545\u969c\u65f6\u957f'}>
   <div className="flex flex-wrap justify-end gap-sm pb-md"><SegmentedControl className="h-control-xl" ariaLabel={'\u5bb9\u91cf\u8d8b\u52bf\u6307\u6807'} value={metric} onChange={setMetric} items={metricItems}/></div>
   {chart.length?<div className="min-w-0 overflow-x-auto"><BarChart className="min-w-panel-lg" data={chart} labelEvery={4} formatValue={v=>n(v,metric==='attention'?0:1)+(metric==='attention'?' \u5ea7':'%')} peakLabel={'\u5cf0\u503c'} aria-label={'\u5bb9\u91cf\u8d28\u91cf24\u5c0f\u65f6\u8d8b\u52bf'}/></div>:<EmptyState title={'\u8be5\u6307\u6807\u6682\u65e0\u53ef\u8bc4\u4f30\u6837\u672c'}/>}
   {chart.length<24&&<p className="pt-sm text-body-small text-muted-foreground">{'\u65e0\u6709\u6548\u5206\u6bcd\u7684\u65f6\u70b9\u4e0d\u7ed8\u5236\u4e3a\u96f6\u3002'}</p>}
  </PanelCard>
  <PanelCard title={'\u91cd\u70b9\u7ad9\u5740\u8bc1\u636e'} icon="building" className="min-w-0" description={'\u5f53\u524d\u65f6\u70b9\u524d\u516d\u5173\u6ce8\u5bf9\u8c61 \u00b7 \u6cbf\u5730\u56fe\u4e13\u9898\u4e25\u91cd\u7a0b\u5ea6\u548c\u6307\u6807\u6392\u5e8f'}>
   <DataTable rows={data.priority} rowKey={r=>r.id} columns={[
    {id:'site',header:'\u7ad9\u5740',cell:r=><TableTitleCell title={r.name} description={r.id} onTitleClick={()=>{setSelected(r.id);setEvidenceHour(q.hour);}}/>},
    {id:'reason',header:'\u89e6\u53d1\u7ebf\u7d22',cell:r=><StatusBadge tone={r.current.level==='critical'?'danger':'warning'} size="sm">{reasons(r.current)}</StatusBadge>},
    {id:'load',header:'\u8d1f\u8f7d\u7387',cell:r=><Ratio value={r.current.load} label={r.name+'\u8d1f\u8f7d\u7387'}/>},
    {id:'connection',header:'\u63a5\u901a\u7387',cell:r=><Ratio value={r.current.connection} label={r.name+'\u63a5\u901a\u7387'}/>},
    {id:'failed',header:'\u672a\u63a5\u901a\u547c\u53eb',align:'right',cell:r=>n(r.current.failed)},
   ]} empty={<EmptyState title={'\u5f53\u524d\u65f6\u70b9\u672a\u547d\u4e2d\u5173\u6ce8\u89c4\u5219'} description={'\u53ef\u67e5\u770b\u5b8c\u6574\u7ad9\u5740\u660e\u7ec6\u6216\u5207\u6362\u65f6\u70b9\u3002'}/>}/>
   {evidence?<section aria-label={'\u91cd\u70b9\u7ad9\u5740\u65f6\u6bb5\u8bc1\u636e'} className="mt-lg flex min-w-0 flex-col gap-md border-t border-dashed border-border pt-lg">
    <div className="flex flex-wrap items-center justify-between gap-sm"><h3 className="text-heading-3">{evidence.name}</h3><Button variant="ghost" size="sm" onClick={()=>setSelected('')}>{'\u6536\u8d77\u8bc1\u636e'}</Button></div>
    <div className="flex flex-wrap items-center gap-sm">
     <NativeSelect aria-label={'\u8bc1\u636e\u65f6\u70b9'} wrapperClassName="w-auto" value={evidenceHour} onChange={e=>setEvidenceHour(Number(e.target.value))}>{evidence.series.map(s=><option key={s.hour} value={s.hour}>{String(s.hour).padStart(2,'0')+':00'}</option>)}</NativeSelect>
     <Button asChild variant="outline"><a href={carry(relatedDossierHref(evidence.id,evidenceScope,'day','runtime'))}>{'\u7ad9\u5740\u6863\u6848'}</a></Button>
     <Button asChild variant="outline"><a href={carry(relatedReviewHref(evidenceScope,'day',evidence.id))}>{'\u6838\u9a8c\u7ebf\u7d22'}</a></Button>
     <Button asChild variant="outline"><a href={carry(businessMapHref('capacity',evidenceScope,evidence.id))} target="_blank" rel="noopener noreferrer">{'\u5730\u56fe\u5b9a\u4f4d'}</a></Button>
    </div>
    <p className="break-words text-body-small text-muted-foreground">{operatorNames[q.operator]+' \u00b7 '+data.observedAt.slice(0,10)+' '+String(evidenceHour).padStart(2,'0')+':00 \u00b7 '+data.sourceVersion+' \u00b7 '+data.policyVersion}</p>
    {observation&&<DetailList columns={3}><DetailRow label={'\u8bc1\u636e\u7ebf\u7d22'}>{reasons(observation)}</DetailRow><DetailRow label={'\u8bc1\u636e\u8d1f\u8f7d\u7387'}>{pct(observation.load)}</DetailRow><DetailRow label={'\u8bc1\u636e\u63a5\u901a\u7387'}>{pct(observation.connection)}</DetailRow></DetailList>}
    <p className="text-body-small text-muted-foreground">{'\u8bc1\u636e\u65f6\u70b9\u4ec5\u7528\u4e8e\u672c\u7ad9\u8c03\u67e5\uff0c\u4e0d\u6539\u53d8\u4e0a\u65b9\u6574\u4f53\u5206\u6790\u65f6\u70b9\u3002'}</p>
    <DataTable rows={evidence.series} rowKey={s=>String(s.hour)} columns={[
     {id:'hour',header:'\u65f6\u70b9',cell:s=><Button variant={evidenceHour===s.hour?'secondary':'link'} size="sm" onClick={()=>setEvidenceHour(s.hour)}>{String(s.hour).padStart(2,'0')+':00'}</Button>},
     {id:'reason',header:'\u7ebf\u7d22',cell:s=>reasons(s)},
     {id:'used',header:'\u5360\u7528 / \u5bb9\u91cf',cell:s=>n(s.used)+' / '+n(s.capacity)},
     {id:'load',header:'\u8d1f\u8f7d\u7387',cell:s=>pct(s.load)},
     {id:'connected',header:'\u63a5\u901a / \u5c1d\u8bd5',cell:s=>n(s.connected)+' / '+n(s.attempts)},
     {id:'connection',header:'\u63a5\u901a\u7387',cell:s=>pct(s.connection)},
     {id:'failed',header:'\u672a\u63a5\u901a\u547c\u53eb',cell:s=>n(s.failed)},
    ]}/>
    <p className="text-body-small text-muted-foreground">{'\u4ee5\u4e0a\u4e3a\u540c\u6e90\u65f6\u70b9\u89c2\u6d4b\uff0c\u4e0d\u8bc1\u660e\u6545\u969c\u539f\u56e0\uff1b\u6838\u9a8c\u9875\u5982\u65e0\u5bf9\u5e94\u6765\u6e90\u6848\u4f8b\u5c06\u5982\u5b9e\u4e3a\u7a7a\uff0c\u4e0d\u81ea\u52a8\u751f\u6210\u6848\u4ef6\u3002'}</p>
   </section>:data.priority.length>0?<p className="pt-md text-body-small text-muted-foreground">{'\u9009\u62e9\u7ad9\u5740\u540d\u79f0\u67e5\u770b24\u5c0f\u65f6\u539f\u59cb\u5206\u5b50\u3001\u5206\u6bcd\u548c\u89e6\u53d1\u7ebf\u7d22\u3002'}</p>:null}
  </PanelCard>
 </div>;
}
