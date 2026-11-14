"use client";
import {Button,DataTable,PanelCard} from "@vxture/design-system";
import {useInvestigationLinks} from '../portal/investigation';
import type {HistoryModel} from "./history-model";
import {historyHref,historyContextHref} from "./history-links";
import {n,pct} from "../sites/labels";
import {quantity} from "../usage-review/labels";
export default function HistoryContextPanel({data,details=false,focus='all'}:{data:HistoryModel;details?:boolean;focus?:'all'|'capacity'|'efficiency'}){
 const s=data.cross.summary,q=data.scope;const {keep}=useInvestigationLinks(historyHref(q));
 const items=[['\u5bb9\u91cf\u6837\u672c\u8d1f\u8f7d',pct(s.load)],['\u4e1a\u52a1\u63a5\u901a\u7387',pct(s.connectionRate)],['\u7269\u7406\u603b\u8868\u7535\u8017 / kWh',s.physical.energyWh===null?(q.query.operator==='all'?'\u2014':'\u672a\u5206\u644a'):n(s.physical.energyWh/1000,2)],['\u5355\u4f4d\u6d41\u91cf\u7535\u8017 / kWh/GiB',s.energyPerGiB===null?'\u2014':n(s.energyPerGiB,4)]];
 const visibleItems=focus==='capacity'?items.slice(0,2):focus==='efficiency'?items.slice(2):items;
 return <div data-history-context><PanelCard title={focus==='capacity'?"\u5bb9\u91cf\u4e0e\u8d28\u91cf\u5468\u671f\u89c2\u5bdf":focus==='efficiency'?"\u8fd0\u884c\u4e0e\u80fd\u6548\u5468\u671f\u89c2\u5bdf":"\u8de8\u57df\u7ecf\u8425\u89c2\u5bdf"} icon="chart-line-up" className="min-w-0" description={"\u540c\u4e00\u8d44\u6e90\u8303\u56f4\u4e0e\u5206\u6790\u5468\u671f \u00b7 \u8054\u5408\u89c2\u5bdf\u4e0d\u4ee3\u8868\u56e0\u679c\u5224\u65ad"}>
  <div className="site-analysis-table-tools site-analysis-action-row">{focus!=='capacity'&&<Button size="xl" asChild variant="outline"><a href={keep(historyContextHref(q,'capacity'))}>{"\u5bb9\u91cf\u4e0e\u8d28\u91cf"}</a></Button>}{focus!=='efficiency'&&<Button size="xl" asChild variant="outline"><a href={keep(historyContextHref(q,'efficiency'))}>{"\u8fd0\u884c\u4e0e\u80fd\u6548"}</a></Button>}</div>
  <dl className={focus==='all'?"grid min-w-0 gap-lg sm:grid-cols-2 lg:grid-cols-4":"grid min-w-0 gap-lg sm:grid-cols-2"}>{visibleItems.map(([label,value])=><div key={label} className="min-w-0"><dt className="text-body-small text-muted-foreground">{label}</dt><dd className="pt-sm text-heading-small font-semibold tabular-nums">{value}</dd></div>)}</dl>
  <p className="pt-lg text-body-small text-muted-foreground">{"\u8d1f\u8f7d\u6309\u7b49\u957f\u5c0f\u65f6\u7684\u5bb9\u91cf\u6837\u672c\u52a0\u6743\uff1b\u63a5\u901a\u7387\u6309\u63a5\u901a/\u5c1d\u8bd5\u6c47\u603b\u3002\u7269\u7406\u8868\u6bcf\u7ad9\u6bcf\u5c0f\u65f6\u4ec5\u8ba1\u4e00\u6b21\uff1b\u5355\u8fd0\u8425\u5546\u672a\u5206\u644a\u7535\u8017\uff0c\u6e29\u5ea6\u4e0e\u4f9b\u7535\u4ec5\u63cf\u8ff0\u76f8\u5173\u7269\u7406\u7ad9\u5740\u3002"}</p>
  {details&&<><dl className="grid gap-lg border-t border-dashed border-border pt-lg mt-lg sm:grid-cols-3">{[['\u6e29\u5ea6\u6837\u672c\u5747\u503c / \u2103',s.temperatureMean===null?'\u2014':n(s.temperatureMean,1)],['\u6e29\u5ea6\u6837\u672c\u8303\u56f4 / \u2103',s.physical.physicalSamples?n(s.physical.temperatureMinTenths!/10,1)+' \u2014 '+n(s.physical.temperatureMaxTenths!/10,1):'\u2014'],['\u5907\u7528\u4f9b\u7535\u7ad9\u65f6\u6837\u672c',n(s.physical.batterySamples)]].map(([label,value])=><div key={label}><dt className="text-body-small text-muted-foreground">{label}</dt><dd className="pt-sm text-body">{value}</dd></div>)}</dl>
  <p className="py-md text-body-small text-muted-foreground">{"\u4e0b\u8868\u6309\u5f53\u524d\u4e1a\u52a1\u6307\u6807\u603b\u91cf\u6392\u5e8f\uff0c\u6700\u591a\u663e\u793a\u524d20\u5ea7\uff1b\u5b8c\u6574\u8d44\u6e90\u660e\u7ec6\u89c1\u5386\u53f2\u62a5\u544a\u3002\u6e29\u5ea6\u4e3a\u7b49\u65f6\u6837\u672c\u7edf\u8ba1\uff0c\u5907\u7528\u4f9b\u7535\u6837\u672c\u4e0d\u4ee3\u8868\u5b9e\u9645\u4e8b\u4ef6\u6301\u7eed\u65f6\u957f\u3002"}</p>
  <DataTable rows={[...data.cross.members].sort((a,b)=>Number(b.values[q.metric])-Number(a.values[q.metric]))} rowKey={r=>r.id} columns={[
   {id:'site',header:'\u7ad9\u5740',cell:r=><Button size="xl" asChild variant="link"><a href={historyHref(q,{site:r.id})}>{r.name}</a></Button>},
   {id:'value',header:'\u5468\u671f\u4e1a\u52a1\u91cf',cell:r=>quantity(String(r.values[q.metric]),q.metric)},
   {id:'load',header:'\u5bb9\u91cf\u6837\u672c\u8d1f\u8f7d',cell:r=>pct(r.load)},
   {id:'connection',header:'\u63a5\u901a\u7387',cell:r=>pct(r.connectionRate)},
   {id:'energy',header:'\u603b\u8868\u7535\u8017 / kWh',cell:r=>r.physical.energyWh===null?(q.query.operator==='all'?'\u2014':'\u672a\u5206\u644a'):n(r.physical.energyWh/1000,2)},
   {id:'intensity',header:'\u5355\u4f4d\u6d41\u91cf\u7535\u8017',cell:r=>r.energyPerGiB===null?'\u2014':n(r.energyPerGiB,4)},
  ]}/></>}
 </PanelCard></div>;
}
