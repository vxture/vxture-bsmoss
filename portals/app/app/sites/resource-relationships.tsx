"use client";
import {useState} from 'react';
import {Button,DataTable,DetailList,DetailRow,Icon,NativeSelect,PanelCard,StatusBadge,TableTitleCell} from '@vxture/design-system';
import {resourceScope,type ResourceGraph,type ResourceObservation} from '../domains/site-registry/resource-rules';
import type {OperatorFilter} from '../domains/map-demo/types';
import {n,operatorNames} from './labels';

function observationLabel(o:ResourceObservation){
 if(o.value===null)return '\u2014';
 if(o.kind==='power')return '\u7ad9\u7ea7 \u00b7 '+(o.value==='battery'?'\u5907\u7528\u4f9b\u7535':'\u5e02\u7535');
 if(o.kind==='energy')return '\u7ad9\u7ea7 \u00b7 '+n(Number(o.value)/1000,2)+' kWh';
 if(o.kind==='temperature')return '\u7ad9\u7ea7 \u00b7 '+n(Number(o.value),1)+' \u00b0C';
 return '\u2014';
}
export default function ResourceRelationships({graph,operator:initial}:{graph:ResourceGraph;operator:OperatorFilter}){
 const [operator,setOperator]=useState<OperatorFilter>(graph.relations.some(r=>r.code===initial)?initial:'all');
 const [selected,setSelected]=useState<string|null>(null),scope=resourceScope(graph,operator);
 const device=scope.devices.find(d=>d.id===selected),relation=scope.relations.length===1?scope.relations[0]:null;
 const change=(code:OperatorFilter)=>{setOperator(code);setSelected(null);};
 return <div className="min-w-0" data-resource-relationships><PanelCard className="min-w-0" title={"\u8d44\u6e90\u627f\u8f7d\u5173\u7cfb"} icon="stack"
  description={"\u7269\u7406\u7ad9\u5740 \u2192 \u670d\u52a1\u5173\u7cfb \u2192 \u627f\u8f7d\u8d44\u6e90"}
  action={<NativeSelect aria-label={"\u627f\u8f7d\u5173\u7cfb\u8303\u56f4"} wrapperClassName="w-auto" value={operator} onChange={e=>change(e.target.value as OperatorFilter)}>
   <option value="all">{"\u5168\u7ad9\u627f\u8f7d"}</option>{graph.relations.map(r=><option key={r.id} value={r.code}>{operatorNames[r.code]}</option>)}
  </NativeSelect>}>
  <div className="flex min-w-0 flex-col gap-lg">
   <div className="flex items-start gap-md"><Icon name="building" size="lg"/><div className="min-w-0"><p className="text-label font-semibold">{graph.physical.name}</p><p className="break-all text-body-small text-muted-foreground">{graph.physical.id+' \u00b7 '+graph.physical.assetCode}</p></div></div>
   <dl className="grid grid-cols-2 gap-md sm:grid-cols-4">{[
    ['\u5168\u7ad9\u670d\u52a1\u5173\u7cfb',graph.relations.length],['\u5168\u7ad9\u5b9e\u4f53\u8d44\u6e90',graph.devices.length],
    ['\u5171\u7528\u8bbe\u65bd',graph.devices.filter(d=>d.relationId===null).length],['\u5f53\u524d\u5173\u8054\u8d44\u6e90',scope.devices.length],
   ].map(([k,v])=><div key={k}><dt className="text-body-small text-muted-foreground">{k}</dt><dd className="text-heading-2 tabular-nums">{v}</dd></div>)}</dl>
   <DetailList columns={2}>
    <DetailRow label={"\u5f53\u524d\u670d\u52a1\u5173\u7cfb"}>{relation?<span className="break-all">{operatorNames[relation.code]+' \u00b7 '+relation.id}</span>:'\u5168\u90e8\u5173\u7cfb'}</DetailRow>
    <DetailRow label={"\u8d44\u6e90\u89c2\u6d4b\u65f6\u70b9"}>{graph.observedAt.slice(0,16).replace('T',' ')+' \u00b7 \u5317\u4eac\u65f6\u95f4'}</DetailRow>
    <DetailRow label={"\u7ad9\u5740\u6709\u6548\u671f"}>{"\u5f85\u6765\u6e90\u6838\u5b9e"}</DetailRow>
    <DetailRow label={"\u670d\u52a1\u6709\u6548\u671f"}>{"\u5f85\u6765\u6e90\u6838\u5b9e"}</DetailRow>
   </DetailList>
   <p className="text-body-small text-muted-foreground">{"\u5171\u7528\u8bbe\u65bd\u53ea\u8ba1\u4e00\u6b21\uff1b\u6309\u8fd0\u8425\u5546\u67e5\u770b\u4e0d\u5206\u644a\u7269\u7406\u7535\u8017\u3002\u5173\u8054\u89c2\u6d4b\u4e3a\u7ad9\u7ea7\u6570\u636e\uff0c\u8bbe\u5907\u72b6\u6001\u672a\u91c7\u96c6\u3002"}</p>
   <DataTable rows={scope.devices} rowKey={d=>d.id} columns={[
    {id:'device',header:'\u8d44\u6e90 / \u8bbe\u5907',cell:d=><TableTitleCell title={d.name} description={d.id} onTitleClick={()=>setSelected(d.id)}/>},
    {id:'owner',header:'\u7c7b\u522b / \u5f52\u5c5e',cell:d=><TableTitleCell title={d.category} description={operatorNames[d.owner]??d.owner}/>},
    {id:'relations',header:'\u5173\u8054\u670d\u52a1',cell:d=><div className="flex flex-wrap gap-xs">{graph.relations.filter(r=>d.relationIds.includes(r.id)).map(r=><Button key={r.id} variant="link" size="sm" title={r.id} onClick={()=>change(r.code)}>{operatorNames[r.code]}</Button>)}</div>},
    {id:'state',header:'\u8bbe\u5907\u72b6\u6001',cell:d=><StatusBadge tone="neutral" size="sm">{d.stateLabel}</StatusBadge>},
    {id:'observation',header:'\u5173\u8054\u89c2\u6d4b',cell:d=><span className="text-body-small text-muted-foreground">{observationLabel(d.observation)}</span>},
   ]}/>
   {device&&<section aria-label={"\u8d44\u6e90\u5173\u7cfb\u8be6\u60c5"} className="flex flex-col gap-md border-t border-dashed border-border pt-lg">
    <div className="flex flex-wrap items-center justify-between gap-sm"><h3 className="text-heading-3">{device.name}</h3><Button variant="ghost" size="sm" onClick={()=>setSelected(null)}>{"\u6536\u8d77\u8be6\u60c5"}</Button></div>
    <DetailList columns={2}>
     <DetailRow label={"\u8d44\u6e90\u7f16\u7801"}><span className="break-all">{device.id}</span></DetailRow><DetailRow label={"\u7269\u7406\u7ad9\u5740"}>{device.siteId}</DetailRow>
     <DetailRow label={"\u89c4\u683c"}>{device.spec}</DetailRow><DetailRow label={"\u5173\u8054\u5173\u7cfb"}><span className="break-all">{device.relationIds.join(' / ')}</span></DetailRow>
     <DetailRow label={"\u8bbe\u5907\u6709\u6548\u671f"}>{"\u5f85\u6765\u6e90\u6838\u5b9e"}</DetailRow><DetailRow label={"\u8bbe\u5907\u72b6\u6001\u4f9d\u636e"}>{"\u672a\u63a5\u5165\u72ec\u7acb\u9065\u6d4b\u6216\u5de1\u68c0"}</DetailRow>
     <DetailRow label={"\u8d44\u6e90\u6a21\u578b"}><span className="break-all">{graph.version}</span></DetailRow><DetailRow label={"\u89c2\u6d4b\u6765\u6e90"}>{graph.sourceVersion}</DetailRow>
    </DetailList>
   </section>}
   <p className="text-body-small text-muted-foreground">{"\u5f53\u524d\u5feb\u7167\u4e0d\u8bc1\u660e\u5386\u53f2\u6709\u6548\u671f\u3002\u5b89\u88c5\u3001\u6295\u8fd0\u3001\u62c6\u9664\u53ca\u5408\u540c\u8d44\u6599\u672a\u6838\u5b9e\uff0c\u4e0d\u636e\u6b64\u63a8\u65ad\u65b0\u589e\u6216\u9000\u51fa\u3002"}</p>
  </div>
 </PanelCard></div>;
}
