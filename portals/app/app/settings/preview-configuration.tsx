"use client";
import { useState } from "react";
import Link from "next/link";
import { ActionMenu, Button, DataTable, Drawer, EmptyState, Icon, InputGroup, InputGroupAddon, InputGroupInput, NativeSelect, Pagination, ShellPageContainer, StatusBadge } from "@vxture/design-system";
import PageHeading from "../portal/page-heading";
import { categoryNames, methodNames, objectNames, savePreviewSource, savePreviewMapping, type PreviewSource, type PreviewMapping, type PreviewConfiguration, type PreviewStation } from "../domains/management/preview-configuration";
import { usePreviewConfiguration } from "./preview-configuration-store";
import { SourceEditor, MappingEditor } from "./preview-configuration-editor";
type Selection = { kind: "source"; record: PreviewSource; mode: "new" | "edit" | "detail" } | { kind: "mapping"; record: PreviewMapping; mode: "new" | "edit" | "detail" };
const time = (v: string) => new Date(v).toLocaleString("zh-CN", { hour12: false });
export default function PreviewConfigurationWorkspace({ view, seed, stations }: { view: "sources" | "mappings"; seed: PreviewConfiguration; stations: PreviewStation[] }) {
  const store = usePreviewConfiguration(seed, stations), sourcesView = view === "sources";
  const [search, setSearch] = useState(""), [status, setStatus] = useState("all"), [sourceId, setSourceId] = useState("all"), [page, setPage] = useState(1);
  const [selection, setSelection] = useState<Selection | null>(null), [notice, setNotice] = useState(""), [error, setError] = useState("");
  const findSource = (id: string) => store.data.sources.find(s => s.id === id);
  const findStation = (id: string) => stations.find(s => s.id === id);
  const needle = search.trim().toLowerCase();
  const sourceRows = store.data.sources.filter(r => (status === "all" || r.status === status) && (r.name + " " + r.id + " " + categoryNames[r.category]).toLowerCase().includes(needle));
  const mappingRows = store.data.mappings.filter(r => (status === "all" || r.status === status) && (sourceId === "all" || r.sourceId === sourceId) && (r.externalId + " " + findSource(r.sourceId)?.name + " " + findStation(r.stationId)?.name + " " + r.stationId).toLowerCase().includes(needle));
  const total = sourcesView ? sourceRows.length : mappingRows.length, pageCount = Math.max(1, Math.ceil(total / 10)), currentPage = Math.min(page, pageCount);
  function open(s: Selection) { setSelection(s); setNotice(""); setError(""); }
  function add() {
    if (sourcesView) open({ kind: "source", mode: "new", record: { id: "", name: "", category: "usage", method: "file", status: "active", note: "", updatedAt: "" } });
    else open({ kind: "mapping", mode: "new", record: { id: crypto.randomUUID(), sourceId: "", externalType: "station", externalId: "", stationId: "", status: "active", note: "", updatedAt: "" } });
  }
  const stamp = (previous: string) => new Date(Math.max(Date.now(), (Date.parse(previous) || 0) + 1)).toISOString();
  function saveSource(r: PreviewSource) {
    if (selection?.kind !== "source") return;
    const updated = { ...r, updatedAt: stamp(selection.record.updatedAt) };
    store.save(data => savePreviewSource(data, updated, selection.mode === "new" ? null : selection.record.updatedAt));
    setSelection({ kind: "source", record: updated, mode: "detail" }); setNotice("\u6765\u6e90\u914d\u7f6e\u5df2\u4fdd\u5b58\u5230\u672c\u673a\u3002");
  }
  function saveMapping(r: PreviewMapping) {
    if (selection?.kind !== "mapping") return;
    const updated = { ...r, updatedAt: stamp(selection.record.updatedAt) };
    store.save(data => savePreviewMapping(data, updated, selection.mode === "new" ? null : selection.record.updatedAt, stations));
    setSelection({ kind: "mapping", record: updated, mode: "detail" }); setNotice("\u5bf9\u8c61\u6620\u5c04\u5df2\u4fdd\u5b58\u5230\u672c\u673a\u3002");
  }
  function toggle(r: PreviewSource | PreviewMapping, kind: "source" | "mapping") {
    try {
      const updated = { ...r, status: r.status === "active" ? "paused" as const : "active" as const, updatedAt: stamp(r.updatedAt) };
      store.save(data => kind === "source" ? savePreviewSource(data, updated as PreviewSource, r.updatedAt) : savePreviewMapping(data, updated as PreviewMapping, r.updatedAt, stations));
      setNotice("\u914d\u7f6e\u5df2" + (updated.status === "active" ? "\u542f\u7528" : "\u505c\u7528") + "\uff0c\u5df2\u4fdd\u5b58\u5230\u672c\u673a\u3002"); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "\u4fdd\u5b58\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5\u3002"); }
  }
  function filter(change: () => void) { change(); setPage(1); }
  const empty = <EmptyState title={store.ready ? "\u6682\u65e0\u5339\u914d\u8bb0\u5f55" : store.error ? "\u914d\u7f6e\u6682\u4e0d\u53ef\u7528" : "\u6b63\u5728\u8bfb\u53d6\u914d\u7f6e"} description={"\u53ef\u8c03\u6574\u7b5b\u9009\u6761\u4ef6\uff0c\u6216\u65b0\u589e\u4e00\u6761\u914d\u7f6e\u3002"} />;
  return <ShellPageContainer className="gap-lg">
    <PageHeading title={sourcesView ? "\u6765\u6e90\u914d\u7f6e" : "\u5bf9\u8c61\u6620\u5c04"} description={sourcesView ? "\u7ba1\u7406\u6570\u636e\u6765\u6e90\u3001\u4e1a\u52a1\u7c7b\u522b\u4e0e\u63a5\u5165\u65b9\u5f0f" : "\u5c06\u6765\u6e90\u5bf9\u8c61\u5173\u8054\u81f3\u7ad9\u5740\u53f0\u8d26\uff0c\u7edf\u4e00\u5bf9\u8c61\u5f52\u5c5e"}
      context={<span className="text-body-small text-muted-foreground">{"\u672c\u673a\u4fdd\u5b58 \u00b7 \u5f53\u524d\u6d4f\u89c8\u5668"}</span>}
      actions={<><Button variant="outline" onClick={() => { setSelection(null); setNotice(""); setError(""); store.load(); }}>{"\u91cd\u65b0\u8bfb\u53d6"}</Button><Button disabled={!store.ready} onClick={add}><Icon name="plus" size="sm" />{sourcesView ? "\u65b0\u589e\u6765\u6e90" : "\u65b0\u589e\u6620\u5c04"}</Button></>}
      toolbar={<div className="flex flex-wrap items-center gap-lg">
        {!sourcesView && <NativeSelect aria-label={"\u7b5b\u9009\u6570\u636e\u6765\u6e90"} wrapperClassName="w-auto max-w-full" value={sourceId} onChange={e => filter(() => setSourceId(e.target.value))}><option value="all">{"\u5168\u90e8\u6570\u636e\u6765\u6e90"}</option>{store.data.sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</NativeSelect>}
        <NativeSelect aria-label={"\u7b5b\u9009\u72b6\u6001"} wrapperClassName="w-auto" value={status} onChange={e => filter(() => setStatus(e.target.value))}><option value="all">{"\u5168\u90e8\u72b6\u6001"}</option><option value="active">{"\u542f\u7528"}</option><option value="paused">{"\u505c\u7528"}</option></NativeSelect>
        <div className="min-w-0 sm:ml-auto"><InputGroup><InputGroupAddon><Icon name="search" size="sm" /></InputGroupAddon><InputGroupInput aria-label={"\u68c0\u7d22\u914d\u7f6e"} maxLength={100} value={search} placeholder={sourcesView ? "\u6765\u6e90\u540d\u79f0 / \u7f16\u7801" : "\u6765\u6e90\u5bf9\u8c61 / \u7ad9\u5740\u540d\u79f0"} onChange={e => filter(() => setSearch(e.target.value))} /></InputGroup></div>
      </div>} />
    <div className="flex flex-wrap items-center justify-between gap-md text-body-small text-muted-foreground"><span>{sourcesView ? store.data.sources.length + " \u4e2a\u6570\u636e\u6765\u6e90" : store.data.mappings.length + " \u6761\u5bf9\u8c61\u6620\u5c04"}</span><Link className="text-primary hover:underline" href={sourcesView ? "/settings/mappings" : "/settings/sources"}>{sourcesView ? "\u7ba1\u7406\u5bf9\u8c61\u6620\u5c04" : "\u7ba1\u7406\u6570\u636e\u6765\u6e90"}</Link></div>
    {(error || store.error) && <p role="alert" className="text-body-small text-danger-text">{error || store.error}</p>}
    {notice && <p role="status" className="text-body-small text-success-text">{notice}</p>}
    <div className="min-w-0" aria-busy={!store.ready && !store.error}>{sourcesView ? <DataTable rows={store.ready ? sourceRows.slice((currentPage - 1) * 10, currentPage * 10) : []} rowKey={r => r.id} empty={empty} columns={[
      { id: "name", header: "\u6570\u636e\u6765\u6e90", cell: r => <div className="flex min-w-0 flex-col gap-xs"><Button variant="ghost" className="h-auto justify-start whitespace-normal break-words px-0 text-left" onClick={() => open({ kind: "source", record: r, mode: "detail" })}>{r.name}</Button><span className="text-body-small text-muted-foreground">{r.id}</span></div> },
      { id: "category", header: "\u4e1a\u52a1\u7c7b\u522b", cell: r => categoryNames[r.category] },
      { id: "method", header: "\u63a5\u5165\u65b9\u5f0f", cell: r => methodNames[r.method] },
      { id: "mappings", header: "\u5173\u8054\u6620\u5c04", cell: r => store.data.mappings.filter(m => m.sourceId === r.id).length + " \u6761" },
      { id: "status", header: "\u72b6\u6001", cell: r => <StatusBadge size="sm" tone={r.status === "active" ? "success" : "neutral"}>{r.status === "active" ? "\u542f\u7528" : "\u505c\u7528"}</StatusBadge> },
      { id: "at", header: "\u4fee\u6539\u65f6\u95f4", cell: r => <span className="whitespace-nowrap text-body-small text-muted-foreground">{time(r.updatedAt)}</span> },
      { id: "actions", header: "\u64cd\u4f5c", cell: r => <ActionMenu label={"\u6765\u6e90\u64cd\u4f5c\uff1a" + r.name} items={[
        { id: "edit", label: "\u7f16\u8f91", onSelect: () => open({ kind: "source", record: r, mode: "edit" }) },
        { id: "toggle", label: r.status === "active" ? "\u505c\u7528" : "\u542f\u7528", onSelect: () => toggle(r, "source") },
      ]} /> },
    ]} /> : <DataTable rows={store.ready ? mappingRows.slice((currentPage - 1) * 10, currentPage * 10) : []} rowKey={r => r.id} empty={empty} columns={[
      { id: "external", header: "\u6765\u6e90\u5bf9\u8c61", cell: r => <div className="flex min-w-0 flex-col gap-xs"><Button variant="ghost" className="h-auto justify-start whitespace-normal break-all px-0 text-left" onClick={() => open({ kind: "mapping", record: r, mode: "detail" })}>{r.externalId}</Button><span className="text-body-small text-muted-foreground">{objectNames[r.externalType]}</span></div> },
      { id: "source", header: "\u6570\u636e\u6765\u6e90", cell: r => findSource(r.sourceId)?.name },
      { id: "station", header: "\u5173\u8054\u7ad9\u5740", cell: r => <div className="flex min-w-0 flex-col gap-xs"><span>{findStation(r.stationId)?.name}</span><span className="text-body-small text-muted-foreground">{findStation(r.stationId)?.region}</span></div> },
      { id: "status", header: "\u72b6\u6001", cell: r => <StatusBadge size="sm" tone={r.status === "active" ? "success" : "neutral"}>{r.status === "active" ? "\u542f\u7528" : "\u505c\u7528"}</StatusBadge> },
      { id: "at", header: "\u4fee\u6539\u65f6\u95f4", cell: r => <span className="whitespace-nowrap text-body-small text-muted-foreground">{time(r.updatedAt)}</span> },
      { id: "actions", header: "\u64cd\u4f5c", cell: r => <ActionMenu label={"\u6620\u5c04\u64cd\u4f5c\uff1a" + r.externalId} items={[
        { id: "edit", label: "\u7f16\u8f91", onSelect: () => open({ kind: "mapping", record: r, mode: "edit" }) },
        { id: "toggle", label: r.status === "active" ? "\u505c\u7528" : "\u542f\u7528", onSelect: () => toggle(r, "mapping") },
      ]} /> },
    ]} />}</div>
    <Pagination aria-label={"\u914d\u7f6e\u5206\u9875"} page={currentPage} pageCount={pageCount} total={total} countLabel={total + " \u6761\u8bb0\u5f55"} onPageChange={setPage} firstLabel={"\u9996\u9875"} previousLabel={"\u4e0a\u4e00\u9875"} nextLabel={"\u4e0b\u4e00\u9875"} lastLabel={"\u672b\u9875"} />
    <Drawer open={!!selection} onClose={() => setSelection(null)} title={selection?.mode === "new" ? sourcesView ? "\u65b0\u589e\u6765\u6e90" : "\u65b0\u589e\u6620\u5c04" : sourcesView ? "\u6765\u6e90\u8be6\u60c5" : "\u6620\u5c04\u8be6\u60c5"} closeLabel={"\u5173\u95ed\u914d\u7f6e"} side="right" width="lg" className="max-w-full">
      {selection && <div className="flex min-w-0 flex-col gap-xl">
        <div className="flex flex-wrap items-center justify-between gap-md"><span className="text-body-small text-muted-foreground">{selection.mode === "new" ? "\u586b\u5199\u540e\u4fdd\u5b58\uff0c\u8fd4\u56de\u5217\u8868\u5373\u53ef\u67e5\u770b" : "\u4fee\u6539\u65f6\u95f4\uff1a" + time(selection.record.updatedAt)}</span>{selection.mode === "detail" && <Button variant="outline" onClick={() => setSelection({ ...selection, mode: "edit" })}>{"\u7f16\u8f91"}</Button>}</div>
        {notice && <p role="status" className="text-body-small text-success-text">{notice}</p>}
        {selection.kind === "source" ? <SourceEditor key={selection.record.id + selection.mode + selection.record.updatedAt} record={selection.record} editing={selection.mode !== "detail"} isNew={selection.mode === "new"} onSave={saveSource} onCancel={() => setSelection(null)} /> : <MappingEditor key={selection.record.id + selection.mode + selection.record.updatedAt} record={selection.record} sources={store.data.sources} stations={stations} editing={selection.mode !== "detail"} onSave={saveMapping} onCancel={() => setSelection(null)} />}
      </div>}
    </Drawer>
  </ShellPageContainer>;
}
