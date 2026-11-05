"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ActionMenu, Accordion, AccordionContent, AccordionItem, AccordionTrigger, Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button, Collapsible, CollapsibleContent, CollapsibleTrigger, DataTable, EmptyState, Icon, InputGroup, InputGroupAddon, InputGroupInput,
  ListCard, MetricListCard, NativeSelect, Pagination, Progress, SegmentedControl, ShellIconButton, StatusBadge, TableTitleCell, type DataTableColumn } from "@vxture/design-system";
import type { RegistryDemo } from "../domains/site-registry/demo-store";
import { DEFAULT_SITE_QUERY, siteDetailHref, siteListHref, type SiteQuery, type SiteRecord } from "../domains/site-registry/rules";
import { n, operatorNames, pct, sceneNames, siteTypeNames, statusNames } from "./labels";
import PageHeading from "../portal/page-heading";
import SiteFilters from "./filters";
import "./sites.css";
export default function SiteRegistry({ demo }: { demo: RegistryDemo }) {
  // Keep the workspace choice while query-specific search/row state resets.
  const [regionOpen, setRegionOpen] = useState(true);
  return <RegistryContent key={JSON.stringify(demo.query)} demo={demo} regionOpen={regionOpen} onRegionToggle={() => setRegionOpen(value => !value)} />;
}
function RegistryContent({ demo, regionOpen, onRegionToggle }: {
  demo: RegistryDemo; regionOpen: boolean; onRegionToggle: () => void;
}) {
  const router = useRouter(), q = demo.query;
  const [pending, start] = useTransition(), [search, setSearch] = useState(q.search), [expanded, setExpanded] = useState<readonly string[]>([]);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const dataTime = demo.date + " " + String(q.hour).padStart(2, "0") + ":00";
  const navigate = (patch: Partial<SiteQuery>) => start(() => router.push(siteListHref(q, { page: 1, ...patch }), { scroll: false }));
  const detail = (s: SiteRecord, tab: SiteQuery["tab"] = "overview") => siteDetailHref(s.id, q, { tab });
  const ratioIndicator = (value: number | null, label: string, caption?: string) => <div className="flex w-full flex-col gap-xs">
    <div className="flex items-center justify-end gap-sm text-body-small text-muted-foreground">
      {caption && <span className="mr-auto">{caption}</span>}<span className="tabular-nums">{pct(value)}</span>
    </div>
    {value !== null && <Progress value={value * 100} aria-label={label} />}
  </div>;
  const loadIndicator = (s: SiteRecord, labelled = false) => ratioIndicator(s.current.used / s.current.capacity,
    s.name + " " + String(q.hour).padStart(2, "0") + ":00 \u65f6\u6bb5\u8d1f\u8f7d", labelled ? "\u65f6\u6bb5\u8d1f\u8f7d" : undefined);
  const connectionIndicator = (r: RegistryDemo["relations"][number], labelled = false) => ratioIndicator(
    r.current.attempts ? r.current.connected / r.current.attempts : null,
    r.site.name + " " + operatorNames[r.code] + " " + String(q.hour).padStart(2, "0") + ":00 \u65f6\u6bb5\u63a5\u901a\u7387", labelled ? "\u65f6\u6bb5\u63a5\u901a\u7387" : undefined);
  const actions = (s: SiteRecord, service = false) => <ActionMenu label={(service ? "\u670d\u52a1\u64cd\u4f5c\uff1a" : "\u7ad9\u5740\u64cd\u4f5c\uff1a") + s.name} items={[
    { id: "dossier", label: service ? "\u670d\u52a1\u6863\u6848" : "\u7ad9\u5740\u6863\u6848", icon: "building", onSelect: () => router.push(detail(s, service ? "services" : "overview")) },
    { id: "runtime", label: "\u8fd0\u884c\u72b6\u6001", icon: "gauge", onSelect: () => router.push(detail(s, "runtime")) },
    { id: "usage", label: "\u7ecf\u8425\u7528\u91cf", icon: "chart-line-up", onSelect: () => router.push(detail(s, "business")) },
  ]} />;
  const columns: DataTableColumn<SiteRecord>[] = [
    { id: "name", header: "\u7ad9\u5740", sortable: true, cell: s => <TableTitleCell title={s.name} description={s.id} icon="building" onTitleClick={() => router.push(detail(s))} tooltip={s.name} /> },
    { id: "region", header: "\u5f52\u5c5e\u533a\u57df", cell: s => <TableTitleCell title={s.cityName} description={s.countyName} layout="stacked" /> },
    { id: "scene", header: "\u7c7b\u578b / \u573a\u666f", cell: s => <TableTitleCell title={siteTypeNames[s.siteType]} description={sceneNames[s.profile]} layout="stacked" /> },
    { id: "operators", header: "\u5171\u4eab\u4e0e\u670d\u52a1", sortable: true, cell: s => <div className="flex flex-col gap-2xs">
      <span className="text-body">{s.operators.length + " \u5bb6\u8fd0\u8425\u5546"}</span><span className="text-body-small text-muted-foreground">{s.operators.map(code => operatorNames[code]).join(" / ")}</span></div> },
    { id: "status", header: "\u8fd0\u884c\u72b6\u6001", align: "center", width: "sm", cell: s => <StatusBadge tone={s.current.status === "critical" ? "danger" : s.current.status === "warning" ? "warning" : "success"} size="sm">{statusNames[s.current.status]}</StatusBadge> },
    { id: "load", header: "\u65f6\u6bb5\u8d1f\u8f7d", align: "right", sortable: true, width: "sm", cell: s => loadIndicator(s) },
  ];
  const relationColumns: DataTableColumn<RegistryDemo["relations"][number]>[] = [
    { id: "site", header: "\u670d\u52a1\u7ad9\u5740", cell: r => <TableTitleCell title={r.site.name} description={r.site.id} icon="building" onTitleClick={() => router.push(detail(r.site, "services"))} /> },
    { id: "operator", header: "\u670d\u52a1\u5bf9\u8c61", cell: r => <TableTitleCell title={operatorNames[r.code]} description={r.id} icon="users" /> },
    { id: "scope", header: "\u670d\u52a1\u8303\u56f4", cell: () => "\u901a\u8bdd / \u6d41\u91cf / \u77ed\u4fe1" },
    { id: "resource", header: "\u627f\u8f7d\u8d44\u6e90", cell: r => r.site.roomType + " / \u65e0\u7ebf\u8bbe\u5907" },
    { id: "connection", header: "\u65f6\u6bb5\u63a5\u901a\u7387", align: "right", cell: r => connectionIndicator(r) },
    { id: "traffic", header: "\u65f6\u6bb5\u6d41\u91cf / GiB", align: "right", cell: r => n(r.current.bytes / 1073741824, 2) },
  ];
  const city = demo.regions.cities.find(c => c.id === q.city), county = demo.regions.counties.find(c => c.id === q.county);
  const registryTools = <form className="site-registry-tools shrink-0" role="search" onSubmit={e => { e.preventDefault(); navigate({ search }); }}>
          <div className="site-registry-view"><SegmentedControl ariaLabel={"\u8d44\u6e90\u4e1a\u52a1\u89c6\u56fe"} value={q.view} onChange={view => navigate({ view })}
            items={[{ value: "sites", label: "\u7ad9\u5740\u53f0\u8d26", icon: "building" }, { value: "relations", label: "\u670d\u52a1\u5173\u7cfb", icon: "users" }]} /></div>
          <div className="site-registry-search min-w-0">
            <InputGroup><InputGroupAddon><Button size="icon-sm" type="submit" variant="ghost" aria-label={"\u67e5\u8be2"}><Icon name="search" size="sm" /></Button></InputGroupAddon>
              <InputGroupInput aria-label={"\u68c0\u7d22\u7ad9\u5740"} placeholder={"\u7ad9\u540d / \u7f16\u7801 / \u5730\u5740"} value={search} onChange={e => setSearch(e.target.value)} />
            </InputGroup>
          </div>
          <div className="site-registry-actions flex items-center justify-end gap-sm">
            <NativeSelect aria-label={"\u7ad9\u70b9\u7c7b\u578b"} wrapperClassName="w-auto" value={q.siteType} onChange={e => navigate({ siteType: e.target.value as SiteQuery["siteType"] })}>
              {Object.entries(siteTypeNames).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
            </NativeSelect>
            <SiteFilters query={q} regions={demo.regions} onApply={patch => navigate(patch)} />
            <Button variant="ghost" size="icon-md" aria-label={"\u91cd\u7f6e\u7b5b\u9009"} onClick={() => start(() => router.push(siteListHref(DEFAULT_SITE_QUERY)))}><Icon name="refresh" size="sm" /></Button>
          </div>
        </form>;
  return <div className="site-workspace site-registry-workspace flex h-full w-full min-w-0 flex-col text-body" data-sites-mode="demo" data-region-open={regionOpen} aria-busy={pending}>
    <div className="flex min-h-0 flex-1">
      <aside id="site-region-panel" aria-label={"\u5730\u57df\u8d44\u6e90\u8303\u56f4"} className={"site-region-panel hidden shrink-0 flex-col overflow-hidden rounded-md border border-primary/10 bg-card/68 dark:border-primary/20 lg:flex " + (regionOpen ? "w-sidebar-expanded" : "self-start")}>
        <div className={"flex items-center gap-sm " + (regionOpen ? "border-b border-border p-md" : "p-xs")}>
          {regionOpen && <><span className="flex items-center gap-sm text-label font-semibold"><Icon name="building" size="sm" />{"\u9655\u897f\u00b7\u8d44\u6e90"}</span><span className="ml-auto text-body-small tabular-nums text-muted-foreground" aria-label={"\u5168\u7701\u8d44\u6e90\u603b\u6570"}>{n(demo.regions.cities.reduce((sum, c) => sum + c.count, 0))}</span></>}
          <ShellIconButton icon="sidebar" className="site-region-toggle shrink-0" label={regionOpen ? "\u6536\u8d77\u5730\u57df\u9762\u677f" : "\u5c55\u5f00\u5730\u57df\u9762\u677f"} aria-expanded={regionOpen} aria-controls="site-region-tree" onClick={onRegionToggle} />
        </div>
        <div id="site-region-tree" hidden={!regionOpen} className="site-region-scroll min-h-0 flex-1 overflow-y-auto p-md" tabIndex={0} role="region" aria-label={"\u5730\u57df\u6811\u6eda\u52a8\u533a"}>
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
        <p hidden={!regionOpen} className="border-t border-border p-md text-body-small text-muted-foreground">{"\u533a\u57df\u6570\u5b57\u4e3a\u7ad9\u5740\u8d44\u6e90\u603b\u6570"}</p>
      </aside>
      <section aria-label={"\u7ad9\u5740\u4e1a\u52a1\u53f0\u8d26"} className="site-registry-content min-h-0 min-w-0 flex-1">
        <div className="product-page-inset flex h-full min-h-0 flex-col gap-md">
        <Collapsible open={summaryOpen} onOpenChange={setSummaryOpen} className="shrink-0">
        <PageHeading title={"\u7ad9\u5740\u7ba1\u7406"} description={"\u7ad9\u5740\u8d44\u6e90\u53f0\u8d26\u4e0e\u8fd0\u8425\u5546\u670d\u52a1\u5173\u7cfb"}

          region={<Breadcrumb aria-label={"\u5f53\u524d\u5730\u57df"} className="min-w-0">
              <BreadcrumbList className="flex-nowrap gap-xs whitespace-nowrap">
                <BreadcrumbItem>{city ? <BreadcrumbLink href={siteListHref(q, { city: "all", county: "all", page: 1 })} onClick={e => { e.preventDefault(); navigate({ city: "all", county: "all" }); }}>{"\u9655\u897f\u7701"}</BreadcrumbLink> : <BreadcrumbPage>{"\u9655\u897f\u7701"}</BreadcrumbPage>}</BreadcrumbItem>
                {city && <><BreadcrumbSeparator /><BreadcrumbItem>{county ? <BreadcrumbLink href={siteListHref(q, { county: "all", page: 1 })} onClick={e => { e.preventDefault(); navigate({ county: "all" }); }}>{city.name}</BreadcrumbLink> : <BreadcrumbPage>{city.name}</BreadcrumbPage>}</BreadcrumbItem></>}
                {county && <><BreadcrumbSeparator /><BreadcrumbItem><BreadcrumbPage>{county.name}</BreadcrumbPage></BreadcrumbItem></>}
              </BreadcrumbList>
            </Breadcrumb>}
          context={<span className="inline-flex flex-wrap items-center gap-xs"><span>{"\u6570\u636e\u622a\u81f3"}</span><time className="tabular-nums" dateTime={demo.date + "T" + String(q.hour).padStart(2, "0") + ":00:00+08:00"}>{dataTime}</time></span>}
          actions={<><Button variant="ghost" size="icon-md" disabled={pending} onClick={() => start(() => router.refresh())} aria-label={"\u5237\u65b0\u7ad9\u5740\u53f0\u8d26"} title={"\u91cd\u65b0\u8bfb\u53d6\u5f53\u524d\u53f0\u8d26"}>
              <Icon name="refresh" size="sm" className={pending ? "animate-spin" : undefined} />
            </Button>
            <CollapsibleTrigger asChild><Button variant="outline" className="max-sm:w-control-md max-sm:px-0" aria-label={"\u8d44\u6e90\u6982\u51b5"}><Icon name="gauge" size="sm" className="sm:hidden" /><span className="hidden sm:inline">{"\u8d44\u6e90\u6982\u51b5"}</span><Icon name={summaryOpen ? "chevron-up" : "chevron-down"} size="sm" className="hidden sm:inline" /></Button></CollapsibleTrigger>
            <Button asChild variant="outline" className="max-xl:w-control-md max-xl:px-0"><a aria-label={"\u7ad9\u7f51\u5730\u56fe"} title={"\u7ad9\u7f51\u5730\u56fe"} target="_blank" rel="noopener noreferrer" href={"/product-preview?hour=" + q.hour + (q.city === "all" ? "" : "&city=" + q.city) + (q.county === "all" ? "" : "&county=" + q.county)}><Icon name="map-pin" size="sm" /><span className="hidden xl:inline">{"\u7ad9\u7f51\u5730\u56fe"}</span></a></Button></>}
          toolbar={registryTools} />
        <CollapsibleContent><div className="pt-sm" role="group" aria-label={"\u5f53\u524d\u7b5b\u9009\u8d44\u6e90\u6982\u51b5"}><MetricListCard title={"\u5f53\u524d\u7b5b\u9009\u8d44\u6e90"} icon="building" metrics={[
          { key: "sites", label: "\u7269\u7406\u7ad9\u5740", value: n(demo.summary.sites) + " \u5ea7" },
          { key: "relations", label: "\u670d\u52a1\u5173\u7cfb", value: n(demo.summary.relations) + " \u6761" },
          { key: "shared", label: "\u5171\u4eab\u7ad9\u5740", value: n(demo.summary.shared) + " \u5ea7" },
          { key: "attention", label: "\u8fd0\u884c\u5173\u6ce8", value: n(demo.summary.attention) + " \u5ea7" },
        ]} /></div></CollapsibleContent>
        </Collapsible>

        <div className="site-table-scroll min-h-0 min-w-0 flex-1 overflow-y-auto" tabIndex={0} role="region" aria-label={q.view === "sites" ? "\u7ad9\u5740\u5217\u8868" : "\u670d\u52a1\u5173\u7cfb\u5217\u8868"}>
          <div className="flex flex-col gap-md p-md sm:hidden">
            {q.view === "sites" ? demo.rows.map(s => <ListCard key={s.id} title={s.name} icon="building" description={s.id}
              onTitleClick={() => router.push(detail(s))} actions={actions(s)}
              status={<StatusBadge tone={s.current.status === "critical" ? "danger" : s.current.status === "warning" ? "warning" : "success"} size="sm">{statusNames[s.current.status]}</StatusBadge>}
              meta={<div className="flex flex-col gap-xs"><span>{s.cityName + " / " + s.countyName + " \u00b7 " + siteTypeNames[s.siteType] + " / " + sceneNames[s.profile]}</span>
                <span>{s.operators.map(code => operatorNames[code]).join(" / ")}</span>{loadIndicator(s, true)}
                <Button asChild variant="secondary" size="sm"><a href={detail(s)}>{"\u7ad9\u5740\u6863\u6848"}<Icon name="arrow-right" size="sm" /></a></Button></div>} />) :
              demo.relations.map(r => <ListCard key={r.id} title={operatorNames[r.code] + " \u00b7 " + r.site.name} icon="users" description={r.id}
                onTitleClick={() => router.push(detail(r.site, "services"))} actions={actions(r.site, true)}
                meta={<div className="flex flex-col gap-xs"><span>{r.site.cityName + " / " + r.site.countyName}</span>
                  {connectionIndicator(r, true)}<span>{"\u65f6\u6bb5\u6d41\u91cf " + n(r.current.bytes / 1073741824, 2) + " GiB"}</span>
                  <Button asChild variant="secondary" size="sm"><a href={detail(r.site, "services")}>{"\u670d\u52a1\u6863\u6848"}<Icon name="arrow-right" size="sm" /></a></Button></div>} />)}
            {!demo.count && <EmptyState title={"\u6ca1\u6709\u5339\u914d\u7684\u8d44\u6e90"} description={"\u8c03\u6574\u7b5b\u9009\u6761\u4ef6\u540e\u91cd\u8bd5\u3002"} />}
          </div>
          <div className="hidden sm:block">
          {q.view === "sites" ? <DataTable className="site-action-table" labels={{ expand: "\u5c55\u5f00", rowActions: "\u64cd\u4f5c" }} columns={columns} rows={demo.rows} rowKey={s => s.id}
            indexStart={(q.page - 1) * demo.pageSize + 1} sort={{ columnId: q.sort, direction: q.direction }}
            onSortChange={sort => navigate({ sort: sort.columnId as SiteQuery["sort"], direction: sort.direction })}
            expandedKeys={expanded} onExpandedChange={setExpanded} expandedContent={s => <div className="site-service-relations flex flex-wrap gap-sm p-sm" role="group" aria-label={"\u8fd0\u8425\u5546\u670d\u52a1\u5173\u7cfb"}>
              {demo.operatorLoads[s.id].map(({ code, load }) => <div key={code} className="site-service-relation flex flex-col gap-xs rounded-md border border-border bg-background p-sm">
                <Button asChild size="sm" variant="ghost" className="self-start px-0 text-primary"><a href={detail(s, "services")} aria-label={operatorNames[code] + "\u670d\u52a1\u6863\u6848"}>{operatorNames[code]}</a></Button>
                <span className="text-body-small text-muted-foreground">{"\u901a\u8bdd \u00b7 \u6d41\u91cf \u00b7 \u77ed\u4fe1"}</span>
                <div className="mt-xs flex items-center justify-between gap-xs text-body-small text-muted-foreground"><span>{String(q.hour).padStart(2, "0") + ":00 \u8d1f\u8f7d"}</span><span className="tabular-nums text-foreground">{pct(load)}</span></div>
                <Progress value={load * 100} aria-label={operatorNames[code] + " " + String(q.hour).padStart(2, "0") + ":00 \u65f6\u6bb5\u8d1f\u8f7d"} />
              </div>)}
            </div>}
            rowActions={s => actions(s)}
            empty={<EmptyState title={"\u6ca1\u6709\u5339\u914d\u7684\u7ad9\u5740"} description={"\u8c03\u6574\u533a\u57df\u3001\u8fd0\u8425\u5546\u6216\u68c0\u7d22\u6761\u4ef6\u540e\u91cd\u8bd5\u3002"} />} /> :
            <DataTable className="site-action-table" labels={{ rowActions: "\u64cd\u4f5c" }} columns={relationColumns} rows={demo.relations} rowKey={r => r.id} indexStart={(q.page - 1) * demo.pageSize + 1}
              rowActions={r => actions(r.site, true)}
              empty={<EmptyState title={"\u6ca1\u6709\u5339\u914d\u7684\u670d\u52a1\u5173\u7cfb"} description={"\u8c03\u6574\u7b5b\u9009\u6761\u4ef6\u540e\u91cd\u8bd5\u3002"} />} />}
          </div>
        </div>
        <Pagination aria-label={"\u53f0\u8d26\u5206\u9875"} countLabel={n(demo.count) + (q.view === "sites" ? " \u5ea7\u7ad9\u5740" : " \u6761\u5173\u7cfb")} firstLabel={"\u9996\u9875"} previousLabel={"\u4e0a\u4e00\u9875"} nextLabel={"\u4e0b\u4e00\u9875"} lastLabel={"\u672b\u9875"} className="site-registry-pagination shrink-0" page={q.page} pageCount={demo.pages} total={demo.count} onPageChange={page => navigate({ page })} />
        </div>
      </section>
    </div>
  </div>;
}
