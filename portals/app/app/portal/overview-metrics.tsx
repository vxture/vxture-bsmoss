"use client";
import { useState } from "react";
import { Button, DataTable, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, EmptyState, Icon,
  LabeledValue, PanelCard, PanelItem, PanelList, SegmentedControl } from "@vxture/design-system";
import { CATEGORIES, type Category } from "../domains/catalog/registry";
import { businessHref, type BusinessScope } from "../business-analysis/links";
import { categoryNames, metricDisplay, OVERVIEW_METRICS, overviewUnit, type OverviewMetricDefinition, type OverviewUnit } from "./metric-catalog";
import { useOverviewDisplay } from "./overview-display";
import type { PortalDemo } from "./demo";
type Fact = PortalDemo["metrics"]["rows"][number];

export function overviewChangeLabel(fact: Fact, def: OverviewMetricDefinition, unit: OverviewUnit) {
  if (fact.change.status === "unavailable") return "\u4e0d\u53ef\u6bd4";
  if (fact.change.status === "from_zero") return "\u4ece\u96f6\u65b0\u589e";
  if (fact.change.status === "both_zero") return "\u4e24\u671f\u5747\u4e3a\u96f6";
  const value = fact.change.amount!;
  const prefix = value > 0 ? "+" : value < 0 ? "\u2212" : "";
  const absolute = Math.abs(value);
  return def.change === "rate" ? prefix + (absolute * 100).toLocaleString("zh-CN", { maximumFractionDigits: 1 }) + "%" :
    def.change === "points" ? prefix + absolute.toLocaleString("zh-CN", { maximumFractionDigits: 2 }) + " \u4e2a\u767e\u5206\u70b9" :
      prefix + metricDisplay(absolute, unit, def.precision) + " " + overviewUnit(unit).label;
}
const icons = { business_service: "chart-bar", operational_status: "gauge", runtime_parameter: "lightning" } as const;
const tones = { business_service: "brand", operational_status: "info", runtime_parameter: "success" } as const;
function metricValue(value: string) {
  const groups = value.split(",");
  return <span className="block whitespace-normal">{groups.map((group, i) => <span key={i}>{i > 0 && <wbr />}{group}{i < groups.length - 1 ? "," : ""}</span>)}</span>;
}

export default function OverviewMetrics({ demo, scope }: { demo: PortalDemo; scope: BusinessScope }) {
  const { preference, message } = useOverviewDisplay();
  const [category, setCategory] = useState<Category>("business_service"), [open, setOpen] = useState(false);
  const data = demo.metrics, hour = String(data.hour).padStart(2, "0") + ":00";
  const fact = (id: string) => data.rows.find(row => row.id === id)!;
  const def = (id: string) => OVERVIEW_METRICS.find(row => row.id === id)!;
  const destination = (c: Category) => businessHref(c === "business_service" ? "operator-usage" : c === "operational_status" ? "capacity" : "efficiency", scope);
  return <section className="flex min-w-0 flex-col gap-sm" aria-label={"\u4e09\u57df\u8fd0\u884c\u6458\u8981"} data-overview-metrics={data.version}>
    <div className="grid min-w-0 gap-md lg:grid-cols-3">
      {CATEGORIES.map(c => <PanelCard key={c} title={categoryNames[c]} icon={icons[c]} tone={tones[c]} className="min-w-0">
        <PanelList>
        {preference.selections[c].map(selection => {
          const d = def(selection.id), f = fact(selection.id);
          return <PanelItem key={d.id}
            main={<LabeledValue label={<span className="block whitespace-normal">{d.label + " / " + overviewUnit(selection.unit).label}</span>}
              value={<span className="tabular-nums">{metricValue(metricDisplay(f.current, selection.unit, d.precision))}</span>} />}
            trail={<div className="flex flex-col gap-2xs text-body-small text-muted-foreground">
              <span>{d.basis === "day" ? "\u8f83\u6628\u65e5" : "\u8f83\u6628\u65e5\u540c\u65f6"}</span>
              <span className="tabular-nums">{overviewChangeLabel(f, d, selection.unit)}</span>
            </div>} />;
        })}
        </PanelList>
        <div className="mt-md flex flex-wrap items-center justify-between gap-sm border-t border-border pt-sm">
          <Button size="sm" variant="ghost" onClick={() => { setCategory(c); setOpen(true); }}>{"\u5168\u90e8\u6307\u6807 " + OVERVIEW_METRICS.filter(d => d.category === c).length}</Button>
          <Button asChild size="sm" variant="ghost"><a href={destination(c)}>{"\u4e13\u9898\u5206\u6790"}<Icon name="arrow-right" size="sm" /></a></Button>
        </div>
      </PanelCard>)}
    </div>
    {message && <p role="status" className="text-body-small text-muted-foreground">{message}</p>}
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent width="xl" className="grid-cols-1 w-[calc(100dvw-var(--space-xl))] max-h-[calc(100dvh-var(--space-xl))] overflow-y-auto">
        <DialogHeader><DialogTitle>{"\u4e09\u57df\u6307\u6807\u660e\u7ec6"}</DialogTitle>
          <DialogDescription>{data.currentDate + " \u5bf9\u6bd4 " + data.previousDate + " \u00b7 \u540c\u8303\u56f4\u7ad9\u7fa4 \u00b7 \u65f6\u70b9 " + hour}</DialogDescription></DialogHeader>
        <div className="flex min-w-0"><SegmentedControl ariaLabel={"\u6307\u6807\u7c7b\u522b"} value={category} onChange={setCategory} items={CATEGORIES.map(c => ({ value: c, label: categoryNames[c] }))} /></div>
        <div className="min-w-0"><DataTable rows={OVERVIEW_METRICS.filter(d => d.category === category)} rowKey={d => d.id} columns={[
          { id: "metric", header: "\u6307\u6807 / \u5355\u4f4d", cell: d => <div className="flex flex-col gap-xs"><span className="whitespace-nowrap">{d.label + " / " + overviewUnit(d.units[0]).label}</span><span className="text-body-small text-muted-foreground">{d.description}</span></div> },
          { id: "current", header: "\u672c\u671f", align: "numeric", cell: d => metricDisplay(fact(d.id).current, d.units[0], d.precision) },
          { id: "previous", header: "\u6628\u65e5", align: "numeric", cell: d => metricDisplay(fact(d.id).previous, d.units[0], d.precision) },
          { id: "change", header: "\u53d8\u5316", cell: d => <span className="whitespace-nowrap text-body-small">{overviewChangeLabel(fact(d.id), d, d.units[0])}</span> },
          { id: "basis", header: "\u7edf\u8ba1\u7a97\u53e3", cell: d => <span className="whitespace-nowrap">{d.basis === "day" ? "\u5168\u65e5 00\u201324\u65f6" : hour}</span> },
          { id: "coverage", header: "\u6709\u6548 / \u5e94\u6709\u7ad9\u65f6", cell: d => <span className="whitespace-nowrap">{fact(d.id).observed.toLocaleString("zh-CN") + " / " + fact(d.id).expected.toLocaleString("zh-CN")}</span> },
        ]} empty={<EmptyState title={"\u6682\u65e0\u6307\u6807"} />} /></div>
        <p className="text-body-small text-muted-foreground">{"\u7d2f\u8ba1\u91cf\u6bd4\u8f83\u589e\u51cf\u6bd4\u4f8b\uff1b\u6bd4\u7387\u6bd4\u8f83\u767e\u5206\u70b9\uff1b\u6e29\u5ea6\u3001\u65f6\u5ef6\u4e0e\u7ad9\u5740\u6570\u6bd4\u8f83\u539f\u5355\u4f4d\u5dee\u503c\u3002\u96f6\u57fa\u671f\u4e0d\u8ba1\u7b97\u767e\u5206\u6bd4\uff0c\u6837\u672c\u4e0d\u8db3\u4e0d\u4f5c\u6bd4\u8f83\u3002"}</p>
        <div className="flex flex-wrap items-center justify-between gap-md text-body-small text-muted-foreground">
          <span>{data.physicalSites.toLocaleString("zh-CN") + "\u5ea7\u7269\u7406\u7ad9\u5740 \u00b7 " + data.serviceRelations.toLocaleString("zh-CN") + "\u6761\u670d\u52a1\u5173\u7cfb"}</span>
          <Button asChild variant="outline"><a href="/preferences/overview">{"\u603b\u89c8\u504f\u597d"}</a></Button>
        </div>
        <details className="min-w-0 text-body-small text-muted-foreground"><summary className="cursor-pointer">{"\u6765\u6e90\u4e0e\u53e3\u5f84\u7248\u672c"}</summary>
          <div className="flex flex-col gap-xs break-all pt-sm"><span>{data.sourceVersion}</span><span>{data.ruleVersion}</span><span>{data.version}</span></div>
        </details>
      </DialogContent>
    </Dialog>
  </section>;
}
