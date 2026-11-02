import { cookies } from "next/headers";
import { getOidcConfig } from "../../auth/lib/config";
import ReportJobsWorkspace from "./workspace";
import "../../reports/reports.css";
import "../aggregation/operations.css";
export const dynamic = "force-dynamic";
export default async function ReportJobsPage() {
  const cfg = getOidcConfig(), sid = (await cookies()).get(cfg.cookieName)?.value;
  return <main className="reports-shell jobs-shell"><header className="reports-header">
    <a className="reports-brand" href="/"><strong>{"\u89c2\u6f9c"}</strong><span><b>BS-MOSS</b><small>{"\u57fa\u7ad9\u591a\u57df\u8fd0\u884c\u76d1\u7ba1\u5e73\u53f0"}</small></span></a>
    <nav><a href="/reports">{"\u5468\u671f\u62a5\u544a"}</a><a href="/operations/aggregation">{"\u805a\u5408\u4efb\u52a1"}</a><span>{"\u62a5\u544a\u4efb\u52a1"}</span></nav></header>
    {!cfg.enabled ? <section className="reports-empty"><h1>{"\u62a5\u544a\u4efb\u52a1\u5c1a\u672a\u5f00\u653e"}</h1><p>{"\u5e73\u53f0\u63a5\u5165\u5b8c\u6210\u540e\uff0c\u53ef\u67e5\u770b\u6388\u6743\u8303\u56f4\u5185\u7684\u751f\u6210\u548c\u5bfc\u51fa\u8bb0\u5f55\u3002"}</p></section>
      : !sid ? <section className="reports-empty"><h1>{"\u767b\u5f55\u540e\u67e5\u770b\u4efb\u52a1"}</h1><a href="/auth/login?returnTo=%2Foperations%2Freports">{"\u4f7f\u7528\u5e73\u53f0\u8d26\u53f7\u767b\u5f55"}</a></section> : <ReportJobsWorkspace />}
  </main>;
}
