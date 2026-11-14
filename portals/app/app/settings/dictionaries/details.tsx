import type { MetricDefinition } from "../../domains/catalog/registry";
import { refKey } from "../../domains/catalog/registry";
import type { ParameterDefinition } from "../../domains/business-parameters/catalog";
import { reportLabels } from "../../domains/reports/display";
import { classificationGroups, metricUnit, word } from "./model";
export function ClassificationDetail({ definition: d }: { definition: ParameterDefinition }) {
  return <div className="flex min-w-0 flex-col gap-lg">
    <p className="text-body">{d.summary}</p>
    <dl className="grid min-w-0 gap-lg md:grid-cols-2">{[["\u5b9a\u4e49\u7f16\u7801", d.code], ["\u5b9a\u4e49\u7248\u672c", d.version], ["\u6240\u5c5e\u5206\u7c7b", classificationGroups[d.group]], ...d.facts.filter(([label]) => label !== "\u5206\u7c7b\u7ef4\u5ea6")].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-body-small text-muted-foreground">{label}</dt><dd className="break-words text-body">{value}</dd></div>)}</dl>
    <div className="border-t border-dashed border-border pt-lg"><h3 className="text-label font-medium">{"\u9002\u7528\u529f\u80fd"}</h3><p className="mt-sm text-body-small">{d.applies.join("\u3001")}</p></div>
    <div className="border-t border-dashed border-border pt-lg"><h3 className="text-label font-medium">{"\u4f7f\u7528\u8fb9\u754c"}</h3><ul className="mt-sm flex list-disc flex-col gap-md pl-lg text-body-small">{d.boundaries.map(b => <li key={b}>{b}</li>)}</ul></div>
  </div>;
}

export function MetricDetail({ metric: m }: { metric: Readonly<MetricDefinition> }) {
 const facts = [
  ["\u6307\u6807\u7f16\u7801", m.code], ["\u5b9a\u4e49\u7248\u672c", "v" + m.version], ["\u6307\u6807\u5206\u7c7b", reportLabels[m.category]],
  ["\u8ba1\u91cf\u5bf9\u8c61", word(m.object)], ["\u5f52\u5c5e\u7ef4\u5ea6", word(m.attribution)], ["\u8ba1\u91cf\u8bed\u4e49", word(m.semantic === "state" ? "state_semantic" : m.semantic)],
  ["\u65f6\u95f4\u805a\u5408", word(m.timeAggregation)], ["\u5bf9\u8c61\u6c47\u603b", word(m.objectAggregation)],
  ["\u53ef\u7528\u7c92\u5ea6", m.grains.map(word).join(" / ")], ["\u663e\u793a\u5355\u4f4d", m.displayUnits.map(unit => metricUnit(m, unit)).join(" / ")],
 ];
 return <div className="min-w-0">
  <div className="flex flex-col gap-lg">
   <dl className="grid min-w-0 gap-lg md:grid-cols-2">{facts.map(([label,value]) => <div key={label} className="min-w-0"><dt className="text-body-small text-muted-foreground">{label}</dt><dd className="break-words text-body">{value}</dd></div>)}</dl>
   <div className="border-t border-dashed border-border pt-lg"><h3 className="text-label font-medium">{"\u4f9d\u8d56\u6307\u6807"}</h3>
    {m.dependencies.length ? <ul className="mt-sm flex flex-col gap-sm">{m.dependencies.map(d => <li key={refKey(d)} className="text-body-small">{reportLabels[d.code]}{" \u00b7 v" + d.version}<span className="block break-all text-muted-foreground">{d.code}</span></li>)}</ul> : <p className="mt-sm text-body-small text-muted-foreground">{"\u65e0\u5b57\u5178\u5185\u6d3e\u751f\u4f9d\u8d56\uff1b\u91c7\u96c6\u5b57\u6bb5\u4e0e\u6620\u5c04\u6309\u6765\u6e90\u914d\u7f6e\u6838\u9a8c\u3002"}</p>}
   </div>
   {m.code === "runtime.energy.site_wh" && <p className="text-body-small text-muted-foreground">{"\u7269\u7406\u7ad9\u5740\u7535\u8017\u6309\u7535\u8868\u5f52\u5c5e\u6c47\u603b\uff0c\u4e0d\u6309\u8fd0\u8425\u5546\u91cd\u590d\u5206\u644a\u3002"}</p>}
  </div>
 </div>;
}
