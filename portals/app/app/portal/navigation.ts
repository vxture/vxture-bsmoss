import { customerUseIcon, sharingIcon, monitoringIcon, capacityIcon, efficiencyIcon, businessUsageIcon, businessAnalysisIcon } from "./business-icons";
export type PortalPage = "business-dictionaries" | "monitoring" | "operator-identities" | "customer-use" | "sharing" | "object-mappings" | "source-configurations" | "configuration-audit" | "site-classifications" | "analysis-rules" | "members" | "jurisdiction" | "metric-catalog" | "data-updates" | "overview-display" | "review-history" | "usage-review" | "capacity" | "efficiency" | "operator-usage" | "usage-reports" | "home" | "board" | "sites" | "map" | "analysis" | "reports" | "aggregation" | "report-jobs" | "templates" | "settings";
export type PortalDomain = "business" | "management";
export interface PortalEntry { id: PortalPage; label: string; href: string; group: PortalDomain }
export interface BusinessModule {
  key: string; label: string; icon: string; description: string;
  page?: PortalPage; href?: string; planned?: boolean;
}
export interface BusinessGroup { key: string; title: string; description: string; icon: string; modules: BusinessModule[] }
// Existing analysis stays usable while its business scope is migrated.
export function portalAnalysisMigrationPending(page?: PortalPage): boolean {
  return page !== undefined && ["customer-use", "monitoring", "efficiency", "capacity", "analysis", "usage-review"].includes(page);
}
export function portalDomain(page: PortalPage): PortalDomain {
  return ["business-dictionaries", "overview-display", "operator-identities", "object-mappings", "source-configurations", "configuration-audit", "site-classifications", "analysis-rules", "members", "jurisdiction", "metric-catalog", "settings", "templates"].includes(page) ? "management" : "business";
}
// Public navigation never grants access; destinations keep their own checks.
export function portalNavigation(preview: boolean, domain: PortalDomain = "business"): readonly PortalEntry[] {
  const entries: PortalEntry[] = [
    {id:"monitoring",label:"\u8fd0\u884c\u76d1\u6d4b",href:"/monitoring",group:"business"},
    {id:"customer-use",label:"\u5ba2\u6237\u4f7f\u7528",href:"/customer-use",group:"business"},
    { id: "home", label: "\u8fd0\u884c\u603b\u89c8", href: "/", group: "business" },
    { id: "board", label: "\u7efc\u5408\u7814\u5224", href: "/board", group: "business" },
    ...(preview ? [{ id: "map" as const, label: "\u7ad9\u7f51\u5168\u666f", href: "/product-preview?hour=18", group: "business" as const }] : []),
    { id: "sites", label: "\u7ad9\u5740\u7ba1\u7406", href: "/sites", group: "business" },
    { id: "capacity", label: "\u627f\u8f7d\u80fd\u529b", href: "/capacity", group: "business" },
    { id: "efficiency", label: "\u8fd0\u884c\u80fd\u6548", href: "/efficiency", group: "business" },
    { id: "analysis", label: "\u7ecf\u8425\u5206\u6790", href: "/analysis", group: "business" },
    { id: "reports", label: "\u62a5\u544a\u4e2d\u5fc3", href: "/reports", group: "business" },
    { id: "usage-review", label: "\u7528\u91cf\u6838\u9a8c", href: "/usage-review", group: "business" },
    { id: "data-updates", label: "\u6570\u636e\u66f4\u65b0", href: "/operations/data-updates", group: "business" },
    { id: "operator-identities", label: "\u8fd0\u8425\u4e3b\u4f53", href: "/settings/operators", group: "management" },
    { id: "settings", label: "\u7ba1\u7406\u603b\u89c8", href: "/settings", group: "management" },
    { id: "overview-display", label: "\u603b\u89c8\u8bbe\u7f6e", href: "/settings/overview", group: "management" },
    { id: "jurisdiction", label: "\u7ec4\u7ec7\u4e0e\u6743\u9650", href: "/settings/access", group: "management" },
    { id: "business-dictionaries", label: "\u4e1a\u52a1\u5b57\u5178", href: "/settings/dictionaries", group: "management" },
    { id: "analysis-rules", label: "\u5206\u6790\u89c4\u5219", href: "/settings/rules", group: "management" },
    { id: "source-configurations", label: "\u6570\u636e\u63a5\u5165", href: "/settings/data-access", group: "management" },
    { id: "templates", label: "\u6a21\u677f\u914d\u7f6e", href: "/settings/templates", group: "management" },
  ];
  return entries.filter(entry => entry.group === domain);
}
export function portalLauncherEntries(preview: boolean, tier: "overview" | "tools"): PortalEntry[] {
  const nav = portalNavigation(preview);
  const ids: PortalPage[] = tier === "overview" ? ["home", "board", "map"] : ["reports", "data-updates", "usage-review"];
  return ids.flatMap(id => { const entry = nav.find(item => item.id === id); return entry ? [entry] : []; });
}
export function portalBusinessGroups(_preview: boolean): BusinessGroup[] {
  const planned = (key: string, label: string, icon: string, description: string): BusinessModule => ({key, label, icon, description, planned: true});
  const specs = [
    ["runtime", "\u8fd0\u884c", "gauge", [["efficiency", "\u8fd0\u884c\u80fd\u6548", "\u7528\u7535\u89c4\u6a21\u3001\u80fd\u8017\u5f3a\u5ea6\u4e0e\u91cd\u70b9\u7ad9\u5740"], ["monitoring", "\u8fd0\u884c\u76d1\u6d4b", "\u76d1\u6d4b\u8986\u76d6\u3001\u8fd0\u884c\u72b6\u6001\u4e0e\u544a\u8b66\u4f9d\u636e"], ["risks", "\u8d8b\u52bf\u7814\u5224", "\u5468\u671f\u53d8\u5316\u3001\u53cd\u590d\u5f02\u5e38\u4e0e\u91cd\u70b9\u5173\u6ce8"]]],
    ["operations", "\u8fd0\u8425", "building", [["sites", "\u7ad9\u5740\u7ba1\u7406", "\u7ad9\u5740\u3001\u8bbe\u5907\u4e0e\u540c\u6b65\u7ef4\u62a4"], ["bearing", "\u627f\u8f7d\u80fd\u529b", "\u8d44\u6e90\u8d1f\u8f7d\u3001\u63a5\u901a\u8868\u73b0\u4e0e\u91cd\u70b9\u7ad9\u5740"], ["demand", "\u9700\u6c42\u5339\u914d", "\u8fd0\u8425\u5546\u9700\u6c42\u4e0e\u7ad9\u5740\u80fd\u529b\u5339\u914d"], ["quality", "\u670d\u52a1\u8d28\u91cf", "\u670d\u52a1\u53ef\u7528\u6027\u3001\u4e2d\u65ad\u4e0e\u6062\u590d\u6548\u7387"], ["fulfillment", "\u5c65\u7ea6\u4fdd\u969c", "\u4ea4\u4ed8\u5f00\u901a\u3001\u5907\u7535\u4e0e\u6062\u590d\u65f6\u9650\u8fbe\u6210"]]],
    ["business", "\u7ecf\u8425", "chart-line-up", [["customer-use", "\u5ba2\u6237\u4f7f\u7528", "\u8fd0\u8425\u5546\u5165\u9a7b\u3001\u7ad9\u5740\u5171\u4eab\u4e0e\u4e1a\u52a1\u7528\u91cf"], ["analysis", "\u7ecf\u8425\u5206\u6790", "\u5386\u53f2\u8d8b\u52bf\u3001\u540c\u6bd4\u4e0e\u540c\u7c7b\u5bf9\u6807"], ["revenue", "\u8425\u6536\u5206\u6790", "\u6536\u5165\u89c4\u6a21\u3001\u7ed3\u6784\u3001\u8d21\u732e\u4e0e\u8d8b\u52bf"], ["benefit", "\u6210\u672c\u6548\u76ca", "\u5efa\u8bbe\u3001\u80fd\u8017\u3001\u7ef4\u62a4\u6210\u672c\u4e0e\u6295\u5165\u4ea7\u51fa"]]],
  ] as const;
  const groups: BusinessGroup[] = specs.map(([key,title,icon,modules]) => ({key,title,icon,description:title,modules:modules.map(([key,label,description]) => { const migrated = key === "analysis" ? { page: "analysis" as const, href: "/analysis" } : key === "sites" ? { page: "sites" as const, href: "/sites" } : key === "efficiency" ? { page: "efficiency" as const, href: "/efficiency" } : key === "bearing" ? { page: "capacity" as const, href: "/capacity" } : key === "monitoring" ? { page: "monitoring" as const, href: "/monitoring" } : key === "customer-use" ? { page: "customer-use" as const, href: "/customer-use" } : undefined; return { ...(migrated ?? planned(key,label,{analysis:businessAnalysisIcon,sites:"building",["operator-usage"]:businessUsageIcon,efficiency:efficiencyIcon,monitoring:monitoringIcon,["runtime-state"]:"pulse",faults:"warning",risks:"trend-up",bearing:capacityIcon,demand:"target",quality:"shield-check",fulfillment:"seal-check",["customer-use"]:customerUseIcon,sharing:sharingIcon,revenue:"currency-cny",benefit:"scales"}[key] ?? icon,description)), key, label, description, icon: {analysis:businessAnalysisIcon,sites:"building",["operator-usage"]:businessUsageIcon,efficiency:efficiencyIcon,monitoring:monitoringIcon,["runtime-state"]:"pulse",faults:"warning",risks:"trend-up",bearing:capacityIcon,demand:"target",quality:"shield-check",fulfillment:"seal-check",["customer-use"]:customerUseIcon,sharing:sharingIcon,revenue:"currency-cny",benefit:"scales"}[key] ?? icon }; })}));
  return groups;
}
export function portalPendingMigration(preview: boolean): BusinessModule[] {
  const assigned: PortalPage[] = ["analysis","monitoring","home","board","map","sites","data-updates","reports","customer-use","sharing","capacity","efficiency","operator-usage","usage-reports","usage-review","review-history"];
  return portalNavigation(preview).filter(item=>!assigned.includes(item.id)).map(item=>({key:item.id,page:item.id,label:item.label,href:item.href,icon:"stack",description:"\u4fdd\u7559\u73b0\u6709\u529f\u80fd\uff0c\u5f85\u786e\u8ba4\u5f52\u5c5e\u5e76\u8fc1\u79fb"}));
}
