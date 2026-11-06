import type { IconName, ShellNavSection } from "@vxture/design-system";
import { portalNavigation, type PortalPage } from "./navigation";

// One product configuration feeds the DS sidebar and management landing page.
const groups: { title: string; pages: PortalPage[] }[] = [
  { title: "\u914d\u7f6e\u7ba1\u7406", pages: ["settings", "overview-display", "templates"] },
  { title: "\u4efb\u52a1\u7ba1\u7406", pages: ["data-updates", "aggregation", "report-jobs"] },
];
const details: Partial<Record<PortalPage, { icon: IconName; description: string }>> = {
  settings: { icon: "house-line", description: "\u7ba1\u7406\u5165\u53e3\u4e0e\u663e\u793a\u504f\u597d" },
  "overview-display": { icon: "faders", description: "\u8c03\u6574\u603b\u89c8\u6307\u6807\u3001\u987a\u5e8f\u4e0e\u663e\u793a\u5355\u4f4d" },
  templates: { icon: "stack", description: "\u7ba1\u7406\u6307\u6807\u53e3\u5f84\u4e0e\u62a5\u544a\u6a21\u677f\u7248\u672c" },
  "data-updates": { icon: "refresh", description: "\u8ffd\u8e2a\u589e\u91cf\u5904\u7406\u8fdb\u5ea6\u4e0e\u5931\u8d25\u6062\u590d" },
  aggregation: { icon: "database", description: "\u67e5\u770b\u805a\u5408\u6267\u884c\u4e0e\u53d7\u5ba1\u6062\u590d\u8bb0\u5f55" },
  "report-jobs": { icon: "file-text", description: "\u8ffd\u8e2a\u62a5\u544a\u751f\u6210\u3001\u5bfc\u51fa\u4e0e\u6267\u884c\u8bb0\u5f55" },
};
export function managementNavigation(preview: boolean) {
  const nav = portalNavigation(preview, "management");
  return groups.map(group => ({ title: group.title, items: group.pages.flatMap(id => {
    const entry = nav.find(item => item.id === id), detail = details[id];
    return entry && detail ? [{ ...entry, ...detail }] : [];
  }) }));
}
export function managementSections(preview: boolean): ShellNavSection[] {
  return managementNavigation(preview).map((group, index) => ({ ...group, dividerBefore: index > 0 }));
}
