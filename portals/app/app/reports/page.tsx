import { cookies } from "next/headers";
import { getOidcConfig } from "../auth/lib/config";
import ReportWorkspace from "./workspace";
import { reportSelection } from "./navigation";
import "./reports.css";

export const dynamic = "force-dynamic";
export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const cfg = getOidcConfig(), sid = (await cookies()).get(cfg.cookieName)?.value;
  const link = reportSelection(await searchParams), returnTo = "/reports" + (link.selection ? "?report=" + encodeURIComponent(link.selection.id) + "&revision=" + link.selection.revision : "");
  return <main className="reports-shell">
    <header className="reports-header"><a className="reports-brand" href="/">
      <strong>{"\u89c2\u6f9c"}</strong><span><b>BS-MOSS</b><small>{"\u57fa\u7ad9\u591a\u57df\u8fd0\u884c\u76d1\u7ba1\u5e73\u53f0"}</small></span>
    </a><nav className="reports-page-nav"><a href="/analysis">{"\u5468\u671f\u5206\u6790"}</a><a href="/operations/aggregation">{"\u805a\u5408\u4efb\u52a1"}</a><a href="/operations/reports">{"\u62a5\u544a\u4efb\u52a1"}</a><span>{"\u5468\u671f\u62a5\u544a"}</span></nav></header>
    {!cfg.enabled ? <section className="reports-empty"><h1>{"\u6b63\u5f0f\u62a5\u544a\u5c1a\u672a\u5f00\u653e"}</h1><p>{"\u5b8c\u6210\u5e73\u53f0\u63a5\u5165\u540e\uff0c\u53ef\u67e5\u770b\u6388\u6743\u8303\u56f4\u5185\u7684\u5468\u671f\u6570\u636e\u4e0e\u53d1\u5e03\u8bb0\u5f55\u3002"}</p></section>
      : !sid ? <section className="reports-empty"><h1>{"\u767b\u5f55\u540e\u67e5\u770b\u62a5\u544a"}</h1><a href={"/auth/login?returnTo=" + encodeURIComponent(returnTo)}>{"\u4f7f\u7528\u5e73\u53f0\u8d26\u53f7\u767b\u5f55"}</a></section>
      : <ReportWorkspace initialSelection={link.selection} invalidLink={link.invalid} />}
  </main>;
}
