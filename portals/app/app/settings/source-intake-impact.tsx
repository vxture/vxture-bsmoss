import { StatusBadge } from "@vxture/design-system";
import type { SourceIntakeImpact } from "../domains/management/source-intake-impact";
const stateNames = { started: "\u5df2\u542f\u52a8", received: "\u5df2\u63a5\u6536", duplicate: "\u91cd\u590d\u63a5\u6536", current: "\u65e0\u9700\u63a5\u6536", failed: "\u63a5\u6536\u5931\u8d25", terminated: "\u5df2\u7ec8\u6b62" };
export default function SourceIntakeImpactView({ evidence: e }: { evidence: SourceIntakeImpact }) {
  return <section aria-label={"\u63a5\u6536\u5f71\u54cd"} className="flex min-w-0 flex-col gap-md border-t border-dashed border-border pt-lg">
    <h4 className="text-label font-medium">{"\u63a5\u6536\u5f71\u54cd"}</h4>
    {e.status === "not_authorized" ? <p className="text-body-small text-muted-foreground">{"\u672a\u8bc4\u4f30\uff1a\u9700\u8981\u72ec\u7acb\u7684\u63a5\u6536\u5f71\u54cd\u67e5\u770b\u6743\u9650\u53ca\u672c\u7248\u672c\u5b8c\u6574\u6570\u636e\u8303\u56f4\u6388\u6743\u3002"}</p> : <>
      <p className="break-all text-body-small text-muted-foreground">{"\u4ec5\u6838\u67e5\u767b\u8bb0\u7248\u672c v" + e.bindingRevision + "\uff0c\u56de\u6267\u4e0e\u4efb\u52a1\u5404\u5c55\u793a\u6700\u8fd120\u6761\uff1b\u66f4\u591a\u8bb0\u5f55\u3001\u65e9\u671f\u7248\u672c\u53ca\u8de8\u7248\u672c\u6700\u65b0\u63a5\u6536\u4f4d\u7f6e\u9700\u53e6\u884c\u590d\u6838\u3002"}</p>
      <details className="min-w-0"><summary className="cursor-pointer text-body-small">{"\u63a5\u6536\u56de\u6267 \u00b7 \u5df2\u5c55\u793a " + e.receipts.items.length + (e.receipts.hasMore ? " \u00b7 \u5c1a\u6709\u66f4\u591a" : "")}</summary>
        {!e.receipts.items.length && <p className="mt-md text-body-small text-muted-foreground">{"\u672c\u7248\u672c\u672a\u67e5\u5230\u63a5\u6536\u56de\u6267\uff1b\u4e0d\u4ee3\u8868\u5386\u53f2\u672a\u63a5\u6536\u3002"}</p>}
        <ul className="mt-md flex min-w-0 flex-col gap-md">{e.receipts.items.map(r => <li key={r.id} className="flex min-w-0 flex-col gap-xs text-body-small">
          <span className="break-all">{"\u56de\u6267 #" + r.sequence}</span><span className="break-all text-muted-foreground">{"\u8bb0\u5f55\u6807\u8bc6 " + r.id}</span>
          <span className="break-all text-muted-foreground">{"\u63a5\u6536\u533a\u95f4\u622a\u81f3\uff08UTC\uff09" + r.through}</span><span className="text-muted-foreground">{"\u65b0\u589e " + r.inserted + " \u00b7 \u91cd\u590d " + r.duplicates}</span>
        </li>)}</ul>
      </details>
      <details className="min-w-0"><summary className="cursor-pointer text-body-small">{"\u5173\u8054\u4efb\u52a1 \u00b7 \u5df2\u5c55\u793a " + e.tasks.items.length + (e.tasks.hasMore ? " \u00b7 \u5c1a\u6709\u66f4\u591a" : "")}</summary>
        {!e.tasks.items.length && <p className="mt-md text-body-small text-muted-foreground">{"\u672c\u7248\u672c\u672a\u67e5\u5230\u63a5\u6536\u4efb\u52a1\uff1b\u4e0d\u4ee3\u8868\u5386\u53f2\u65e0\u4efb\u52a1\u3002"}</p>}
        <ul className="mt-md flex min-w-0 flex-col gap-md">{e.tasks.items.map(t => <li key={t.id} className="flex min-w-0 flex-col gap-xs text-body-small">
          <div className="flex flex-wrap items-center gap-sm"><StatusBadge tone={t.state === "failed" ? "warning" : "neutral"}>{stateNames[t.state]}</StatusBadge><span className="text-muted-foreground">{"\u4e8b\u4ef6 v" + t.revision + " \u00b7 \u7b2c" + t.attempt + "\u6b21\u5c1d\u8bd5"}</span></div>
          <span className="break-all text-muted-foreground">{"\u4efb\u52a1\u6807\u8bc6 " + t.id}</span>
        </li>)}</ul>
      </details>
      <p className="text-body-small text-muted-foreground">{"\u65b0\u4fee\u8ba2\u9700\u53d7\u5ba1\u91cd\u65b0\u57fa\u51c6\uff0c\u5f53\u524d\u7248\u672c\u4efb\u52a1\u4e0d\u80fd\u76f4\u63a5\u6309\u62df\u914d\u7f6e\u7ee7\u7eed\u3002\u5df2\u5b8c\u6210\u7684\u56de\u6267\u548c\u5386\u53f2\u8bb0\u5f55\u4fdd\u7559\uff1b\u63a5\u6536\u4e2d\u6216\u5931\u8d25\u4efb\u52a1\u9700\u5355\u72ec\u590d\u6838\u3002\u672c\u6b21\u672a\u7ec8\u6b62\u3001\u6062\u590d\u6216\u91cd\u65b0\u6267\u884c\u4efb\u52a1\u3002"}</p>
    </>}
  </section>;
}
