"use client";
import PageHeading from "../portal/page-heading";
import { EntryCard, PanelCard, ShellPageContainer, StatusBadge } from "@vxture/design-system";
import { managementNavigation, managementPlan } from "../portal/management-navigation";
export default function ConfigurationPage({ preview }: { preview: boolean }) {
  const groups = managementNavigation(preview).filter(group => group.items.some(item => item.id !== "settings"));
  return <ShellPageContainer className="gap-xl">
    <PageHeading title={"\u7ba1\u7406\u603b\u89c8"} description={"\u7ba1\u7406\u7ec4\u7ec7\u7ba1\u8f96\u3001\u6210\u5458\u6743\u9650\u3001\u4e1a\u52a1\u53c2\u6570\u4e0e\u63a5\u5165\u89c4\u5219"} />
    <div className="grid min-w-0 gap-xl md:grid-cols-2">{groups.map(group => <section key={group.title} className={"flex min-w-0 flex-col gap-md"+(group.items.length>1?" md:col-span-2":"")} aria-label={group.title}>
      <h2 className="text-heading-2 font-semibold">{group.title}</h2>
      <div className={"grid min-w-0 gap-lg"+(group.items.length>1?" md:grid-cols-2":"")}>{group.items.filter(item => item.id !== "settings").map(item => <EntryCard key={item.id} href={item.href}
        icon={item.icon} title={item.label} description={item.description} className="h-full p-xl" />)}</div>
    </section>)}</div>
    <PanelCard title={"\u7ba1\u7406\u8303\u56f4"} description={"\u6309\u4ea7\u54c1\u7ba1\u7406\u804c\u8d23\u9010\u9879\u5efa\u8bbe\uff0c\u5bfc\u822a\u4ec5\u663e\u793a\u5df2\u5177\u5907\u7684\u9875\u9762"} tone="neutral">
      <div className="divide-y divide-border">{managementPlan.map(group => <div key={group.title} className="flex flex-wrap items-start gap-md py-lg first:pt-0 last:pb-0">
        <div className="flex min-w-0 flex-1 flex-col gap-xs"><h3 className="text-label font-medium">{group.title}</h3>
          <p className="text-body-small text-muted-foreground">{group.description}</p></div>
        <StatusBadge tone={group.available ? "info" : "neutral"} size="sm">{group.available ? "\u90e8\u5206\u5177\u5907" : "\u5f85\u5efa\u8bbe"}</StatusBadge>
      </div>)}</div>
    </PanelCard>
  </ShellPageContainer>;
}
