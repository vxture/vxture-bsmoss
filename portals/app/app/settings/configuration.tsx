"use client";
import PageHeading from "../portal/page-heading";

import { EntryCard, PanelCard, ShellPageContainer } from "@vxture/design-system";
import ProductPreferences from "../portal/preferences";
import { managementNavigation } from "../portal/management-navigation";

export default function ConfigurationPage({ preview }: { preview: boolean }) {
  return <ShellPageContainer><div className="flex min-w-0 flex-col gap-xl">
    <PageHeading title={"\u914d\u7f6e\u7ba1\u7406"} description={"\u6307\u6807\u6a21\u677f\u3001\u4efb\u52a1\u76d1\u7ba1\u4e0e\u663e\u793a\u504f\u597d"} />
    <div className="grid items-start gap-xl xl:grid-cols-3">
      <div className="flex min-w-0 flex-col gap-xl xl:col-span-2">
        {managementNavigation(preview).map(group => <section key={group.title} className="flex min-w-0 flex-col gap-md" aria-label={group.title}>
          <h2 className="text-heading-2 font-semibold">{group.title}</h2>
          <div className="grid min-w-0 gap-md md:grid-cols-2">
            {group.items.filter(item => item.id !== "settings").map(item => <EntryCard key={item.id}
              href={item.href} icon={item.icon} title={item.label} description={item.description} className="h-full p-lg" />)}
          </div>
        </section>)}
      </div>
      <PanelCard title={"\u663e\u793a\u8bbe\u7f6e"} description={"\u81ea\u52a8\u4fdd\u5b58\u5230\u5f53\u524d\u6d4f\u89c8\u5668"} tone="neutral"><ProductPreferences /></PanelCard>
    </div>
  </div></ShellPageContainer>;
}
