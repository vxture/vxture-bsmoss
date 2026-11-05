"use client";
import { useState } from "react";
import { Button, Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
  Icon, Popover, PopoverContent, PopoverTrigger } from "@vxture/design-system";
import { normalizeRegion, regionLabel, regionOptions, type RegionCatalog, type RegionSelection } from "./region-selection";

// Product composition of published DS primitives. Pages own query/data updates.
export default function RegionSelector({ region, value, onChange, disabled = false, id, className }: {
  region: RegionCatalog; value: RegionSelection; onChange: (value: RegionSelection) => void;
  disabled?: boolean; id?: string; className?: string;
}) {
  const [open, setOpen] = useState(false), [search, setSearch] = useState("");
  const [browsing, setBrowsing] = useState(value.cityId);
  const selected = normalizeRegion(region, value), label = regionLabel(region, selected);
  const city = region.cities.find(item => item.id === browsing);
  const apply = (next: RegionSelection) => { onChange(normalizeRegion(region, next)); setOpen(false); };
  const mark = (active: boolean) => active ? <Icon name="check" size="sm" className="ml-auto shrink-0 text-primary" /> : null;
  return <Popover open={open} onOpenChange={next => {
    if (next) { setSearch(""); setBrowsing(selected.cityId); }
    setOpen(next);
  }}>
    <PopoverTrigger asChild><Button id={id} type="button" variant="ghost" disabled={disabled}
      className={"region-selector-trigger group/region min-w-0 max-w-full justify-start gap-sm bg-muted hover:border-control-border active:border-control-border focus-visible:border-control-border data-[state=open]:border-control-border " + (className ?? "")}
      aria-label={"\u9009\u62e9\u533a\u57df\uff1a" + label} title={label}>
      <Icon name="city" size="sm" className="shrink-0 text-muted-foreground" />
      <span className="truncate">{label}</span><Icon name="chevron-down" size="sm" className="hidden shrink-0 text-muted-foreground group-hover/region:block group-active/region:block group-focus-visible/region:block group-data-[state=open]/region:block" />
    </Button></PopoverTrigger>
    <PopoverContent align="start" width="xl" className="region-selector-popover p-0" aria-label={"\u533a\u57df\u9009\u62e9"}>
      <Command shouldFilter={false} loop defaultValue={selected.countyId !== "all" ? "county-" + selected.countyId : selected.cityId !== "all" ? "city-" + selected.cityId : "all-cities"} label={"\u7701\u5e02\u53bf\u533a\u57df\u9009\u62e9"}>
        <CommandInput value={search} onValueChange={setSearch} aria-label={"\u641c\u7d22\u533a\u57df"} placeholder={"\u641c\u7d22\u7701\u3001\u5e02\u3001\u533a\u53bf\u6216\u7f16\u7801"} />
        {search.trim() ? <CommandList className="region-selector-results">
          <CommandEmpty>{"\u672a\u627e\u5230\u5339\u914d\u533a\u57df"}</CommandEmpty>
          <CommandGroup heading={"\u5339\u914d\u533a\u57df"}>{regionOptions(region, search).map(item =>
            <CommandItem key={item.cityId + item.countyId} value={item.cityId + item.countyId} onSelect={() => apply(item)} className="gap-sm py-sm">
              <span className="min-w-0 break-words">{item.label}</span>{mark(item.cityId === selected.cityId && item.countyId === selected.countyId)}
            </CommandItem>)}</CommandGroup>
        </CommandList> : <CommandList className="region-selector-cascade"><div className="region-selector-columns">
          <CommandGroup heading={"\u7701\u4efd"} className="region-selector-province">
            <CommandItem value={"province-" + region.id} onSelect={() => setBrowsing("all")} className="gap-sm bg-primary-muted py-sm text-primary">
              {region.name}<Icon name="chevron-right" size="sm" className="ml-auto shrink-0" />
            </CommandItem>
          </CommandGroup>
          <CommandGroup heading={"\u5730\u5e02"} className="region-selector-level">
            <CommandItem value="all-cities" onSelect={() => apply({ cityId: "all", countyId: "all" })} className="gap-sm py-sm">
              {"\u5168\u7701"}{mark(selected.cityId === "all")}
            </CommandItem>
            {region.cities.map(item => <CommandItem key={item.id} value={"city-" + item.id} onSelect={() => setBrowsing(item.id)}
              className={"gap-sm py-sm " + (browsing === item.id ? "bg-primary-muted text-primary" : "")}>
              {item.name}<Icon name="chevron-right" size="sm" className="ml-auto shrink-0" />
            </CommandItem>)}
          </CommandGroup>
          <CommandGroup heading={"\u533a\u53bf"} className="region-selector-level">
            {city ? <>
              <CommandItem value="all-counties" onSelect={() => apply({ cityId: city.id, countyId: "all" })} className="gap-sm py-sm">
                {"\u5168\u5e02"}{mark(selected.cityId === city.id && selected.countyId === "all")}
              </CommandItem>
              {region.counties.filter(item => item.cityId === city.id).map(item => <CommandItem key={item.id} value={"county-" + item.id}
                onSelect={() => apply({ cityId: city.id, countyId: item.id })} className="gap-sm py-sm">
                {item.name}{mark(selected.countyId === item.id)}
              </CommandItem>)}
            </> : <p className="px-sm py-sm text-body-small text-muted-foreground">{"\u8bf7\u5148\u9009\u62e9\u5730\u5e02"}</p>}
          </CommandGroup>
        </div></CommandList>}
        <div className="border-t border-border px-md py-sm text-body-small text-muted-foreground" aria-live="polite">{label}</div>
      </Command>
    </PopoverContent>
  </Popover>;
}
