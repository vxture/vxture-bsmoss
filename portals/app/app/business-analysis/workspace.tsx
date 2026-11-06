"use client";
import SaveLocalReport from "../reports/save-local";
import CapacityPanel from './capacity-panel';
import RuntimePanel from './runtime-panel';

import { useState, useTransition } from "react";
import PageHeading from "../portal/page-heading";
import {InvestigationReturn,useInvestigationLinks} from '../portal/investigation';
import {relatedDossierHref,relatedReviewHref} from '../portal/investigation-targets';
import MetricRowsCard from "../portal/metric-rows-card";
import { useRouter } from "next/navigation";
import { ActionMenu, BarChart, Button, Collapsible, CollapsibleContent, CollapsibleTrigger, DataTable, EmptyState, Icon, InputGroup, InputGroupAddon, InputGroupInput, MetricGrid, NativeSelect, Pagination, PanelCard, Progress, SegmentedControl, ShellPageContainer, StatusBadge, TableTitleCell } from "@vxture/design-system";
import type { BusinessDemo } from "./model";
import { businessHref, businessMapHref, type BusinessScope } from "./links";
import { n, pct, operatorNames } from "../sites/labels";
import "./workspace.css";
const labels = { capacity: "\u5bb9\u91cf\u4e0e\u8d28\u91cf", efficiency: "\u8fd0\u884c\u4e0e\u80fd\u6548", "operator-usage": "\u8fd0\u8425\u5546\u7528\u91cf", "usage-reports": "\u7528\u91cf\u62a5\u544a" };
const descriptions = {"capacity":"\u5bb9\u91cf\u8d1f\u8f7d\u4e0e\u670d\u52a1\u8d28\u91cf\u7efc\u5408\u5206\u6790","efficiency":"\u4f9b\u7535\u73af\u5883\u4e0e\u7ad9\u5740\u80fd\u6548\u7efc\u5408\u5206\u6790","operator-usage":"\u8fd0\u8425\u5546\u4e1a\u52a1\u7528\u91cf\u4e0e\u670d\u52a1\u8d28\u91cf\u5206\u6790","usage-reports":"\u5468\u671f\u7528\u91cf\u6c47\u603b\u4e0e\u53ef\u6bd4\u53d8\u5316\u5206\u6790"};
const levels = { normal: "\u5e73\u7a33", warning: "\u5173\u6ce8", critical: "\u4e25\u91cd", unknown: "\u672a\u77e5" };
const metrics = [{ value: "bytes", label: "\u6d41\u91cf" }, { value: "voiceSeconds", label: "\u901a\u8bdd" }, { value: "sms", label: "\u77ed\u4fe1" }] as const;
const rules = {
 capacity: "\u4e25\u91cd\uff1a\u8d1f\u8f7d \u226595% \u6216\u63a5\u901a\u7387 <95%\uff1b\u5173\u6ce8\uff1a\u8d1f\u8f7d \u226585% \u6216\u63a5\u901a\u7387 <98%\u3002\u5206\u6bcd\u4e0d\u53ef\u7528\u4e14\u672a\u547d\u4e2d\u65f6\u6807\u8bb0\u672a\u77e5\u3002",
 power: "\u4e25\u91cd\uff1a\u5907\u7528\u4f9b\u7535\u8fd0\u884c\u6216\u673a\u623f\u6e29\u5ea6 \u226540\u00b0C\uff1b\u5173\u6ce8\uff1a\u6e29\u5ea6 \u226535\u00b0C\u3002\u4e0d\u63a8\u65ad\u7535\u6c60\u7eed\u822a\u3002",
 efficiency: "\u5355\u4f4d\u6d41\u91cf\u7535\u8017 = \u7269\u7406\u7ad9\u5740\u7535\u8017 \u00f7 \u53cc\u5411\u6d41\u91cf\u3002\u22650.30 kWh/GiB \u4e3a\u4e25\u91cd\uff0c\u22650.15 \u4e3a\u5173\u6ce8\u3002\u8fd0\u8425\u5546\u7535\u8017\u672a\u5206\u644a\u6216\u96f6\u6d41\u91cf\u65f6\u4e0d\u53ef\u8bc4\u4f30\u3002",
};
export default function BusinessWorkspace({ demo }: { demo: BusinessDemo }) {
 const router = useRouter(), [pending, start] = useTransition(), q = demo.scope;
 const [metric, setMetric] = useState<"bytes" | "voiceSeconds" | "sms">("bytes"), [search, setSearch] = useState(q.search);
 const [level, setLevel] = useState("all"), [page, setPage] = useState(1), [policy, setPolicy] = useState(false);
 const topicMode = demo.kind === "capacity" || demo.kind === "efficiency", u = demo.usage, t = demo.snapshot.topic;
 const {carry,keep}=useInvestigationLinks(businessHref(demo.kind,q));
 const navigate = (patch: Partial<BusinessScope>) => start(() => router.push(keep(businessHref(demo.kind, { ...q, ...patch })), { scroll: false }));
 const ratio = (value: number | null, label: string) => <div className="flex flex-col gap-xs"><span className="text-right text-body-small tabular-nums text-muted-foreground">{pct(value)}</span>{value !== null && <Progress value={value * 100} aria-label={label} />}</div>;
 const visible = demo.metricRows.filter(r => level === "all" || r.level === level), pages = Math.max(1, Math.ceil(visible.length / 20)), current = Math.min(page, pages);
 const unit = metric === "bytes" ? "GiB" : metric === "voiceSeconds" ? "\u5c0f\u65f6" : "\u6761";
 const scale = metric === "bytes" ? 1073741824 : metric === "voiceSeconds" ? 3600 : 1;
 const trend = u ? u.trend.map(p => ({ key: p.key, label: p.label, value: p[metric] / scale })) : demo.trend;
 const comparison = demo.report?.comparison;
 return <div data-business-analysis={demo.kind} aria-busy={pending}><ShellPageContainer className="product-page-inset business-analysis max-w-none gap-lg">
   <InvestigationReturn source="snapshot"/><PageHeading title={labels[demo.kind]} description={descriptions[demo.kind]}
     secondary={q.selection ? <StatusBadge tone="info" size="sm">{"\u5730\u56fe\u9009\u533a"}</StatusBadge> : undefined}

     dataUpdate={demo.dataUpdate}
     actions={<>
       <Button asChild variant="outline"><a target="_blank" rel="noopener noreferrer" href={carry(businessMapHref(demo.kind, q))}><Icon name="map-pin" size="sm" />{"\u5730\u56fe\u5206\u6790"}</a></Button>
       <Button asChild variant="outline"><a href={carry(relatedReviewHref(q,q.period))}>{"\u6838\u9a8c\u7ebf\u7d22"}</a></Button>
       {demo.report&&<SaveLocalReport endpoint={"/api/product-preview/report-artifact?kind=calendar&"+businessHref('usage-reports',q).split('?')[1]+'&snapshot='+demo.report.digest} origin={businessHref(demo.kind,q)}/>}
       {demo.report && <Button asChild><a href={demo.report.downloadHref} download><Icon name="file-text" size="sm" />{"\u5bfc\u51faHTML\u62a5\u544a"}</a></Button>}</>}
     toolbar={<form role="search" aria-label={labels[demo.kind] + "\u7b5b\u9009"} className="business-analysis-tools flex flex-wrap items-center gap-md py-sm" onSubmit={e => { e.preventDefault(); navigate({ search }); }}>
     <span className="text-body-small text-muted-foreground">{topicMode || q.period === "hour" ? "\u5206\u6790\u65e5\u671f " + demo.date : "\u5206\u6790\u533a\u95f4 " + demo.window}</span>
     <NativeSelect aria-label={"\u5206\u6790\u8fd0\u8425\u5546"} wrapperClassName="w-auto" value={q.operator} onChange={e => navigate({ operator: e.target.value as BusinessScope["operator"] })}>{Object.entries(operatorNames).map(([code, name]) => <option key={code} value={code}>{name}</option>)}</NativeSelect>
     {topicMode || q.period === "hour" ? <NativeSelect aria-label={"\u5206\u6790\u65f6\u6bb5"} wrapperClassName="w-auto" value={q.hour} onChange={e => navigate({ hour: Number(e.target.value) })}>{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, "0") + ":00"}</option>)}</NativeSelect> : null}
     {!topicMode && <SegmentedControl ariaLabel={"\u5206\u6790\u5468\u671f"} value={q.period} onChange={period => navigate({ period })} items={[...(demo.kind === "operator-usage" ? [{ value: "hour" as const, label: "\u65f6" }] : []), { value: "day", label: "\u65e5" }, { value: "week", label: "\u5468" }, { value: "month", label: "\u6708" }]} />}
     {demo.kind === "efficiency" && <SegmentedControl ariaLabel={"\u8fd0\u884c\u4e13\u9898"} value={q.topic} onChange={topic => navigate({ topic })} items={[{ value: "efficiency", label: "\u80fd\u6548\u89c2\u5bdf", icon: "lightning" }, { value: "power", label: "\u4f9b\u7535\u4fdd\u969c", icon: "gauge" }]} />}
     <div className="business-analysis-search ml-auto"><InputGroup><InputGroupAddon><Button type="submit" variant="ghost" size="icon-sm" aria-label={"\u67e5\u8be2\u5206\u6790"}><Icon name="search" size="sm" /></Button></InputGroupAddon><InputGroupInput aria-label={"\u5206\u6790\u7ad9\u5740\u68c0\u7d22"} placeholder={"\u7ad9\u540d / \u7f16\u7801"} value={search} onChange={e => setSearch(e.target.value)} /></InputGroup></div>
     {q.selection && <Button variant="ghost" onClick={() => navigate({ selection: undefined })}>{"\u6e05\u9664\u9009\u533a"}</Button>}
   </form>} />
   {topicMode && t ? <>
     <div className="sm:hidden"><MetricRowsCard title={"\u4e13\u9898\u6982\u51b5"} icon="gauge" metrics={[{ key: "total", label: "\u89c2\u5bdf\u7ad9\u5740", value: n(t.counts.total) }, { key: "critical", label: "\u4e25\u91cd", value: n(t.counts.critical) }, { key: "warning", label: "\u5173\u6ce8", value: n(t.counts.warning) }, { key: "unknown", label: "\u4e0d\u53ef\u8bc4\u4f30", value: n(t.counts.unknown) }]} /></div><div className="hidden sm:block"><MetricGrid columns={4} aria-label={"\u4e13\u9898\u72b6\u6001\u6982\u51b5"} items={[
       { id: "total", label: "\u89c2\u5bdf\u7ad9\u5740", value: n(t.counts.total), description: "\u5ea7", icon: "building" },
       { id: "critical", label: "\u4e25\u91cd", value: n(t.counts.critical), description: "\u5ea7", tone: "danger", icon: "flag" },
       { id: "warning", label: "\u5173\u6ce8", value: n(t.counts.warning), description: "\u5ea7", tone: "warning", icon: "gauge" },
       { id: "unknown", label: "\u4e0d\u53ef\u8bc4\u4f30", value: n(t.counts.unknown), description: "\u5ea7", icon: "search" },
     ]} /></div>
     {q.topic === "efficiency" && q.operator !== "all" && <PanelCard title={"\u8fd0\u8425\u5546\u7535\u8017\u672a\u5206\u644a"} icon="lightning"><p className="text-body text-muted-foreground">{"\u5f53\u524d\u670d\u52a1\u5173\u7cfb\u6ca1\u6709\u72ec\u7acb\u7535\u8017\uff0c\u80fd\u6548\u6307\u6807\u663e\u793a\u672a\u77e5\u3002"}</p><Button variant="secondary" onClick={() => navigate({ operator: "all" })}>{"\u67e5\u770b\u7269\u7406\u7ad9\u5740\u53e3\u5f84"}</Button></PanelCard>}
     {demo.capacity?<CapacityPanel data={demo.capacity} q={q} region={demo.region} pending={pending} navigate={navigate}/>:demo.runtime?<RuntimePanel data={demo.runtime} q={q} region={demo.region} pending={pending} navigate={navigate}/>:<div className="grid min-w-0 gap-md xl:grid-cols-3">
       <PanelCard title={"24\u5c0f\u65f6\u5173\u6ce8\u7ad9\u6570"} icon="chart-bar" description={"\u6309\u6bcf\u4e2a\u5c0f\u65f6\u72ec\u7acb\u5224\u5b9a \u00b7 \u4e25\u91cd\uff0b\u5173\u6ce8"} className="min-w-0 xl:col-span-2"><BarChart data={trend} labelEvery={4} formatValue={v => n(v)} peakLabel={"\u5cf0\u503c"} aria-label={"\u4e13\u989824\u5c0f\u65f6\u5173\u6ce8\u8d8b\u52bf"} /></PanelCard>
       <PanelCard title={"\u533a\u57df\u5bf9\u6bd4"} icon="city" description={"\u4e25\u91cd\uff0b\u5173\u6ce8 / \u89c2\u5bdf\u7ad9\u5740"} className="min-w-0"><div className="grid grid-cols-1 gap-sm sm:grid-cols-2">{t.cities.map(c => <Button key={c.cityId} variant="ghost" className="justify-between gap-xs" onClick={() => navigate({ cityId: c.cityId, countyId: "all", selection: q.selection })}><span>{demo.region.cities.find(item => item.id === c.cityId)?.name}</span><span className="text-body-small tabular-nums text-muted-foreground">{n(c.critical + c.warning) + " / " + n(c.total)}</span></Button>)}{!t.cities.length && <EmptyState title={"\u5f53\u524d\u8303\u56f4\u6682\u65e0\u7ad9\u5740"} />}</div></PanelCard>
     </div>}
     <Collapsible open={policy} onOpenChange={setPolicy}><CollapsibleTrigger asChild><Button variant="ghost"><Icon name="shield-check" size="sm" />{"\u5224\u5b9a\u53e3\u5f84"}<Icon name={policy ? "chevron-up" : "chevron-down"} size="sm" /></Button></CollapsibleTrigger><CollapsibleContent><p className="py-md text-body-small text-muted-foreground">{rules[q.topic] + " \u4ec5\u63d0\u4f9b\u6838\u9a8c\u7ebf\u7d22\u3002"}</p></CollapsibleContent></Collapsible>
     <PanelCard title={"\u7ad9\u5740\u5206\u6790\u660e\u7ec6"} icon="building" description={"\u4e25\u91cd\u4f18\u5148 \u00b7 \u540c\u7ea7\u6309\u4e13\u9898\u6307\u6807\u964d\u5e8f"} className="min-w-0" action={<NativeSelect aria-label={"\u4e13\u9898\u72b6\u6001\u7b5b\u9009"} wrapperClassName="w-auto" value={level} onChange={e => { setLevel(e.target.value); setPage(1); }}><option value="all">{"\u5168\u90e8\u72b6\u6001"}</option>{Object.entries(levels).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</NativeSelect>}>
       <DataTable rows={visible.slice((current - 1) * 20, current * 20)} rowKey={r => r.id} indexStart={(current - 1) * 20 + 1} labels={{ rowActions: "\u64cd\u4f5c" }} columns={[
         { id: "site", header: "\u7ad9\u5740", cell: r => <TableTitleCell title={r.name} description={r.id} icon="building" onTitleClick={() => router.push(carry(relatedDossierHref(r.id,q,q.period,"runtime")))} /> },
         { id: "region", header: "\u533a\u57df", cell: r => <TableTitleCell title={r.city} description={r.county} layout="stacked" /> },
         { id: "level", header: "\u4e13\u9898\u72b6\u6001", cell: r => <StatusBadge size="sm" tone={r.level === "critical" ? "danger" : r.level === "warning" ? "warning" : r.level === "normal" ? "success" : "neutral"}>{levels[r.level]}</StatusBadge> },
         ...(q.topic === "capacity" ? [
           { id: "load", header: "\u8d1f\u8f7d\u7387", cell: (r: BusinessDemo["metricRows"][number]) => ratio(r.load, r.name + "\u8d1f\u8f7d\u7387") },
           { id: "connection", header: "\u63a5\u901a\u7387", cell: (r: BusinessDemo["metricRows"][number]) => ratio(r.connection, r.name + "\u63a5\u901a\u7387") },
         ] : q.topic === "power" ? [
           { id: "power", header: "\u4f9b\u7535\u65b9\u5f0f", cell: (r: BusinessDemo["metricRows"][number]) => r.power === "battery" ? "\u5907\u7528\u7535\u6e90" : "\u5e02\u7535" },
           { id: "temperature", header: "\u673a\u623f\u6e29\u5ea6 / \u00b0C", cell: (r: BusinessDemo["metricRows"][number]) => n(r.temperature, 1) },
         ] : [
           { id: "energy", header: "\u7535\u8017 / kWh", cell: (r: BusinessDemo["metricRows"][number]) => r.energyKWh === null ? "\u2014" : n(r.energyKWh, 2) },
           { id: "efficiency", header: "kWh/GiB", cell: (r: BusinessDemo["metricRows"][number]) => r.value === null ? "\u2014" : n(r.value, 3) },
         ]),
       ]} rowActions={r => <ActionMenu label={"\u5206\u6790\u64cd\u4f5c\uff1a" + r.name} items={[{ id: "detail", label: "\u7ad9\u5740\u6863\u6848", icon: "building", onSelect: () => router.push(carry(relatedDossierHref(r.id,q,q.period,"runtime"))) }, { id: "map", label: "\u5730\u56fe\u5b9a\u4f4d", icon: "map-pin", onSelect: () => window.open(carry(businessMapHref(demo.kind, q, r.id)), "_blank", "noopener,noreferrer") }]} />} empty={<EmptyState title={"\u6682\u65e0\u5339\u914d\u7ad9\u5740"} />} />
       <Pagination aria-label={"\u5206\u6790\u660e\u7ec6\u5206\u9875"} className="business-analysis-pagination pt-lg" page={current} pageCount={pages} countLabel={n(visible.length) + " \u5ea7\u7ad9\u5740"} onPageChange={setPage} firstLabel={"\u9996\u9875"} previousLabel={"\u4e0a\u4e00\u9875"} nextLabel={"\u4e0b\u4e00\u9875"} lastLabel={"\u672b\u9875"} />
     </PanelCard>
   </> : u ? <>
     <div className="sm:hidden"><MetricRowsCard title={"\u7528\u91cf\u6982\u51b5"} icon="chart-bar" metrics={[{ key: "sites", label: "\u7269\u7406\u7ad9\u5740", value: n(u.physicalSites) }, { key: "bytes", label: "\u6d41\u91cf / GiB", value: n(Number(u.totals.bytes) / 1073741824, 2) }, { key: "voice", label: "\u901a\u8bdd / \u5c0f\u65f6", value: n(u.totals.voiceSeconds / 3600, 2) }, { key: "sms", label: "\u77ed\u4fe1 / \u6761", value: n(u.totals.sms) }]} /></div><div className="hidden sm:block"><MetricGrid columns={4} aria-label={"\u7ecf\u8425\u7528\u91cf\u6982\u51b5"} items={[
       { id: "sites", label: "\u7269\u7406\u7ad9\u5740", value: n(u.physicalSites), description: n(u.serviceRelations) + " \u6761\u670d\u52a1\u5173\u7cfb", icon: "building" },
       { id: "bytes", label: "\u53cc\u5411\u6d41\u91cf / GiB", value: n(Number(u.totals.bytes) / 1073741824, 2), icon: "chart-bar" },
       { id: "voice", label: "\u901a\u8bdd / \u5c0f\u65f6", value: n(u.totals.voiceSeconds / 3600, 2), icon: "users" },
       { id: "sms", label: "\u77ed\u4fe1 / \u6761", value: n(u.totals.sms), icon: "file-text" },
     ]} /></div>
     <PanelCard title={"\u7528\u91cf\u8d8b\u52bf"} icon="chart-line-up" description={(q.period === "hour" ? demo.date + " \u00b7 24\u5c0f\u65f6" : demo.window) + " \u00b7 " + unit} className="min-w-0"><div className="flex justify-end pb-md"><SegmentedControl ariaLabel={"\u7528\u91cf\u6307\u6807"} value={metric} onChange={setMetric} items={metrics} /></div><BarChart data={trend} labelEvery={q.period === "month" ? 5 : 3} formatValue={v => n(v, 2)} peakLabel={"\u5cf0\u503c"} aria-label={"\u7ecf\u8425\u7528\u91cf\u8d8b\u52bf"} /></PanelCard>
     <PanelCard title={"\u8fd0\u8425\u5546\u7528\u91cf\u4e0e\u670d\u52a1\u8d28\u91cf"} icon="users" description={"\u6309\u8fd0\u8425\u5546\u72ec\u7acb\u7edf\u8ba1 \u00b7 \u5171\u4eab\u7269\u7406\u7ad9\u5740\u53bb\u91cd"} className="min-w-0"><DataTable rows={u.rows} rowKey={r => r.code} columns={[
       { id: "operator", header: "\u8fd0\u8425\u5546", cell: r => operatorNames[r.code] }, { id: "sites", header: "\u670d\u52a1\u7ad9\u5740", cell: r => n(r.sites) },
       { id: "bytes", header: "\u6d41\u91cf / GiB", cell: r => n(Number(r.bytes) / 1073741824, 2) }, { id: "voice", header: "\u901a\u8bdd / \u5c0f\u65f6", cell: r => n(r.voiceSeconds / 3600, 2) },
       { id: "sms", header: "\u77ed\u4fe1 / \u6761", cell: r => n(r.sms) }, { id: "connection", header: "\u63a5\u901a\u7387", cell: r => ratio(r.connectionRate, operatorNames[r.code] + "\u63a5\u901a\u7387") }, { id: "load", header: "\u8d1f\u8f7d\u7387", cell: r => ratio(r.load, operatorNames[r.code] + "\u8d1f\u8f7d\u7387") },
     ]} empty={<EmptyState title={"\u5f53\u524d\u8303\u56f4\u6682\u65e0\u670d\u52a1\u5173\u7cfb"} />} /></PanelCard>
     {comparison && <PanelCard title={"\u5468\u671f\u73af\u6bd4"} icon="chart-line-up" description={"\u5bf9\u6bd4\u671f\uff1a" + comparison.previous.window.start.slice(0, 10) + " \u00b7 " + comparison.previous.days + " \u5929"}>
       <DataTable rows={metrics.map(m => ({ ...m, change: comparison.metrics[m.value] }))} rowKey={r => r.value} columns={[
         { id: "metric", header: "\u6307\u6807", cell: r => r.label },
         { id: "current", header: "\u672c\u671f\u603b\u91cf", cell: r => n(Number(r.change.current) / (r.value === "bytes" ? 1073741824 : r.value === "voiceSeconds" ? 3600 : 1), 2) + (r.value === "bytes" ? " GiB" : r.value === "voiceSeconds" ? " \u5c0f\u65f6" : " \u6761") },
         { id: "previous", header: "\u4e0a\u671f\u603b\u91cf", cell: r => n(Number(r.change.previous) / (r.value === "bytes" ? 1073741824 : r.value === "voiceSeconds" ? 3600 : 1), 2) },
         { id: "rate", header: "\u603b\u91cf\u73af\u6bd4", cell: r => pct(r.change.rate) },
         { id: "daily", header: "\u65e5\u5747\u73af\u6bd4", cell: r => pct(r.change.dailyRate) },
       ]} />
       <p className="pt-sm text-body-small text-muted-foreground">{comparison.comparable ? "\u540c\u8303\u56f4\u540c\u7ad9\u7fa4\u6bd4\u8f83\uff1b\u96f6\u57fa\u6570\u4e0d\u8ba1\u767e\u5206\u6bd4\uff0c\u5929\u6570\u4e0d\u540c\u65f6\u7ed3\u5408\u65e5\u5747\u73af\u6bd4\u3002" : "\u5f53\u524d\u8303\u56f4\u4e0d\u5177\u5907\u53ef\u6bd4\u6761\u4ef6\uff0c\u4e0d\u8ba1\u7b97\u73af\u6bd4\u3002"}</p>
     </PanelCard>}
     {demo.report && <div className="grid min-w-0 gap-md xl:grid-cols-2"><PanelCard title={"\u62a5\u544a\u8ffd\u6eaf"} icon="file-text"><div className="flex flex-col gap-md break-words text-body-small"><span>{"\u62a5\u544a\u7f16\u53f7\uff1a" + demo.report.id}</span><span>{"\u6a21\u677f\u7248\u672c\uff1a" + demo.report.templateVersion}</span><span>{"\u6837\u672c\u6570\uff1a" + n(demo.report.runtime.samples)}</span><span>{"\u7269\u7406\u7535\u8017\uff1a" + (u.energyWh === null ? "\u672a\u5206\u644a" : n(u.energyWh / 1000, 2) + " kWh")}</span><StatusBadge tone="warning" size="sm">{"\u8349\u7a3f \u00b7 \u5f85\u590d\u6838"}</StatusBadge></div></PanelCard>
       <PanelCard title={"\u9ad8\u7528\u91cf\u7ad9\u5740"} icon="building" className="min-w-0"><DataTable rows={demo.report.ranking} rowKey={r => r.id} columns={[{ id: "site", header: "\u7ad9\u5740", cell: r => <Button asChild variant="link"><a href={carry(relatedDossierHref(r.id,q,q.period))}>{r.name}</a></Button> }, { id: "bytes", header: "\u6d41\u91cf / GiB", cell: r => n(Number(r.bytes) / 1073741824, 2) }]} /></PanelCard></div>}
     <div className="flex flex-wrap justify-end gap-sm"><Button asChild variant="secondary"><a href={keep(businessHref(demo.kind === "usage-reports" ? "operator-usage" : "usage-reports", q))}><Icon name={demo.kind === "usage-reports" ? "chart-line-up" : "file-text"} size="sm" />{demo.kind === "usage-reports" ? "\u67e5\u770b\u7528\u91cf\u5206\u6790" : "\u67e5\u770b\u5468\u671f\u62a5\u544a"}</a></Button></div>
   </> : null}
 </ShellPageContainer></div>;
}
