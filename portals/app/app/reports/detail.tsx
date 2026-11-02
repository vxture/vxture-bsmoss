"use client";
import { useEffect, useRef, useState } from "react";
import type { StoredReport } from "../domains/reports/store";
import type { PublicationCommand, PublicationState } from "../domains/reports/publication";
import type { ExportJob, ExportRequest } from "../domains/reports/exports";
import { reportLabels, reportTime, reportValueText } from "../domains/reports/display";
import { reportErrorText, reportJson, reportStatus } from "./client";

type ReadReport = StoredReport & { freshness: "current" | "stale"; reasons: string[] };
type Pending = { kind: "publication"; command: PublicationCommand } | { kind: "export"; command: ExportRequest };
type JobState = { job: ExportJob; downloadable: boolean; blockingReason: string | null };
export default function ReportDetail({ reportId, initialRevision, onChanged }: { reportId: string; initialRevision: string; onChanged(): void }) {
  const [report, setReport] = useState<ReadReport | null>(null), [publication, setPublication] = useState<PublicationState | null | undefined>(undefined);
  const [error, setError] = useState(""), [publicationError, setPublicationError] = useState(""), [message, setMessage] = useState("");
  const [revision, setRevision] = useState(initialRevision), [revisionInput, setRevisionInput] = useState(initialRevision), [epoch, setEpoch] = useState(0);
  const [reason, setReason] = useState(""), [busy, setBusy] = useState(false), [pending, setPending] = useState<Pending | null>(null);
  const [jobId, setJobId] = useState<string | null>(null), [job, setJob] = useState<JobState | null>(null), [jobError, setJobError] = useState(""), [pollEpoch, setPollEpoch] = useState(0);
  const commandController = useRef<AbortController | null>(null), inFlight = useRef(false);
  useEffect(() => () => commandController.current?.abort(), []);
  useEffect(() => {
    const c = new AbortController(); setReport(null); setPublication(undefined); setError(""); setPublicationError("");
    const base = "/api/reports/" + encodeURIComponent(reportId);
    reportJson<ReadReport>(base + (revision ? "?revision=" + encodeURIComponent(revision) : ""), c.signal)
      .then(r => { if (!c.signal.aborted) setReport(r); }).catch(e => { if (!c.signal.aborted) setError(reportErrorText(e)); });
    reportJson<PublicationState | null>(base + "/publication", c.signal).then(p => { if (!c.signal.aborted) setPublication(p); })
      .catch(e => { if (!c.signal.aborted) setPublicationError(reportErrorText(e)); });
    return () => c.abort();
  }, [reportId, revision, epoch]);
  useEffect(() => {
    if (!jobId) return;
    const c = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined, attempts = 0;
    setJob(null); setJobError("");
    async function poll() {
      try {
        const state = await reportJson<JobState>("/api/report-exports/" + encodeURIComponent(jobId!), c.signal);
        if (c.signal.aborted) return; setJob(state); attempts++;
        if (state.job.status === "pending" && attempts < 60) timer = setTimeout(poll, 5000);
        else if (state.job.status === "pending") setJobError("\u4ecd\u5728\u7b49\u5f85\u5904\u7406\uff0c\u53ef\u7a0d\u540e\u624b\u52a8\u5237\u65b0\u3002");
      } catch (e) { if (!c.signal.aborted) { setJob(null); setJobError(reportErrorText(e)); } }
    }
    void poll(); return () => { c.abort(); clearTimeout(timer); };
  }, [jobId, pollEpoch]);
  function refresh() { setPending(null); setMessage(""); setEpoch(e => e + 1); setPollEpoch(e => e + 1); }
  async function execute(next: Pending) {
    if (inFlight.current) return; inFlight.current = true;
    const c = new AbortController(); commandController.current = c; setBusy(true); setPending(next); setError(""); setMessage("");
    try {
      if (next.kind === "publication") {
        await reportJson("/api/reports/" + encodeURIComponent(reportId) + "/publication", c.signal, next.command);
        if (!c.signal.aborted) setMessage("\u547d\u4ee4\u5df2\u8bb0\u5f55\uff0c\u6b63\u5728\u6838\u9a8c\u6700\u65b0\u72b6\u6001\u3002");
      } else {
        const result = await reportJson<{ job: ExportJob }>("/api/report-exports", c.signal, next.command);
        if (!c.signal.aborted) { setJobId(result.job.jobId); setPollEpoch(e => e + 1); setMessage("\u5bfc\u51fa\u4efb\u52a1\u5df2\u63d0\u4ea4\u3002"); }
      }
      if (!c.signal.aborted) { setPending(null); setEpoch(e => e + 1); onChanged(); }
    } catch (e) { if (!c.signal.aborted) { setError(reportErrorText(e)); setPublication(undefined); } }
    finally { inFlight.current = false; if (!c.signal.aborted) setBusy(false); }
  }
  function publish(action: "published" | "withdrawn") {
    if (!report || publication === undefined || !reason.trim()) return;
    const target = action === "withdrawn" && publication?.isActive ? publication.report : report;
    void execute({ kind: "publication", command: { reportId, reportRevision: target.revision, manifestSha256: target.manifestSha256,
      expectedEventRevision: publication?.currentEventRevision ?? null, action, reasonRef: reason.trim(), commandId: crypto.randomUUID() } });
  }
  const canPublish = report && publication !== undefined && report.revision === report.currentRevision && report.freshness === "current" && report.manifest.dataCompleteness === "complete" &&
    !(publication?.isActive && publication.event.reportRevision === report.revision);
  return <section className="reports-detail" aria-label={"\u62a5\u544a\u8be6\u60c5"}>
    <div className="reports-row reports-detail-toolbar"><form onSubmit={e => { e.preventDefault(); setPending(null); setRevision(revisionInput); setEpoch(n => n + 1); }}>
      <label>{"\u751f\u6210\u4fee\u8ba2"}<input aria-label={"\u751f\u6210\u4fee\u8ba2"} required pattern="[1-9][0-9]{0,29}" value={revisionInput} onChange={e => setRevisionInput(e.target.value)} disabled={busy} /></label>
      <button disabled={busy}>{"\u56de\u770b"}</button></form><button onClick={() => { setRevision(""); refresh(); }} disabled={busy}>{"\u67e5\u770b\u6700\u65b0"}</button><button onClick={refresh} disabled={busy}>{"\u5237\u65b0\u6838\u5bf9"}</button></div>
    {error && <p role="alert" className="reports-error">{error}</p>}{message && <p role="status" className="reports-notice">{message}</p>}
    {pending && <button disabled={busy} onClick={() => void execute(pending)}>{busy ? "\u5904\u7406\u4e2d\u2026" : "\u91cd\u8bd5\u540c\u4e00\u547d\u4ee4"}</button>}
    {!report ? !error && <p role="status">{"\u6b63\u5728\u6838\u9a8c\u62a5\u544a\u2026"}</p> : <>
      <span className="reports-eyebrow">{reportStatus(report.manifest.grain)}{" \u00b7 r" + report.revision}</span><h2>{report.manifest.template.definition.title}</h2>
      <p className="reports-muted">{reportTime(report.manifest.period.start)}{" \u2014 "}{reportTime(report.manifest.period.end)}</p>
      <div className="reports-facts"><div><small>{"\u5feb\u7167\u5b8c\u6574\u6027"}</small><strong>{reportStatus(report.manifest.dataCompleteness)}</strong></div>
        <div className={report.freshness === "stale" ? "reports-warning" : ""}><small>{"\u5f53\u524d\u65b0\u9c9c\u5ea6"}</small><strong>{reportStatus(report.freshness)}</strong></div>
        <div><small>{"\u5f53\u524d\u751f\u6210\u4fee\u8ba2"}</small><strong>{"r" + report.currentRevision}</strong></div>
        <div><small>{"\u6570\u636e\u6c34\u4f4d"}</small><span>{reportTime(report.manifest.watermark)}</span></div></div>
      {report.reasons.length > 0 && <details className="reports-notice"><summary>{"\u67e5\u770b\u5931\u6548\u4f9d\u636e"}</summary><ul>{report.reasons.map(r => <li key={r}>{r}</li>)}</ul></details>}
      <div className="reports-publication"><div><h3>{"\u53d1\u5e03\u4e0e\u5bfc\u51fa"}</h3>
        {publication === undefined ? <p className="reports-muted">{publicationError || "\u53d1\u5e03\u72b6\u6001\u5f85\u6838\u9a8c"}</p> : publication === null ? <p>{"\u6682\u65e0\u53d1\u5e03\u4e8b\u4ef6"}</p> : <p>
          {publication.isActive ? "\u5f53\u524d\u53d1\u5e03" : "\u5df2\u64a4\u56de"}{" r" + publication.event.reportRevision + " \u00b7 \u4e8b\u4ef6 " + publication.currentEventRevision}
          {" \u00b7 " + reportStatus(publication.report.freshness)}</p>}</div>
        <label>{"\u64cd\u4f5c\u4f9d\u636e\u7f16\u53f7"}<input maxLength={200} value={reason} disabled={busy || !!pending} onChange={e => setReason(e.target.value)} placeholder={"\u8bf7\u586b\u5199\u5ba1\u9605\u6216\u5de5\u5355\u7f16\u53f7"} /></label>
        <div className="reports-actions"><button disabled={busy || !!pending || !canPublish || !reason.trim()} onClick={() => publish("published")}>{"\u53d1\u5e03\u6b64\u4fee\u8ba2"}</button>
          <button disabled={busy || !!pending || !publication?.isActive || !reason.trim()} onClick={() => publish("withdrawn")}>{"\u64a4\u56de\u5f53\u524d\u53d1\u5e03"}</button>
          <button disabled={busy || !!pending || !publication?.isActive || publication.report.freshness !== "current" || publication.report.manifest.dataCompleteness !== "complete"}
            onClick={() => publication && void execute({ kind: "export", command: { reportId, publicationRevision: publication.currentEventRevision, commandId: crypto.randomUUID() } })}>{"\u5bfc\u51fa\u5f53\u524d\u53d1\u5e03"}</button></div>
        <small className="reports-muted">{"\u751f\u6210\u3001\u53d1\u5e03\u4e0e\u5bfc\u51fa\u5206\u522b\u9a8c\u6743\u3002\u64a4\u56de\u548c\u5bfc\u51fa\u4ee5\u4e0a\u65b9\u5f53\u524d\u53d1\u5e03\u4fee\u8ba2\u4e3a\u5bf9\u8c61\u3002"}</small>
      </div>
      {report.manifest.sections.map(section => <section key={section.category} className="reports-section"><h3>{reportLabels[section.category]}</h3>
        {section.status === "not_configured" && <p className="reports-muted">{"\u672a\u914d\u7f6e"}</p>}
        <div className="reports-metrics">{report.manifest.items.filter(i => i.panel.category === section.category).map(item => <article key={item.panel.id}>
          <details open={item.panel.visible}><summary><span>{reportLabels[item.panel.metricRef.code] ?? item.panel.metricRef.code}</span><span className="reports-badge">{reportStatus(item.status)}</span></summary>
            <p className="reports-value">{reportValueText(item.data, item.panel.displayUnit, item.panel.precision)}</p>
            {item.dailyDependencies.length > 0 && <details><summary>{"\u9010\u65e5\u4f9d\u636e \u00b7 " + item.dailyDependencies.length}</summary><div className="reports-daily">{item.dailyDependencies.map((day, i) => <p key={i}><span>{day.data.kind === "not_connected" ? "" : reportTime(day.data.query.at).slice(0, 10)}</span><span>{reportStatus(day.status)}</span><span>{reportValueText(day.data, item.panel.displayUnit, item.panel.precision)}</span></p>)}</div></details>}
            <details><summary>{"\u8ba1\u91cf\u4f9d\u636e\u4e0e\u7cbe\u786e\u503c"}</summary><pre>{JSON.stringify({ binding: item.binding, data: item.data, dailyDependencies: item.dailyDependencies }, null, 2)}</pre></details>
          </details></article>)}</div></section>)}
      <details className="reports-evidence"><summary>{"\u62a5\u544a\u8ffd\u6eaf"}</summary><dl><dt>{"\u62a5\u544a"}</dt><dd>{report.reportId}</dd><dt>{"\u6a21\u677f"}</dt><dd>{report.manifest.template.code + " @ " + report.manifest.template.version}</dd><dt>{"\u751f\u6210\u65f6\u95f4"}</dt><dd>{reportTime(report.generatedAt)}</dd><dt>SHA256</dt><dd>{report.manifestSha256}</dd></dl></details>
    </>}
    {jobId && <div className="reports-export"><div className="reports-row"><h3>{"\u5bfc\u51fa\u4efb\u52a1"}</h3><button disabled={busy} onClick={() => setPollEpoch(e => e + 1)}>{"\u5237\u65b0\u4efb\u52a1"}</button></div>
      <p className="reports-muted">{jobId}</p>{jobError && <p role="alert">{jobError}</p>}{job && <><p>{reportStatus(job.job.status)}{" \u00b7 \u5c1d\u8bd5 " + job.job.attempt + " \u00b7 \u53d1\u5e03\u4e8b\u4ef6 " + job.job.publicationRevision}</p>
        {job.downloadable ? <a href={"/api/report-exports/" + encodeURIComponent(jobId) + "?format=html"}>{"\u4e0b\u8f7d HTML \u62a5\u544a"}</a> : <p className="reports-muted">{job.blockingReason ? reportStatus(job.blockingReason) : "\u6587\u4ef6\u5c1a\u672a\u53ef\u4e0b\u8f7d"}</p>}</>}
      <small className="reports-muted">{"\u4e0b\u8f7d\u65f6\u4f1a\u91cd\u65b0\u6838\u9a8c\u6743\u9650\u3001\u53d1\u5e03\u548c\u6570\u636e\u72b6\u6001\u3002"}</small></div>}
  </section>;
}
