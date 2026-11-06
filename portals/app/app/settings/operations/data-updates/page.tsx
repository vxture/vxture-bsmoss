import { cookies } from "next/headers";
import ProductFrame from "../../../portal/header";
import WorkspaceAvailability from "../../../portal/availability";
import { getOidcConfig } from "../../../auth/lib/config";
import UpdateTasksWorkspace from "./workspace";
export const dynamic = "force-dynamic";
export default async function UpdateTasksPage() {
  const cfg = getOidcConfig(), sid = (await cookies()).get(cfg.cookieName)?.value;
  const title = "\u6570\u636e\u66f4\u65b0\u4efb\u52a1", description = "\u589e\u91cf\u5904\u7406\u3001\u6267\u884c\u8fdb\u5ea6\u4e0e\u5931\u8d25\u6062\u590d";
  return <ProductFrame active="data-updates">{!cfg.enabled ? <WorkspaceAvailability inset="shell" title={title} description={description} stateTitle={"\u4efb\u52a1\u5de5\u4f5c\u53f0\u5c1a\u672a\u5f00\u653e"} message={"\u5e73\u53f0\u63a5\u5165\u5b8c\u6210\u540e\uff0c\u53ef\u67e5\u770b\u6388\u6743\u8303\u56f4\u5185\u7684\u771f\u5b9e\u4efb\u52a1\u3002"} />
    : !sid ? <WorkspaceAvailability inset="shell" title={title} description={description} stateTitle={"\u767b\u5f55\u540e\u67e5\u770b\u4efb\u52a1"} loginHref="/auth/login?returnTo=%2Fsettings%2Foperations%2Fdata-updates" /> : <UpdateTasksWorkspace />}</ProductFrame>;
}
