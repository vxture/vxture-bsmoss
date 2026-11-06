"use client";
import {useState,useTransition} from "react";
import {useRouter} from "next/navigation";
import {Button,Collapsible,CollapsibleContent,CollapsibleTrigger,DataTable,EmptyState,Icon,Input,NativeSelect,Pagination,PanelCard,Progress,SegmentedControl,ShellPageContainer} from "@vxture/design-system";
import PageHeading from "../portal/page-heading";
import {InvestigationReturn,useInvestigationLinks} from '../portal/investigation';
import {relatedDossierHref,relatedReviewHref} from '../portal/investigation-targets';
import MetricRowsCard from "../portal/metric-rows-card";
import UsageTrend from "../portal/usage-trend";
import {n,pct,operatorNames,sceneNames,siteTypeNames} from "../sites/labels";
import {DAY_MS,dateNumber,isoDay} from "../domains/map-demo/history-calendar";
import {historyChange,type HistoryMetric} from "../domains/map-demo/history-rules";
import type {HistoryModel} from "./history-model";
import {historyHref,historyReportHref} from "./history-links";
import {sharingNames,viewItems} from "./history-labels";
import HistoryOperators from "./history-operators";
import HistoryCohorts from "./history-cohorts";
import HistoryStation from "./history-station";
import HistoryContextPanel from "./history-context-panel";
import "./history.css";
const metrics=[{value:"bytes",label:"\u6d41\u91cf"},{value:"voiceSeconds",label:"\u901a\u8bdd"},{value:"sms",label:"\u77ed\u4fe1"}] as const;
const titles={city:"\u5730\u5e02\u7ecf\u8425\u5bf9\u6bd4",county:"\u533a\u53bf\u7ecf\u8425\u5bf9\u6bd4",site:"\u7ad9\u5740\u7ecf\u8425\u5bf9\u6bd4",operator:"\u8fd0\u8425\u5546\u670d\u52a1\u7ed3\u6784"};
const changeText=(value:number|null)=>value===null?"\u2014":(value>0?"+":"")+pct(value);
export default function HistoryWorkspace({data}:{data:HistoryModel}) {
  const router=useRouter(),[pending,start]=useTransition(),[page,setPage]=useState(1),[policy,setPolicy]=useState(false);
  const q=data.scope,metric=q.metric;
  const {carry,keep}=useInvestigationLinks(historyHref(q));
  const filterCount=[q.scene,q.siteType,q.sharing].filter(value=>value!=="all").length;
  const [filters,setFilters]=useState(filterCount>0);
  const lastDay=isoDay(dateNumber(q.window.end)-DAY_MS),[from,setFrom]=useState(q.window.start),[to,setTo]=useState(lastDay);
  const navigate=(patch:Record<string,string|undefined>)=>{if(!pending)start(()=>router.push(keep(historyHref(q,patch)),{scroll:false}));};
  const unit=metric==="bytes"?(q.query.countyId!=="all"||q.site?"GiB":"TiB"):metric==="voiceSeconds"?"\u4e07\u5206\u949f":"\u4e07\u6761";
  const scale=metric==="bytes"?(unit==="GiB"?1073741824:1099511627776):metric==="voiceSeconds"?600000:10000;
  const label=metrics.find(m=>m.value===metric)!.label;
  const current=Number(data.totals[metric]),previousDays=data.previousWindow?.days??q.window.days;
  const change=historyChange(data.totals,data.previous,metric,q.window.days,previousDays);
  const sorted=[...data.children].sort((a,b)=>Number(b[metric])-Number(a[metric])||a.id.localeCompare(b.id));
  const pages=Math.max(1,Math.ceil(sorted.length/20)),visible=sorted.slice((page-1)*20,page*20);
  const child=(id:string)=>data.kind==="city"?{city:id,county:"all",site:undefined}:data.kind==="county"?{county:id,site:undefined}:data.kind==="site"?{site:id}:{operator:id};
  const metricValue=(key:HistoryMetric)=>n(Number(data.totals[key])/(key==="bytes"?1099511627776:key==="voiceSeconds"?600000:10000),2);
  const scopeLabel=[data.region.name,data.region.cities.find(c=>c.id===q.query.cityId)?.name,data.region.counties.find(c=>c.id===q.query.countyId)?.name,data.siteName].filter(Boolean).join(" \u00b7 ");
  return <div data-history-analysis data-history-version={data.version} aria-busy={pending}><fieldset disabled={pending} className="min-w-0"><ShellPageContainer className="product-page-inset max-w-none gap-lg">
    <InvestigationReturn source="history"/><PageHeading title={data.siteName?"\u5355\u7ad9\u7ecf\u8425\u5206\u6790":"\u7ecf\u8425\u5206\u6790"} description={"\u670d\u52a1\u4ea7\u51fa\u3001\u533a\u57df\u5dee\u5f02\u4e0e\u540c\u671f\u53d8\u5316"}
      dataUpdate={data.dataUpdate}
      actions={<><Button asChild variant="outline"><a href={carry(relatedReviewHref(q.query,"month",q.site,q.metric))}>{"\u573a\u666f\u5e93\u6838\u9a8c\u7ebf\u7d22"}</a></Button>
        <Button asChild variant="outline"><a href={keep(historyReportHref(q))}>{"\u5386\u53f2\u62a5\u544a"}</a></Button>
        {q.site&&<Button asChild variant="outline"><a href={carry(relatedDossierHref(q.site,q.query))}><Icon name="building" size="sm"/>{"\u7ad9\u5740\u6863\u6848"}</a></Button>}</>}
      toolbar={<div className="flex flex-col gap-md py-sm">
        <div className="flex flex-wrap items-center justify-between gap-md">
          <SegmentedControl ariaLabel={"\u7ecf\u8425\u5206\u6790\u89c6\u89d2"} value={q.view} onChange={value=>navigate({view:value,band:"all"})} items={viewItems}/>
          <SegmentedControl ariaLabel={"\u7ecf\u8425\u5206\u6790\u6307\u6807"} value={metric} onChange={value=>navigate({metric:value,band:"all"})} items={metrics}/>
        </div>
        <nav className="flex flex-wrap items-center gap-xs text-body-small" aria-label={"\u5206\u6790\u5c42\u7ea7"}>
          <Button variant="link" onClick={()=>navigate({city:"all",county:"all",site:undefined})}>{data.region.name}</Button>
          {q.query.cityId!=="all"&&<><Icon name="chevron-right" size="xs"/><Button variant="link" onClick={()=>navigate({county:"all",site:undefined})}>{data.region.cities.find(c=>c.id===q.query.cityId)?.name}</Button></>}
          {q.query.countyId!=="all"&&<><Icon name="chevron-right" size="xs"/><Button variant="link" onClick={()=>navigate({site:undefined})}>{data.region.counties.find(c=>c.id===q.query.countyId)?.name}</Button></>}
          {data.siteName&&<><Icon name="chevron-right" size="xs"/><span aria-current="page">{data.siteName}</span></>}
        </nav>
        <form className="flex flex-wrap items-center gap-md" aria-label={"\u7ecf\u8425\u5206\u6790\u6761\u4ef6"} onSubmit={e=>{e.preventDefault();navigate({range:"custom",from,to});}}>
          <NativeSelect wrapperClassName="w-auto" aria-label={"\u5206\u6790\u65f6\u95f4\u8303\u56f4"} value={q.range} disabled={pending} onChange={e=>{
            const range=e.target.value;navigate({range,month:range==="month"?data.months.at(-1):undefined,from:range==="custom"?from:undefined,to:range==="custom"?to:undefined});
          }}><option value="12m">{"\u8fd112\u4e2a\u6708"}</option><option value="year">{"\u672c\u5e74\u5ea6"}</option><option value="quarter">{"\u4e0a\u4e00\u5b8c\u6574\u5b63\u5ea6"}</option><option value="month">{"\u6309\u6708\u5206\u6790"}</option><option value="custom">{"\u81ea\u5b9a\u4e49\u533a\u95f4"}</option></NativeSelect>
          {q.range==="month"&&<NativeSelect wrapperClassName="w-auto" aria-label={"\u5206\u6790\u6708\u4efd"} value={q.window.start.slice(0,7)} disabled={pending} onChange={e=>navigate({month:e.target.value})}>{[...data.months].reverse().map(month=><option key={month} value={month}>{month}</option>)}</NativeSelect>}
          {q.range==="custom"&&<><Input className="history-date-input" type="date" aria-label={"\u8d77\u59cb\u65e5\u671f"} min={data.coverage.start} max={to} value={from} onChange={e=>setFrom(e.target.value)} required/>
            <span className="text-muted-foreground">{"\u81f3"}</span><Input className="history-date-input" type="date" aria-label={"\u7ed3\u675f\u65e5\u671f"} min={from} max={isoDay(dateNumber(data.coverage.end)-DAY_MS)} value={to} onChange={e=>setTo(e.target.value)} required/>
            <Button type="submit" disabled={pending}>{"\u5e94\u7528"}</Button></>}
          <NativeSelect wrapperClassName="w-auto" aria-label={"\u7ecf\u8425\u5206\u6790\u8fd0\u8425\u5546"} value={q.query.operator} disabled={pending} onChange={e=>navigate({operator:e.target.value})}>{Object.entries(operatorNames).map(([key,name])=><option key={key} value={key}>{name}</option>)}</NativeSelect>
          <Button type="button" variant="ghost" aria-expanded={filters} aria-controls="history-cohort-filters" onClick={()=>setFilters(value=>!value)}><Icon name="filter" size="sm"/>{"\u7ad9\u7fa4\u7b5b\u9009"}{filterCount>0?" \u00b7 "+filterCount:""}</Button>
          <span className="ml-auto text-body-small tabular-nums text-muted-foreground">{q.window.start+" \u2014 "+lastDay+" \u00b7 "+q.window.days+"\u5929"}</span>
        </form>
        <Collapsible open={filters} onOpenChange={setFilters}><CollapsibleContent id="history-cohort-filters"><div className="flex flex-wrap items-center gap-md py-sm">
          <NativeSelect wrapperClassName="w-auto" aria-label={"\u5206\u6790\u4e1a\u52a1\u573a\u666f"} value={q.scene} onChange={e=>navigate({scene:e.target.value,band:"all"})}><option value="all">{"\u5168\u90e8\u4e1a\u52a1\u573a\u666f"}</option>{Object.entries(sceneNames).map(([id,name])=><option key={id} value={id}>{name}</option>)}</NativeSelect>
          <NativeSelect wrapperClassName="w-auto" aria-label={"\u5206\u6790\u7ad9\u70b9\u7c7b\u578b"} value={q.siteType} onChange={e=>navigate({siteType:e.target.value,band:"all"})}>{Object.entries(siteTypeNames).map(([id,name])=><option key={id} value={id}>{name}</option>)}</NativeSelect>
          <NativeSelect wrapperClassName="w-auto" aria-label={"\u5206\u6790\u5171\u4eab\u65b9\u5f0f"} value={q.sharing} onChange={e=>navigate({sharing:e.target.value,band:"all"})}><option value="all">{"\u5168\u90e8\u5171\u4eab\u65b9\u5f0f"}</option>{Object.entries(sharingNames).map(([id,name])=><option key={id} value={id}>{name}</option>)}</NativeSelect>
          {filterCount>0&&<Button variant="ghost" onClick={()=>navigate({scene:"all",siteType:"all",sharing:"all",band:"all"})}>{"\u6e05\u9664\u7ad9\u7fa4\u7b5b\u9009"}</Button>}
        </div></CollapsibleContent></Collapsible>
      </div>}/>
    <div className="grid min-w-0 gap-md md:grid-cols-3">
      <MetricRowsCard title={"\u7ecf\u8425\u670d\u52a1\u4ea7\u51fa"} icon="chart-bar" metrics={[{key:"bytes",label:"\u53cc\u5411\u6d41\u91cf / TiB",value:metricValue("bytes")},{key:"voice",label:"\u63a5\u901a\u901a\u8bdd / \u4e07\u5206\u949f",value:metricValue("voiceSeconds")},{key:"sms",label:"\u77ed\u4fe1 / \u4e07\u6761",value:metricValue("sms")}]}/>
      <MetricRowsCard title={"\u8f83\u4e0a\u5e74\u540c\u671f"} icon="chart-line-up" metrics={metrics.map(m=>({key:m.value,label:m.label+"\u540c\u6bd4",value:changeText(historyChange(data.totals,data.previous,m.value,q.window.days,previousDays).rate)}))}/>
      <MetricRowsCard title={"\u5206\u6790\u8d44\u6e90\u8303\u56f4"} icon="building" metrics={[{key:"sites",label:"\u7269\u7406\u7ad9\u5740 / \u5ea7",value:n(data.physicalSites)},{key:"relations",label:"\u8fd0\u8425\u5546\u670d\u52a1\u5173\u7cfb / \u6761",value:n(data.serviceRelations)},{key:"days",label:"\u6709\u6548\u7ad9\u65e5 / \u7ad9\u00b7\u5929",value:n(data.observedSiteDays)}]}/>
    </div>
    {!data.previous&&<p role="status" className="text-body-small text-muted-foreground">{"\u6240\u9009\u533a\u95f4\u7f3a\u5c11\u5b8c\u6574\u4e0a\u5e74\u540c\u671f\u57fa\u671f\uff0c\u540c\u6bd4\u6682\u4e0d\u53ef\u7528\u3002"}</p>}
    <PanelCard title={"\u4e1a\u52a1\u89c4\u6a21\u8d8b\u52bf"} icon="chart-line-up" className="min-w-0"
      description={q.window.grain==="month"?"\u6708\u5ea6\u805a\u5408 \u00b7 \u70b9\u51fb\u6708\u4efd\u67e5\u770b\u9010\u65e5\u8d8b\u52bf":"\u9010\u65e5\u805a\u5408 \u00b7 \u4fdd\u7559\u5f53\u524d\u533a\u57df\u548c\u8fd0\u8425\u5546"}
      >
      <div className="history-trend flex min-w-0 flex-col"><UsageTrend data={data.series.map(row=>({key:row.key,label:row.key,value:Number(row[metric])/scale}))}
        name={label} unit={unit} labelSuffix="" ariaLabel={label+"\u5386\u53f2\u8d8b\u52bf"} labelEvery={q.window.grain==="month"?2:5}
        formatValue={v=>n(v,2)} onSelect={q.window.grain==="month"?key=>navigate({range:"month",month:key}):q.site?key=>navigate({evidence:key,slot:undefined}):undefined}/></div>
      <div className="flex flex-wrap justify-between gap-sm pt-sm text-body-small text-muted-foreground">
        <span>{label+"\u65e5\u5747 "+n(current/q.window.days/scale,2)+" "+unit}</span>
        <span>{"\u65e5\u5747\u540c\u6bd4 "+changeText(change.dailyRate)}</span>
      </div>
    </PanelCard>
    {data.station&&<HistoryStation data={data} navigate={navigate}/>}
    <HistoryContextPanel data={data}/>
    {q.view==="region"&&<PanelCard title={titles[data.kind]} icon={data.kind==="site"?"building":data.kind==="operator"?"users":"city"} className="min-w-0"
      description={data.kind==="operator"?"\u8fd0\u8425\u5546\u540d\u79f0\u53ef\u7b5b\u9009\uff1b\u5404\u9879\u4e1a\u52a1\u72ec\u7acb\u7edf\u8ba1":"\u6309\u5f53\u524d\u6307\u6807\u603b\u91cf\u6392\u5e8f \u00b7 \u70b9\u51fb\u540d\u79f0\u9010\u5c42\u4e0b\u94bb"}>
      <DataTable rows={visible} rowKey={r=>r.id} columns={[
        {id:"name",header:data.kind==="site"?"\u7ad9\u5740":data.kind==="operator"?"\u8fd0\u8425\u5546":"\u533a\u57df",cell:r=><Button variant="link" onClick={()=>navigate(child(r.id))}>{data.kind==="operator"?operatorNames[r.id]:r.name}</Button>},
        {id:"sites",header:"\u7ad9\u5740 / \u5ea7",cell:r=>n(r.sites)},
        {id:"total",header:label+" / "+unit,cell:r=><span className="tabular-nums">{n(Number(r[metric])/scale,2)}</span>},
        {id:"share",header:"\u7528\u91cf\u5360\u6bd4",cell:r=><div className="flex min-w-control-xl flex-col gap-xs"><span className="text-body-small text-muted-foreground">{current?pct(Number(r[metric])/current):"\u2014"}</span>{current>0&&<Progress value={Number(r[metric])/current*100} aria-label={r.name+"\u7528\u91cf\u5360\u6bd4"}/>}</div>},
        {id:"delta",header:"\u540c\u6bd4\u589e\u51cf / "+unit,cell:r=>{const d=historyChange(r,r.previous,metric,q.window.days,previousDays).delta;return <span className="tabular-nums text-muted-foreground">{d===null?"\u2014":(Number(d)>0?"+":"")+n(Number(d)/scale,2)}</span>;}},
        {id:"rate",header:"\u603b\u91cf\u540c\u6bd4",cell:r=>changeText(historyChange(r,r.previous,metric,q.window.days,previousDays).rate)},
        {id:"daily",header:"\u65e5\u5747 / "+unit,cell:r=><span className="tabular-nums text-muted-foreground">{n(Number(r[metric])/q.window.days/scale,2)}</span>},
      ]} empty={<EmptyState title={"\u5f53\u524d\u8303\u56f4\u6682\u65e0\u9002\u7528\u670d\u52a1\u5173\u7cfb"}/>}/>
      {pages>1&&<Pagination className="pt-lg" page={page} pageCount={pages} countLabel={n(sorted.length)+"\u9879"} onPageChange={setPage} firstLabel={"\u9996\u9875"} previousLabel={"\u4e0a\u4e00\u9875"} nextLabel={"\u4e0b\u4e00\u9875"} lastLabel={"\u672b\u9875"}/>}
    </PanelCard>}
    {q.view==="operators"&&<HistoryOperators data={data} unit={unit} scale={scale} navigate={navigate}/>}
    {q.view==="cohorts"&&<HistoryCohorts data={data} unit={unit} scale={scale} navigate={navigate}/>}
    <Collapsible open={policy} onOpenChange={setPolicy}>
      <CollapsibleTrigger asChild><Button variant="ghost"><Icon name="shield-check" size="sm"/>{"\u5206\u6790\u53e3\u5f84\u4e0e\u8986\u76d6"}</Button></CollapsibleTrigger>
      <CollapsibleContent><div className="flex flex-col gap-sm py-md text-body-small text-muted-foreground">
        <p>{scopeLabel+"\uff1b\u5f53\u524d\u4e3a\u56fa\u5b9a\u8d44\u6e90\u6837\u672c\uff0c\u6bd4\u8f83\u91c7\u7528\u76f8\u540c\u7ad9\u5740\u53ca\u670d\u52a1\u5173\u7cfb\u8303\u56f4\uff0c\u4e0d\u63a8\u65ad\u5386\u53f2\u65b0\u589e\u6216\u9000\u51fa\u3002"}</p>
        <p>{data.previousWindow?"\u4e0a\u5e74\u540c\u671f\uff1a"+data.previousWindow.start+" \u2014 "+isoDay(dateNumber(data.previousWindow.end)-DAY_MS)+"\u3002":"\u4e0a\u5e74\u540c\u671f\u6570\u636e\u4e0d\u8db3\u3002"}{"\u603b\u91cf\u4e0e\u65e5\u5747\u540c\u65f6\u6bd4\u8f83\uff1b\u96f6\u57fa\u671f\u4e0d\u8ba1\u7b97\u53d8\u5316\u7387\uff0c\u7f3a\u6570\u4e0d\u4f5c\u4e3a\u96f6\u91cf\u3002"}</p>
        <p>{"\u6709\u6548\u7ad9\u65e5 "+n(data.observedSiteDays)+" / \u9884\u671f\u7ad9\u65e5 "+n(data.expectedSiteDays)+"\uff1b\u5386\u53f2\u8986\u76d6 "+data.coverage.start+" \u2014 "+isoDay(dateNumber(data.coverage.end)-DAY_MS)+"\u3002\u6765\u6e90\u7248\u672c\uff1a"+data.version}</p>
        <p>{"\u5e74\u5ea6\u91c7\u7528\u65e5/\u6708\u805a\u5408\uff0c\u65e5\u5185\u8bc1\u636e\u53d7\u72ec\u7acb\u67e5\u8be2\u8303\u56f4\u9650\u5236\u3002\u6d41\u91cf\u3001\u901a\u8bdd\u548c\u77ed\u4fe1\u4e0d\u5408\u5e76\u4e3a\u7efc\u5408\u4e1a\u52a1\u91cf\u3002"}</p>
      </div></CollapsibleContent>
    </Collapsible>
  </ShellPageContainer></fieldset></div>;
}
