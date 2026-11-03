"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ReportJobDetail, RecoverReportJob } from "../../../domains/supervision/report-jobs";
import type { RecoveryRecord, RecoveryResult } from "../../../domains/supervision/jobs";
import { reportJson, ReportClientError } from "../../../reports/client";
import { reportTime } from "../../../domains/reports/display";
import { jobError } from "../aggregation/client";

function RecoveryLink({ record, parent = false, onChoose }: { record: RecoveryRecord; parent?: boolean; onChoose(id: string): void }) {
  return <article className="jobs-link"><strong>{parent ? "\u6062\u590d\u81ea" : "\u5df2\u590d\u6838\u91cd\u6392"}</strong>
    <button onClick={() => onChoose(parent ? record.originalJobId : record.replacementJobId)}>{parent ? record.originalJobId : record.replacementJobId}</button>
    <span>{record.requestedBy}{" \u00b7 "}{reportTime(record.recordedAt)}</span><small>{record.reasonRef}</small></article>;
}
export function ReportRecovery({ detail, onChoose, onChanged, onRejected }: { detail: ReportJobDetail; onChoose(id: string): void; onChanged(): void; onRejected(): void }) {
  const [reason, setReason] = useState(""), [pending, setPending] = useState<RecoverReportJob | null>(null), [completed, setCompleted] = useState<RecoveryRecord | null>(null);
  const [error, setError] = useState(""), [busy, setBusy] = useState(false), inFlight = useRef(false), controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function execute(command: RecoverReportJob) {
    if (inFlight.current) return; inFlight.current = true; setBusy(true); setError(""); setPending(command);
    const c = new AbortController(); controller.current = c;
    try {
      const result = await reportJson<RecoveryResult>("/api/report-jobs/" + encodeURIComponent(command.jobId) + "/recover", c.signal, command);
      if (!c.signal.aborted) { setPending(null); setCompleted(result.record); onChanged(); }
    } catch (e) {
      if (!c.signal.aborted) { setError(jobError(e)); if (e instanceof ReportClientError && e.status < 500) { setPending(null); onRejected(); } }
    } finally { inFlight.current = false; if (!c.signal.aborted) setBusy(false); }
  }
  function submit(event: FormEvent) { event.preventDefault(); if (!reason.trim() || pending || busy) return;
    void execute({ kind: detail.job.kind, jobId: detail.job.id, expectedAttempt: detail.job.attempt, commandId: crypto.randomUUID(), reasonRef: reason.trim() }); }
  return <>{error && <p role="alert" className="reports-error">{error}</p>}
    {pending && <div className="reports-notice"><p>{"\u7ed3\u679c\u5c1a\u672a\u786e\u8ba4\uff0c\u5df2\u4fdd\u7559\u539f\u547d\u4ee4\u3002"}</p><button disabled={busy} onClick={() => void execute(pending)}>{busy ? "\u5904\u7406\u4e2d\u2026" : "\u4f7f\u7528\u539f\u547d\u4ee4\u91cd\u8bd5"}</button></div>}
    {detail.recoveredFrom && <RecoveryLink record={detail.recoveredFrom} parent onChoose={onChoose} />}
    {detail.recovery || completed ? <RecoveryLink record={(detail.recovery ?? completed)!} onChoose={onChoose} /> : detail.job.status === "dead" && <form className="jobs-review" onSubmit={submit}>
      <h3>{detail.job.kind === "export" ? "\u590d\u6838\u540e\u91cd\u6392\u5bfc\u51fa" : "\u590d\u6838\u540e\u91cd\u6392\u751f\u6210"}</h3><p>{detail.job.kind === "export" ? "\u786e\u8ba4\u6545\u969c\u5df2\u4fee\u590d\uff0c\u586b\u5199\u590d\u6838\u4f9d\u636e\u3002\u539f\u5931\u8d25\u8bb0\u5f55\u4fdd\u7559\uff0c\u7cfb\u7edf\u5c06\u6838\u9a8c\u539f\u53d1\u5e03\u5e76\u53e6\u5efa\u5173\u8054\u4efb\u52a1\u3002" : "\u786e\u8ba4\u6545\u969c\u5df2\u4fee\u590d\uff0c\u586b\u5199\u590d\u6838\u4f9d\u636e\u3002\u7cfb\u7edf\u5c06\u6838\u9a8c\u539f\u767b\u8bb0\u548c\u6a21\u677f\uff0c\u4fdd\u7559\u539f\u626b\u63cf\u4e0e\u5931\u8d25\u8bb0\u5f55\uff0c\u53e6\u5efa\u5173\u8054\u4efb\u52a1\u7531\u767b\u8bb0\u4e3b\u4f53\u6267\u884c\u3002"}</p>
      <label>{"\u590d\u6838\u4f9d\u636e"}<input required maxLength={2048} value={reason} disabled={busy || !!pending} onChange={e => setReason(e.target.value)} placeholder={"\u5de5\u5355\u53f7\u6216\u590d\u6838\u8bb0\u5f55\u5f15\u7528"} /></label>
      <button type="submit" disabled={busy || !!pending || !reason.trim()}>{busy ? "\u6b63\u5728\u63d0\u4ea4\u2026" : "\u63d0\u4ea4\u590d\u6838\u5e76\u91cd\u6392"}</button>
      <small>{"\u9700\u72ec\u7acb\u6062\u590d\u6743\u9650\u3002\u91cd\u6392\u4e0d\u4ee3\u8868\u91cd\u65b0\u53d1\u5e03\u6216\u7acb\u5373\u53ef\u4e0b\u8f7d\u3002"}</small></form>}</>;
}
