"use client";
import ResetButton from "../portal/reset-button";
import { Button, Checkbox, DataTable, Dialog, DialogContent, DialogDescription, DialogTitle, EmptyState, Icon, Input, NativeSelect, PanelCard, Progress, ShellPageContainer, StatusBadge } from "@vxture/design-system";
import PageHeading from "../portal/page-heading";
import {businessAnalysisIcon} from "../portal/business-icons";
import "../site-analysis/site-analysis.css";
import { useEffect, useRef, useState } from "react";
import type { AnalysisWorkspace as Workspace, AnalysisPanel, SaveAnalysisPreference } from "../domains/views/analysis";
import type { Panel, Preference } from "../domains/views/resolve";
import { reportLabels, reportTime, reportValueText, reportDistributionRows } from "../domains/reports/display";
import { reportJson, ReportClientError, reportErrorText, reportStatus } from "../reports/client";
import { seriesPaths } from "./series";
import SectionHeading from '../portal/section-heading';

const categories = ["business_service", "operational_status", "runtime_parameter"] as const;
const grains: Record<string, string> = { "15m": "15\u5206\u949f", hour: "\u5c0f\u65f6", day: "\u65e5", week: "\u5468", month: "\u6708" };
const editable = (p: Panel): Preference => ({ id: p.id, visible: p.visible, order: p.order, displayUnit: p.displayUnit, grain: p.grain, precision: p.precision });
const localTime = (at: string) => new Date(Date.parse(at) + 28800000).toISOString().slice(0, 16);
const stateText = (state: string) => ({ running: "\u8fd0\u884c", offline: "\u79bb\u7ebf", fault: "\u6545\u969c", unknown: "\u672a\u77e5", stopped: "\u505c\u6b62" }[state] ?? state);
function MetricPanel({ item }: { item: AnalysisPanel }) {
  const { panel, points } = item, latest = points.at(-1), paths = seriesPaths(points);
  const publication = latest?.data?.kind === "aggregate" ? latest.data.publication : null;
  const value = publication?.result.value, durations = value?.kind === "state" ? Object.entries(value.durationMilliseconds) : [];
  const total = durations.reduce((sum, [, ms]) => sum + BigInt(ms), 0n);
  const text = latest?.data ? reportValueText(latest.data, panel.displayUnit, panel.precision) : "\u65e0\u53ef\u7528\u503c";
  const distribution = latest?.data ? reportDistributionRows(latest.data, panel.displayUnit, panel.precision) : null;
  const coverage = latest?.data?.kind === "rollup" ? latest.data.result.coverage : null;
  return <PanelCard className="min-w-0" title={reportLabels[panel.metricRef.code] ?? panel.metricRef.code} icon="chart-line-up" description={grains[panel.grain]}>
    <div className="flex min-w-0 flex-col gap-md">
    <p className="break-words text-heading-small tabular-nums text-primary">{distribution ? distribution.title : latest?.status === "not_connected" ? "\u672a\u63a5\u5165" : value?.kind === "state" && panel.displayUnit === "state" ? "\u671f\u672b \u00b7 " + stateText(value.endState) : value?.kind === "gauge" ? text.split("; min ")[0] : text}</p>
    {distribution && <><dl className="flex flex-col gap-sm">{distribution.rows.map(row => <div key={row.label} className="flex items-center justify-between gap-md text-body"><dt className="text-muted-foreground">{row.label}</dt><dd className="tabular-nums">{row.value}</dd></div>)}</dl><p className="text-body-small text-muted-foreground">{"\u603b\u4f53 " + coverage?.expectedAtoms + " \u53f0 \u00b7 \u6709\u6548\u8986\u76d6 " + coverage?.knownMembers + " \u53f0"}</p></>}
    {durations.length > 0 && <dl className="flex flex-col gap-sm">{durations.map(([state, ms])=><div key={state} className="flex flex-col gap-xs"><div className="flex items-center justify-between gap-sm text-body-small"><dt>{stateText(state)}</dt><dd className="tabular-nums">{ms+" ms"}</dd></div><Progress value={total>0n?Number(BigInt(ms)*10000n/total)/100:0} aria-label={stateText(state)}/></div>)}</dl>}
    {latest && <div className="flex flex-wrap items-center gap-xs"><StatusBadge tone={latest.status==="complete"?"neutral":"warning"} size="sm">{reportStatus(latest.status)}</StatusBadge><StatusBadge tone={latest.freshness==="current"?"neutral":"warning"} size="sm">{reportStatus(latest.freshness)}</StatusBadge>{publication && <span className="text-body-small text-muted-foreground">{"r"+publication.revision}</span>}</div>}
    {points.length > 1 && !distribution && <><svg className="h-media-sm w-full text-primary" viewBox="0 0 300 70" role="img" aria-label={"\u5468\u671f\u8d8b\u52bf\uff0c\u7f3a\u6570\u6216\u8fc7\u671f\u5904\u65ad\u5f00"}><path d="M10 60H290" className="stroke-border"/>{paths.map((d, i) => <g key={i}><polyline points={d} fill="none" stroke="currentColor" strokeWidth="2" />{d.split(" ").map(v => { const [cx, cy] = v.split(","); return <circle key={v} cx={cx} cy={cy} r="3" fill="currentColor" />; })}</g>)}</svg></>}
    {latest && <p className="break-words text-body-small text-muted-foreground">{reportTime(latest.period.start)}{" \u81f3 "}{reportTime(latest.period.end)}</p>}
    <details className="border-t border-dashed border-border pt-md text-body-small"><summary className="cursor-pointer text-muted-foreground">{"\u5468\u671f\u660e\u7ec6\u4e0e\u8ba1\u91cf\u4f9d\u636e"}</summary>
      <div className="min-w-0 pt-md"><DataTable rows={[...points]} rowKey={p=>p.period.start} columns={[
        {id:"period",header:"\u5468\u671f\u8d77\u70b9",cell:p=>reportTime(p.period.start)},
        {id:"value",header:"\u503c",cell:p=>p.data?reportValueText(p.data,panel.displayUnit,panel.precision):"\u65e0\u53ef\u7528\u503c"},
        {id:"status",header:"\u5b8c\u6574\u6027 / \u65b0\u9c9c\u5ea6",cell:p=>reportStatus(p.status)+" / "+reportStatus(p.freshness)}
      ]}/></div>
      <details className="pt-md"><summary className="cursor-pointer text-muted-foreground">{"\u7cbe\u786e\u539f\u503c\u3001\u6570\u636e\u6c34\u4f4d\u4e0e\u4fee\u8ba2"}</summary><pre className="max-h-media-xl overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-md text-body-small">{JSON.stringify({ binding: item.binding, metric: panel.metricRef, points }, null, 2)}</pre></details>
    </details></div></PanelCard>;
}
export default function AnalysisWorkspace() {
  const [at, setAt] = useState(() => new Date().toISOString()), [time, setTime] = useState(() => localTime(new Date().toISOString()));
  const [epoch, setEpoch] = useState(0), [data, setData] = useState<Workspace | null>(null), [error, setError] = useState(""), [message, setMessage] = useState("");
  const [editing, setEditing] = useState(false), [draft, setDraft] = useState<Preference[]>([]), [busy, setBusy] = useState(false), [pending, setPending] = useState<SaveAnalysisPreference | null>(null);
  const inFlight = useRef(false), controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    const c = new AbortController(); setData(null); setError(""); setEditing(false);
    reportJson<Workspace>("/api/analysis?at=" + encodeURIComponent(at), c.signal).then(d => { if (!c.signal.aborted) setData(d); })
      .catch(e => { if (!c.signal.aborted) setError(reportErrorText(e)); });
    return () => c.abort();
  }, [at, epoch]);
  function patch(id: string, changes: Partial<Preference>) { setDraft(d => d.map(p => p.id === id ? { ...p, ...changes } : p)); }
  function refresh() { setPending(null); setMessage(""); setEpoch(n => n + 1); }
  async function save(command: SaveAnalysisPreference) {
    if (inFlight.current) return; inFlight.current = true; const c = new AbortController(); controller.current = c;
    setBusy(true); setPending(command); setError(""); setMessage("");
    try {
      const receipt = await reportJson<{ revision: string; currentRevision: string }>("/api/analysis", c.signal, command);
      if (!c.signal.aborted) { setPending(null); setEditing(false); setMessage("\u663e\u793a\u914d\u7f6e\u5df2\u4fdd\u5b58\uff0c\u4fee\u8ba2 " + receipt.revision); setEpoch(n => n + 1); }
    } catch (e) {
      if (!c.signal.aborted) {
        setError(reportErrorText(e));
        if (e instanceof ReportClientError && e.status >= 400 && e.status < 500) { setPending(null); setEditing(false); setData(null); }
      }
    } finally { inFlight.current = false; if (!c.signal.aborted) setBusy(false); }
  }
  function submit(preferences: readonly Preference[]) {
    if (!data?.template) return;
    void save({ commandId: crypto.randomUUID(), templateCode: data.template.code, templateVersion: data.template.version, templateSha256: data.template.sha256, expectedRevision: data.preferenceRevision, preferences });
  }
  const editablePanels = data?.panels ?? [], disabled = busy || !!pending;
  return <ShellPageContainer className="site-analysis-page product-page-inset gap-lg"><PageHeading icon={businessAnalysisIcon} title={"\u7ecf\u8425\u5206\u6790"} description={"\u6307\u6807\u5468\u671f\u8d8b\u52bf\u4e0e\u8ba1\u91cf\u4f9d\u636e"}/>
    <section className="site-analysis-toolbar"><form className="site-analysis-filters site-analysis-action-row" onSubmit={e => { e.preventDefault(); const next = Date.parse(time + ":00+08:00"); if (Number.isFinite(next)) { setMessage(""); setAt(new Date(next).toISOString()); setEpoch(n => n + 1); } }}>
      <div className="site-analysis-control-group"><label className="text-body text-muted-foreground" htmlFor="analysis-time">{"\u5206\u6790\u65f6\u95f4"}</label><Input className="w-auto max-w-full" id="analysis-time" type="datetime-local" min="1992-01-01T00:00" required value={time} disabled={disabled} onChange={e => setTime(e.target.value)}/><Button size="xl" type="submit" disabled={disabled}>{"\u67e5\u8be2"}</Button></div>
      <div className="site-analysis-time-tools"><Button size="xl" variant="outline" type="button" disabled={disabled || !data?.template} onClick={() => { setDraft(editablePanels.map(e => editable(e.panel))); setEditing(true); }}><Icon name="faders" size="sm"/>{"\u4e2a\u4eba\u663e\u793a"}</Button></div></form></section>
    {message && <p role="status" className="text-body-small text-primary">{message}</p>}{error && !editing && <div role="alert" className="flex flex-wrap items-center gap-md text-body-small text-destructive"><span>{error}</span>{!pending&&<Button size="xl" variant="outline" onClick={refresh}>{"\u91cd\u65b0\u8bfb\u53d6"}</Button>}</div>}
    {pending && !busy && !editing && <div className="flex flex-wrap items-center gap-md text-body-small"><p>{"\u4fdd\u5b58\u7ed3\u679c\u5f85\u786e\u8ba4\u3002"}</p><Button size="xl" variant="outline" onClick={() => void save(pending)}>{"\u91cd\u8bd5\u540c\u4e00\u547d\u4ee4"}</Button><Button size="xl" variant="ghost" onClick={refresh}>{"\u91cd\u65b0\u8bfb\u53d6"}</Button></div>}
    {!data ? !error && <p role="status" className="text-body-small text-muted-foreground">{"\u6b63\u5728\u6838\u9a8c\u5468\u671f\u6570\u636e\u2026"}</p> : !data.template ? <EmptyState title={"\u6682\u65e0\u5206\u6790\u914d\u7f6e"} description={"\u7531\u7ba1\u7406\u5458\u914d\u7f6e\u6307\u6807\u4e0e\u6570\u636e\u6765\u6e90\u540e\u5c55\u793a"}/> : <>
      <div className="flex flex-wrap items-center justify-between gap-sm text-body-small text-muted-foreground"><span>{data.template.title}</span><span>{"\u6a21\u677f v" + data.template.version + " \u00b7 \u4e2a\u4eba\u914d\u7f6e " + (data.preferenceRevision ?? "\u9ed8\u8ba4")}</span></div>
      {categories.map(category => { const panels = data.panels.filter(e => e.panel.category === category && e.panel.visible); return <section className="flex min-w-0 flex-col gap-md" key={category}><div className="flex items-center justify-between gap-md"><SectionHeading title={reportLabels[category]}/><span className="text-body-small text-muted-foreground">{panels.length + " \u9879"}</span></div>{panels.length ? <div className="grid min-w-0 gap-lg lg:grid-cols-2 xl:grid-cols-3">{panels.map(item => <MetricPanel key={item.panel.id} item={item} />)}</div> : <EmptyState title={"\u6682\u65e0\u53ef\u5c55\u793a\u6307\u6807"}/>}</section>; })}
    </>}
    <Dialog open={editing&&!!data?.template} onOpenChange={open=>{if(!open&&!disabled)setEditing(false);}}><DialogContent width="sm" className="site-analysis-detail site-analysis-detail-wide"><DialogTitle>{"\u4e2a\u4eba\u663e\u793a"}</DialogTitle><DialogDescription>{"\u6309\u8d26\u53f7\u4fdd\u5b58\uff1b\u6b63\u5f0f\u62a5\u544a\u4ecd\u4f7f\u7528\u53d1\u5e03\u6a21\u677f"}</DialogDescription>
      <form className="flex min-w-0 flex-col gap-md" onSubmit={e => { e.preventDefault(); submit(draft); }}><fieldset disabled={disabled} className="flex min-w-0 flex-col gap-md">{editablePanels.map(item => { const p = draft.find(d => d.id === item.panel.id); if(!p)return null;return <div className="flex min-w-0 flex-col gap-sm border-b border-dashed border-border pb-md" key={p.id}>
        <label className="flex items-center gap-xs text-body"><Checkbox checked={p.visible} onCheckedChange={checked=>patch(p.id,{visible:checked===true})}/>{reportLabels[item.panel.metricRef.code] ?? item.panel.metricRef.code}</label>
        <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <label className="flex min-w-0 flex-col gap-xs text-body-small text-muted-foreground">{"\u987a\u5e8f"}<Input className="h-control-xl text-body" type="number" required min="0" max="999" value={p.order} onChange={e => patch(p.id, { order: e.target.valueAsNumber })}/></label>
        <label className="flex min-w-0 flex-col gap-xs text-body-small text-muted-foreground">{"\u7c92\u5ea6"}<NativeSelect className="h-control-xl text-body" value={p.grain} onChange={e => patch(p.id, { grain: e.target.value as Panel["grain"] })}>{item.options.grains.map(g => <option key={g} value={g}>{grains[g]}</option>)}</NativeSelect></label>
        <label className="flex min-w-0 flex-col gap-xs text-body-small text-muted-foreground">{"\u5355\u4f4d"}<NativeSelect className="h-control-xl text-body" value={p.displayUnit} onChange={e => patch(p.id, { displayUnit: e.target.value })}>{item.options.units.filter(u => item.panel.view !== "timeline" && item.panel.view !== "card" || item.panel.metricRef.code !== "runtime.device.state" || u === "state").map(u => <option key={u}>{u}</option>)}</NativeSelect></label>
        <label className="flex min-w-0 flex-col gap-xs text-body-small text-muted-foreground">{"\u5c0f\u6570\u4f4d"}<Input className="h-control-xl text-body" type="number" required min="0" max="9" value={p.precision} onChange={e => patch(p.id, { precision: e.target.valueAsNumber })}/></label></div></div>; })}</fieldset>
        <div className="site-analysis-table-tools site-analysis-action-row"><Button size="xl" type="submit" disabled={disabled}>{busy ? "\u4fdd\u5b58\u4e2d\u2026" : "\u4fdd\u5b58\u914d\u7f6e"}</Button><ResetButton variant="outline" disabled={disabled} onClick={() => submit([])} label={"\u6062\u590d\u6a21\u677f\u9ed8\u8ba4"}/></div>
        {error && <p role="alert" className="text-body-small text-destructive">{error}</p>}{pending && !busy && <div className="flex flex-wrap gap-sm"><Button size="xl" type="button" onClick={() => void save(pending)}>{"\u91cd\u8bd5\u540c\u4e00\u547d\u4ee4"}</Button><Button size="xl" variant="outline" type="button" onClick={refresh}>{"\u91cd\u65b0\u8bfb\u53d6"}</Button></div>}
      </form></DialogContent></Dialog>
  </ShellPageContainer>;
}
