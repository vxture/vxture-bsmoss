import ProductFrame from "../../../portal/header";
import { cookies } from "next/headers";
import { getOidcConfig } from "../../../auth/lib/config";
import ReportJobsWorkspace from "./workspace";
import "../../../reports/reports.css";
import "../aggregation/operations.css";
export const dynamic = "force-dynamic";
export default async function ReportJobsPage() {
  const cfg = getOidcConfig(), sid = (await cookies()).get(cfg.cookieName)?.value;
  return <ProductFrame active="report-jobs"><div className="reports-shell jobs-shell">
    {!cfg.enabled ? <section className="reports-empty"><h1>{"\u62a5\u544a\u4efb\u52a1\u5c1a\u672a\u5f00\u653e"}</h1><p>{"\u5e73\u53f0\u63a5\u5165\u5b8c\u6210\u540e\uff0c\u53ef\u67e5\u770b\u6388\u6743\u8303\u56f4\u5185\u7684\u751f\u6210\u548c\u5bfc\u51fa\u8bb0\u5f55\u3002"}</p></section>
      : !sid ? <section className="reports-empty"><h1>{"\u767b\u5f55\u540e\u67e5\u770b\u4efb\u52a1"}</h1><a href="/auth/login?returnTo=%2Fsettings%2Foperations%2Freports">{"\u4f7f\u7528\u5e73\u53f0\u8d26\u53f7\u767b\u5f55"}</a></section> : <ReportJobsWorkspace />}
  </div></ProductFrame>;
}
