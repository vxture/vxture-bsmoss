"use client";
import { useState } from "react";
import { Button, DataTable, Drawer, EmptyState, Icon, InputGroup, InputGroupAddon, InputGroupInput, NativeSelect, ShellPageContainer, StatusBadge } from "@vxture/design-system";
import PageHeading from "../../portal/page-heading";
import { FIRST_METRICS } from "../../domains/catalog/first-metrics";
import { CATEGORIES, refKey, type MetricDefinition } from "../../domains/catalog/registry";
import { reportLabels } from "../../domains/reports/display";
const words: Record<string, string> = {
 byte: "B", second: "\u79d2", minute: "\u5206\u949f", hour: "\u5c0f\u65f6", day: "\u65e5", week: "\u5468", month: "\u6708", "15m": "15\u5206\u949f", count: "\u6b21 / \u6761",
 enum: "\u72b6\u6001", ratio: "\u6bd4\u4f8b", degC: "\u00b0C", state: "\u72b6\u6001", device_count: "\u8bbe\u5907\u6570",
 network_object: "\u7f51\u7edc\u5bf9\u8c61", cell: "\u5c0f\u533a", station_meter: "\u7ad9\u5740\u7535\u8868", device: "\u8bbe\u5907",
 service_required: "\u8fd0\u8425\u5546\u670d\u52a1\u5173\u7cfb", physical_object: "\u7269\u7406\u5bf9\u8c61",
 sum: "\u533a\u95f4\u589e\u91cf\u6c42\u548c", derived_sum: "\u4f9d\u8d56\u6307\u6807\u6c42\u548c", ratio_parts: "\u7d2f\u8ba1\u5206\u5b50 / \u7d2f\u8ba1\u5206\u6bcd",
 state_duration: "\u72b6\u6001\u6301\u7eed\u65f6\u95f4", gauge_summary: "\u65f6\u957f\u6216\u6837\u672c\u6c47\u603b", disjoint_sum: "\u4e92\u65a5\u5bf9\u8c61\u6c42\u548c",
 state_counts: "\u8bbe\u5907\u72b6\u6001\u5206\u5e03", not_additive: "\u4e0d\u53ef\u76f4\u63a5\u76f8\u52a0",
 interval_delta: "\u533a\u95f4\u589e\u91cf", derived: "\u4f9d\u8d56\u8ba1\u7b97", state_semantic: "\u72b6\u6001\u65f6\u5e8f", gauge: "\u89c2\u6d4b\u503c",
 planned: "\u5f85\u63a5\u5165", validated: "\u5df2\u6821\u9a8c", active: "\u5df2\u542f\u7528", retired: "\u5df2\u9000\u5f79",
};
const word = (key: string) => words[key] ?? key;
const metricUnit = (m: Readonly<MetricDefinition>, unit: string) => unit === "count" ? m.code.startsWith("service.sms.") ? "\u6761" : "\u6b21" : word(unit);
const metrics = FIRST_METRICS.list();
export default function MetricCatalog() {
 const [search, setSearch] = useState(""), [category, setCategory] = useState("all"), [selection, setSelection] = useState<string | null>(null);
 const rows = metrics.filter(m => (category === "all" || m.category === category) && (reportLabels[m.code] + " " + m.code).toLowerCase().includes(search.trim().toLowerCase()));
 const selected = rows.find(m => refKey(m) === selection);
 return <ShellPageContainer className="gap-lg">
  <PageHeading title={"\u6307\u6807\u5b57\u5178"} description={"\u67e5\u770b\u4ea7\u54c1\u6ce8\u518c\u7684\u6307\u6807\u5b9a\u4e49\u3001\u8ba1\u91cf\u5355\u4f4d\u4e0e\u7edf\u8ba1\u89c4\u5219"}
    context={<span>{"\u5df2\u6ce8\u518c " + metrics.length + " \u9879 \u00b7 \u53ea\u8bfb\u89c4\u8303"}</span>}
    actions={<Button asChild variant="outline"><a href="/settings/templates">{"\u6a21\u677f\u914d\u7f6e"}</a></Button>}
    toolbar={<div className="flex flex-wrap items-center gap-lg">
      <NativeSelect aria-label={"\u6307\u6807\u5206\u7c7b"} wrapperClassName="w-auto" value={category} onChange={e => setCategory(e.target.value)}>
        <option value="all">{"\u5168\u90e8\u5206\u7c7b"}</option>{CATEGORIES.map(c => <option key={c} value={c}>{reportLabels[c]}</option>)}
      </NativeSelect>
      <div className="min-w-0 sm:ml-auto"><InputGroup><InputGroupAddon><Icon name="search" size="sm" /></InputGroupAddon>
        <InputGroupInput aria-label={"\u68c0\u7d22\u6307\u6807"} placeholder={"\u6307\u6807\u540d\u79f0 / \u7f16\u7801"} value={search} onChange={e => setSearch(e.target.value)} /></InputGroup></div>
    </div>} />
  <p className="text-body-small text-muted-foreground">{"\u5b57\u5178\u7248\u672c\u5b9a\u4e49\u7edf\u8ba1\u53e3\u5f84\uff1b\u6765\u6e90\u63a5\u5165\u4e0e\u6570\u636e\u53ef\u7528\u6027\u9700\u5355\u72ec\u6838\u9a8c\u3002"}</p>
  <DataTable rows={rows} rowKey={refKey} empty={<EmptyState title={"\u6ca1\u6709\u5339\u914d\u6307\u6807"} description={"\u8bf7\u8c03\u6574\u5206\u7c7b\u6216\u68c0\u7d22\u6761\u4ef6"} />}
    columns={[
      { id: "name", header: "\u6307\u6807\u540d\u79f0", cell: m => <Button variant="ghost" className="h-auto justify-start px-0 text-left" onClick={() => setSelection(refKey(m))} aria-expanded={selection === refKey(m)}>{reportLabels[m.code]}</Button> },
      { id: "category", header: "\u6307\u6807\u5206\u7c7b", cell: m => reportLabels[m.category] },
      { id: "unit", header: "\u57fa\u672c\u5355\u4f4d", cell: m => metricUnit(m, m.unit) },
      { id: "version", header: "\u5b9a\u4e49\u7248\u672c", cell: m => "v" + m.version },
      { id: "state", header: "\u63a5\u5165\u72b6\u6001", cell: m => <StatusBadge tone="neutral" size="sm">{word(m.lifecycle)}</StatusBadge> },
    ]} />
  <Drawer open={!!selected} onClose={() => setSelection(null)} title={selected ? reportLabels[selected.code] : "\u6307\u6807\u8be6\u60c5"} side="right" width="lg" className="max-w-full" closeLabel={"\u5173\u95ed\u8be6\u60c5"}>{selected && <MetricDetail key={refKey(selected)} metric={selected} />}</Drawer>
 </ShellPageContainer>;
}
function MetricDetail({ metric: m }: { metric: Readonly<MetricDefinition> }) {
 const facts = [
  ["\u6307\u6807\u7f16\u7801", m.code], ["\u5b9a\u4e49\u7248\u672c", "v" + m.version], ["\u6307\u6807\u5206\u7c7b", reportLabels[m.category]],
  ["\u8ba1\u91cf\u5bf9\u8c61", word(m.object)], ["\u5f52\u5c5e\u7ef4\u5ea6", word(m.attribution)], ["\u8ba1\u91cf\u8bed\u4e49", word(m.semantic === "state" ? "state_semantic" : m.semantic)],
  ["\u65f6\u95f4\u805a\u5408", word(m.timeAggregation)], ["\u5bf9\u8c61\u6c47\u603b", word(m.objectAggregation)],
  ["\u53ef\u7528\u7c92\u5ea6", m.grains.map(word).join(" / ")], ["\u663e\u793a\u5355\u4f4d", m.displayUnits.map(unit => metricUnit(m, unit)).join(" / ")],
 ];
 return <div className="min-w-0">
  <div className="flex flex-col gap-lg">
   <dl className="grid min-w-0 gap-lg md:grid-cols-2">{facts.map(([label,value]) => <div key={label} className="min-w-0"><dt className="text-body-small text-muted-foreground">{label}</dt><dd className="break-words text-body">{value}</dd></div>)}</dl>
   <div className="border-t border-dashed border-border pt-lg"><h3 className="text-label font-medium">{"\u4f9d\u8d56\u6307\u6807"}</h3>
    {m.dependencies.length ? <ul className="mt-sm flex flex-col gap-sm">{m.dependencies.map(d => <li key={refKey(d)} className="text-body-small">{reportLabels[d.code]}{" \u00b7 v" + d.version}<span className="block break-all text-muted-foreground">{d.code}</span></li>)}</ul> : <p className="mt-sm text-body-small text-muted-foreground">{"\u65e0\u5b57\u5178\u5185\u6d3e\u751f\u4f9d\u8d56\uff1b\u91c7\u96c6\u5b57\u6bb5\u4e0e\u6620\u5c04\u6309\u6765\u6e90\u914d\u7f6e\u6838\u9a8c\u3002"}</p>}
   </div>
   {m.code === "runtime.energy.site_wh" && <p className="text-body-small text-muted-foreground">{"\u7269\u7406\u7ad9\u5740\u7535\u8017\u6309\u7535\u8868\u5f52\u5c5e\u6c47\u603b\uff0c\u4e0d\u6309\u8fd0\u8425\u5546\u91cd\u590d\u5206\u644a\u3002"}</p>}
  </div>
 </div>;
}
