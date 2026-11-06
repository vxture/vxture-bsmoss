"use client";
import PageHeading from "../../portal/page-heading";
import { useEffect, useState } from "react";
import { Button, Checkbox, Icon, NativeSelect, PanelCard, ShellPageContainer, StatusBadge } from "@vxture/design-system";
import { CATEGORIES, type Category } from "../../domains/catalog/registry";
import { categoryNames, defaultOverviewDisplay, OVERVIEW_METRICS, overviewUnit, type OverviewDisplayPreference, type OverviewUnit } from "../../portal/metric-catalog";
import { useOverviewDisplay } from "../../portal/overview-display";

export default function OverviewDisplaySettings() {
  const { preference, message, invalid, save } = useOverviewDisplay();
  const [draft, setDraft] = useState(defaultOverviewDisplay), [notice, setNotice] = useState("");
  useEffect(() => { setDraft(preference); }, [preference]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(preference);
  const update = (category: Category, selections: OverviewDisplayPreference["selections"][Category]) => {
    setDraft(p => ({ ...p, selections: { ...p.selections, [category]: selections } })); setNotice("");
  };
  const move = (category: Category, index: number, offset: number) => {
    const items = [...draft.selections[category]], target = index + offset;
    if (target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]]; update(category, items);
  };
  return <ShellPageContainer className="product-page-inset"><div className="flex min-w-0 flex-col gap-lg" data-overview-display-settings>
    <PageHeading title={"\u603b\u89c8\u504f\u597d"} description={"\u6307\u6807\u9009\u62e9\u3001\u6392\u5e8f\u4e0e\u5355\u4f4d\u914d\u7f6e"}
      secondary={<StatusBadge size="sm" tone={dirty ? "warning" : "neutral"}>{dirty ? "\u6709\u672a\u4fdd\u5b58\u4fee\u6539" : "\u5f53\u524d\u5e03\u5c40"}</StatusBadge>}
      context={<span>{"\u6bcf\u7c7b2\u20134\u9879 \u00b7 \u4ec5\u5f71\u54cd\u5f53\u524d\u6d4f\u89c8\u5668\u7684\u9996\u9875\u5c55\u793a"}</span>}
      actions={<><Button asChild variant="outline"><a href="/">{"\u67e5\u770b\u8fd0\u884c\u603b\u89c8"}</a></Button><Button variant="outline" onClick={() => { setDraft(defaultOverviewDisplay()); setNotice("\u5df2\u6062\u590d\u9ed8\u8ba4\uff0c\u8bf7\u4fdd\u5b58\u540e\u751f\u6548\u3002"); }}>{"\u6062\u590d\u9ed8\u8ba4"}</Button>
        <Button disabled={!dirty && !invalid} onClick={() => { if (save(draft)) setNotice("\u9996\u9875\u663e\u793a\u914d\u7f6e\u5df2\u4fdd\u5b58\u3002"); }}>{"\u4fdd\u5b58\u914d\u7f6e"}</Button></>} />
    {(notice || message) && <p role="status" className="text-body-small text-muted-foreground">{notice || message}</p>}
    <div className="grid min-w-0 items-start gap-lg xl:grid-cols-2 2xl:grid-cols-3">
      {CATEGORIES.map(category => <PanelCard key={category} className="min-w-0" title={categoryNames[category]} description={draft.selections[category].length + "\u9879\u5df2\u9009 / " + OVERVIEW_METRICS.filter(d => d.category === category).length + "\u9879\u53ef\u9009"} tone="neutral">
        <div className="flex min-w-0 flex-col gap-md">
          <ol className="flex flex-col gap-sm" aria-label={categoryNames[category] + "\u663e\u793a\u987a\u5e8f"}>
            {draft.selections[category].map((selection, index) => {
              const def = OVERVIEW_METRICS.find(d => d.id === selection.id)!;
              return <li key={selection.id} className="flex min-w-0 flex-wrap items-center gap-sm rounded-md border border-border p-sm">
                <span className="text-body-small text-muted-foreground">{index + 1}</span><span className="min-w-0 flex-1 text-label">{def.label}</span>
                <NativeSelect wrapperClassName="w-auto" aria-label={def.label + "\u663e\u793a\u5355\u4f4d"} value={selection.unit} onChange={e => update(category, draft.selections[category].map(s => s.id === selection.id ? { ...s, unit: e.target.value as OverviewUnit } : s))}>
                  {def.units.map(u => <option key={u} value={u}>{overviewUnit(u).label}</option>)}
                </NativeSelect>
                <div className="flex shrink-0 items-center gap-xs">
                  <Button size="icon-sm" variant="ghost" disabled={!index} aria-label={"\u4e0a\u79fb" + def.label} onClick={() => move(category, index, -1)}><Icon name="arrow-up" size="sm" /></Button>
                  <Button size="icon-sm" variant="ghost" disabled={index === draft.selections[category].length - 1} aria-label={"\u4e0b\u79fb" + def.label} onClick={() => move(category, index, 1)}><Icon name="arrow-down" size="sm" /></Button>
                </div>
              </li>;
            })}
          </ol>
          <fieldset className="min-w-0 border-t border-border pt-md"><legend className="text-label">{"\u6307\u6807\u9009\u62e9"}</legend>
            <div className="flex flex-col divide-y divide-border">
              {OVERVIEW_METRICS.filter(d => d.category === category).map(def => {
                const selected = draft.selections[category].some(s => s.id === def.id), count = draft.selections[category].length;
                return <label key={def.id} className="flex cursor-pointer items-start gap-md py-md">
                  <Checkbox className="mt-2xs" aria-label={categoryNames[category] + "\u9009\u62e9" + def.label} checked={selected} disabled={selected ? count <= 2 : count >= 4} onCheckedChange={checked => update(category, checked ?
                    [...draft.selections[category], { id: def.id, unit: def.units[0] }] : draft.selections[category].filter(s => s.id !== def.id))} />
                  <span className="flex min-w-0 flex-1 flex-col gap-xs"><span className="text-label">{def.label}<span className="pl-sm text-body-small text-muted-foreground">{def.basis === "day" ? "\u5168\u65e5" : "\u65f6\u70b9"}</span></span>
                    <span className="text-body-small text-muted-foreground">{def.description}</span></span>
                </label>;
              })}
            </div>
          </fieldset>
        </div>
      </PanelCard>)}
    </div>
  </div></ShellPageContainer>;
}
