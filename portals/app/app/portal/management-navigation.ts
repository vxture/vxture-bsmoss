import type { IconName, ShellNavSection } from "@vxture/design-system";
import { portalNavigation, type PortalPage } from "./navigation";
import {towerNavigation,legacyNavigationTitle} from './tower-navigation';

// One product configuration feeds the DS sidebar and management landing page.
const groups: { title: string; pages: PortalPage[] }[] = [
  { title: "\u914d\u7f6e\u7ba1\u7406", pages: ["settings", "overview-display"] },
  { title: "\u7ec4\u7ec7\u4e0e\u6743\u9650", pages: ["jurisdiction"] },
  { title: "\u4e1a\u52a1\u53c2\u6570", pages: ["operator-identities", "business-dictionaries", "analysis-rules", "templates"] },
  { title: "\u6570\u636e\u63a5\u5165", pages: ["source-configurations"] },
];
const details: Partial<Record<PortalPage, { icon: IconName; description: string }>> = {
  "overview-display": {icon: "faders", description: "\u9996\u9875\u663e\u793a\u6307\u6807\u3001\u987a\u5e8f\u548c\u5355\u4f4d"},
  "operator-identities": { icon: "building-library", description: "\u8fd0\u8425\u4e3b\u4f53\u5168\u79f0\u3001\u7b80\u79f0\u4e0e\u54c1\u724c\u6807\u8bc6" },
  "business-dictionaries": { icon: "list-checks", description: "\u7ad9\u5740\u5206\u7c7b\u3001\u6307\u6807\u5b9a\u4e49\u4e0e\u7edf\u8ba1\u53e3\u5f84" },
  "analysis-rules": { icon: "faders", description: "\u5206\u6790\u9608\u503c\u3001\u8ba1\u7b97\u53e3\u5f84\u4e0e\u4f7f\u7528\u8fb9\u754c" },
  "source-configurations": { icon: "database", description: "\u6570\u636e\u6765\u6e90\u3001\u5bf9\u8c61\u6620\u5c04\u4e0e\u6765\u6e90\u7248\u672c" },
  jurisdiction: { icon: "shield-check", description: "\u7ad9\u5740\u7ba1\u8f96\u3001\u6210\u5458\u89d2\u8272\u4e0e\u6388\u6743\u8303\u56f4" },
  settings: { icon: "house-line", description: "\u4e1a\u52a1\u914d\u7f6e\u4e0e\u7ba1\u7406\u5165\u53e3" },
  templates: { icon: "stack", description: "\u914d\u7f6e\u5206\u6790\u89c6\u56fe\u4e0e\u62a5\u544a\u6a21\u677f\u7248\u672c" },
};
export function managementNavigation(preview: boolean) {
  const nav = portalNavigation(preview, "management");
  return groups.map(group => ({ title: group.title, items: group.pages.flatMap(id => {
    const entry = nav.find(item => item.id === id), detail = details[id];
    return entry && detail ? [{ ...entry, ...detail }] : [];
  }) }));
}

export function managementSections(preview: boolean): ShellNavSection[] {
  return [
    {title:'\u914d\u7f6e\u7ba1\u7406',brandPosition:'none',items:towerNavigation.filter(t=>t.domain==='management').map(t=>({label:t.label,href:t.path,icon:t.icon,description:t.description}))},
    {title:legacyNavigationTitle,brandPosition:'none',items:managementNavigation(preview).flatMap(group=>group.items)},
  ];
}
