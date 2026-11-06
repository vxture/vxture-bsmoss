import { reportLabels } from "../domains/reports/display";
import { StatusBadge } from "@vxture/design-system";
import type { MappingImpacts } from "../domains/management/mapping-impact-contracts";
const grains: Record<string, string> = { "5m": "5\u5206\u949f", "15m": "15\u5206\u949f", hour: "\u5c0f\u65f6", day: "\u65e5", week: "\u5468", month: "\u6708" };
export default function MappingImpactView({ evidence: e }: { evidence: MappingImpacts }) {
  return <section aria-label={"\u4e0b\u6e38\u4f9d\u8d56"} className="flex min-w-0 flex-col gap-md border-t border-dashed border-border pt-lg">
    <h4 className="text-label font-medium">{"\u4e0b\u6e38\u4f9d\u8d56"}</h4>
    <p className="text-body-small text-muted-foreground">{"\u4ec5\u67e5\u6388\u6743\u8303\u56f4\u5185\u3001\u660e\u786e\u5f15\u7528\u8be5\u6620\u5c04\u7684\u5f53\u524d\u805a\u5408\u7248\u672c\u548c\u5f53\u524d\u751f\u6210\u62a5\u544a\u7248\u672c\uff0c\u5404\u5c55\u793a\u6700\u8fd120\u6761\u3002\u5386\u53f2\u7248\u672c\u3001\u672a\u53d1\u5e03\u805a\u5408\u53ca\u6f5c\u5728\u65b0\u589e\u4f9d\u8d56\u672a\u8986\u76d6\uff1b\u65e0\u8bb0\u5f55\u4e0d\u4ee3\u8868\u5168\u5c40\u65e0\u5f71\u54cd\u3002"}</p>
    {(["aggregates", "reports"] as const).map(k => {
      const p = e[k], title = k === "aggregates" ? "\u5173\u8054\u805a\u5408" : "\u5173\u8054\u62a5\u544a";
      return <div key={k} className="min-w-0">{p.status === "not_authorized" ? <div className="flex flex-wrap items-center gap-sm"><span className="text-body-small">{title}</span><StatusBadge tone="neutral">{"\u672a\u8bc4\u4f30"}</StatusBadge><p className="text-body-small text-muted-foreground">{"\u9700\u8981\u72ec\u7acb\u67e5\u770b\u6743\u9650\u53ca\u6620\u5c04\u5b8c\u6574\u8303\u56f4\u6388\u6743\u3002"}</p></div> :
        <details className="min-w-0"><summary className="cursor-pointer text-body-small">{title + " \u00b7 \u5df2\u5c55\u793a " + p.items.length + (p.hasMore ? " \u00b7 \u5c1a\u6709\u66f4\u591a" : "")}</summary>
          {!p.items.length && <p className="mt-md text-body-small text-muted-foreground">{"\u6388\u6743\u8303\u56f4\u5185\u672a\u67e5\u5230\u660e\u786e\u5f15\u7528\uff0c\u4ecd\u9700\u590d\u6838\u5b8c\u6574\u5f71\u54cd\u3002"}</p>}
          <ul className="mt-md flex min-w-0 flex-col gap-md">{p.items.map(r => <li key={r.id} className="flex min-w-0 flex-col gap-xs text-body-small">
            <span className="break-all">{"title" in r ? r.title : reportLabels[r.metricKey.split("@")[0]!] ?? r.metricKey}</span>
            {"metricKey" in r && <span className="break-all text-muted-foreground">{r.metricKey}</span>}
            <span className="break-all text-muted-foreground">{"\u8bb0\u5f55\u6807\u8bc6 " + r.id}</span>
            <span className="flex flex-wrap gap-x-md gap-y-xs text-muted-foreground"><span className="whitespace-nowrap">{"v" + r.revision}</span><span>{grains[r.grain] ?? r.grain}</span></span>
            <span className="text-muted-foreground">{"\u5206\u6790\u533a\u95f4\uff08UTC\uff09"}</span>
            <span className="flex flex-wrap items-center gap-x-sm gap-y-xs text-muted-foreground"><time className="whitespace-nowrap" dateTime={r.period.start}>{r.period.start.replace("T", " ").replace("Z", "")}</time><span>{"\u2192"}</span><time className="whitespace-nowrap" dateTime={r.period.end}>{r.period.end.replace("T", " ").replace("Z", "")}</time></span>
          </li>)}</ul>
        </details>}</div>;
    })}
    <p className="text-body-small text-muted-foreground">{"\u4ee5\u4e0a\u4e3a\u9700\u8981\u590d\u6838\u7684\u5173\u8054\u8bb0\u5f55\uff0c\u4e0d\u662f\u5b8c\u6574\u91cd\u7b97\u6e05\u5355\u3002\u539f\u805a\u5408\u548c\u62a5\u544a\u4fdd\u6301\u539f\u7248\u672c\uff1b\u672c\u6b21\u672a\u6807\u8bb0\u5931\u6548\u3001\u91cd\u7b97\u6216\u91cd\u65b0\u751f\u6210\u3002"}</p>
  </section>;
}
