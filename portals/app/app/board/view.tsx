"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart, Button, Icon, MetricListCard, NativeSelect, PanelCard, Progress, SegmentedControl,
  ShellPageContainer, Slider, StatusBadge, ViewHeader } from "@vxture/design-system";
import type { BoardDemo } from "./model";
import type { BoardTheme } from "./network-map";
import "./board.css";
const NetworkMap = dynamic(() => import("./network-map"), { ssr: false, loading: () =>
  <div className="flex h-full items-center justify-center text-body-small text-muted-foreground">{"\u5730\u56fe\u52a0\u8f7d\u4e2d"}</div> });
const names: Record<string, string> = { mobile: "\u79fb\u52a8", telecom: "\u7535\u4fe1", unicom: "\u8054\u901a", broadcast: "\u5e7f\u7535", other: "\u5176\u4ed6" };
const n = (value: number, digits = 0) => value.toLocaleString("zh-CN", { maximumFractionDigits: digits });
const pct = (value: number | null) => value === null ? "\u2014" : n(value * 100, 1) + "%";
const themes: { value: BoardTheme; label: string; icon: "gauge" | "chart-bar" | "lightning" }[] = [
  { value: "status", label: "\u8fd0\u8425\u72b6\u6001", icon: "gauge" }, { value: "traffic", label: "\u7ecf\u8425\u670d\u52a1", icon: "chart-bar" },
  { value: "energy", label: "\u8fd0\u884c\u53c2\u6570", icon: "lightning" },
];
export default function DecisionBoard({ demo }: { demo: BoardDemo }) {
  const router = useRouter(), root = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<BoardTheme>("status"), [playing, setPlaying] = useState(false);
  const [full, setFull] = useState(false), [fullscreenError, setFullscreenError] = useState(false);
  const [hour, setHour] = useState(demo.hour);
  useEffect(() => { setHour(demo.hour); }, [demo.hour]);
  const navigate = (city: string, nextHour: number) => {
    const params = new URLSearchParams({ hour: String(nextHour) }); if (city !== "all") params.set("city", city);
    router.replace("/board?" + params, { scroll: false });
  };
  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => navigate(demo.cityId, (demo.hour + 1) % 24), 2500);
    return () => clearTimeout(timer);
    // Advance only after the new server snapshot arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, demo.hour, demo.cityId]);
  useEffect(() => {
    const change = () => setFull(document.fullscreenElement === root.current);
    document.addEventListener("fullscreenchange", change);
    return () => document.removeEventListener("fullscreenchange", change);
  }, []);
  const city = demo.region.cities.find(item => item.id === demo.cityId);
  const s = demo.snapshot.summary;
  const context = demo.hour.toString().padStart(2, "0") + ":00";
  const scope = (extra = "") => "/product-preview?hour=" + demo.hour + (city ? "&city=" + city.id : "") + extra;
  const unit = theme === "traffic" ? "GiB" : theme === "energy" ? "kWh" : "%";
  const value = (item: BoardDemo["cities"][number]) => theme === "traffic" ? n(item.bytes / 1073741824, 1) :
    theme === "energy" ? item.energyWh === null ? "\u2014" : n(item.energyWh / 1000, 1) : pct(item.load);
  const orderedCities = [...demo.cities].sort((a, b) =>
    theme === "status" ? (b.load ?? -1) - (a.load ?? -1) : theme === "energy" ? (b.energyWh ?? -1) - (a.energyWh ?? -1) : b.bytes - a.bytes);
  const chart = demo.series.map(row => ({ key: String(row.hour), label: row.hour.toString().padStart(2, "0"),
    value: theme === "traffic" ? row.bytes / 1073741824 : theme === "energy" ? (row.energyWh ?? 0) / 1000 : (row.load ?? 0) * 100 }));
  return <div ref={root} className="decision-board bg-background" data-board-mode="demo">
    <ShellPageContainer className="product-page-inset max-w-none">
      <div className="flex min-w-0 flex-col gap-lg">
        <ViewHeader className="max-sm:flex-col max-sm:items-stretch" title={"\u51b3\u7b56\u5927\u5c4f"} description={(city?.name ?? "\u9655\u897f\u7701") + " \u00b7 " + demo.date + " \u00b7 " + context}
          action={<div className="flex flex-wrap items-center gap-sm">
            <NativeSelect aria-label={"\u5927\u5c4f\u5730\u5e02"} value={demo.cityId} onChange={event => { setPlaying(false); navigate(event.target.value, demo.hour); }} wrapperClassName="w-auto">
              <option value="all">{"\u9655\u897f\u5168\u7701"}</option>{demo.region.cities.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </NativeSelect>
            <Button asChild variant="secondary"><a target="_blank" rel="noopener noreferrer" href={scope()}><Icon name="map-pin" size="sm" />{"\u5730\u56fe\u5de5\u4f5c\u53f0"}</a></Button>
            <Button variant="ghost" aria-label={full ? "\u9000\u51fa\u5168\u5c4f" : "\u8fdb\u5165\u5168\u5c4f"} onClick={async () => {
              try { if (document.fullscreenElement) await document.exitFullscreen(); else await root.current?.requestFullscreen(); setFullscreenError(false); }
              catch { setFullscreenError(true); }
            }}><Icon name={full ? "minimize" : "maximize"} size="sm" /></Button>
          </div>} />
        {fullscreenError && <p role="status" className="text-body-small text-muted-foreground">{"\u5f53\u524d\u6d4f\u89c8\u5668\u4e0d\u652f\u6301\u5168\u5c4f\uff0c\u53ef\u7ee7\u7eed\u4f7f\u7528\u5f53\u524d\u89c6\u56fe\u3002"}</p>}
        <section className="grid gap-md lg:grid-cols-3" aria-label={"\u5927\u5c4f\u4e09\u7c7b\u6307\u6807"}>
          <MetricListCard title={"\u7ecf\u8425\u670d\u52a1"} icon="chart-bar" tone="brand" description={context + " \u00b7 \u65f6\u6bb5\u7528\u91cf"}
            metrics={[{ key: "data", label: "\u6d41\u91cf / GiB", value: n(s.bytes / 1073741824, 1) },
              { key: "voice", label: "\u901a\u8bdd / \u4e07\u5206\u949f", value: n(s.voiceSeconds / 600000, 2) }, { key: "sms", label: "\u77ed\u4fe1 / \u4e07\u6761", value: n(s.sms / 10000, 2) }]} />
          <MetricListCard title={"\u8fd0\u8425\u72b6\u6001"} icon="gauge" tone="info" description={context + " \u00b7 \u52a0\u6743\u72b6\u6001"}
            metrics={[{ key: "connection", label: "\u63a5\u901a\u7387", value: pct(s.connectionRate) }, { key: "load", label: "\u8d44\u6e90\u8d1f\u8f7d", value: pct(s.load) },
              { key: "attention", label: "\u5173\u6ce8 / \u91cd\u70b9", value: n(s.warning) + " / " + n(s.critical) }]} />
          <MetricListCard title={"\u8fd0\u884c\u53c2\u6570"} icon="lightning" tone="success" description={context + " \u00b7 \u7269\u7406\u7ad9\u5740"}
            metrics={[{ key: "energy", label: "\u7535\u8017 / kWh", value: s.energyWh === null ? "\u2014" : n(s.energyWh / 1000, 1) },
              { key: "sites", label: "\u7ad9\u5740 / \u5ea7", value: n(s.count) }, { key: "relations", label: "\u670d\u52a1\u5173\u7cfb / \u6761", value: n(demo.usage.serviceRelations) }]} />
        </section>
        <div className="decision-board-grid">
          <PanelCard title={(city?.name ?? "\u9655\u897f") + "\u7ad9\u7f51\u6001\u52bf"} icon="map-pin"
            description={themes.find(item => item.value === theme)!.label + " \u00b7 " + context}
            className="min-w-0">
            <div className="flex justify-end pb-md"><SegmentedControl items={themes} value={theme} onChange={setTheme} size="sm" ariaLabel={"\u5927\u5c4f\u4e13\u9898"} /></div>
            <div className="decision-map overflow-hidden rounded-md"><NetworkMap demo={demo} theme={theme}
              onPick={id => { setPlaying(false); window.open(scope("&site=" + encodeURIComponent(id)), "_blank", "noopener,noreferrer"); }} /></div>
            <div className="flex flex-wrap items-center justify-between gap-sm pt-md text-body-small text-muted-foreground">
              <span>{n(s.count) + " \u5ea7\u7ad9\u5740"}</span>
              {theme === "status" ? <div className="flex gap-sm"><StatusBadge tone="success" size="sm">{"\u6b63\u5e38 " + n(s.normal)}</StatusBadge>
                <StatusBadge tone="warning" size="sm">{"\u5173\u6ce8 " + n(s.warning)}</StatusBadge><StatusBadge tone="danger" size="sm">{"\u91cd\u70b9 " + n(s.critical)}</StatusBadge></div> :
                <span>{theme === "traffic" ? "\u70b9\u4f4d\u5927\u5c0f\u8868\u793a\u6d41\u91cf \u00b7 GiB" : "\u70b9\u4f4d\u5927\u5c0f\u8868\u793a\u7269\u7406\u7535\u8017 \u00b7 kWh"}</span>}
            </div>
          </PanelCard>
          <div className="flex min-w-0 flex-col gap-md">
            <PanelCard title={"\u5730\u5e02\u5bf9\u6bd4"} icon="city" description={(theme === "status" ? "\u8d44\u6e90\u8d1f\u8f7d" : theme === "traffic" ? "\u65f6\u6bb5\u6d41\u91cf" : "\u7269\u7406\u7535\u8017") + " \u00b7 " + unit}
              action={city ? <Button variant="ghost" size="sm" onClick={() => navigate("all", demo.hour)}>{"\u5168\u7701"}</Button> : undefined}>
              <div className="flex flex-col gap-sm">{orderedCities.map(item => <Button key={item.id} variant={item.id === demo.cityId ? "secondary" : "ghost"}
                className="w-full justify-between" onClick={() => { setPlaying(false); navigate(item.id, demo.hour); }}>
                <span>{item.name}</span><span className="tabular-nums text-muted-foreground">{value(item)}</span>
              </Button>)}</div>
            </PanelCard>
            <PanelCard title={"\u91cd\u70b9\u7ad9\u5740"} icon="flag" description={context + " \u00b7 \u6309\u72b6\u6001\u4e0e\u6d41\u91cf\u6392\u5e8f"} tone="warning">
              <div className="flex flex-col gap-sm">{demo.snapshot.ranking.slice(0, 3).map(item => <a key={item.id} target="_blank" rel="noopener noreferrer" href={scope("&site=" + encodeURIComponent(item.id))}
                className="flex items-center justify-between gap-sm text-body-small text-foreground no-underline hover:text-primary-text">
                <span className="min-w-0 truncate">{item.name}</span><StatusBadge tone={item.status === "critical" ? "danger" : item.status === "warning" ? "warning" : "success"} size="sm">
                  {item.status === "critical" ? "\u91cd\u70b9" : item.status === "warning" ? "\u5173\u6ce8" : "\u6b63\u5e38"}</StatusBadge>
              </a>)}</div>
            </PanelCard>
          </div>
        </div>
        <section className="grid gap-md xl:grid-cols-3">
          <PanelCard title={"\u65f6\u5e8f\u6001\u52bf"} icon="clock" description={demo.date + " \u00b7 24\u5c0f\u65f6 \u00b7 " + unit} className="min-w-0 xl:col-span-2"
            action={<div className="flex items-center gap-sm"><span className="text-body-small tabular-nums">{context}</span>
              <Button size="sm" variant="secondary" aria-label={playing ? "\u6682\u505c\u56de\u653e" : "\u64ad\u653e\u65f6\u5e8f"} onClick={() => setPlaying(current => !current)}><Icon name={playing ? "pause" : "play"} size="sm" /></Button></div>}>
            <BarChart key={theme} data={chart} formatValue={v => n(v, 1)} peakLabel={"\u5cf0\u503c"} labelEvery={4} aria-label={"24\u5c0f\u65f6" + themes.find(item => item.value === theme)!.label} />
            <div className="flex items-center gap-md pt-md"><span className="text-label-small">00</span>
              <Slider min={0} max={23} step={1} value={[hour]} onValueChange={v => { setPlaying(false); setHour(v[0]); }} onValueCommit={v => navigate(demo.cityId, v[0])} aria-label={"\u5927\u5c4f\u65f6\u6bb5"} />
              <span className="text-label-small">23</span></div>
          </PanelCard>
          <PanelCard title={"\u8fd0\u8425\u5546\u7528\u91cf"} icon="chart-pie" description={context + " \u00b7 \u6d41\u91cf\u5360\u6bd4"} className="min-w-0">
            <div className="flex flex-col gap-md">{demo.usage.rows.map(row => <a key={row.code} target="_blank" rel="noopener noreferrer" href={scope("&usage=hour&operator=" + row.code)} className="flex flex-col gap-2xs no-underline">
              <div className="flex justify-between gap-sm text-body-small"><span className="text-foreground">{names[row.code]}</span>
                <span className="tabular-nums text-muted-foreground">{n(row.bytes / 1073741824, 1) + " GiB \u00b7 " + pct(s.bytes ? row.bytes / s.bytes : null)}</span></div>
              <Progress value={s.bytes ? row.bytes / s.bytes * 100 : 0} aria-label={names[row.code] + "\u6d41\u91cf\u5360\u6bd4"} />
            </a>)}</div>
          </PanelCard>
        </section>
        <p className="text-body-small text-content-tertiary">{"\u7edf\u8ba1\u53e3\u5f84\uff1a\u7ad9\u5740\u6309\u7269\u7406\u8d44\u6e90\u8ba1\u6570\uff0c\u8fd0\u8425\u5546\u6309\u670d\u52a1\u5173\u7cfb\u5f52\u96c6\uff1b\u7269\u7406\u7535\u8017\u4e0d\u5206\u644a\u3002"}</p>
      </div>
    </ShellPageContainer>
  </div>;
}
