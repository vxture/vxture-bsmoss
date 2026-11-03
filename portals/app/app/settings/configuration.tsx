"use client";

import { EntryCard, PanelCard, ShellPageContainer, ViewHeader } from "@vxture/design-system";
import ProductPreferences from "../portal/preferences";

export default function ConfigurationPage() {
  return <ShellPageContainer><div className="flex flex-col gap-lg">
    <ViewHeader title={"\u914d\u7f6e\u4e2d\u5fc3"} description={"\u4e2a\u4eba\u504f\u597d\u4e0e\u4e1a\u52a1\u914d\u7f6e"} />
    <div className="grid items-start gap-lg lg:grid-cols-3">
      <PanelCard title={"\u663e\u793a\u8bbe\u7f6e"} description={"\u81ea\u52a8\u4fdd\u5b58\u5230\u5f53\u524d\u6d4f\u89c8\u5668"} tone="neutral"><ProductPreferences /></PanelCard>
      <div className="flex flex-col gap-md lg:col-span-2">
        <EntryCard href="/settings/templates" icon="settings" title={"\u6307\u6807\u4e0e\u6a21\u677f"} description={"\u914d\u7f6e\u4e09\u7c7b\u6307\u6807\u7684\u663e\u793a\u4e0e\u62a5\u544a\u6a21\u677f\uff0c\u9700\u5177\u5907\u6a21\u677f\u7ba1\u7406\u6743\u9650"} />
        <EntryCard href="/operations/aggregation" icon="database" title={"\u805a\u5408\u4efb\u52a1"} description={"\u67e5\u770b\u805a\u5408\u6267\u884c\u4e0e\u53d7\u5ba1\u6062\u590d\uff0c\u6309\u5e73\u53f0\u6743\u9650\u5f00\u653e"} />
        <EntryCard href="/operations/reports" icon="file-text" title={"\u62a5\u544a\u4efb\u52a1"} description={"\u67e5\u770b\u62a5\u544a\u751f\u6210\u3001\u5bfc\u51fa\u4e0e\u6267\u884c\u8bb0\u5f55\uff0c\u6309\u5e73\u53f0\u6743\u9650\u5f00\u653e"} />
      </div>
    </div>
  </div></ShellPageContainer>;
}
