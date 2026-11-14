"use client";
import { ShellPageContainer, Button, Input, PanelCard, Textarea, EmptyState } from "@vxture/design-system";
import PageHeading from "../../portal/page-heading";
import "../../site-analysis/site-analysis.css";
import { useRef, useState } from "react";
import type { TemplateCandidate, TemplatePreview, TemplateRead, TemplatePublicationCommand, TemplateSelectionCommand } from "../../domains/views/templates";
import type { TemplatePublicationReceipt, TemplateSelectionReceipt } from "../../domains/views/template-store";
import { reportLabels, reportTime } from "../../domains/reports/display";
import TemplateEditor from "./editor";
import { editableTemplate, newTemplate } from "./editor-model";

type Pending = { kind: "publish"; command: TemplatePublicationCommand } | { kind: "select"; command: TemplateSelectionCommand };
const text = {
  title: "\u6a21\u677f\u914d\u7f6e", intro: "\u5148\u6821\u9a8c\u914d\u7f6e\uff0c\u518d\u53d1\u5e03\u7248\u672c\u3002\u9ed8\u8ba4\u7248\u672c\u5207\u6362\u5355\u72ec\u7559\u75d5\u3002",
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
  return <ShellPageContainer className="site-analysis-page gap-lg">
    <PageHeading icon="stack" title={text.title} description={text.intro}/>
    <PanelCard className="text-foreground" title={"\u6a21\u677f\u7248\u672c"} icon="stack">
      <form className="site-analysis-action-row" onSubmit={event=>{event.preventDefault();if(code&&!locked)void load();}}>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-xs">
          <Input className="h-control-xl min-w-0 flex-1 text-body" aria-label={text.code} placeholder={text.code} value={code} disabled={locked} maxLength={200} onChange={event=>{setCode(event.target.value);setLoaded(null);clearValidation();}}/>
          <Input className="h-control-xl w-auto text-body" aria-label={text.version} placeholder={text.version} value={version} disabled={locked} inputMode="numeric" onChange={event=>{setVersion(event.target.value);setLoaded(null);clearValidation();}}/>
          <Button type="submit" className="h-control-xl text-body" variant="outline" disabled={locked||!code}>{text.load}</Button>
        </div>
      </form>
      {loaded&&<div className="flex min-w-0 flex-wrap items-center justify-between gap-md text-body-small">
        {loaded.template&&<p className="break-all">{loaded.template.code+" v"+loaded.template.version+" \u00b7 "+loaded.template.publishedBy+" \u00b7 "+reportTime(loaded.template.publishedAt)}</p>}
        <p className="text-muted-foreground">{text.current+"\uff1a"+(loaded.selection?loaded.selection.code+" v"+loaded.selection.version:text.noSelection)}</p>
      </div>}
      {error&&<p className="text-body-small text-danger-text" role="alert">{error}</p>}{notice&&<p className="text-body-small text-success-text" role="status">{notice}</p>}
      {pending&&<div className="flex min-w-0 flex-wrap items-center gap-xs"><span className="break-all text-body-small text-muted-foreground">{pending.command.commandId}</span><Button className="h-control-xl text-body" variant="outline" disabled={busy} onClick={()=>void execute(pending)}>{text.retry}</Button></div>}
      {receipt&&<details className="min-w-0 text-body-small"><summary className="cursor-pointer">{text.evidence}</summary><pre className="overflow-x-auto whitespace-pre-wrap break-all">{JSON.stringify(receipt,null,2)}</pre></details>}
      {!loaded&&!pending&&!error&&<EmptyState title={"\u8bfb\u53d6\u6a21\u677f\u540e\u7f16\u8f91"} description={"\u8f93\u5165\u7f16\u7801\uff0c\u7248\u672c\u7559\u7a7a\u65f6\u8bfb\u53d6\u6700\u65b0\u7248\u672c"}/>}
    </PanelCard>
    {loaded&&<div className="grid min-w-0 items-start gap-lg xl:grid-cols-2">
      <PanelCard className="text-foreground" title={text.draft} icon="edit">
        {!loaded.template&&<div className="site-analysis-action-row"><div className="flex flex-wrap items-center gap-xs"><Button className="h-control-xl text-body" variant="outline" disabled={locked} onClick={()=>changeDraft(newTemplate("page"))}>{"\u65b0\u5efa\u9875\u9762\u8349\u7a3f"}</Button><Button className="h-control-xl text-body" variant="outline" disabled={locked} onClick={()=>changeDraft(newTemplate("report"))}>{"\u65b0\u5efa\u62a5\u544a\u8349\u7a3f"}</Button></div></div>}
        {editable&&<TemplateEditor candidate={editable} disabled={locked} onChange={changeDraft}/>}
        {draft&&!editable&&<p className="text-body-small text-danger-text" role="status">{"\u8349\u7a3f\u7ed3\u6784\u65e0\u6cd5\u663e\u793a\u4e3a\u8868\u5355\uff0c\u8bf7\u4fee\u590d JSON \u6216\u91cd\u65b0\u8bfb\u53d6\u3002\u539f\u6587\u5df2\u4fdd\u7559\u3002"}</p>}
        <details className="min-w-0 text-body-small" open={!!draft&&!editable||undefined}><summary className="cursor-pointer text-muted-foreground">{"\u9ad8\u7ea7 JSON \u7f16\u8f91"}</summary><label className="mt-md flex min-w-0 flex-col gap-xs">{text.draft}<Textarea className="min-h-media-lg font-mono text-body" rows={16} aria-label={text.draft} value={draft} disabled={locked} spellCheck={false} onChange={event=>{setDraft(event.target.value);clearValidation();}}/></label></details>
        <div className="site-analysis-action-row"><span className="text-body-small text-muted-foreground">{"\u4fee\u6539\u540e\u9700\u91cd\u65b0\u6821\u9a8c"}</span><Button className="h-control-xl text-body" disabled={locked||!draft} onClick={()=>void validate()}>{busy?text.busy:text.validate}</Button></div>
      </PanelCard>
      <PanelCard className="text-foreground" title={text.preview} icon="list-checks">
        <p className="text-body-small text-muted-foreground">{text.configurationOnly}</p>
        {preview&&candidate?<>
          <h3 className="break-words text-body font-medium">{candidate.definition.title}</h3>
          <p className="text-body-small text-muted-foreground">{(candidate.kind==="page"?"\u9875\u9762":"\u62a5\u544a")+" \u00b7 "+candidate.definition.panels.length+" \u4e2a\u9762\u677f \u00b7 "+preview.requiredScope.stationIds.length+" \u7ad9\u5740 \u00b7 "+preview.requiredScope.deviceIds.length+" \u8bbe\u5907"}</p>
          <div className="flex min-w-0 flex-col divide-y divide-border">{candidate.definition.panels.map(panel=><article className="flex min-w-0 flex-col gap-xs py-md" key={panel.id}><p className="text-body font-medium">{reportLabels[panel.metricRef.code]??panel.metricRef.code}<span className="ml-xs text-body-small font-normal text-muted-foreground">{reportLabels[panel.category]}</span></p><span className="break-all text-body-small text-muted-foreground">{panel.id+" / "+panel.metricRef.code+" @"+panel.metricRef.version}</span><span className="text-body-small text-muted-foreground">{panel.grain+" / "+panel.view+" / "+panel.displayUnit+" / "+(panel.visible?text.visible:text.hidden)}</span></article>)}</div>
          <details className="min-w-0 text-body-small"><summary className="cursor-pointer text-muted-foreground">{text.evidence}</summary><pre className="overflow-x-auto whitespace-pre-wrap break-all">{JSON.stringify(preview,null,2)}</pre></details>
          <label className="flex min-w-0 flex-col gap-xs text-body">{text.review}<Input className="h-control-xl text-body" disabled={locked} maxLength={200} value={review} onChange={event=>setReview(event.target.value)}/></label>
          <div className="site-analysis-action-row"><div className="flex flex-wrap items-center gap-xs"><Button className="h-control-xl text-body" disabled={locked||!review.trim()} onClick={publish}>{text.publish}</Button><Button className="h-control-xl text-body" variant="outline" disabled={locked||!review.trim()||!unchanged||candidate.kind!=="page"} onClick={select}>{text.select}</Button></div></div>
        </>:<p className="text-body-small text-muted-foreground">{"\u6821\u9a8c\u901a\u8fc7\u540e\u663e\u793a\u9762\u677f\u4e0e\u6388\u6743\u8303\u56f4"}</p>}
      </PanelCard>
    </div>}
  </ShellPageContainer>;
}
