import ProductFrame from "../../../portal/header";
import WorkspaceAvailability from "../../../portal/availability";
import { cookies } from "next/headers";
import { getOidcConfig } from "../../../auth/lib/config";
import ReportJobsWorkspace from "./workspace";
import "../../../reports/reports.css";
import "../aggregation/operations.css";
export const dynamic = "force-dynamic";
export default async function ReportJobsPage() {
  const cfg = getOidcConfig(), sid = (await cookies()).get(cfg.cookieName)?.value;
  return <ProductFrame active="report-jobs">
    {!cfg.enabled ? <WorkspaceAvailability title={"\u62a5\u544a\u4efb\u52a1\u5c1a\u672a\u5f00\u653e"} message={"\u5e73\u53f0\u63a5\u5165\u5b8c\u6210\u540e\uff0c\u53ef\u67e5\u770b\u6388\u6743\u8303\u56f4\u5185\u7684\u751f\u6210\u548c\u5bfc\u51fa\u8bb0\u5f55\u3002"} />
      : !sid ? <WorkspaceAvailability title={"\u767b\u5f55\u540e\u67e5\u770b\u4efb\u52a1"} loginHref="/auth/login?returnTo=%2Fsettings%2Foperations%2Freports" /> : <div className="reports-shell jobs-shell"><ReportJobsWorkspace /></div>}
  </ProductFrame>;
}
