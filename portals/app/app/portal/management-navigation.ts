import type { IconName, ShellNavSection } from "@vxture/design-system";
import { portalNavigation, type PortalPage } from "./navigation";

// One product configuration feeds the DS sidebar and management landing page.
const groups: { title: string; pages: PortalPage[] }[] = [
  { title: "\u914d\u7f6e\u7ba1\u7406", pages: ["settings"] },
  { title: "\u4e1a\u52a1\u53c2\u6570", pages: ["metric-catalog", "templates"] },
];
const details: Partial<Record<PortalPage, { icon: IconName; description: string }>> = {
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
  { title: "\u7ec4\u7ec7\u7ba1\u8f96", description: "\u8d23\u4efb\u7ec4\u7ec7\u3001\u7ba1\u8f96\u533a\u57df\u4e0e\u7ad9\u5740\u5173\u8054", available: false },
  { title: "\u6210\u5458\u6743\u9650", description: "\u6210\u5458\u89d2\u8272\u3001\u64cd\u4f5c\u6743\u9650\u4e0e\u6570\u636e\u8303\u56f4", available: false },
  { title: "\u4e1a\u52a1\u53c2\u6570", description: "\u6307\u6807\u5b57\u5178\u4e0e\u6a21\u677f\u5df2\u6709\u5165\u53e3\uff0c\u7ad9\u5740\u5206\u7c7b\u548c\u5206\u6790\u89c4\u5219\u5f85\u8865\u9f50", available: true },
  { title: "\u6570\u636e\u63a5\u5165", description: "\u6388\u6743\u6765\u6e90\u3001\u5bf9\u8c61\u6620\u5c04\u4e0e\u66f4\u65b0\u7b56\u7565", available: false },
  { title: "\u9ad8\u7ea7\u7ba1\u7406", description: "\u914d\u7f6e\u5ba1\u8ba1\u4e0e\u5e73\u53f0\u3001\u6765\u6e90\u8fde\u63a5\u9a8c\u8bc1", available: false },
] as const;
export function managementSections(preview: boolean): ShellNavSection[] {
  return managementNavigation(preview).map((group, index) => ({ ...group, dividerBefore: index > 0 }));
}
