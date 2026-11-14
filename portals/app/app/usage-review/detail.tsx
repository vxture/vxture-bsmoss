"use client";
import OperatorIdentity from "../portal/operator-identity";
import "../site-analysis/site-analysis.css";
import AnalysisParameterRefresh from "../site-analysis/parameter-refresh";
import {useOperatorNames} from "../portal/operator-identities";
import { BarChart, Button, Collapsible, CollapsibleContent, CollapsibleTrigger, DataTable, Icon, PanelCard, StatusBadge } from "@vxture/design-system";
import PageHeading from "../portal/page-heading";
import { useState } from "react";
import type { ReviewDetailModel } from "../domains/usage-verification/demo";
import { reviewHref, reviewMapHref } from "../domains/usage-verification/links";
import {DEFAULT_VERIFICATION_PARAMETERS,verificationMinimum} from "../domains/usage-verification/parameters";
import { operatorNames } from "../sites/labels";
import { kindNames, metricNames, quantity, deviation, reasonNames, qualityNames, timeLabel, windowLabel } from "./labels";
import { FindingBadge } from "./finding-badge";
import "./review.css";
import {useReviewRecords,type LocalReviewRecords} from './use-records';
import {InvestigationReturn,useInvestigationLinks} from '../portal/investigation';
import {relatedDossierHref,relatedReviewHref} from '../portal/investigation-targets';
import {businessHref} from "../business-analysis/links";
import RecordActions from './record-actions';
import {recordProjection} from '../domains/usage-verification/event-service';
import {statusNames} from './labels';
import {isReviewRecordsHref,reviewWorkspaceHref} from './view';
export default function ReviewDetail({model,recordSession,eventNumber}:{model:ReviewDetailModel;recordSession?:string;eventNumber?:number}){
 const records=useReviewRecords(model.item.source,recordSession);
 const stored=model.retired?records.data?.logs.find(l=>l.caseId===model.item.id)?.events.at(-1)?.evidence:undefined;
 return <><AnalysisParameterRefresh kind="verification" revision={model.configuration.revision}/><ReviewEvidence model={stored?{...model,item:stored}:model} records={records} recordSession={recordSession} eventNumber={eventNumber} retired={model.retired}/></>;
}
export function ReviewEvidence({model,records,recordSession,eventNumber,embedded=false,retired=false,listHref}:{model:ReviewDetailModel;records:LocalReviewRecords;recordSession?:string;eventNumber?:number;embedded?:boolean;retired?:boolean;listHref?:string}) {
 const operatorNames=useOperatorNames();
  const projection=recordProjection(records.data?.logs.find(l=>l.caseId===model.item.id),model.item);
  const { item: c, query: q } = model, [raw, setRaw] = useState(false), first = c.windows[0], metric = c.metric;
  const session=records.selected?'&recordSession='+records.selected:'',origin=reviewHref(q,c.id)+session+(eventNumber?'&event='+eventNumber:'');
  const {carry,keep,journey}=useInvestigationLinks(listHref??origin),related={...q.scope,operator:c.operator,hour:Number(timeLabel(c.start).slice(11,13))};
  const policy=c.parameters??DEFAULT_VERIFICATION_PARAMETERS;
  const rawUnit = metric === "bytes" ? "B" : metric === "voiceSeconds" ? "s" : "\u6761", scale = metric === "bytes" ? 1073741824 : metric === "voiceSeconds" ? 60 : 1;
  const chartUnit = metric === "bytes" ? "GiB" : metric === "voiceSeconds" ? "\u5206\u949f" : "\u6761";
  const chart = [...first.references.filter(r => r.quality === "verified" && r.complete && r.value !== null).sort((a, b) => Date.parse(a.start) - Date.parse(b.start)).map(r => ({ key: r.start, label: timeLabel(r.start).slice(5, 10), value: Number(r.value) / scale })),
    ...(first.usable ? [{ key: first.start, label: "\u672c\u671f", value: Number(first.value) / scale }] : [])];
  const heading = c.kind === "missing" ? "\u5f53\u524d\u7a97\u53e3\u7f3a\u5c11\u53ef\u7528\u8f93\u5165\uff0c\u5148\u6838\u5bf9\u6765\u6e90\u4e0e\u8d28\u91cf" : c.kind === "insufficient" ? "\u5386\u53f2\u6709\u6548\u53c2\u8003\u4e0d\u8db3\uff0c\u6682\u4e0d\u5224\u65ad\u4e1a\u52a1\u53d8\u5316" :
    c.kind === "zero_run" ? "\u8fde\u7eed\u6709\u6548\u7a97\u53e3\u4e3a\u96f6\uff0c\u9700\u8981\u786e\u8ba4\u4e1a\u52a1\u539f\u56e0" : "\u7528\u91cf\u53d8\u5316\u8fbe\u5230\u7b5b\u67e5\u95e8\u69db\uff0c\u9700\u8981\u6838\u5bf9\u4e1a\u52a1\u539f\u56e0";
  return <div data-usage-review="detail" className={embedded?"site-analysis-workflow flex min-w-0 flex-col gap-lg":"site-analysis-workflow site-analysis-page product-page-inset flex min-w-0 w-full flex-col gap-lg"}>
    {embedded?<div className="flex min-w-0 flex-col gap-md"><div className="flex flex-wrap items-center gap-xs text-body"><OperatorIdentity code={c.operator}/><span>{metricNames[metric]}</span><FindingBadge item={c}/><StatusBadge tone={projection.state==='closed'?'success':'neutral'} size="sm">{records.data?statusNames[projection.state]:'\u8bfb\u53d6\u4e2d'}</StatusBadge></div><p className="text-body-small text-muted-foreground">{model.region.cities.find(s=>s.id===c.site.cityId)?.name+' / '+model.region.counties.find(s=>s.id===c.site.countyId)?.name+' \u00b7 '+windowLabel(c.start,c.end)}</p><div className="flex flex-wrap items-center gap-xs"><Button asChild variant="outline"><a href={carry(reviewHref(q,c.id)+session)}>{'\u72ec\u7acb\u9875\u67e5\u770b'}</a></Button><Button asChild variant="outline"><a href={carry(relatedDossierHref(c.site.id,related,q.period))}>{'\u7ad9\u5740\u6863\u6848'}</a></Button><Button asChild variant="outline"><a target="_blank" rel="noopener noreferrer" href={carry(reviewMapHref({...q,scope:related},c.site.id))}><Icon name="map-pin" size="sm"/>{'\u5730\u56fe\u5b9a\u4f4d'}</a></Button><Button asChild variant="outline"><a href={carry(businessHref('operator-usage',{...related,period:q.period,topic:'capacity'}))}>{'\u4e1a\u52a1\u7528\u91cf'}</a></Button><Button asChild variant="outline"><a href={carry('/analysis?'+new URLSearchParams({city:related.cityId,county:related.countyId,operator:c.operator,site:c.site.id,metric:c.metric,range:'custom',from:timeLabel(c.start).slice(0,10),to:timeLabel(c.start).slice(0,10)}))}>{'\u5386\u53f2\u5206\u6790'}</a></Button></div></div>:<PageHeading icon="search" title={embedded?"\u6838\u9a8c\u8bc1\u636e":c.site.name} description={c.site.id + " \u00b7 " + operatorNames[c.operator] + " \u00b7 " + metricNames[metric]}
      navigation={embedded?undefined:<div className="flex min-w-0 flex-wrap items-center gap-sm"><Button asChild variant="ghost"><a href={(journey && isReviewRecordsHref(journey.href))?journey.href:keep(reviewHref(q)+session)}><Icon name="arrow-left" size="sm" />{(journey && isReviewRecordsHref(journey.href))?"\u8fd4\u56de\u6838\u9a8c\u8bb0\u5f55":"\u8fd4\u56de\u6838\u9a8c\u5217\u8868"}</a></Button></div>} secondary={<><FindingBadge item={c} /><StatusBadge tone="neutral" size="sm">{records.data?statusNames[projection.state]:"\u8bfb\u53d6\u8bb0\u5f55\u4e2d"}</StatusBadge></>}
      region={<span className="text-body-small text-muted-foreground">{model.region.cities.find(s => s.id === c.site.cityId)?.name + " / " + model.region.counties.find(s => s.id === c.site.countyId)?.name}</span>}
      context={<span>{"\u6570\u636e\u622a\u81f3 "}<time dateTime={model.cutoff}>{timeLabel(model.cutoff)}</time></span>}
      actions={<><Button asChild variant="outline"><a href={keep(reviewWorkspaceHref(q,"records",records.selected))}>{"\u6838\u9a8c\u8bb0\u5f55"}</a></Button><Button asChild variant="outline"><a href={carry(relatedDossierHref(c.site.id,related,q.period))}><Icon name="building" size="sm" />{"\u7ad9\u5740\u6863\u6848"}</a></Button><Button asChild variant="outline"><a target="_blank" rel="noopener noreferrer" href={carry(reviewMapHref({...q,scope:related},c.site.id))}><Icon name="map-pin" size="sm" />{"\u5730\u56fe\u5b9a\u4f4d"}</a></Button><Button asChild variant="outline"><a href={carry(businessHref("operator-usage",{...related,period:q.period,topic:"capacity"}))}>{"\u8fd0\u8425\u5546\u7528\u91cf"}</a></Button><Button asChild variant="outline"><a href={carry("/analysis?"+new URLSearchParams({city:related.cityId,county:related.countyId,operator:c.operator,site:c.site.id,metric:c.metric,range:"custom",from:timeLabel(c.start).slice(0,10),to:timeLabel(c.start).slice(0,10)}))}>{"\u5386\u53f2\u5173\u8054\u5206\u6790"}</a></Button></>} toolbar={<InvestigationReturn source="uv"/>} />}
    <div className="grid min-w-0 shrink-0 gap-lg 2xl:grid-cols-3">
      <div className="flex min-w-0 flex-col gap-lg 2xl:col-span-2">
        <PanelCard title={heading} icon="search" tone={c.category === "quality" ? "warning" : c.category === "insufficient" ? "neutral" : "info"} description={windowLabel(c.start, c.end)}>
          <div className="grid grid-cols-1 gap-lg py-sm sm:grid-cols-3">{[{ label: "\u5b9e\u9645\u91cf", value: quantity(c.current, metric) }, { label: "\u5386\u53f2\u4e2d\u4f4d\u6570", value: quantity(c.referenceNumerator, metric, 2) }, { label: "\u53d8\u5316", value: deviation(c.current, c.referenceNumerator) }].map(x => <div key={x.label} className="flex flex-col gap-xs"><span className="text-body-small text-muted-foreground">{x.label}</span><strong className="text-heading-2 tabular-nums">{x.value}</strong></div>)}</div>
          <p className="pt-md text-body-small text-muted-foreground">{c.kind === "missing" ? reasonNames[first.reason] + "\uff1b\u539f\u5019\u9009\u503c\u4e0d\u53c2\u4e0e\u6709\u6548\u7528\u91cf\u3002" : c.kind === "insufficient" ? "\u8fc7\u53bb\u56db\u5468\u81f3\u5c11\u9700\u89813\u4e2a\u6709\u6548\u53ef\u6bd4\u53c2\u8003\uff0c\u7f3a\u5931\u4f4d\u7f6e\u4fdd\u7559\u539f\u72b6\u3002" : c.kind === "zero_run" ? "\u8fde\u7eed" + c.windows.length + "\u4e2a\u6709\u6548\u5c0f\u65f6\u5747\u4e3a\u771f\u5b9e\u96f6\u503c\uff1b\u4e0d\u4ee3\u8868\u901a\u4fe1\u6545\u969c\u6216\u4e1a\u52a1\u505c\u7528\u3002" : "\u76f8\u5bf9\u504f\u79bb\u4e0e\u7edd\u5bf9\u53d8\u5316\u540c\u65f6\u8fbe\u6807\uff1b\u96f6\u57fa\u7ebf\u4ec5\u6309\u7edd\u5bf9\u95e8\u69db\u5224\u65ad\u3002"}</p>
        </PanelCard>
        {chart.length > 0 && <PanelCard title={"\u540c\u661f\u671f\u540c\u65f6\u69fd\u5bf9\u7167"} icon="chart-bar" description={"\u5355\u4f4d " + chartUnit + " \u00b7 \u9996\u4e2a\u7a97\u53e3\u53ca\u6709\u6548\u53c2\u8003\uff0c\u7cbe\u786e\u539f\u503c\u89c1\u4e0b\u65b9\u3002"}><BarChart data={chart} formatValue={v => v.toLocaleString("zh-CN", { maximumFractionDigits: 2 })} aria-label={"\u6838\u9a8c\u7a97\u53e3\u4e0e\u5386\u53f2\u53c2\u8003\u7528\u91cf"} /></PanelCard>}
        <PanelCard title={"\u9010\u7a97\u53e3\u8bc1\u636e"} icon="list-checks" description={"\u7f3a\u6570\u4e0e\u672a\u77e5\u4fdd\u6301\u7a7a\u503c\uff0c\u5019\u9009\u8f93\u5165\u4e0d\u4f5c\u4e3a\u6709\u6548\u7528\u91cf\u3002"} className="min-w-0">
          <div className="min-w-0 overflow-x-auto"><DataTable rows={c.windows} rowKey={w => w.start} columns={[
            { id: "time", header: "\u7a97\u53e3", cell: w => windowLabel(w.start, w.end) },
            { id: "value", header: "\u6709\u6548\u7528\u91cf", cell: w => quantity(w.usable ? w.value : null, metric) },
            { id: "reference", header: "\u53c2\u8003\u4e2d\u4f4d\u6570", cell: w => quantity(w.wave?.referenceNumerator ?? null, metric, 2) },
            { id: "quality", header: "\u8f93\u5165\u72b6\u6001", cell: w => qualityNames[w.quality] },
            { id: "coverage", header: "\u5b8c\u6210\u4f9d\u636e", cell: w => w.complete ? "\u6837\u4f8b\u5b8c\u6210\u6807\u8bb0" : "\u672a\u5b8c\u6210" },
            { id: "samples", header: "\u6709\u6548\u53c2\u8003", cell: w => w.references.filter(r => r.complete && r.quality === "verified").length + " / 4" },
          ]} /></div>
        </PanelCard>
        <PanelCard title={"\u56db\u5468\u53c2\u8003\u539f\u503c"} icon="calendar" description={"\u540c\u661f\u671f\u3001\u540c\u4e00\u5c0f\u65f6\uff1b\u4e0d\u53ef\u7528\u53c2\u8003\u660e\u786e\u6807\u8bb0\uff0c\u4e0d\u8865\u96f6\u3002"} className="min-w-0">
          <DataTable rows={c.windows.flatMap(w => w.references.map(r => ({ ...r, currentStart: w.start, key: w.start + r.start })))} rowKey={r => r.key} columns={[
            ...(c.windows.length > 1 ? [{ id: "current", header: "\u672c\u671f\u5c0f\u65f6", cell: (r: { currentStart: string }) => timeLabel(r.currentStart).slice(11) }] : []),
            { id: "date", header: "\u5386\u53f2\u7a97\u53e3", cell: r => windowLabel(r.start, r.end) },
            { id: "value", header: "\u53c2\u8003\u7528\u91cf", cell: r => quantity(r.quality === "verified" && r.complete ? r.value : null, metric) },
            { id: "state", header: "\u72b6\u6001 / \u539f\u56e0", cell: r => r.reason ? reasonNames[r.reason] : qualityNames[r.quality] },
          ]} />
        </PanelCard>
        <Collapsible open={raw} onOpenChange={setRaw}><CollapsibleTrigger asChild><Button variant="ghost"><Icon name="database" size="sm" />{"\u7cbe\u786e\u539f\u59cb\u8ba1\u6570"}<Icon name={raw ? "chevron-up" : "chevron-down"} size="sm" /></Button></CollapsibleTrigger><CollapsibleContent><PanelCard title={"\u539f\u503c\u4e0e\u8ba1\u7b97\u5206\u5b50"} icon="database" description={"\u539f\u59cb\u5355\u4f4d " + rawUnit + " \u00b7 \u53c2\u8003\u4e2d\u4f4d\u6570\u53ca\u5dee\u503c\u5206\u6bcd\u4e3a2"} className="min-w-0"><DataTable rows={c.windows} rowKey={w => w.start} columns={[
          { id: "at", header: "\u7a97\u53e3", cell: w => timeLabel(w.start) },
          { id: "raw", header: "\u6765\u6e90\u5019\u9009\u539f\u503c", cell: w => <span className="font-mono text-body-small">{w.value ?? "\u7f3a\u5931"}</span> },
          { id: "refs", header: "\u56db\u53c2\u8003\u539f\u503c", cell: w => <span className="font-mono text-body-small">{w.references.map(r => r.value ?? "\u7f3a\u5931").join(" / ")}</span> },
          { id: "median", header: "\u4e2d\u4f4d\u6570\u5206\u5b50", cell: w => <span className="font-mono text-body-small">{w.wave?.referenceNumerator ?? "\u2014"}</span> },
          { id: "delta", header: "\u5dee\u503c\u5206\u5b50", cell: w => <span className="font-mono text-body-small">{w.wave?.deltaNumerator ?? "\u2014"}</span> },
        ]} /></PanelCard></CollapsibleContent></Collapsible>
      </div>
      <aside className="flex min-w-0 flex-col gap-lg" aria-label={"\u6838\u9a8c\u4f9d\u636e\u4e0e\u5904\u7406\u72b6\u6001"}>
        <RecordActions key={records.selected??records.data?.active??"loading"} item={c} records={records} retired={retired} eventNumber={recordSession&&(records.selected??records.data?.active)!==recordSession?undefined:eventNumber}/>
        <PanelCard title={"\u7b5b\u67e5\u89c4\u5219"} icon="shield-check"><dl className="flex flex-col gap-md text-body-small"><div><dt className="text-muted-foreground">{"\u7ebf\u7d22\u7c7b\u578b"}</dt><dd>{kindNames[c.kind]}</dd></div><div><dt className="text-muted-foreground">{"\u76f8\u5bf9\u95e8\u69db"}</dt><dd>{"\u2265 " + policy.relativeBps / 100 + "%"}</dd></div><div><dt className="text-muted-foreground">{"\u7edd\u5bf9\u95e8\u69db"}</dt><dd>{"\u2265 " + quantity(verificationMinimum(policy,metric), metric) + " (" + verificationMinimum(policy,metric) + " " + rawUnit + ")"}</dd></div><div><dt className="text-muted-foreground">{"\u57fa\u7ebf"}</dt><dd>{"\u524d4\u5468\u540c\u661f\u671f\u540c\u65f6\u69fd\uff0c\u81f3\u5c113\u4e2a\u6709\u6548\u6837\u672c\u53d6\u4e2d\u4f4d\u6570"}</dd></div><div><dt className="text-muted-foreground">{"\u96f6\u91cf\u6761\u4ef6"}</dt><dd>{"\u8fde\u7eed\u22653\u4e2a\u6709\u6548\u5b8c\u6574\u5c0f\u65f6\uff0c\u9010\u7a97\u53c2\u8003\u4e3a\u6b63"}</dd></div></dl></PanelCard>
        <PanelCard title={"\u4f9d\u636e\u8ffd\u6eaf"} icon="file-text" className="min-w-0"><dl className="flex flex-col gap-md break-all text-body-small">{[
          ["\u6838\u9a8c\u7f16\u53f7", c.id], ["\u8bc1\u636e\u4fee\u8ba2", String(c.evidenceRevision)], ["\u6837\u4f8b\u6765\u6e90", c.source], ["\u89c4\u5219\u7248\u672c", c.policyVersion], ["\u57fa\u7ebf\u7248\u672c", c.baselineVersion], ["\u670d\u52a1\u5173\u7cfb", c.serviceRelation], ["\u6837\u4f8b\u6620\u5c04\u7248\u672c", c.mappingVersion], ["\u8bc1\u636e\u6458\u8981", c.evidenceDigest],
        ].map(([key, value]) => <div key={key}><dt className="text-muted-foreground">{key}</dt><dd>{value}</dd></div>)}</dl></PanelCard>
      </aside>
    </div>
  </div>;
}
