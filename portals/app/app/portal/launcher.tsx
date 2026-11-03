"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon, Popover, PopoverTrigger, ShellIconButton, ShellPanelContent, ShellPanelRow,
  ShellPanelSection, type IconName } from "@vxture/design-system";
import { portalDomain, portalNavigation, type PortalDomain, type PortalPage } from "./navigation";
import "./header.css";

export const portalIcons: Record<PortalPage, IconName> = {
  home: "house-line", map: "map-pin", analysis: "chart-line-up", reports: "file-text",
  aggregation: "database", "report-jobs": "file-text", templates: "settings", settings: "settings",
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
  const domain = portalDomain(active), management = domain === "management";
  const nav = portalNavigation(preview, domain), groups = management ? managementGroups : businessGroups;
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><ShellIconButton icon="app-grid" label={panelLabels[domain]}>
      <Icon name="app-grid" size="lg" />
    </ShellIconButton></PopoverTrigger>
    <ShellPanelContent align="start" aria-label={panelLabels[domain]} className="portal-launcher bg-gradient-to-b from-gradient-card-from to-gradient-card-to">
      <div className="grid gap-lg md:grid-cols-2">
        {groups.map(group => <div key={group.title} className="min-w-0">
          <ShellPanelRow icon={group.icon} label={group.title} description={group.description} />
          <div className="mt-md"><ShellPanelSection>
            {group.pages.flatMap(id => {
              const item = nav.find(entry => entry.id === id);
              return item ? [<ShellPanelRow key={id} label={item.label} icon={portalIcons[id]} href={item.href}
                linkComponent={Link} active={id === active} chevron={false} onClick={() => setOpen(false)} />] : [];
            })}
          </ShellPanelSection></div>
        </div>)}
      </div>
      {management ? <ShellPanelSection><ShellPanelRow icon="arrow-left" label={"\u8fd4\u56de\u4e1a\u52a1\u5e94\u7528"}
        href="/" linkComponent={Link} chevron={false} onClick={() => setOpen(false)} /></ShellPanelSection> : null}
    </ShellPanelContent>
  </Popover>;
}
