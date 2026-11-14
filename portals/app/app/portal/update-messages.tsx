"use client";

import { useEffect, useRef, useState } from "react";
import { Button, EmptyState, Icon, StatusBadge } from "@vxture/design-system";
import type { UpdateNotifications } from "../domains/data-updates/contracts";
import { phases, taskHref, updateReadError, updateJson } from "../operations/data-updates/client";
import { formatDataTime } from "../domains/data-updates/rules";

// Mounted only while the drawer is open. Never persists authorized records in
// browser storage; full-page navigation and reopening read the server again.
export default function UpdateMessages({ enabled, loginEnabled }: { enabled: boolean; loginEnabled: boolean }) {
  const [visible, setVisible] = useState(false), [epoch, setEpoch] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null), [previous, setPrevious] = useState<(string | null)[]>([]);
  const [data, setData] = useState<UpdateNotifications | null>(null), [error, setError] = useState(""), [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const prior = useRef<UpdateNotifications | null>(null);
  useEffect(() => {
    const change = () => setVisible(document.visibilityState === "visible");
    change(); document.addEventListener("visibilitychange", change);
    return () => document.removeEventListener("visibilitychange", change);
  }, []);
  useEffect(() => {
    setData(null); setError(""); setNotice(""); prior.current = null;
    if (!enabled || !visible) return;
    const c = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined;
    setLoading(true);
    async function read() {
      try {
        const result = await updateJson<UpdateNotifications>("/api/data-updates/notifications?limit=5" + (cursor ? "&after=" + encodeURIComponent(cursor) : ""), c.signal);
        if (c.signal.aborted) return;
        const changed = prior.current?.items.some(item => result.items.some(next => next.id === item.id && (next.phase !== item.phase || next.configurationChanged !== item.configurationChanged)));
        if (changed) setNotice("\u4efb\u52a1\u72b6\u6001\u5df2\u66f4\u65b0\uff0c\u8bf7\u67e5\u770b\u6700\u65b0\u8fdb\u5ea6\u3002");
        prior.current = result; setData(result); setError("");
        timer = setTimeout(() => void read(), 10000);
      } catch (e) {
        if (!c.signal.aborted) { setData(null); prior.current = null; setNotice(""); setError(updateReadError(e)); }
      } finally { if (!c.signal.aborted) setLoading(false); }
    }
    void read();
    return () => { c.abort(); if (timer) clearTimeout(timer); prior.current = null; };
  }, [enabled, visible, epoch, cursor]);
  if (!enabled) return <EmptyState title={loginEnabled ? "\u767b\u5f55\u540e\u67e5\u770b\u4efb\u52a1\u6d88\u606f" : "\u4efb\u52a1\u6d88\u606f\u5c1a\u672a\u542f\u7528"}
    description={loginEnabled ? "\u4ec5\u5c55\u793a\u5f53\u524d\u8d26\u53f7\u6388\u6743\u8303\u56f4\u5185\u7684\u6570\u636e\u5904\u7406\u4efb\u52a1\u3002" : "\u63a5\u901a\u5e73\u53f0\u8eab\u4efd\u540e\uff0c\u53ef\u5728\u6b64\u67e5\u770b\u540e\u53f0\u4efb\u52a1\u8fdb\u5ea6\u3002"} />;
  return <section className="flex min-w-0 flex-col gap-lg" aria-label={"\u540e\u53f0\u4efb\u52a1\u6d88\u606f"} aria-busy={loading}>
    <div className="flex flex-wrap items-center justify-between gap-md">
      <h2 className="text-heading-small">{"\u6570\u636e\u5904\u7406\u4efb\u52a1"}</h2>
      <Button variant="ghost" size="sm" disabled={loading} onClick={() => { setCursor(null); setPrevious([]); setEpoch(n => n + 1); }}><Icon name="refresh" size="sm" />{"\u67e5\u8be2"}</Button>
    </div>
    <p className="text-body-small text-muted-foreground">{"\u6309\u63d0\u4ea4\u65f6\u95f4\u6392\u5e8f\uff0c\u5c55\u793a\u5f53\u524d\u5904\u7406\u72b6\u6001\u3002\u5904\u7406\u5b8c\u6210\u540e\uff0c\u6570\u636e\u53ef\u7528\u7248\u672c\u4ecd\u4ee5\u5206\u6790\u9875\u4e3a\u51c6\u3002"}</p>
    {notice && <p role="status" className="text-body-small">{notice}</p>}
    {error && <p role="alert" className="text-body-small text-destructive">{error}</p>}
    {loading && !data && <p role="status" className="text-body-small text-muted-foreground">{"\u6b63\u5728\u8bfb\u53d6\u2026"}</p>}
    {data && !data.items.length && <EmptyState title={"\u6682\u65e0\u4efb\u52a1\u6d88\u606f"} description={"\u5f53\u524d\u6388\u6743\u8303\u56f4\u5185\u6ca1\u6709\u6570\u636e\u5904\u7406\u4efb\u52a1\u3002"} />}
    {data?.items.map(item => <article key={item.id} className="flex min-w-0 flex-col gap-sm border-b border-dashed border-border pb-lg">
      <div className="flex flex-wrap items-center justify-between gap-sm"><StatusBadge tone={item.configurationChanged ? "warning" : item.phase === "failed" ? "danger" : item.phase === "processed" ? "success" : "neutral"}>{item.configurationChanged ? "\u914d\u7f6e\u5df2\u53d8\u66f4" : phases[item.phase]}</StatusBadge><time className="text-body-small text-muted-foreground">{"\u63d0\u4ea4 " + formatDataTime(item.createdAt)}</time></div>
      <a href={taskHref(item.id)} className="break-all text-body font-medium text-primary hover:underline">{item.partitionId}</a>
      <p className="text-body-small tabular-nums text-muted-foreground">{"\u589e\u91cf " + item.inputs.dispatched + "/" + item.inputs.total + " \u00b7 \u91cd\u7b97 " + item.results.succeeded + "/" + item.results.total}</p>
      <p className="text-body-small text-muted-foreground">{item.configurationChanged ? "\u4efb\u52a1\u4fdd\u7559\u539f\u914d\u7f6e\uff0c\u8bf7\u8fdb\u5165\u8be6\u60c5\u6838\u5bf9\u3002" : item.phase === "failed" ? "\u9700\u8981\u5904\u7f6e\uff0c\u8bf7\u8fdb\u5165\u8be6\u60c5\u67e5\u770b\u5931\u8d25\u539f\u56e0\u4e0e\u6062\u590d\u5165\u53e3\u3002" : item.phase === "processed" ? "\u672c\u6b21\u589e\u91cf\u5df2\u5904\u7406\uff0c\u539f\u62a5\u544a\u4fdd\u7559\u3002" : "\u540e\u53f0\u7ee7\u7eed\u5904\u7406\uff0c\u79bb\u5f00\u9875\u9762\u4e0d\u4f1a\u4e2d\u65ad\u3002"}</p>
    </article>)}
    {data && <nav className="flex items-center justify-between gap-md" aria-label={"\u6d88\u606f\u5206\u9875"}>
      <Button variant="ghost" size="sm" disabled={loading || !previous.length} onClick={() => { setCursor(previous.at(-1)!); setPrevious(p => p.slice(0, -1)); }}>{"\u4e0a\u4e00\u9875"}</Button>
      <span className="text-body-small text-muted-foreground">{previous.length + 1}</span>
      <Button variant="ghost" size="sm" disabled={loading || !data.next} onClick={() => { setPrevious(p => [...p, cursor]); setCursor(data.next); }}>{"\u4e0b\u4e00\u9875"}</Button>
    </nav>}
    <Button asChild variant="outline" className="self-start"><a href="/operations/data-updates">{"\u67e5\u770b\u5168\u90e8\u4efb\u52a1"}</a></Button>
  </section>;
}
