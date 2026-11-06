import { Button } from "@vxture/design-system";
import ProductFrame from "../../portal/header";
import WorkspaceAvailability from "../../portal/availability";
import { cookies } from "next/headers";
import { getOidcConfig } from "../../auth/lib/config";
import AggregateJobsWorkspace from "./workspace";
import "../../reports/reports.css";
import "./operations.css";

export const dynamic = "force-dynamic";
export default async function AggregateJobsPage() {
  const cfg = getOidcConfig(), sid = (await cookies()).get(cfg.cookieName)?.value;
  return <ProductFrame active="aggregation">
    {!cfg.enabled ? <WorkspaceAvailability actions={<Button asChild variant="outline"><a href="/operations/data-updates">{"\u8fd4\u56de\u66f4\u65b0"}</a></Button>} title={"\u805a\u5408\u5904\u7406"} description={"\u805a\u5408\u6267\u884c\u3001\u5931\u8d25\u5904\u7f6e\u4e0e\u590d\u6838\u8bb0\u5f55"} stateTitle={"\u4efb\u52a1\u5de5\u4f5c\u53f0\u5c1a\u672a\u5f00\u653e"} message={"\u5e73\u53f0\u63a5\u5165\u5b8c\u6210\u540e\uff0c\u53ef\u67e5\u770b\u6388\u6743\u8303\u56f4\u5185\u7684\u4efb\u52a1\u4e0e\u5904\u7f6e\u8bb0\u5f55\u3002"} />
      : !sid ? <WorkspaceAvailability actions={<Button asChild variant="outline"><a href="/operations/data-updates">{"\u8fd4\u56de\u66f4\u65b0"}</a></Button>} title={"\u805a\u5408\u5904\u7406"} description={"\u805a\u5408\u6267\u884c\u3001\u5931\u8d25\u5904\u7f6e\u4e0e\u590d\u6838\u8bb0\u5f55"} stateTitle={"\u767b\u5f55\u540e\u67e5\u770b\u4efb\u52a1"} loginHref="/auth/login?returnTo=%2Foperations%2Faggregation" />
        : <div className="reports-shell jobs-shell"><AggregateJobsWorkspace /></div>}
  </ProductFrame>;
}
