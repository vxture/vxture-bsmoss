"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BarChart, Button, DataTable, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
  EmptyState, MetricListCard, PanelCard, Progress, SegmentedControl, StatusBadge } from "@vxture/design-system";
import { businessHref, type BusinessScope } from "../business-analysis/links";
import { DEFAULT_SITE_QUERY, siteDetailHref } from "../domains/site-registry/rules";
import { reviewHref } from "../domains/usage-verification/links";
import { deviation, kindNames, metricNames, quantity, timeLabel, windowLabel } from "../usage-review/labels";
import { calendarLabel, type ReportPeriod } from "../domains/map-demo/period-rules";
import type { TopicKind } from "../domains/map-demo/types";
import type { Trigger } from "./overview-rules";
import type { PortalDemo } from "./demo";

const n = (v: number, digits = 0) => v.toLocaleString("zh-CN", { maximumFractionDigits: digits });
const metricLabel = (label: string) => <span className="block whitespace-normal">{label}</span>;
const pct = (v: number | null) => v === null ? "\u2014" : n(v * 100, 1) + "%";
const topics = { capacity: "\u5bb9\u91cf\u8d28\u91cf", power: "\u4f9b\u7535\u73af\u5883", efficiency: "\u8fd0\u884c\u80fd\u6548" };
const triggerNames: Record<Trigger, string> = { load: "\u8d1f\u8f7d\u504f\u9ad8", connection: "\u63a5\u901a\u8d28\u91cf\u504f\u4f4e", battery: "\u5907\u7528\u4f9b\u7535\u8fd0\u884c", temperature: "\u673a\u623f\u6e29\u5ea6\u504f\u9ad8", intensity: "\u5355\u4f4d\u6d41\u91cf\u7535\u8017\u504f\u9ad8" };
const operators: Record<string, string> = { mobile: "\u79fb\u52a8", telecom: "\u7535\u4fe1", unicom: "\u8054\u901a", broadcast: "\u5e7f\u7535", other: "\u5176\u4ed6" };
const policy = {
  capacity: "\u4e25\u91cd\uff1a\u8d1f\u8f7d\u226595%\u6216\u63a5\u901a\u7387<95%\uff1b\u5173\u6ce8\uff1a\u8d1f\u8f7d\u226585%\u6216\u63a5\u901a\u7387<98%\u3002\u7f3a\u5c11\u5fc5\u8981\u5206\u6bcd\u65f6\u663e\u793a\u4e0d\u53ef\u8bc4\u4f30\u3002",
  power: "\u4e25\u91cd\uff1a\u5907\u7528\u4f9b\u7535\u8fd0\u884c\u6216\u6e29\u5ea6\u226540\u00b0C\uff1b\u5173\u6ce8\uff1a\u6e29\u5ea6\u226535\u00b0C\u3002\u5907\u7528\u4f9b\u7535\u72b6\u6001\u4e0d\u4ee3\u8868\u7535\u6c60\u6545\u969c\u3002",
  efficiency: "\u5355\u4f4d\u6d41\u91cf\u7535\u8017=\u7269\u7406\u7535\u8017\u00f7\u53cc\u5411\u6d41\u91cf\uff1b\u22650.30 kWh/GiB\u4e3a\u4e25\u91cd\uff0c\u22650.15\u4e3a\u5173\u6ce8\u3002\u96f6\u6d41\u91cf\u6216\u7535\u8017\u672a\u77e5\u65f6\u4e0d\u53ef\u8bc4\u4f30\u3002",
};
type Signal = PortalDemo["signals"][number]["rows"][number];
function scopeOf(demo: PortalDemo): BusinessScope { return { ...demo.query, period: "day", topic: "capacity" }; }
function issueMetric(row: Signal) {
  return row.topic === "capacity" ? "\u63a5\u901a " + pct(row.connection) + " \u00b7 \u8d1f\u8f7d " + pct(row.load) :
    row.topic === "power" ? n(row.temperature, 1) + "\u00b0C \u00b7 " + (row.power === "battery" ? "\u5907\u7528\u4f9b\u7535" : "\u5e02\u7535") :
      (row.value === null ? "\u2014" : n(row.value, 3) + " kWh/GiB");
}
function signalSeries(row: Signal, secondary = false) {
  return row.series.filter(s => (secondary ? s.secondary : s.value) !== null).map(s => ({
    key: String(s.hour), label: String(s.hour).padStart(2, "0"), value: (secondary ? s.secondary : s.value)!,
  }));
}

export function OverviewAttention({ demo }: { demo: PortalDemo }) {
  const [topic, setTopic] = useState<TopicKind>("capacity"), [selected, setSelected] = useState<string | null>(null);
  const [evidenceMetric, setEvidenceMetric] = useState<"connection" | "load">("connection");
  const group = demo.signals.find(group => group.topic === topic)!;
  const item = demo.signals.flatMap(group => group.rows).find(row => row.id === selected);
  const q = { ...DEFAULT_SITE_QUERY, city: demo.query.cityId, county: demo.query.countyId, hour: demo.hour };
  const scope = { ...scopeOf(demo), topic };
  const href = businessHref(topic === "capacity" ? "capacity" : "efficiency", scope);
  return <section id="overview-attention" className="scroll-mt-lg" data-overview-attention={topic}>
    <PanelCard title={"\u91cd\u70b9\u5173\u6ce8"} icon="flag" tone="warning"
      description={String(demo.hour).padStart(2, "0") + ":00 \u00b7 \u5404\u4e13\u9898\u72ec\u7acb\u5224\u5b9a\uff0c\u540c\u7ad9\u53ef\u547d\u4e2d\u591a\u4e2a\u4e13\u9898"}
      action={<Button asChild variant="ghost" size="sm"><a href={href}>{"\u8fdb\u5165\u4e13\u9898\u5206\u6790"}</a></Button>}>
      <div className="flex flex-wrap items-center justify-between gap-md pb-md">
        <SegmentedControl ariaLabel={"\u91cd\u70b9\u5173\u6ce8\u4e13\u9898"} value={topic} onChange={setTopic} items={demo.signals.map(group => ({
          value: group.topic, label: topics[group.topic] + " " + n(group.counts.critical + group.counts.warning),
        }))} />
        <div className="flex flex-wrap items-center gap-sm text-body-small text-muted-foreground">
          <StatusBadge tone="danger" size="sm">{"\u4e25\u91cd " + n(group.counts.critical)}</StatusBadge>
          <StatusBadge tone="warning" size="sm">{"\u5173\u6ce8 " + n(group.counts.warning)}</StatusBadge>
          <span>{"\u4e0d\u53ef\u8bc4\u4f30 " + n(group.counts.unknown)}</span>
        </div>
      </div>
      <DataTable rows={group.rows} rowKey={row => row.id} columns={[
        { id: "site", header: "\u7ad9\u5740", cell: row => <div className="flex flex-col gap-xs"><a className="text-foreground hover:text-primary-text" href={siteDetailHref(row.site.id, q, { tab: "runtime" })}>{row.site.name}</a><span className="text-body-small text-muted-foreground">{demo.region.cities.find(c => c.id === row.site.cityId)?.name + " \u00b7 " + demo.region.counties.find(c => c.id === row.site.countyId)?.name}</span></div> },
        { id: "reason", header: "\u89e6\u53d1\u4e8b\u9879", cell: row => <div className="flex flex-col gap-xs"><span>{row.triggers.map(t => triggerNames[t]).join("\u3001")}</span><span className="text-body-small text-muted-foreground">{issueMetric(row)}</span></div> },
        { id: "level", header: "\u7b49\u7ea7", cell: row => <StatusBadge tone={row.level === "critical" ? "danger" : "warning"} size="sm">{row.level === "critical" ? "\u4e25\u91cd" : "\u5173\u6ce8"}</StatusBadge> },
        { id: "duration", header: "\u8fde\u7eed\u547d\u4e2d", cell: row => n(row.streak) + " \u5c0f\u65f6" },
        { id: "evidence", header: "\u4f9d\u636e", cell: row => <Button size="sm" variant="ghost" aria-label={row.site.name + "\u67e5\u770b\u4f9d\u636e"} onClick={() => setSelected(row.id)}>{"\u67e5\u770b\u4f9d\u636e"}</Button> },
      ]} empty={<EmptyState title={"\u5f53\u524d\u8303\u56f4\u6682\u65e0\u4e13\u9898\u5173\u6ce8\u4e8b\u9879"} description={"\u6b63\u5e38\u4e0e\u4e0d\u53ef\u8bc4\u4f30\u5206\u522b\u7edf\u8ba1\uff0c\u4e0d\u751f\u6210\u5f02\u5e38\u5360\u4f4d\u3002"} />} />
      <p className="pt-sm text-body-small text-muted-foreground">{"\u4e25\u91cd\u4f18\u5148 \u00b7 \u5c55\u793a\u524d5\u5ea7 \u00b7 \u8fde\u7eed\u65f6\u957f\u622a\u81f3\u5f53\u524d\u72b6\u6001\u65f6\u70b9"}</p>
    </PanelCard>
    <Dialog open={Boolean(item)} onOpenChange={open => { if (!open) setSelected(null); }}>
      <DialogContent width="xl" className="grid-cols-1 w-[calc(100dvw-var(--space-xl))] max-h-[calc(100dvh-var(--space-xl))] overflow-y-auto">
        {item && <>
          <DialogHeader><DialogTitle>{item.site.name + " \u00b7 " + topics[item.topic] + "\u4f9d\u636e"}</DialogTitle>
            <DialogDescription>{demo.date + " " + String(demo.hour).padStart(2, "0") + ":00 \u00b7 " + item.triggers.map(t => triggerNames[t]).join("\u3001")}</DialogDescription></DialogHeader>
          <MetricListCard title={"\u89e6\u53d1\u8bc1\u636e"} tone={item.level === "critical" ? "danger" : "warning"} metrics={[
            { key: "load", label: metricLabel("\u8d1f\u8f7d\u7387"), value: pct(item.load) },
            { key: "connection", label: metricLabel("\u63a5\u901a\u7387"), value: pct(item.connection) },
            { key: "temperature", label: metricLabel("\u6e29\u5ea6 / \u00b0C"), value: n(item.temperature, 1) },
            { key: "energy", label: metricLabel("\u65f6\u6bb5\u7535\u8017 / kWh"), value: item.energyKWh === null ? "\u2014" : n(item.energyKWh, 2) },
          ]} />
          <p className="text-body-small text-muted-foreground">{policy[item.topic]}</p>
          <div className="min-w-0">
            <PanelCard className="min-w-0" title={item.topic === "capacity" ? (evidenceMetric === "connection" ? "\u63a5\u901a\u7387 / %" : "\u8d44\u6e90\u8d1f\u8f7d / %") : item.topic === "power" ? "\u673a\u623f\u6e29\u5ea6 / \u00b0C" : "\u5355\u4f4d\u6d41\u91cf\u7535\u8017 / kWh/GiB"} tone="neutral"
              action={item.topic === "capacity" ? <SegmentedControl size="sm" ariaLabel={"\u8bc1\u636e\u8d8b\u52bf\u6307\u6807"} value={evidenceMetric} onChange={setEvidenceMetric} items={[
                { value: "connection", label: "\u63a5\u901a\u7387" }, { value: "load", label: "\u8d1f\u8f7d" },
              ]} /> : undefined}>
              <BarChart data={signalSeries(item, item.topic === "power" || (item.topic === "capacity" && evidenceMetric === "connection"))}
                formatValue={v => n(v, item.topic === "efficiency" ? 3 : 1)} labelEvery={3} aria-label={"\u622a\u81f3\u72b6\u6001\u65f6\u70b9\u7684\u8bc1\u636e\u8d8b\u52bf"} />
            </PanelCard>
          </div>
          <PanelCard className="min-w-0" title={"\u5f53\u524d\u65f6\u6bb5\u8fd0\u8425\u5546\u670d\u52a1\u7ed3\u6784"} description={"\u7269\u7406\u7535\u8017\u4e0d\u5206\u644a\u8fd0\u8425\u5546"} tone="neutral">
            <DataTable rows={item.operators} rowKey={row => row.code} columns={[
              { id: "operator", header: "\u8fd0\u8425\u5546", cell: row => <a href={businessHref("operator-usage", { ...scopeOf(demo), operator: row.code, search: item.site.id, period: "hour" })}>{operators[row.code]}</a> },
              { id: "flow", header: "\u6d41\u91cf / GiB", align: "numeric", cell: row => n(row.bytes / 1073741824, 2) },
              { id: "share", header: "\u6d41\u91cf\u5360\u6bd4", cell: row => <div className="flex flex-col gap-xs"><span className="text-body-small text-muted-foreground">{pct(row.share)}</span>{row.share !== null && <Progress value={row.share * 100} aria-label={operators[row.code] + "\u6d41\u91cf\u5360\u6bd4"} />}</div> },
              { id: "load", header: "\u8d1f\u8f7d", align: "numeric", cell: row => pct(row.load) },
              { id: "quality", header: "\u63a5\u901a\u7387", align: "numeric", cell: row => pct(row.connection) },
            ]} />
          </PanelCard>
          <div className="flex flex-wrap items-center justify-between gap-md">
            <span className="text-body-small text-muted-foreground">{"\u8fde\u7eed " + n(item.streak) + " \u5c0f\u65f6\u547d\u4e2d\uff1b\u539f\u56e0\u4ecd\u9700\u7ed3\u5408\u7ad9\u5740\u4e0e\u6765\u6e90\u6838\u5b9e\u3002"}</span>
            <Button asChild><a href={siteDetailHref(item.site.id, q, { tab: "runtime" })}>{"\u6253\u5f00\u8fd0\u884c\u6863\u6848"}</a></Button>
          </div>
          <details className="text-body-small text-muted-foreground"><summary className="cursor-pointer">{"\u89c4\u5219\u4e0e\u6570\u636e\u7248\u672c"}</summary>
            <div className="flex flex-col gap-xs break-all pt-sm"><span>{item.sourceVersion}</span><span>{item.policyVersion}</span><span>{item.evidenceKey}</span></div>
          </details>
        </>}
      </DialogContent>
    </Dialog>
  </section>;
}

export function OverviewVerification({ demo }: { demo: PortalDemo }) {
  const v = demo.verification;
  return <PanelCard className="min-w-0" title={"\u7528\u91cf\u6838\u9a8c"} icon="search" tone="info" description={calendarLabel("day") + " \u00b7 " + n(v.sites) + "\u5ea7\u7ad9\u5740 \u00b7 " + n(v.total) + "\u6761\u7ebf\u7d22"}
    action={<Button asChild variant="ghost" size="sm"><a href={reviewHref(v.query)}>{"\u5168\u90e8\u7ebf\u7d22"}</a></Button>}>
    <MetricListCard title={"\u5f85\u6838\u9a8c"} metrics={[
      { key: "business", label: metricLabel("\u4e1a\u52a1\u6ce2\u52a8"), value: <a href={reviewHref({ ...v.query, category: "business" })}>{n(v.counts.business)}</a> },
      { key: "quality", label: metricLabel("\u6570\u636e\u8d28\u91cf"), value: <a href={reviewHref({ ...v.query, category: "quality" })}>{n(v.counts.quality)}</a> },
      { key: "insufficient", label: metricLabel("\u6761\u4ef6\u4e0d\u8db3"), value: <a href={reviewHref({ ...v.query, category: "insufficient" })}>{n(v.counts.insufficient)}</a> },
    ]} />
    <div className="flex flex-col divide-y divide-border pt-md" data-overview-verification>
      {v.total > 0 && v.kinds.map(k => <div key={k.kind} className="flex flex-wrap items-start justify-between gap-sm py-md">
        <div className="flex min-w-0 flex-col gap-xs">
          <span className="text-label">{kindNames[k.kind] + " \u00b7 " + n(k.count)}</span>
          {k.sample && <><a className="text-body-small text-foreground hover:text-primary-text" href={k.sample.href}>{k.sample.site.name + " \u00b7 " + operators[k.sample.operator] + " \u00b7 " + metricNames[k.sample.metric]}</a>
            <span className="text-body-small text-muted-foreground">{k.kind === "insufficient" ? "\u6709\u6548\u53c2\u8003 " + k.sample.validReferences + "/4\uff0c\u6682\u4e0d\u5224\u5b9a\u6ce2\u52a8" :
              k.kind === "missing" ? "\u6570\u636e\u7f3a\u5931\u6216\u672a\u901a\u8fc7\u8d28\u91cf\u6838\u9a8c\uff0c\u4e0d\u8ba1\u4e3a\u96f6\u91cf" :
                k.kind === "zero_run" ? "\u8fde\u7eed3\u5c0f\u65f6\u6709\u6548\u96f6\u91cf \u00b7 \u5386\u53f2\u53c2\u8003\u4e3a\u6b63" :
                  k.kind === "from_zero" ? "\u5f53\u524d " + quantity(k.sample.current, k.sample.metric) + " \u00b7 \u5386\u53f2\u53c2\u8003\u4e3a\u96f6" :
                  "\u5f53\u524d " + quantity(k.sample.current, k.sample.metric) + " \u00b7 \u8f83\u53c2\u8003 " + deviation(k.sample.current, k.sample.referenceNumerator)}</span>
          </>}
        </div>
        {k.sample && <span className="text-body-small text-muted-foreground">{windowLabel(k.sample.start, k.sample.end)}</span>}
      </div>)}
      {!v.total && <EmptyState title={"\u5f53\u524d\u8303\u56f4\u6682\u65e0\u6838\u9a8c\u7ebf\u7d22"} />}
    </div>
    <p className="pt-sm text-body-small text-muted-foreground">{"\u4e13\u9879\u6838\u9a8c\u6570\u636e \u00b7 \u6570\u636e\u622a\u81f3 " + timeLabel(v.cutoff) + " \u00b7 \u7ebf\u7d22\u6570\u72ec\u7acb\u4e8e\u8fd0\u884c\u5173\u6ce8\u7ad9\u5740"}</p>
  </PanelCard>;
}

export function OverviewReport({ demo }: { demo: PortalDemo }) {
  const router = useRouter(), [pending, start] = useTransition(), r = demo.report;
  const choose = (period: ReportPeriod) => {
    const params = new URLSearchParams();
    if (demo.query.cityId !== "all") params.set("city", demo.query.cityId);
    if (demo.query.countyId !== "all") params.set("county", demo.query.countyId);
    if (period !== "day") params.set("reportPeriod", period);
    start(() => router.push("/" + (params.size ? "?" + params : ""), { scroll: false }));
  };
  const periodItems = [{ value: "day", label: "\u65e5" }, { value: "week", label: "\u5468" }, { value: "month", label: "\u6708" }] as const;
  const reportScope = { ...scopeOf(demo), period: r.period };
  const rate = (value: number | null) => value === null ? "\u4e0d\u53ef\u6bd4" : (value > 0 ? "+" : "") + pct(value);
  return <section className="min-w-0" aria-busy={pending} data-overview-report={r.period}>
    <PanelCard className="min-w-0" title={"\u672c\u671f\u62a5\u544a"} icon="file-text" tone="brand" description={calendarLabel(r.period) + " \u00b7 " + r.window.dates.length + "\u5929"}
      action={<fieldset disabled={pending}><SegmentedControl ariaLabel={"\u603b\u89c8\u62a5\u544a\u5468\u671f"} items={periodItems} value={r.period} onChange={choose} /></fieldset>}>
      <div className="flex flex-col gap-md">
        {pending && <p role="status" className="text-body-small text-muted-foreground">{"\u6b63\u5728\u6c47\u603b\u62a5\u544a\u2026"}</p>}
        <div className="flex flex-wrap items-center gap-sm text-body-small text-muted-foreground"><StatusBadge size="sm" tone="warning">{"\u8349\u7a3f \u00b7 \u5f85\u590d\u6838"}</StatusBadge>
          <span>{n(r.sites) + "\u5ea7\u7ad9\u5740 / " + n(r.relations) + "\u6761\u670d\u52a1\u5173\u7cfb"}</span></div>
        {r.sites ? <>
          <DataTable rows={([
            { id: "bytes", label: "\u6d41\u91cf / TiB", scale: 1099511627776 },
            { id: "voiceSeconds", label: "\u901a\u8bdd / \u4e07\u5206\u949f", scale: 600000 },
            { id: "sms", label: "\u77ed\u4fe1 / \u4e07\u6761", scale: 10000 },
          ] as const)} rowKey={row => row.id} columns={[
            { id: "metric", header: "\u6307\u6807", cell: row => <span className="whitespace-nowrap">{row.label}</span> },
            { id: "current", header: "\u672c\u671f\u7d2f\u8ba1", align: "numeric", cell: row => n(Number(r.totals[row.id]) / row.scale, 2) },
            { id: "change", header: "\u603b\u91cf\u73af\u6bd4", align: "numeric", cell: row => rate(r.comparison.metrics[row.id].rate) },
            { id: "daily", header: "\u65e5\u5747\u73af\u6bd4", align: "numeric", cell: row => rate(r.comparison.metrics[row.id].dailyRate) },
          ]} />
          <p className="text-body-small text-muted-foreground">{"\u5bf9\u6bd4\u671f " + r.comparison.previous.window.start.slice(0, 10) + " \u81f3 " + r.comparison.previous.window.end.slice(0, 10) + "\uff08\u7ed3\u675f\u65f6\u523b\u4e0d\u542b\uff09 \u00b7 \u540c\u8303\u56f4\u7ad9\u7fa4"}</p>
          <MetricListCard title={"\u5fd9\u65f6\u4e0e\u670d\u52a1\u8d28\u91cf"} metrics={[
            { key: "busy", label: metricLabel("\u5cf0\u503c\u5c0f\u65f6\u6d41\u91cf\u5360\u6bd4"), value: r.busy ? pct(r.busy.share) : "\u2014" },
            { key: "load", label: metricLabel("\u7ad9\u7fa4\u6700\u9ad8\u8d1f\u8f7d"), value: pct(r.highestLoad?.value ?? null) },
            { key: "connection", label: metricLabel("\u7ad9\u7fa4\u6700\u4f4e\u63a5\u901a\u7387"), value: pct(r.lowestConnection?.value ?? null) },
          ]} footer={r.busy ? <span className="text-body-small text-muted-foreground">{"\u5cf0\u503c\u5c0f\u65f6 " + r.busy.date + " " + String(r.busy.hour).padStart(2, "0") + ":00 \u00b7 \u8d1f\u8f7d\u4e0e\u63a5\u901a\u7387\u6309\u7ad9\u7fa4\u65f6\u6bb5\u52a0\u6743"}</span> : undefined} />
          <MetricListCard title={"\u8fd0\u884c\u53c2\u6570"} metrics={[
            { key: "energy", label: metricLabel("\u7269\u7406\u7535\u8017 / kWh"), value: r.energyWh === null ? "\u2014" : n(r.energyWh / 1000, 1) },
            { key: "temperature", label: metricLabel("\u6700\u9ad8\u6e29\u5ea6 / \u00b0C"), value: r.runtime.temperatureMax === null ? "\u2014" : n(r.runtime.temperatureMax, 1) },
            { key: "battery", label: metricLabel("\u5907\u7528\u4f9b\u7535 / \u5ea7"), value: n(r.runtime.batterySites) },
          ]} footer={<span className="text-body-small text-muted-foreground">{"\u5907\u7528\u4f9b\u7535\u7d2f\u8ba1 " + n(r.runtime.batterySiteHours) + " \u7ad9\u65f6 \u00b7 " + n(r.runtime.samples) + " \u4e2a\u7269\u7406\u7ad9\u65f6\u6837\u672c"}</span>} />
          <div className="flex flex-wrap justify-end gap-sm">
            <Button asChild variant="outline"><a href={businessHref("usage-reports", reportScope)}>{"\u67e5\u770b\u5b8c\u6574\u62a5\u544a"}</a></Button>
            <Button asChild><a href={r.downloadHref} download>{"\u5bfc\u51faHTML"}</a></Button>
          </div>
          <details className="text-body-small text-muted-foreground"><summary className="cursor-pointer">{"\u62a5\u544a\u7248\u672c"}</summary>
            <div className="flex flex-col gap-xs break-all pt-sm"><span>{r.id}</span><span>{r.templateVersion}</span></div>
          </details>
        </> : <EmptyState title={"\u5f53\u524d\u8303\u56f4\u6682\u65e0\u62a5\u544a\u7edf\u8ba1\u5bf9\u8c61"} />}
      </div>
    </PanelCard>
  </section>;
}
