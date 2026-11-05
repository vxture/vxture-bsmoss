"use client";
import { Button, Input } from "@vxture/design-system";
import PageHeading from "../portal/page-heading";
import { useEffect, useRef, useState } from "react";
import type { AnalysisWorkspace as Workspace, AnalysisPanel, SaveAnalysisPreference } from "../domains/views/analysis";
import type { Panel, Preference } from "../domains/views/resolve";
import { reportLabels, reportTime, reportValueText, reportDistributionRows } from "../domains/reports/display";
import { reportJson, ReportClientError, reportErrorText, reportStatus } from "../reports/client";
import { seriesPaths } from "./series";

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
  return <article className="analysis-card"><div className="analysis-card-title"><h3>{reportLabels[panel.metricRef.code] ?? panel.metricRef.code}</h3><span className="reports-badge">{grains[panel.grain]}</span></div>
    <p className="analysis-value">{distribution ? distribution.title : latest?.status === "not_connected" ? "\u672a\u63a5\u5165" : value?.kind === "state" && panel.displayUnit === "state" ? "\u671f\u672b \u00b7 " + stateText(value.endState) : value?.kind === "gauge" ? text.split("; min ")[0] : text}</p>
    {distribution && <><dl className="analysis-distribution">{distribution.rows.map(row => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl><p className="reports-muted">{"\u603b\u4f53 " + coverage?.expectedAtoms + " \u53f0 \u00b7 \u6709\u6548\u6570\u636e\u8986\u76d6 " + coverage?.knownMembers + " \u53f0"}<br/>{"\u7f3a\u6570\u3001\u672a\u53d1\u5e03\u6216\u8fc7\u671f\u7684\u8bbe\u5907\u8ba1\u5165\u672a\u77e5\u3002"}</p></>}
    {durations.length > 0 && <><div className="analysis-state-bar" role="img" aria-label={"\u5404\u72b6\u6001\u65f6\u957f\u5206\u5e03"}>{durations.map(([state, ms], i) => <span key={state} title={stateText(state) + ": " + ms + " ms"} style={{ width: (total > 0n ? Number(BigInt(ms) * 10000n / total) / 100 : 0) + "%", background: state === "unknown" ? "#c7d1d7" : ["#298d81", "#d2a967", "#6388ae"][i % 3] }} />)}</div><p className="reports-muted">{durations.map(([state, ms]) => stateText(state) + " " + ms + " ms").join(" \u00b7 ")}</p></>}
    {latest && <div className="analysis-status"><span data-state={latest.status}>{reportStatus(latest.status)}</span><span data-state={latest.freshness}>{reportStatus(latest.freshness)}</span>{publication && <span>{"r" + publication.revision}</span>}</div>}
    {points.length > 1 && !distribution && <><svg className="analysis-sparkline" viewBox="0 0 300 70" role="img" aria-label={"\u5468\u671f\u8d8b\u52bf\uff0c\u7f3a\u6570\u6216\u8fc7\u671f\u5904\u65ad\u5f00"}><path d="M10 60H290" stroke="#e1eaed" />{paths.map((d, i) => <g key={i}><polyline points={d} fill="none" stroke="currentColor" strokeWidth="2" />{d.split(" ").map(v => { const [cx, cy] = v.split(","); return <circle key={v} cx={cx} cy={cy} r="3" fill="currentColor" />; })}</g>)}</svg><small className="reports-muted">{reportTime(points[0]!.period.start).slice(0, 16)}{" \u2014 "}{reportTime(latest!.period.start).slice(0, 16)}</small></>}
    {latest && <p className="analysis-period reports-muted">{reportTime(latest.period.start)}{" \u81f3 "}{reportTime(latest.period.end)}</p>}
    <details className="analysis-evidence"><summary>{"\u5468\u671f\u660e\u7ec6\u4e0e\u8ba1\u91cf\u4f9d\u636e"}</summary>
      <div className="analysis-table-wrap"><table><thead><tr><th>{"\u5468\u671f\u8d77\u70b9\uff08\u5317\u4eac\u65f6\u95f4\uff09"}</th><th>{"\u503c"}</th><th>{"\u5b8c\u6574\u6027 / \u65b0\u9c9c\u5ea6"}</th></tr></thead><tbody>{points.map(p => <tr key={p.period.start}><td>{reportTime(p.period.start).slice(0, 16)}</td><td>{p.data ? reportValueText(p.data, panel.displayUnit, panel.precision) : "\u65e0\u53ef\u7528\u503c"}</td><td>{reportStatus(p.status)}{" / "}{reportStatus(p.freshness)}</td></tr>)}</tbody></table></div>
      <details><summary>{"\u7cbe\u786e\u539f\u503c\u3001\u6570\u636e\u6c34\u4f4d\u4e0e\u4fee\u8ba2"}</summary><pre>{JSON.stringify({ binding: item.binding, metric: panel.metricRef, points }, null, 2)}</pre></details>
    </details></article>;
}
export default function AnalysisWorkspace() {
  const [at, setAt] = useState(() => new Date().toISOString()), [time, setTime] = useState(() => localTime(new Date().toISOString()));
  const [epoch, setEpoch] = useState(0), [data, setData] = useState<Workspace | null>(null), [error, setError] = useState(""), [message, setMessage] = useState("");
  const [editing, setEditing] = useState(false), [draft, setDraft] = useState<Preference[]>([]), [busy, setBusy] = useState(false), [pending, setPending] = useState<SaveAnalysisPreference | null>(null);
  const inFlight = useRef(false), controller = useRef<AbortController | null>(null);
  const dialog = useRef<HTMLElement | null>(null);
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
  useEffect(() => {
    if (!editing) return;
    const previous = document.activeElement as HTMLElement | null, overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () => [...(dialog.current?.querySelectorAll<HTMLElement>("button:not(:disabled),input:not(:disabled),select:not(:disabled)") ?? [])];
    focusable()[0]?.focus();
    function key(event: KeyboardEvent) {
      if (event.key === "Escape" && !disabled) { event.preventDefault(); setEditing(false); }
      if (event.key !== "Tab") return;
      const elements = focusable(), first = elements[0], last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener("keydown", key);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", key); previous?.focus(); };
  }, [editing, disabled]);
  return <div className="analysis-workspace product-page-inset"><PageHeading title={"\u5468\u671f\u5206\u6790"} description={"\u6307\u6807\u5468\u671f\u8d8b\u52bf\u4e0e\u8ba1\u91cf\u4f9d\u636e"} toolbar={<form className="analysis-toolbar" onSubmit={e => { e.preventDefault(); const next = Date.parse(time + ":00+08:00"); if (Number.isFinite(next)) { setMessage(""); setAt(new Date(next).toISOString()); setEpoch(n => n + 1); } }}>
      <label className="flex min-w-0 flex-col gap-xs text-body-small text-muted-foreground">{"\u5206\u6790\u65f6\u95f4\uff08\u5317\u4eac\u65f6\u95f4\uff09"}<Input type="datetime-local" min="1992-01-01T00:00" required value={time} disabled={disabled} onChange={e => setTime(e.target.value)} /></label><Button size="md" type="submit" variant="default" disabled={disabled}>{"\u67e5\u8be2"}</Button><Button size="md" variant="outline" type="button" disabled={busy} onClick={refresh}>{"\u5237\u65b0"}</Button>
      <Button size="md" variant="outline" type="button" disabled={disabled || !data?.template} onClick={() => { setDraft(editablePanels.map(e => editable(e.panel))); setEditing(true); }}>{"\u4e2a\u4eba\u663e\u793a"}</Button></form>} />
    {message && <p role="status" className="analysis-message">{message}</p>}{error && <p role="alert" className="reports-error">{error}</p>}
    {pending && !busy && <div className="reports-notice"><p>{"\u4fdd\u5b58\u7ed3\u679c\u5f85\u786e\u8ba4\uff0c\u91cd\u8bd5\u4f1a\u590d\u7528\u539f\u547d\u4ee4\u3002"}</p><button onClick={() => void save(pending)}>{"\u91cd\u8bd5\u540c\u4e00\u547d\u4ee4"}</button></div>}
    {!data ? !error && <p role="status" className="reports-empty">{"\u6b63\u5728\u6838\u9a8c\u5468\u671f\u6570\u636e\u2026"}</p> : !data.template ? <section className="reports-empty"><h2>{"\u6682\u65e0\u5206\u6790\u914d\u7f6e"}</h2><p>{"\u7531\u7ba1\u7406\u4eba\u5458\u914d\u7f6e\u6307\u6807\u4e0e\u6570\u636e\u6765\u6e90\u540e\u5c55\u793a\u3002"}</p></section> : <>
      <div className="analysis-context"><span>{data.template.title}</span><small>{"\u6a21\u677f v" + data.template.version + " \u00b7 \u4e2a\u4eba\u914d\u7f6e " + (data.preferenceRevision ?? "\u9ed8\u8ba4")}</small></div>
      {categories.map(category => { const panels = data.panels.filter(e => e.panel.category === category && e.panel.visible); return <section className="analysis-section" key={category}><div className="analysis-section-heading"><h2>{reportLabels[category]}</h2><span>{panels.length + " \u9879"}</span></div>{panels.length ? <div className="analysis-grid">{panels.map(item => <MetricPanel key={item.panel.id} item={item} />)}</div> : <p className="analysis-empty-category">{"\u6682\u65e0\u53ef\u5c55\u793a\u6307\u6807"}</p>}</section>; })}
    </>}
    {editing && data?.template && <div className="analysis-config-backdrop"><section ref={dialog} className="analysis-config" role="dialog" aria-modal="true" aria-labelledby="analysis-config-title"><div className="analysis-card-title"><h2 id="analysis-config-title">{"\u4e2a\u4eba\u663e\u793a"}</h2><button disabled={disabled} onClick={() => setEditing(false)}>{"\u5173\u95ed"}</button></div><p className="reports-muted">{"\u663e\u793a\u8bbe\u7f6e\u6309\u8d26\u53f7\u4fdd\u5b58\uff0c\u6b63\u5f0f\u62a5\u544a\u4f7f\u7528\u53d1\u5e03\u6a21\u677f\u3002"}</p>
      <form onSubmit={e => { e.preventDefault(); submit(draft); }}><fieldset disabled={disabled}>{editablePanels.map(item => { const p = draft.find(d => d.id === item.panel.id)!; return <div className="analysis-config-row" key={p.id}>
        <label className="analysis-visible"><input type="checkbox" checked={p.visible} onChange={e => patch(p.id, { visible: e.target.checked })} />{reportLabels[item.panel.metricRef.code] ?? item.panel.metricRef.code}</label>
        <label>{"\u987a\u5e8f"}<input type="number" required min="0" max="999" value={p.order} onChange={e => patch(p.id, { order: e.target.valueAsNumber })} /></label>
        <label>{"\u7c92\u5ea6"}<select value={p.grain} onChange={e => patch(p.id, { grain: e.target.value as Panel["grain"] })}>{item.options.grains.map(g => <option key={g} value={g}>{grains[g]}</option>)}</select></label>
        <label>{"\u5355\u4f4d"}<select value={p.displayUnit} onChange={e => patch(p.id, { displayUnit: e.target.value })}>{item.options.units.filter(u => item.panel.view !== "timeline" && item.panel.view !== "card" || item.panel.metricRef.code !== "runtime.device.state" || u === "state").map(u => <option key={u}>{u}</option>)}</select></label>
        <label>{"\u5c0f\u6570\u4f4d"}<input type="number" required min="0" max="9" value={p.precision} onChange={e => patch(p.id, { precision: e.target.valueAsNumber })} /></label></div>; })}</fieldset>
        <div className="analysis-config-actions"><button disabled={disabled}>{busy ? "\u4fdd\u5b58\u4e2d\u2026" : "\u4fdd\u5b58\u914d\u7f6e"}</button><button type="button" disabled={disabled} onClick={() => submit([])}>{"\u6062\u590d\u6a21\u677f\u9ed8\u8ba4"}</button></div>
        {error && <p role="alert" className="reports-error">{error}</p>}{pending && !busy && <div className="analysis-config-actions"><button type="button" onClick={() => void save(pending)}>{"\u91cd\u8bd5\u540c\u4e00\u547d\u4ee4"}</button><button type="button" onClick={refresh}>{"\u5237\u65b0\u6838\u5bf9"}</button></div>}
      </form></section></div>}
  </div>;
}
