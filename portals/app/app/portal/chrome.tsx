"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ShellHeader, ShellHeaderTitle, ShellLauncher, ShellSidebarNav, ShellViewport,
  ShellThemeToggle, StatusBadge, useMediaQuery, useTheme, type IconName } from "@vxture/design-system";
import { portalNavigation, type PortalPage } from "./navigation";

const icons: Record<PortalPage, IconName> = {
  home: "house-line", map: "map-pin", analysis: "chart-line-up", reports: "file-text",
  aggregation: "database", "report-jobs": "file-text", templates: "settings",
};

export default function ProductChrome({ active, preview, children }: { active: PortalPage; preview: boolean; children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false), router = useRouter();
  const mobile = useMediaQuery("(max-width: 767px)");
  const { theme, setTheme } = useTheme();
  const nav = portalNavigation(preview), current = nav.find(item => item.id === active);
  const sections = [
    { title: "\u4e1a\u52a1\u5de5\u4f5c\u533a", items: nav.filter(item => item.group === "business").map(item => ({ ...item, icon: icons[item.id] })) },
    { title: "\u8fd0\u884c\u7ba1\u7406", dividerBefore: true, items: nav.filter(item => item.group === "management").map(item => ({ ...item, icon: icons[item.id] })) },
  ];
  return <ShellViewport sidebarMode={mobile ? "hidden" : collapsed ? "collapsed" : "expanded"}
    header={<ShellHeader leading={<>
      <ShellLauncher buttonLabel={"\u4ea7\u54c1\u5bfc\u822a"} panelLabel={"\u9009\u62e9\u5de5\u4f5c\u533a"}
        items={nav.map(item => ({ key: item.id, label: item.label, icon: icons[item.id], active: active === item.id }))}
        onSelect={key => { const item = nav.find(entry => entry.id === key); if (item) router.push(item.href); }} />
      <a href="/" className="flex min-w-0 items-center gap-md no-underline" aria-label={"\u89c2\u6f9c\u95e8\u6237\u9996\u9875"}>
        <ShellHeaderTitle>{"\u89c2\u6f9c"}</ShellHeaderTitle>
        <span className="flex min-w-0 flex-col">
          <span className="font-brand text-heading-2 font-semibold text-foreground">BS-MOSS</span>
          <span className="truncate text-label-micro text-muted-foreground max-sm:hidden">{"\u57fa\u7ad9\u591a\u57df\u8fd0\u884c\u76d1\u7ba1\u5e73\u53f0"}</span>
        </span>
      </a>
    </>} center={<span className="hidden text-label-small text-content-tertiary md:inline">{current?.label}</span>}
    centerAlign="end" trailing={<>
      {preview ? <StatusBadge tone="info" size="sm">{"\u6f14\u793a"}</StatusBadge> : null}
      <ShellThemeToggle currentTheme={theme} onThemeChange={setTheme} lightLabel={"\u5207\u6362\u6d45\u8272"} darkLabel={"\u5207\u6362\u6df1\u8272"} />
    </>} />}
    sidebar={<div className="hidden h-full min-h-0 md:flex md:flex-col">
      <ShellSidebarNav sections={sections} collapsed={collapsed} onToggleCollapsed={() => setCollapsed(value => !value)}
        isActive={href => href === current?.href} storageKeyPrefix="bsmoss-portal"
        labels={{ expandNav: "\u5c55\u5f00\u5bfc\u822a", collapseNav: "\u6536\u8d77\u5bfc\u822a", expandAllGroups: "\u5c55\u5f00\u5206\u7ec4", collapseAllGroups: "\u6536\u8d77\u5206\u7ec4" }} />
    </div>}>
    {children}
  </ShellViewport>;
}
