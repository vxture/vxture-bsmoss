"use client";
import { useState } from "react";
import { Button, Checkbox, Icon, Input, NativeSelect } from "@vxture/design-system";
import { CATEGORIES, refKey } from "../../domains/catalog/registry";
import type { TemplateCandidate } from "../../domains/views/templates";
import type { ReportBinding, ReportGrain } from "../../domains/reports/rules";
import type { Panel } from "../../domains/views/resolve";
import { reportLabels } from "../../domains/reports/display";
import { EDITOR_METRICS, editTemplate, editorViews, type EditorChange } from "./editor-model";

const labels: Record<string, string> = {
  day: "\u65e5", week: "\u5468", month: "\u6708", hour: "\u5c0f\u65f6", "15m": "15\u5206\u949f",
  card: "\u6307\u6807\u5361", trend: "\u8d8b\u52bf", table: "\u8868\u683c", ranking: "\u6392\u540d", timeline: "\u72b6\u6001\u65f6\u5e8f",
  second: "\u79d2", minute: "\u5206\u949f", count: "\u6b21 / \u6761", state: "\u72b6\u6001", device_count: "\u8bbe\u5907\u6570", degC: "\u2103",
};
const label = (s: string) => labels[s] ?? s;
function MetricOptions() { return <>{CATEGORIES.map(category => <optgroup key={category} label={reportLabels[category]}>{EDITOR_METRICS.filter(m => m.category === category).map(m => <option key={refKey(m)} value={refKey(m)}>{reportLabels[m.code] ?? m.code} @{m.version}</option>)}</optgroup>)}</>; }
export default function TemplateEditor({ candidate, disabled, onChange }: { candidate: TemplateCandidate; disabled: boolean; onChange(c: TemplateCandidate): void }) {
  const [addKey, setAddKey] = useState(refKey(EDITOR_METRICS[0]!));
  function change(c: EditorChange) { if (!disabled) onChange(editTemplate(candidate, c)); }
  const panels = candidate.definition.panels;
  return <fieldset className="flex min-w-0 flex-col gap-lg" disabled={disabled}><legend className="sr-only">{"\u53ef\u89c6\u5316\u7f16\u8f91"}</legend>
    <div className="grid min-w-0 gap-md sm:grid-cols-2"><label className="flex min-w-0 flex-col gap-xs text-body">{"\u6a21\u677f\u6807\u9898"}<Input className="h-control-xl text-body" maxLength={200} value={candidate.definition.title} onChange={e => change({ type: "title", value: e.target.value })} /></label>
      {candidate.kind === "report" && <label className="flex min-w-0 flex-col gap-xs text-body">{"\u62a5\u544a\u5468\u671f"}<NativeSelect className="h-control-xl text-body" value={candidate.definition.grain} onChange={e => change({ type: "report-grain", value: e.target.value as ReportGrain })}>{["day", "week", "month"].map(g => <option key={g} value={g}>{label(g)}</option>)}</NativeSelect></label>}</div>
    <p className="text-body-small text-muted-foreground">{"\u66f4\u6362\u6307\u6807\u4f1a\u6e05\u9664\u539f\u5bf9\u8c61\u7ed1\u5b9a\u3002\u9690\u85cf\u9762\u677f\u4ecd\u9700\u6821\u9a8c\u5b8c\u6574\u6743\u9650\u3002"}</p>
    {panels.map((p, index) => {
      const m = EDITOR_METRICS.find(m => refKey(m) === refKey(p.metricRef))!, binding = candidate.definition.bindings.find(b => b.panelId === p.id)!;
      const patch = (value: Partial<Panel>) => change({ type: "panel", id: p.id, patch: value });
      const bind = (value: ReportBinding) => change({ type: "binding", binding: value });
      return <article className="flex min-w-0 flex-col gap-md border-b border-dashed border-border pb-lg" key={p.id} aria-label={"\u9762\u677f " + p.id}>
        <header className="flex min-w-0 flex-wrap items-center gap-xs"><b className="text-body font-medium">{index + 1}. {reportLabels[m.code] ?? m.code}</b><span className="break-all text-body-small text-muted-foreground">{p.id}</span><div className="ml-auto flex shrink-0 items-center gap-xs">
          <Button className="size-control-xl shrink-0" variant="outline" size="icon-xl" type="button" aria-label={"\u4e0a\u79fb " + p.id} disabled={index === 0} onClick={() => change({ type: "move", id: p.id, direction: -1 })}><Icon name="arrow-up" size="sm"/></Button>
          <Button className="size-control-xl shrink-0" variant="outline" size="icon-xl" type="button" aria-label={"\u4e0b\u79fb " + p.id} disabled={index === panels.length - 1} onClick={() => change({ type: "move", id: p.id, direction: 1 })}><Icon name="arrow-down" size="sm"/></Button>
          <Button className="h-control-xl text-body" variant="outline" type="button" disabled={panels.length === 1} onClick={() => change({ type: "remove", id: p.id })}>{"\u79fb\u9664"}</Button></div></header>
        <label className="flex min-w-0 flex-col gap-xs text-body">{"\u6307\u6807"}<NativeSelect className="h-control-xl text-body" value={refKey(p.metricRef)} onChange={e => change({ type: "metric", id: p.id, ref: EDITOR_METRICS.find(m => refKey(m) === e.target.value)! })}><MetricOptions /></NativeSelect></label>
        <div className="grid min-w-0 grid-cols-2 gap-md lg:grid-cols-4">
          <label className="flex min-w-0 flex-col gap-xs text-body">{"\u663e\u793a\u65b9\u5f0f"}<NativeSelect className="h-control-xl text-body" value={p.view} onChange={e => patch({ view: e.target.value as Panel["view"] })}>{editorViews(p).map(v => <option key={v} value={v}>{label(v)}</option>)}</NativeSelect></label>
          <label className="flex min-w-0 flex-col gap-xs text-body">{"\u5355\u4f4d"}<NativeSelect className="h-control-xl text-body" value={p.displayUnit} onChange={e => patch({ displayUnit: e.target.value })}>{m.displayUnits.map(u => <option key={u} value={u}>{label(u)}</option>)}</NativeSelect></label>
          <label className="flex min-w-0 flex-col gap-xs text-body">{"\u7c92\u5ea6"}<NativeSelect className="h-control-xl text-body" disabled={candidate.kind === "report"} value={p.grain} onChange={e => patch({ grain: e.target.value as Panel["grain"] })}>{m.grains.map(g => <option key={g} value={g}>{label(g)}</option>)}</NativeSelect></label>
          <label className="flex min-w-0 flex-col gap-xs text-body">{"\u5c0f\u6570\u4f4d"}<NativeSelect className="h-control-xl text-body" value={p.precision} onChange={e => patch({ precision: Number(e.target.value) })}>{Array.from({ length: 10 }, (_, i) => <option key={i} value={i}>{i}</option>)}</NativeSelect></label>
        </div>
        <label className="flex items-center gap-xs text-body"><Checkbox checked={p.visible} onCheckedChange={value=>patch({visible:value===true})} />{"\u663e\u793a\u9762\u677f"}</label>
        <div className="grid min-w-0 gap-md sm:grid-cols-2"><label className="flex min-w-0 flex-col gap-xs text-body">{"\u5bf9\u8c61\u7ed1\u5b9a"}<NativeSelect className="h-control-xl text-body" value={binding.kind} onChange={e => {
          const kind = e.target.value; bind(kind === "aggregate" ? { panelId: p.id, kind, sourceId: "", mappingId: "" } : kind === "rollup" ? { panelId: p.id, kind, rollupId: "" } : { panelId: p.id, kind: "not_connected" });
        }}><option value="not_connected">{"\u672a\u63a5\u5165"}</option><option value="aggregate">{"\u5355\u5bf9\u8c61\u805a\u5408"}</option><option value="rollup">{"\u53d7\u5ba1\u533a\u57df\u6c47\u603b"}</option></NativeSelect></label>
          {binding.kind === "aggregate" && <><label className="flex min-w-0 flex-col gap-xs text-body">{"\u6765\u6e90 ID"}<Input className="h-control-xl text-body" maxLength={200} value={binding.sourceId} onChange={e => bind({ ...binding, sourceId: e.target.value })} /></label><label className="flex min-w-0 flex-col gap-xs text-body">{"\u6620\u5c04 ID"}<Input className="h-control-xl text-body" maxLength={200} value={binding.mappingId} onChange={e => bind({ ...binding, mappingId: e.target.value })} /></label></>}
          {binding.kind === "rollup" && <label className="flex min-w-0 flex-col gap-xs text-body">{"\u6c47\u603b\u914d\u7f6e ID"}<Input className="h-control-xl text-body" maxLength={200} value={binding.rollupId} onChange={e => bind({ ...binding, rollupId: e.target.value })} /></label>}</div>
      </article>;
    })}
    <div className="flex min-w-0 flex-wrap items-end gap-xs"><label className="flex min-w-0 flex-col gap-xs text-body">{"\u65b0\u9762\u677f\u6307\u6807"}<NativeSelect className="h-control-xl text-body" value={addKey} onChange={e => setAddKey(e.target.value)}><MetricOptions /></NativeSelect></label>
      <Button className="h-control-xl text-body" variant="outline" type="button" disabled={panels.length >= 16} onClick={() => change({ type: "add", ref: EDITOR_METRICS.find(m => refKey(m) === addKey)! })}>{"\u6dfb\u52a0\u9762\u677f"} ({panels.length}/16)</Button></div>
  </fieldset>;
}
