"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ShellHeader, ShellHeaderMark, ShellHeaderTitle, ShellHeaderTools, ShellPanelRow, ShellPanelSection,
  ShellSidebarNav, ShellViewport, StatusBadge, useMediaQuery } from "@vxture/design-system";
import { portalNavigation, type PortalPage } from "./navigation";
import ProductLauncher, { portalIcons as icons } from "./launcher";
import ProductAccount, { type HeaderIdentity } from "./account";

export default function ProductChrome({ active, preview, children, identity, loginEnabled, consoleHref }: {
  active: PortalPage; preview: boolean; children: ReactNode; identity: HeaderIdentity | null; loginEnabled: boolean; consoleHref?: string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const mobile = useMediaQuery("(max-width: 767px)");
  const nav = portalNavigation(preview), current = nav.find(item => item.id === active);
  const sections = [
    { title: "\u4e1a\u52a1\u5de5\u4f5c\u533a", items: nav.filter(item => item.group === "business").map(item => ({ ...item, icon: icons[item.id] })) },
    { title: "\u8fd0\u884c\u7ba1\u7406", dividerBefore: true, items: nav.filter(item => item.group === "management").map(item => ({ ...item, icon: icons[item.id] })) },
  ];
  return <ShellViewport sidebarMode={mobile ? "hidden" : collapsed ? "collapsed" : "expanded"}
    header={<ShellHeader leading={<>
      <ProductLauncher active={active} preview={preview} />
      <a href="/" className="flex min-w-0 items-center gap-md no-underline" aria-label={"\u89c2\u6f9c\u95e8\u6237\u9996\u9875"}>
        <span className="flex shrink-0 items-center gap-xs"><ShellHeaderMark src="/assets/brand/guanlan-mark.svg" />
          <ShellHeaderTitle>{"\u89c2\u6f9c"}</ShellHeaderTitle></span>
        <span className="hidden min-w-0 flex-col sm:flex">
          <span className="font-brand text-heading-2 font-semibold text-foreground">BS-MOSS</span>
          <span className="truncate text-label-micro text-muted-foreground max-sm:hidden">{"\u57fa\u7ad9\u591a\u57df\u8fd0\u884c\u76d1\u7ba1\u5e73\u53f0"}</span>
        </span>
      </a>
    </>} center={<span className="hidden text-label-small text-content-tertiary md:inline">{current?.label}</span>}
    centerAlign="end" trailing={<>
      {preview ? <span className="hidden lg:inline-flex"><StatusBadge tone="info" size="sm">{"\u6f14\u793a"}</StatusBadge></span> : null}
      <ShellHeaderTools label={"\u64cd\u4f5c\u5de5\u5177"} linkComponent={Link}
        help={{ label: "\u5e2e\u52a9\u6587\u6863", href: "https://docs.vxture.com" }}
        settings={{ label: "\u914d\u7f6e\u4e2d\u5fc3", href: "/settings" }}
        notifications={{ label: "\u6d88\u606f", title: "\u6d88\u606f", closeLabel: "\u5173\u95ed\u6d88\u606f", children: <div className="flex flex-col gap-lg">
          <p className="text-body-small text-muted-foreground">{"\u6d88\u606f\u901a\u9053\u5c1a\u672a\u63a5\u5165\u3002\u4efb\u52a1\u6267\u884c\u8bb0\u5f55\u53ef\u5728\u5bf9\u5e94\u5de5\u4f5c\u53f0\u67e5\u770b\u3002"}</p>
          <ShellPanelSection title={"\u4efb\u52a1\u5de5\u4f5c\u53f0"}>
            <ShellPanelRow icon="database" label={"\u805a\u5408\u4efb\u52a1"} href="/operations/aggregation" linkComponent={Link} />
            <ShellPanelRow icon="file-text" label={"\u62a5\u544a\u4efb\u52a1"} href="/operations/reports" linkComponent={Link} />
          </ShellPanelSection>
        </div> }} />
      <ProductAccount identity={identity} loginEnabled={loginEnabled} preview={preview} consoleHref={consoleHref} />
    </>} />}
    sidebar={<div className="hidden h-full min-h-0 md:flex md:flex-col">
      <ShellSidebarNav sections={sections} collapsed={collapsed} onToggleCollapsed={() => setCollapsed(value => !value)}
        isActive={href => href === current?.href} storageKeyPrefix="bsmoss-portal"
        labels={{ expandNav: "\u5c55\u5f00\u5bfc\u822a", collapseNav: "\u6536\u8d77\u5bfc\u822a", expandAllGroups: "\u5c55\u5f00\u5206\u7ec4", collapseAllGroups: "\u6536\u8d77\u5206\u7ec4" }} />
    </div>}>
    {children}
  </ShellViewport>;
}
