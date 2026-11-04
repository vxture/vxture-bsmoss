"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ShellHeader, ShellHeaderDivider, ShellHeaderMark, ShellProductTitle, ShellHeaderTools,
  ShellSidebarNav, ShellViewport, StatusBadge, useMediaQuery } from "@vxture/design-system";
import { portalDomain, portalNavigation, type PortalPage } from "./navigation";
import ProductLauncher, { portalIcons as icons } from "./launcher";
import ProductAccount, { type HeaderIdentity } from "./account";

export default function ProductChrome({ active, preview, children, identity, loginEnabled, consoleHref }: {
  active: PortalPage; preview: boolean; children: ReactNode; identity: HeaderIdentity | null; loginEnabled: boolean; consoleHref?: string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const mobile = useMediaQuery("(max-width: 767px)");
  const domain = portalDomain(active), management = domain === "management";
  const nav = portalNavigation(preview, domain), current = nav.find(item => item.id === active);
  const items = nav.map(item => ({ ...item, icon: icons[item.id] }));
  const sections = management ? [
    { title: "\u914d\u7f6e\u7ba1\u7406", items: items.filter(item => ["settings", "templates"].includes(item.id)) },
    { title: "\u4efb\u52a1\u7ba1\u7406", dividerBefore: true, items: items.filter(item => ["aggregation", "report-jobs"].includes(item.id)) },
    { title: "\u4e1a\u52a1\u5e94\u7528", dividerBefore: true, items: [{ id: "return-business", label: "\u8fd4\u56de\u4e1a\u52a1\u5e94\u7528", href: "/", icon: "arrow-left" as const }] },
  ] : [];
  return <ShellViewport sidebarMode={!management || mobile ? "hidden" : collapsed ? "collapsed" : "expanded"}
    header={<ShellHeader leading={<>
      <ProductLauncher active={active} preview={preview} />
      <a href="/" className="flex min-w-0 items-center gap-md no-underline" aria-label={"\u89c2\u6f9c\u95e8\u6237\u9996\u9875"}>
        <span className="flex shrink-0 items-center gap-xs"><ShellHeaderMark src="/assets/brand/guanlan-mark.svg" />
          <ShellProductTitle name={"\u89c2\u6f9c"} /></span>
        <span className="hidden truncate text-heading-2 font-semibold text-muted-foreground sm:block">{"\u7ad9\u5740\u591a\u57df\u8fd0\u8425\u76d1\u7ba1"}</span>
      </a>
      <div className="flex min-w-0 items-center gap-sm">
        <ShellHeaderDivider />
        <span className="truncate whitespace-nowrap text-label font-semibold text-foreground sm:text-heading-2">{management ? "\u914d\u7f6e\u7ba1\u7406 \u00b7 " : ""}{current?.label}</span>
        {preview ? <StatusBadge tone="info" size="sm">{"\u6f14\u793a"}</StatusBadge> : null}
      </div>
    </>} trailing={<>
      <ShellHeaderTools label={"\u64cd\u4f5c\u5de5\u5177"} linkComponent={Link}
        help={{ label: "\u5e2e\u52a9\u6587\u6863", href: "https://docs.vxture.com" }}
        settings={{ label: "\u914d\u7f6e\u7ba1\u7406", href: "/settings" }}
        notifications={{ label: "\u6d88\u606f", title: "\u6d88\u606f", closeLabel: "\u5173\u95ed\u6d88\u606f",
          children: <p className="text-body-small text-muted-foreground">{"\u6d88\u606f\u901a\u9053\u5c1a\u672a\u63a5\u5165\u3002"}</p> }} />
      <ProductAccount identity={identity} loginEnabled={loginEnabled} consoleHref={consoleHref} />
    </>} />}
    sidebar={management ? <div className="hidden h-full min-h-0 md:flex md:flex-col">
      <ShellSidebarNav sections={sections} collapsed={collapsed} onToggleCollapsed={() => setCollapsed(value => !value)}
        isActive={href => href === current?.href} storageKeyPrefix={"bsmoss-" + domain}
        labels={{ expandNav: "\u5c55\u5f00\u5bfc\u822a", collapseNav: "\u6536\u8d77\u5bfc\u822a", expandAllGroups: "\u5c55\u5f00\u5206\u7ec4", collapseAllGroups: "\u6536\u8d77\u5206\u7ec4" }} />
    </div> : null}>
    {children}
  </ShellViewport>;
}
