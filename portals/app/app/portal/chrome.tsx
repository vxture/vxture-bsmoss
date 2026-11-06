"use client";

import { useState, type ReactNode } from "react";
import { ShellHeader, ShellHeaderDivider, ShellHeaderMark, ShellProductTitle,
  ShellSidebarFrame, ShellSidebarNav, ShellViewport, StatusBadge, useMediaQuery } from "@vxture/design-system";
import { portalDomain, portalNavigation, type PortalPage } from "./navigation";
import ProductLauncher, { portalIcons as icons } from "./launcher";
import ProductAccount, { type HeaderIdentity } from "./account";
import ProductHeaderTools from "./header-tools";
import ProductWorkspace from "./workspace";
import RegionSelector from "./region-selector";
import { useHeaderRegion } from "./header-region";
import { regionLink, type RegionPreference } from "./region-scope";

export default function ProductChrome({ active, preview, children, identity, loginEnabled, consoleHref, regionPreference }: {
  active: PortalPage; preview: boolean; children: ReactNode; identity: HeaderIdentity | null; loginEnabled: boolean; consoleHref?: string;
  regionPreference: RegionPreference;
}) {
  const scope = useHeaderRegion(regionPreference);
  const [collapsed, setCollapsed] = useState(false);
  const mobile = useMediaQuery("(max-width: 767px)");
  const domain = portalDomain(active), management = domain === "management";
  const nav = portalNavigation(preview, domain), current = nav.find(item => item.id === active);
  const items = nav.map(item => ({ ...item, icon: icons[item.id] }));
  const sections = management ? [
    { title: "\u914d\u7f6e\u7ba1\u7406", items: items.filter(item => ["settings", "overview-display", "templates"].includes(item.id)) },
    { title: "\u4efb\u52a1\u7ba1\u7406", dividerBefore: true, items: items.filter(item => ["data-updates", "aggregation", "report-jobs"].includes(item.id)) },
    { title: "\u4e1a\u52a1\u5e94\u7528", dividerBefore: true, items: [{ id: "return-business", label: "\u8fd4\u56de\u4e1a\u52a1\u5e94\u7528", href: "/", icon: "arrow-left" as const }] },
  ] : [];
  return <ShellViewport sidebarMode="hidden" sidebar={null}
    header={<ShellHeader className="px-xs sm:px-lg" leading={<>
      <ProductLauncher active={active} preview={preview} regionSelection={scope.value} />
      <a href={regionLink("/", scope.value)} className="flex shrink-0 items-center gap-xs no-underline" aria-label={"\u89c2\u6f9c\u8fd0\u884c\u603b\u89c8"}>
        <span className="flex shrink-0 items-center gap-xs"><ShellHeaderMark src="/assets/brand/guanlan-mark.svg" />
          <ShellProductTitle name={"\u89c2\u6f9c"} /></span>
        <span className="hidden truncate text-heading-2 font-semibold text-muted-foreground lg:block">{"\u7ad9\u5740\u591a\u57df\u8fd0\u8425\u76d1\u7ba1"}</span>
      </a>
      <div className="flex min-w-0 items-center gap-xs">
        <span className="hidden sm:contents"><ShellHeaderDivider /></span>
        {regionPreference.catalog && <RegionSelector region={regionPreference.catalog} value={scope.value} onChange={scope.change} disabled={scope.pending} className="portal-header-region" />}
        {preview ? <StatusBadge tone="info" size="sm" className="hidden sm:inline-flex">{"\u6f14\u793a"}</StatusBadge> : null}
      </div>
    </>} trailing={<div className="flex shrink-0 items-center gap-md">
      <ProductHeaderTools />
      <ProductAccount identity={identity} loginEnabled={loginEnabled} consoleHref={consoleHref} />
    </div>} />}>
    <ProductWorkspace navigation={management && !mobile ? <ShellSidebarFrame mode={collapsed ? "collapsed" : "expanded"} className="min-h-0">
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-md border border-border bg-card/68">
      <ShellSidebarNav sections={sections} collapsed={collapsed} onToggleCollapsed={() => setCollapsed(value => !value)}
        isActive={href => href === current?.href} storageKeyPrefix={"bsmoss-" + domain}
        labels={{ expandNav: "\u5c55\u5f00\u5bfc\u822a", collapseNav: "\u6536\u8d77\u5bfc\u822a", expandAllGroups: "\u5c55\u5f00\u5206\u7ec4", collapseAllGroups: "\u6536\u8d77\u5206\u7ec4" }} />
      </div>
    </ShellSidebarFrame> : null}>
      {children}
    </ProductWorkspace>
  </ShellViewport>;
}
