"use client";
import { useEffect, useRef, useState } from "react";
import { Button, DataTable, Drawer, EmptyState, Icon, InputGroup, InputGroupAddon, InputGroupInput, NativeSelect, PanelCard, ShellPageContainer, StatusBadge } from "@vxture/design-system";
import PageHeading from "../portal/page-heading";
import type { ManagementPage } from "../domains/management/rules";
import type { MappingKind, MappingRecord } from "../domains/management/mapping-rules";

const kinds: Record<MappingKind, string> = { site: "\u7ad9\u5740\u53c2\u6570", service: "\u670d\u52a1\u5173\u7cfb", network: "\u7f51\u7edc\u5bf9\u8c61", device: "\u8bbe\u5907\u5bf9\u8c61" };
const networkLabels: Record<string, string> = { base_station: "\u57fa\u7ad9", cell: "\u5c0f\u533a", statistic_point: "\u7edf\u8ba1\u70b9" };
const forbidden = "\u5f53\u524d\u8d26\u53f7\u65e0\u67e5\u770b\u6743\u9650\u6216\u4f1a\u8bdd\u5df2\u5931\u6548\uff0c\u8bf7\u91cd\u65b0\u767b\u5f55\u6216\u8054\u7cfb\u7ba1\u7406\u5458\u3002";
function useMappingRead<T>(url: string | null) {
  const [state, setState] = useState<{ url: string | null; data: T | null; error: string; status: number; busy: boolean }>({ url: null, data: null, error: "", status: 0, busy: false });
  const [revision, setRevision] = useState(0), active = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController(); active.current = controller;
    setState({ url, data: null, error: "", status: 0, busy: !!url });
    if (url) void (async () => {
      try {
        const response = await fetch(url, { cache: "no-store", signal: controller.signal });
        if (!response.ok) {
          if (!controller.signal.aborted) setState({ url, data: null, status: response.status, busy: false,
            error: [401, 403].includes(response.status) ? forbidden : response.status === 404 ? "\u8be5\u6620\u5c04\u5f53\u524d\u4e0d\u53ef\u67e5\u770b\u3002" : "\u6682\u65f6\u65e0\u6cd5\u8bfb\u53d6\u5bf9\u8c61\u6620\u5c04\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002" });
          return;
        }
        const data = await response.json() as T;
        if (!controller.signal.aborted) setState({ url, data, error: "", status: 0, busy: false });
      } catch { if (!controller.signal.aborted) setState({ url, data: null, error: "\u6682\u65f6\u65e0\u6cd5\u8bfb\u53d6\u5bf9\u8c61\u6620\u5c04\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002", status: 503, busy: false }); }
    })();
    return () => controller.abort();
  }, [url, revision]);
  return { ...(state.url === url ? state : { url, data: null, error: "", status: 0, busy: !!url }),
    reload: () => setRevision(v => v + 1), invalidate: () => { active.current?.abort(); setState({ url, data: null, error: forbidden, status: 403, busy: false }); } };
}
const time = (v: string) => new Date(v).toLocaleString("zh-CN", { hour12: false });
function Period({ from, to }: { from: string; to: string }) {
  return <span className="flex flex-col gap-xs text-body-small text-muted-foreground"><time dateTime={from} title={from} className="whitespace-nowrap">{time(from)}</time><time dateTime={to} title={to} className="whitespace-nowrap">{"\u81f3 " + time(to)}</time></span>;
}
export default function MappingWorkspace() {
  const [search, setSearch] = useState(""), [kind, setKind] = useState("all"), [cursors, setCursors] = useState<string[]>([]), [selected, setSelected] = useState<string | null>(null);
  const params = new URLSearchParams({ search: search.trim(), kind });
  if (cursors.length) params.set("after", cursors.at(-1)!);
  const endpoint = "/api/management/object-mappings", read = useMappingRead<ManagementPage<MappingRecord>>(endpoint + "?" + params);
  const detail = useMappingRead<MappingRecord>(selected && read.data && !read.error ? endpoint + "/" + encodeURIComponent(selected) : null);
  useEffect(() => { if ([401, 403].includes(detail.status)) { setSelected(null); read.invalidate(); } }, [detail.status]);
  const reset = () => { setCursors([]); setSelected(null); };
  return <ShellPageContainer className="gap-lg"><PageHeading title={"\u5bf9\u8c61\u6620\u5c04"} description={"\u6838\u5bf9\u5916\u90e8\u5bf9\u8c61\u4e0e\u7ad9\u5740\u3001\u670d\u52a1\u53ca\u8bbe\u5907\u7684\u5173\u8054\u548c\u6709\u6548\u671f"}
    actions={<Button variant="outline" disabled={read.busy} onClick={() => { setSelected(null); read.reload(); }}>{"\u91cd\u65b0\u8bfb\u53d6"}</Button>}
    toolbar={<div className="flex flex-wrap items-center gap-lg"><NativeSelect wrapperClassName="w-auto" aria-label={"\u76ee\u6807\u7c7b\u578b"} value={kind} onChange={e => { reset(); setKind(e.target.value); }}>
      <option value="all">{"\u5168\u90e8\u76ee\u6807\u7c7b\u578b"}</option>{Object.entries(kinds).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</NativeSelect>
      <div className="min-w-0 sm:ml-auto"><InputGroup><InputGroupAddon><Icon name="search" size="sm" /></InputGroupAddon><InputGroupInput aria-label={"\u68c0\u7d22\u5bf9\u8c61\u6620\u5c04"} placeholder={"\u5916\u90e8\u5bf9\u8c61 / \u7ad9\u5740 / \u670d\u52a1 / \u8bbe\u5907"} maxLength={100} value={search} onChange={e => { reset(); setSearch(e.target.value); }} /></InputGroup></div></div>} />
    <PanelCard title={"\u6620\u5c04\u53e3\u5f84"} icon="stack"><p className="text-body-small text-muted-foreground">{"\u5c55\u793a\u6388\u6743\u8303\u56f4\u5185\u7684\u6620\u5c04\u5b9a\u4e49\uff0c\u6709\u6548\u671f\u91c7\u7528\u5de6\u95ed\u53f3\u5f00\u533a\u95f4\u3002\u6620\u5c04\u7248\u672c\u4e0e\u6765\u6e90\u8f6c\u6362\u7248\u672c\u76f8\u4e92\u72ec\u7acb\uff1b\u5173\u8054\u53ca\u6709\u6548\u671f\u68c0\u67e5\u4e0d\u4ee3\u8868\u6307\u6807\u517c\u5bb9\u3001\u6765\u6e90\u6388\u6743\u7b7e\u8ba4\u6216\u6570\u636e\u5df2\u53ef\u5206\u6790\u3002"}</p></PanelCard>
    {read.error && <p role="alert" className="text-body-small text-danger-text">{read.error}</p>}
    <div aria-busy={read.busy}><DataTable rows={read.data?.items ?? []} rowKey={r => r.id} empty={<EmptyState title={read.busy ? "\u6b63\u5728\u8bfb\u53d6" : read.error ? "\u65e0\u6cd5\u663e\u793a\u6620\u5c04" : "\u6682\u65e0\u5339\u914d\u5bf9\u8c61\u6620\u5c04"} description={"\u53ef\u8c03\u6574\u68c0\u7d22\u6761\u4ef6\uff0c\u6216\u7531\u7ba1\u7406\u5458\u6838\u5bf9\u6620\u5c04\u767b\u8bb0\u4e0e\u67e5\u770b\u6743\u9650\u3002"} />} columns={[
      { id: "external", header: "\u5916\u90e8\u5bf9\u8c61", cell: r => <div className="flex min-w-0 flex-col gap-xs"><Button variant="ghost" className="h-auto justify-start whitespace-normal break-all px-0 text-left" onClick={() => setSelected(r.id)}>{r.externalId}</Button><span className="break-all text-body-small text-muted-foreground">{r.externalType + " \u00b7 " + r.sourceId}</span></div> },
      { id: "target", header: "\u5173\u8054\u76ee\u6807", cell: r => <div className="flex min-w-0 flex-col gap-xs"><span className="break-all text-body">{r.stationName}</span><span className="break-all text-body-small text-muted-foreground">{r.deviceId ?? r.networkObjectId ?? r.serviceId ?? r.stationId}</span></div> },
      { id: "kind", header: "\u76ee\u6807\u7c7b\u578b", cell: r => kinds[r.kind] },
      { id: "version", header: "\u6620\u5c04\u7248\u672c", cell: r => "v" + r.version },
      { id: "period", header: "\u6620\u5c04\u6709\u6548\u671f", cell: r => <Period from={r.validFrom} to={r.validTo} /> },
      { id: "check", header: "\u670d\u52a1\u6709\u6548\u671f", cell: r => <StatusBadge size="sm" tone={r.serviceCoversMapping === false ? "warning" : "neutral"}>{r.serviceCoversMapping === null ? "\u4e0d\u6d89\u53ca\u670d\u52a1" : r.serviceCoversMapping ? "\u5b8c\u6574\u8986\u76d6" : "\u672a\u5b8c\u6574\u8986\u76d6"}</StatusBadge> },
    ]} /></div>
    <nav aria-label={"\u6620\u5c04\u76ee\u5f55\u5206\u9875"} className="flex flex-wrap items-center justify-between gap-lg"><span className="text-body-small text-muted-foreground">{"\u6620\u5c04\u5b9a\u4e49 \u00b7 \u6bcf\u987520\u9879"}</span><div className="flex items-center gap-md">
      <Button variant="outline" disabled={!cursors.length || read.busy} onClick={() => { setSelected(null); setCursors(v => v.slice(0, -1)); }}>{"\u4e0a\u4e00\u9875"}</Button>
      <Button variant="outline" disabled={!read.data?.next || read.busy} onClick={() => { if (read.data?.next) { setSelected(null); setCursors(v => [...v, read.data!.next!]); } }}>{"\u4e0b\u4e00\u9875"}</Button></div></nav>
    <Drawer open={!!selected && !!read.data} onClose={() => setSelected(null)} title={"\u6620\u5c04\u8be6\u60c5"} side="right" width="lg" className="max-w-full" closeLabel={"\u5173\u95ed\u8be6\u60c5"}>
      {detail.error && <p role="alert" className="text-body-small text-danger-text">{detail.error}</p>}{detail.busy && <p role="status">{"\u6b63\u5728\u8bfb\u53d6\u6620\u5c04\u8be6\u60c5"}</p>}{detail.data && <MappingDetail record={detail.data} />}</Drawer>
  </ShellPageContainer>;
}
function MappingDetail({ record: r }: { record: MappingRecord }) {
  const facts = [["\u6620\u5c04\u6807\u8bc6", r.id], ["\u6765\u6e90\u6807\u8bc6", r.sourceId], ["\u5916\u90e8\u5bf9\u8c61\u7c7b\u578b", r.externalType], ["\u5916\u90e8\u5bf9\u8c61\u6807\u8bc6", r.externalId], ["\u76ee\u6807\u7c7b\u578b", kinds[r.kind]], ["\u6620\u5c04\u7248\u672c", "v" + r.version], ["\u5f52\u5c5e\u7ad9\u5740", r.stationName + " \u00b7 " + r.stationId], ["\u670d\u52a1\u5173\u7cfb", r.serviceId ?? "\u4e0d\u6d89\u53ca"], ["\u7f51\u7edc\u5bf9\u8c61", r.networkObjectId ?? "\u4e0d\u6d89\u53ca"], ["\u7f51\u7edc\u5bf9\u8c61\u7c7b\u578b", r.networkKind ? networkLabels[r.networkKind] : "\u4e0d\u6d89\u53ca"], ["\u8bbe\u5907\u5bf9\u8c61", r.deviceId ?? "\u4e0d\u6d89\u53ca"]];
  return <div className="flex min-w-0 flex-col gap-xl"><dl className="grid min-w-0 gap-lg sm:grid-cols-2">{facts.map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-body-small text-muted-foreground">{label}</dt><dd className="break-all text-body">{value}</dd></div>)}</dl>
    <section className="flex flex-col gap-lg border-t border-dashed border-border pt-lg"><h3 className="text-label font-medium">{"\u6709\u6548\u671f\u6838\u5bf9"}</h3><div><p className="mb-sm text-body-small text-muted-foreground">{"\u6620\u5c04\u6709\u6548\u671f [\u8d77\u59cb\uff0c\u7ed3\u675f)"}</p><Period from={r.validFrom} to={r.validTo} /></div>
      {r.serviceFrom && r.serviceTo && <div><p className="mb-sm text-body-small text-muted-foreground">{"\u670d\u52a1\u6709\u6548\u671f [\u8d77\u59cb\uff0c\u7ed3\u675f)"}</p><Period from={r.serviceFrom} to={r.serviceTo} /></div>}
      <p className="text-body-small">{r.serviceCoversMapping === null ? "\u8be5\u6620\u5c04\u4e0d\u6d89\u53ca\u670d\u52a1\u5173\u7cfb\uff0c\u4ecd\u9700\u6309\u76ee\u6807\u7c7b\u578b\u53ca\u6307\u6807\u6743\u9650\u6821\u9a8c\u63a5\u6536\u6570\u636e\u3002" : r.serviceCoversMapping ? "\u670d\u52a1\u6709\u6548\u671f\u5b8c\u6574\u8986\u76d6\u6620\u5c04\u533a\u95f4\uff1b\u63a5\u6536\u65f6\u4ecd\u9010\u6761\u6838\u5bf9\u6307\u6807\u3001\u5bf9\u8c61\u3001\u8d28\u91cf\u53ca\u6388\u6743\u3002" : "\u670d\u52a1\u6709\u6548\u671f\u672a\u5b8c\u6574\u8986\u76d6\u6620\u5c04\u533a\u95f4\u3002\u670d\u52a1\u7528\u91cf\u53ea\u80fd\u5728\u4e24\u8005\u4ea4\u96c6\u5185\u63a5\u6536\uff1b\u8bf7\u6838\u5bf9\u767b\u8bb0\u4f9d\u636e\u53ca\u6709\u6548\u671f\u3002"}</p></section>
    <p className="text-body-small text-muted-foreground">{"\u672c\u9875\u4e3a\u5f53\u524d\u5b58\u50a8\u5b9a\u4e49\u7684\u53ea\u8bfb\u67e5\u8be2\uff0c\u4e0d\u662f\u6620\u5c04\u53d8\u66f4\u5386\u53f2\u6216\u8fde\u63a5\u6d4b\u8bd5\u3002\u6620\u5c04\u4fee\u6539\u53ef\u80fd\u5f71\u54cd\u805a\u5408\u4e0e\u62a5\u544a\u4f9d\u8d56\uff0c\u5e94\u901a\u8fc7\u53d7\u5ba1\u53d8\u66f4\u6d41\u7a0b\u5904\u7406\u3002"}</p></div>;
}
