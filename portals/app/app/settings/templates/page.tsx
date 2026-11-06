import WorkspaceAvailability from "../../portal/availability";
import { cookies } from "next/headers";
import { getOidcConfig } from "../../auth/lib/config";
import TemplateWorkspace from "./workspace";
import "../../reports/reports.css";
import "./templates.css";
export const dynamic = "force-dynamic";
export default async function TemplatesPage() {
  const cfg = getOidcConfig(), sid = (await cookies()).get(cfg.cookieName)?.value;
  return <>
    {!cfg.enabled ? <WorkspaceAvailability inset="shell" title={"\u6a21\u677f\u914d\u7f6e"} description={"\u6307\u6807\u663e\u793a\u4e0e\u62a5\u544a\u6a21\u677f\u914d\u7f6e"} stateTitle={"\u6a21\u677f\u7ba1\u7406\u5c1a\u672a\u5f00\u653e"} message={"\u5b8c\u6210\u5e73\u53f0\u63a5\u5165\u5e76\u6388\u4e88\u6a21\u677f\u7ba1\u7406\u6743\u9650\u540e\u53ef\u7528\u3002"} />
      : !sid ? <WorkspaceAvailability inset="shell" title={"\u6a21\u677f\u914d\u7f6e"} description={"\u6307\u6807\u663e\u793a\u4e0e\u62a5\u544a\u6a21\u677f\u914d\u7f6e"} stateTitle={"\u767b\u5f55\u540e\u7ba1\u7406\u6a21\u677f"} loginHref="/auth/login?returnTo=%2Fsettings%2Ftemplates" /> : <div className="reports-shell"><TemplateWorkspace /></div>}
  </>;
}
