"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { EntryCard, Icon, Popover, PopoverTrigger, Separator, ShellIconButton, ShellPanelContent, ShellPanelRow, StatusBadge,
  ShellPanelSection, type IconName } from "@vxture/design-system";
import { portalBusinessGroups, portalDomain, portalNavigation, type PortalDomain, type PortalEntry, type PortalPage } from "./navigation";
import "./header.css";
export const portalIcons: Record<PortalPage, IconName> = {
  "overview-display": "faders",
  "usage-review": "search",
  capacity: "gauge", efficiency: "lightning", "operator-usage": "chart-pie", "usage-reports": "newspaper",
  home: "house-line", board: "chart-bar", sites: "building", map: "map-pin", analysis: "chart-line-up", reports: "file-text",
  aggregation: "database", "report-jobs": "calendar", templates: "stack", settings: "faders",
};
const descriptions: Record<PortalPage, string> = {
  "overview-display": "\u9996\u9875\u6307\u6807\u3001\u6392\u5e8f\u4e0e\u5355\u4f4d",
  "usage-review": "\u6ce2\u52a8\u3001\u96f6\u91cf\u4e0e\u7f3a\u6570",
  capacity: "\u8d1f\u8f7d\u4e0e\u63a5\u901a\u8d28\u91cf", efficiency: "\u4f9b\u7535\u4e0e\u80fd\u8017\u89c2\u5bdf", "operator-usage": "\u8fd0\u8425\u5546\u72ec\u7acb\u7528\u91cf", "usage-reports": "\u5468\u671f\u62a5\u544a\u4e0e\u5bfc\u51fa",
  sites: "\u53f0\u8d26\u3001\u8d44\u6e90\u4e0e\u7edf\u4e00\u6863\u6848",
  home: "\u65e5\u5e38\u5de5\u4f5c\u4e0e\u4e1a\u52a1\u6982\u89c8", board: "\u5168\u7701\u6001\u52bf\u4e0e\u91cd\u70b9\u5173\u6ce8", map: "\u7a7a\u95f4\u5b9a\u4f4d\u4e0e\u5355\u7ad9\u8c03\u67e5",
  analysis: "\u65e5\u3001\u5468\u3001\u6708\u7528\u91cf\u8d8b\u52bf", reports: "\u5468\u671f\u62a5\u544a\u4e0e\u8bc1\u636e\u8ffd\u6eaf", settings: "\u7ba1\u7406\u5165\u53e3\u4e0e\u663e\u793a\u504f\u597d",
  templates: "\u6307\u6807\u53e3\u5f84\u4e0e\u62a5\u544a\u6a21\u677f", aggregation: "\u805a\u5408\u8bb0\u5f55\u4e0e\u5931\u8d25\u6062\u590d", "report-jobs": "\u751f\u6210\u3001\u5bfc\u51fa\u4e0e\u6267\u884c\u8bb0\u5f55",
};
const managementGroups: { title: string; description: string; icon: IconName; pages: PortalPage[] }[] = [
  { title: "\u914d\u7f6e\u7ba1\u7406", description: "\u6307\u6807\u3001\u6a21\u677f\u4e0e\u663e\u793a\u914d\u7f6e", icon: "settings", pages: ["settings", "overview-display", "templates"] },
  { title: "\u4efb\u52a1\u7ba1\u7406", description: "\u6267\u884c\u8bb0\u5f55\u4e0e\u53d7\u5ba1\u6062\u590d", icon: "database", pages: ["aggregation", "report-jobs"] },
];
const panelLabels: Record<PortalDomain, string> = { business: "\u4e1a\u52a1\u5e94\u7528", management: "\u914d\u7f6e\u7ba1\u7406\u5bfc\u822a" };
export default function ProductLauncher({ active, preview }: { active: PortalPage; preview: boolean }) {
  const [open, setOpen] = useState(false);
  const firstEntry = useRef<HTMLAnchorElement>(null);
  const domain = portalDomain(active), management = domain === "management";
  const nav = portalNavigation(preview, domain);
  const card = (item: PortalEntry) => <EntryCard key={item.id} ref={item.id === nav[0]?.id ? firstEntry : undefined}
    title={item.label} description={descriptions[item.id]} icon={portalIcons[item.id]} href={item.href}
    target={item.id === "map" ? "_blank" : undefined} rel={item.id === "map" ? "noopener noreferrer" : undefined}
    aria-current={item.id === active ? "page" : undefined}
    meta={item.id === active ? <Icon name="check-circle" size="sm" aria-label={"\u5f53\u524d\u9875\u9762"} /> : undefined}
    className={(management ? "p-lg" : "p-md") + (item.id === active ? " bg-primary-muted" : "")} onClick={() => setOpen(false)} />;
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><ShellIconButton icon="app-grid" label={panelLabels[domain]} className="size-control-2xl rounded-lg"><Icon name="app-grid" size="lg" /></ShellIconButton></PopoverTrigger>
    <ShellPanelContent align="start" aria-label={panelLabels[domain]} onOpenAutoFocus={() => firstEntry.current?.focus()}
      className={"portal-launcher gap-xl p-xl bg-gradient-to-b from-gradient-card-from to-gradient-card-to" + (management ? "" : " portal-launcher-business")}>
      {management ? <>
        <div className="grid gap-xl md:grid-cols-2">
          {managementGroups.map(group => <div key={group.title} className="flex min-w-0 flex-col gap-lg">
            <ShellPanelRow icon={group.icon} label={group.title} description={group.description} />
            <ShellPanelSection divided={false} className="gap-md">
              {group.pages.flatMap(id => { const item = nav.find(entry => entry.id === id); return item ? [card(item)] : []; })}
            </ShellPanelSection>
          </div>)}
        </div>
        <ShellPanelSection><ShellPanelRow icon="arrow-left" label={"\u8fd4\u56de\u4e1a\u52a1\u5e94\u7528"} href="/" linkComponent={Link} chevron={false} onClick={() => setOpen(false)} /></ShellPanelSection>
      </> : <>
        <section aria-label={"\u5168\u5c40\u5165\u53e3"} className="grid gap-xl sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
          {nav.filter(item => item.id === "home" || item.id === "board" || item.id === "map").map(card)}
        </section>
        <Separator />
        <section aria-label={"\u4e1a\u52a1\u677f\u5757"} className="grid gap-xl sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
          {portalBusinessGroups(preview).map(group => <div key={group.key} className="flex min-w-0 flex-col gap-lg">
            <ShellPanelRow icon={group.icon as IconName} label={group.title} className="text-muted-foreground" />
            <ShellPanelSection divided={false} className="gap-md">
              {group.modules.map(item => <EntryCard key={item.key} title={item.label} description={item.description} icon={item.icon as IconName}
                  href={item.planned ? undefined : item.href} aria-current={item.page === active ? "page" : undefined}
                  role={item.planned ? "link" : undefined} aria-disabled={item.planned || undefined} tabIndex={item.planned ? -1 : undefined}
                  meta={item.planned ? <StatusBadge tone="neutral" size="sm">{"\u89c4\u5212\u4e2d"}</StatusBadge> : undefined}
                  className={(item.page === active ? "p-md bg-primary-muted" : "p-md") + (item.planned ? " cursor-not-allowed" : "")}
                  onClick={item.planned ? undefined : () => setOpen(false)} />)}
            </ShellPanelSection>
          </div>)}
        </section>
      </>}
    </ShellPanelContent>
  </Popover>;
}
