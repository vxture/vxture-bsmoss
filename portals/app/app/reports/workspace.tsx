"use client";
import { Button, Icon, SectionHeader } from "@vxture/design-system";
import PageHeading from "../portal/page-heading";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ReportListPage } from "../domains/reports/list";
import type { StoredReport } from "../domains/reports/store";
import { reportTime } from "../domains/reports/display";
import { reportErrorText, reportJson, reportStatus } from "./client";
import ReportDetail from "./detail";

export default function ReportWorkspace({ initialSelection = null, invalidLink = false }: { initialSelection?: { id: string; revision: string } | null; invalidLink?: boolean }) {
  const [page, setPage] = useState<ReportListPage | null>(null), [cursor, setCursor] = useState<string | null>(null);
  const [pages, setPages] = useState<(string | null)[]>([]), [epoch, setEpoch] = useState(0);
  const [selection, setSelection] = useState<{ id: string; revision: string } | null>(initialSelection);
  const [error, setError] = useState(""), [loading, setLoading] = useState(true), [generating, setGenerating] = useState(false);
  const [code, setCode] = useState(""), [version, setVersion] = useState("1"), [at, setAt] = useState("");
  const [expected, setExpected] = useState("");
  const generation = useRef<AbortController | null>(null);
  useEffect(() => () => generation.current?.abort(), []);
  useEffect(() => {
    const c = new AbortController(); setLoading(true); setError(""); setPage(null);
    reportJson<ReportListPage>("/api/reports?limit=20" + (cursor ? "&after=" + encodeURIComponent(cursor) : ""), c.signal)
      .then(value => { if (!c.signal.aborted) setPage(value); }).catch(e => { if (!c.signal.aborted) setError(reportErrorText(e)); })
      .finally(() => { if (!c.signal.aborted) setLoading(false); });
    return () => c.abort();
  }, [cursor, epoch]);
  function refreshList() { setCursor(null); setPages([]); setEpoch(n => n + 1); }
  async function generate(event: FormEvent) {
    event.preventDefault(); if (generating) return;
    const c = new AbortController(); generation.current = c; setGenerating(true); setError("");
    try {
      const result = await reportJson<{ record: StoredReport }>("/api/reports", c.signal,
        { templateCode: code.trim(), templateVersion: Number(version), at: at + ":00+08:00", expectedRevision: expected.trim() || null });
      if (!c.signal.aborted) { refreshList(); setSelection({ id: result.record.reportId, revision: result.record.revision }); }
    } catch (e) { if (!c.signal.aborted) setError(reportErrorText(e)); }
    finally { if (!c.signal.aborted) setGenerating(false); }
  }
  return <div className="flex min-w-0 flex-col gap-lg product-page-inset">
    <PageHeading title={"\u5468\u671f\u62a5\u544a"} description={"\u5468\u671f\u62a5\u544a\u5f52\u6863\u4e0e\u7248\u672c\u6838\u9a8c"}
      actions={<> <Button asChild variant="outline"><a href="/reports/tasks">{"\u62a5\u544a\u4efb\u52a1"}</a></Button><Button variant="ghost" size="icon-md" aria-label={"\u5237\u65b0"} title={"\u5237\u65b0"} onClick={refreshList} disabled={loading}><Icon name="refresh" size="sm" /></Button></>} />
    <div className="reports-workspace">
    <aside className="reports-library" aria-label={"\u62a5\u544a\u5217\u8868"}>
      <SectionHeader title={"\u5468\u671f\u62a5\u544a\u5217\u8868"} />
      <p className="reports-muted">{"\u5217\u8868\u663e\u793a\u751f\u6210\u65f6\u7684\u5b8c\u6574\u6027\uff0c\u6253\u5f00\u8be6\u60c5\u6838\u9a8c\u6700\u65b0\u72b6\u6001\u3002"}</p>
      {invalidLink && <p role="alert" className="reports-error">{"\u62a5\u544a\u94fe\u63a5\u53c2\u6570\u65e0\u6548\uff0c\u8bf7\u91cd\u65b0\u9009\u62e9\u62a5\u544a\u3002"}</p>}
      {error && <p role="alert" className="reports-error">{error}</p>}
      {loading ? <p role="status">{"\u6b63\u5728\u8bfb\u53d6\u62a5\u544a\u2026"}</p> : page && !page.items.length ? <p className="reports-muted">{"\u5f53\u524d\u8303\u56f4\u6682\u65e0\u62a5\u544a\u3002"}</p> : null}
      <div className="reports-list">{page?.items.map(item => <button key={item.reportId} className={"reports-list-item" + (selection?.id === item.reportId ? " selected" : "")}
        aria-pressed={selection?.id === item.reportId} onClick={() => setSelection({ id: item.reportId, revision: item.revision })}>
        <span className="reports-row"><strong>{item.title}</strong><span className="reports-badge">{reportStatus(item.grain)}</span></span>
        <span>{reportTime(item.period.start).slice(0, 10)} ~ {reportTime(item.period.end).slice(0, 10)}</span>
        <span className="reports-muted">{"r" + item.revision + " \u00b7 " + reportStatus(item.capturedCompleteness) + " \u00b7 \u65b0\u9c9c\u5ea6\u5f85\u6838\u9a8c"}</span>
      </button>)}</div>
      <nav className="reports-row" aria-label={"\u62a5\u544a\u5206\u9875"}><button disabled={loading || !pages.length} onClick={() => { setCursor(pages.at(-1)!); setPages(p => p.slice(0, -1)); }}>{"\u4e0a\u4e00\u9875"}</button>
        <small>{pages.length + 1}</small><button disabled={loading || !page?.next} onClick={() => { setPages(p => [...p, cursor]); setCursor(page!.next); }}>{"\u4e0b\u4e00\u9875"}</button></nav>
      <details className="reports-generate"><summary>{"\u6309\u5df2\u914d\u7f6e\u6a21\u677f\u751f\u6210"}</summary>
        <form onSubmit={generate}><label>{"\u6a21\u677f\u7f16\u7801"}<input required maxLength={200} value={code} onChange={e => setCode(e.target.value)} /></label>
          <label>{"\u6a21\u677f\u7248\u672c"}<input required type="number" min="1" step="1" value={version} onChange={e => setVersion(e.target.value)} /></label>
          <label>{"\u5468\u671f\u5185\u65f6\u95f4\uff08\u5317\u4eac\u65f6\u95f4\uff09"}<input required type="datetime-local" step="60" value={at} onChange={e => setAt(e.target.value)} /></label>
          <label>{"\u5df2\u6709\u751f\u6210\u4fee\u8ba2\uff08\u9996\u6b21\u7559\u7a7a\uff09"}<input pattern="[1-9][0-9]{0,29}" value={expected} onChange={e => setExpected(e.target.value)} /></label>
          <button disabled={generating} type="submit">{generating ? "\u6b63\u5728\u751f\u6210\u2026" : "\u751f\u6210\u5feb\u7167"}</button></form>
      </details>
    </aside>
    {selection ? <ReportDetail key={selection.id + ":" + selection.revision} reportId={selection.id} initialRevision={selection.revision} onChanged={refreshList} />
      : <section className="reports-empty"><span className="reports-eyebrow">PERIODIC INSIGHTS</span><h2>{"\u4ece\u6570\u636e\u5230\u53ef\u6838\u9a8c\u7684\u7ed3\u8bba"}</h2><p>{"\u9009\u62e9\u4e00\u4efd\u62a5\u544a\uff0c\u67e5\u770b\u7ecf\u8425\u670d\u52a1\u3001\u8fd0\u8425\u72b6\u6001\u548c\u8fd0\u884c\u53c2\u6570\u3002"}</p></section>}
  </div></div>;
}
