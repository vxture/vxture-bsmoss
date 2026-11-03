export type PortalPage = "home" | "map" | "analysis" | "reports" | "aggregation" | "report-jobs" | "templates" | "settings";
export type PortalDomain = "business" | "management";
export interface PortalEntry { id: PortalPage; label: string; href: string; group: PortalDomain }

export function portalDomain(page: PortalPage): PortalDomain {
  return ["settings", "templates", "aggregation", "report-jobs"].includes(page) ? "management" : "business";
}

// These are public route labels, never an authorization decision or data scope.
// Each destination retains its own real identity, entitlement and permission checks.
export function portalNavigation(preview: boolean, domain: PortalDomain = "business"): readonly PortalEntry[] {
  const entries: PortalEntry[] = [
    { id: "home", label: "\u95e8\u6237\u9996\u9875", href: "/", group: "business" },
    ...(preview ? [{ id: "map" as const, label: "\u7ad9\u7f51\u5730\u56fe", href: "/product-preview?hour=18", group: "business" as const }] : []),
    { id: "analysis", label: "\u5468\u671f\u5206\u6790", href: "/analysis", group: "business" },
    { id: "reports", label: "\u62a5\u544a\u4e2d\u5fc3", href: "/reports", group: "business" },
    { id: "settings", label: "\u7ba1\u7406\u603b\u89c8", href: "/settings", group: "management" },
    { id: "templates", label: "\u6307\u6807\u4e0e\u6a21\u677f", href: "/settings/templates", group: "management" },
    { id: "aggregation", label: "\u805a\u5408\u4efb\u52a1", href: "/settings/operations/aggregation", group: "management" },
    { id: "report-jobs", label: "\u62a5\u544a\u4efb\u52a1", href: "/settings/operations/reports", group: "management" },
  ];
  return entries.filter(entry => entry.group === domain);
}
