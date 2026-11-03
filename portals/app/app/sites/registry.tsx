"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, Button, DataTable, EmptyState, FilterBar, Icon, Input,
  ListCard, MetricGrid, MetricListCard, NativeSelect, Pagination, SegmentedControl, StatusBadge, TableTitleCell, ViewHeader, type DataTableColumn } from "@vxture/design-system";
import type { RegistryDemo } from "../domains/site-registry/demo-store";
import { DEFAULT_SITE_QUERY, siteDetailHref, siteListHref, type SiteQuery, type SiteRecord } from "../domains/site-registry/rules";
import { n, operatorNames, pct, sceneNames, statusNames } from "./labels";
import "./sites.css";
export default function SiteRegistry({ demo }: { demo: RegistryDemo }) {
  const router = useRouter(), q = demo.query;
  const [pending, start] = useTransition(), [search, setSearch] = useState(q.search), [expanded, setExpanded] = useState<readonly string[]>([]);
  const navigate = (patch: Partial<SiteQuery>) => start(() => router.push(siteListHref(q, { page: 1, ...patch }), { scroll: false }));
  const detail = (s: SiteRecord, tab: SiteQuery["tab"] = "overview") => siteDetailHref(s.id, q, { tab });
  const columns: DataTableColumn<SiteRecord>[] = [
    { id: "name", header: "\u7ad9\u5740", sortable: true, cell: s => <TableTitleCell title={s.name} description={s.id} icon="building" onTitleClick={() => router.push(detail(s))} tooltip={s.name} /> },
    { id: "region", header: "\u5f52\u5c5e\u533a\u57df", cell: s => <TableTitleCell title={s.cityName} description={s.countyName} layout="stacked" /> },
    { id: "scene", header: "\u573a\u666f / \u5854\u578b", cell: s => <TableTitleCell title={sceneNames[s.profile]} description={s.towerType} layout="stacked" /> },
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
    <div className="shrink-0 border-b border-border bg-card px-lg py-md">
      <ViewHeader className="max-sm:flex-col max-sm:items-stretch" title={"\u7ad9\u5740\u7ba1\u7406"} description={regionLabel + " \u00b7 " + demo.date + " \u00b7 " + String(q.hour).padStart(2, "0") + ":00"}
        secondary={<StatusBadge tone="info" size="sm">{"\u6f14\u793a\u6570\u636e"}</StatusBadge>}
        action={<Button asChild variant="secondary"><a href={"/product-preview?hour=" + q.hour + (q.city === "all" ? "" : "&city=" + q.city) + (q.county === "all" ? "" : "&county=" + q.county)}><Icon name="map-pin" size="sm" />{"\u7ad9\u7f51\u5730\u56fe"}</a></Button>} />
    </div>
    <div className="flex min-h-0 flex-1">
      <aside aria-label={"\u5730\u57df\u8d44\u6e90\u8303\u56f4"} className="hidden w-sidebar-expanded shrink-0 flex-col border-r border-border bg-card lg:flex">
        <div className="flex items-center justify-between gap-sm border-b border-border p-lg"><span className="text-label font-semibold">{"\u5730\u57df\u8d44\u6e90"}</span><Icon name="map-pin" size="sm" /></div>
        <div className="min-h-0 flex-1 overflow-y-auto p-md">
          <Button className="mb-sm w-full justify-between" variant={q.city === "all" ? "secondary" : "ghost"} onClick={() => navigate({ city: "all", county: "all" })}><span>{"\u9655\u897f\u7701"}</span><span className="tabular-nums">{n(demo.regions.cities.reduce((sum, c) => sum + c.count, 0))}</span></Button>
          <Accordion type="single" collapsible value={q.city === "all" ? "" : q.city} onValueChange={city => navigate({ city: city || "all", county: "all" })}>
            {demo.regions.cities.map(city => <AccordionItem key={city.id} value={city.id}>
              <AccordionTrigger><span className="flex flex-1 justify-between gap-sm"><span>{city.name}</span><span className="tabular-nums text-muted-foreground">{n(city.count)}</span></span></AccordionTrigger>
              <AccordionContent><div className="flex flex-col gap-xs">
                <Button size="sm" variant={q.county === "all" ? "secondary" : "ghost"} className="justify-between" onClick={() => navigate({ city: city.id, county: "all" })}>{"\u5168\u90e8\u533a\u53bf"}</Button>
                {demo.regions.counties.filter(c => c.cityId === city.id).map(c => <Button key={c.id} size="sm" className="justify-between" variant={q.county === c.id ? "secondary" : "ghost"} onClick={() => navigate({ city: city.id, county: c.id })}><span>{c.name}</span><span className="tabular-nums text-muted-foreground">{c.count}</span></Button>)}
              </div></AccordionContent>
            </AccordionItem>)}
          </Accordion>
        </div>
        <p className="border-t border-border p-md text-body-small text-muted-foreground">{"\u533a\u57df\u6570\u5b57\u4e3a\u6f14\u793a\u8d44\u6e90\u603b\u6570"}</p>
      </aside>
      <section aria-label={"\u7ad9\u5740\u4e1a\u52a1\u53f0\u8d26"} className="flex min-h-0 min-w-0 flex-1 flex-col gap-md p-lg">
        <div className="shrink-0"><div className="hidden sm:block"><MetricGrid columns={4} aria-label={"\u5f53\u524d\u7b5b\u9009\u8d44\u6e90\u6982\u51b5"} items={[
          { id: "sites", icon: "building", label: "\u7269\u7406\u7ad9\u5740", value: n(demo.summary.sites), description: "\u5ea7" },
          { id: "relations", icon: "users", label: "\u8fd0\u8425\u5546\u670d\u52a1\u5173\u7cfb", value: n(demo.summary.relations), description: "\u6761" },
          { id: "shared", icon: "stack", label: "\u5171\u4eab\u7ad9\u5740", value: n(demo.summary.shared), description: "\u4e24\u5bb6\u53ca\u4ee5\u4e0a\u8fd0\u8425\u5546" },
          { id: "attention", icon: "gauge", label: "\u8fd0\u884c\u5173\u6ce8", value: n(demo.summary.attention), description: "\u5173\u6ce8\u53ca\u5f02\u5e38\u7ad9\u5740" },
        ]} /></div><MetricListCard className="sm:hidden" title={"\u5f53\u524d\u8d44\u6e90"} icon="building" metrics={[
          { key: "sites", label: "\u7ad9\u5740 / \u5ea7", value: n(demo.summary.sites) },
          { key: "relations", label: "\u5173\u7cfb / \u6761", value: n(demo.summary.relations) },
          { key: "shared", label: "\u5171\u4eab / \u5ea7", value: n(demo.summary.shared) },
          { key: "attention", label: "\u5173\u6ce8 / \u5ea7", value: n(demo.summary.attention) },
        ]} /></div>
        <form className="shrink-0" role="search" onSubmit={e => { e.preventDefault(); navigate({ search }); }}>
          <FilterBar count={n(demo.count) + (q.view === "sites" ? " \u5ea7\u7ad9\u5740" : " \u6761\u5173\u7cfb")}
            resetLabel={"\u91cd\u7f6e\u7b5b\u9009"} scope={<SegmentedControl size="sm" ariaLabel={"\u8d44\u6e90\u4e1a\u52a1\u89c6\u56fe"} value={q.view} onChange={view => navigate({ view })}
              items={[{ value: "sites", label: "\u7ad9\u5740\u53f0\u8d26" }, { value: "relations", label: "\u670d\u52a1\u5173\u7cfb" }]} />}
            search={<Input aria-label={"\u68c0\u7d22\u7ad9\u5740"} placeholder={"\u7ad9\u540d / \u7f16\u7801 / \u5730\u5740"} value={search} onChange={e => setSearch(e.target.value)} />}
            onReset={() => start(() => router.push(siteListHref(DEFAULT_SITE_QUERY)))}
            actions={<Button size="sm" type="submit" variant="secondary"><Icon name="search" size="sm" />{"\u67e5\u8be2"}</Button>}>
            <NativeSelect aria-label={"\u5730\u5e02\u7b5b\u9009"} wrapperClassName="w-auto" value={q.city} onChange={e => navigate({ city: e.target.value, county: "all" })}>
              <option value="all">{"\u5168\u90e8\u5730\u5e02"}</option>{demo.regions.cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </NativeSelect>
            <NativeSelect aria-label={"\u533a\u53bf\u7b5b\u9009"} wrapperClassName="w-auto" value={q.county} disabled={q.city === "all"} onChange={e => navigate({ county: e.target.value })}>
              <option value="all">{"\u5168\u90e8\u533a\u53bf"}</option>{demo.regions.counties.filter(c => c.cityId === q.city).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </NativeSelect>
            <NativeSelect aria-label={"\u8fd0\u8425\u5546\u7b5b\u9009"} wrapperClassName="w-auto" value={q.operator} onChange={e => navigate({ operator: e.target.value })}>
              {["all", "mobile", "telecom", "unicom", "broadcast", "other"].map(code => <option key={code} value={code}>{operatorNames[code]}</option>)}
            </NativeSelect>
          </FilterBar>
          <div className="flex flex-wrap items-center gap-sm pt-sm">
            <NativeSelect aria-label={"\u5171\u4eab\u65b9\u5f0f"} wrapperClassName="w-auto" value={q.sharing} onChange={e => navigate({ sharing: e.target.value })}>
              <option value="all">{"\u5168\u90e8\u5171\u4eab\u65b9\u5f0f"}</option><option value="single">{"\u72ec\u4eab\u7ad9\u5740"}</option><option value="shared">{"\u4e24\u5bb6\u53ca\u4ee5\u4e0a"}</option><option value="multi">{"\u4e09\u5bb6\u53ca\u4ee5\u4e0a"}</option>
            </NativeSelect>
            <NativeSelect aria-label={"\u4e1a\u52a1\u573a\u666f"} wrapperClassName="w-auto" value={q.scene} onChange={e => navigate({ scene: e.target.value })}>
              <option value="all">{"\u5168\u90e8\u4e1a\u52a1\u573a\u666f"}</option>{Object.entries(sceneNames).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </NativeSelect>
            <NativeSelect aria-label={"\u8fd0\u884c\u72b6\u6001\u7b5b\u9009"} wrapperClassName="w-auto" value={q.status} onChange={e => navigate({ status: e.target.value })}>
              <option value="all">{"\u5168\u90e8\u8fd0\u884c\u72b6\u6001"}</option>{Object.entries(statusNames).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </NativeSelect>
            <NativeSelect aria-label={"\u72b6\u6001\u65f6\u6bb5"} wrapperClassName="w-auto" value={q.hour} onChange={e => navigate({ hour: Number(e.target.value) })}>
              {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, "0") + ":00"}</option>)}
            </NativeSelect>
            <span className="ml-auto text-body-small text-muted-foreground">{pending ? "\u66f4\u65b0\u4e2d\u2026" : "\u5efa\u8bbe\u8fd0\u8425\u4e3b\u4f53 \u00b7 \u4e2d\u56fd\u94c1\u5854"}</span>
          </div>
        </form>
        <div className="site-table-scroll min-h-0 min-w-0 flex-1 overflow-y-auto rounded-lg border border-border bg-card" aria-label={q.view === "sites" ? "\u7ad9\u5740\u5217\u8868" : "\u670d\u52a1\u5173\u7cfb\u5217\u8868"}>
          <div className="flex flex-col gap-md p-md sm:hidden">
            {q.view === "sites" ? demo.rows.map(s => <ListCard key={s.id} title={s.name} icon="building" description={s.id}
              onTitleClick={() => router.push(detail(s))}
              status={<StatusBadge tone={s.current.status === "critical" ? "danger" : s.current.status === "warning" ? "warning" : "success"} size="sm">{statusNames[s.current.status]}</StatusBadge>}
              meta={<div className="flex flex-col gap-xs"><span>{s.cityName + " / " + s.countyName + " \u00b7 " + sceneNames[s.profile]}</span>
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
