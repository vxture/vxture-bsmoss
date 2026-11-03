"use client";
import { useState } from "react";
import { Button, Icon, Label, NativeSelect, Popover, PopoverContent, PopoverTrigger } from "@vxture/design-system";
import type { RegistryDemo } from "../domains/site-registry/demo-store";
import { DEFAULT_SITE_QUERY, type SiteQuery } from "../domains/site-registry/rules";
import { operatorNames, sceneNames, statusNames } from "./labels";

type Filters = Pick<SiteQuery, "city" | "county" | "operator" | "sharing" | "scene" | "status">;
const values = (q: Filters): Filters => ({ city: q.city, county: q.county, operator: q.operator, sharing: q.sharing, scene: q.scene, status: q.status });
export default function SiteFilters({ query, regions, onApply }: {
  query: SiteQuery; regions: RegistryDemo["regions"]; onApply: (patch: Filters) => void;
}) {
  const [open, setOpen] = useState(false), [draft, setDraft] = useState<Filters>(() => values(query));
  const count = Object.values(values(query)).filter(v => v !== "all").length;
  return <Popover open={open} onOpenChange={next => { if (next) setDraft(values(query)); setOpen(next); }}>
    <PopoverTrigger asChild><Button variant={count ? "secondary" : "outline"} aria-label={"\u7ad9\u5740\u7b5b\u9009"}>
      <Icon name="faders" size="sm" />{"\u7b5b\u9009"}{count ? " (" + count + ")" : ""}
    </Button></PopoverTrigger>
    <PopoverContent width="xl" align="end" aria-label={"\u7ad9\u5740\u7b5b\u9009\u6761\u4ef6"}>
      <div className="flex flex-col gap-md">
        <span className="text-heading-2 font-semibold">{"\u7ad9\u5740\u7b5b\u9009"}</span>
        <div className="grid grid-cols-2 gap-md">
          <div className="flex flex-col gap-xs"><Label htmlFor="site-filter-city">{"\u5730\u5e02"}</Label>
            <NativeSelect id="site-filter-city" aria-label={"\u5730\u5e02\u7b5b\u9009"} value={draft.city} onChange={e => setDraft({ ...draft, city: e.target.value, county: "all" })}>
              <option value="all">{"\u5168\u90e8\u5730\u5e02"}</option>{regions.cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </NativeSelect></div>
          <div className="flex flex-col gap-xs"><Label htmlFor="site-filter-county">{"\u533a\u53bf"}</Label>
            <NativeSelect id="site-filter-county" aria-label={"\u533a\u53bf\u7b5b\u9009"} value={draft.county} disabled={draft.city === "all"} onChange={e => setDraft({ ...draft, county: e.target.value })}>
              <option value="all">{"\u5168\u90e8\u533a\u53bf"}</option>{regions.counties.filter(c => c.cityId === draft.city).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </NativeSelect></div>
          <div className="flex flex-col gap-xs"><Label htmlFor="site-filter-sharing">{"\u5171\u4eab\u65b9\u5f0f"}</Label>
            <NativeSelect id="site-filter-sharing" aria-label={"\u5171\u4eab\u65b9\u5f0f"} value={draft.sharing} onChange={e => setDraft({ ...draft, sharing: e.target.value })}>
              <option value="all">{"\u5168\u90e8"}</option><option value="single">{"\u72ec\u4eab\u7ad9\u5740"}</option><option value="shared">{"\u4e24\u5bb6\u53ca\u4ee5\u4e0a"}</option><option value="multi">{"\u4e09\u5bb6\u53ca\u4ee5\u4e0a"}</option>
            </NativeSelect></div>
          <div className="flex flex-col gap-xs"><Label htmlFor="site-filter-scene">{"\u4e1a\u52a1\u573a\u666f"}</Label>
            <NativeSelect id="site-filter-scene" aria-label={"\u4e1a\u52a1\u573a\u666f"} value={draft.scene} onChange={e => setDraft({ ...draft, scene: e.target.value })}>
              <option value="all">{"\u5168\u90e8"}</option>{Object.entries(sceneNames).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </NativeSelect></div>
          <div className="flex flex-col gap-xs"><Label htmlFor="site-filter-operator">{"\u8fd0\u8425\u5546"}</Label>
            <NativeSelect id="site-filter-operator" aria-label={"\u8fd0\u8425\u5546\u7b5b\u9009"} value={draft.operator} onChange={e => setDraft({ ...draft, operator: e.target.value })}>
              {["all", "mobile", "telecom", "unicom", "broadcast", "other"].map(code => <option key={code} value={code}>{operatorNames[code]}</option>)}
            </NativeSelect></div>
          <div className="flex flex-col gap-xs"><Label htmlFor="site-filter-status">{"\u8fd0\u884c\u72b6\u6001"}</Label>
            <NativeSelect id="site-filter-status" aria-label={"\u8fd0\u884c\u72b6\u6001\u7b5b\u9009"} value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value })}>
              <option value="all">{"\u5168\u90e8"}</option>{Object.entries(statusNames).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </NativeSelect></div>
        </div>
        <div className="flex items-center justify-between gap-sm border-t border-border pt-md">
          <Button variant="ghost" onClick={() => setDraft(values(DEFAULT_SITE_QUERY))}>{"\u6e05\u7a7a\u6761\u4ef6"}</Button>
          <Button onClick={() => { onApply(draft); setOpen(false); }}>{"\u5e94\u7528\u7b5b\u9009"}</Button>
        </div>
      </div>
    </PopoverContent>
  </Popover>;
}
