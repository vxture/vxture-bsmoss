"use client";
import { useEffect, useRef, useState } from "react";
import { Button, Input, StatusBadge } from "@vxture/design-system";
import type { MappingRecord } from "../domains/management/mapping-rules";
import type { MappingPreflight } from "../domains/management/preflight-rules";
export default function MappingPreflightForm({ record: r, onForbidden }: { record: MappingRecord; onForbidden(): void }) {
  const [open, setOpen] = useState(false), [from, setFrom] = useState(r.validFrom), [to, setTo] = useState(r.validTo);
  const [reference, setReference] = useState(""), [sha256, setSha256] = useState("");
  const [result, setResult] = useState<MappingPreflight | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  const nextVersion = (BigInt(r.version) + 1n).toString();
  function invalidate() { active.current?.abort(); setResult(null); setError(""); setBusy(false); }
  async function preview(e: React.FormEvent) {
    e.preventDefault(); invalidate();
    const controller = new AbortController(); active.current = controller; setBusy(true);
    try {
      const response = await fetch("/api/management/object-mappings/" + encodeURIComponent(r.id) + "/preflight", {
        method: "POST", cache: "no-store", signal: controller.signal, headers: { "content-type": "application/json" },
        body: JSON.stringify({ expected: { version: r.version, validFrom: r.validFrom, validTo: r.validTo },
          proposed: { version: nextVersion, validFrom: from, validTo: to }, basis: { reference, sha256 } }),
      });
      if (controller.signal.aborted) return;
      if ([401, 403].includes(response.status)) { onForbidden(); return; }
      if (!response.ok) {
        setError(response.status === 409 ? "\u5b9a\u4e49\u5df2\u53d8\u66f4\uff0c\u8bf7\u5173\u95ed\u8be6\u60c5\u5e76\u91cd\u65b0\u8bfb\u53d6\u3002" : response.status === 400 ? "\u8bf7\u6838\u5bf9\u6709\u6548\u671f\u3001\u4f9d\u636e\u53ca\u6458\u8981\uff0c\u6709\u6548\u671f\u5e94\u4e0e\u539f\u5b9a\u4e49\u4e0d\u540c\u3002" : response.status === 404 ? "\u8be5\u6620\u5c04\u5f53\u524d\u4e0d\u53ef\u9884\u68c0\uff0c\u8bf7\u91cd\u65b0\u8bfb\u53d6\u3002" : "\u9884\u68c0\u6682\u4e0d\u53ef\u7528\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002"); return;
      }
      const data = await response.json() as MappingPreflight;
      if (!controller.signal.aborted) setResult(data);
    } catch { if (!controller.signal.aborted) setError("\u9884\u68c0\u6682\u4e0d\u53ef\u7528\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002"); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  const field = (label: string, value: string, update: (v: string) => void, maxLength: number) => <label className="flex min-w-0 flex-col gap-sm text-body-small"><span>{label}</span><Input value={value} maxLength={maxLength} required onChange={e => { invalidate(); update(e.target.value); }} /></label>;
  return <section className="flex min-w-0 flex-col gap-lg border-t border-dashed border-border pt-lg">
    <div className="flex flex-wrap items-center justify-between gap-md"><h3 className="text-label font-medium">{"\u53d8\u66f4\u9884\u68c0"}</h3><Button variant="outline" onClick={() => { invalidate(); setOpen(!open); }} aria-expanded={open}>{open ? "\u6536\u8d77\u9884\u68c0" : "\u9884\u68c0\u6709\u6548\u671f"}</Button></div>
    <p className="text-body-small text-muted-foreground">{"\u73b0\u6709\u6620\u5c04\u4ec5\u9884\u68c0\u6709\u6548\u671f\u8c03\u6574\uff0c\u7248\u672c\u6309\u6cbb\u7406\u7b56\u7565\u9012\u589e\u4e00\u4f4d\u3002\u6765\u6e90\u3001\u5916\u90e8\u5bf9\u8c61\u4e0e\u5173\u8054\u76ee\u6807\u4fdd\u6301\u4e0d\u53d8\u3002\u9884\u68c0\u4e0d\u4fdd\u5b58\u6216\u751f\u6548\uff0c\u9700\u8981\u72ec\u7acb\u9884\u68c0\u6743\u9650\u3002"}</p>
    {open && <><form onSubmit={preview} className="flex min-w-0 flex-col gap-lg" aria-label={"\u6620\u5c04\u53d8\u66f4\u9884\u68c0"}>
      <p className="break-all text-body-small text-muted-foreground">{"\u7248\u672c v" + r.version + " \u2192 v" + nextVersion}</p>
      <p className="text-body-small text-muted-foreground">{"\u8f93\u5165UTC\u65f6\u95f4\uff0c\u4fdd\u7559\u516d\u4f4d\u5fae\u79d2\uff1a2026-01-01T00:00:00.000000Z\u3002\u533a\u95f4\u5de6\u95ed\u53f3\u5f00\u3002"}</p>
      {field("\u62df\u8c03\u6574\u8d77\u59cb\uff08UTC\uff09", from, setFrom, 27)}
      {field("\u62df\u8c03\u6574\u7ed3\u675f\uff08UTC\uff09", to, setTo, 27)}
      {field("\u53d8\u66f4\u4f9d\u636e\u5f15\u7528", reference, setReference, 2048)}
      {field("\u4f9d\u636e\u539f\u4ef6 SHA-256", sha256, setSha256, 64)}
      <p className="text-body-small text-muted-foreground">{"\u4f9d\u636e\u4e0e\u6458\u8981\u4ec5\u4f5c\u672c\u6b21\u58f0\u660e\uff0c\u672a\u9a8c\u771f\u3001\u672a\u6279\u51c6\uff0c\u4e0d\u5b58\u5165\u6d4f\u89c8\u5668\u6216\u914d\u7f6e\u5e93\u3002"}</p>
      <Button type="submit" className="self-start" disabled={busy || nextVersion.length > 30}>{busy ? "\u6b63\u5728\u9884\u68c0" : "\u6267\u884c\u9884\u68c0"}</Button>
      {nextVersion.length > 30 && <p role="alert" className="text-body-small text-danger-text">{"\u6620\u5c04\u7248\u672c\u5df2\u8fbe\u4e0a\u9650\uff0c\u9700\u8981\u53d7\u5ba1\u5904\u7406\u3002"}</p>}
    </form>{error && <p role="alert" className="text-body-small text-danger-text">{error}</p>}
    {result && <div role="status" className="flex min-w-0 flex-col gap-lg rounded-lg border border-border p-lg">
      <StatusBadge tone={result.assessment === "blocked" ? "warning" : "neutral"}>{result.assessment === "blocked" ? "\u53d1\u73b0\u963b\u65ad\u9879" : "\u4ecd\u9700\u590d\u6838"}</StatusBadge>
      <dl className="grid min-w-0 gap-lg"><div><dt className="text-body-small text-muted-foreground">{"\u8c03\u6574\u524d\u6709\u6548\u671f"}</dt><dd className="break-all text-body-small">{result.before.validFrom + " \u2192 " + result.before.validTo}</dd></div><div><dt className="text-body-small text-muted-foreground">{"\u62df\u8c03\u6574\u6709\u6548\u671f"}</dt><dd className="break-all text-body-small">{result.proposed.validFrom + " \u2192 " + result.proposed.validTo}</dd></div></dl>
      <p className="text-body-small">{result.checks.authorizedOverlap ? "\u6388\u6743\u8303\u56f4\u5185\u53d1\u73b0\u540c\u4e00\u5916\u90e8\u5bf9\u8c61\u533a\u95f4\u91cd\u53e0\u3002" : "\u6388\u6743\u8303\u56f4\u5185\u672a\u53d1\u73b0\u533a\u95f4\u91cd\u53e0\uff1b\u5168\u5c40\u51b2\u7a81\u672a\u786e\u8ba4\u3002"}</p>
      <p className="text-body-small">{result.checks.serviceCoverage === "uncovered" ? "\u670d\u52a1\u6709\u6548\u671f\u672a\u5b8c\u6574\u8986\u76d6\u62df\u8c03\u6574\u533a\u95f4\u3002" : result.checks.serviceCoverage === "covered" ? "\u670d\u52a1\u6709\u6548\u671f\u5b8c\u6574\u8986\u76d6\u62df\u8c03\u6574\u533a\u95f4\u3002" : "\u4e0d\u6d89\u53ca\u670d\u52a1\u6709\u6548\u671f\u3002"}</p>
      <div className="flex flex-col gap-sm"><h4 className="text-label font-medium">{"\u65f6\u95f4\u8986\u76d6\u53d8\u5316"}</h4>{result.changedWindows.map((w, i) => <p key={i} className="break-all text-body-small">{(w.change === "added" ? "\u6269\u5c55 " : "\u79fb\u9664 ") + w.from + " \u2192 " + w.to}</p>)}</div>
      <p className="text-body-small text-muted-foreground">{"\u805a\u5408\u3001\u62a5\u544a\u4e0e\u63a5\u6536\u4efb\u52a1\u5f71\u54cd\u672a\u8bc4\u4f30\uff0c\u4e0d\u4ee3\u8868\u96f6\u5f71\u54cd\u3002\u7248\u672c\u53d8\u5316\u53ef\u80fd\u5f71\u54cd\u6574\u4e2a\u539f\u65b0\u533a\u95f4\u7684\u4f9d\u8d56\uff1b\u4e0a\u8ff0\u65f6\u95f4\u8986\u76d6\u53d8\u5316\u4e0d\u662f\u5b8c\u6574\u91cd\u7b97\u8303\u56f4\u3002\u7ed3\u679c\u4ec5\u5bf9\u672c\u6b21\u8bfb\u53d6\u5feb\u7167\u6709\u6548\uff0c\u4e0d\u4ee3\u8868\u5ba1\u6279\u6216\u53ef\u4ee5\u53d1\u5e03\u3002"}</p>
      <dl><dt className="text-body-small text-muted-foreground">{"\u672c\u6b21\u8349\u6848\u6458\u8981"}</dt><dd className="break-all text-body-small text-muted-foreground">{result.draftDigest}</dd></dl>
    </div>}</>}
  </section>;
}
