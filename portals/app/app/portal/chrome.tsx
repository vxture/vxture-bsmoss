"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MANAGEMENT_NAV_COOKIE, MANAGEMENT_GROUPS_COOKIE, saveManagementPreference } from "./management-preference";
import { Drawer, ShellHeader, ShellHeaderDivider, ShellHeaderMark, ShellIconButton, ShellProductTitle,
  ShellSidebarNav, ShellViewport, StatusBadge, useMediaQuery } from "@vxture/design-system";
import { portalDomain, portalNavigation, type PortalPage } from "./navigation";
import ProductLauncher from "./launcher";
import { managementSections } from "./management-navigation";
import ProductAccount, { type HeaderIdentity } from "./account";
import ProductHeaderTools from "./header-tools";
import ProductWorkspace from "./workspace";
import RegionSelector from "./region-selector";
import { useHeaderRegion } from "./header-region";
import { regionLink, type RegionPreference } from "./region-scope";

export default function ProductChrome({ active, preview, children, identity, loginEnabled, consoleHref, regionPreference, initialNavCollapsed, initialClosedGroups }: {
  active: PortalPage; preview: boolean; children: ReactNode; identity: HeaderIdentity | null; loginEnabled: boolean; consoleHref?: string;
  regionPreference: RegionPreference; initialNavCollapsed: boolean; initialClosedGroups: string[];
}) {
  const scope = useHeaderRegion(regionPreference);
  const [collapsed, setCollapsed] = useState(initialNavCollapsed);
  const [closedGroups, setClosedGroups] = useState(initialClosedGroups);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const mobile = useMediaQuery("(max-width: 767px)");
  const domain = portalDomain(active), management = domain === "management";
  const pathname = usePathname();
  const nav = portalNavigation(preview, domain);
  const current = management ? [...nav].sort((a, b) => b.href.length - a.href.length).find(item => pathname === item.href || pathname.startsWith(item.href + "/")) : nav.find(item => item.id === active);
  useEffect(() => { setNavigationOpen(false); }, [pathname, mobile]);
  const toggleNavigation = () => {
    const next = !collapsed;
    setCollapsed(next);
    saveManagementPreference(MANAGEMENT_NAV_COOKIE, next ? "collapsed" : "expanded");
  };
  const sidebar = (compact: boolean) => <ShellSidebarNav domainName="" sections={managementSections(preview)}
    collapsed={compact} initialClosedGroups={closedGroups}
    onClosedGroupsChange={groups => { setClosedGroups([...groups]); saveManagementPreference(MANAGEMENT_GROUPS_COOKIE, encodeURIComponent(JSON.stringify(groups))); }}
    onToggleCollapsed={mobile ? () => setNavigationOpen(false) : toggleNavigation}
    isActive={href => href === current?.href} storageKeyPrefix="bsmoss-management" linkComponent={Link}
    labels={{ expandNav: "\u5c55\u5f00\u5bfc\u822a", collapseNav: "\u6536\u8d77\u5bfc\u822a", expandAllGroups: "\u5c55\u5f00\u5206\u7ec4", collapseAllGroups: "\u6536\u8d77\u5206\u7ec4" }}
    />;
  return <><ShellViewport sidebarMode={management && !mobile ? collapsed ? "collapsed" : "expanded" : "hidden"}
    sidebar={management ? sidebar(collapsed) : null}
    header={<ShellHeader className="px-xs sm:px-lg" leading={<>
      {management && mobile ? <ShellIconButton icon="sidebar" label={"\u6253\u5f00\u914d\u7f6e\u5bfc\u822a"} className="size-control-xl"
        aria-haspopup="dialog" aria-expanded={navigationOpen} onClick={() => setNavigationOpen(true)} />
        : <ProductLauncher active={current?.id ?? active} preview={preview} regionSelection={scope.value} />}
      <a href={regionLink("/", scope.value)} className="flex h-control-xl shrink-0 items-center gap-xs no-underline" aria-label={"\u89c2\u6f9c\u8fd0\u884c\u603b\u89c8"}>
        <span className="flex shrink-0 items-center gap-xs"><ShellHeaderMark src="/assets/brand/guanlan-mark.svg" />
          <ShellProductTitle name={<span className="block text-heading-1">{"\u89c2\u6f9c"}</span>} /></span>
        <span className="hidden truncate text-heading-2 text-muted-foreground lg:block">{"\u7ad9\u5740\u591a\u57df\u76d1\u7ba1\u5e73\u53f0"}</span>
      </a>
      <div className="flex min-w-0 items-center gap-xs">
        <span className="hidden sm:contents"><ShellHeaderDivider /></span>
        {!management && regionPreference.catalog && <RegionSelector region={regionPreference.catalog} value={scope.value} onChange={scope.change} disabled={scope.pending} className="portal-header-region" />}
        {preview ? <StatusBadge tone="info" size="sm" className="hidden sm:inline-flex">{"\u6f14\u793a"}</StatusBadge> : null}
      </div>
    </>} trailing={<div className="flex shrink-0 items-center gap-md">
      <ProductHeaderTools authenticated={identity !== null} loginEnabled={loginEnabled} management={management} />
      <ProductAccount preview={preview} identity={identity} loginEnabled={loginEnabled} consoleHref={consoleHref} />
    </div>} />}>
    {management ? children : <ProductWorkspace>{children}</ProductWorkspace>}
  </ShellViewport>
    {management && mobile && <Drawer open={navigationOpen} onClose={() => setNavigationOpen(false)} side="left" width="sm" className="max-w-full"
      title={"\u914d\u7f6e\u7ba1\u7406"} closeLabel={"\u5173\u95ed\u914d\u7f6e\u5bfc\u822a"}>
      <div className="h-full min-h-0" onClickCapture={event => {
        if ((event.target as HTMLElement).closest("a[href]")) setNavigationOpen(false);
      }}>{sidebar(false)}</div>
    </Drawer>}
  </>;
}
