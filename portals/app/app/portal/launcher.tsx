"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon, Popover, PopoverTrigger, ShellIconButton, ShellPanelContent, ShellPanelRow,
  ShellPanelSection, type IconName } from "@vxture/design-system";
import { portalNavigation, type PortalPage } from "./navigation";
import "./header.css";

export const portalIcons: Record<PortalPage, IconName> = {
  home: "house-line", map: "map-pin", analysis: "chart-line-up", reports: "file-text",
  aggregation: "database", "report-jobs": "file-text", templates: "settings", settings: "settings",
};

const groups: { title: string; description: string; icon: IconName; pages: PortalPage[] }[] = [
  { title: "\u7ad9\u7f51\u76d1\u7ba1", description: "\u5168\u5c40\u6982\u89c8\u4e0e\u7a7a\u95f4\u6d1e\u5bdf", icon: "map-pin", pages: ["home", "map"] },
  { title: "\u5206\u6790\u4e0e\u62a5\u544a", description: "\u5468\u671f\u7528\u91cf\u4e0e\u8bc1\u636e\u8ffd\u6eaf", icon: "chart-line-up", pages: ["analysis", "reports"] },
  { title: "\u8fd0\u884c\u7ba1\u7406", description: "\u4efb\u52a1\u76d1\u63a7\u4e0e\u4e1a\u52a1\u914d\u7f6e", icon: "settings", pages: ["aggregation", "report-jobs", "templates", "settings"] },
];

export default function ProductLauncher({ active, preview }: { active: PortalPage; preview: boolean }) {
  const [open, setOpen] = useState(false);
  const nav = portalNavigation(preview);
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><ShellIconButton icon="app-grid" label={"\u4ea7\u54c1\u5bfc\u822a"}>
      <Icon name="app-grid" size="lg" />
    </ShellIconButton></PopoverTrigger>
    <ShellPanelContent align="start" aria-label={"\u9009\u62e9\u5de5\u4f5c\u533a"} className="portal-launcher bg-gradient-to-b from-gradient-card-from to-gradient-card-to">
      <div className="grid gap-lg md:grid-cols-3">
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
    </ShellPanelContent>
  </Popover>;
}
