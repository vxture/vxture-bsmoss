"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, Button, Collapsible, CollapsibleContent, CollapsibleTrigger, DataTable, EmptyState, Icon, InputGroup, InputGroupAddon, InputGroupInput,
  ListCard, MetricListCard, NativeSelect, Pagination, SegmentedControl, StatusBadge, TableTitleCell, type DataTableColumn } from "@vxture/design-system";
import type { RegistryDemo } from "../domains/site-registry/demo-store";
import { DEFAULT_SITE_QUERY, siteDetailHref, siteListHref, type SiteQuery, type SiteRecord } from "../domains/site-registry/rules";
import { n, operatorNames, pct, sceneNames, siteTypeNames, statusNames } from "./labels";
import SiteFilters from "./filters";
import "./sites.css";
export default function SiteRegistry({ demo, readAt }: { demo: RegistryDemo; readAt: string }) {
  const router = useRouter(), q = demo.query;
  const [pending, start] = useTransition(), [search, setSearch] = useState(q.search), [expanded, setExpanded] = useState<readonly string[]>([]);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const readTime = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).format(new Date(readAt));
  const dataTime = demo.date + " " + String(q.hour).padStart(2, "0") + ":00";
  const navigate = (patch: Partial<SiteQuery>) => start(() => router.push(siteListHref(q, { page: 1, ...patch }), { scroll: false }));
  const detail = (s: SiteRecord, tab: SiteQuery["tab"] = "overview") => siteDetailHref(s.id, q, { tab });
  const columns: DataTableColumn<SiteRecord>[] = [
    { id: "name", header: "\u7ad9\u5740", sortable: true, cell: s => <TableTitleCell title={s.name} description={s.id} icon="building" onTitleClick={() => router.push(detail(s))} tooltip={s.name} /> },
    { id: "region", header: "\u5f52\u5c5e\u533a\u57df", cell: s => <TableTitleCell title={s.cityName} description={s.countyName} layout="stacked" /> },
    { id: "scene", header: "\u7c7b\u578b / \u573a\u666f", cell: s => <TableTitleCell title={siteTypeNames[s.siteType]} description={sceneNames[s.profile]} layout="stacked" /> },
    { id: "operators", header: "\u5171\u4eab\u4e0e\u670d\u52a1", sortable: true, cell: s => <div className="flex flex-col gap-2xs">
      <span className="text-label">{s.operators.length + " \u5bb6\u8fd0\u8425\u5546"}</span><span className="text-body-small text-muted-foreground">{s.operators.map(code => operatorNames[code]).join(" / ")}</span></div> },
    { id: "status", header: "\u8fd0\u884c\u72b6\u6001", align: "center", width: "sm", cell: s => <StatusBadge tone={s.current.status === "critical" ? "danger" : s.current.status === "warning" ? "warning" : "success"} size="sm">{statusNames[s.current.status]}</StatusBadge> },
    { id: "load", header: "\u65f6\u6bb5\u8d1f\u8f7d", align: "right", sortable: true, width: "sm", cell: s => <span className="tabular-nums">{pct(s.current.used / s.current.capacity)}</span> },
  ];
  const relationColumns: DataTableColumn<RegistryDemo["relations"][number]>[] = [
    { id: "site", header: "\u670d\u52a1\u7ad9\u5740", cell: r => <TableTitleCell title={r.site.name} description={r.site.id} icon="building" onTitleClick={() => router.push(detail(r.site, "services"))} /> },
    { id: "operator", header: "\u670d\u52a1\u5bf9\u8c61", cell: r => <TableTitleCell title={operatorNames[r.code]} description={r.id} icon="users" /> },
    { id: "scope", header: "\u670d\u52a1\u8303\u56f4", cell: () => "\u901a\u8bdd / \u6d41\u91cf / \u77ed\u4fe1" },
    { id: "resource", header: "\u627f\u8f7d\u8d44\u6e90", cell: r => r.site.roomType + " / \u65e0\u7ebf\u8bbe\u5907" },
    { id: "connection", header: "\u65f6\u6bb5\u63a5\u901a\u7387", align: "right", cell: r => pct(r.current.attempts ? r.current.connected / r.current.attempts : null) },
    { id: "traffic", header: "\u65f6\u6bb5\u6d41\u91cf / GiB", align: "right", cell: r => n(r.current.bytes / 1073741824, 2) },
  ];
  const regionLabel = demo.regions.counties.find(c => c.id === q.county)?.name ?? demo.regions.cities.find(c => c.id === q.city)?.name ?? "\u9655\u897f\u7701";
  return <div className="site-workspace flex h-full w-full min-w-0 flex-col" data-sites-mode="demo" aria-busy={pending}>
    <div className="flex min-h-0 flex-1">
      <aside aria-label={"\u5730\u57df\u8d44\u6e90\u8303\u56f4"} className="hidden w-sidebar-expanded shrink-0 flex-col border-r border-border bg-card lg:flex">
        <div className="flex items-center justify-between gap-sm border-b border-border p-lg"><span className="text-label font-semibold">{"\u5730\u57df\u8d44\u6e90"}</span><Icon name="map-pin" size="sm" /></div>
        <div className="min-h-0 flex-1 overflow-y-auto p-md">
          <Button size="xl" className="mb-sm w-full justify-between text-body font-medium" variant={q.city === "all" ? "secondary" : "ghost"} onClick={() => navigate({ city: "all", county: "all" })}><span>{"\u9655\u897f\u7701"}</span><span className="tabular-nums">{n(demo.regions.cities.reduce((sum, c) => sum + c.count, 0))}</span></Button>
          <Accordion type="single" collapsible value={q.city === "all" ? "" : q.city} onValueChange={city => navigate({ city: city || "all", county: "all" })}>
            {demo.regions.cities.map(city => <AccordionItem key={city.id} value={city.id}>
              <AccordionTrigger className="min-h-control-xl px-sm py-sm text-body font-medium no-underline hover:no-underline"><span className="flex flex-1 justify-between gap-sm"><span>{city.name}</span><span className="tabular-nums text-muted-foreground">{n(city.count)}</span></span></AccordionTrigger>
              <AccordionContent><div className="ml-sm flex flex-col gap-xs border-l border-border pl-sm">
                <Button size="xl" variant={q.county === "all" ? "secondary" : "ghost"} className="justify-between text-body" onClick={() => navigate({ city: city.id, county: "all" })}>{"\u5168\u90e8\u533a\u53bf"}</Button>
                {demo.regions.counties.filter(c => c.cityId === city.id).map(c => <Button key={c.id} size="xl" className="justify-between text-body" variant={q.county === c.id ? "secondary" : "ghost"} aria-pressed={q.county === c.id} onClick={() => navigate({ city: city.id, county: c.id })}><span>{c.name}</span><span className="tabular-nums text-muted-foreground">{c.count}</span></Button>)}
              </div></AccordionContent>
            </AccordionItem>)}
          </Accordion>
        </div>
        <p className="border-t border-border p-md text-body-small text-muted-foreground">{"\u533a\u57df\u6570\u5b57\u4e3a\u6f14\u793a\u8d44\u6e90\u603b\u6570"}</p>
      </aside>
      <section aria-label={"\u7ad9\u5740\u4e1a\u52a1\u53f0\u8d26"} className="flex min-h-0 min-w-0 flex-1 flex-col gap-md p-lg">
        <Collapsible open={summaryOpen} onOpenChange={setSummaryOpen} className="shrink-0">
        <div className="flex items-center justify-between gap-sm">
          <div className="flex min-w-0 flex-1 items-center gap-xs">
            <span className="truncate text-body-small text-muted-foreground" title={"\u6570\u636e\u65f6\u70b9\uff1a" + dataTime}>{regionLabel + " \u00b7 " + dataTime}</span>
          </div>
          <div className="flex shrink-0 items-center gap-xs">
            <Button variant="ghost" className="max-sm:gap-xs max-sm:px-xs" disabled={pending} onClick={() => start(() => router.refresh())} aria-label={"\u5237\u65b0\u7ad9\u5740\u53f0\u8d26"} title={"\u91cd\u65b0\u8bfb\u53d6\u5f53\u524d\u53f0\u8d26\uff1b\u6f14\u793a\u6a21\u5f0f\u4e0d\u89e6\u53d1\u4e0a\u6e38\u91c7\u96c6"}>
              <Icon name="refresh" size="sm" className={pending ? "animate-spin" : undefined} /><span className="hidden sm:inline">{pending ? "\u8bfb\u53d6\u4e2d" : "\u5237\u65b0"}</span>
              <time dateTime={readAt} className="tabular-nums text-muted-foreground" title={"\u9875\u9762\u8bfb\u53d6\u65f6\u95f4\uff08\u5317\u4eac\u65f6\u95f4\uff09\uff1a" + readAt} aria-label={"\u9875\u9762\u8bfb\u53d6\u65f6\u95f4 " + readTime}>{readTime}</time>
            </Button>
            <CollapsibleTrigger asChild><Button variant="ghost" className="max-sm:w-control-md max-sm:px-0" aria-label={"\u8d44\u6e90\u6982\u51b5"}><Icon name="gauge" size="sm" className="sm:hidden" /><span className="hidden sm:inline">{"\u8d44\u6e90\u6982\u51b5"}</span><Icon name={summaryOpen ? "chevron-up" : "chevron-down"} size="sm" className="hidden sm:inline" /></Button></CollapsibleTrigger>
            <Button asChild variant="secondary" className="max-sm:w-control-md max-sm:px-0"><a aria-label={"\u7ad9\u7f51\u5730\u56fe"} href={"/product-preview?hour=" + q.hour + (q.city === "all" ? "" : "&city=" + q.city) + (q.county === "all" ? "" : "&county=" + q.county)}><Icon name="map-pin" size="sm" /><span className="hidden sm:inline">{"\u7ad9\u7f51\u5730\u56fe"}</span></a></Button>
          </div>
        </div>
        <CollapsibleContent><div className="pt-sm" role="group" aria-label={"\u5f53\u524d\u7b5b\u9009\u8d44\u6e90\u6982\u51b5"}><MetricListCard title={"\u5f53\u524d\u7b5b\u9009\u8d44\u6e90"} icon="building" metrics={[
          { key: "sites", label: "\u7269\u7406\u7ad9\u5740", value: n(demo.summary.sites) + " \u5ea7" },
          { key: "relations", label: "\u670d\u52a1\u5173\u7cfb", value: n(demo.summary.relations) + " \u6761" },
          { key: "shared", label: "\u5171\u4eab\u7ad9\u5740", value: n(demo.summary.shared) + " \u5ea7" },
          { key: "attention", label: "\u8fd0\u884c\u5173\u6ce8", value: n(demo.summary.attention) + " \u5ea7" },
        ]} /></div></CollapsibleContent>
        </Collapsible>
        <form className="site-registry-tools shrink-0" role="search" onSubmit={e => { e.preventDefault(); navigate({ search }); }}>
          <div className="site-registry-view"><SegmentedControl ariaLabel={"\u8d44\u6e90\u4e1a\u52a1\u89c6\u56fe"} value={q.view} onChange={view => navigate({ view })}
            items={[{ value: "sites", label: "\u7ad9\u5740\u53f0\u8d26" }, { value: "relations", label: "\u670d\u52a1\u5173\u7cfb" }]} /></div>
          <div className="site-registry-search min-w-0">
            <InputGroup><InputGroupAddon><Button size="icon-sm" type="submit" variant="ghost" aria-label={"\u67e5\u8be2"}><Icon name="search" size="sm" /></Button></InputGroupAddon>
              <InputGroupInput aria-label={"\u68c0\u7d22\u7ad9\u5740"} placeholder={"\u7ad9\u540d / \u7f16\u7801 / \u5730\u5740"} value={search} onChange={e => setSearch(e.target.value)} />
            </InputGroup>
          </div>
          <div className="site-registry-actions flex items-center justify-end gap-xs">
            <NativeSelect aria-label={"\u7ad9\u70b9\u7c7b\u578b"} wrapperClassName="w-auto" value={q.siteType} onChange={e => navigate({ siteType: e.target.value as SiteQuery["siteType"] })}>
              {Object.entries(siteTypeNames).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
            </NativeSelect>
            <SiteFilters query={q} regions={demo.regions} onApply={patch => navigate(patch)} />
            <Button variant="ghost" size="icon-md" aria-label={"\u91cd\u7f6e\u7b5b\u9009"} onClick={() => start(() => router.push(siteListHref(DEFAULT_SITE_QUERY)))}><Icon name="refresh" size="sm" /></Button>
          </div>
        </form>
        <div className="site-table-scroll min-h-0 min-w-0 flex-1 overflow-y-auto rounded-lg border border-border bg-card" aria-label={q.view === "sites" ? "\u7ad9\u5740\u5217\u8868" : "\u670d\u52a1\u5173\u7cfb\u5217\u8868"}>
          <div className="flex flex-col gap-md p-md sm:hidden">
            {q.view === "sites" ? demo.rows.map(s => <ListCard key={s.id} title={s.name} icon="building" description={s.id}
              onTitleClick={() => router.push(detail(s))}
              status={<StatusBadge tone={s.current.status === "critical" ? "danger" : s.current.status === "warning" ? "warning" : "success"} size="sm">{statusNames[s.current.status]}</StatusBadge>}
              meta={<div className="flex flex-col gap-xs"><span>{s.cityName + " / " + s.countyName + " \u00b7 " + siteTypeNames[s.siteType] + " / " + sceneNames[s.profile]}</span>
                <span>{s.operators.map(code => operatorNames[code]).join(" / ")}</span><span>{"\u65f6\u6bb5\u8d1f\u8f7d " + pct(s.current.used / s.current.capacity)}</span>
                <Button asChild variant="secondary" size="sm"><a href={detail(s)}>{"\u7ad9\u5740\u6863\u6848"}<Icon name="arrow-right" size="sm" /></a></Button></div>} />) :
              demo.relations.map(r => <ListCard key={r.id} title={operatorNames[r.code] + " \u00b7 " + r.site.name} icon="users" description={r.id}
                onTitleClick={() => router.push(detail(r.site, "services"))}
                meta={<div className="flex flex-col gap-xs"><span>{r.site.cityName + " / " + r.site.countyName}</span>
                  <span>{"\u63a5\u901a\u7387 " + pct(r.current.attempts ? r.current.connected / r.current.attempts : null) + " \u00b7 " + n(r.current.bytes / 1073741824, 2) + " GiB"}</span>
                  <Button asChild variant="secondary" size="sm"><a href={detail(r.site, "services")}>{"\u670d\u52a1\u6863\u6848"}<Icon name="arrow-right" size="sm" /></a></Button></div>} />)}
            {!demo.count && <EmptyState title={"\u6ca1\u6709\u5339\u914d\u7684\u8d44\u6e90"} description={"\u8c03\u6574\u7b5b\u9009\u6761\u4ef6\u540e\u91cd\u8bd5\u3002"} />}
          </div>
          <div className="hidden sm:block">
          {q.view === "sites" ? <DataTable labels={{ expand: "\u5c55\u5f00", rowActions: "\u64cd\u4f5c" }} columns={columns} rows={demo.rows} rowKey={s => s.id}
            indexStart={(q.page - 1) * demo.pageSize + 1} sort={{ columnId: q.sort, direction: q.direction }}
            onSortChange={sort => navigate({ sort: sort.columnId as SiteQuery["sort"], direction: sort.direction })}
            expandedKeys={expanded} onExpandedChange={setExpanded} expandedContent={s => <div className="grid gap-md p-lg sm:grid-cols-2 xl:grid-cols-3">
              {s.operators.map(code => <div key={code} className="flex items-center justify-between gap-md rounded-md border border-border bg-background p-md">
                <span className="flex flex-col gap-xs"><span className="text-label">{operatorNames[code]}</span><span className="text-body-small text-muted-foreground">{"\u901a\u8bdd \u00b7 \u6d41\u91cf \u00b7 \u77ed\u4fe1"}</span></span>
                <Button asChild size="sm" variant="ghost"><a href={detail(s, "services")}>{"\u670d\u52a1\u6863\u6848"}<Icon name="arrow-right" size="sm" /></a></Button>
              </div>)}
            </div>}
            rowActions={s => <Button asChild variant="ghost" size="sm"><a href={detail(s)} aria-label={"\u67e5\u770b" + s.name + "\u6863\u6848"}><Icon name="arrow-right" size="sm" /></a></Button>}
            empty={<EmptyState title={"\u6ca1\u6709\u5339\u914d\u7684\u7ad9\u5740"} description={"\u8c03\u6574\u533a\u57df\u3001\u8fd0\u8425\u5546\u6216\u68c0\u7d22\u6761\u4ef6\u540e\u91cd\u8bd5\u3002"} />} /> :
            <DataTable labels={{ rowActions: "\u64cd\u4f5c" }} columns={relationColumns} rows={demo.relations} rowKey={r => r.id} indexStart={(q.page - 1) * demo.pageSize + 1}
              rowActions={r => <Button asChild variant="ghost" size="sm"><a href={detail(r.site, "services")} aria-label={"\u67e5\u770b" + operatorNames[r.code] + "\u670d\u52a1\u6863\u6848"}><Icon name="arrow-right" size="sm" /></a></Button>}
              empty={<EmptyState title={"\u6ca1\u6709\u5339\u914d\u7684\u670d\u52a1\u5173\u7cfb"} description={"\u8c03\u6574\u7b5b\u9009\u6761\u4ef6\u540e\u91cd\u8bd5\u3002"} />} />}
          </div>
        </div>
        <Pagination aria-label={"\u53f0\u8d26\u5206\u9875"} countLabel={n(demo.count) + (q.view === "sites" ? " \u5ea7\u7ad9\u5740" : " \u6761\u5173\u7cfb")} firstLabel={"\u9996\u9875"} previousLabel={"\u4e0a\u4e00\u9875"} nextLabel={"\u4e0b\u4e00\u9875"} lastLabel={"\u672b\u9875"} className="shrink-0" page={q.page} pageCount={demo.pages} total={demo.count} onPageChange={page => navigate({ page })} />
      </section>
    </div>
  </div>;
}
