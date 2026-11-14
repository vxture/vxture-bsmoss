"use client";
import {DataTable,TableTitleCell} from '@vxture/design-system';
import SiteAnalysisWorkspace from '../site-analysis/workspace';
import {customerUseIcon} from '../portal/business-icons';
import OperatorIdentity from '../portal/operator-identity';
import {useOperatorNames} from '../portal/operator-identities';
import {n} from '../sites/labels';
import {usageNames,compactUsageValue} from '../operator-usage/labels';
import BusinessUsageDetail from '../operator-usage/detail';
import {CustomerScope} from "./sections";
import CustomerOverview from './overview';
import CustomerModeNav from './mode-nav';
import type {CustomerUseModel} from './model';
export default function Workspace({data}:{data:CustomerUseModel}) {
 const names=useOperatorNames(),metric=data.usage.sort,rich=(id:string)=>data.rows.find(row=>row.id===id)!;
 return <SiteAnalysisWorkspace data={data} presentation={{path:'/customer-use',icon:customerUseIcon,title:'\u5ba2\u6237\u4f7f\u7528',description:'\u8fd0\u8425\u5546\u5165\u9a7b\u3001\u7ad9\u5740\u5171\u4eab\u4e0e\u4e1a\u52a1\u7528\u91cf',tableId:'site-details',toolbarContent:href=><div className="flex min-w-0 flex-col gap-sm"><CustomerModeNav mode="legacy" href={href}/><CustomerScope data={data} href={href}/></div>,tableTitle:'\u7ad9\u5740\u4f7f\u7528\u660e\u7ec6',tableDescription:({all:'\u5168\u90e8\u7ad9\u5740',single:'1\u5bb6\u5165\u9a7b',double:'2\u5bb6\u5165\u9a7b',multi:'3\u5bb6\u53ca\u4ee5\u4e0a',shared:'\u5171\u4eab\u7ad9\u5740'}[data.tenancy]??'')+' \u00b7 \u5165\u9a7b\u4e0e\u8bbe\u5907\u4e3a\u5feb\u7167\uff0c\u7528\u91cf\u6309\u4e1a\u52a1\u5468\u671f\u7edf\u8ba1',detailLabel:'\u4f7f\u7528\u8be6\u60c5',resourceBeforeColumns:true,showTenantCount:true,
 metrics:[],

 query:{section:'legacy',usageSort:metric,compare:data.compare,tenancy:data.tenancy,...Object.fromEntries(['status','scene','siteType','site'].map(key=>[key,String(data.query[key as 'status'|'scene'|'siteType'|'site'])]))},globalResetQuery:{usageSort:'bytes',compare:'sites',asOf:data.date+'T23:00:00'},resetQuery:{tenancy:'all',site:'all',status:'all',scene:'all',siteType:'all'},
 columns:[{id:'usage',header:usageNames[metric],align:'center',cell:row=><span className="tabular-nums text-primary whitespace-nowrap">{compactUsageValue(rich(row.id).usage[metric],metric)}</span>}],
 cardMetrics:row=><div className="flex w-full min-w-0 flex-col gap-sm"><div className="flex flex-wrap items-center justify-between gap-sm"><div className="site-analysis-card-operators">{row.allOperators.map(code=><OperatorIdentity key={code} code={code}/>)}<span className="text-body-small text-muted-foreground">{row.allOperators.length+' \u5bb6'}</span></div><span className="text-body-small text-muted-foreground">{n(row.resources)+' \u8bbe\u5907'}</span></div><span className="text-primary tabular-nums">{usageNames[metric]+' '+compactUsageValue(rich(row.id).usage[metric],metric)}</span></div>,
 detailContent:row=><div className="flex min-w-0 flex-col gap-lg"><div className="flex flex-wrap items-center gap-sm">{row.allOperators.map(code=><OperatorIdentity key={code} code={code}/>)}<span className="text-body-small text-muted-foreground">{row.allOperators.length+' \u5bb6 | '+n(row.resources)+' \u8bbe\u5907'}</span></div><BusinessUsageDetail row={rich(row.id)} total={data.usage.total} period={data.usage.period} metric={metric}/><div><p className="mb-sm text-body-small text-muted-foreground">{'\u5173\u8054\u8bbe\u5907 \u00b7 '+data.resourceAt.replace('T',' ')}</p><DataTable rows={row.devices} rowKey={device=>device.id} columns={[{id:'name',header:'\u8bbe\u5907',cell:d=><TableTitleCell title={d.name} description={d.id}/>},{id:'category',header:'\u7c7b\u522b',cell:d=>d.category},{id:'owner',header:'\u5f52\u5c5e',cell:d=>names[d.owner]?<OperatorIdentity code={d.owner}/>:d.owner}]}/></div></div>,
 replaceNotes:true,hideSnapshotNote:true,notes:<><p>{'\u5165\u9a7b\u3001\u5171\u4eab\u4e0e\u8bbe\u5907\u4e3a\u56fa\u5b9a\u8d44\u6e90\u5feb\u7167\uff0c\u5c1a\u65e0\u5386\u53f2\u5165\u9000\u9a7b\u8bb0\u5f55\u3002\u4e1a\u52a1\u7528\u91cf\u6309\u6240\u9009\u5468\u671f\u7edf\u8ba1\u3002'}</p><p>{'\u8fd0\u8425\u5546\u7b5b\u9009\u540c\u65f6\u7ea6\u675f\u7ad9\u5740\u3001\u5173\u8054\u8bbe\u5907\u4e0e\u4e1a\u52a1\u7528\u91cf\uff1b\u5171\u4eab\u4ecd\u6309\u7ad9\u5740\u5168\u90e8\u5165\u9a7b\u8fd0\u8425\u5546\u8ba1\u7b97\u3002\u8fd0\u8425\u5546\u7ad9\u5740\u6570\u53ca\u5171\u7528\u8bbe\u5907\u6570\u4e0d\u53ef\u76f4\u63a5\u76f8\u52a0\u3002'}</p><p>{'\u5165\u9a7b\u7ed3\u6784\u3001\u5bb6\u6570\u4e0e\u641c\u7d22\u4ec5\u7b5b\u9009\u7ad9\u5740\u660e\u7ec6\u3002\u4e1a\u52a1\u6307\u6807\u540c\u6b65\u5207\u6362\u8fd0\u8425\u5546\u3001\u533a\u57df\u7528\u91cf\u3001\u8d8b\u52bf\u4e0e\u660e\u7ec6\u3002'}</p></>}} overview={href=><CustomerOverview data={data} href={href}/>}/>;
}
