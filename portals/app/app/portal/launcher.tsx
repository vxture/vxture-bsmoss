"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { EntryCard, Icon, Popover, PopoverTrigger, ShellIconButton, ShellPanelContent, ShellPanelRow,
  ShellPanelSection, type IconName } from "@vxture/design-system";
import { portalDomain, portalNavigation, type PortalDomain, type PortalPage } from "./navigation";
import "./header.css";

export const portalIcons: Record<PortalPage, IconName> = {
  home: "house-line", map: "map-pin", analysis: "chart-line-up", reports: "file-text",
  aggregation: "database", "report-jobs": "calendar", templates: "stack", settings: "faders",
};

const entryDescriptions: Record<PortalPage, string> = {
  home: "\u7ad9\u7f51\u603b\u89c8\u4e0e\u91cd\u70b9\u4e1a\u52a1",
  map: "\u7a7a\u95f4\u5206\u5e03\u4e0e\u5355\u7ad9\u6d1e\u5bdf",
  analysis: "\u65e5\u3001\u5468\u3001\u6708\u7528\u91cf\u8d8b\u52bf",
  reports: "\u5468\u671f\u62a5\u544a\u4e0e\u8bc1\u636e\u8ffd\u6eaf",
  settings: "\u7ba1\u7406\u5165\u53e3\u4e0e\u663e\u793a\u504f\u597d",
  templates: "\u6307\u6807\u53e3\u5f84\u4e0e\u62a5\u544a\u6a21\u677f",
  aggregation: "\u805a\u5408\u8bb0\u5f55\u4e0e\u5931\u8d25\u6062\u590d",
  "report-jobs": "\u751f\u6210\u3001\u5bfc\u51fa\u4e0e\u6267\u884c\u8bb0\u5f55",
};

const businessGroups: { title: string; description: string; icon: IconName; pages: PortalPage[] }[] = [
  { title: "\u7ad9\u7f51\u76d1\u7ba1", description: "\u5168\u5c40\u6982\u89c8\u4e0e\u7a7a\u95f4\u6d1e\u5bdf", icon: "map-pin", pages: ["home", "map"] },
  { title: "\u5206\u6790\u4e0e\u62a5\u544a", description: "\u5468\u671f\u7528\u91cf\u4e0e\u8bc1\u636e\u8ffd\u6eaf", icon: "chart-line-up", pages: ["analysis", "reports"] },
];
const managementGroups: typeof businessGroups = [
  { title: "\u914d\u7f6e\u7ba1\u7406", description: "\u6307\u6807\u3001\u6a21\u677f\u4e0e\u663e\u793a\u914d\u7f6e", icon: "settings", pages: ["settings", "templates"] },
  { title: "\u4efb\u52a1\u7ba1\u7406", description: "\u6267\u884c\u8bb0\u5f55\u4e0e\u53d7\u5ba1\u6062\u590d", icon: "database", pages: ["aggregation", "report-jobs"] },
];
const panelLabels: Record<PortalDomain, string> = { business: "\u4e1a\u52a1\u5e94\u7528", management: "\u914d\u7f6e\u7ba1\u7406\u5bfc\u822a" };

export default function ProductLauncher({ active, preview }: { active: PortalPage; preview: boolean }) {
  const [open, setOpen] = useState(false);
  const firstEntry = useRef<HTMLAnchorElement>(null);
  const domain = portalDomain(active), management = domain === "management";
  const nav = portalNavigation(preview, domain), groups = management ? managementGroups : businessGroups;
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><ShellIconButton icon="app-grid" label={panelLabels[domain]}>
      <Icon name="app-grid" size="lg" />
    </ShellIconButton></PopoverTrigger>
    <ShellPanelContent align="start" aria-label={panelLabels[domain]} onOpenAutoFocus={() => firstEntry.current?.focus()}
      className="portal-launcher gap-xl p-xl bg-gradient-to-b from-gradient-card-from to-gradient-card-to">
      <div className="grid gap-xl md:grid-cols-2">
        {groups.map(group => <div key={group.title} className="flex min-w-0 flex-col gap-lg">
          <ShellPanelRow icon={group.icon} label={group.title} description={group.description} />
          <ShellPanelSection divided={false} className="gap-md">
            {group.pages.flatMap(id => {
              const item = nav.find(entry => entry.id === id);
              return item ? [<EntryCard key={id} ref={id === nav[0]?.id ? firstEntry : undefined}
                title={item.label} description={entryDescriptions[id]}
                icon={portalIcons[id]} href={item.href} aria-current={id === active ? "page" : undefined}
                meta={id === active ? <Icon name="check-circle" size="sm" aria-label={"\u5f53\u524d\u9875\u9762"} /> : undefined}
                className={id === active ? "p-lg bg-primary-muted" : "p-lg"}
                onClick={() => setOpen(false)} />] : [];
            })}
          </ShellPanelSection>
        </div>)}
      </div>
      {management ? <ShellPanelSection><ShellPanelRow icon="arrow-left" label={"\u8fd4\u56de\u4e1a\u52a1\u5e94\u7528"}
        href="/" linkComponent={Link} chevron={false} onClick={() => setOpen(false)} /></ShellPanelSection> : null}
    </ShellPanelContent>
  </Popover>;
}
