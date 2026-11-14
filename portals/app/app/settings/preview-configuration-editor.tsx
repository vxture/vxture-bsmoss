"use client";
import { useState } from "react";
import { Button, Input, NativeSelect, Textarea } from "@vxture/design-system";
import { categoryNames, methodNames, objectNames, type PreviewSource, type PreviewMapping, type PreviewStation } from "../domains/management/preview-configuration";
const fieldClass = "flex min-w-0 flex-col gap-xs text-body";
export function SourceEditor({ record, editing, isNew, onSave, onCancel }: {
  record: PreviewSource; editing: boolean; isNew: boolean; onSave(r: PreviewSource): void; onCancel(): void;
}) {
  const [draft, setDraft] = useState(record), [error, setError] = useState("");
  const change = (patch: Partial<PreviewSource>) => { setDraft(r => ({ ...r, ...patch })); setError(""); };
  return <form aria-label={"\u6765\u6e90\u914d\u7f6e\u8868\u5355"} className="flex min-w-0 flex-col gap-xl" onSubmit={e => { e.preventDefault(); try { onSave(draft); } catch (e) { setError(e instanceof Error ? e.message : "\u4fdd\u5b58\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5\u3002"); } }}>
    <fieldset disabled={!editing} className="grid min-w-0 gap-lg sm:grid-cols-2">
      <label className={fieldClass}><span>{"\u6765\u6e90\u540d\u79f0"}</span><Input className="h-control-xl text-body" required maxLength={80} value={draft.name} onChange={e => change({ name: e.target.value })} placeholder={"\u4f8b\u5982\uff1a\u9655\u897f\u4e1a\u52a1\u7528\u91cf"} /></label>
      <label className={fieldClass}><span>{"\u6765\u6e90\u7f16\u7801"}</span><Input className="h-control-xl text-body" aria-label={"\u6765\u6e90\u7f16\u7801"} required disabled={!isNew} maxLength={64} pattern="[a-zA-Z0-9][a-zA-Z0-9_-]*" value={draft.id} onChange={e => change({ id: e.target.value })} placeholder="shaanxi-usage" /><span className="text-body-small text-muted-foreground">{"\u5b57\u6bcd\u3001\u6570\u5b57\u3001\u4e0b\u5212\u7ebf\u6216\u77ed\u6a2a\u7ebf\uff0c\u4fdd\u5b58\u540e\u4e0d\u53ef\u4fee\u6539"}</span></label>
      <label className={fieldClass}><span>{"\u4e1a\u52a1\u7c7b\u522b"}</span><NativeSelect className="h-control-xl text-body" aria-label={"\u4e1a\u52a1\u7c7b\u522b"} value={draft.category} onChange={e => change({ category: e.target.value as PreviewSource["category"] })}>{Object.entries(categoryNames).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</NativeSelect></label>
      <label className={fieldClass}><span>{"\u63a5\u5165\u65b9\u5f0f"}</span><NativeSelect className="h-control-xl text-body" aria-label={"\u63a5\u5165\u65b9\u5f0f"} value={draft.method} onChange={e => change({ method: e.target.value as PreviewSource["method"] })}>{Object.entries(methodNames).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</NativeSelect></label>
      <label className={fieldClass}><span>{"\u914d\u7f6e\u72b6\u6001"}</span><NativeSelect className="h-control-xl text-body" aria-label={"\u914d\u7f6e\u72b6\u6001"} value={draft.status} onChange={e => change({ status: e.target.value as PreviewSource["status"] })}><option value="active">{"\u542f\u7528"}</option><option value="paused">{"\u505c\u7528"}</option></NativeSelect></label>
      <label className={fieldClass + " sm:col-span-2"}><span>{"\u5907\u6ce8"}</span><Textarea aria-label={"\u5907\u6ce8"} rows={3} maxLength={500} value={draft.note} onChange={e => change({ note: e.target.value })} /></label>
    </fieldset>
    <p className="text-body-small text-muted-foreground">{"\u63a5\u5165\u65b9\u5f0f\u4e0e\u542f\u505c\u72b6\u6001\u7528\u4e8e\u914d\u7f6e\u7ba1\u7406\uff0c\u4e0d\u4ee3\u8868\u5df2\u8fde\u63a5\u5916\u90e8\u7cfb\u7edf\uff0c\u4e5f\u4e0d\u4f1a\u81ea\u52a8\u63a5\u6536\u6216\u66f4\u65b0\u4e1a\u52a1\u6570\u636e\u3002"}</p>
    {error && <p role="alert" className="text-body-small text-danger-text">{error}</p>}
    {editing && <div className="flex flex-wrap items-center justify-end gap-md border-t border-dashed border-border pt-lg"><Button className="h-control-xl text-body" type="button" variant="outline" onClick={onCancel}>{"\u53d6\u6d88"}</Button><Button className="h-control-xl text-body" type="submit">{"\u4fdd\u5b58\u914d\u7f6e"}</Button></div>}
  </form>;
}
export function MappingEditor({ record, sources, stations, editing, onSave, onCancel }: {
  record: PreviewMapping; sources: PreviewSource[]; stations: PreviewStation[]; editing: boolean; onSave(r: PreviewMapping): void; onCancel(): void;
}) {
  const [draft, setDraft] = useState(record), [search, setSearch] = useState(""), [error, setError] = useState("");
  const change = (patch: Partial<PreviewMapping>) => { setDraft(r => ({ ...r, ...patch })); setError(""); };
  const selected = stations.find(s => s.id === draft.stationId);
  const matches = stations.filter(s => (s.name + " " + s.id + " " + s.region).toLowerCase().includes(search.trim().toLowerCase()));
  const choices = matches.slice(0, 50);
  if (selected && !choices.some(s => s.id === selected.id)) choices.unshift(selected);
  return <form aria-label={"\u5bf9\u8c61\u6620\u5c04\u8868\u5355"} className="flex min-w-0 flex-col gap-xl" onSubmit={e => { e.preventDefault(); try { onSave(draft); } catch (e) { setError(e instanceof Error ? e.message : "\u4fdd\u5b58\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5\u3002"); } }}>
    <fieldset disabled={!editing} className="grid min-w-0 gap-lg sm:grid-cols-2">
      <label className={fieldClass + " sm:col-span-2"}><span>{"\u6570\u636e\u6765\u6e90"}</span><NativeSelect className="h-control-xl text-body" required aria-label={"\u6570\u636e\u6765\u6e90"} value={draft.sourceId} onChange={e => change({ sourceId: e.target.value })}><option value="">{"\u8bf7\u9009\u62e9\u6570\u636e\u6765\u6e90"}</option>{sources.map(s => <option key={s.id} value={s.id}>{s.name + (s.status === "paused" ? " \u00b7 \u5df2\u505c\u7528" : "")}</option>)}</NativeSelect></label>
      <label className={fieldClass}><span>{"\u5bf9\u8c61\u7c7b\u578b"}</span><NativeSelect className="h-control-xl text-body" aria-label={"\u5bf9\u8c61\u7c7b\u578b"} value={draft.externalType} onChange={e => change({ externalType: e.target.value as PreviewMapping["externalType"] })}>{Object.entries(objectNames).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</NativeSelect></label>
      <label className={fieldClass}><span>{"\u6765\u6e90\u5bf9\u8c61\u7f16\u7801"}</span><Input className="h-control-xl text-body" required maxLength={120} value={draft.externalId} onChange={e => change({ externalId: e.target.value })} placeholder={"\u5916\u90e8\u7cfb\u7edf\u4e2d\u7684\u552f\u4e00\u7f16\u7801"} /></label>
      <div className="flex min-w-0 flex-col gap-md rounded-lg border border-dashed border-border p-lg sm:col-span-2">
        {editing && <label className={fieldClass}><span>{"\u68c0\u7d22\u7ad9\u5740"}</span><Input className="h-control-xl text-body" maxLength={100} value={search} onChange={e => setSearch(e.target.value)} placeholder={"\u8f93\u5165\u7ad9\u5740\u540d\u79f0\u3001\u7f16\u7801\u6216\u533a\u53bf"} /></label>}
        <label className={fieldClass}><span>{"\u5173\u8054\u7ad9\u5740"}</span><NativeSelect className="h-control-xl text-body" required aria-label={"\u5173\u8054\u7ad9\u5740"} value={draft.stationId} onChange={e => change({ stationId: e.target.value })}><option value="">{matches.length ? "\u8bf7\u9009\u62e9\u5173\u8054\u7ad9\u5740" : "\u672a\u627e\u5230\u5339\u914d\u7ad9\u5740"}</option>{choices.map(s => <option key={s.id} value={s.id}>{s.name + " \u00b7 " + s.id}</option>)}</NativeSelect></label>
        {selected ? <p className="break-words text-body-small text-muted-foreground">{selected.region + " \u00b7 " + selected.name}</p> : <p className="text-body-small text-muted-foreground">{"\u8bf7\u4ece\u7ad9\u5740\u53f0\u8d26\u9009\u62e9\uff0c\u4e0d\u9ed8\u8ba4\u5173\u8054\u4efb\u4f55\u7ad9\u5740\u3002"}</p>}
        {editing && <p className="text-body-small text-muted-foreground">{matches.length > 50 ? "\u5339\u914d " + matches.length + " \u5ea7\uff0c\u5148\u663e\u793a50\u5ea7\uff0c\u8bf7\u8f93\u5165\u5173\u952e\u8bcd\u7f29\u5c0f\u8303\u56f4\u3002" : "\u5339\u914d " + matches.length + " \u5ea7\u7ad9\u5740"}</p>}
      </div>
      <label className={fieldClass}><span>{"\u6620\u5c04\u72b6\u6001"}</span><NativeSelect className="h-control-xl text-body" aria-label={"\u6620\u5c04\u72b6\u6001"} value={draft.status} onChange={e => change({ status: e.target.value as PreviewMapping["status"] })}><option value="active">{"\u542f\u7528"}</option><option value="paused">{"\u505c\u7528"}</option></NativeSelect></label>
      <label className={fieldClass + " sm:col-span-2"}><span>{"\u5907\u6ce8"}</span><Textarea aria-label={"\u5907\u6ce8"} rows={3} maxLength={500} value={draft.note} onChange={e => change({ note: e.target.value })} /></label>
    </fieldset>
    {error && <p role="alert" className="text-body-small text-danger-text">{error}</p>}
    {editing && <div className="flex flex-wrap items-center justify-end gap-md border-t border-dashed border-border pt-lg"><Button className="h-control-xl text-body" type="button" variant="outline" onClick={onCancel}>{"\u53d6\u6d88"}</Button><Button className="h-control-xl text-body" type="submit">{"\u4fdd\u5b58\u6620\u5c04"}</Button></div>}
  </form>;
}
