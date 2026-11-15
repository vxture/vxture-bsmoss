"use client";
import OperatorIdentity from "./operator-identity";
import {useOperatorNames} from "./operator-identities";

import { useState } from "react";
import { Button, Card, CardContent, DataTable, EmptyState, Icon, MetricGrid, MetricListCard, PanelCard, Progress,
  SectionHeader, SegmentedControl, ShellPageContainer, toneEdgeClasses } from "@vxture/design-system";
import { businessHref, type BusinessScope } from "../business-analysis/links";
import { DEFAULT_SITE_QUERY, siteListHref } from "../domains/site-registry/rules";
import type { PortalDemo } from "./demo";
import { OverviewAttention, OverviewReport, OverviewVerification } from "./overview-panels";
import OverviewMetrics from "./overview-metrics";
import PageHeading from "./page-heading";
import {towerBrand} from './tower-navigation';

import UsageTrend from "./usage-trend";

const names: Record<string, string> = { mobile: "\u79fb\u52a8", telecom: "\u7535\u4fe1", unicom: "\u8054\u901a", broadcast: "\u5e7f\u7535", other: "\u5176\u4ed6" };
const number = (v: number, digits = 0) => v.toLocaleString("zh-CN", { maximumFractionDigits: digits });
const percent = (v: number | null) => v === null ? "\u2014" : number(v * 100, 1) + "%";
const more = (href: string, label = "\u67e5\u770b\u8be6\u60c5") => <Button asChild variant="ghost" size="sm"><a href={href}>{label}<Icon name="arrow-right" size="sm" /></a></Button>;
const metrics = [{ value: "bytes", label: "\u6d41\u91cf" }, { value: "voiceSeconds", label: "\u901a\u8bdd" }, { value: "sms", label: "\u77ed\u4fe1" }] as const;
type Metric = typeof metrics[number]["value"];

export default function PortalHome({ demo, loginEnabled }: { demo: PortalDemo | null; loginEnabled: boolean }) {
 const names=useOperatorNames();
  const [metric, setMetric] = useState<Metric>("bytes");
  if (!demo) return <ShellPageContainer className="product-page-inset max-w-none gap-lg">
    <PageHeading title={"\u8fd0\u884c\u603b\u89c8"} description={"\u7ad9\u7f51\u8fd0\u8425\u6001\u52bf\u4e0e\u91cd\u70b9\u4e8b\u9879"} />
    <PanelCard title={"\u6b22\u8fce\u4f7f\u7528"+towerBrand.name} icon="house-line" tone="neutral">
      <div className="flex flex-col items-start gap-lg py-lg">
        <p className="text-body text-muted-foreground">{loginEnabled ? "\u767b\u5f55\u540e\u67e5\u770b\u6388\u6743\u8303\u56f4\u5185\u7684\u5468\u671f\u5206\u6790\u3001\u62a5\u544a\u4e0e\u7ba1\u7406\u5de5\u4f5c\u533a\u3002" : "\u6b63\u5f0f\u6570\u636e\u5c1a\u672a\u5f00\u653e\uff0c\u7b49\u5f85\u5b8c\u6210\u5e73\u53f0\u63a5\u5165\u4e0e\u6765\u6e90\u6388\u6743\u3002"}</p>
        {loginEnabled ? <Button asChild><a href="/auth/login?returnTo=%2F">{"\u4f7f\u7528\u5e73\u53f0\u8d26\u53f7\u767b\u5f55"}</a></Button> : null}
      </div>
    </PanelCard>
  </ShellPageContainer>;

  const { usage, status, query: q } = demo;
  const hour = String(demo.hour).padStart(2, "0") + ":00";
  const scope: BusinessScope = { ...q, period: "day", topic: "capacity" };
  const siteQuery = { ...DEFAULT_SITE_QUERY, city: q.cityId, county: q.countyId, hour: q.hour };
  const unit = metric === "bytes" ? "TiB" : metric === "voiceSeconds" ? "\u4e07\u5206\u949f" : "\u4e07\u6761";
  const fmt = (value: number) => number(metric === "bytes" ? value / 1099511627776 : metric === "voiceSeconds" ? value / 600000 : value / 10000, 2);
  const metricName = metrics.find(item => item.value === metric)!.label, total = usage.totals[metric];
  const series = usage.series.map(point => ({ key: String(point.hour), label: String(point.hour).padStart(2, "0"), value: point.rows.reduce((sum, row) => sum + row[metric], 0) }));
  const operators = [...usage.rows].sort((a, b) => b[metric] - a[metric]);
  const peak = series.reduce((highest, point) => point.value > highest.value ? point : highest, series[0]);
  const readout = (value: number | null, label: string) => <div className="flex min-w-0 flex-col gap-xs">
    <span className="text-right text-body-small tabular-nums text-muted-foreground">{percent(value)}</span>
    {value !== null && <Progress value={value * 100} aria-label={label} />}
  </div>;

  return <ShellPageContainer className="product-page-inset max-w-none gap-lg">
    <div data-portal-mode="demo" data-demo-version={demo.version} className="flex min-w-0 flex-col gap-lg">
      <PageHeading title={"\u8fd0\u884c\u603b\u89c8"} description={"\u7ad9\u7f51\u8fd0\u8425\u6001\u52bf\u4e0e\u91cd\u70b9\u4e8b\u9879"}
        dataUpdate={demo.dataUpdate}
        toolbar={<p className="py-sm text-body-small text-muted-foreground">{"\u5206\u6790\u65e5\u671f " + demo.date + " \u00b7 \u72b6\u6001\u65f6\u70b9 " + hour}</p>}
        />
      <section className="sm:hidden" aria-label={"\u7ad9\u7f51\u8d44\u6e90"}>
        <MetricListCard title={"\u7ad9\u7f51\u8d44\u6e90"} icon="building" metrics={[
          { key: "sites", label: "\u7269\u7406\u7ad9\u5740", value: <a href={siteListHref(siteQuery)}>{number(usage.physicalSites)}</a> },
          { key: "relations", label: "\u670d\u52a1\u5173\u7cfb", value: <a href={siteListHref(siteQuery, { view: "relations" })}>{number(usage.serviceRelations)}</a> },
          { key: "shared", label: "\u5171\u4eab\u7ad9\u5740", value: <a href={siteListHref(siteQuery, { sharing: "shared" })}>{number(usage.sharedSites)}</a> },
          { key: "attention", label: "\u72b6\u6001\u5173\u6ce8", value: <a href="#overview-attention">{number(status.warning + status.critical)}</a> },
        ]} />
      </section>
      <div className="hidden sm:block"><MetricGrid columns={4} aria-label={"\u7ad9\u7f51\u8d44\u6e90"} items={[
        { id: "sites", label: "\u7269\u7406\u7ad9\u5740", value: <a href={siteListHref(siteQuery)} className="hover:underline">{number(usage.physicalSites)}</a>, description: "\u5ea7", icon: "building" },
        { id: "relations", label: "\u8fd0\u8425\u5546\u670d\u52a1\u5173\u7cfb", value: <a href={siteListHref(siteQuery, { view: "relations" })} className="hover:underline">{number(usage.serviceRelations)}</a>, description: "\u6761", icon: "database", tone: "info" },
        { id: "shared", label: "\u5171\u4eab\u7ad9\u5740", value: <a href={siteListHref(siteQuery, { sharing: "shared" })} className="hover:underline">{number(usage.sharedSites)}</a>,
          description: "\u5171\u4eab\u7387 " + percent(usage.physicalSites ? usage.sharedSites / usage.physicalSites : null), icon: "share", tone: "success" },
        { id: "attention", label: "\u8fd0\u884c\u72b6\u6001\u5173\u6ce8", help: "\u6309\u7ad9\u5740\u72b6\u6001\u7edf\u8ba1\u5173\u6ce8\u4e0e\u5f02\u5e38\uff1b\u4e0b\u65b9\u4e13\u9898\u6309\u6307\u6807\u9608\u503c\u72ec\u7acb\u5224\u5b9a\uff0c\u5404\u4e13\u9898\u6570\u91cf\u4e0d\u76f8\u52a0\u3002", value: <a href="#overview-attention" className="hover:underline">{number(status.warning + status.critical)}</a>,
          description: "\u5173\u6ce8 " + number(status.warning) + " / \u5f02\u5e38 " + number(status.critical), icon: "gauge", tone: "warning" },
      ]} /></div>
      <OverviewMetrics demo={demo} scope={scope} />
      <OverviewAttention key={q.cityId + q.countyId} demo={demo} />
      <div className="grid min-w-0 auto-rows-fr gap-md xl:grid-cols-3">
        <Card className={"overview-usage-panel min-h-0 min-w-0 gap-md border-t-medium xl:col-span-2 " + toneEdgeClasses.brand}>
          <CardContent><div className="flex flex-wrap items-center justify-between gap-md border-b border-dashed border-border pb-md">
            <SectionHeader level={3} divider={false} title={"\u4e1a\u52a1\u7528\u91cf\u8d8b\u52bf"} description={usage.physicalSites ? "\u5168\u65e5 \u00b7 " + unit + " \u00b7 \u5cf0\u503c " + peak.label + ":00" : "\u5f53\u524d\u8303\u56f4\u6682\u65e0\u7ad9\u5740"} />
            <div className="flex flex-wrap items-center justify-end gap-sm">
              <SegmentedControl className="h-control-xl" items={metrics} value={metric} onChange={setMetric} ariaLabel={"\u7528\u91cf\u6307\u6807"} size="sm" />
              <Button asChild variant="outline" size="sm"><a href={businessHref("operator-usage", scope)}>{"\u7528\u91cf\u5206\u6790"}</a></Button>
            </div></div></CardContent>
          <CardContent className="flex min-h-0 min-w-0 flex-1 flex-col">
          {usage.physicalSites ? <UsageTrend key={metric} data={series} formatValue={fmt} name={metricName} unit={unit} />
            : <EmptyState title={"\u6682\u65e0\u7528\u91cf\u7edf\u8ba1\u5bf9\u8c61"} />}
          </CardContent>
        </Card>
        <PanelCard title={"\u8fd0\u8425\u5546\u7528\u91cf\u7ed3\u6784"} description={"\u5168\u65e5" + metricName + "\u5360\u6bd4 \u00b7 " + unit} tone="neutral" className="min-w-0">
          <div className="flex flex-col gap-md" data-overview-structure={metric}>
            {!usage.physicalSites ? <EmptyState title={"\u6682\u65e0\u8fd0\u8425\u5546\u670d\u52a1\u5173\u7cfb"} /> : operators.map(row => <a className="flex flex-col gap-xs rounded-sm text-foreground no-underline hover:text-primary-text focus-visible:outline-ring" href={businessHref("operator-usage", { ...scope, operator: row.code })} key={row.code}>
              <div className="flex flex-wrap items-baseline justify-between gap-xs text-body-small"><span><OperatorIdentity code={row.code}/></span><span className="tabular-nums text-muted-foreground">{fmt(row[metric]) + " " + unit}<span className="pl-sm text-primary-text">{percent(total ? row[metric] / total : null)}</span></span></div>
              <Progress value={total ? row[metric] / total * 100 : 0} aria-label={names[row.code] + metricName + "\u5360\u6bd4"} />
            </a>)}
          </div>
        </PanelCard>
      </div>
      <PanelCard title={"\u5730\u5e02\u8fd0\u884c\u6bd4\u8f83"} icon="city" description={"\u65f6\u6bb5\u7528\u91cf \u00b7 \u6309\u6d41\u91cf\u6392\u5e8f"} tone="neutral" className="min-w-0">
        <DataTable rows={demo.cities} rowKey={row => row.id} columns={[
          { id: "city", header: "\u5730\u5e02", cell: row => <a className="whitespace-nowrap text-foreground hover:text-primary-text" href={siteListHref({ ...siteQuery, city: row.id })}>{row.name}</a> },
          { id: "sites", header: "\u7269\u7406\u7ad9\u5740", align: "numeric", cell: row => number(row.count) },
          { id: "attention", header: "\u9700\u5173\u6ce8\u7ad9\u5740", align: "numeric", cell: row => number(row.warning + row.critical) },
          { id: "load", header: "\u8d44\u6e90\u8d1f\u8f7d", align: "numeric", cell: row => readout(row.load, row.name + "\u8d44\u6e90\u8d1f\u8f7d") },
          { id: "connectionRate", header: "\u63a5\u901a\u7387", align: "numeric", cell: row => readout(row.connectionRate, row.name + "\u63a5\u901a\u7387") },
          { id: "data", header: "\u6d41\u91cf / GiB", align: "numeric", cell: row => number(row.bytes / 1073741824, 1) },
          { id: "voice", header: "\u901a\u8bdd / \u4e07\u5206\u949f", align: "numeric", cell: row => number(row.voiceSeconds / 600000, 2) },
          { id: "sms", header: "\u77ed\u4fe1 / \u4e07\u6761", align: "numeric", cell: row => number(row.sms / 10000, 2) },
        ]} />
      </PanelCard>
      <div className="grid min-w-0 items-start gap-md xl:grid-cols-2">
        <OverviewVerification demo={demo} />
        <OverviewReport demo={demo} />
      </div>
      <footer className="flex flex-wrap justify-between gap-sm text-body-small text-muted-foreground">
        <span>{"\u7269\u7406\u7ad9\u5740\u4e0e\u670d\u52a1\u5173\u7cfb\u5206\u522b\u5f52\u96c6 \u00b7 \u7535\u8017\u6309\u7269\u7406\u7ad9\u5740\u7edf\u8ba1"}</span>
      </footer>
    </div>
  </ShellPageContainer>;
}
