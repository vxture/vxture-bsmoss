"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button, Icon, Input, StatusBadge } from "@vxture/design-system";
import type { UpdateDetail, UpdateFailure, InputRetryCommand } from "../../domains/data-updates/contracts";
import {taskTime} from "./client";
import { ReportClientError } from "../../reports/client";
import { failures, phases, updateError, updateJson } from "./client";

function InputRecovery({ task, failure, onChanged }: { task: UpdateDetail; failure: UpdateFailure; onChanged(): void }) {
  const [reason, setReason] = useState(""), [pending, setPending] = useState<InputRetryCommand | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(""), [done, setDone] = useState(false), [rejected, setRejected] = useState(false);
  const flight = useRef(false), controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function execute(command: InputRetryCommand) {
    if (flight.current) return; flight.current = true; setBusy(true); setError(""); setPending(command);
    const c = new AbortController(); controller.current = c;
    try {
      await updateJson("/api/data-updates/" + task.id + "/retry", c.signal, command);
      if (!c.signal.aborted) { setPending(null); setDone(true); onChanged(); }
    } catch (e) { if (!c.signal.aborted) { setError(updateError(e)); if (e instanceof ReportClientError && e.status < 500) { setPending(null); setRejected(true); } } }
    finally { flight.current = false; if (!c.signal.aborted) setBusy(false); }
  }
  function submit(e: FormEvent) {
    e.preventDefault(); if (!reason.trim() || !failure.expectedRevision || pending || rejected) return;
    void execute({ id: task.id, changeId: failure.id, expectedRevision: failure.expectedRevision, reasonRef: reason.trim() });
  }
  if (done) return <p role="status" className="text-body-small text-muted-foreground">{"\u5df2\u63d0\u4ea4\u91cd\u8bd5\uff0c\u7b49\u5f85\u540e\u53f0\u5904\u7406\u3002"}</p>;
  return <form onSubmit={submit} className="flex min-w-0 flex-col gap-sm">
    {error && <p role="alert" className="text-body-small text-destructive">{error}</p>}
    {pending ? <><p className="text-body-small text-muted-foreground">{"\u7ed3\u679c\u5c1a\u672a\u786e\u8ba4\uff0c\u5df2\u4fdd\u7559\u539f\u91cd\u8bd5\u547d\u4ee4\u3002"}</p><Button type="button" variant="outline" disabled={busy} onClick={() => void execute(pending)}>{busy ? "\u63d0\u4ea4\u4e2d" : "\u4f7f\u7528\u539f\u547d\u4ee4\u91cd\u8bd5"}</Button></>
      : rejected ? <Button type="button" variant="outline" onClick={onChanged}>{"\u91cd\u65b0\u6838\u5bf9\u4efb\u52a1"}</Button>
        : <><label className="flex flex-col gap-xs text-body-small">{"\u590d\u6838\u4f9d\u636e"}<Input value={reason} required maxLength={2048} onChange={e => setReason(e.target.value)} placeholder={"\u5de5\u5355\u6216\u590d\u6838\u8bb0\u5f55\u5f15\u7528"} /></label>
          <div className="flex flex-wrap items-center gap-md"><Button type="submit" variant="outline" disabled={!reason.trim() || busy}>{"\u590d\u6838\u5e76\u91cd\u8bd5"}</Button><span className="text-body-small text-muted-foreground">{"\u9700\u8981\u72ec\u7acb\u6062\u590d\u6743\u9650"}</span></div></>}
  </form>;
}
export default function TaskInspection({ id, epoch, onChooseJob }: { id: string; epoch: number; onChooseJob(id:string):void }) {
  const [detail, setDetail] = useState<UpdateDetail | null>(null), [error, setError] = useState(""), [loading, setLoading] = useState(true), [refresh, setRefresh] = useState(0), [notice, setNotice] = useState("");
  const lastPhase = useRef<string | null>(null);
  useEffect(() => {
    const c = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined, running = false;
    setLoading(true); setError("");
    async function read() {
      if (running || c.signal.aborted) return; running = true;
      try {
        const result = await updateJson<UpdateDetail>("/api/data-updates/" + id, c.signal);
        if (!c.signal.aborted) {
          if (lastPhase.current && lastPhase.current !== result.progress.phase) setNotice(result.progress.phase === "processed" ? "\u589e\u91cf\u5904\u7406\u5df2\u5b8c\u6210\u3002\u6570\u636e\u53ef\u7528\u7248\u672c\u4ecd\u4ee5\u5206\u6790\u9875\u4e3a\u51c6\u3002" : "\u4efb\u52a1\u72b6\u6001\u5df2\u66f4\u65b0\uff1a" + phases[result.progress.phase]);
          lastPhase.current = result.progress.phase; setDetail(result); setError("");
          if (result.progress.phase !== "processed" && !result.configurationChanged && document.visibilityState === "visible") timer = setTimeout(() => void read(), 10000);
        }
      } catch (e) { if (!c.signal.aborted) { setError(updateError(e)); setDetail(null); setNotice(""); lastPhase.current = null; } }
      finally { running = false; if (!c.signal.aborted) setLoading(false); }
    }
    const visible = () => { if (timer) clearTimeout(timer); if (document.visibilityState === "visible") void read(); };
    document.addEventListener("visibilitychange", visible); void read();
    return () => { c.abort(); if (timer) clearTimeout(timer); document.removeEventListener("visibilitychange", visible); };
  }, [id, epoch, refresh]);
  const p = detail?.progress;
  return <section className="site-analysis-workflow">
    <div className="flex min-w-0 flex-col gap-lg" aria-busy={loading}>
      <div className="flex flex-wrap items-center justify-between gap-md"><code className="break-all text-body-small text-muted-foreground">{id}</code><Button variant="ghost" size="sm" disabled={loading} onClick={() => setRefresh(n => n + 1)}><Icon name="refresh" size="sm" />{"\u67e5\u8be2\u8fdb\u5ea6"}</Button></div>
      {notice && <p role="status" className="text-body-small">{notice}</p>}
      {error && <p role="alert" className="text-body-small text-destructive">{error}</p>}
      {loading && !detail && <p role="status" className="text-body-small text-muted-foreground">{"\u6b63\u5728\u67e5\u8be2\u4efb\u52a1\u2026"}</p>}
      {detail && p && <>
        <div className="flex flex-wrap items-center gap-md"><StatusBadge tone={p.phase === "failed" ? "danger" : p.phase === "processed" ? "success" : "neutral"}>{phases[p.phase]}</StatusBadge><span className="text-body-small text-muted-foreground">{"\u5df2\u63a5\u6536\u589e\u91cf\u6570\u636e"}</span></div>
        <dl className="grid min-w-0 grid-cols-1 gap-md text-body-small sm:grid-cols-2"><div><dt className="text-muted-foreground">{"\u6765\u6e90\u4efb\u52a1\u7ec4"}</dt><dd className="break-all">{detail.partitionId}</dd></div><div><dt className="text-muted-foreground">{"\u63d0\u4ea4\u65f6\u95f4"}</dt><dd>{taskTime(detail.createdAt)}</dd></div></dl>
        <div className="grid gap-md sm:grid-cols-2">
          <div className="rounded-md bg-muted p-md"><p className="text-body-small text-muted-foreground">{"\u589e\u91cf\u5904\u7406"}</p><p className="text-heading-small tabular-nums">{p.inputs.dispatched}<span className="text-body-small text-muted-foreground">{" / " + p.inputs.total}</span></p><p className="text-body-small text-muted-foreground">{"\u9700\u5904\u7f6e " + p.inputs.blocked + " \u6761"}</p></div>
          <div className="rounded-md bg-muted p-md"><p className="text-body-small text-muted-foreground">{"\u7ed3\u679c\u91cd\u7b97"}</p><p className="text-heading-small tabular-nums">{p.results.succeeded}<span className="text-body-small text-muted-foreground">{" / " + p.results.total}</span></p><p className="text-body-small text-muted-foreground">{"\u8fd0\u884c " + p.results.running + " \u00b7 \u7b49\u5f85 " + p.results.waiting + " \u00b7 \u5931\u8d25 " + p.results.failed}</p></div>
        </div>
        {detail.configurationChanged && <p role="status" className="rounded-md bg-muted p-md text-body-small">{"\u6765\u6e90\u914d\u7f6e\u5df2\u53d8\u66f4\u3002\u6b64\u4efb\u52a1\u4fdd\u7559\u539f\u914d\u7f6e\u8bb0\u5f55\uff0c\u8bf7\u6838\u5bf9\u540e\u7eed\u5904\u7f6e\u3002"}</p>}
        <p className="text-body-small text-muted-foreground">{p.phase === "processed" ? "\u672c\u6b21\u589e\u91cf\u5df2\u5904\u7406\u3002\u5206\u6790\u6570\u636e\u7684\u53ef\u7528\u7248\u672c\u4e0e\u622a\u81f3\u65f6\u95f4\u4ee5\u5206\u6790\u9875\u4e3a\u51c6\uff0c\u539f\u62a5\u544a\u4fdd\u7559\u3002" : "\u79bb\u5f00\u9875\u9762\u4e0d\u4f1a\u53d6\u6d88\u540e\u53f0\u4efb\u52a1\u3002\u6b64\u5904\u4ec5\u67e5\u8be2\u5df2\u63a5\u6536\u6570\u636e\u7684\u5904\u7406\u8fdb\u5ea6\uff1b\u6682\u65e0\u53ef\u7528\u8017\u65f6\u4f30\u7b97\u3002"}</p>
        {p.failures.length > 0 && <section className="flex min-w-0 flex-col gap-lg" aria-label={"\u5931\u8d25\u5904\u7f6e"}><h3 className="text-heading-small">{"\u5931\u8d25\u4e0e\u91cd\u8bd5"}</h3>{p.failures.map(f => <div key={f.kind + f.id} className="flex min-w-0 flex-col gap-md border-t border-dashed border-border pt-md">
          <p className="text-body-small">{failures[f.code] ?? "\u5904\u7406\u672a\u5b8c\u6210"}</p><code className="break-all text-body-small text-muted-foreground">{f.id}</code>
          {f.retryAt && <p className="text-body-small text-muted-foreground">{"\u4e0b\u6b21\u53ef\u91cd\u8bd5 " + taskTime(f.retryAt)}</p>}
          {f.kind === "input" && f.canRetry && !detail.configurationChanged && <InputRecovery key={f.id + f.expectedRevision + refresh} task={detail} failure={f} onChanged={() => setRefresh(n => n + 1)} />}
          {f.kind === "result" && <Button variant="outline" className="self-start" onClick={()=>onChooseJob(f.id)}>{"\u67e5\u770b\u91cd\u7b97\u4efb\u52a1"}</Button>}
        </div>)}</section>}
      </>}
    </div>
  </section>;
}
