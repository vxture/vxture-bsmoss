"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ReportJobDetail, RecoverReportJob } from "../../domains/supervision/report-jobs";
import type { RecoveryRecord, RecoveryResult } from "../../domains/supervision/jobs";
import { reportJson, ReportClientError } from "../../reports/client";
import {taskTime} from "../../operations/data-updates/client";
import {Button,Input} from "@vxture/design-system";
import { jobError } from "../../operations/aggregation/client";

function RecoveryLink({ record, parent = false, onChoose }: { record: RecoveryRecord; parent?: boolean; onChoose(id: string): void }) {
  return <article className="flex min-w-0 flex-col gap-sm border-t border-dashed border-border pt-md text-body-small"><strong>{parent ? "\u6062\u590d\u81ea" : "\u5df2\u590d\u6838\u91cd\u6392"}</strong>
    <Button variant="link" className="h-auto justify-start whitespace-normal break-all text-left text-body" onClick={() => onChoose(parent ? record.originalJobId : record.replacementJobId)}>{parent ? record.originalJobId : record.replacementJobId}</Button>
    <span className="text-muted-foreground">{record.requestedBy}{" \u00b7 "}{taskTime(record.recordedAt)}</span><span className="break-all">{record.reasonRef}</span></article>;
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
  return <>{error && <p role="alert" className="text-body-small text-destructive">{error}</p>}
    {pending && <div className="flex flex-col items-start gap-sm text-body-small"><p>{"\u7ed3\u679c\u5c1a\u672a\u786e\u8ba4\uff0c\u5df2\u4fdd\u7559\u539f\u547d\u4ee4\u3002"}</p><Button variant="outline" disabled={busy} onClick={() => void execute(pending)}>{busy ? "\u5904\u7406\u4e2d\u2026" : "\u4f7f\u7528\u539f\u547d\u4ee4\u91cd\u8bd5"}</Button></div>}
    {detail.recoveredFrom && <RecoveryLink record={detail.recoveredFrom} parent onChoose={onChoose} />}
    {detail.recovery || completed ? <RecoveryLink record={(detail.recovery ?? completed)!} onChoose={onChoose} /> : detail.job.status === "dead" && <form className="flex min-w-0 flex-col items-start gap-sm border-t border-dashed border-border pt-md text-body-small" onSubmit={submit}>
      <h3 className="text-heading-small">{detail.job.kind === "export" ? "\u590d\u6838\u540e\u91cd\u6392\u5bfc\u51fa" : "\u590d\u6838\u540e\u91cd\u6392\u751f\u6210"}</h3><p className="text-muted-foreground">{"\u6838\u5bf9\u6545\u969c\u539f\u56e0\u540e\u586b\u5199\u590d\u6838\u4f9d\u636e\uff0c\u539f\u8bb0\u5f55\u4fdd\u7559\u3002"}</p>
      <label className="flex w-full flex-col gap-xs">{"\u590d\u6838\u4f9d\u636e"}<Input required maxLength={2048} value={reason} disabled={busy || !!pending} onChange={e => setReason(e.target.value)} placeholder={"\u5de5\u5355\u53f7\u6216\u590d\u6838\u8bb0\u5f55\u5f15\u7528"} /></label>
      <Button variant="outline" type="submit" disabled={busy || !!pending || !reason.trim()}>{busy ? "\u6b63\u5728\u63d0\u4ea4\u2026" : "\u63d0\u4ea4\u590d\u6838\u5e76\u91cd\u6392"}</Button>
      <p className="text-muted-foreground">{"\u91cd\u6392\u4e0d\u6539\u53d8\u53d1\u5e03\u6216\u4e0b\u8f7d\u6743\u9650\u3002"}</p></form>}</>;
}
