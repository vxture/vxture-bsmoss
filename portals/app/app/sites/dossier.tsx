"use client";
import { useState, useTransition } from "react";
import MetricRowsCard from "../portal/metric-rows-card";
import { useRouter } from "next/navigation";
import { ActionMenu, BarChart, Button, DataTable, DetailList, DetailRow, Icon, MetricGrid, NativeSelect, PanelCard,
  Progress, SegmentedControl, StatusBadge, ViewHeader, type DataTableColumn } from "@vxture/design-system";
import type { DossierDemo } from "../domains/site-registry/demo-store";
import { changeLabel, windowLabel } from "../domains/map-demo/period-comparison-display";
import { SITE_TABS, siteDetailHref, siteListHref, type SiteQuery } from "../domains/site-registry/rules";
import { n, operatorNames, pct, sceneNames, siteTypeNames, statusNames, tabNames } from "./labels";
import "./sites.css";
const metricOptions = [{ value: "bytes", label: "\u6d41\u91cf" }, { value: "voiceSeconds", label: "\u901a\u8bdd" }, { value: "sms", label: "\u77ed\u4fe1" }] as const;
type UsageMetric = typeof metricOptions[number]["value"];
const tone = (status: string) => status === "critical" ? "danger" as const : status === "warning" ? "warning" as const : "success" as const;
export default function SiteDossier({ demo }: { demo: DossierDemo }) {
  const router = useRouter(), [pending, start] = useTransition(), [metric, setMetric] = useState<UsageMetric>("bytes");
  const { site: s, query: q, period: p } = demo, m = s.current;
  const navigate = (patch: Partial<SiteQuery>) => start(() => router.push(siteDetailHref(s.id, q, patch), { scroll: false }));
  const mapParams = new URLSearchParams({ city: s.cityId, county: s.countyId, site: s.id, hour: String(q.hour) });
  const mapHref = "/product-preview?" + mapParams;
  const periodLabel = p.usage.window.start.slice(0, 10) + " \u2014 " + p.days[p.days.length - 1].date;
  const unit = metric === "bytes" ? "GiB" : metric === "voiceSeconds" ? "\u5206\u949f" : "\u6761";
  const scale = (value: string | number) => metric === "bytes" ? Number(value) / 1073741824 : metric === "voiceSeconds" ? Number(value) / 60 : Number(value);
  const time = String(q.hour).padStart(2, "0") + ":00";
  const serviceColumns: DataTableColumn<DossierDemo["relations"][number]>[] = [
    { id: "operator", header: "\u8fd0\u8425\u5546 / \u5173\u7cfb\u7f16\u7801", cell: r => <div className="flex flex-col gap-xs"><span className="text-label font-semibold">{operatorNames[r.code]}</span><span className="text-body-small text-muted-foreground">{r.id}</span></div> },
    { id: "business", header: "\u7ecf\u8425\u670d\u52a1", cell: () => "\u901a\u8bdd / \u6d41\u91cf / \u77ed\u4fe1" },
    { id: "device", header: "\u627f\u8f7d\u8d44\u6e90", cell: () => "1 \u5957\u65e0\u7ebf\u8bbe\u5907 / \u5171\u7528\u5854\u623f\u7535" },
    { id: "status", header: "\u65f6\u6bb5\u72b6\u6001", align: "center", cell: r => <StatusBadge tone={tone(r.current.status)} size="sm">{statusNames[r.current.status]}</StatusBadge> },
    { id: "load", header: "\u65f6\u6bb5\u8d1f\u8f7d", align: "right", cell: r => pct(r.current.used / r.current.capacity) },
    { id: "connection", header: "\u65f6\u6bb5\u63a5\u901a\u7387", align: "right", cell: r => pct(r.current.attempts ? r.current.connected / r.current.attempts : null) },
  ];
  const deviceColumns: DataTableColumn<DossierDemo["devices"][number]>[] = [
    { id: "device", header: "\u8d44\u6e90 / \u8bbe\u5907", cell: d => <div className="flex flex-col gap-xs"><span className="text-label">{d.name}</span><span className="text-body-small text-muted-foreground">{d.id}</span></div> },
    { id: "category", header: "\u7c7b\u522b", cell: d => d.category }, { id: "owner", header: "\u5f52\u5c5e\u4e3b\u4f53", cell: d => operatorNames[d.owner] ?? d.owner },
    { id: "spec", header: "\u89c4\u683c / \u53e3\u5f84", cell: d => d.spec }, { id: "state", header: "\u573a\u666f\u72b6\u6001", align: "center", cell: d => <StatusBadge tone={tone(d.state)} size="sm">{d.stateLabel}</StatusBadge> },
  ];
  const usageColumns: DataTableColumn<DossierDemo["relations"][number]>[] = [
    { id: "operator", header: "\u8fd0\u8425\u5546", cell: r => operatorNames[r.code] },
    { id: "data", header: "\u6d41\u91cf / GiB", align: "right", cell: r => <span title={r.usage.totals.bytes + " bytes"}>{n(Number(r.usage.totals.bytes) / 1073741824, 2)}</span> },
    { id: "voice", header: "\u901a\u8bdd / \u5206\u949f", align: "right", cell: r => n(r.usage.totals.voiceSeconds / 60, 1) },
    { id: "sms", header: "\u77ed\u4fe1 / \u6761", align: "right", cell: r => n(r.usage.totals.sms) },
    { id: "share", header: "\u6d41\u91cf\u5360\u6bd4", align: "right", cell: r => pct(Number(p.usage.totals.bytes) ? Number(r.usage.totals.bytes) / Number(p.usage.totals.bytes) : null) },
  ];
  const info = <PanelCard title={"\u7ad9\u5740\u6863\u6848"} icon="building"><DetailList columns={2}>
    <DetailRow label={"\u7ad9\u5740\u7f16\u7801"}>{s.id}</DetailRow><DetailRow label={"\u94c1\u5854\u8d44\u4ea7\u7f16\u7801"}>{s.assetCode}</DetailRow>
    <DetailRow label={"\u5efa\u8bbe\u8fd0\u8425\u4e3b\u4f53"}>{"\u4e2d\u56fd\u94c1\u5854"}</DetailRow><DetailRow label={"\u5f52\u5c5e\u533a\u57df"}>{s.cityName + " / " + s.countyName}</DetailRow>
    <DetailRow label={"\u4e1a\u52a1\u573a\u666f"}>{sceneNames[s.profile]}</DetailRow><DetailRow label={"\u5854\u578b / \u5854\u9ad8"}>{s.towerType + " / " + s.heightMeters + " m"}</DetailRow>
    <DetailRow label={"\u7ad9\u70b9\u7c7b\u578b"}>{siteTypeNames[s.siteType]}</DetailRow><DetailRow label={"\u673a\u623f\u5f62\u6001"}>{s.roomType}</DetailRow>
    <DetailRow label={"\u6295\u8fd0\u65e5\u671f"}>{s.commissioned}</DetailRow>
    <DetailRow label={"\u5730\u7406\u5750\u6807"}>{s.lng.toFixed(6) + ", " + s.lat.toFixed(6)}</DetailRow><DetailRow label={"\u6863\u6848\u7248\u672c"}>{demo.version}</DetailRow>
    <DetailRow label={"\u4f4d\u7f6e\u63cf\u8ff0"}>{s.address}</DetailRow><DetailRow label={"\u6570\u636e\u5c5e\u6027"}>{"\u5408\u6210\u6863\u6848"}</DetailRow>
  </DetailList></PanelCard>;
  const focus = <PanelCard title={"\u8fd0\u884c\u5173\u6ce8"} icon="gauge" description={demo.date + " \u00b7 " + time}>
    <div className="flex flex-col gap-lg">{demo.findings.map((f, i) => <div key={i} className="flex items-start gap-md">
      <Icon name={f.severity === "info" ? "info" : "flag"} size="md" className={f.severity === "info" ? "text-primary" : "text-warning-text"} />
      <div className="flex min-w-0 flex-col gap-xs"><span className="text-label font-semibold">{f.title}</span><p className="text-body-small text-muted-foreground">{f.detail}</p></div>
    </div>)}</div>
  </PanelCard>;
  const serviceMap = <PanelCard title={"\u7ad9\u5740\u670d\u52a1\u7ed3\u6784"} icon="users" description={"\u94c1\u5854\u8d44\u6e90 \u2192 \u8fd0\u8425\u5546\u670d\u52a1\u5173\u7cfb \u2192 \u4e09\u7c7b\u4e1a\u52a1"}>
    <div className="flex flex-col gap-md">
      <div className="flex items-center gap-md rounded-md border border-border bg-primary-muted p-md"><Icon name="building" size="lg" /><div><p className="text-label font-semibold">{"\u4e2d\u56fd\u94c1\u5854 \u00b7 " + s.name}</p><p className="text-body-small text-muted-foreground">{"\u5854\u4f53 / \u673a\u623f / \u4f9b\u7535 / \u73af\u5883\u4fdd\u969c"}</p></div></div>
      <div className="grid gap-md sm:grid-cols-2">{demo.relations.map(r => <div key={r.id} className="rounded-md border border-border bg-background p-md">
        <div className="mb-sm flex items-center justify-between gap-sm"><span className="text-label font-semibold">{operatorNames[r.code]}</span><StatusBadge tone={tone(r.current.status)} size="sm">{statusNames[r.current.status]}</StatusBadge></div>
        <p className="text-body-small text-muted-foreground">{"\u65e0\u7ebf\u8bbe\u5907 \u2192 \u901a\u8bdd / \u6d41\u91cf / \u77ed\u4fe1"}</p>
        <Progress className="mt-md" value={r.current.used / r.current.capacity * 100} aria-label={operatorNames[r.code] + "\u65f6\u6bb5\u8d1f\u8f7d"} />
        <div className="mt-xs flex justify-between text-body-small text-muted-foreground"><span>{"\u65f6\u6bb5\u8d1f\u8f7d"}</span><span>{pct(r.current.used / r.current.capacity)}</span></div>
      </div>)}</div>
    </div>
  </PanelCard>;
  return <div className="site-workspace flex h-full w-full min-w-0 flex-col text-body" data-site-dossier-mode="demo" aria-busy={pending}>
    <div className="shrink-0 border-b border-border bg-card product-page-inset">
      <div className="mb-sm flex items-center gap-sm text-body-small text-muted-foreground"><Button asChild variant="ghost" size="sm"><a href={siteListHref(q)}><Icon name="arrow-left" size="sm" />{"\u7ad9\u5740\u53f0\u8d26"}</a></Button><Icon name="chevron-right" size="xs" /><span>{s.cityName}</span><Icon name="chevron-right" size="xs" /><span>{s.countyName}</span></div>
      <ViewHeader className="max-sm:flex-col max-sm:items-stretch" title={s.name} description={s.id + " \u00b7 " + sceneNames[s.profile]}
        secondary={<StatusBadge tone={tone(m.status)} size="sm">{statusNames[m.status]}</StatusBadge>}
        action={<Button asChild variant="secondary"><a target="_blank" rel="noopener noreferrer" href={mapHref}><Icon name="map-pin" size="sm" />{"\u5730\u56fe\u5b9a\u4f4d"}</a></Button>} />
      <div className="mt-md flex flex-wrap items-center justify-between gap-md"><div role="navigation" aria-label={"\u7ad9\u5740\u6863\u6848\u5206\u5c42"} className="flex flex-wrap gap-xs">
        {SITE_TABS.map(tab => <Button key={tab} size="sm" variant={q.tab === tab ? "secondary" : "ghost"} aria-current={q.tab === tab ? "page" : undefined} onClick={() => navigate({ tab })}>{tabNames[tab]}</Button>)}
      </div><NativeSelect aria-label={"\u6863\u6848\u72b6\u6001\u65f6\u6bb5"} wrapperClassName="w-auto" value={q.hour} onChange={e => navigate({ hour: Number(e.target.value) })}>{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{demo.date + " \u00b7 " + String(h).padStart(2, "0") + ":00"}</option>)}</NativeSelect></div>
    </div>
    <div className="site-dossier-scroll min-h-0 min-w-0 flex-1 overflow-y-auto product-page-inset" role="region" tabIndex={0} aria-label={tabNames[q.tab]}>
      {q.tab === "overview" && <div className="flex flex-col gap-lg">
        <MetricGrid columns={4} items={[
          { id: "operators", icon: "users", label: "\u5171\u4eab\u8fd0\u8425\u5546", value: s.operators.length, description: "\u5bb6" },
          { id: "devices", icon: "stack", label: "\u627f\u8f7d\u8d44\u6e90\u8bbe\u5907", value: demo.devices.length, description: "\u9879" },
          { id: "load", icon: "gauge", label: time + " \u00b7 \u8d44\u6e90\u8d1f\u8f7d", value: pct(m.used / m.capacity), description: "\u8fd0\u8425\u72b6\u6001" },
          { id: "energy", icon: "lightning", label: time + " \u00b7 \u7ad9\u5740\u7535\u8017", value: n((m.energyWh ?? 0) / 1000, 2), description: "kWh \u00b7 \u7269\u7406\u7ad9\u53e3\u5f84" },
        ]} />
        <div className="site-dossier-layout">{info}{focus}</div>
        <div className="site-dossier-layout">{serviceMap}<PanelCard title={"\u5355\u7ad9\u4e1a\u52a1\u5165\u53e3"} icon="chart-line-up">
          <div className="flex flex-col gap-md">{(["resources", "runtime", "business", "sources"] as const).map(tab => <Button key={tab} variant="ghost" className="justify-between" onClick={() => navigate({ tab })}><span>{tabNames[tab]}</span><Icon name="arrow-right" size="sm" /></Button>)}</div>
        </PanelCard></div>
      </div>}
      {q.tab === "resources" && <div className="flex flex-col gap-lg">
        <div className="grid gap-md lg:grid-cols-3">
          <MetricRowsCard title={"\u5854\u623f\u8d44\u6e90"} icon="building" metrics={[{ key: "tower", label: "\u5854\u4f53", value: s.towerType }, { key: "height", label: "\u5854\u9ad8", value: s.heightMeters + " m" }, { key: "room", label: "\u673a\u623f", value: s.roomType }]} />
          <MetricRowsCard title={"\u80fd\u6e90\u4fdd\u969c"} icon="lightning" metrics={[{ key: "power", label: "\u4f9b\u7535", value: m.power === "battery" ? "\u5907\u7528\u7535\u6c60" : "\u5e02\u7535" }, { key: "battery", label: "\u540e\u5907\u5bb9\u91cf", value: "200 Ah" }, { key: "meter", label: "\u8ba1\u91cf\u53e3\u5f84", value: "\u7269\u7406\u7ad9\u5740\u603b\u8868" }]} />
          <MetricRowsCard title={"\u65e0\u7ebf\u627f\u8f7d"} icon="stack" metrics={[{ key: "radios", label: "\u65e0\u7ebf\u8bbe\u5907", value: s.operators.length + " \u5957" }, { key: "sharing", label: "\u5171\u4eab\u4e3b\u4f53", value: s.operators.length + " \u5bb6" }, { key: "services", label: "\u670d\u52a1\u4e1a\u52a1", value: "\u901a\u8bdd / \u6d41\u91cf / \u77ed\u4fe1" }]} />
        </div>
        <PanelCard title={"\u8d44\u6e90\u8bbe\u5907\u6e05\u5355"} icon="table" description={"\u5171\u7528\u8bbe\u65bd\u4e0e\u8fd0\u8425\u5546\u8bbe\u5907\u5206\u522b\u5f52\u5c5e"}><DataTable columns={deviceColumns} rows={demo.devices} rowKey={d => d.id} /></PanelCard>
        <p className="text-body-small text-muted-foreground">{"\u8bbe\u5907\u72b6\u6001\u9700\u7ed3\u5408\u73b0\u573a\u5de1\u68c0\u4e0e\u8d44\u4ea7\u8d44\u6599\u6838\u9a8c\u3002"}</p>
      </div>}
      {q.tab === "services" && <div className="flex flex-col gap-lg"><div className="site-dossier-layout">{serviceMap}
        <PanelCard title={"\u670d\u52a1\u53e3\u5f84"} icon="info"><DetailList><DetailRow label={"\u5efa\u8bbe\u8fd0\u8425\u4e3b\u4f53"}>{"\u4e2d\u56fd\u94c1\u5854"}</DetailRow><DetailRow label={"\u7269\u7406\u7ad9\u5740"}>{"1 \u5ea7"}</DetailRow><DetailRow label={"\u670d\u52a1\u5173\u7cfb"}>{s.operators.length + " \u6761"}</DetailRow><DetailRow label={"\u7ecf\u8425\u6570\u636e"}>{"\u6309\u8fd0\u8425\u5546\u670d\u52a1\u5173\u7cfb\u72ec\u7acb\u7edf\u8ba1"}</DetailRow><DetailRow label={"\u7ad9\u5740\u7535\u8017"}>{"\u7269\u7406\u7ad9\u603b\u8868\uff0c\u4e0d\u6309\u8fd0\u8425\u5546\u5206\u644a"}</DetailRow></DetailList></PanelCard></div>
        <PanelCard title={"\u8fd0\u8425\u5546\u670d\u52a1\u660e\u7ec6"} icon="users" description={time + " \u00b7 \u5168\u90e8\u5728\u7ad9\u8fd0\u8425\u5546"}><DataTable labels={{ rowActions: "\u64cd\u4f5c" }} columns={serviceColumns} rows={demo.relations} rowKey={r => r.id}
          className="site-action-table" rowActions={r => <ActionMenu label={operatorNames[r.code] + "\u670d\u52a1\u64cd\u4f5c"} items={[
            { id: "hourly-usage", label: "\u5730\u56fe\u65f6\u6bb5\u7528\u91cf", icon: "chart-line-up", onSelect: () => window.open(mapHref + "&operator=" + r.code + "&usage=hour", "_blank", "noopener,noreferrer") },
          ]} />} /></PanelCard>
      </div>}
      {q.tab === "runtime" && <div className="flex flex-col gap-lg">
        <div className="grid gap-md lg:grid-cols-3">
          <MetricRowsCard title={"\u8fd0\u8425\u72b6\u6001"} icon="gauge" description={demo.date + " \u00b7 " + time} metrics={[{ key: "load", label: "\u8d44\u6e90\u8d1f\u8f7d\u7387", value: pct(m.used / m.capacity) }, { key: "connection", label: "\u547c\u53eb\u63a5\u901a\u7387", value: pct(m.attempts ? m.connected / m.attempts : null) }, { key: "latency", label: "\u7f51\u7edc\u65f6\u5ef6", value: m.latency + " ms" }]} />
          <MetricRowsCard title={"\u8fd0\u884c\u53c2\u6570"} icon="lightning" description={time + " \u00b7 \u7269\u7406\u7ad9\u5740"} metrics={[{ key: "power", label: "\u4f9b\u7535\u65b9\u5f0f", value: m.power === "battery" ? "\u5907\u7528\u7535\u6c60" : "\u5e02\u7535" }, { key: "energy", label: "\u65f6\u6bb5\u7535\u8017", value: n((m.energyWh ?? 0) / 1000, 2) + " kWh" }, { key: "temperature", label: "\u73af\u5883\u6e29\u5ea6", value: m.temperature + " \u00b0C" }]} />
          {focus}
        </div><div className="grid gap-lg xl:grid-cols-2">
          <PanelCard title={"24 \u5c0f\u65f6\u8d1f\u8f7d"} icon="gauge" description={demo.date + " \u00b7 %"}><BarChart data={demo.series.map(h => ({ key: String(h.hour), label: String(h.hour).padStart(2, "0"), value: h.used / h.capacity * 100 }))} labelEvery={4} formatValue={v => n(v, 1) + "%"} peakLabel={"\u5cf0\u503c"} /></PanelCard>
          <PanelCard title={"24 \u5c0f\u65f6\u7ad9\u5740\u7535\u8017"} icon="lightning" description={demo.date + " \u00b7 kWh"}><BarChart data={demo.series.map(h => ({ key: String(h.hour), label: String(h.hour).padStart(2, "0"), value: (h.energyWh ?? 0) / 1000 }))} labelEvery={4} formatValue={v => n(v, 2)} peakLabel={"\u5cf0\u503c"} /></PanelCard>
        </div>
      </div>}
      {q.tab === "business" && <div className="flex flex-col gap-lg">
        <div className="flex flex-wrap items-center justify-between gap-md"><span className="text-body-small text-muted-foreground">{s.cityName + " / " + s.countyName + " \u00b7 " + periodLabel + " \u00b7 \u5317\u4eac\u65f6\u95f4"}</span>
          <SegmentedControl size="sm" value={q.period} ariaLabel={"\u7ecf\u8425\u5206\u6790\u5468\u671f"} onChange={period => navigate({ period })} items={[{ value: "day", label: "\u65e5" }, { value: "week", label: "\u5468" }, { value: "month", label: "\u6708" }]} /></div>
        <MetricGrid columns={3} items={[
          { id: "data", icon: "database", label: "\u5468\u671f\u6d41\u91cf", value: n(Number(p.usage.totals.bytes) / 1073741824, 2), description: "GiB \u00b7 \u4e0a\u4e0b\u884c\u5408\u8ba1" },
          { id: "voice", icon: "phone", label: "\u5468\u671f\u901a\u8bdd", value: n(p.usage.totals.voiceSeconds / 60, 1), description: "\u5206\u949f" },
          { id: "sms", icon: "file-text", label: "\u5468\u671f\u77ed\u4fe1", value: n(p.usage.totals.sms), description: "\u6761" },
        ]} />
        <div className="site-dossier-layout"><PanelCard title={q.period === "day" ? "\u5c0f\u65f6\u7528\u91cf\u8d70\u52bf" : "\u9010\u65e5\u7528\u91cf\u8d70\u52bf"} icon="chart-line-up" description={periodLabel + " \u00b7 " + unit}
          action={<SegmentedControl size="sm" value={metric} onChange={setMetric} items={metricOptions} ariaLabel={"\u5355\u7ad9\u7528\u91cf\u6307\u6807"} />}>
          <BarChart key={q.period + metric} labelEvery={q.period === "day" ? 4 : q.period === "month" ? 5 : 1} peakLabel={"\u5cf0\u503c"} formatValue={v => n(v, 1)}
            data={q.period === "day" ? demo.series.map(h => ({ key: String(h.hour), label: String(h.hour).padStart(2, "0"), value: scale(h[metric]) })) :
              p.days.map(d => ({ key: d.date, label: d.date.slice(5), value: scale(d.counters[metric]) }))} />
        </PanelCard><PanelCard title={"\u8fd0\u8425\u5546\u7ed3\u6784"} icon="chart-pie" description={"\u5468\u671f\u6d41\u91cf\u5360\u6bd4"}><div className="flex flex-col gap-lg">{demo.relations.map(r => <div key={r.id}>
          <div className="mb-sm flex justify-between gap-sm text-body-small"><span>{operatorNames[r.code]}</span><span>{pct(Number(r.usage.totals.bytes) / Number(p.usage.totals.bytes))}</span></div>
          <Progress value={Number(r.usage.totals.bytes) / Number(p.usage.totals.bytes) * 100} aria-label={operatorNames[r.code] + "\u5468\u671f\u6d41\u91cf\u5360\u6bd4"} />
        </div>)}</div></PanelCard></div>
        <PanelCard title={"\u7528\u91cf\u53d8\u5316\u4e0e\u6ce2\u52a8"} icon="chart-line-up" description={"\u5bf9\u6bd4\u5468\u671f \u00b7 " + windowLabel(p.previous.window)}>
          <DataTable rows={metricOptions} rowKey={r => r.value} columns={[
            { id: "metric", header: "\u7ecf\u8425\u6307\u6807", cell: r => r.label },
            { id: "change", header: "\u603b\u91cf\u73af\u6bd4", align: "right", cell: r => changeLabel(p.changes[r.value]) },
            { id: "daily", header: "\u65e5\u5747\u73af\u6bd4", align: "right", cell: r => changeLabel(p.changes[r.value], true) },
            { id: "waves", header: "\u6ce2\u52a8\u5c0f\u65f6", align: "right", cell: r => n(p.findings[r.value].count) },
            { id: "direction", header: "\u4e0a\u5347 / \u4e0b\u964d\u65f6\u6bb5", align: "right", cell: r => n(p.findings[r.value].up) + " / " + n(p.findings[r.value].down) },
          ]} />
          <p className="mt-md text-body-small text-muted-foreground">{"\u6ce2\u52a8\u57fa\u4e8e\u5386\u53f2\u56db\u5468\u540c\u661f\u671f\u3001\u540c\u5c0f\u65f6\u4e2d\u4f4d\u53c2\u8003\uff1b\u5468\u671f\u957f\u5ea6\u4e0d\u540c\u65f6\u540c\u65f6\u67e5\u770b\u65e5\u5747\u73af\u6bd4\u3002"}</p>
        </PanelCard>
        <PanelCard title={"\u8fd0\u8425\u5546\u5468\u671f\u7528\u91cf"} icon="table" description={periodLabel}><DataTable columns={usageColumns} rows={demo.relations} rowKey={r => r.id}
          footer={<div className="flex flex-wrap justify-between gap-md"><span className="text-body-small text-muted-foreground">{"\u5404\u8fd0\u8425\u5546\u4e1a\u52a1\u5206\u522b\u5f52\u96c6\uff1b\u7535\u8017\u4e0d\u5206\u644a\u3002"}</span><Button asChild size="sm" variant="secondary"><a href={"/api/product-preview/station/" + s.id + "/period/report?period=" + q.period + "&format=html"} download>{"\u5bfc\u51fa\u5355\u7ad9\u5468\u671f\u62a5\u544a"}<Icon name="arrow-right" size="sm" /></a></Button></div>} /></PanelCard>
      </div>}
      {q.tab === "sources" && <div className="flex flex-col gap-lg">
        <div className="site-dossier-layout"><PanelCard title={"\u6863\u6848\u6765\u6e90\u4e0e\u7248\u672c"} icon="database"><DetailList>
          <DetailRow label={"\u7ad9\u5740\u4e3b\u952e"}>{s.id}</DetailRow><DetailRow label={"\u8d44\u6e90\u6a21\u578b\u7248\u672c"}>{demo.version}</DetailRow><DetailRow label={"\u6307\u6807\u89c4\u5219\u7248\u672c"}>{demo.sourceVersion}</DetailRow>
          <DetailRow label={"\u72b6\u6001\u65f6\u95f4"}>{demo.date + " \u00b7 " + time + " \u00b7 \u5317\u4eac\u65f6\u95f4"}</DetailRow><DetailRow label={"\u7ecf\u8425\u5468\u671f"}>{periodLabel}</DetailRow><DetailRow label={"\u8d44\u6599\u5c5e\u6027"}>{"\u786e\u5b9a\u6027\u5408\u6210\u6570\u636e"}</DetailRow>
          <DetailRow label={"\u6b63\u5f0f\u6765\u6e90"}>{"\u5f85\u6388\u6743\u63a5\u5165"}</DetailRow><DetailRow label={"\u5b9e\u7269\u6838\u9a8c"}>{"\u672a\u5f00\u5c55"}</DetailRow></DetailList></PanelCard>
          <PanelCard title={"\u8d44\u6599\u6e05\u5355"} icon="file-text"><DetailList>
            <DetailRow label={"\u7ad9\u5740\u57fa\u7840\u6863\u6848"}>{"\u57fa\u7840\u6863\u6848\u53ef\u67e5"}</DetailRow><DetailRow label={"\u8d44\u6e90\u8bbe\u5907\u660e\u7ec6"}>{"\u573a\u666f\u6a21\u578b\u53ef\u67e5"}</DetailRow>
            <DetailRow label={"\u7ecf\u8425\u670d\u52a1\u5173\u7cfb"}>{"\u6309\u7a33\u5b9a\u7ad9\u5740\u4e0e\u8fd0\u8425\u5546\u7f16\u7801\u5173\u8054"}</DetailRow><DetailRow label={"\u6743\u5c5e / \u79df\u8d41\u51ed\u8bc1"}>{"\u672a\u63a5\u5165"}</DetailRow><DetailRow label={"\u5efa\u8bbe / \u9a8c\u6536\u8d44\u6599"}>{"\u672a\u63a5\u5165"}</DetailRow>
            <DetailRow label={"\u771f\u5b9e\u53d8\u66f4\u5386\u53f2"}>{"\u672a\u63a5\u5165\uff0c\u4e0d\u751f\u6210\u865a\u6784\u8bb0\u5f55"}</DetailRow></DetailList></PanelCard></div>
        <PanelCard title={"\u5173\u8054\u5206\u6790\u4e0e\u62a5\u544a"} icon="file-text"><div className="flex flex-wrap gap-md">
          <Button asChild variant="secondary"><a href={"/api/product-preview/station/" + s.id + "/period/report?period=" + q.period + "&format=html"} download>{"\u5355\u7ad9\u5468\u671f\u62a5\u544a"}</a></Button>
          <Button onClick={() => navigate({ tab: "business" })}>{"\u5355\u7ad9\u7ecf\u8425\u7528\u91cf"}</Button>
        </div></PanelCard>
      </div>}
    </div>
  </div>;
}
