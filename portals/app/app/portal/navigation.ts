export type PortalPage = "home" | "map" | "analysis" | "reports" | "aggregation" | "report-jobs" | "templates" | "settings";
export interface PortalEntry { id: PortalPage; label: string; href: string; group: "business" | "management" }

// These are public route labels, never an authorization decision or data scope.
// Each destination retains its own real identity, entitlement and permission checks.
export function portalNavigation(preview: boolean): readonly PortalEntry[] {
  return [
    { id: "home", label: "\u95e8\u6237\u9996\u9875", href: "/", group: "business" },
    ...(preview ? [{ id: "map" as const, label: "\u7ad9\u7f51\u5730\u56fe", href: "/product-preview?hour=18", group: "business" as const }] : []),
    { id: "analysis", label: "\u5468\u671f\u5206\u6790", href: "/analysis", group: "business" },
    { id: "reports", label: "\u62a5\u544a\u4e2d\u5fc3", href: "/reports", group: "business" },
    { id: "aggregation", label: "\u805a\u5408\u4efb\u52a1", href: "/operations/aggregation", group: "management" },
    { id: "report-jobs", label: "\u62a5\u544a\u4efb\u52a1", href: "/operations/reports", group: "management" },
    { id: "templates", label: "\u6307\u6807\u4e0e\u6a21\u677f", href: "/settings/templates", group: "management" },
    { id: "settings", label: "\u914d\u7f6e\u4e2d\u5fc3", href: "/settings", group: "management" },
  ];
}
