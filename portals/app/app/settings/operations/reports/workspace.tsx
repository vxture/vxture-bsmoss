"use client";
import { useEffect, useState } from "react";
import type { ReportJobDetail, ReportJobKind, ReportJobPage, ReportJobState } from "../../../domains/supervision/report-jobs";
import { reportTime } from "../../../domains/reports/display";
import { reportJson } from "../../../reports/client";
import { reportJobLabel as label, reportJobError } from "./client";
import { ReportRecovery } from "./recovery";

function Inspection({ id, kind, epoch, refresh, onChoose }: { id: string; kind: ReportJobKind; epoch: number; refresh(): void; onChoose(id: string): void }) {
  const [detail, setDetail] = useState<ReportJobDetail | null>(null), [error, setError] = useState(""), [loading, setLoading] = useState(true);
  useEffect(() => {
    const c = new AbortController(); setDetail(null); setError(""); setLoading(true);
    reportJson<ReportJobDetail>("/api/report-jobs/" + encodeURIComponent(id) + "?kind=" + kind, c.signal)
      .then(v => { if (!c.signal.aborted) setDetail(v); }).catch(e => { if (!c.signal.aborted) setError(reportJobError(e)); }).finally(() => { if (!c.signal.aborted) setLoading(false); });
    return () => c.abort();
  }, [id, kind, epoch]);
  const job = detail?.job;
  return <section className="jobs-detail" aria-label={"\u62a5\u544a\u4efb\u52a1\u8be6\u60c5"}>
    <div className="reports-row"><h2>{"\u4efb\u52a1\u8be6\u60c5"}</h2><button disabled={loading} onClick={refresh}>{"\u5237\u65b0\u6838\u5bf9"}</button></div>
    {error && <p role="alert" className="reports-error">{error}</p>}{loading && <p role="status">{"\u6b63\u5728\u6838\u9a8c\u4efb\u52a1\u2026"}</p>}
    {job && <><span className="reports-eyebrow">{label(job.kind)}{" \u00b7 "}{label(job.status)}</span>
      <h3 className="jobs-title">{job.registration?.templateCode ?? "\u62a5\u544a\u5bfc\u51fa"}</h3><p className="jobs-id">{job.id}</p>
      <div className="jobs-facts"><article><small>{"\u5f53\u524d\u72b6\u6001"}</small><strong>{label(job.readiness)}</strong></article><article><small>{"\u5c1d\u8bd5 / \u4e0a\u9650"}</small><strong>{job.attempt}{" / "}{job.maxAttempts}</strong></article>
        <article><small>{"\u53ef\u6267\u884c\u65f6\u95f4"}</small><span>{reportTime(job.availableAt)}</span></article></div>
      <dl className="jobs-metadata"><div><dt>{"\u5468\u671f"}</dt><dd>{label(job.grain)}{" \u00b7 "}{reportTime(job.period.start)}{" \u2014 "}{reportTime(job.period.end)}</dd></div>
        <div><dt>{"\u521b\u5efa\u65f6\u95f4"}</dt><dd>{reportTime(job.createdAt)}</dd></div><div><dt>{"\u8bf7\u6c42\u4e3b\u4f53"}</dt><dd>{job.requestedBy}</dd></div><div><dt>{"\u66f4\u65b0\u65f6\u95f4"}</dt><dd>{reportTime(job.updatedAt)}</dd></div>
        {job.registration && <><div><dt>{"\u539f\u767b\u8bb0"}</dt><dd>{job.registration.id}{" \u00b7 r"}{job.registration.revision}</dd></div><div><dt>{"\u5f53\u524d\u767b\u8bb0\u7248\u672c"}</dt><dd>{job.registration.currentRevision ?? "\u4e0d\u53ef\u7528"}</dd></div></>}
        {job.publication && <><div><dt>{"\u7ed1\u5b9a\u53d1\u5e03\u4e8b\u4ef6"}</dt><dd>{"r"}{job.publication.revision}</dd></div><div><dt>{"\u6e32\u67d3\u7248\u672c"}</dt><dd>{job.publication.rendererVersion}</dd></div></>}</dl>
      <h3>{"\u6267\u884c\u8bb0\u5f55"}</h3>{!detail.attempts.length ? <p className="reports-muted">{"\u6682\u65e0\u5df2\u63d0\u4ea4\u7684\u6267\u884c\u8bb0\u5f55\u3002"}</p> : <ol className="jobs-attempts">{detail.attempts.map(a => <li key={a.attempt}><b>{String(a.attempt).padStart(2, "0")}</b><div><strong>{label(a.outcome)}</strong>
        <span>{a.failureCode ? label(a.failureCode) : a.generationStatus ? label(a.generationStatus) : "\u5236\u54c1\u5df2\u4fdd\u5b58"}</span><small>{reportTime(a.recordedAt)}{" \u00b7 "}{a.recordedBy}</small></div></li>)}</ol>}
      {job.result && <article className="jobs-link"><strong>{job.kind === "generation" ? "\u751f\u6210\u7ed3\u679c" : "\u7ed1\u5b9a\u62a5\u544a"}</strong>
        <a href={"/reports?report=" + encodeURIComponent(job.result.reportId) + "&revision=" + encodeURIComponent(job.result.revision)}>{"\u6253\u5f00\u62a5\u544a r"}{job.result.revision}</a>
        <small>{job.result.reportId}</small>{job.result.currentRevision && <span>{"\u6267\u884c\u65f6\u6700\u65b0\u4fee\u8ba2 r"}{job.result.currentRevision}</span>}
        <details><summary>{"\u6458\u8981\u4e0e\u5236\u54c1\u5f15\u7528"}</summary><pre>{JSON.stringify({ manifestSha256: job.result.manifestSha256, artifactSha256: job.artifactSha256 }, null, 2)}</pre></details>
        <p className="reports-muted">{"\u62a5\u544a\u53d1\u5e03\u548c\u4e0b\u8f7d\u6743\u9650\u5c06\u5355\u72ec\u6838\u9a8c\u3002\u4efb\u52a1\u5b8c\u6210\u4e0d\u4ee3\u8868\u5f53\u524d\u53ef\u4e0b\u8f7d\u3002"}</p></article>}
      <ReportRecovery detail={detail} onChoose={onChoose} onChanged={refresh} onRejected={() => { setDetail(null); setError("\u64cd\u4f5c\u672a\u88ab\u63a5\u53d7\uff0c\u8bf7\u5237\u65b0\u6838\u5bf9\u6743\u9650\u548c\u4efb\u52a1\u4e0a\u4e0b\u6587\u3002"); }} />
    </>}
  </section>;
}
export default function ReportJobsWorkspace() {
  const [kind, setKind] = useState<ReportJobKind>("generation"), [status, setStatus] = useState<ReportJobState>("all"), [cursor, setCursor] = useState<string | null>(null), [pages, setPages] = useState<(string | null)[]>([]);
  const [page, setPage] = useState<ReportJobPage | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState(""), [selected, setSelected] = useState<string | null>(null), [epoch, setEpoch] = useState(0);
  useEffect(() => {
    const c = new AbortController(); setPage(null); setLoading(true); setError("");
    reportJson<ReportJobPage>("/api/report-jobs?kind=" + kind + "&status=" + status + "&limit=20" + (cursor ? "&after=" + encodeURIComponent(cursor) : ""), c.signal)
      .then(v => { if (!c.signal.aborted) setPage(v); }).catch(e => { if (!c.signal.aborted) setError(reportJobError(e)); }).finally(() => { if (!c.signal.aborted) setLoading(false); });
    return () => c.abort();
  }, [kind, status, cursor, epoch]);
  function clear() { setCursor(null); setPages([]); setSelected(null); }
  function refresh() { setCursor(null); setPages([]); setEpoch(n => n + 1); }
  return <div className="jobs-workspace"><aside className="jobs-library" aria-label={"\u62a5\u544a\u4efb\u52a1\u5217\u8868"}>
    <div className="reports-row"><h1>{"\u62a5\u544a\u4efb\u52a1"}</h1><button onClick={refresh} disabled={loading}>{"\u5237\u65b0"}</button></div>
    <div className="jobs-filters" aria-label={"\u4efb\u52a1\u7c7b\u578b"}>{(["generation", "export"] as const).map(k => <button key={k} aria-pressed={kind === k} onClick={() => { setKind(k); clear(); }}>{label(k)}</button>)}</div>
    <div className="jobs-filters" aria-label={"\u4efb\u52a1\u72b6\u6001"}>{(["all", "pending", "dead", "succeeded"] as const).map(s => <button key={s} aria-pressed={status === s} onClick={() => { setStatus(s); clear(); }}>{label(s)}</button>)}</div>
    <p className="reports-muted">{"\u5f53\u524d\u6388\u6743\u8303\u56f4\uff0c\u6309\u521b\u5efa\u65f6\u95f4\u5012\u5e8f\u3002"}</p>
    {error && <p role="alert" className="reports-error">{error}</p>}{loading ? <p role="status">{"\u6b63\u5728\u8bfb\u53d6\u4efb\u52a1\u2026"}</p> : page && !page.items.length ? <p className="reports-muted">{"\u5f53\u524d\u8303\u56f4\u6682\u65e0\u6b64\u7c7b\u4efb\u52a1\u3002"}</p> : null}
    <div className="jobs-list">{page?.items.map(j => <button key={j.id} aria-pressed={selected === j.id} className={selected === j.id ? "selected" : ""} onClick={() => setSelected(j.id)}>
      <span className="reports-row"><strong>{j.registration?.templateCode ?? label(j.kind)}</strong><i data-state={j.status}>{label(j.status)}</i></span>
      <span>{label(j.grain)}{" \u00b7 "}{label(j.readiness)}</span><small>{reportTime(j.period.start)}{" \u00b7 "}{j.attempt}{"/"}{j.maxAttempts}</small><code>{j.id}</code></button>)}</div>
    <nav className="reports-row" aria-label={"\u4efb\u52a1\u5206\u9875"}><button disabled={loading || !pages.length} onClick={() => { setCursor(pages.at(-1)!); setPages(p => p.slice(0, -1)); }}>{"\u4e0a\u4e00\u9875"}</button><small>{pages.length + 1}</small>
      <button disabled={loading || !page?.next} onClick={() => { setPages(p => [...p, cursor]); setCursor(page!.next); }}>{"\u4e0b\u4e00\u9875"}</button></nav>
  </aside>{selected ? <Inspection key={kind + selected} id={selected} kind={kind} epoch={epoch} refresh={refresh} onChoose={setSelected} /> : <section className="reports-empty"><span className="reports-eyebrow">REPORT OPERATIONS</span><h2>{"\u8ffd\u6eaf\u6bcf\u6b21\u751f\u6210\u548c\u5bfc\u51fa"}</h2><p>{"\u9009\u62e9\u4efb\u52a1\uff0c\u67e5\u770b\u767b\u8bb0\u7248\u672c\u3001\u6267\u884c\u8bb0\u5f55\u548c\u62a5\u544a\u7ed3\u679c\u3002"}</p></section>}</div>;
}
