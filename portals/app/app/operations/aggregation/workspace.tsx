"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { JobStateFilter, JobListPage, JobDetail, RecoverJob, RecoveryResult, RecoveryRecord } from "../../domains/supervision/jobs";
import { reportJson, ReportClientError } from "../../reports/client";
import { reportTime } from "../../domains/reports/display";
import { jobLabel, jobError } from "./client";

function RecoveryLink({ record, onChoose, parent = false }: { record: RecoveryRecord; onChoose(id: string): void; parent?: boolean }) {
  return <article className="jobs-link"><strong>{parent ? "\u6062\u590d\u81ea" : "\u5df2\u590d\u6838\u91cd\u6392"}</strong>
    <button onClick={() => onChoose(parent ? record.originalJobId : record.replacementJobId)}>{parent ? record.originalJobId : record.replacementJobId}</button>
    <span>{record.requestedBy}{" \u00b7 "}{reportTime(record.recordedAt)}</span><small>{record.reasonRef}</small></article>;
}
function JobInspection({ jobId, epoch, onChoose, onChanged }: { jobId: string; epoch: number; onChoose(id: string): void; onChanged(): void }) {
  const [detail, setDetail] = useState<JobDetail | null>(null), [error, setError] = useState(""), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [reason, setReason] = useState(""), [pending, setPending] = useState<RecoverJob | null>(null), [completed, setCompleted] = useState<RecoveryRecord | null>(null);
  const inFlight = useRef(false), controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    const c = new AbortController(); setLoading(true); setDetail(null); setError("");
    reportJson<JobDetail>("/api/aggregate-jobs/" + encodeURIComponent(jobId), c.signal).then(r => { if (!c.signal.aborted) setDetail(r); })
      .catch(e => { if (!c.signal.aborted) setError(jobError(e)); }).finally(() => { if (!c.signal.aborted) setLoading(false); });
    return () => c.abort();
  }, [jobId, epoch]);
  async function execute(command: RecoverJob) {
    if (inFlight.current) return; inFlight.current = true; setBusy(true); setError(""); setPending(command);
    const c = new AbortController(); controller.current = c;
    try {
      const result = await reportJson<RecoveryResult>("/api/aggregate-jobs/" + encodeURIComponent(jobId) + "/recover", c.signal, command);
      if (!c.signal.aborted) { setPending(null); setCompleted(result.record); onChanged(); }
    } catch (e) {
      if (!c.signal.aborted) {
        setError(jobError(e));
        // Unknown transport/server results keep the identical command. A
        // definite rejection requires a fresh read before any new review.
        if (e instanceof ReportClientError && e.status < 500) { setPending(null); setDetail(null); }
      }
    } finally { inFlight.current = false; if (!c.signal.aborted) setBusy(false); }
  }
  function recover(event: FormEvent) { event.preventDefault(); if (!detail || !reason.trim() || pending) return;
    void execute({ jobId, expectedAttempt: detail.job.attempt, commandId: crypto.randomUUID(), reasonRef: reason.trim() }); }
  return <section className="jobs-detail" aria-label={"\u4efb\u52a1\u8be6\u60c5"}>
    <div className="reports-row"><h2>{"\u4efb\u52a1\u8be6\u60c5"}</h2><button onClick={onChanged} disabled={busy}>{"\u5237\u65b0\u6838\u5bf9"}</button></div>
    {error && <p role="alert" className="reports-error">{error}</p>}
    {pending && <div className="reports-notice"><p>{"\u5df2\u4fdd\u7559\u539f\u547d\u4ee4\uff0c\u91cd\u8bd5\u4e0d\u4f1a\u91cd\u590d\u521b\u5efa\u4efb\u52a1\u3002"}</p><button onClick={() => void execute(pending)} disabled={busy}>{busy ? "\u5904\u7406\u4e2d\u2026" : "\u4f7f\u7528\u539f\u547d\u4ee4\u91cd\u8bd5"}</button></div>}
    {completed && !detail?.recovery && <RecoveryLink record={completed} onChoose={onChoose} />}
    {loading ? <p role="status">{"\u6b63\u5728\u6838\u9a8c\u4efb\u52a1\u2026"}</p> : detail && <>
      <span className="reports-eyebrow">{jobLabel(detail.job.target.grain)}{"\u805a\u5408 \u00b7 "}{jobLabel(detail.job.status)}</span>
      <h3 className="jobs-title">{jobLabel(detail.job.target.metric.code)}</h3><p className="jobs-id">{detail.job.id}</p>
      <div className="jobs-facts"><article><small>{"\u5f53\u524d\u72b6\u6001"}</small><strong>{jobLabel(detail.job.readiness)}</strong></article><article><small>{"\u5df2\u9886\u53d6 / \u4e0a\u9650"}</small><strong>{detail.job.attempt}{" / "}{detail.job.maxAttempts}</strong></article>
        <article><small>{"\u53ef\u6267\u884c\u65f6\u95f4"}</small><span>{reportTime(detail.job.availableAt)}</span></article></div>
      <dl className="jobs-metadata"><div><dt>{"\u6765\u6e90"}</dt><dd>{detail.job.target.sourceId}</dd></div><div><dt>{"\u6620\u5c04"}</dt><dd>{detail.job.target.mappingId}</dd></div><div><dt>{"\u5468\u671f\u8d77\u70b9"}</dt><dd>{reportTime(detail.job.target.at)}</dd></div><div><dt>{"\u521b\u5efa\u65f6\u95f4"}</dt><dd>{reportTime(detail.job.createdAt)}</dd></div>
        {detail.job.leaseUntil && <div><dt>{"\u79df\u7ea6\u5230\u671f"}</dt><dd>{reportTime(detail.job.leaseUntil)}</dd></div>}</dl>
      <h3>{"\u6267\u884c\u8bb0\u5f55"}</h3>{!detail.attempts.length ? <p className="reports-muted">{"\u5c1a\u672a\u9886\u53d6\u6267\u884c\u3002"}</p> : <ol className="jobs-attempts">{detail.attempts.map(a => <li key={a.attempt}>
        <b>{String(a.attempt).padStart(2, "0")}</b><div><strong>{jobLabel(a.outcome)}</strong><span>{a.failureCode ? jobLabel(a.failureCode) : "\u7ed3\u679c\u5df2\u4fdd\u5b58"}</span><small>{reportTime(a.recordedAt)}</small>
          {a.resultRef && <details><summary>{"\u7ed3\u679c\u5f15\u7528"}</summary><code>{a.resultRef}</code></details>}</div></li>)}</ol>}
      {detail.recoveredFrom && <RecoveryLink record={detail.recoveredFrom} onChoose={onChoose} parent />}
      {detail.recovery ? <RecoveryLink record={detail.recovery} onChoose={onChoose} /> : detail.job.status === "dead" && !completed && <form className="jobs-review" onSubmit={recover}>
        <h3>{"\u590d\u6838\u540e\u91cd\u6392"}</h3><p>{"\u786e\u8ba4\u6765\u6e90\u6216\u914d\u7f6e\u5df2\u4fee\u590d\uff0c\u586b\u5199\u590d\u6838\u4f9d\u636e\u3002\u539f\u4efb\u52a1\u4e0e\u8bb0\u5f55\u4fdd\u7559\uff0c\u7cfb\u7edf\u5c06\u53e6\u5efa\u5173\u8054\u4efb\u52a1\u3002"}</p>
        <label>{"\u590d\u6838\u4f9d\u636e"}<input required maxLength={2048} value={reason} disabled={busy || !!pending} onChange={e => setReason(e.target.value)} placeholder={"\u5de5\u5355\u53f7\u6216\u590d\u6838\u8bb0\u5f55\u5f15\u7528"} /></label>
        <button type="submit" disabled={busy || !!pending || !reason.trim()}>{busy ? "\u6b63\u5728\u63d0\u4ea4\u2026" : "\u63d0\u4ea4\u590d\u6838\u5e76\u91cd\u6392"}</button></form>}
    </>}
  </section>;
}
export default function AggregateJobsWorkspace() {
  const [status, setStatus] = useState<JobStateFilter>("all"), [cursor, setCursor] = useState<string | null>(null), [pages, setPages] = useState<(string | null)[]>([]);
  const [page, setPage] = useState<JobListPage | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [selected, setSelected] = useState<string | null>(null), [epoch, setEpoch] = useState(0);
  useEffect(() => {
    const c = new AbortController(); setPage(null); setLoading(true); setError("");
    reportJson<JobListPage>("/api/aggregate-jobs?limit=20&status=" + status + (cursor ? "&after=" + encodeURIComponent(cursor) : ""), c.signal)
      .then(p => { if (!c.signal.aborted) setPage(p); }).catch(e => { if (!c.signal.aborted) setError(jobError(e)); }).finally(() => { if (!c.signal.aborted) setLoading(false); });
    return () => c.abort();
  }, [status, cursor, epoch]);
  function refresh() { setCursor(null); setPages([]); setEpoch(n => n + 1); }
  return <div className="jobs-workspace"><aside className="jobs-library" aria-label={"\u805a\u5408\u4efb\u52a1\u5217\u8868"}>
    <div className="reports-row"><h1>{"\u805a\u5408\u4efb\u52a1"}</h1><button onClick={refresh} disabled={loading}>{"\u5237\u65b0"}</button></div>
    <div className="jobs-filters" aria-label={"\u4efb\u52a1\u72b6\u6001"}>{(["all", "pending", "leased", "dead", "succeeded"] as const).map(s => <button key={s} aria-pressed={status === s} onClick={() => { setStatus(s); setCursor(null); setPages([]); setSelected(null); }}>{jobLabel(s)}</button>)}</div>
    <p className="reports-muted">{"\u5f53\u524d\u6388\u6743\u8303\u56f4\uff0c\u6309\u521b\u5efa\u65f6\u95f4\u5012\u5e8f\u3002"}</p>
    {error && <p className="reports-error" role="alert">{error}</p>}{loading ? <p role="status">{"\u6b63\u5728\u8bfb\u53d6\u4efb\u52a1\u2026"}</p> : page && !page.items.length ? <p className="reports-muted">{"\u5f53\u524d\u8303\u56f4\u6682\u65e0\u6b64\u7c7b\u4efb\u52a1\u3002"}</p> : null}
    <div className="jobs-list">{page?.items.map(j => <button key={j.id} aria-pressed={selected === j.id} className={selected === j.id ? "selected" : ""} onClick={() => setSelected(j.id)}>
      <span className="reports-row"><strong>{jobLabel(j.target.metric.code)}</strong><i data-state={j.status}>{jobLabel(j.status)}</i></span><span>{j.target.sourceId}{" \u00b7 "}{jobLabel(j.target.grain)}{"\u805a\u5408"}</span>
      <small>{reportTime(j.target.at)}{" \u00b7 "}{j.attempt}{"/"}{j.maxAttempts}</small><code>{j.id}</code></button>)}</div>
    <nav className="reports-row" aria-label={"\u4efb\u52a1\u5206\u9875"}><button disabled={loading || !pages.length} onClick={() => { setCursor(pages.at(-1)!); setPages(p => p.slice(0, -1)); }}>{"\u4e0a\u4e00\u9875"}</button><small>{pages.length + 1}</small>
      <button disabled={loading || !page?.next} onClick={() => { setPages(p => [...p, cursor]); setCursor(page!.next); }}>{"\u4e0b\u4e00\u9875"}</button></nav>
  </aside>{selected ? <JobInspection key={selected} jobId={selected} epoch={epoch} onChoose={setSelected} onChanged={refresh} />
    : <section className="reports-empty"><span className="reports-eyebrow">OPERATIONS</span><h2>{"\u8ba9\u6bcf\u6b21\u5904\u7f6e\u6709\u636e\u53ef\u67e5"}</h2><p>{"\u9009\u62e9\u4efb\u52a1\uff0c\u67e5\u770b\u6267\u884c\u5386\u53f2\u3001\u5931\u8d25\u539f\u56e0\u548c\u590d\u6838\u8bb0\u5f55\u3002"}</p></section>}</div>;
}
