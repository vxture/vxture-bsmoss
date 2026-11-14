"use client";
import { useState } from "react";

import { Button, DataTable, EmptyState, Icon, NativeSelect, Pagination, StatusBadge } from "@vxture/design-system";
import ActionMenu from '../portal/action-menu';
import { ConfigurationFrame, ConfigurationSearch, ConfigurationDetail, ConfigurationCursorPager, ConfigurationReload, configurationRowClick, configurationTime } from "./configuration-layout";
import { categoryNames, methodNames, objectNames, savePreviewSource, savePreviewMapping, type PreviewSource, type PreviewMapping, type PreviewConfiguration, type PreviewStation } from "../domains/management/preview-configuration";
import { usePreviewConfiguration } from "./preview-configuration-store";
import { SourceEditor, MappingEditor } from "./preview-configuration-editor";
type Selection = { kind: "source"; record: PreviewSource; mode: "new" | "edit" | "detail" } | { kind: "mapping"; record: PreviewMapping; mode: "new" | "edit" | "detail" };
const time = configurationTime;
export default function PreviewConfigurationWorkspace({ view, seed, stations }: { view: "sources" | "mappings"; seed: PreviewConfiguration; stations: PreviewStation[] }) {
  const store = usePreviewConfiguration(seed, stations), sourcesView = view === "sources";
  const [search, setSearch] = useState(""), [status, setStatus] = useState("all"), [sourceId, setSourceId] = useState("all"), [page, setPage] = useState(1), [size,setSize]=useState(20);
  const [selection, setSelection] = useState<Selection | null>(null), [notice, setNotice] = useState(""), [error, setError] = useState("");
  const findSource = (id: string) => store.data.sources.find(s => s.id === id);
  const findStation = (id: string) => stations.find(s => s.id === id);
  const needle = search.trim().toLowerCase();
  const sourceRows = store.data.sources.filter(r => (status === "all" || r.status === status) && (r.name + " " + r.id + " " + categoryNames[r.category]).toLowerCase().includes(needle));
  const mappingRows = store.data.mappings.filter(r => (status === "all" || r.status === status) && (sourceId === "all" || r.sourceId === sourceId) && (r.externalId + " " + findSource(r.sourceId)?.name + " " + findStation(r.stationId)?.name + " " + r.stationId).toLowerCase().includes(needle));
  const total = sourcesView ? sourceRows.length : mappingRows.length, pageCount = Math.max(1, Math.ceil(total / size)), currentPage = Math.min(page, pageCount);
  function open(s: Selection) { setSelection(previous=>s.mode==="detail"&&previous?.mode==="detail"&&previous.kind===s.kind&&previous.record.id===s.record.id?null:s); setNotice(""); setError(""); }
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
  const sourceVisible=sourceRows.slice((currentPage-1)*size,currentPage*size),mappingVisible=mappingRows.slice((currentPage-1)*size,currentPage*size);
  return <ConfigurationFrame area="data" view={view} context={<span>{"\u672c\u673a\u4fdd\u5b58 \u00b7 \u5f53\u524d\u6d4f\u89c8\u5668"}</span>}
   tools={<ConfigurationSearch value={search} onChange={value=>filter(()=>{setSearch(value);setSelection(null);})} onReset={()=>{setSearch("");setStatus("all");setSourceId("all");setPage(1);setSelection(null);setError("");setNotice("");store.load();}}
    filters={<>{!sourcesView&&<NativeSelect className="h-control-xl text-body" aria-label={"\u7b5b\u9009\u6570\u636e\u6765\u6e90"} wrapperClassName="w-auto max-w-control-3xl" value={sourceId} onChange={event=>filter(()=>{setSourceId(event.target.value);setSelection(null);})}><option value="all">{"\u5168\u90e8\u6765\u6e90"}</option>{store.data.sources.map(source=><option key={source.id} value={source.id}>{source.name}</option>)}</NativeSelect>}<NativeSelect className="h-control-xl text-body" aria-label={"\u7b5b\u9009\u72b6\u6001"} wrapperClassName="w-auto" value={status} onChange={event=>filter(()=>{setStatus(event.target.value);setSelection(null);})}><option value="all">{"\u5168\u90e8\u72b6\u6001"}</option><option value="active">{"\u542f\u7528"}</option><option value="paused">{"\u505c\u7528"}</option></NativeSelect></>}
    actions={<><Button type="button" className="h-control-xl text-body" disabled={!store.ready} onClick={add}><Icon name="plus" size="sm"/>{sourcesView?"\u65b0\u589e\u6765\u6e90":"\u65b0\u589e\u6620\u5c04"}</Button></>}/>}>
    {(error||store.error)&&<div role="alert" className="flex flex-wrap items-center gap-xs text-body-small text-danger-text"><span>{error||store.error}</span><ConfigurationReload onClick={store.load}/></div>}
    {notice&&<p role="status" className="text-body-small text-success-text">{notice}</p>}
    <div className="site-analysis-table min-w-0 overflow-x-auto" aria-busy={!store.ready && !store.error} onClick={sourcesView?configurationRowClick(sourceVisible,record=>open({kind:"source",record,mode:"detail"})):configurationRowClick(mappingVisible,record=>open({kind:"mapping",record,mode:"detail"}))}>{sourcesView ? <DataTable rows={store.ready ? sourceVisible : []} rowKey={r => r.id} empty={empty} columns={[
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
    ]} /> : <DataTable rows={store.ready ? mappingVisible : []} rowKey={r => r.id} empty={empty} columns={[
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
    <Pagination className="product-pagination site-analysis-pagination site-analysis-action-row" pageSize={size} pageSizeOptions={[10,20,50,100]} pageSizeLabel={"\u6bcf\u9875\u663e\u793a\u6570\u91cf"} pageSizeOptionTemplate={"\u6bcf\u9875 {size} \u6761"} onPageSizeChange={value=>{setSize(value);setPage(1);setSelection(null);}} aria-label={"\u914d\u7f6e\u5206\u9875"} page={currentPage} pageCount={pageCount} total={total} countLabel={"\u5171\u8ba1\uff1a"+total+" \u6761\u8bb0\u5f55"} onPageChange={value=>{setPage(value);setSelection(null);}} firstLabel={"\u9996\u9875"} previousLabel={"\u4e0a\u4e00\u9875"} nextLabel={"\u4e0b\u4e00\u9875"} lastLabel={"\u672b\u9875"} />
    <ConfigurationDetail open={!!selection} onClose={()=>setSelection(null)} title={selection?.mode==="new"?sourcesView?"\u65b0\u589e\u6765\u6e90":"\u65b0\u589e\u6620\u5c04":sourcesView?"\u6765\u6e90\u8be6\u60c5":"\u6620\u5c04\u8be6\u60c5"} description={"\u672c\u673a\u914d\u7f6e"}>
      {selection && <div className="flex min-w-0 flex-col gap-xl">
        <div className="flex flex-wrap items-center justify-between gap-md"><span className="text-body-small text-muted-foreground">{selection.mode === "new" ? "\u586b\u5199\u540e\u4fdd\u5b58\uff0c\u8fd4\u56de\u5217\u8868\u5373\u53ef\u67e5\u770b" : "\u4fee\u6539\u65f6\u95f4\uff1a" + time(selection.record.updatedAt)}</span>{selection.mode === "detail" && <Button className="h-control-xl text-body" variant="outline" onClick={() => setSelection({ ...selection, mode: "edit" })}>{"\u7f16\u8f91"}</Button>}</div>
        {notice && <p role="status" className="text-body-small text-success-text">{notice}</p>}
        {selection.kind === "source" ? <SourceEditor key={selection.record.id + selection.mode + selection.record.updatedAt} record={selection.record} editing={selection.mode !== "detail"} isNew={selection.mode === "new"} onSave={saveSource} onCancel={() => setSelection(null)} /> : <MappingEditor key={selection.record.id + selection.mode + selection.record.updatedAt} record={selection.record} sources={store.data.sources} stations={stations} editing={selection.mode !== "detail"} onSave={saveMapping} onCancel={() => setSelection(null)} />}
      </div>}
    </ConfigurationDetail>
  </ConfigurationFrame>;
}
