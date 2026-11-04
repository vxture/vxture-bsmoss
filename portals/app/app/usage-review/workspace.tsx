"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ActionMenu, Button, Collapsible, CollapsibleContent, CollapsibleTrigger, DataTable, EmptyState, Icon, InputGroup, InputGroupAddon, InputGroupInput, ListCard, NativeSelect, Pagination, SegmentedControl, StatusBadge, TableTitleCell, ViewHeader } from "@vxture/design-system";
import type { ReviewListModel, ReviewCase } from "../domains/usage-verification/demo";
import { reviewHref, reviewMapHref } from "../domains/usage-verification/links";
import type { ReviewQuery } from "../domains/usage-verification/query";
import { calendarLabel } from "../domains/map-demo/period-rules";
import { operatorNames } from "../sites/labels";
import { categoryNames, kindNames, metricNames, quantity, deviation, statusNames, timeLabel, windowLabel } from "./labels";
import "./review.css";
export function FindingBadge({ item }: { item: Pick<ReviewCase, "kind" | "category"> }) {
  return <StatusBadge tone={item.category === "quality" ? "warning" : item.category === "insufficient" ? "neutral" : "info"} size="sm">{kindNames[item.kind]}</StatusBadge>;
}
export default function ReviewWorkspace({ model }: { model: ReviewListModel }) {
  const router = useRouter(), [pending, start] = useTransition(), [search, setSearch] = useState(model.query.scope.search), [summary, setSummary] = useState(false), q = model.query;
  const navigate = (patch: Partial<ReviewQuery>, scope: Partial<ReviewQuery["scope"]> = {}) => start(() => router.push(reviewHref({ ...q, page: 1, ...patch, scope: { ...q.scope, ...scope } }), { scroll: false }));
  const actions = (c: ReviewCase) => <ActionMenu label={"\u6838\u9a8c\u64cd\u4f5c\uff1a" + c.site.name} items={[
    { id: "evidence", label: "\u67e5\u770b\u8bc1\u636e", icon: "search", onSelect: () => router.push(reviewHref(q, c.id)) },
    { id: "site", label: "\u7ad9\u5740\u6863\u6848", icon: "building", onSelect: () => router.push("/sites/" + c.site.id + "?tab=business&period=" + q.period) },
    { id: "map", label: "\u5730\u56fe\u5b9a\u4f4d", icon: "map-pin", onSelect: () => window.open(reviewMapHref({ ...q, scope: { ...q.scope, operator: c.operator } }, c.site.id), "_blank", "noopener,noreferrer") },
  ]} />;
  return <div data-usage-review="list" aria-busy={pending} className="review-workspace product-page-inset flex h-full min-h-0 w-full flex-col gap-md">
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-md">
      <div className="flex min-w-0 flex-wrap items-center gap-md"><ViewHeader title={"\u7528\u91cf\u6838\u9a8c"} divider={false} className="pb-0" /><div className="flex flex-wrap items-center gap-sm text-body-small text-muted-foreground"><span className="text-label text-foreground">{model.scopeName}</span><span>{calendarLabel(q.period)}</span>
        {q.scope.selection && <StatusBadge tone="info" size="sm">{"\u5730\u56fe\u9009\u533a"}</StatusBadge>}<span>{"\u6570\u636e\u622a\u81f3 "}<time dateTime={model.cutoff}>{timeLabel(model.cutoff)}</time></span></div>
      </div>
      <div className="flex items-center gap-sm"><Button variant="ghost" size="icon-md" aria-label={"\u5237\u65b0\u6838\u9a8c\u5217\u8868"} disabled={pending} onClick={() => start(() => router.refresh())}><Icon name="refresh" size="sm" className={pending ? "animate-spin" : undefined} /></Button><Button asChild variant="outline"><a target="_blank" rel="noopener noreferrer" href={reviewMapHref(q)}><Icon name="map-pin" size="sm" />{"\u7ad9\u7f51\u5730\u56fe"}</a></Button></div>
    </div>
    <div className="flex shrink-0 flex-wrap items-center gap-sm text-body-small text-muted-foreground"><StatusBadge tone="neutral" size="sm">{"\u53ea\u8bfb"}</StatusBadge><span>{"\u67e5\u770b\u6838\u9a8c\u7ebf\u7d22\u3001\u539f\u59cb\u8bc1\u636e\u4e0e\u5173\u8054\u7ad9\u5740"}</span></div>
    <form role="search" aria-label={"\u7528\u91cf\u6838\u9a8c\u7b5b\u9009"} onSubmit={e => { e.preventDefault(); navigate({}, { search }); }} className="flex shrink-0 flex-wrap items-center gap-md py-sm">
      <SegmentedControl ariaLabel={"\u6838\u9a8c\u5206\u7c7b"} value={q.category} onChange={category => navigate({ category })} items={Object.entries(categoryNames).map(([value, label]) => ({ value: value as ReviewQuery["category"], label }))} />
      <div className="ml-auto flex max-w-full flex-wrap items-center gap-sm">
        <div className="review-search"><InputGroup><InputGroupAddon><Button variant="ghost" type="submit" size="icon-sm" aria-label={"\u67e5\u8be2\u6838\u9a8c"}><Icon name="search" size="sm" /></Button></InputGroupAddon><InputGroupInput aria-label={"\u6838\u9a8c\u7ad9\u5740\u68c0\u7d22"} placeholder={"\u7ad9\u540d / \u7f16\u7801"} value={search} onChange={e => setSearch(e.target.value)} /></InputGroup></div>
        <NativeSelect aria-label={"\u6838\u9a8c\u6307\u6807"} wrapperClassName="w-auto" value={q.metric} onChange={e => navigate({ metric: e.target.value as ReviewQuery["metric"] })}>{Object.entries(metricNames).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</NativeSelect>
      </div>
    </form>
    <div className="flex shrink-0 flex-wrap items-center gap-md">
      <NativeSelect aria-label={"\u6838\u9a8c\u5730\u5e02"} wrapperClassName="w-auto" value={q.scope.cityId} onChange={e => navigate({}, { cityId: e.target.value, countyId: "all", selection: undefined })}><option value="all">{"\u9655\u897f\u7701 \u00b7 \u5168\u90e8\u5730\u5e02"}</option>{model.region.cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect>
      <NativeSelect aria-label={"\u6838\u9a8c\u533a\u53bf"} wrapperClassName="w-auto" value={q.scope.countyId} disabled={q.scope.cityId === "all"} onChange={e => navigate({}, { countyId: e.target.value, selection: undefined })}><option value="all">{"\u5168\u90e8\u533a\u53bf"}</option>{model.region.counties.filter(c => c.cityId === q.scope.cityId).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect>
      <NativeSelect aria-label={"\u6838\u9a8c\u8fd0\u8425\u5546"} wrapperClassName="w-auto" value={q.scope.operator} onChange={e => navigate({}, { operator: e.target.value as ReviewQuery["scope"]["operator"] })}>{Object.entries(operatorNames).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</NativeSelect>
      <SegmentedControl ariaLabel={"\u6838\u9a8c\u5468\u671f"} value={q.period} onChange={period => navigate({ period })} items={[{ value: "day", label: "\u65e5" }, { value: "week", label: "\u5468" }, { value: "month", label: "\u6708" }]} />
      <NativeSelect aria-label={"\u6838\u9a8c\u72b6\u6001"} wrapperClassName="w-auto" value={q.status} onChange={e => navigate({ status: e.target.value as ReviewQuery["status"] })}>{Object.entries(statusNames).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</NativeSelect>
      {q.scope.selection && <Button variant="ghost" onClick={() => navigate({}, { selection: undefined })}>{"\u6e05\u9664\u9009\u533a"}</Button>}
      <Button variant="ghost" onClick={() => start(() => router.push("/usage-review", { scroll: false }))}>{"\u91cd\u7f6e"}</Button>
      <Collapsible open={summary} onOpenChange={setSummary} className="ml-auto"><CollapsibleTrigger asChild><Button variant="ghost"><Icon name="chart-bar" size="sm" />{"\u7ebf\u7d22\u6982\u51b5"}</Button></CollapsibleTrigger><CollapsibleContent><div className="flex flex-wrap gap-md py-sm text-body-small text-muted-foreground">{Object.entries(model.counts).map(([key, count]) => <span key={key}>{categoryNames[key as keyof typeof model.counts] + " " + count}</span>)}</div></CollapsibleContent></Collapsible>
    </div>
    <div className="review-table-scroll min-h-0 flex-1 overflow-auto rounded-lg border border-border" role="region" aria-label={"\u6838\u9a8c\u53d1\u73b0\u5217\u8868"} tabIndex={0}>
      <div className="hidden sm:block"><DataTable rows={model.rows} rowKey={c => c.id} indexStart={(q.page - 1) * 20 + 1} labels={{ rowActions: "\u64cd\u4f5c" }} columns={[
        { id: "site", header: "\u7ad9\u5740 / \u8fd0\u8425\u5546", cell: c => <TableTitleCell title={c.site.name} description={c.site.id + " \u00b7 " + operatorNames[c.operator]} icon="building" onTitleClick={() => router.push("/sites/" + c.site.id)} /> },
        { id: "kind", header: "\u6838\u9a8c\u7ebf\u7d22", cell: c => <div className="flex flex-col items-start gap-xs"><Button asChild variant="link"><a href={reviewHref(q, c.id)}><FindingBadge item={c} /></a></Button><span className="text-body-small text-muted-foreground">{metricNames[c.metric]}</span></div> },
        { id: "window", header: "\u53d1\u751f\u7a97\u53e3", cell: c => <TableTitleCell title={windowLabel(c.start, c.end)} description={c.kind === "zero_run" ? "\u8fde\u7eed " + c.windows.length + " \u5c0f\u65f6" : "1 \u5c0f\u65f6"} layout="stacked" /> },
        { id: "current", header: "\u5b9e\u9645\u91cf / \u53c2\u8003", cell: c => <TableTitleCell title={quantity(c.current, c.metric)} description={c.referenceNumerator === null ? "\u53c2\u8003\u4e0d\u53ef\u7528" : quantity(c.referenceNumerator, c.metric, 2)} layout="stacked" /> },
        { id: "change", header: "\u53d8\u5316", cell: c => <span className="text-body-small tabular-nums text-muted-foreground">{deviation(c.current, c.referenceNumerator)}</span> },
        { id: "status", header: "\u6838\u9a8c\u72b6\u6001", cell: () => <StatusBadge tone="neutral" size="sm">{"\u5f85\u6838\u9a8c"}</StatusBadge> },
      ]} rowActions={actions} empty={<EmptyState title={"\u5f53\u524d\u8303\u56f4\u6682\u65e0\u6838\u9a8c\u7ebf\u7d22"} description={"\u53ef\u8c03\u6574\u5468\u671f\u3001\u6307\u6807\u6216\u7b5b\u9009\u6761\u4ef6\uff1b\u6837\u4f8b\u96c6\u4e0d\u4ee3\u8868\u5168\u7701\u626b\u63cf\u8986\u76d6\u3002"} />} /></div>
      <div className="flex flex-col gap-md p-md sm:hidden">{model.rows.map(c => <ListCard key={c.id} title={c.site.name} description={operatorNames[c.operator] + " \u00b7 " + metricNames[c.metric] + " \u00b7 " + quantity(c.current, c.metric)} status={<FindingBadge item={c} />} actions={actions(c)} onTitleClick={() => router.push(reviewHref(q, c.id))} meta={<span>{windowLabel(c.start, c.end) + " \u00b7 \u5f85\u6838\u9a8c"}</span>} />)}{!model.rows.length && <EmptyState title={"\u5f53\u524d\u8303\u56f4\u6682\u65e0\u6838\u9a8c\u7ebf\u7d22"} description={"\u8c03\u6574\u5468\u671f\u6216\u7b5b\u9009\u6761\u4ef6\u67e5\u770b\u5176\u4ed6\u6837\u4f8b\u3002"} />}</div>
    </div>
    <Pagination className="review-pagination shrink-0" aria-label={"\u6838\u9a8c\u5206\u9875"} page={q.page} pageCount={model.pages} total={model.total} countLabel={model.total + " \u6761\u6838\u9a8c\u7ebf\u7d22"} onPageChange={page => navigate({ page })} firstLabel={"\u9996\u9875"} previousLabel={"\u4e0a\u4e00\u9875"} nextLabel={"\u4e0b\u4e00\u9875"} lastLabel={"\u672b\u9875"} />
  </div>;
}
