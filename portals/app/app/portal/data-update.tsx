"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Icon, StatusBadge } from "@vxture/design-system";
import { commonThrough, formatDataTime, planDataUpdate, readAvailability, type DataAvailability } from "../domains/data-updates/rules";

const UpdateContext = createContext<{ availability: DataAvailability; open: () => void } | null>(null);
function useUpdate() { const value = useContext(UpdateContext); if (!value) throw Error("data_update_provider_required"); return value; }
export function DataUpdateTime() {
  const { availability } = useUpdate(), through = commonThrough(availability);
  return <Button type="button" variant="ghost" size="sm" asChild className="h-auto max-w-full flex-wrap justify-start gap-xs p-0 text-body-small font-normal text-muted-foreground hover:bg-transparent hover:text-foreground" aria-label={"\u67e5\u770b\u6570\u636e\u66f4\u65b0\u8be6\u60c5"}>
    <a href={"/operations/data-updates#source-"+availability.family}><span>{"\u6570\u636e\u66f4\u65b0\u81f3"}</span><time dateTime={through ?? undefined} className="tabular-nums">{formatDataTime(through)}</time></a>
  </Button>;
}
export function DataUpdateButton() {
  const { open } = useUpdate();
  return <Button size="xl" variant="secondary" type="button" onClick={open}><Icon name="refresh" size="sm" />{"\u66f4\u65b0\u6570\u636e"}</Button>;
}
export function DataUpdateProvider({ availability, children }: { availability: DataAvailability; children: ReactNode }) {
  const [open, setOpen] = useState(false), [retry, setRetry] = useState(0);
  const [latest, setLatest] = useState<DataAvailability | null>(null), [error, setError] = useState(false), [checking, setChecking] = useState(false);
  // A new heading/source version invalidates the previous check. Closing aborts
  // the read; it never cancels or pretends to create a background update task.
  const key = JSON.stringify(availability);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => { controller.abort(); setError(true); setChecking(false); }, 15000);
    setChecking(true); setError(false); setLatest(null);
    void (async () => {
      try {
        const response = await fetch("/api/product-preview/data-availability?family=" + availability.family, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw Error("availability_unavailable");
        const data = readAvailability(await response.json());
        if (!controller.signal.aborted) setLatest(data);
      } catch { if (!controller.signal.aborted) setError(true); }
      finally { clearTimeout(timeout); if (!controller.signal.aborted) setChecking(false); }
    })();
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [open, retry, key, availability.family]);
  const plan = latest ? planDataUpdate(availability, latest) : null;
  const status = checking ? "\u6b63\u5728\u68c0\u67e5\u6765\u6e90\u53ef\u7528\u6570\u636e\u2026" : error ? "\u672a\u80fd\u83b7\u53d6\u6765\u6e90\u6c34\u4f4d\uff0c\u5f53\u524d\u7ed3\u679c\u4fdd\u7559\u3002" : plan?.state === "current" ? "\u5df2\u662f\u6700\u8fd1\u53ef\u7528\u6570\u636e" : plan?.state === "available" ? "\u68c0\u6d4b\u5230\u65b0\u6570\u636e\u6216\u4fee\u8ba2\uff0c\u540e\u53f0\u66f4\u65b0\u5c1a\u672a\u63a5\u5165\u3002" : "\u6765\u6e90\u6c34\u4f4d\u5f85\u786e\u8ba4\uff0c\u5f53\u524d\u7ed3\u679c\u4fdd\u7559\u3002";
  return <UpdateContext.Provider value={{ availability, open: () => setOpen(true) }}>{children}
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent width="lg" className="grid-cols-1 max-h-[calc(100dvh-var(--space-xl))] w-[calc(100dvw-var(--space-xl))] overflow-y-auto">
        <DialogHeader><DialogTitle>{"\u66f4\u65b0\u6570\u636e"}</DialogTitle><DialogDescription>{"\u4ee5\u6765\u6e90\u5df2\u5b8c\u6574\u63d0\u4f9b\u7684\u6574\u70b9\u6570\u636e\u4e3a\u51c6\uff0c\u4fdd\u7559\u5f53\u524d\u5206\u6790\u6761\u4ef6\u3002"}</DialogDescription></DialogHeader>
        <dl className="grid min-w-0 grid-cols-1 gap-md text-body-small sm:grid-cols-2">
          <div className="flex flex-col gap-xs"><dt className="text-muted-foreground">{"\u5f53\u524d\u66f4\u65b0\u81f3"}</dt><dd className="font-medium tabular-nums">{formatDataTime(commonThrough(availability))}</dd></div>
          <div className="flex flex-col gap-xs"><dt className="text-muted-foreground">{"\u6700\u8fd1\u53ef\u66f4\u65b0\u81f3"}</dt><dd className="font-medium tabular-nums">{checking ? "\u68c0\u67e5\u4e2d" : formatDataTime(plan?.latest ?? null)}</dd></div>
          <div className="flex flex-col gap-xs"><dt className="text-muted-foreground">{"\u66f4\u65b0\u8303\u56f4"}</dt><dd>{"\u5f53\u524d\u5206\u6790\u4f7f\u7528\u7684\u6765\u6e90\u6570\u636e"}</dd></div>
          <div className="flex flex-col gap-xs"><dt className="text-muted-foreground">{"\u9884\u8ba1\u8017\u65f6"}</dt><dd>{plan?.state === "current" ? "\u65e0\u9700\u66f4\u65b0" : "\u6682\u65e0\u53ef\u7528\u4f30\u7b97"}</dd></div>
        </dl>
        <div role="status" aria-live="polite" className="flex items-start gap-sm rounded-md bg-muted p-md text-body-small"><Icon name={error ? "warning" : "database"} size="sm" className="shrink-0" /><span>{status}</span></div>
        <details className="min-w-0 border-t border-dashed border-border pt-md text-body-small">
          <summary className="cursor-pointer text-muted-foreground">{"\u6765\u6e90\u4e0e\u540c\u6b65\u8be6\u60c5"}</summary>
          <div className="flex min-w-0 flex-col gap-md pt-md">
            <p className="text-muted-foreground">{"\u591a\u6765\u6e90\u663e\u793a\u5171\u540c\u53ef\u7528\u622a\u81f3\uff1b\u6574\u70b9\u4e3a\u8986\u76d6\u7a97\u53e3\u7684\u7ed3\u675f\u8fb9\u754c\u3002\u8be5\u65f6\u95f4\u4e0e\u5f53\u524d\u6240\u9009\u5206\u6790\u65f6\u6bb5\u72ec\u7acb\u3002"}</p>
            {availability.sources.map(source => <dl key={source.id} className="flex min-w-0 flex-col gap-xs border-b border-border pb-md last:border-b-0">
              <dt className="font-medium">{source.label}</dt><dd>{"\u6570\u636e\u66f4\u65b0\u81f3 " + formatDataTime(source.confirmed ? source.through : null)}</dd>
              <dd className="text-muted-foreground">{"\u6700\u8fd1\u540c\u6b65\u5b8c\u6210\uff1a" + (source.syncedAt ? formatDataTime(source.syncedAt) : "\u65e0\u540c\u6b65\u6267\u884c\u8bb0\u5f55")}</dd>
              <dd className="break-all font-mono text-muted-foreground">{source.version}</dd>
            </dl>)}
            <StatusBadge tone="neutral" size="sm" className="self-start">{"\u56fa\u5b9a\u5408\u6210\u6765\u6e90"}</StatusBadge>
            <p className="text-muted-foreground">{"\u5f53\u524d\u6765\u6e90\u6ca1\u6709\u53ef\u8ffd\u52a0\u7684\u4e0a\u6e38\u6279\u6b21\uff0c\u4e0d\u4f1a\u7528\u672c\u673a\u65f6\u95f4\u63a8\u8fdb\u6570\u636e\u622a\u81f3\u3002"}</p>
          </div>
        </details>
        <DialogFooter><Button asChild variant="ghost"><a href="/operations/data-updates">{"\u4efb\u52a1\u8bb0\u5f55"}</a></Button><Button variant="outline" disabled={checking} onClick={() => setRetry(n => n + 1)}>{error ? "\u91cd\u8bd5\u68c0\u67e5" : "\u91cd\u65b0\u68c0\u67e5"}</Button><Button onClick={() => setOpen(false)}>{"\u5b8c\u6210"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </UpdateContext.Provider>;
}
