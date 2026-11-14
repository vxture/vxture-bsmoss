"use client";
import {useEffect, useRef, useState} from "react";
import {Button, Checkbox, Icon, SegmentedControl, Select, SelectTrigger, SelectValue, SelectContent, SelectItem} from "@vxture/design-system";
import {CATEGORIES, type Category} from "../../domains/catalog/registry";
import {categoryNames, defaultOverviewDisplay, OVERVIEW_METRICS, overviewUnit, type OverviewDisplayPreference, type OverviewUnit} from "../../portal/metric-catalog";
import {useOverviewDisplay} from "../../portal/overview-display";
import ResetButton from "../../portal/reset-button";

export default function OverviewDisplayEditor() {
  const {preference, ready, message, invalid, save} = useOverviewDisplay();
  const [draft, setDraft] = useState(defaultOverviewDisplay), [category, setCategory] = useState<Category>("business_service"), [notice, setNotice] = useState("");
  const previous = useRef(preference);
  useEffect(() => {
    const before = previous.current; previous.current = preference;
    setDraft(current => JSON.stringify(current) === JSON.stringify(before) ? preference : current);
  }, [preference]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(preference), selections = draft.selections[category];
  const definitions = OVERVIEW_METRICS.filter(d => d.category === category);
  const ordered = [...selections.map(s => definitions.find(d => d.id === s.id)!), ...definitions.filter(d => !selections.some(s => s.id === d.id))];
  function update(items: OverviewDisplayPreference["selections"][Category]) {
    setDraft(current => ({...current, selections: {...current.selections, [category]: items}})); setNotice("");
  }
  function move(index: number, offset: number) {
    const items = [...selections], target = index + offset;
    if (target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]]; update(items);
  }
  return <section className="flex min-w-0 flex-col gap-md text-body" data-overview-display-settings aria-busy={!ready}>
    <div className="site-analysis-action-row"><div className="site-analysis-occupancy-scroll"><SegmentedControl size="md" className="site-analysis-occupancy site-analysis-occupancy-auto [--analysis-facet-columns:3]" ariaLabel={"\u663e\u793a\u6307\u6807\u7c7b\u522b"} value={category} onChange={setCategory} items={CATEGORIES.map(value => ({value, label: categoryNames[value]}))}/></div></div>
    <fieldset className="min-w-0" disabled={!ready}>
      <legend className="text-body-small text-muted-foreground">{categoryNames[category]+" \u00b7 \u5df2\u9009 "+selections.length+" / 4"}</legend>
      <div className="grid gap-x-lg md:grid-cols-2 xl:grid-cols-3">{ordered.map(def => {
        const index = selections.findIndex(s => s.id === def.id), selected = index >= 0;
        return <div key={def.id} className="flex min-w-0 items-start gap-sm border-b border-dashed border-border py-md" data-display-metric={def.id}>
          <Checkbox id={"overview-display-"+def.id} className="mt-xs shrink-0" aria-label={"\u663e\u793a"+def.label} checked={selected} disabled={!ready || (selected ? selections.length <= 2 : selections.length >= 4)} onCheckedChange={checked => update(checked ? [...selections, {id: def.id, unit: def.units[0]}] : selections.filter(s => s.id !== def.id))}/>
          <div className="flex min-w-0 flex-1 flex-col gap-sm">
            <label htmlFor={"overview-display-"+def.id} className="flex cursor-pointer flex-wrap items-center justify-between gap-sm"><span title={def.description}>{def.label}</span><span className="text-body-small text-muted-foreground">{def.basis === "day" ? "\u5168\u65e5" : "\u65f6\u70b9"}</span></label>
            {selected && <div className="flex flex-wrap items-center justify-between gap-sm">
              {def.units.length > 1 ? <Select value={selections[index].unit} onValueChange={unit => update(selections.map(s => s.id === def.id ? {...s, unit: unit as OverviewUnit} : s))}><SelectTrigger className="h-control-xl w-auto gap-sm text-body" aria-label={def.label+"\u663e\u793a\u5355\u4f4d"}><SelectValue/></SelectTrigger><SelectContent>{def.units.map(unit => <SelectItem key={unit} value={unit}>{overviewUnit(unit).label}</SelectItem>)}</SelectContent></Select> : <span className="text-body text-muted-foreground">{overviewUnit(selections[index].unit).label}</span>}
              <div className="site-analysis-control-group"><Button size="icon-md" className="size-control-xl" variant="ghost" disabled={!ready || index === 0} aria-label={"\u4e0a\u79fb"+def.label} onClick={() => move(index, -1)}><Icon name="arrow-up" size="sm"/></Button><Button size="icon-md" className="size-control-xl" variant="ghost" disabled={!ready || index === selections.length - 1} aria-label={"\u4e0b\u79fb"+def.label} onClick={() => move(index, 1)}><Icon name="arrow-down" size="sm"/></Button></div>
            </div>}
          </div>
        </div>;
      })}</div>
    </fieldset>
    <div className="border-t border-dashed border-border"><div className="site-analysis-action-row"><ResetButton variant="outline" disabled={!ready} label={"\u6062\u590d\u9ed8\u8ba4\u663e\u793a"} onClick={() => {setDraft(defaultOverviewDisplay()); setNotice("\u5df2\u6062\u590d\u9ed8\u8ba4\uff0c\u4fdd\u5b58\u540e\u751f\u6548\u3002");}}/><Button className="h-control-xl text-body" disabled={!ready || (!dirty && !invalid)} onClick={() => {if (save(draft)) setNotice("\u5df2\u4fdd\u5b58\uff0c\u9996\u9875\u663e\u793a\u5df2\u66f4\u65b0\u3002"); else setNotice("");}}>{"\u4fdd\u5b58\u663e\u793a"}</Button></div></div>
    {(notice || message || dirty) && <p role="status" className="text-body-small text-muted-foreground">{notice || message || "\u6709\u672a\u4fdd\u5b58\u4fee\u6539"}</p>}
  </section>;
}
