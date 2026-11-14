"use client";
import PageHeading from "../portal/page-heading";
import { EntryCard, ShellPageContainer } from "@vxture/design-system";
import { managementNavigation } from "../portal/management-navigation";
import SectionHeading from '../portal/section-heading';
export default function ConfigurationPage({ preview }: { preview: boolean }) {
  const groups = managementNavigation(preview).filter(group => group.items.some(item => item.id !== "settings"));
  return <ShellPageContainer className="gap-xl">
    <PageHeading icon="settings" title={"\u7ba1\u7406\u603b\u89c8"} description={"\u7ba1\u7406\u7ec4\u7ec7\u7ba1\u8f96\u3001\u6210\u5458\u6743\u9650\u3001\u4e1a\u52a1\u53c2\u6570\u4e0e\u63a5\u5165\u89c4\u5219"} />
    <div className="grid min-w-0 gap-xl md:grid-cols-2">{groups.map(group => <section key={group.title} className={"flex min-w-0 flex-col gap-md"+(group.items.length>1?" md:col-span-2":"")} aria-label={group.title}>
      <SectionHeading title={group.title}/>
      <div className={"grid min-w-0 gap-lg"+(group.items.length>1?" md:grid-cols-2":"")}>{group.items.filter(item => item.id !== "settings").map(item => <EntryCard key={item.id} href={item.href}
        icon={item.icon} title={item.label} description={item.description} className="h-full p-xl" />)}</div>
    </section>)}</div>
    <p className="text-body-small text-muted-foreground">{"\u7ec4\u7ec7\u3001\u6210\u5458\u4e0e\u6a21\u677f\u4f9d\u8d56\u5e73\u53f0\u8eab\u4efd\u63a5\u5165\uff1b\u6570\u636e\u6765\u6e90\u767b\u8bb0\u4e0d\u4ee3\u8868\u5df2\u8fde\u63a5\u5ba2\u6237\u5e73\u53f0\u3002"}</p>
  </ShellPageContainer>;
}
