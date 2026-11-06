"use client";
import { useState } from "react";
import { Button, DataTable, Drawer, EmptyState, Icon, InputGroup, InputGroupAddon, InputGroupInput, NativeSelect, ShellPageContainer, StatusBadge } from "@vxture/design-system";
import PageHeading from "../../portal/page-heading";
import { ANALYSIS_RULES, CLASSIFICATIONS, filterDefinitions, type ParameterDefinition } from "../../domains/business-parameters/catalog";

const groups: Record<string, string> = { siteType: "\u7ad9\u70b9\u7c7b\u578b", scene: "\u4e1a\u52a1\u573a\u666f", sharing: "\u5171\u4eab\u65b9\u5f0f", capacity: "\u5bb9\u91cf\u8d28\u91cf", runtime: "\u8fd0\u884c\u80fd\u6548", verification: "\u7528\u91cf\u6838\u9a8c", business: "\u7ecf\u8425\u5206\u6790" };
export default function ParameterCatalog({ kind }: { kind: "classifications" | "rules" }) {
  const rules = kind === "rules", definitions = rules ? ANALYSIS_RULES : CLASSIFICATIONS;
  const [search, setSearch] = useState(""), [group, setGroup] = useState("all"), [selection, setSelection] = useState<string | null>(null);
  const rows = filterDefinitions(definitions, search, group), selected = definitions.find(row => row.id === selection);
  return <ShellPageContainer className="gap-lg">
    <PageHeading title={rules ? "\u5206\u6790\u89c4\u5219" : "\u7ad9\u5740\u5206\u7c7b"}
      description={rules ? "\u67e5\u770b\u5206\u6790\u5224\u5b9a\u53e3\u5f84\u3001\u8ba1\u7b97\u8fb9\u754c\u4e0e\u9002\u7528\u8303\u56f4" : "\u7edf\u4e00\u7ad9\u70b9\u7c7b\u578b\u3001\u4e1a\u52a1\u573a\u666f\u4e0e\u5171\u4eab\u65b9\u5f0f\u7684\u5206\u7c7b\u53e3\u5f84"}
      context={<span>{definitions.length + " \u9879\u5b9a\u4e49 \u00b7 \u53ea\u8bfb\u76ee\u5f55"}</span>}
      toolbar={<div className="flex flex-wrap items-center gap-lg">
        <NativeSelect aria-label={rules ? "\u89c4\u5219\u9886\u57df" : "\u5206\u7c7b\u7ef4\u5ea6"} wrapperClassName="w-auto" value={group} onChange={e => setGroup(e.target.value)}>
          <option value="all">{rules ? "\u5168\u90e8\u9886\u57df" : "\u5168\u90e8\u7ef4\u5ea6"}</option>{[...new Set(definitions.map(r => r.group))].map(g => <option key={g} value={g}>{groups[g]}</option>)}
        </NativeSelect>
        <div className="min-w-0 sm:ml-auto"><InputGroup><InputGroupAddon><Icon name="search" size="sm" /></InputGroupAddon><InputGroupInput aria-label={"\u68c0\u7d22\u5b9a\u4e49"} placeholder={"\u540d\u79f0 / \u7f16\u7801 / \u5173\u952e\u8bcd"} value={search} onChange={e => setSearch(e.target.value)} /></InputGroup></div>
      </div>} />
    <p className="text-body-small text-muted-foreground">{rules ? "\u5f53\u524d\u5185\u7f6e\u57fa\u7ebf\u4e0e\u5206\u6790\u4ee3\u7801\u540c\u6e90\uff1b\u751f\u4ea7\u9608\u503c\u9700\u6388\u6743\u6837\u672c\u56de\u653e\u548c\u4e1a\u52a1\u7b7e\u8ba4\u3002" : "\u5206\u7c7b\u5b57\u5178\u5b9a\u4e49\u7edf\u8ba1\u7ef4\u5ea6\uff1b\u6b63\u5f0f\u8d44\u6e90\u8d4b\u7c7b\u4e0e\u670d\u52a1\u6709\u6548\u671f\u9700\u5355\u72ec\u6838\u9a8c\u3002"}</p>
    <DataTable rows={rows} rowKey={row => row.id} empty={<EmptyState title={"\u6ca1\u6709\u5339\u914d\u5b9a\u4e49"} description={"\u8bf7\u8c03\u6574\u5206\u7c7b\u6216\u68c0\u7d22\u6761\u4ef6"} />}
      columns={[
        { id: "name", header: "\u540d\u79f0", cell: row => <div className="flex flex-col gap-xs"><Button variant="ghost" className="h-auto justify-start px-0 text-left" onClick={() => setSelection(row.id)} aria-expanded={selection === row.id}>{row.name}</Button><span className="text-body-small text-muted-foreground">{row.code}</span></div> },
        { id: "group", header: rules ? "\u89c4\u5219\u9886\u57df" : "\u5206\u7c7b\u7ef4\u5ea6", cell: row => groups[row.group] },
        { id: "summary", header: rules ? "\u5224\u5b9a\u8981\u70b9" : "\u5206\u7c7b\u5b9a\u4e49", cell: row => <span className="whitespace-normal">{row.summary}</span> },
        { id: "status", header: "\u5b9a\u4e49\u72b6\u6001", cell: () => <StatusBadge tone="neutral" size="sm">{rules ? "\u5185\u7f6e\u57fa\u7ebf" : "\u5185\u7f6e\u5b57\u5178"}</StatusBadge> },
      ]} />
    <Drawer open={!!selected} onClose={() => setSelection(null)} title={selected?.name ?? "\u5b9a\u4e49\u8be6\u60c5"} side="right" width="lg" className="max-w-full" closeLabel={"\u5173\u95ed\u8be6\u60c5"}>{selected && <DefinitionDetail definition={selected} />}</Drawer>
  </ShellPageContainer>;
}
function DefinitionDetail({ definition: d }: { definition: ParameterDefinition }) {
  return <div className="flex min-w-0 flex-col gap-lg">
    <p className="text-body">{d.summary}</p>
    <dl className="grid min-w-0 gap-lg md:grid-cols-2">{[["\u5b9a\u4e49\u7f16\u7801", d.code], ["\u5b9a\u4e49\u7248\u672c", d.version], ["\u6240\u5c5e\u5206\u7c7b", groups[d.group]], ...d.facts.filter(([label]) => label !== "\u5206\u7c7b\u7ef4\u5ea6")].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-body-small text-muted-foreground">{label}</dt><dd className="break-words text-body">{value}</dd></div>)}</dl>
    <div className="border-t border-dashed border-border pt-lg"><h3 className="text-label font-medium">{"\u9002\u7528\u529f\u80fd"}</h3><p className="mt-sm text-body-small">{d.applies.join("\u3001")}</p></div>
    <div className="border-t border-dashed border-border pt-lg"><h3 className="text-label font-medium">{"\u4f7f\u7528\u8fb9\u754c"}</h3><ul className="mt-sm flex list-disc flex-col gap-md pl-lg text-body-small">{d.boundaries.map(b => <li key={b}>{b}</li>)}</ul></div>
  </div>;
}
