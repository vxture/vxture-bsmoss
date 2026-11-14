"use client";
import { customerUseIcon, sharingIcon, monitoringIcon, efficiencyIcon, businessUsageIcon, businessAnalysisIcon } from "./business-icons";
import { useRef, useState } from "react";
import {CellTowerIcon} from "@phosphor-icons/react";
import Link from "next/link";
import {usePathname,useSearchParams} from 'next/navigation';
import { Button, Icon, Popover, PopoverTrigger, Separator, ShellIconButton, ShellPanelContent, ShellPanelRow,
  ShellPanelSection, type IconName } from "@vxture/design-system";
import { type PortalDomain, type PortalEntry, type PortalPage } from "./navigation";
import "./header.css";
import {migrationDescription as towerDescription} from "./tower-migration";
import {towerNavigation,towerAnalysisNavigation,towerDataNavigation,towerEntry,towerDomain,towerHome,legacyNavigationTitle} from './tower-navigation';
import {towerNavigationHref} from '../tower-service/links';
import { regionLink } from "./region-scope";
import type { RegionSelection } from "./region-selection";
import { managementNavigation } from "./management-navigation";
export const portalIcons: Record<PortalPage, IconName> = {
  "business-dictionaries": "list-checks",
  monitoring: monitoringIcon,
  "operator-identities": "building-library",
  "customer-use": customerUseIcon,
  sharing: sharingIcon,
  "object-mappings": "stack",
  "site-classifications": "building", "analysis-rules": "faders",
  "source-configurations": "database", "configuration-audit": "list-checks",
  members: "users", jurisdiction: "shield-check",
  "metric-catalog": "list-checks",
  "data-updates": "database",
  "overview-display": "faders",
  "review-history": "list-checks",
  "usage-review": "search",
  capacity: "gauge", efficiency: efficiencyIcon, "operator-usage": businessUsageIcon, "usage-reports": "newspaper",
  home: "house-line", board: "chart-bar", sites: "building", map: "map-pin", analysis: businessAnalysisIcon, reports: "file-text",
  aggregation: "database", "report-jobs": "calendar", templates: "stack", settings: "faders",
};
const descriptions: Record<PortalPage, string> = {
  "business-dictionaries": "\u7ad9\u5740\u5206\u7c7b\u3001\u6307\u6807\u5b9a\u4e49\u4e0e\u7edf\u8ba1\u53e3\u5f84",
  monitoring: "\u76d1\u6d4b\u8986\u76d6\u3001\u8fd0\u884c\u72b6\u6001\u4e0e\u544a\u8b66\u4f9d\u636e",
  sharing: "\u7ad9\u5740\u5171\u4eab\u7a0b\u5ea6\u4e0e\u5165\u9a7b\u7ed3\u6784",
  "operator-identities": "\u8fd0\u8425\u4e3b\u4f53\u540d\u79f0\u4e0e\u6807\u8bc6\u7ef4\u62a4",
  "customer-use": "\u8fd0\u8425\u5546\u5165\u9a7b\u4e0e\u8d44\u6e90\u4f7f\u7528",
  "object-mappings": "\u5916\u90e8\u5bf9\u8c61\u4e0e\u4e1a\u52a1\u76ee\u6807\u5173\u8054",
  "source-configurations": "\u6570\u636e\u6765\u6e90\u3001\u5bf9\u8c61\u6620\u5c04\u4e0e\u6765\u6e90\u7248\u672c", "configuration-audit": "\u6765\u6e90\u7248\u672c\u4e0e\u767b\u8bb0\u4f9d\u636e\u8ffd\u6eaf",
  "site-classifications": "\u7ad9\u70b9\u7c7b\u578b\u3001\u573a\u666f\u4e0e\u5171\u4eab\u5206\u7c7b", "analysis-rules": "\u5206\u6790\u53e3\u5f84\u4e0e\u5224\u5b9a\u8fb9\u754c",
  members: "\u6210\u5458\u89d2\u8272\u4e0e\u6570\u636e\u6388\u6743", jurisdiction: "\u7ba1\u8f96\u8303\u56f4\u3001\u6210\u5458\u4e0e\u6743\u9650",
  "metric-catalog": "\u6307\u6807\u5b9a\u4e49\u3001\u5355\u4f4d\u4e0e\u7edf\u8ba1\u89c4\u5219",
  "data-updates": "\u4e3b\u6570\u636e\u540c\u6b65\u4e0e\u6307\u6807\u5904\u7406",
  "review-history": "\u539f\u56e0\u786e\u8ba4\u4e0e\u590d\u6838\u5386\u53f2",
  "overview-display": "\u9996\u9875\u6307\u6807\u3001\u6392\u5e8f\u4e0e\u5355\u4f4d",
  "usage-review": "\u7528\u91cf\u6838\u9a8c\u3001\u539f\u56e0\u786e\u8ba4\u4e0e\u6838\u9a8c\u8bb0\u5f55",
  capacity: "\u8d1f\u8f7d\u4e0e\u63a5\u901a\u8d28\u91cf", efficiency: "\u4f9b\u7535\u4e0e\u80fd\u8017\u89c2\u5bdf", "operator-usage": "\u4e1a\u52a1\u89c4\u6a21\u4e0e\u7ad9\u5740\u8d21\u732e", "usage-reports": "\u5468\u671f\u62a5\u544a\u4e0e\u5bfc\u51fa",
  sites: "\u7ad9\u5740\u3001\u8bbe\u5907\u4e0e\u540c\u6b65\u7ef4\u62a4",
  home: "\u65e5\u5e38\u5de5\u4f5c\u4e0e\u4e1a\u52a1\u6982\u89c8", board: "\u5168\u7701\u6001\u52bf\u4e0e\u91cd\u70b9\u5173\u6ce8", map: "\u7a7a\u95f4\u5b9a\u4f4d\u4e0e\u5355\u7ad9\u8c03\u67e5",
  analysis: "\u65e5\u3001\u5468\u3001\u6708\u7528\u91cf\u8d8b\u52bf", reports: "\u5468\u671f\u62a5\u544a\u4e0e\u8bc1\u636e\u8ffd\u6eaf", settings: "\u7ec4\u7ec7\u3001\u6743\u9650\u4e0e\u4e1a\u52a1\u53c2\u6570",
  templates: "\u6307\u6807\u53e3\u5f84\u4e0e\u62a5\u544a\u6a21\u677f", aggregation: "\u805a\u5408\u8bb0\u5f55\u4e0e\u5931\u8d25\u6062\u590d", "report-jobs": "\u751f\u6210\u3001\u5bfc\u51fa\u4e0e\u6267\u884c\u8bb0\u5f55",
};
const panelLabels: Record<PortalDomain, string> = { business: "\u4e1a\u52a1\u5e94\u7528", management: "\u914d\u7f6e\u7ba1\u7406\u5bfc\u822a" };
const migrationDescription = (description: string | undefined, page: PortalPage | undefined) => page ? towerDescription(page,description) : description;
export default function ProductLauncher({ active, preview, regionSelection }: { active: PortalPage; preview: boolean; regionSelection?: RegionSelection }) {
  const [open, setOpen] = useState(false);
  const pathname=usePathname(),towerQuery=useSearchParams().toString();
  const firstEntry = useRef<HTMLAnchorElement>(null);
  const domain = towerDomain(pathname,active), management = domain === "management";
  const available=towerNavigation.filter(t=>t.domain===domain);
  const destination=(t:{id:string;path:string;href?:string;label:string;description:string;icon:IconName},first=false)=>{const info=t,selected=towerEntry(pathname)?.id===t.id||pathname===t.path||pathname.startsWith(t.path+'/');return <Button key={t.id} asChild variant={selected?'secondary':'ghost'} className="h-auto min-w-0 justify-start gap-sm px-sm py-xs"><Link ref={first?firstEntry:undefined} href={towerNavigationHref(regionSelection?regionLink(t.href??t.path,regionSelection):(t.href??t.path),pathname,towerQuery)} target={t.id==='network'?'_blank':undefined} rel={t.id==='network'?'noopener noreferrer':undefined} aria-current={selected?'page':undefined} onClick={()=>setOpen(false)}>{t.id==='resources'?<CellTowerIcon aria-hidden="true" className="size-icon-md shrink-0 text-muted-foreground"/>:<Icon name={info.icon} size="md" className="shrink-0 text-muted-foreground"/>}<span className="flex min-w-0 flex-col"><span className="truncate text-label">{info.label}</span><span className="truncate text-body-small text-muted-foreground">{info.description}</span></span></Link></Button>;};
  const primaryLauncherPage=!!towerEntry(pathname)||pathname==='/reports'||pathname.startsWith('/reports/');
  const businessRows=[
    {label:'\u4e0a\u5c42\u5165\u53e3',items:['overview','network'].flatMap(id=>available.filter(item=>item.id===id))},
    {label:'\u5206\u6790\u7ec4',items:towerAnalysisNavigation},
    {label:'\u4e0b\u5c42\u5165\u53e3',items:[...available.filter(item=>item.id==='resources'),towerDataNavigation,...available.filter(item=>item.id==='reports')]}
  ];
  const migrated=management?<section aria-label={'\u914d\u7f6e\u7ba1\u7406\u677f\u5757'} className="grid grid-cols-2 gap-sm sm:grid-cols-3">{available.map((item,i)=>destination(item,i===0))}</section>:<section aria-label={'\u4e1a\u52a1\u5e94\u7528\u677f\u5757'} className="flex min-w-0 flex-col gap-md">{businessRows.map((row,index)=><div key={row.label} className="flex min-w-0 flex-col gap-md">{index>0&&<Separator/>}<section aria-label={row.label} className="grid grid-cols-2 gap-sm sm:grid-cols-3">{row.items.map((item,i)=>destination(item,index===0&&i===0))}</section></div>)}</section>;
  const current = (id: PortalPage) => !pathname.startsWith("/tower-service/") && (id === active || id === "usage-review" && active === "review-history");
  const entryClass = "w-full min-w-0 justify-start gap-xs px-xs sm:px-sm text-left";
  const card = (item: PortalEntry) => <Button key={item.id} asChild variant={current(item.id) ? "secondary" : "ghost"}
    className={entryClass + " h-auto py-xs"}>
    <Link href={regionSelection ? regionLink(item.href, regionSelection) : item.href}
      target={item.id === "map" ? "_blank" : undefined} rel={item.id === "map" ? "noopener noreferrer" : undefined}
      aria-current={current(item.id) ? "page" : undefined} aria-description={migrationDescription(descriptions[item.id], item.id)} onClick={() => setOpen(false)}>
      <Icon name={portalIcons[item.id]} size="md" className="shrink-0 text-muted-foreground" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-label">{item.label}</span>
        <span className="truncate text-body-small text-muted-foreground">{migrationDescription(descriptions[item.id], item.id)}</span>
      </span>
      {current(item.id) && <Icon name="check" size="xs" className="hidden shrink-0 text-muted-foreground sm:inline-flex" aria-label={"\u5f53\u524d\u9875\u9762"} />}
    </Link>
  </Button>;
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><ShellIconButton icon="app-grid" label={panelLabels[domain]} className="size-control-xl"><Icon name="app-grid" size="lg" /></ShellIconButton></PopoverTrigger>
    <ShellPanelContent align="start" aria-label={panelLabels[domain]} onOpenAutoFocus={event => { if(firstEntry.current){event.preventDefault();firstEntry.current.focus();} }}
      className={"portal-launcher gap-md p-md sm:p-lg" + (management ? "" : " portal-launcher-business")}>
      {management ? <>
        {migrated}<Separator/><details open={!primaryLauncherPage} className="flex min-w-0 flex-col gap-md"><summary className="cursor-pointer text-body-small text-muted-foreground">{legacyNavigationTitle}</summary><div className="flex min-w-0 flex-col gap-md pt-md">
        <div className="grid gap-x-lg gap-y-md md:grid-cols-2">
          {managementNavigation(preview).map(group => <div key={group.title} className="flex min-w-0 flex-col gap-xs">
            <h2 className="px-xs text-body-small text-muted-foreground sm:px-sm">{group.title}</h2>
            <ShellPanelSection divided={false} className="gap-xs">
              {group.items.map(card)}
            </ShellPanelSection>
          </div>)}
        </div>
        </div></details>
        <ShellPanelSection><ShellPanelRow icon="arrow-left" label={"\u8fd4\u56de\u4e1a\u52a1"} href={towerHome} linkComponent={Link} chevron={false} onClick={() => setOpen(false)} /></ShellPanelSection>
      </> : migrated}
    </ShellPanelContent>
  </Popover>;
}
