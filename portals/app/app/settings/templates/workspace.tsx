"use client";
import { useRef, useState } from "react";
import type { TemplateCandidate, TemplatePreview, TemplateRead, TemplatePublicationCommand, TemplateSelectionCommand } from "../../domains/views/templates";
import type { TemplatePublicationReceipt, TemplateSelectionReceipt } from "../../domains/views/template-store";
import { reportLabels, reportTime } from "../../domains/reports/display";
import TemplateEditor from "./editor";
import { editableTemplate, newTemplate } from "./editor-model";

type Pending = { kind: "publish"; command: TemplatePublicationCommand } | { kind: "select"; command: TemplateSelectionCommand };
const text = {
  title: "\u6a21\u677f\u7ba1\u7406", intro: "\u5148\u6821\u9a8c\u914d\u7f6e\uff0c\u518d\u53d1\u5e03\u7248\u672c\u3002\u9ed8\u8ba4\u7248\u672c\u5207\u6362\u5355\u72ec\u7559\u75d5\u3002",
  code: "\u6a21\u677f\u7f16\u7801", version: "\u7248\u672c\uff08\u7559\u7a7a\u8bfb\u6700\u65b0\uff09", load: "\u8bfb\u53d6\u7248\u672c", draft: "\u914d\u7f6e\u8349\u7a3f", validate: "\u6821\u9a8c\u914d\u7f6e",
  review: "\u5ba1\u9605\u4f9d\u636e", publish: "\u53d1\u5e03\u65b0\u7248\u672c", select: "\u8bbe\u4e3a\u5206\u6790\u9ed8\u8ba4", retry: "\u91cd\u8bd5\u539f\u547d\u4ee4", busy: "\u5904\u7406\u4e2d\u2026",
  invalid: "\u8bf7\u68c0\u67e5\u6a21\u677f JSON \u53ca\u5b57\u6bb5\u3002", unavailable: "\u64cd\u4f5c\u6682\u65f6\u4e0d\u53ef\u7528\uff0c\u53ef\u91cd\u8bd5\u539f\u547d\u4ee4\u3002",
  denied: "\u5f53\u524d\u8d26\u53f7\u6216\u5bf9\u8c61\u8303\u56f4\u65e0\u6743\u9650\uff0c\u8bf7\u91cd\u65b0\u8bfb\u53d6\u3002", changed: "\u914d\u7f6e\u6216\u7248\u672c\u5df2\u53d8\u5316\uff0c\u8bf7\u91cd\u65b0\u8bfb\u53d6\u5e76\u6821\u9a8c\u3002",
  configurationOnly: "\u4ec5\u6821\u9a8c\u914d\u7f6e\u548c\u5bf9\u8c61\u5f52\u5c5e\uff0c\u4e0d\u4ee3\u8868\u6570\u636e\u6e90\u6216\u6570\u636e\u8d28\u91cf\u9a8c\u6536\u3002",
  noTemplate: "\u8be5\u7f16\u7801\u5c1a\u65e0\u5df2\u53d1\u5e03\u7248\u672c\u3002", noSelection: "\u5c1a\u672a\u8bbe\u7f6e\u9ed8\u8ba4\u6a21\u677f", current: "\u5f53\u524d\u9ed8\u8ba4", preview: "\u6821\u9a8c\u7ed3\u679c",
  published: "\u5df2\u53d1\u5e03", selected: "\u5df2\u5207\u6362", historic: "\u5386\u53f2\u547d\u4ee4\u5df2\u786e\u8ba4\uff0c\u5f53\u524d\u9ed8\u8ba4\u5df2\u6709\u540e\u7eed\u5207\u6362",
  reread: "\u7ee7\u7eed\u64cd\u4f5c\u524d\u8bf7\u91cd\u65b0\u8bfb\u53d6\u7248\u672c\u3002", panel: "\u9762\u677f", hidden: "\u9690\u85cf", visible: "\u663e\u793a", evidence: "\u914d\u7f6e\u4f9d\u636e",
};
export default function TemplateWorkspace() {
  const [code, setCode] = useState(""), [version, setVersion] = useState(""), [draft, setDraft] = useState(""), [review, setReview] = useState("");
  const [loaded, setLoaded] = useState<TemplateRead | null>(null), [preview, setPreview] = useState<TemplatePreview | null>(null), [candidate, setCandidate] = useState<TemplateCandidate | null>(null);
  const [pending, setPending] = useState<Pending | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [receipt, setReceipt] = useState<TemplatePublicationReceipt | TemplateSelectionReceipt | null>(null);
  const inFlight = useRef(false);
  const locked = busy || pending !== null;
  const editable = editableTemplate(draft);
  function changeDraft(c: TemplateCandidate) { if (locked) return; setDraft(JSON.stringify(c, null, 2)); clearValidation(); }
  function clearValidation() { setPreview(null); setCandidate(null); setNotice(""); setReceipt(null); }
  async function response(res: Response) {
    if (!res.ok) { const e = Error(res.status === 409 ? text.changed : res.status < 500 ? text.denied : text.unavailable) as Error & { status: number }; e.status = res.status; throw e; }
    return res.json();
  }
  async function load() {
    if (inFlight.current || pending) return; inFlight.current = true;
    setBusy(true); setError(""); setLoaded(null); setReview(""); clearValidation();
    try {
      const params = new URLSearchParams({ code }); if (version) params.set("version", version);
      const r: TemplateRead = await response(await fetch("/api/templates?" + params, { cache: "no-store" }));
      setLoaded(r); setDraft(r.template ? JSON.stringify(r.template.candidate, null, 2) : ""); if (!r.template) setNotice(text.noTemplate);
    } catch (e) { setError(e instanceof Error ? e.message : text.unavailable); } finally { inFlight.current = false; setBusy(false); }
  }
  async function validate() {
    if (inFlight.current || pending) return; inFlight.current = true;
    setBusy(true); setError(""); clearValidation();
    try {
      let c: TemplateCandidate; try { c = JSON.parse(draft); } catch { throw Error(text.invalid); }
      const r: TemplatePreview = await response(await fetch("/api/templates/preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ candidate: c }) }));
      setPreview(r); setCandidate(c);
    } catch (e) { setError(e instanceof Error ? e.message : text.unavailable); } finally { inFlight.current = false; setBusy(false); }
  }
  async function execute(p: Pending) {
    if (inFlight.current) return; inFlight.current = true;
    setPending(p); setBusy(true); setError(""); setNotice("");
    try {
      const r: TemplatePublicationReceipt | TemplateSelectionReceipt = await response(await fetch(p.kind === "publish" ? "/api/templates" : "/api/templates/selection", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(p.command) }));
      const message = "code" in r ? `${text.published} ${r.code} v${r.version}` : `${r.isCurrent ? text.selected : text.historic} ${r.selected.code} v${r.selected.version}`;
      setPending(null); setLoaded(null); setPreview(null); setCandidate(null); setReceipt(r); setNotice(message + ". " + text.reread);
    } catch (e) {
      setError(e instanceof Error ? e.message : text.unavailable);
      if ((e as { status?: number }).status && (e as { status: number }).status < 500) { setPending(null); setLoaded(null); setPreview(null); setCandidate(null); }
    } finally { inFlight.current = false; setBusy(false); }
  }
  function publish() {
    if (!preview || !candidate || !loaded) return;
    void execute({ kind: "publish", command: { commandId: crypto.randomUUID(), templateCode: code, expectedVersion: loaded.template?.version ?? null,
      candidate, candidateSha256: preview.candidateSha256, validationSha256: preview.validationSha256, reviewRef: review } });
  }
  function select() {
    if (!preview || !loaded?.template || !candidate || candidate.kind !== "page") return;
    void execute({ kind: "select", command: { commandId: crypto.randomUUID(), scopeKey: "analysis:default", templateCode: code,
      templateVersion: loaded.template.version, templateSha256: loaded.template.sha256, validationSha256: preview.validationSha256, expected: loaded.selection, reviewRef: review } });
  }
  const unchanged = loaded?.template && candidate && JSON.stringify(loaded.template.candidate) === JSON.stringify(candidate);
  return <div className="templates-workspace product-page-inset"><header><span className="reports-eyebrow">TEMPLATE GOVERNANCE</span><h1>{text.title}</h1><p className="reports-muted">{text.intro}</p></header>
    <section className="templates-reader"><label>{text.code}<input value={code} disabled={locked} maxLength={200} onChange={e => { setCode(e.target.value); setLoaded(null); clearValidation(); }} /></label>
      <label>{text.version}<input value={version} disabled={locked} inputMode="numeric" onChange={e => { setVersion(e.target.value); setLoaded(null); clearValidation(); }} /></label>
      <button disabled={locked || !code} onClick={() => void load()}>{text.load}</button></section>
    {loaded && <div className="templates-current">{loaded.template && <p><b>{loaded.template.code} v{loaded.template.version}</b> / {loaded.template.publishedBy} / {reportTime(loaded.template.publishedAt)}</p>}
      <p>{text.current}: {loaded.selection ? `${loaded.selection.code} v${loaded.selection.version}` : text.noSelection}</p></div>}
    {error && <p className="reports-error" role="alert">{error}</p>}{notice && <p className="reports-notice" role="status">{notice}</p>}
    {pending && !busy && <button onClick={() => void execute(pending)}>{text.retry}</button>}
    {pending && <p className="reports-muted">{pending.command.commandId}</p>}
    {receipt && <details><summary>{text.evidence}</summary><pre>{JSON.stringify(receipt, null, 2)}</pre></details>}
    {loaded && <div className="reports-actions templates-validation-action"><button disabled={locked || !draft} onClick={() => void validate()}>{busy ? text.busy : text.validate}</button></div>}
    <div className="templates-columns"><section>
      {loaded && !loaded.template && <div className="reports-actions"><button disabled={locked} onClick={() => changeDraft(newTemplate("page"))}>{"\u65b0\u5efa\u9875\u9762\u8349\u7a3f"}</button><button disabled={locked} onClick={() => changeDraft(newTemplate("report"))}>{"\u65b0\u5efa\u62a5\u544a\u8349\u7a3f"}</button></div>}
      {loaded && editable && <TemplateEditor candidate={editable} disabled={locked} onChange={changeDraft} />}
      {loaded && draft && !editable && <p className="reports-error" role="status">{"\u8349\u7a3f\u6682\u4e0d\u80fd\u5728\u8868\u5355\u4e2d\u7f16\u8f91\uff0c\u8bf7\u5728\u9ad8\u7ea7 JSON \u4e2d\u4fee\u590d\u7ed3\u6784\u6216\u91cd\u65b0\u8bfb\u53d6\u3002\u539f\u6587\u5df2\u4fdd\u7559\u3002"}</p>}
      <details className="template-json" open={loaded && !!draft && !editable || undefined}><summary>{"\u9ad8\u7ea7 JSON \u7f16\u8f91"}</summary><label>{text.draft}<textarea aria-label={text.draft} value={draft} disabled={locked || !loaded} spellCheck={false} onChange={e => { setDraft(e.target.value); clearValidation(); }} /></label></details>
      </section>
      <section className="templates-preview"><h3>{text.preview}</h3><p className="reports-muted">{text.configurationOnly}</p>
        {preview && candidate && <><h2>{candidate.definition.title}</h2><p className="templates-footprint">{candidate.kind} / {candidate.definition.panels.length} {text.panel} / {preview.requiredScope.stationIds.length} {"\u7ad9\u5740"} / {preview.requiredScope.deviceIds.length} {"\u8bbe\u5907"}</p>
          <div className="templates-panels">{candidate.definition.panels.map(p => <article key={p.id}><b>{reportLabels[p.metricRef.code] ?? p.metricRef.code} <small>{reportLabels[p.category]}</small></b><span>{p.id} / {p.metricRef.code} @{p.metricRef.version}</span><small>{p.grain} / {p.view} / {p.displayUnit} / {p.visible ? text.visible : text.hidden}</small></article>)}</div>
          <details><summary>{text.evidence}</summary><pre>{JSON.stringify(preview, null, 2)}</pre></details>
          <label>{text.review}<input disabled={locked} maxLength={200} value={review} onChange={e => setReview(e.target.value)} /></label>
          <div className="reports-actions"><button disabled={locked || !review.trim()} onClick={publish}>{text.publish}</button>
            <button disabled={locked || !review.trim() || !unchanged || candidate.kind !== "page"} onClick={select}>{text.select}</button></div>
        </>}
      </section></div>
  </div>;
}
