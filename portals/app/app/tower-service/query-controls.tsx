"use client";
import {useState,type ReactNode} from 'react';
import {useRouter} from 'next/navigation';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem,Button,Icon,Popover,PopoverTrigger,PopoverContent,Tooltip,TooltipTrigger,TooltipContent} from '@vxture/design-system';
import OperatorIdentity from '../portal/operator-identity';
import RegionSelector from '../portal/region-selector';
import ResetButton from '../portal/reset-button';
import FilterButton from '../portal/filter-button';
import type {RegionCatalog} from '../portal/region-selection';
import type {AnalysisHref} from '../site-analysis/workspace';
import type {SnapshotContext,SnapshotDescriptor} from '../domains/tower-service/query';
import {snapshotNeighbors} from '../domains/tower-service/query';
import {latestPeriodId} from '../domains/tower-service/period-reset';
import HistoryControls from './history-controls';
import {parseHistoryId} from '../domains/tower-service/history-calendar';

export default function SnapshotControls({context,snapshots,region,href,operators=['mobile','telecom','unicom','broadcast','other'],compact=false,showRegion=true,snapshotOnly=false,filtersCollapsed=false,analysisIcon,pending=false,onNavigate}:{context:SnapshotContext;snapshots:SnapshotDescriptor[];region:RegionCatalog;href:AnalysisHref;operators?:readonly string[];compact?:boolean;showRegion?:boolean;snapshotOnly?:boolean;filtersCollapsed?:boolean;analysisIcon?:ReactNode;pending?:boolean;onNavigate?:(patch:Record<string,string|number>)=>void}){
 const router=useRouter(),history=!!parseHistoryId(context.snapshotId);
 const currentFilters={operator:context.operator,compareSnapshotId:context.compareSnapshotId??'',city:context.city,county:context.county};
 const [open,setOpen]=useState(false),[draft,setDraft]=useState(currentFilters);
 const change=(patch:Record<string,string|number>)=>{if(pending)return;if(onNavigate)onNavigate({...patch,page:1});else router.push(href({...patch,page:1}),{scroll:false});};
 const options=snapshots.filter(s=>s.id!==context.snapshotId),neighbors=snapshotNeighbors(snapshots,context.snapshotId);
 const filterCount=Number(context.operator!=='all')+Number(!!context.compareSnapshotId)+Number(showRegion&&context.city!=='all');
 const values=filtersCollapsed?draft:currentFilters;
 const filterChange=(patch:Partial<typeof currentFilters>)=>filtersCollapsed?setDraft(current=>({...current,...patch})):change(patch);
 const conditions=<>
  <Select disabled={pending} value={values.operator} onValueChange={operator=>filterChange({operator})}><SelectTrigger className={filtersCollapsed?'h-control-xl w-full':'site-analysis-operator-select w-auto'} aria-label={'\u8fd0\u8425\u5546'}><SelectValue/></SelectTrigger><SelectContent>{['all',...operators].map(code=><SelectItem key={code} value={code}>{code==='all'?'\u5168\u90e8\u8fd0\u8425\u5546':<OperatorIdentity code={code}/>}</SelectItem>)}</SelectContent></Select>
  {showRegion&&<RegionSelector region={region} value={{cityId:values.city,countyId:values.county}} onChange={r=>filtersCollapsed?filterChange({city:r.cityId,county:r.countyId}):change({city:r.cityId,county:r.countyId,search:'',operatorCount:'all'})}/>}
  {options.length?<Select disabled={pending} value={values.compareSnapshotId||'none'} onValueChange={value=>filterChange({compareSnapshotId:value==='none'?'':value})}><SelectTrigger className={filtersCollapsed?'h-control-xl w-full':'w-auto'} aria-label={'\u5bf9\u6bd4\u5feb\u7167'}><SelectValue>{compact&&!filtersCollapsed?(values.compareSnapshotId?snapshots.find(s=>s.id===values.compareSnapshotId)?.stockAsOf.slice(5,16).replace('T',' '):'\u4e0d\u5bf9\u6bd4'):undefined}</SelectValue></SelectTrigger><SelectContent><SelectItem value="none">{'\u4e0d\u5bf9\u6bd4'}</SelectItem>{options.map(s=><SelectItem key={s.id} value={s.id}>{(history?s.businessPeriod?.start??s.stockAsOf:s.stockAsOf).slice(0,16).replace('T',' ')+(history?'':' / '+(s.syncedAt?s.id.slice(-8):'v1'))}</SelectItem>)}</SelectContent></Select>:<Tooltip><TooltipTrigger asChild><Button variant="ghost" aria-label={'\u5bf9\u6bd4\uff1a\u6682\u65e0\u57fa\u51c6\u7248\u672c'} aria-disabled="true"><Icon name="arrow-left-right" size="sm"/>{'\u5bf9\u6bd4'}</Button></TooltipTrigger><TooltipContent>{'\u4ec5\u6709\u4e00\u4e2a\u8d44\u6e90\u7248\u672c\uff0c\u6682\u65e0\u57fa\u51c6\u7248\u672c'}</TooltipContent></Tooltip>}
 </>;
 const filters=snapshotOnly?null:filtersCollapsed?<Popover open={open} onOpenChange={value=>{if(value)setDraft(currentFilters);setOpen(value);}}>
  <PopoverTrigger asChild><FilterButton count={filterCount} disabled={pending}/></PopoverTrigger>
  <PopoverContent width="md" align="end" className="site-analysis-filter-panel" aria-label={'\u5206\u6790\u7b5b\u9009'}>
   <div className="flex min-w-0 flex-col gap-md"><h3 className="text-label font-semibold">{'\u7b5b\u9009\u6761\u4ef6'}</h3>{conditions}
    <div className="flex items-center justify-between gap-sm border-t border-border pt-md"><ResetButton label={'\u6e05\u7a7a\u7b5b\u9009\u6761\u4ef6'} onClick={()=>setDraft({...currentFilters,operator:'all',compareSnapshotId:''})}/><Button size="xl" onClick={()=>{change(draft);setOpen(false);}}>{'\u5e94\u7528\u7b5b\u9009'}</Button></div>
   </div>
  </PopoverContent>
 </Popover>:conditions;
 const reset=<ResetButton variant="outline" label={'\u590d\u4f4d\u81f3\u6700\u65b0\u5468\u671f'} disabled={pending} onClick={()=>change({snapshotId:latestPeriodId(context.snapshotId,snapshots),compareSnapshotId:''})}/>;
 if(history)return <div className={'site-analysis-filters site-analysis-control-group snapshot-controls snapshot-controls-history'+(compact?' snapshot-controls-compact':'')}>
  <HistoryControls pending={pending} onNavigate={onNavigate} id={context.snapshotId} href={href} snapshots={snapshots}/>{filters}
 </div>;
 return <div className={'site-analysis-filters site-analysis-control-group snapshot-controls'+(compact?' snapshot-controls-compact':'')} role="group" aria-label={'\u7edf\u4e00\u5feb\u7167\u67e5\u8be2'}>
  <div className="flex min-w-0 flex-wrap items-center gap-xs">
   {snapshotOnly&&(analysisIcon===undefined?<Icon name="chart-bar" size="xl" className="shrink-0 text-primary"/>:analysisIcon)}
   <Select disabled={pending} value={context.snapshotId} onValueChange={snapshotId=>change({snapshotId,compareSnapshotId:''})}><SelectTrigger className="w-auto max-w-full" aria-label={'\u5468\u671f\uff08\u5feb\u7167\u7248\u672c\uff09'}><SelectValue>{compact?snapshots.find(s=>s.id===context.snapshotId)?.stockAsOf.slice(5,16).replace('T',' '):undefined}</SelectValue></SelectTrigger><SelectContent>{snapshots.map(s=><SelectItem value={s.id} key={s.id}>{s.stockAsOf.slice(0,10)+' \u00b7 '+s.stockAsOf.slice(11,16)+(s.syncedAt?' / '+s.id.slice(-8):'')}</SelectItem>)}</SelectContent></Select>
   {snapshotOnly&&<><Button variant="outline" size="icon-xl" aria-label={'\u4e0a\u4e00\u5feb\u7167'} disabled={pending||!neighbors.previous} onClick={()=>neighbors.previous&&change({snapshotId:neighbors.previous,compareSnapshotId:''})}><Icon name="chevron-left" size="sm"/></Button><Button variant="outline" size="icon-xl" aria-label={'\u4e0b\u4e00\u5feb\u7167'} disabled={pending||!neighbors.next} onClick={()=>neighbors.next&&change({snapshotId:neighbors.next,compareSnapshotId:''})}><Icon name="chevron-right" size="sm"/></Button></>}
   {reset}
  </div>{filters}
 </div>;
}
