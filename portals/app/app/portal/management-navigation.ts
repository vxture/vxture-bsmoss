import type { IconName, ShellNavSection } from "@vxture/design-system";
import { portalNavigation, type PortalPage } from "./navigation";

// One product configuration feeds the DS sidebar and management landing page.
const groups: { title: string; pages: PortalPage[] }[] = [
  { title: "\u914d\u7f6e\u7ba1\u7406", pages: ["settings"] },
  { title: "\u7ec4\u7ec7\u7ba1\u8f96", pages: ["jurisdiction"] },
  { title: "\u6210\u5458\u6743\u9650", pages: ["members"] },
  { title: "\u4e1a\u52a1\u53c2\u6570", pages: ["site-classifications", "metric-catalog", "analysis-rules", "templates"] },
  { title: "\u6570\u636e\u63a5\u5165", pages: ["source-configurations", "object-mappings"] },
  { title: "\u9ad8\u7ea7\u7ba1\u7406", pages: ["configuration-audit"] },
];
const details: Partial<Record<PortalPage, { icon: IconName; description: string }>> = {
  "object-mappings": { icon: "stack", description: "\u6765\u6e90\u5bf9\u8c61\u4e0e\u7ad9\u5740\u7684\u5173\u8054\u7ef4\u62a4" },
  "site-classifications": { icon: "building", description: "\u7ad9\u70b9\u7c7b\u578b\u3001\u4e1a\u52a1\u573a\u666f\u4e0e\u5171\u4eab\u5206\u7c7b" },
  "analysis-rules": { icon: "faders", description: "\u5206\u6790\u9608\u503c\u3001\u8ba1\u7b97\u53e3\u5f84\u4e0e\u4f7f\u7528\u8fb9\u754c" },
  "source-configurations": { icon: "database", description: "\u6570\u636e\u6765\u6e90\u3001\u4e1a\u52a1\u7c7b\u522b\u4e0e\u63a5\u5165\u65b9\u5f0f" },
  "configuration-audit": { icon: "list-checks", description: "\u6765\u6e90\u914d\u7f6e\u7248\u672c\u3001\u767b\u8bb0\u4f9d\u636e\u4e0e\u6570\u636e\u5e93\u8bb0\u5f55\u4e3b\u4f53" },
  jurisdiction: { icon: "building", description: "\u67e5\u770b\u5df2\u6388\u6743\u7ad9\u5740\u53ca\u5173\u8054\u8d44\u6e90\u8303\u56f4" },
  members: { icon: "users", description: "\u67e5\u770b\u8303\u56f4\u5185\u6210\u5458\u3001\u89d2\u8272\u4e0e\u6570\u636e\u6388\u6743" },
  settings: { icon: "house-line", description: "\u914d\u7f6e\u5165\u53e3\u4e0e\u529f\u80fd\u5efa\u8bbe\u8fdb\u5ea6" },
  "metric-catalog": { icon: "list-checks", description: "\u67e5\u770b\u6307\u6807\u5b9a\u4e49\u3001\u5355\u4f4d\u4e0e\u7edf\u8ba1\u89c4\u5219" },
  templates: { icon: "stack", description: "\u914d\u7f6e\u5206\u6790\u89c6\u56fe\u4e0e\u62a5\u544a\u6a21\u677f\u7248\u672c" },
};
export function managementNavigation(preview: boolean) {
  const nav = portalNavigation(preview, "management");
  return groups.map(group => ({ title: group.title, items: group.pages.flatMap(id => {
    const entry = nav.find(item => item.id === id), detail = details[id];
    return entry && detail ? [{ ...entry, ...detail }] : [];
  }) }));
}

// Roadmap only: no fabricated routes, editable policy or deployment status.
export const managementPlan = [
  { title: "\u7ec4\u7ec7\u7ba1\u8f96", description: "\u5df2\u5177\u5907\u6388\u6743\u7ad9\u5740\u8303\u56f4\u67e5\u8be2\uff1b\u8d23\u4efb\u7ec4\u7ec7\u4e3b\u6863\u4e0e\u5206\u914d\u5f85\u63a5\u5165", available: true },
  { title: "\u6210\u5458\u6743\u9650", description: "\u5df2\u5177\u5907\u6210\u5458\u89d2\u8272\u4e0e\u6570\u636e\u6388\u6743\u53ea\u8bfb\u67e5\u8be2\uff1b\u6388\u6743\u53d8\u66f4\u4e0e\u5ba1\u8ba1\u5f85\u5efa\u8bbe", available: true },
  { title: "\u4e1a\u52a1\u53c2\u6570", description: "\u5206\u7c7b\u3001\u5b57\u5178\u3001\u89c4\u5219\u53ea\u8bfb\u76ee\u5f55\u4e0e\u6a21\u677f\u5df2\u6709\u5165\u53e3\uff1b\u89c4\u5219\u53d1\u5e03\u6cbb\u7406\u5f85\u5efa\u8bbe", available: true },
  { title: "\u6570\u636e\u63a5\u5165", description: "\u5df2\u6709\u6765\u6e90\u4e0e\u6620\u5c04\u67e5\u8be2\u53ca\u53d8\u66f4\u9884\u68c0\uff1b\u4e0b\u6e38\u5f71\u54cd\u8bc4\u4f30\u3001\u53d7\u5ba1\u5199\u5165\u4e0e\u8fde\u63a5\u6838\u9a8c\u5f85\u5efa\u8bbe", available: true },
  { title: "\u9ad8\u7ea7\u7ba1\u7406", description: "\u5df2\u6709\u6765\u6e90\u914d\u7f6e\u7248\u672c\u8bb0\u5f55\uff1b\u6210\u5458\u3001\u6a21\u677f\u7b49\u5176\u4ed6\u914d\u7f6e\u5ba1\u8ba1\u53ca\u8fde\u63a5\u6838\u9a8c\u5f85\u5efa\u8bbe", available: true },
] as const;
export function managementSections(preview: boolean): ShellNavSection[] {
  return managementNavigation(preview).map((group, index) => ({ ...group, dividerBefore: index > 0 }));
}
