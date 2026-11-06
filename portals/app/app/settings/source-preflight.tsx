"use client";
import SourceIntakeImpactView from "./source-intake-impact";
import { useEffect, useRef, useState } from "react";
import { Button, Input, NativeSelect, StatusBadge, Textarea } from "@vxture/design-system";
import type { SourceRecord } from "../domains/management/source-rules";
import type { SourcePreflight } from "../domains/management/source-preflight-rules";
const dimensions = ["stationIds", "serviceIds", "deviceIds", "metricKeys"] as const;
const names = { stationIds: "\u7ad9\u5740", serviceIds: "\u670d\u52a1", deviceIds: "\u8bbe\u5907", metricKeys: "\u6307\u6807" };
export default function SourcePreflightForm({ record: r, onForbidden }: { record: SourceRecord; onForbidden(): void }) {
  const [open, setOpen] = useState(false), [status, setStatus] = useState(r.status), [adapter, setAdapter] = useState(r.adapterVersion);
  const [transform, setTransform] = useState(r.transformVersion), [start, setStart] = useState(r.binding.coverageStart), [allow, setAllow] = useState(r.binding.scope.allowSiteParameters);
  const [ids, setIds] = useState(Object.fromEntries(dimensions.map(k => [k, r.binding.scope[k].join("\n")])) as Record<typeof dimensions[number], string>);
  const [reference, setReference] = useState(""), [sha256, setSha256] = useState("");
  const [result, setResult] = useState<SourcePreflight | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  const next = (BigInt(r.revision) + 1n).toString();
  function invalidate() { active.current?.abort(); setResult(null); setError(""); setBusy(false); }
  async function preview(e: React.FormEvent) {
    e.preventDefault(); invalidate();
    const scope = { ...Object.fromEntries(dimensions.map(k => [k, ids[k].split("\n").map(s => s.trim()).filter(Boolean)])), allowSiteParameters: allow };
    const body = JSON.stringify({ expected: { revision: r.revision, digest: r.digest }, proposed: { revision: next, status, adapterVersion: adapter, transformVersion: transform, coverageStart: start, scope }, basis: { reference, sha256 } });
    if (new TextEncoder().encode(body).length > 65536) { setError("\u8349\u6848\u8d85\u8fc764 KiB\uff0c\u8bf7\u7f29\u5c0f\u672c\u6b21\u8c03\u6574\u8303\u56f4\u3002"); return; }
    const controller = new AbortController(); active.current = controller; setBusy(true);
    try {
      const response = await fetch("/api/management/source-configurations/" + encodeURIComponent(r.id) + "/preflight", { method: "POST", cache: "no-store", signal: controller.signal, headers: { "content-type": "application/json" }, body });
      if (controller.signal.aborted) return;
      if ([401, 403].includes(response.status)) { onForbidden(); return; }
      if (!response.ok) {
        setError(response.status === 409 ? "\u5f53\u524d\u7248\u672c\u5df2\u53d8\u5316\uff0c\u8bf7\u5173\u95ed\u8be6\u60c5\u5e76\u91cd\u65b0\u8bfb\u53d6\u3002" : response.status === 400 ? "\u8bf7\u6838\u5bf9\u8f93\u5165\uff1b\u81f3\u5c11\u8c03\u6574\u4e00\u9879\u914d\u7f6e\uff0c\u8d77\u70b9\u987b\u4e3aUTC\u6574\u70b9\uff0c\u8303\u56f4\u4e0d\u53ef\u91cd\u590d\u6216\u4e3a\u7a7a\u7ad9\u5740\uff0f\u6307\u6807\u3002" : response.status === 404 ? "\u8be5\u6765\u6e90\u914d\u7f6e\u5f53\u524d\u4e0d\u53ef\u9884\u68c0\uff0c\u8bf7\u91cd\u65b0\u8bfb\u53d6\u3002" : response.status === 413 ? "\u8349\u6848\u8d85\u8fc764 KiB\uff0c\u8bf7\u7f29\u5c0f\u672c\u6b21\u8c03\u6574\u8303\u56f4\u3002" : "\u9884\u68c0\u6682\u4e0d\u53ef\u7528\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002"); return;
      }
      const data = await response.json() as SourcePreflight;
      if (!controller.signal.aborted) setResult(data);
    } catch { if (!controller.signal.aborted) setError("\u9884\u68c0\u6682\u4e0d\u53ef\u7528\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002"); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  const field = (label: string, value: string, update: (v: string) => void, maxLength = 2048) => <label className="flex min-w-0 flex-col gap-sm text-body-small"><span>{label}</span><Input value={value} required maxLength={maxLength} onChange={e => { invalidate(); update(e.target.value); }} /></label>;
  const facts = result ? [
    ["\u767b\u8bb0\u7248\u672c", "v" + result.before.revision, "v" + result.proposed.binding.revision],
    ["\u767b\u8bb0\u72b6\u6001", result.before.status === "active" ? "\u767b\u8bb0\u542f\u7528" : "\u767b\u8bb0\u6682\u505c", result.proposed.status === "active" ? "\u767b\u8bb0\u542f\u7528" : "\u767b\u8bb0\u6682\u505c"],
    ["\u9002\u914d\u7248\u672c", result.before.adapterVersion, result.proposed.binding.adapterVersion],
    ["\u8f6c\u6362\u7248\u672c", result.before.transformVersion, result.proposed.binding.transformVersion],
    ["\u8986\u76d6\u8d77\u70b9\uff08UTC\uff09", result.before.binding.coverageStart, result.proposed.binding.coverageStart],
    ["\u7269\u7406\u7ad9\u5740\u53c2\u6570", result.before.binding.scope.allowSiteParameters ? "\u5141\u8bb8" : "\u672a\u6388\u6743", result.proposed.binding.scope.allowSiteParameters ? "\u5141\u8bb8" : "\u672a\u6388\u6743"],
  ] : [];
  return <section className="flex min-w-0 flex-col gap-lg border-t border-dashed border-border pt-lg">
    <div className="flex flex-wrap items-center justify-between gap-md"><h3 className="text-label font-medium">{"\u53d8\u66f4\u9884\u68c0"}</h3><Button variant="outline" aria-expanded={open} onClick={() => { invalidate(); setOpen(!open); }}>{open ? "\u6536\u8d77\u9884\u68c0" : "\u9884\u68c0\u914d\u7f6e"}</Button></div>
    <p className="text-body-small text-muted-foreground">{"\u8c03\u6574\u72b6\u6001\u3001\u7248\u672c\u3001\u8986\u76d6\u8d77\u70b9\u4e0e\u6570\u636e\u8303\u56f4\u3002\u914d\u7f6e\u6807\u8bc6\u548c\u6765\u6e90\u8eab\u4efd\u4fdd\u6301\u56fa\u5b9a\uff1b\u9700\u8981\u72ec\u7acb\u9884\u68c0\u6743\u9650\u3002\u7ed3\u679c\u4e0d\u4fdd\u5b58\u3001\u4e0d\u5ba1\u6279\u3001\u4e0d\u751f\u6548\u3002"}</p>
    {open && <><form onSubmit={preview} autoComplete="off" aria-label={"\u6765\u6e90\u914d\u7f6e\u53d8\u66f4\u9884\u68c0"} className="flex min-w-0 flex-col gap-lg">
      <p className="break-all text-body-small text-muted-foreground">{"\u767b\u8bb0\u7248\u672c v" + r.revision + " \u2192 v" + next}</p>
      <div className="grid min-w-0 gap-lg sm:grid-cols-2">
        <label className="flex min-w-0 flex-col gap-sm text-body-small"><span>{"\u62df\u767b\u8bb0\u72b6\u6001"}</span><NativeSelect aria-label={"\u62df\u767b\u8bb0\u72b6\u6001"} value={status} onChange={e => { invalidate(); setStatus(e.target.value as "active" | "paused"); }}><option value="active">{"\u767b\u8bb0\u542f\u7528"}</option><option value="paused">{"\u767b\u8bb0\u6682\u505c"}</option></NativeSelect></label>
        {field("\u62df\u9002\u914d\u7248\u672c", adapter, setAdapter)}
        {field("\u62df\u8f6c\u6362\u7248\u672c", transform, setTransform)}
        {field("\u62df\u8986\u76d6\u8d77\u70b9\uff08UTC\u6574\u70b9\uff09", start, setStart, 24)}
      </div>
      <p className="text-body-small text-muted-foreground">{"\u8d77\u70b9\u683c\u5f0f\uff1a2026-01-01T00:00:00.000Z\u3002\u8986\u76d6\u8d77\u70b9\u4e0d\u4ee3\u8868\u5df2\u63a5\u6536\u6216\u5df2\u53ef\u5206\u6790\u65f6\u95f4\u3002"}</p>
      <details className="min-w-0"><summary className="cursor-pointer text-label font-medium">{"\u8c03\u6574\u6570\u636e\u8303\u56f4"}</summary><div className="mt-lg flex min-w-0 flex-col gap-lg">
        <p className="text-body-small text-muted-foreground">{"\u6bcf\u884c\u4e00\u4e2a\u5b8c\u6574\u6807\u8bc6\uff1b\u6307\u6807\u4f7f\u7528 code@version\u3002\u6240\u6709\u539f\u3001\u65b0\u8303\u56f4\u5fc5\u987b\u5728\u60a8\u7684\u6388\u6743\u5185\uff0c\u670d\u52a1\u548c\u8bbe\u5907\u5fc5\u987b\u5f52\u5c5e\u62df\u914d\u7f6e\u7684\u7ad9\u5740\u3002"}</p>
        {dimensions.map(k => <label key={k} className="flex min-w-0 flex-col gap-sm text-body-small"><span>{names[k] + "\u6807\u8bc6\uff08\u6bcf\u884c\u4e00\u4e2a\uff09"}</span><Textarea aria-label={names[k] + "\u6807\u8bc6\uff08\u6bcf\u884c\u4e00\u4e2a\uff09"} rows={3} value={ids[k]} onChange={e => { invalidate(); setIds(v => ({ ...v, [k]: e.target.value })); }} /></label>)}
        <label className="flex min-w-0 flex-col gap-sm text-body-small"><span>{"\u7269\u7406\u7ad9\u5740\u53c2\u6570"}</span><NativeSelect aria-label={"\u7269\u7406\u7ad9\u5740\u53c2\u6570"} value={String(allow)} onChange={e => { invalidate(); setAllow(e.target.value === "true"); }}><option value="false">{"\u672a\u6388\u6743"}</option><option value="true">{"\u5141\u8bb8"}</option></NativeSelect></label>
      </div></details>
      {field("\u53d8\u66f4\u4f9d\u636e\u5f15\u7528", reference, setReference)}
      {field("\u4f9d\u636e\u539f\u4ef6 SHA-256", sha256, setSha256, 64)}
      <p className="text-body-small text-muted-foreground">{"\u4f9d\u636e\u4e0e\u6458\u8981\u4ec5\u4f5c\u672c\u6b21\u58f0\u660e\uff0c\u672a\u9a8c\u771f\u3001\u672a\u6279\u51c6\u3002\u5173\u95ed\u8be6\u60c5\u5373\u6e05\u9664\u8349\u6848\uff0c\u4e0d\u5199\u5165\u914d\u7f6e\u5e93\u6216\u6d4f\u89c8\u5668\u5b58\u50a8\u3002"}</p>
      <Button type="submit" className="self-start" disabled={busy || next.length > 30}>{busy ? "\u6b63\u5728\u9884\u68c0" : "\u6267\u884c\u9884\u68c0"}</Button>
      {next.length > 30 && <p role="alert" className="text-body-small text-danger-text">{"\u767b\u8bb0\u7248\u672c\u5df2\u8fbe\u4e0a\u9650\uff0c\u9700\u8981\u53d7\u5ba1\u5904\u7406\u3002"}</p>}
    </form>{error && <p role="alert" className="text-body-small text-danger-text">{error}</p>}
    {result && <div role="status" className="flex min-w-0 flex-col gap-lg rounded-lg border border-border p-lg">
      <StatusBadge tone={result.assessment === "blocked" ? "warning" : "neutral"}>{result.assessment === "blocked" ? "\u53d1\u73b0\u963b\u65ad\u9879" : "\u4ecd\u9700\u590d\u6838"}</StatusBadge>
      <h4 className="text-label font-medium">{"\u914d\u7f6e\u524d\u540e\u5bf9\u6bd4"}</h4>
      <dl className="grid min-w-0 gap-lg">{facts.map(([label, before, after]) => <div key={label} className="min-w-0"><dt className="text-body-small text-muted-foreground">{label}</dt><dd className="break-all text-body-small">{before + " \u2192 " + after}</dd></div>)}</dl>
      <p className="text-body-small">{result.resourceIssues.length ? "\u90e8\u5206\u8d44\u6e90\u4e0d\u5b58\u5728\u3001\u6307\u6807\u672a\u767b\u8bb0\u6216\u670d\u52a1\uff0f\u8bbe\u5907\u672a\u5f52\u5c5e\u62df\u9009\u7ad9\u5740\u3002" : "\u62df\u8303\u56f4\u5185\u8d44\u6e90\u53ca\u5173\u8054\u3001\u6307\u6807\u767b\u8bb0\u5df2\u6838\u5bf9\u3002"}</p>
      {!!result.resourceIssues.length && <ul className="flex min-w-0 flex-col gap-sm">{result.resourceIssues.map(i => <li key={i.dimension + ":" + i.id} className="break-all text-body-small text-danger-text">{names[i.dimension] + "\uff1a" + i.id}</li>)}</ul>}
      <div className="flex min-w-0 flex-col gap-md"><h4 className="text-label font-medium">{"\u6570\u636e\u8303\u56f4\u53d8\u5316"}</h4>{result.scopeChanges.some(c => c.added.length || c.removed.length) ? result.scopeChanges.filter(c => c.added.length || c.removed.length).map(c => <details key={c.dimension} open><summary className="cursor-pointer text-body-small">{names[c.dimension] + " \u00b7 \u65b0\u589e " + c.added.length + " \u00b7 \u79fb\u9664 " + c.removed.length}</summary><ul className="mt-sm flex min-w-0 flex-col gap-xs">{c.added.map(id => <li key={"add:" + id} className="break-all text-body-small">{"\u65b0\u589e " + id}</li>)}{c.removed.map(id => <li key={"remove:" + id} className="break-all text-body-small">{"\u79fb\u9664 " + id}</li>)}</ul></details>) : <p className="text-body-small text-muted-foreground">{"\u7ad9\u5740\u3001\u670d\u52a1\u3001\u8bbe\u5907\u4e0e\u6307\u6807\u6e05\u5355\u672a\u53d8\u5316\u3002"}</p>}</div>
      <p className="text-body-small">{"\u65b0\u4fee\u8ba2\u6458\u8981\u53d8\u5316\uff0c\u65e7\u63a5\u6536\u4f4d\u7f6e\u4e0d\u53ef\u76f4\u63a5\u6cbf\u7528\uff0c\u9700\u53d7\u5ba1\u91cd\u65b0\u57fa\u51c6\u3002\u672c\u6b21\u672a\u79fb\u52a8\u6e38\u6807\u6216\u542f\u52a8\u63a5\u6536\u3002"}</p>
      <p className="text-body-small text-muted-foreground">{result.proposed.status === "paused" ? "\u62df\u767b\u8bb0\u6682\u505c\u4e0d\u4ee3\u8868\u8fdc\u7aef\u8bf7\u6c42\u5df2\u505c\u6b62\uff1b\u65e2\u6709\u4efb\u52a1\u4ecd\u9700\u5355\u72ec\u6838\u67e5\u3002" : "\u62df\u767b\u8bb0\u542f\u7528\u4e0d\u4ee3\u8868\u8fde\u63a5\u6b63\u5e38\u6216\u53ef\u6062\u590d\u63a5\u6536\u3002\u9002\u914d\u517c\u5bb9\u6027\u672a\u9a8c\u8bc1\uff0c\u6765\u6e90\u6307\u6807\u80fd\u529b\u672a\u8bc4\u4f30\u3002"}</p>
      <p className="text-body-small text-muted-foreground">{"\u805a\u5408\u53ca\u62a5\u544a\u5f71\u54cd\u672a\u8bc4\u4f30\uff0c\u4e0d\u4ee3\u8868\u96f6\u5f71\u54cd\u3002\u7ed3\u679c\u4ec5\u5bf9\u672c\u6b21\u8bfb\u53d6\u5feb\u7167\u6709\u6548\uff0c\u4e0d\u4ee3\u8868\u6279\u51c6\u6216\u53ef\u53d1\u5e03\u3002"}</p>
      <SourceIntakeImpactView evidence={result.intake.evidence} />
      <dl><dt className="text-body-small text-muted-foreground">{"\u672c\u6b21\u8349\u6848\u6458\u8981"}</dt><dd className="break-all text-body-small text-muted-foreground">{result.draftDigest}</dd></dl>
    </div>}</>}
  </section>;
}
