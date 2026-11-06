"use client";
import SaveLocalReport from "../../reports/save-local";
import {useState} from "react";
import {Button,DataTable,Pagination,PanelCard,ShellPageContainer} from "@vxture/design-system";
import PageHeading from "../../portal/page-heading";
import {InvestigationReturn,useInvestigationLinks} from '../../portal/investigation';
import MetricRowsCard from "../../portal/metric-rows-card";
import UsageTrend from "../../portal/usage-trend";
import HistoryContextPanel from "../history-context-panel";
import type {HistoryReport} from "../history-report-service";
import {historyHref,historyEvidenceHref} from "../history-links";
import {n,pct,operatorNames,sceneNames,siteTypeNames} from "../../sites/labels";
import {signedPercent,sharingNames} from "../history-labels";
import {quantity} from "../../usage-review/labels";
import {historyChange} from "../../domains/map-demo/history-rules";
import {DAY_MS,dateNumber,isoDay} from "../../domains/map-demo/history-calendar";
import "../history.css";
const groupNames:Record<string,string>={...sceneNames,...siteTypeNames,...sharingNames};
export default function HistoryReportView({report:r}:{report:HistoryReport}){
 const d=r.payload.data,q=d.scope,[page,setPage]=useState(1),members=[...d.cross.members].sort((a,b)=>Number(b.values[q.metric])-Number(a.values[q.metric])||a.id.localeCompare(b.id)),selected=members.slice((page-1)*20,page*20);
 const {carry,keep}=useInvestigationLinks(historyHref(q));
 const last=isoDay(dateNumber(q.window.end)-DAY_MS),change=(key:'bytes'|'voiceSeconds'|'sms')=>historyChange(d.totals,d.previous,key,q.window.days,d.previousWindow?.days??q.window.days).rate;
 const changes=['bytes','voiceSeconds','sms'].map(k=>({key:k,label:k==='bytes'?'\u6d41\u91cf\u540c\u6bd4':k==='voiceSeconds'?'\u901a\u8bdd\u540c\u6bd4':'\u77ed\u4fe1\u540c\u6bd4',value:signedPercent(change(k as 'bytes'|'voiceSeconds'|'sms'))}));
 return <div data-history-report data-report-snapshot={r.digest}><ShellPageContainer className="product-page-inset max-w-none gap-lg">
  <InvestigationReturn source="history"/><PageHeading title={"\u5386\u53f2\u7ecf\u8425\u62a5\u544a"} description={(d.siteName??'\u533a\u57df\u7ecf\u8425\u5206\u6790')+' \u00b7 '+q.window.start+' \u2014 '+last}
   navigation={<Button asChild variant="link"><a href={keep(r.returnHref)}>{"\u8fd4\u56de\u7ecf\u8425\u5206\u6790"}</a></Button>}
   context={<span>{'\u6570\u636e\u622a\u81f3 '+isoDay(dateNumber(d.coverage.end)-DAY_MS)}</span>}
   actions={<><SaveLocalReport endpoint={r.downloadHref.replace("/history-report?","/report-artifact?kind=history&")} origin={r.pageHref}/><Button asChild variant="outline"><a href={r.downloadHref+'&format=json'} download>{"\u5bfc\u51fa\u6570\u636e"}</a></Button><Button asChild><a href={r.downloadHref+'&format=html'} download>{"\u4e0b\u8f7d\u62a5\u544a"}</a></Button></>}
   toolbar={<p className="py-md text-body-small text-muted-foreground">{operatorNames[q.query.operator]+' \u00b7 '+q.window.days+'\u5929 \u00b7 \u8986\u76d6\u5b8c\u6574\u8d44\u6e90\u7b5b\u9009\uff1b\u5206\u5c42\u9009\u4e2d\u548c\u5f53\u524d\u9875\u7801\u4ec5\u4fdd\u7559\u4e3a\u8fd4\u56de\u6761\u4ef6\u3002'}</p>}/>
  <div className="grid min-w-0 gap-md md:grid-cols-3">
   <MetricRowsCard title={"\u7ecf\u8425\u670d\u52a1\u4ea7\u51fa"} icon="chart-bar" metrics={[{label:'\u53cc\u5411\u6d41\u91cf / TiB',value:n(Number(d.totals.bytes)/1099511627776,2)}, {label:'\u63a5\u901a\u901a\u8bdd / \u4e07\u5206\u949f',value:n(d.totals.voiceSeconds/600000,2)}, {label:'\u77ed\u4fe1 / \u4e07\u6761',value:n(d.totals.sms/10000,2)}].map((item,index)=>({...item,key:String(index)}))}/>
   <MetricRowsCard title={"\u8f83\u4e0a\u5e74\u540c\u671f"} icon="chart-line-up" metrics={changes}/>
   <MetricRowsCard title={"\u8d44\u6e90\u4e0e\u8986\u76d6"} icon="building" metrics={[{label:'\u7269\u7406\u7ad9\u5740 / \u5ea7',value:n(d.physicalSites)}, {label:'\u8fd0\u8425\u5546\u670d\u52a1\u5173\u7cfb / \u6761',value:n(d.serviceRelations)}, {label:'\u6709\u6548\u7ad9\u65e5 / \u7ad9\u00b7\u5929',value:n(d.expectedSiteDays)}].map((item,index)=>({...item,key:String(index)}))}/>
  </div>
  <PanelCard title={"\u4e1a\u52a1\u8d8b\u52bf"} icon="chart-line-up" className="min-w-0"><div className="history-trend flex min-w-0 flex-col"><UsageTrend data={d.series.map(s=>({key:s.key,label:s.key,value:Number(s[q.metric])/(q.metric==='bytes'?1073741824:q.metric==='voiceSeconds'?60:1)}))} name={q.metric==='bytes'?'\u6d41\u91cf':q.metric==='voiceSeconds'?'\u901a\u8bdd':'\u77ed\u4fe1'} unit={q.metric==='bytes'?'GiB':q.metric==='voiceSeconds'?'\u5206\u949f':'\u6761'} labelSuffix="" labelEvery={q.window.grain==='month'?2:5} ariaLabel={"\u62a5\u544a\u4e1a\u52a1\u8d8b\u52bf"} formatValue={v=>n(v,2)}/></div></PanelCard>
  <HistoryContextPanel data={d}/>
  {d.kind!=="operator"&&<PanelCard title={"\u533a\u57df\u7ed3\u6784"} icon="city" className="min-w-0"><DataTable rows={d.children} rowKey={s=>s.id} columns={[
   {id:'name',header:'\u5bf9\u8c61',cell:s=>operatorNames[s.name]??s.name},{id:'sites',header:'\u7ad9\u5740',cell:s=>n(s.sites)},
   {id:'value',header:'\u5f53\u524d\u4e1a\u52a1\u91cf',cell:s=>quantity(String(s[q.metric]),q.metric)},
   {id:'previous',header:'\u4e0a\u5e74\u540c\u671f',cell:s=>s.previous?quantity(String(s.previous[q.metric]),q.metric):'\u2014'},
  ]}/></PanelCard>}
  <PanelCard title={"\u7ad9\u7fa4\u7ed3\u6784"} icon="building" className="min-w-0"><DataTable rows={d.cohorts.groups} rowKey={s=>s.id} columns={[
   {id:'name',header:'\u5206\u7ec4',cell:s=>groupNames[s.id]??s.id},{id:'sites',header:'\u7ad9\u5740',cell:s=>n(s.sites)},
   {id:'value',header:'\u5f53\u524d\u4e1a\u52a1\u91cf',cell:s=>quantity(String(s.totals[q.metric]),q.metric)},
   {id:'change',header:'\u65e5\u5747\u540c\u6bd4',cell:s=>pct(s.change.dailyRate)},
  ]}/></PanelCard>
  <PanelCard title={"\u8fd0\u8425\u5546\u670d\u52a1\u7ed3\u6784"} icon="users" className="min-w-0"><DataTable rows={d.operators} rowKey={s=>s.code} columns={[
   {id:'op',header:'\u8fd0\u8425\u5546',cell:s=>operatorNames[s.code]},{id:'sites',header:'\u670d\u52a1\u7ad9\u5740',cell:s=>n(s.sites)},
   {id:'bytes',header:'\u6d41\u91cf / GiB',cell:s=>n(Number(s.bytes)/1073741824,2)},{id:'voice',header:'\u901a\u8bdd / \u5206\u949f',cell:s=>n(s.voiceSeconds/60,2)},{id:'sms',header:'\u77ed\u4fe1 / \u6761',cell:s=>n(s.sms)},
  ]}/></PanelCard>
  <PanelCard title={"\u8d44\u6e90\u660e\u7ec6"} icon="building" className="min-w-0" description={"\u9875\u9762\u5206\u9875\u5c55\u793a\uff0c\u4e0b\u8f7d\u6587\u4ef6\u5305\u542b\u5168\u90e8\u5339\u914d\u7ad9\u5740"}>
   <DataTable rows={selected} rowKey={s=>s.id} columns={[
    {id:'site',header:'\u7ad9\u5740',cell:s=><Button asChild variant="link"><a href={carry(historyHref(q,{site:s.id}))}>{s.name}</a></Button>},
    {id:'bytes',header:'\u6d41\u91cf / GiB',cell:s=>n(Number(s.values.bytes)/1073741824,2)},{id:'voice',header:'\u901a\u8bdd / \u5206\u949f',cell:s=>n(s.values.voiceSeconds/60,2)},{id:'sms',header:'\u77ed\u4fe1 / \u6761',cell:s=>n(s.values.sms)},
    {id:'load',header:'\u5bb9\u91cf\u6837\u672c\u8d1f\u8f7d',cell:s=>pct(s.load)},{id:'connection',header:'\u63a5\u901a\u7387',cell:s=>pct(s.connectionRate)},
   ]}/>{members.length>20&&<div className="pt-lg"><Pagination page={page} pageCount={Math.max(1,Math.ceil(members.length/20))} onPageChange={setPage} firstLabel={"\u9996\u9875"} previousLabel={"\u4e0a\u4e00\u9875"} nextLabel={"\u4e0b\u4e00\u9875"} lastLabel={"\u672b\u9875"} total={members.length} countLabel={"\u5171 "+n(members.length)+" \u5ea7\u7ad9\u5740"}/></div>}
  </PanelCard>
  {d.station?.evidence&&<PanelCard title={"\u5355\u7ad9\u8bc1\u636e\u5f15\u7528"} icon="shield-check"><p className="pb-md text-body-small text-muted-foreground">{d.station.evidence.date+' \u00b7 '+d.station.evidence.referenceId+' \u00b7 \u56db\u5468\u540c\u671f\u539f\u503c\u968fJSON\u5b8c\u6574\u4fdd\u7559\uff0c\u539f\u56e0\u5c1a\u672a\u786e\u8ba4\u3002'}</p><Button asChild variant="outline"><a href={carry(historyEvidenceHref(q,{evidence:d.station.evidence.date,slot:String(d.station.evidence.slot)}))}>{"\u67e5\u770b\u6838\u9a8c\u4f9d\u636e"}</a></Button></PanelCard>}
  <PanelCard title={"\u62a5\u544a\u4f9d\u636e\u4e0e\u7248\u672c"} icon="database"><dl className="flex flex-col gap-sm break-all text-body-small text-muted-foreground">{[['\u62a5\u544a\u6807\u8bc6',r.id],['\u5185\u5bb9\u6458\u8981',r.digest],['\u8ba1\u91cf\u6765\u6e90',r.payload.sourceVersion],['\u6a21\u677f',r.payload.templateVersion],['\u5206\u6790\u6a21\u578b',d.version]].map(([label,value])=><div key={label}><dt>{label}</dt><dd className="font-mono">{value}</dd></div>)}</dl><p className="pt-md text-body-small text-muted-foreground">{"\u56fa\u5b9a\u8d44\u6e90\u5386\u53f2\u5feb\u7167\uff0c\u5c1a\u672a\u6b63\u5f0f\u53d1\u5e03\u3002\u6837\u672c\u5b8c\u6574\u4e0d\u4ee3\u8868\u771f\u5b9e\u6765\u6e90\u5df2\u63a5\u5165\u6216\u5b8c\u6210\u4eba\u5de5\u6838\u9a8c\uff1b\u8de8\u57df\u89c2\u5bdf\u4e0d\u4f5c\u56e0\u679c\u8bca\u65ad\uff0c\u65e0\u8d39\u7528\u8ba1\u7b97\u3002"}</p></PanelCard>
 </ShellPageContainer></div>;
}
