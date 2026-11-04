export type PortalPage = "usage-review" | "capacity" | "efficiency" | "operator-usage" | "usage-reports" | "home" | "board" | "sites" | "map" | "analysis" | "reports" | "aggregation" | "report-jobs" | "templates" | "settings";
export type PortalDomain = "business" | "management";
export interface PortalEntry { id: PortalPage; label: string; href: string; group: PortalDomain }
export interface BusinessModule {
  key: string; label: string; icon: string; description: string;
  page?: PortalPage; href?: string; planned?: boolean;
}
export interface BusinessGroup { key: string; title: string; description: string; icon: string; modules: BusinessModule[] }
export function portalDomain(page: PortalPage): PortalDomain {
  return ["settings", "templates", "aggregation", "report-jobs"].includes(page) ? "management" : "business";
}
// Public navigation never grants access; destinations keep their own checks.
export function portalNavigation(preview: boolean, domain: PortalDomain = "business"): readonly PortalEntry[] {
  const entries: PortalEntry[] = [
    { id: "home", label: "\u8fd0\u884c\u603b\u89c8", href: "/", group: "business" },
    { id: "board", label: "\u51b3\u7b56\u5206\u6790", href: "/board", group: "business" },
    ...(preview ? [{ id: "map" as const, label: "\u7ad9\u7f51\u5730\u56fe", href: "/product-preview?hour=18", group: "business" as const }] : []),
    { id: "sites", label: "\u7ad9\u5740\u7ba1\u7406", href: "/sites", group: "business" },
    { id: "capacity", label: "\u5bb9\u91cf\u4e0e\u8d28\u91cf", href: "/capacity", group: "business" },
    { id: "efficiency", label: "\u8fd0\u884c\u4e0e\u80fd\u6548", href: "/efficiency", group: "business" },
    { id: "operator-usage", label: "\u8fd0\u8425\u5546\u7528\u91cf", href: "/operator-usage", group: "business" },
    { id: "usage-reports", label: "\u7528\u91cf\u62a5\u544a", href: "/usage-reports", group: "business" },
    { id: "analysis", label: "\u5468\u671f\u5206\u6790", href: "/analysis", group: "business" },
    { id: "reports", label: "\u62a5\u544a\u4e2d\u5fc3", href: "/reports", group: "business" },
    { id: "usage-review", label: "\u7528\u91cf\u6838\u9a8c", href: "/usage-review", group: "business" },
    { id: "settings", label: "\u7ba1\u7406\u603b\u89c8", href: "/settings", group: "management" },
    { id: "templates", label: "\u6307\u6807\u4e0e\u6a21\u677f", href: "/settings/templates", group: "management" },
    { id: "aggregation", label: "\u805a\u5408\u4efb\u52a1", href: "/settings/operations/aggregation", group: "management" },
    { id: "report-jobs", label: "\u62a5\u544a\u4efb\u52a1", href: "/settings/operations/reports", group: "management" },
  ];
  return entries.filter(entry => entry.group === domain);
}
export function portalBusinessGroups(preview: boolean): BusinessGroup[] {
  const nav = portalNavigation(preview);
  const page = (id: PortalPage, icon: string, description: string): BusinessModule[] => {
    const entry = nav.find(item => item.id === id);
    return entry ? [{ key: id, page: id, label: entry.label, href: entry.href, icon, description }] : [];
  };
  const planned = (key: string, label: string, icon: string, description: string): BusinessModule =>
    ({ key, label, icon, description, planned: true });
  return [
    { key: "resources", title: "\u7ad9\u5740\u8d44\u6e90", icon: "building", description: "\u6863\u6848\u4e0e\u670d\u52a1\u5173\u7cfb", modules: [
      ...page("sites", "building", "\u53f0\u8d26\u3001\u8d44\u6e90\u4e0e\u7edf\u4e00\u6863\u6848"),
      { key: "service-relations", label: "\u670d\u52a1\u5173\u7cfb", icon: "users", description: "\u8fd0\u8425\u5546\u4e0e\u8bbe\u5907\u8d44\u6e90", href: "/sites?view=relations" },
    ] },
    { key: "supervision", title: "\u8fd0\u884c\u76d1\u7ba1", icon: "gauge", description: "\u72b6\u6001\u3001\u8d28\u91cf\u4e0e\u80fd\u6548", modules: [
      ...(preview ? [
        { key: "capacity", label: "\u5bb9\u91cf\u4e0e\u8d28\u91cf", icon: "gauge", description: "\u8d1f\u8f7d\u4e0e\u63a5\u901a\u8d28\u91cf", page: "capacity" as const, href: "/capacity" },
        { key: "efficiency", label: "\u8fd0\u884c\u4e0e\u80fd\u6548", icon: "lightning", description: "\u7269\u7406\u7535\u8017\u4e0e\u8fd0\u884c\u53c2\u6570", page: "efficiency" as const, href: "/efficiency" },
      ] : [planned("runtime", "\u8fd0\u884c\u72b6\u6001", "gauge", "\u6b63\u5f0f\u76d1\u7ba1\u89c6\u56fe\u5f85\u63a5\u5165")]),
    ] },
    { key: "business", title: "\u7ecf\u8425\u5206\u6790", icon: "chart-line-up", description: "\u7528\u91cf\u3001\u7ed3\u6784\u4e0e\u8d8b\u52bf", modules: [
      ...page("analysis", "chart-line-up", "\u6388\u6743\u5468\u671f\u6307\u6807\u4e0e\u8bc1\u636e"),
      ...(preview ? [{ key: "operator-usage", label: "\u8fd0\u8425\u5546\u7528\u91cf", icon: "chart-pie", description: "\u901a\u8bdd\u3001\u6d41\u91cf\u4e0e\u77ed\u4fe1", page: "operator-usage" as const, href: "/operator-usage" }] : []),
    ] },
    { key: "verification", title: "\u5f02\u5e38\u6838\u9a8c", icon: "shield-check", description: "\u53d1\u73b0\u3001\u8bc1\u636e\u4e0e\u590d\u6838", modules: [
      ...(preview ? page("usage-review", "search", "\u6ce2\u52a8\u3001\u96f6\u91cf\u4e0e\u7f3a\u6570") : [planned("usage-review", "\u7528\u91cf\u6838\u9a8c", "search", "\u6ce2\u52a8\u3001\u96f6\u91cf\u4e0e\u7f3a\u6570")]),
      planned("review-history", "\u6838\u9a8c\u8bb0\u5f55", "list-checks", "\u539f\u56e0\u786e\u8ba4\u4e0e\u590d\u6838\u5386\u53f2"),
    ] },
    { key: "reporting", title: "\u62a5\u544a\u4e2d\u5fc3", icon: "file-text", description: "\u5468\u671f\u6210\u679c\u4e0e\u8ffd\u6eaf", modules: [
      ...page("reports", "file-text", "\u62a5\u544a\u5e93\u4e0e\u5386\u53f2\u7248\u672c"),
      ...(preview ? [{ key: "report-preview", label: "\u7528\u91cf\u62a5\u544a", icon: "newspaper", description: "\u65e5\u5468\u6708\u62a5\u544a\u4e0e\u5bfc\u51fa", page: "usage-reports" as const, href: "/usage-reports" }] : []),
    ] },
  ];
}
