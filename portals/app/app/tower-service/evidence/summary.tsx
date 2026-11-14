'use client';
import {useEffect,useState,type ReactNode} from 'react';
import {Button,DataTable,Drawer,Icon,TableTitleCell,Progress} from '@vxture/design-system';
import ActionMenu from '../../portal/action-menu';
import {SERVICE_DELIVERABLES} from '../../domains/tower-service/delivery-catalog';
import {configurationTime} from '../../settings/configuration-layout';
import type {EvidenceModel} from './model';
type Group=EvidenceModel['groups'][number];
type Item=Group['children'][number];
type Row={id:string;group:Group;item?:Item};
const number=(value:number)=>value.toLocaleString('zh-CN');
const rate=(value:number|null)=>value===null?'\u2014':(value*100).toFixed(1)+'%';
export default function EvidenceSummary({model:m,onDetails,tools}:{model:EvidenceModel;onDetails:(patch:Record<string,string|number>)=>void;tools?:ReactNode}){
 const categoryIcons={tower:'building',space:'building',power:'lightning',backup:'lightning',facilities:'plugs-connected',metering:'database',indoor:'map-pin',transport:'plugs-connected'} as const;
 const [expanded,setExpanded]=useState<string[]>([]),[detailId,setDetailId]=useState<string|null>(null);
 const rows:Row[]=m.groups.flatMap(group=>[{id:'group:'+group.id,group},...(expanded.includes(group.id)?group.children.map(item=>({id:'item:'+item.id,group,item})):[])]);
 const detail=m.groups.flatMap(group=>[{id:'group:'+group.id,group} as Row,...group.children.map(item=>({id:'item:'+item.id,group,item}))]).find(row=>row.id===detailId);
 const selected=detail?.item??detail?.group;
 const definition=SERVICE_DELIVERABLES.find(item=>item.id===detail?.item?.id);
 const services=m.groups.flatMap(group=>group.children);
 const recorded=services.filter(item=>item.items>0);
 const gaps=services.filter(item=>!item.items&&m.configurationGaps.includes(item.id)).length;
 const absent=services.length-recorded.length-gaps;
 const scopeNote=[recorded.length+' / '+services.length+' \u9879\u670d\u52a1\u6709\u4f9d\u636e',gaps?gaps+' \u9879\u5f85\u63a5\u5165':'',absent?absent+' \u9879\u5f53\u524d\u6682\u65e0\u8bb0\u5f55':''].filter(Boolean).join(' \u00b7 ');
 const toggle=(id:string)=>setExpanded(current=>current.includes(id)?current.filter(v=>v!==id):[...current,id]);
 const show=(row:Row)=>setDetailId(current=>current===row.id?null:row.id);
 useEffect(()=>{setDetailId(null);},[m.context.snapshotId,m.context.operator,m.context.city,m.context.county]);
 const drill=(item:Item,patch:Record<string,string|number>={})=>{setDetailId(null);onDetails({service:item.id,...patch});};
 const activate=(row:Row)=>row.item?show(row):toggle(row.group.id);
 const breakdown:{id:string;label:string;value:number;patch:Record<string,string|number>}[]=selected?[
  {id:'configuration',label:'\u5b8c\u6574\u914d\u7f6e',value:selected.configuration,patch:{method:'configuration',state:'complete'}},
  {id:'measured',label:'\u5b8c\u6574\u5b9e\u6d4b',value:selected.measured,patch:{method:'measured',state:'complete'}},
  {id:'allocated',label:'\u5b8c\u6574\u5206\u644a',value:selected.allocated,patch:{method:'allocated',state:'complete'}},
  {id:'estimated',label:'\u6388\u6743\u4f30\u7b97',value:selected.estimated,patch:{state:'estimated'}},
  {id:'pending',label:'\u5f85\u786e\u8ba4',value:selected.pending,patch:{state:'pending'}},
  {id:'conflict',label:'\u51b2\u7a81',value:selected.conflict,patch:{state:'conflict'}},
  {id:'unassigned',label:'\u5f85\u5f52\u5c5e',value:selected.unassigned,patch:{state:'unassigned'}}
 ]:[];
 return <section className="evidence-summary-open" aria-label={'\u670d\u52a1\u4f9d\u636e\u6e05\u5355'}>
 <div className="evidence-summary-tools site-analysis-action-row"><div className="flex min-w-0 items-center gap-md"><Button variant="ghost" onClick={()=>setExpanded(expanded.length?[]:m.groups.map(g=>g.id))}>{expanded.length?'\u5168\u90e8\u6536\u8d77':'\u5168\u90e8\u5c55\u5f00'}</Button><span className="text-body-small text-muted-foreground truncate" title={scopeNote}>{scopeNote}</span></div><div className="evidence-summary-tool-actions">{tools}</div></div>
 <div className="evidence-table service-matrix-table evidence-summary-table" onClick={event=>{
  if((event.target as HTMLElement).closest('button,a,[role=menuitem]'))return;
  const tr=(event.target as HTMLElement).closest('tbody > tr');if(!tr)return;
  const row=rows[Array.from(tr.parentElement!.children).indexOf(tr)];if(row)activate(row);
 }}>
 <DataTable rows={rows} rowKey={r=>r.id} columns={[
 {id:'expand',header:<span className="sr-only">{'\u5c55\u5f00'}</span>,align:'center',cell:r=>!r.item?<Button variant="ghost" size="icon-xl" className="service-matrix-category-button" aria-label={(expanded.includes(r.group.id)?'\u6536\u8d77':'\u5c55\u5f00')+r.group.name} aria-expanded={expanded.includes(r.group.id)} onClick={()=>toggle(r.group.id)}><Icon name={expanded.includes(r.group.id)?'chevron-down':'chevron-right'} size="sm"/></Button>:null},
 {id:'service',header:'\u670d\u52a1 / \u4f9d\u636e\u8303\u56f4',cell:r=>r.item?<div className="service-matrix-child"><span className="text-body-small tabular-nums text-muted-foreground">{String(r.group.children.findIndex(item=>item.id===r.item!.id)+1).padStart(2,'0')}</span><Button variant="ghost" className="evidence-service-name" aria-label={r.item.name+'\u7684\u8be6\u60c5'} aria-expanded={detailId===r.id} aria-haspopup="dialog" onClick={()=>show(r)}><TableTitleCell title={r.item.name}/></Button></div>:<div className="flex min-w-0 items-center gap-sm"><Icon name={categoryIcons[r.group.id as keyof typeof categoryIcons]??'database'} size="md" className="text-muted-foreground shrink-0"/><Button variant="ghost" className="evidence-service-name font-semibold" aria-expanded={expanded.includes(r.group.id)} onClick={()=>toggle(r.group.id)}><span className="truncate">{r.group.name}</span></Button><span className="text-body-small text-muted-foreground whitespace-nowrap">{r.group.children.length+' \u9879'}</span></div>},
 {id:'items',header:'\u4f9d\u636e\u6761\u6570',align:'center',cell:r=><span className="tabular-nums">{number((r.item??r.group).items)}</span>},
 {id:'complete',header:'\u5b8c\u6574',align:'center',cell:r=><span className="tabular-nums">{number((r.item??r.group).complete)}</span>},
 {id:'pending',header:'\u5f85\u786e\u8ba4',align:'center',cell:r=><span className={'tabular-nums'+((r.item??r.group).pending?' text-warning-text font-semibold':'')}>{number((r.item??r.group).pending)}</span>},
 {id:'rate',header:'\u5b8c\u6574\u7387',align:'center',cell:r=>{const item=r.item??r.group;return r.item&&!item.items?<span className="text-body-small text-muted-foreground">{m.configurationGaps.includes(r.item.id)?'\u5f85\u63a5\u5165':'\u6682\u65e0\u8bb0\u5f55'}</span>:<span className="tabular-nums">{rate(item.completeness)}</span>;}},
 {id:'actions',header:<span className="sr-only">{'\u64cd\u4f5c'}</span>,align:'center',cell:r=><ActionMenu label={(r.item?.name??r.group.name)+'\u7684\u64cd\u4f5c'} items={[{id:'details',label:'\u67e5\u770b\u8be6\u60c5',onSelect:()=>setDetailId(r.id)}]}/>}
 ]}/></div>
 <Drawer open={!!detail} onClose={()=>setDetailId(null)} side="right" width="sm" title={(detail?.item?.name??detail?.group.name??'\u670d\u52a1\u4f9d\u636e')+'\u8be6\u60c5'} closeLabel={'\u5173\u95ed\u670d\u52a1\u8be6\u60c5'}>
 {detail&&selected&&<div className="flex min-w-0 flex-col gap-xl">
 <section className="flex flex-col gap-md"><h3 className="text-heading-3 font-semibold">{'\u4f9d\u636e\u6982\u51b5'}</h3>
 <dl className="evidence-fields">{[
  ['\u4f9d\u636e\u6761\u6570',number(selected.items)+' \u6761'],['\u5b8c\u6574',number(selected.complete)+' \u6761'],
  ['\u5f85\u786e\u8ba4',number(selected.pending)+' \u6761'],['\u5b8c\u6574\u7387',rate(selected.completeness)]
 ].map(([label,value])=><div key={label}><dt className="text-body-small text-muted-foreground">{label}</dt><dd className={label==='\u5f85\u786e\u8ba4'&&selected.pending?'font-semibold tabular-nums text-warning-text':'font-semibold tabular-nums'}>{value}</dd></div>)}</dl>
 {selected.completeness!==null&&<Progress value={selected.completeness*100} aria-label={'\u670d\u52a1\u4f9d\u636e\u5b8c\u6574\u7387'}/>}
 <p className="text-body-small text-muted-foreground">{'\u5b8c\u6574\u7387 = \u5b8c\u6574\u5ba2\u6237\u4f9d\u636e\u6761\u6570 / \u5df2\u6355\u83b7\u5ba2\u6237\u4f9d\u636e\u6761\u6570\uff1b\u914d\u7f6e\u3001\u5b9e\u6d4b\u548c\u5206\u644a\u8ba1\u5165\u5b8c\u6574\uff0c\u4f30\u7b97\u4e0d\u8ba1\u5165\u3002\u5f85\u63a5\u5165\u9879\u76ee\u4e0d\u8fdb\u5165\u5206\u6bcd\u3002'}</p>
 </section>
 {detail.item&&!selected.items?<p className="text-body-small text-muted-foreground">{m.configurationGaps.includes(detail.item.id)?'\u6b64\u670d\u52a1\u4fdd\u7559\u4e3a\u7f3a\u63a5\u5165\u6848\u4f8b\uff0c\u5f53\u524d\u6ca1\u6709\u5173\u8054\u4f9d\u636e\u3002\u670d\u52a1\u91cf\u8bb0\u5f55\u4ecd\u4fdd\u7559\u3002':'\u5f53\u524d\u5feb\u7167\u53ca\u7b5b\u9009\u8303\u56f4\u6ca1\u6709\u4f9d\u636e\u8bb0\u5f55\uff0c\u4e0d\u80fd\u636e\u6b64\u5224\u65ad\u672a\u63d0\u4f9b\u670d\u52a1\u3002'}</p>:null}
 {definition&&<section className="flex flex-col gap-md"><h3 className="text-heading-3 font-semibold">{'\u8ba1\u91cf\u4e0e\u6765\u6e90'}</h3><dl className="flex flex-col gap-md">{[['\u8d44\u6e90',definition.resource],['\u8ba1\u91cf\u5355\u4f4d',definition.unit],['\u7edf\u8ba1\u5b9a\u4e49',definition.definition],['\u6240\u9700\u4f9d\u636e',definition.evidence],['\u6570\u636e\u622a\u81f3',configurationTime(m.snapshot.dataThrough)]].map(([label,value])=><div key={label}><dt className="text-body-small text-muted-foreground">{label}</dt><dd>{value}</dd></div>)}</dl></section>}
 <section className="flex min-w-0 flex-col gap-md"><h3 className="text-heading-3 font-semibold">{'\u4f9d\u636e\u65b9\u5f0f\u4e0e\u72b6\u6001'}</h3>
 <p className="text-body-small text-muted-foreground">{'\u4e0d\u540c\u670d\u52a1\u4f7f\u7528\u4e0d\u540c\u4f9d\u636e\uff1a\u4f4d\u7f6e\u3001\u9762\u79ef\u3001\u5bb9\u91cf\u91c7\u7528\u914d\u7f6e\u8bb0\u5f55\uff0c\u4f9b\u7535\u91cf\u91c7\u7528\u5b9e\u6d4b\u3002\u5206\u644a\u3001\u4f30\u7b97\u7b49\u53ea\u6709\u6765\u6e90\u652f\u6301\u65f6\u624d\u6709\u8bb0\u5f55\u3002'}</p>
 <DataTable rows={breakdown} rowKey={r=>r.id} columns={[
 {id:'label',header:'\u65b9\u5f0f / \u72b6\u6001',cell:r=>r.label},
 {id:'count',header:'\u6761\u6570',align:'right',cell:r=>detail.item&&r.value?<Button variant="ghost" onClick={()=>drill(detail.item!,r.patch)}>{number(r.value)}</Button>:<span className="tabular-nums">{number(r.value)}</span>}
 ]}/>
 </section>
 {detail.item?<div className="flex flex-wrap gap-sm"><Button disabled={!detail.item.items} onClick={()=>drill(detail.item!)}>{'\u67e5\u770b\u4f9d\u636e\u660e\u7ec6'}</Button><Button variant="outline" disabled={!detail.item.pending} onClick={()=>drill(detail.item!,{state:'pending'})}>{'\u67e5\u770b\u5f85\u786e\u8ba4'}</Button></div>:
 <section className="flex flex-col gap-md"><h3 className="text-heading-3 font-semibold">{'\u670d\u52a1\u9879\u76ee'}</h3>{detail.group.children.map(item=><Button key={item.id} variant="ghost" className="justify-between" onClick={()=>setDetailId('item:'+item.id)}><span className="truncate">{item.name}</span><span className="text-body-small tabular-nums">{item.items?number(item.items)+' \u6761':m.configurationGaps.includes(item.id)?'\u5f85\u63a5\u5165':'\u6682\u65e0\u8bb0\u5f55'}</span><Icon name="chevron-right" size="sm"/></Button>)}</section>}
 </div>}
 </Drawer>
 </section>;
}
