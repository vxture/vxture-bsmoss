'use client';
import Link from 'next/link';
import {useEffect,useState,type CSSProperties,type ReactNode} from 'react';
import {Button,DataTable,Drawer,EmptyState,Icon,Pagination,PanelCard,SegmentedControl} from '@vxture/design-system';
import ActionMenu from '../../portal/action-menu';
import {OperatorLogo,OperatorName} from '../../portal/operator-identity';
import {configurationRowClick} from '../../settings/configuration-layout';
import {label} from './labels';
import {formatServiceQuantity as format} from '../../domains/tower-service/quantification';
import {snapshotQuery} from '../../domains/tower-service/query';
import type {ContributionAnalysis} from '../../domains/tower-service/contribution';
import type {JudgmentModel} from './model';

type Row=ContributionAnalysis['operators'][number];
const signed=(value:string|null,scale=0)=>value===null?'\u2014':(BigInt(value)>0n?'+':'')+format(value,scale);
export default function ContributionBoard({model:m,controls,onChange}:{model:JudgmentModel;controls:ReactNode;onChange:(patch:Record<string,string|number>)=>void}){
 const analysis=m.contribution!,metric=analysis.metric,dimension=m.filters.dimension;
 const [detail,setDetail]=useState<ContributionAnalysis['sites'][number]|null>(null),[page,setPage]=useState(1);
 useEffect(()=>{setDetail(null);setPage(1);},[dimension]);
 const quantities=(value:string|null)=>value===null?'\u2014':format(value,metric?.scale);
 // Format the exact ratio at a useful scale; never turn nonzero movement into
 // a displayed zero because its contribution is below the rounding threshold.
 const pp=(row:Row,precision=2)=>{const base=analysis.total.previous;if(row.delta===null||base===null||BigInt(base)===0n)return '\u2014';const n=BigInt(row.delta),abs=n<0n?-n:n,scaled=abs*100n*10n**BigInt(precision)/BigInt(base),sign=n>0n?'+':n<0n?'-':'';return sign+(scaled===0n&&n!==0n?'<'+format('1',precision):format(String(scaled),precision))+' pp';};
 const allRows:Row[]=analysis[dimension as 'operators'|'regions'|'sites'],movement=analysis.movements[dimension as 'operators'|'regions'|'sites'];
 const rows=dimension==='sites'?allRows.slice((page-1)*20,page*20):allRows;
 const maximum=allRows.reduce((max,row)=>{const value=row.delta===null?0n:BigInt(row.delta),abs=value<0n?-value:value;return abs>max?abs:max;},1n);
 const period=(date:string|undefined)=>date?.slice(0,16).replace('T',' ')??'\u2014';
 const drill=(row:Row)=>{
  if(dimension==='sites'){setDetail(analysis.sites.find(s=>s.id===row.id)??null);return;}
  if(dimension==='operators'){onChange({dimension:'sites',operator:row.id});return;}
  onChange({dimension:'sites',...(m.context.city==='all'?{city:row.id,county:'all'}:{county:row.id})});
 };
 const actions=(row:Row)=><ActionMenu label={(dimension==='operators'?label(row.id):row.name)+'\u7684\u64cd\u4f5c'} items={[{id:'details',label:dimension==='sites'?'\u67e5\u770b\u8be6\u60c5':'\u67e5\u770b\u7ad9\u5740\u8d21\u732e',onSelect:()=>drill(row)}]}/>;
 const reasons:Record<string,string>={source:'\u670d\u52a1\u6765\u6e90\u5f85\u63a5\u5165',baseline:'\u6682\u65e0\u53ef\u7528\u57fa\u671f',metric:'\u4e24\u671f\u6307\u6807\u5c1a\u4e0d\u4e00\u81f4',basis:'\u4e24\u671f\u53e3\u5f84\u6216\u671f\u95f4\u4e0d\u53ef\u6bd4\u8f83',quantity:'\u6765\u6e90\u5c1a\u4e0d\u5b8c\u6574\uff0c\u6682\u4e0d\u80fd\u5206\u89e3'};
 const empty=analysis.reason?<EmptyState icon="chart-bar" title={reasons[analysis.reason]} description={'\u4fdd\u7559\u5b9e\u9645\u6765\u6e90\uff0c\u4e0d\u5c06\u7f3a\u5931\u6570\u636e\u8865\u4e3a\u96f6\u3002\u8bf7\u9009\u62e9\u5b8c\u6574\u671f\u95f4\u53ca\u4e00\u81f4\u7684\u670d\u52a1\u6307\u6807\u3002'}/>:!allRows.length?<EmptyState icon="chart-bar" title={'\u5f53\u524d\u8303\u56f4\u6682\u65e0\u670d\u52a1\u5bf9\u8c61'} description={'\u53ef\u8c03\u6574\u8fd0\u8425\u5546\u6216\u9876\u90e8\u533a\u57df\u8303\u56f4\u3002'}/>:null;
 const body=<div className="contribution-board">
  <div className="contribution-periods text-body-small text-muted-foreground"><span>{'\u57fa\u671f\uff1a'+period(analysis.baseline?.businessPeriod?.start)}</span><Icon name="arrow-right" size="sm"/><span>{'\u672c\u671f\uff1a'+period(m.snapshot.businessPeriod?.start)}</span><span className="ml-auto">{metric?.kind==='stock'?'\u671f\u672b\u914d\u7f6e':'\u671f\u95f4\u7528\u91cf'}{' \u00b7 '+(metric?.unit??'\u2014')}</span></div>
  <div className="contribution-reconciliation">
   <div><span className="text-body-small text-muted-foreground">{'\u6b63\u5411\u589e\u91cf'}</span><strong className="tabular-nums">{signed(movement.positive,metric?.scale)}</strong></div><span className="text-muted-foreground">+</span>
   <div><span className="text-body-small text-muted-foreground">{'\u8d1f\u5411\u51cf\u91cf'}</span><strong className="tabular-nums">{signed(movement.negative,metric?.scale)}</strong></div><span className="text-muted-foreground">=</span>
   <div><span className="text-body-small text-muted-foreground">{analysis.revision?'\u51c0\u4fee\u8ba2\u5dee\u503c':'\u51c0\u53d8\u5316'}</span><strong className="tabular-nums">{signed(analysis.total.delta,metric?.scale)}</strong></div>
  </div>
  <div className="contribution-axis text-body-small text-muted-foreground"><span>{'\u6309\u53d8\u5316\u7edd\u5bf9\u91cf\u6392\u5e8f'}</span><span>{'\u2190 \u51cf\u5c11\u3000\u2502\u3000\u589e\u52a0 \u2192'}</span><span>{'\u5bf9\u603b\u53d8\u5316\u7684\u8d21\u732e'}</span></div>
  <ul className="contribution-rows" aria-label={'\u53d8\u5316\u8d21\u732e\u5206\u89e3'}>
   {rows.map(row=>{const delta=row.delta===null?0n:BigInt(row.delta),width=Number((delta<0n?-delta:delta)*10000n/maximum)/100;
    return <li key={row.id} className="contribution-row" onClick={event=>{if(!(event.target as HTMLElement).closest('button,a,[role=menuitem]'))drill(row);}}>
     <Button variant="ghost" className="contribution-identity" onClick={()=>drill(row)}>{dimension==='operators'?<><OperatorLogo code={row.id} size="large"/><OperatorName code={row.id}/></>:<><Icon name={dimension==='regions'?'building':'map-pin'} size="lg"/><span className="truncate">{row.name}</span></>}</Button>
     <div className="contribution-measure">
      <div className="contribution-values text-body-small"><span>{'\u57fa\u671f '}<strong className="tabular-nums font-normal">{quantities(row.previous)}</strong></span><Icon name="arrow-right" size="sm"/><span>{'\u672c\u671f '}<strong className="tabular-nums">{quantities(row.current)}</strong></span></div>
      <div className="contribution-track" role="img" aria-label={row.name+' '+signed(row.delta,metric?.scale)+' '+(metric?.unit??'')} style={{'--contribution-width':width+'%'} as CSSProperties}>
       <span className="contribution-half contribution-decrease">{delta<0n&&<i/>}</span><span className="contribution-zero"/><span className="contribution-half contribution-increase">{delta>0n&&<i/>}</span>
      </div>
     </div>
     <div className="contribution-change"><strong className="tabular-nums text-heading-3">{signed(row.delta,metric?.scale)}</strong><span className="text-body-small text-muted-foreground tabular-nums">{pp(row)}</span></div>
     {actions(row)}
    </li>;
   })}
  </ul>
 </div>;
 return <section className="contribution-section" aria-label={'\u53d8\u5316\u8d21\u732e\u5206\u6790'}>
  <div className="judgment-tools site-analysis-action-row"><SegmentedControl className="h-control-xl" size="md" ariaLabel={'\u8d21\u732e\u5206\u6790\u7ef4\u5ea6'} value={dimension} onChange={dimension=>onChange({dimension})} items={[{value:'operators',label:'\u8fd0\u8425\u5546'},{value:'regions',label:'\u533a\u57df'},{value:'sites',label:'\u7ad9\u5740'}]}/><div className="judgment-tool-actions">{controls}</div></div>
  {dimension==='sites'?<div className="contribution-sites">
   <div className="contribution-list-summary text-body-small text-muted-foreground"><span>{metric?.name+' \u00b7 '+(analysis.revision?'\u4fee\u8ba2\u5dee\u5f02':'\u7ad9\u5740\u53d8\u5316\u660e\u7ec6')}</span><span>{'\u672c\u671f '+quantities(analysis.total.current)+' / \u57fa\u671f '+quantities(analysis.total.previous)+' '+(metric?.unit??'')}</span></div>
   {empty??<div className="judgment-table" onClick={configurationRowClick(rows,drill)}><DataTable rows={rows} rowKey={r=>r.id} columns={[
    {id:'index',header:'#',align:'center',cell:r=>(page-1)*20+rows.indexOf(r)+1},
    {id:'site',header:'\u7ad9\u5740',cell:r=><Button variant="ghost" className="contribution-site-title" onClick={()=>drill(r)}><Icon name="map-pin" size="md"/><span className="truncate">{r.name}</span></Button>},
    {id:'pair',header:'\u57fa\u671f \u2192 \u672c\u671f',align:'center',cell:r=><span className="whitespace-nowrap tabular-nums">{quantities(r.previous)+' \u2192 '+quantities(r.current)}</span>},
    {id:'delta',header:'\u589e\u51cf\u91cf',align:'center',cell:r=><strong className="tabular-nums whitespace-nowrap">{signed(r.delta,metric?.scale)}</strong>},
    {id:'contribution',header:'\u8d21\u732e',align:'center',cell:r=><span className="tabular-nums whitespace-nowrap">{pp(r,4)}</span>},
    {id:'action',header:<span className="sr-only">{'\u64cd\u4f5c'}</span>,align:'center',cell:actions}
   ]}/></div>}
   {allRows.length>0&&<Pagination className="product-pagination site-analysis-pagination site-analysis-action-row" page={page} pageCount={Math.max(1,Math.ceil(allRows.length/20))} total={allRows.length} countLabel={'\u5171\u8ba1\uff1a'+allRows.length+' \u7ad9'} onPageChange={setPage} firstLabel={'\u9996\u9875'} previousLabel={'\u4e0a\u4e00\u9875'} nextLabel={'\u4e0b\u4e00\u9875'} lastLabel={'\u672b\u9875'}/>}
  </div>:<PanelCard className="contribution-panel" title={metric?.name??'\u670d\u52a1\u53d8\u5316'} icon="chart-bar" description={analysis.revision?'\u540c\u4e00\u671f\u7684\u4fee\u8ba2\u5dee\u5f02':metric?.kind==='stock'?'\u914d\u7f6e\u53d8\u5316\u7684\u6765\u6e90\u5206\u89e3':'\u7528\u91cf\u53d8\u5316\u7684\u6765\u6e90\u5206\u89e3'}>{empty??body}</PanelCard>}
  <Drawer open={!!detail} onClose={()=>setDetail(null)} side="right" width="sm" title={detail?.name??'\u7ad9\u5740\u8d21\u732e'} description={detail?.region} closeLabel={'\u5173\u95ed\u7ad9\u5740\u8d21\u732e'}>
   {detail&&<div className="flex flex-col gap-lg"><dl className="judgment-fields">{[
    ['\u7ad9\u5740\u7f16\u7801',detail.id],['\u5206\u6790\u6307\u6807',metric?.name??'\u2014'],['\u57fa\u671f',quantities(detail.previous)],['\u672c\u671f',quantities(detail.current)],['\u589e\u51cf\u91cf',signed(detail.delta,metric?.scale)+' '+(metric?.unit??'')],['\u5bf9\u603b\u53d8\u5316\u7684\u8d21\u732e',pp(detail,4)],['\u8fd0\u8425\u5546\u8303\u56f4',m.context.operator==='all'?'\u5168\u90e8\u8fd0\u8425\u5546':label(m.context.operator)],['\u672c\u671f\u5feb\u7167',m.context.snapshotId],['\u57fa\u671f\u5feb\u7167',m.context.compareSnapshotId??'\u2014']
   ].map(([title,value])=><div key={title}><dt className="text-body-small text-muted-foreground">{title}</dt><dd>{value}</dd></div>)}</dl>
   <div className="flex flex-wrap gap-sm"><Button asChild variant="outline"><Link href={'/tower-service/resources/'+encodeURIComponent(detail.id)+'?'+new URLSearchParams(snapshotQuery({...m.context,snapshotId:detail.snapshotId,compareSnapshotId:null}))}>{'\u67e5\u770b\u7ad9\u5740'}</Link></Button><Button asChild variant="outline"><Link href={'/tower-service/evidence?'+new URLSearchParams({...snapshotQuery(m.context),view:'details',search:detail.id})}>{'\u67e5\u770b\u8ba1\u91cf\u4f9d\u636e'}</Link></Button></div>
   </div>}
  </Drawer>
 </section>;
}
