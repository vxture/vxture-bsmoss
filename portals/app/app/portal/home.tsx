"use client";

import { useState } from "react";
import { BarChart, Button, DataTable, EntryCard, Icon, MetricGrid, MetricListCard, PanelCard, Progress,
  SegmentedControl, ShellPageContainer, StatusBadge, ViewHeader } from "@vxture/design-system";
import type { PortalDemo } from "./demo";

const names: Record<string, string> = { mobile: "\u79fb\u52a8", telecom: "\u7535\u4fe1", unicom: "\u8054\u901a", broadcast: "\u5e7f\u7535", other: "\u5176\u4ed6" };
const number = (v: number, digits = 0) => v.toLocaleString("zh-CN", { maximumFractionDigits: digits });
const percent = (v: number | null) => v === null ? "\u2014" : number(v * 100, 1) + "%";
const more = (href: string, label = "\u67e5\u770b\u8be6\u60c5") => <Button asChild variant="ghost" size="sm"><a href={href}>{label}<Icon name="arrow-right" size="sm" /></a></Button>;
const metrics = [
  { value: "bytes", label: "\u6d41\u91cf" }, { value: "voiceSeconds", label: "\u901a\u8bdd" }, { value: "sms", label: "\u77ed\u4fe1" },
] as const;
type Metric = typeof metrics[number]["value"];

export default function PortalHome({ demo, loginEnabled }: { demo: PortalDemo | null; loginEnabled: boolean }) {
  const [metric, setMetric] = useState<Metric>("bytes");
  if (!demo) return <ShellPageContainer className="product-page-inset max-w-none gap-lg">
    <ViewHeader title={"\u8fd0\u884c\u603b\u89c8"} description={"\u9655\u897f\u7701"} />
    <PanelCard title={"\u6b22\u8fce\u4f7f\u7528\u89c2\u6f9c"} icon="house-line" tone="neutral">
      <div className="flex flex-col items-start gap-lg py-lg">
        <p className="text-body text-muted-foreground">{loginEnabled ? "\u767b\u5f55\u540e\u67e5\u770b\u6388\u6743\u8303\u56f4\u5185\u7684\u5468\u671f\u5206\u6790\u3001\u62a5\u544a\u4e0e\u7ba1\u7406\u5de5\u4f5c\u533a\u3002" : "\u6b63\u5f0f\u6570\u636e\u5c1a\u672a\u5f00\u653e\uff0c\u7b49\u5f85\u5b8c\u6210\u5e73\u53f0\u63a5\u5165\u4e0e\u6765\u6e90\u6388\u6743\u3002"}</p>
        {loginEnabled ? <Button asChild><a href="/auth/login?returnTo=%2Fanalysis">{"\u4f7f\u7528\u5e73\u53f0\u8d26\u53f7\u767b\u5f55"}</a></Button> : null}
      </div>
    </PanelCard>
    <div className="grid gap-md sm:grid-cols-2">
      <EntryCard href="/analysis" icon="chart-line-up" title={"\u5468\u671f\u5206\u6790"} description={"\u7ecf\u8425\u670d\u52a1\u3001\u8fd0\u8425\u72b6\u6001\u4e0e\u8fd0\u884c\u53c2\u6570"} />
      <EntryCard href="/reports" icon="file-text" title={"\u62a5\u544a\u4e2d\u5fc3"} description={"\u5468\u671f\u62a5\u544a\u3001\u53d1\u5e03\u4e0e\u5bfc\u51fa\u8bb0\u5f55"} />
    </div>
  </ShellPageContainer>;

  const { usage, status } = demo;
  const unit = metric === "bytes" ? "TiB" : metric === "voiceSeconds" ? "\u4e07\u5206\u949f" : "\u4e07\u6761";
  const fmt = (value: number) => number(metric === "bytes" ? value / 1099511627776 : metric === "voiceSeconds" ? value / 600000 : value / 10000, 2);
  const series = usage.series.map(point => ({ key: String(point.hour), label: String(point.hour).padStart(2, "0"), value: point.rows.reduce((sum, row) => sum + row[metric], 0) }));
  return <ShellPageContainer className="product-page-inset max-w-none gap-lg">
    <div data-portal-mode="demo" data-demo-version={demo.version} className="flex min-w-0 flex-col gap-lg">
      <ViewHeader className="max-sm:flex-col max-sm:items-stretch" title={"\u8fd0\u884c\u603b\u89c8"} description={"\u9655\u897f\u7701 \u00b7 " + demo.date}
        secondary={<StatusBadge tone="info" size="sm">{"\u6f14\u793a\u6570\u636e"}</StatusBadge>}
        action={<div className="flex flex-wrap gap-sm"><Button asChild size="xl"><a href="/board"><Icon name="chart-bar" size="sm" />{"\u51b3\u7b56\u5927\u5c4f"}</a></Button>
          <Button asChild size="xl" variant="secondary"><a href="/product-preview?hour=18"><Icon name="map-pin" size="sm" />{"\u8fdb\u5165\u7ad9\u7f51\u5730\u56fe"}<Icon name="arrow-right" size="sm" /></a></Button></div>} />
      <MetricGrid columns={4} aria-label={"\u7ad9\u7f51\u6982\u51b5"} items={[
        { id: "sites", label: "\u6f14\u793a\u7ad9\u5740", value: number(usage.physicalSites), description: "\u5ea7", icon: "map-pin" },
        { id: "relations", label: "\u8fd0\u8425\u5546\u670d\u52a1\u5173\u7cfb", value: number(usage.serviceRelations), description: "\u6761", icon: "database", tone: "info" },
        { id: "shared", label: "\u5171\u4eab\u7ad9\u5740", value: number(usage.sharedSites), description: "\u5ea7", icon: "share", tone: "success" },
        { id: "attention", label: "\u9700\u5173\u6ce8\u7ad9\u5740", value: number(status.warning + status.critical), description: "18:00", icon: "gauge", tone: "warning" },
      ]} />
      <section className="grid gap-md xl:grid-cols-3" aria-label={"\u4e09\u7c7b\u4e1a\u52a1\u6307\u6807"}>
        <MetricListCard title={"\u7ecf\u8425\u670d\u52a1"} description={"\u5168\u65e5\u7d2f\u8ba1"} icon="chart-bar" tone="brand"
          metrics={[
            { key: "data", label: "\u6d41\u91cf / TiB", value: number(usage.totals.bytes / 1099511627776, 2) },
            { key: "voice", label: "\u901a\u8bdd / \u4e07\u5206\u949f", value: number(usage.totals.voiceSeconds / 600000, 2) },
            { key: "sms", label: "\u77ed\u4fe1 / \u4e07\u6761", value: number(usage.totals.sms / 10000, 2) },
          ]} footer={more("/operator-usage", "\u8fd0\u8425\u5546\u7528\u91cf")} />
        <MetricListCard title={"\u8fd0\u8425\u72b6\u6001"} description="18:00" icon="gauge" tone="info"
          metrics={[
            { key: "connection", label: "\u63a5\u901a\u7387", value: percent(status.connectionRate) },
            { key: "load", label: "\u8d44\u6e90\u8d1f\u8f7d", value: percent(status.load) },
            { key: "normal", label: "\u6b63\u5e38 / \u5ea7", value: number(status.normal) },
          ]} footer={more("/capacity", "\u5bb9\u91cf\u4e0e\u8d28\u91cf")} />
        <MetricListCard title={"\u8fd0\u884c\u53c2\u6570"} description={"\u5168\u65e5\u7d2f\u8ba1"} icon="lightning" tone="success"
          metrics={[
            { key: "energy", label: "\u7269\u7406\u7535\u8017 / kWh", value: usage.energyWh === null ? "\u2014" : number(usage.energyWh / 1000, 1) },
            { key: "scope", label: "\u7535\u8017\u53e3\u5f84", value: "\u7269\u7406\u7ad9\u5740" },
          ]} footer={more("/efficiency", "\u8fd0\u884c\u4e0e\u80fd\u6548")} />
      </section>
      <div className="grid min-w-0 gap-md xl:grid-cols-3">
        <PanelCard title={"\u4e1a\u52a1\u7528\u91cf\u8d8b\u52bf"} description={demo.date + " \u00b7 24\u5c0f\u65f6 \u00b7 " + unit} className="min-w-0 xl:col-span-2" tone="brand"
          action={<SegmentedControl items={metrics} value={metric} onChange={setMetric} ariaLabel={"\u7528\u91cf\u6307\u6807"} size="sm" />}>
          <BarChart key={metric} data={series} formatValue={fmt} peakLabel={"\u5cf0\u503c"} aria-label={"24\u5c0f\u65f6" + metrics.find(item => item.value === metric)!.label + "\u8d8b\u52bf"} />
          <div className="flex justify-end pt-md">{more("/operator-usage", "\u67e5\u770b\u5b8c\u6574\u7528\u91cf\u5206\u6790")}</div>
        </PanelCard>
        <PanelCard title={"\u8fd0\u8425\u5546\u7528\u91cf\u7ed3\u6784"} description={"\u5168\u65e5\u6d41\u91cf\u5360\u6bd4"} tone="neutral" className="min-w-0">
          <div className="flex flex-col gap-md">
            {usage.rows.map(row => <a className="flex flex-col gap-2xs no-underline" href={"/operator-usage?period=day&operator=" + row.code + "&hour=18"} key={row.code}>
              <div className="flex items-baseline justify-between gap-xs text-body-small"><span className="text-foreground">{names[row.code]}</span><span className="tabular-nums text-muted-foreground">{number(row.bytes / 1073741824, 1) + " GiB"}<span className="pl-xs text-primary-text">{percent(usage.totals.bytes ? row.bytes / usage.totals.bytes : null)}</span></span></div>
              <Progress value={usage.totals.bytes ? row.bytes / usage.totals.bytes * 100 : 0} aria-label={names[row.code] + "\u6d41\u91cf\u5360\u6bd4"} />
            </a>)}
          </div>
        </PanelCard>
      </div>
      <div className="grid min-w-0 gap-md xl:grid-cols-2">
        <PanelCard title={"\u5730\u5e02\u4e1a\u52a1\u5206\u5e03"} description={"18:00 \u00b7 \u6309\u6d41\u91cf\u6392\u5e8f"} tone="neutral" className="min-w-0">
          <DataTable rows={demo.cities} rowKey={row => row.id} columns={[
            { id: "city", header: "\u5730\u5e02", cell: row => <a className="text-foreground hover:text-primary-text" href={"/product-preview?city=" + row.id + "&hour=18"}>{row.name}</a> },
            { id: "sites", header: "\u7ad9\u5740", align: "numeric", cell: row => number(row.count) },
            { id: "load", header: "\u8d1f\u8f7d\u7387", align: "numeric", cell: row => percent(row.load) },
            { id: "data", header: "\u6d41\u91cf / GiB", align: "numeric", cell: row => number(row.bytes / 1073741824, 1) },
          ]} />
        </PanelCard>
        <PanelCard title={"\u7ad9\u5740\u72b6\u6001\u89c2\u5bdf"} description={"18:00 \u00b7 \u6a21\u62df\u72b6\u6001"} tone="warning" className="min-w-0" action={more("/product-preview?hour=18")}>
          <DataTable rows={demo.priorities} rowKey={row => row.id} columns={[
            { id: "site", header: "\u7ad9\u5740", cell: row => <a className="flex flex-col gap-2xs text-foreground hover:text-primary-text" href={"/product-preview?hour=18&site=" + row.id}><span>{row.name}</span><span className="text-label-micro text-muted-foreground">{row.city}</span></a> },
            { id: "status", header: "\u72b6\u6001", cell: row => <StatusBadge size="sm" tone={row.status === "critical" ? "danger" : row.status === "warning" ? "warning" : "success"}>{row.status === "critical" ? "\u91cd\u70b9" : row.status === "warning" ? "\u5173\u6ce8" : "\u6b63\u5e38"}</StatusBadge> },
            { id: "load", header: "\u8d1f\u8f7d\u7387", align: "numeric", cell: row => percent(row.load) },
            { id: "data", header: "\u6d41\u91cf / GiB", align: "numeric", cell: row => number(row.trafficGiB, 1) },
          ]} />
        </PanelCard>
      </div>
      <section className="grid gap-md sm:grid-cols-2 xl:grid-cols-4" aria-label={"\u5feb\u6377\u5de5\u4f5c\u533a"}>
        <EntryCard href="/sites" icon="building" title={"\u7ad9\u5740\u7ba1\u7406"} description={"\u53f0\u8d26\u3001\u6863\u6848\u3001\u8d44\u6e90\u4e0e\u670d\u52a1\u5173\u7cfb"} />
        <EntryCard href="/product-preview?hour=18" icon="map-pin" title={"\u7ad9\u7f51\u5730\u56fe"} description={"\u7a7a\u95f4\u5b9a\u4f4d\u3001\u9009\u533a\u5bf9\u6bd4\u4e0e\u5355\u7ad9\u5206\u6790"} />
        <EntryCard href="/usage-reports" icon="file-text" title={"\u5468\u671f\u62a5\u544a\u6f14\u793a"} description={"\u65e5\u5468\u6708\u5206\u6790\u4e0e\u8bc1\u636e\u5bfc\u51fa"} />
        <EntryCard href="/analysis" icon="chart-line-up" title={"\u6b63\u5f0f\u5468\u671f\u5206\u6790"} description={"\u5e73\u53f0\u6388\u6743\u8303\u56f4\u5185\u7684\u6307\u6807\u4e0e\u8bc1\u636e"} />
      </section>
      <footer className="flex flex-wrap justify-between gap-xs text-body-small text-content-tertiary">
        <span>{"\u56fa\u5b9a\u6f14\u793a\u65e5\u671f \u00b7 1,080 \u4e2a\u6a21\u62df\u7ad9\u5740\uff0c\u4e0d\u4ee3\u8868\u771f\u5b9e\u63a5\u5165\u3002"}</span>
        <span>{"\u7269\u7406\u7535\u8017\u4e0d\u6309\u8fd0\u8425\u5546\u5206\u644a"}</span>
      </footer>
    </div>
  </ShellPageContainer>;
}
