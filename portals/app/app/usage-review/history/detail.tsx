"use client";
import {useState,useTransition} from "react";
import {useRouter} from "next/navigation";
import {Button,Collapsible,CollapsibleContent,CollapsibleTrigger,DataTable,EmptyState,Icon,Input,NativeSelect,PanelCard,ShellPageContainer} from "@vxture/design-system";
import PageHeading from "../../portal/page-heading";
import UsageTrend from "../../portal/usage-trend";
import type {StationEvidence} from "../../domains/map-demo/station-history-service";
import type {HistoryScope} from "../../domains/map-demo/history-rules";
import {historyEvidenceHref,historyHref} from "../../analysis/history-links";
import {DAY_MS,dateNumber,isoDay} from "../../domains/map-demo/history-calendar";
import {kindNames,metricNames,quantity,deviation,timeLabel,windowLabel} from "../labels";
import {n,operatorNames} from "../../sites/labels";
import "../../analysis/history.css";
const waveNames={within:"\u8303\u56f4\u5185",up:"\u7528\u91cf\u7a81\u589e",down:"\u7528\u91cf\u7a81\u964d",from_zero:"\u4ece\u96f6\u65b0\u589e",both_zero:"\u672c\u671f\u4e0e\u53c2\u8003\u5747\u96f6",insufficient:"\u57fa\u7ebf\u4e0d\u8db3"};
export default function HistoryEvidenceDetail({data:e,scope:q}:{data:StationEvidence;scope:HistoryScope}) {
  const router=useRouter(),[pending,start]=useTransition(),[raw,setRaw]=useState(false);
  const navigate=(patch:Record<string,string|undefined>)=>{if(!pending)start(()=>router.push(historyEvidenceHref(q,patch),{scroll:false}));};
  const metric=q.metric,scale=metric==="bytes"?1073741824:metric==="voiceSeconds"?60:1,unit=metric==="bytes"?"GiB":metric==="voiceSeconds"?"\u5206\u949f":"\u6761";
  const selected=e.selected;
  return <div data-history-evidence aria-busy={pending}><fieldset disabled={pending} className="min-w-0"><ShellPageContainer className="product-page-inset max-w-none gap-lg">
    <PageHeading title={"\u5355\u7ad9\u6838\u9a8c\u4f9d\u636e"} description={e.site.name+" \u00b7 "+e.site.id+" \u00b7 "+metricNames[metric]}
      navigation={<Button asChild variant="link"><a href={historyHref(q,{evidence:e.date,slot:String(e.slot)})}><Icon name="chevron-left" size="sm"/>{"\u8fd4\u56de\u7ecf\u8425\u5206\u6790"}</a></Button>}
      context={<span>{"\u6570\u636e\u622a\u81f3 "+isoDay(dateNumber(e.cutoff)-DAY_MS)}</span>}
      actions={<Button asChild variant="outline"><a href={"/sites/"+encodeURIComponent(e.site.id)+"?tab=business"}>{"\u7ad9\u5740\u6863\u6848"}</a></Button>}
      toolbar={<div className="flex flex-wrap items-center gap-md py-md">
        <Input type="date" className="history-date-input" aria-label={"\u6838\u9a8c\u65e5\u671f"} value={e.date} min={q.window.start} max={isoDay(dateNumber(q.window.end)-DAY_MS)} onChange={event=>{if(event.target.value&&event.target.validity.valid)navigate({evidence:event.target.value,slot:undefined});}}/>
        <NativeSelect wrapperClassName="w-auto" aria-label={"\u6838\u9a8c\u65f6\u6bb5"} value={String(e.slot)} onChange={event=>navigate({slot:event.target.value})}>{e.hours.map(h=><option value={h.hour} key={h.hour}>{String(h.hour).padStart(2,"0")+":00"}</option>)}</NativeSelect>
        <NativeSelect wrapperClassName="w-auto" aria-label={"\u6838\u9a8c\u8fd0\u8425\u5546"} value={q.query.operator} onChange={event=>navigate({operator:event.target.value})}>{["all",...e.operators].map(id=><option key={id} value={id}>{operatorNames[id]}</option>)}</NativeSelect>
        <span className="ml-auto text-body-small text-muted-foreground">{"\u5f53\u524d\u4ec5\u67e5\u8be2\u8bc1\u636e\uff0c\u539f\u56e0\u672a\u786e\u8ba4"}</span>
      </div>}/>
    <PanelCard title={"\u9009\u5b9a\u7a97\u53e3\u4e0e\u5386\u53f2\u53c2\u8003"} icon="shield-check" className="min-w-0" description={e.date+" \u00b7 "+String(e.slot).padStart(2,"0")+":00 \u00b7 \u5f53\u524d\u503c\u3001\u57fa\u7ebf\u4e0e\u5206\u6790\u9875\u9762\u4e00\u81f4"}>
      <DataTable rows={selected} rowKey={r=>r.code} columns={[
        {id:"operator",header:"\u670d\u52a1\u8fd0\u8425\u5546",cell:r=>operatorNames[r.code]},
        {id:"current",header:"\u5b9e\u9645\u7528\u91cf",cell:r=>quantity(String(r.values[metric]),metric)},
        {id:"reference",header:"\u53c2\u8003\u4e2d\u4f4d\u6570",cell:r=>quantity(r.wave.referenceNumerator,metric,2)},
        {id:"delta",header:"\u504f\u79bb",cell:r=>deviation(String(r.values[metric]),r.wave.referenceNumerator)},
        {id:"samples",header:"\u53ef\u7528\u53c2\u8003",cell:r=>r.references.filter(v=>v.complete).length+" / 4"},
        {id:"result",header:"\u7b5b\u67e5\u7ed3\u679c",cell:r=>waveNames[r.wave.status]},
      ]}/>
      <p className="pt-md text-body-small text-muted-foreground">{"\u8fc7\u53bb4\u5468\u540c\u661f\u671f\u540c\u5c0f\u65f6\uff0c\u81f3\u5c113\u4e2a\u53ef\u7528\u53c2\u8003\uff1b\u76f8\u5bf9\u53d8\u5316\u2265"+e.policy.relativeBps/100+"% \u4e14\u7edd\u5bf9\u53d8\u5316\u2265"+quantity(e.policy.minimum[metric],metric)+"\u3002\u96f6\u57fa\u7ebf\u4e0d\u663e\u793a\u53d8\u5316\u7387\uff0c\u672a\u547d\u4e2d\u95e8\u69db\u4e0d\u4ee3\u8868\u5df2\u5b8c\u6210\u4e1a\u52a1\u6838\u9a8c\u3002"}</p>
    </PanelCard>
    <div className="grid min-w-0 gap-md lg:grid-cols-2">
      <PanelCard title={"\u5f53\u65e5\u9010\u5c0f\u65f6\u7528\u91cf"} icon="chart-bar" className="min-w-0" description={"\u70b9\u51fb\u6216\u952e\u76d8\u9009\u62e9\u5c0f\u65f6\uff0c\u66f4\u65b0\u5f53\u524d\u7a97\u53e3\u4e0e\u53c2\u8003"}>
        <div className="history-trend flex min-w-0 flex-col"><UsageTrend data={e.hours.map(h=>({key:String(h.hour),label:String(h.hour).padStart(2,"0"),value:Number(h.values[metric])/scale}))} name={metricNames[metric]} unit={unit} selectedKey={String(e.slot)} ariaLabel={"\u6838\u9a8c\u9010\u5c0f\u65f6\u7528\u91cf"} formatValue={v=>n(v,2)} onSelect={hour=>navigate({slot:hour})}/></div>
      </PanelCard>
      <PanelCard title={"\u56db\u5468\u53c2\u8003\u539f\u503c"} icon="calendar" className="min-w-0" description={"\u6765\u6e90\u8303\u56f4\u4ee5\u524d\u7684\u53c2\u8003\u4e0d\u8865\u96f6\uff0c\u4e0d\u6539\u52a8\u5f53\u524d\u6d4b\u91cf"}>
        <DataTable rows={selected.flatMap(s=>s.references.map(r=>({...r,code:s.code,key:s.code+r.start})))} rowKey={r=>r.key} columns={[
          {id:"op",header:"\u8fd0\u8425\u5546",cell:r=>operatorNames[r.code]},
          {id:"date",header:"\u53c2\u8003\u7a97\u53e3",cell:r=>timeLabel(r.start)},
          {id:"value",header:"\u53c2\u8003\u7528\u91cf",cell:r=>quantity(r.value,metric)},
          {id:"quality",header:"\u6765\u6e90\u72b6\u6001",cell:r=>r.complete?"\u6837\u672c\u5b8c\u6574":"\u8d85\u51fa\u5386\u53f2\u8986\u76d6"},
        ]}/>
      </PanelCard>
    </div>
    <PanelCard title={"\u5f53\u65e5\u7b5b\u67e5\u7ebf\u7d22"} icon="list-checks" className="min-w-0" description={"\u9010\u8fd0\u8425\u5546\u670d\u52a1\u5173\u7cfb\u72ec\u7acb\u7b5b\u67e5\uff1b\u4ec5\u5f53\u524d\u65e5\u671f\uff0c\u4e0d\u4ee3\u8868\u6574\u6bb5\u5206\u6790\u5468\u671f\u7684\u5f02\u5e38\u603b\u91cf"}>
      <DataTable rows={e.findings} rowKey={r=>r.code+r.start+r.kind} columns={[
        {id:"op",header:"\u8fd0\u8425\u5546",cell:r=>operatorNames[r.code]},
        {id:"time",header:"\u53d1\u751f\u7a97\u53e3",cell:r=><Button variant="link" onClick={()=>navigate({operator:r.code,slot:String(Number(timeLabel(r.start).slice(11,13)))})}>{windowLabel(r.start,r.end)}</Button>},
        {id:"kind",header:"\u7ebf\u7d22\u7c7b\u522b",cell:r=>kindNames[r.kind]},
        {id:"actual",header:"\u5b9e\u9645\u7528\u91cf",cell:r=>quantity(r.current,metric)},
        {id:"base",header:"\u53c2\u8003\u7528\u91cf",cell:r=>quantity(r.referenceNumerator,metric,2)},
      ]} empty={<EmptyState title={"\u5f53\u65e5\u672a\u53d1\u73b0\u6ee1\u8db3\u7b5b\u67e5\u6761\u4ef6\u7684\u7ebf\u7d22"} description={"\u8fd9\u4e0d\u4ee3\u8868\u5df2\u7ecf\u5b8c\u6210\u4eba\u5de5\u539f\u56e0\u786e\u8ba4\u6216\u590d\u6838\u3002"}/>}/>
    </PanelCard>
    <Collapsible open={raw} onOpenChange={setRaw}><CollapsibleTrigger asChild><Button variant="ghost"><Icon name="database" size="sm"/>{"\u7cbe\u786e\u8ba1\u6570\u4e0e\u4f9d\u636e\u7248\u672c"}</Button></CollapsibleTrigger><CollapsibleContent>
      <PanelCard title={"\u539f\u59cb\u8ba1\u6570"} icon="database" className="min-w-0" description={(metric==="bytes"?"B":metric==="voiceSeconds"?"s":"\u6761")+" \u00b7 \u4e2d\u4f4d\u6570\u4e0e\u5dee\u503c\u4f7f\u7528\u5206\u6bcd2"}>
        <DataTable rows={selected} rowKey={r=>r.code} columns={[
          {id:"op",header:"\u8fd0\u8425\u5546",cell:r=>operatorNames[r.code]},
          {id:"current",header:"\u5f53\u524d\u539f\u503c",cell:r=><span className="font-mono text-body-small">{String(r.values[metric])}</span>},
          {id:"reference",header:"\u56db\u5468\u539f\u503c",cell:r=><span className="font-mono text-body-small">{r.references.map(v=>v.value??"\u7f3a\u5931").join(" / ")}</span>},
          {id:"numerator",header:"\u4e2d\u4f4d\u6570\u5206\u5b50",cell:r=><span className="font-mono text-body-small">{r.wave.referenceNumerator??"\u2014"}</span>},
          {id:"delta",header:"\u5dee\u503c\u5206\u5b50",cell:r=><span className="font-mono text-body-small">{r.wave.deltaNumerator??"\u2014"}</span>},
        ]}/>
        <dl className="flex flex-col gap-sm break-all pt-lg text-body-small text-muted-foreground">{[["\u4f9d\u636e\u7f16\u53f7",e.referenceId],["\u8bc1\u636e\u6458\u8981",e.evidenceDigest],["\u6765\u6e90",e.sourceVersion],["\u89c4\u5219",e.policyVersion],["\u5206\u6790\u7248\u672c",e.version]].map(([name,value])=><div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>
      </PanelCard>
    </CollapsibleContent></Collapsible>
    <p className="text-body-small text-muted-foreground">{"\u672c\u9875\u4f9d\u636e\u6765\u81ea\u7ecf\u8425\u5386\u53f2\u540c\u4e00\u6765\u6e90\uff0c\u4e0d\u5f15\u7528\u72ec\u7acb\u573a\u666f\u5e93\u3002\u5f53\u524d\u6ca1\u6709\u6301\u4e45\u5316\u6848\u4ef6\u6216\u4eba\u5de5\u786e\u8ba4\u8bb0\u5f55\uff1b\u4f9d\u636e\u7f16\u53f7\u7528\u4e8e\u7cbe\u786e\u8ffd\u6eaf\uff0c\u4e0d\u4ee3\u8868\u539f\u56e0\u786e\u8ba4\u3001\u4fee\u590d\u6216\u590d\u6838\u5b8c\u6210\u3002"}</p>
  </ShellPageContainer></fieldset></div>;
}
