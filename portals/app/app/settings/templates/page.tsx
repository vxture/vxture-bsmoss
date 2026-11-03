import ProductHeader from "../../portal/header";
import { cookies } from "next/headers";
import { getOidcConfig } from "../../auth/lib/config";
import TemplateWorkspace from "./workspace";
import "../../reports/reports.css";
import "./templates.css";
export const dynamic = "force-dynamic";
export default async function TemplatesPage() {
  const cfg = getOidcConfig(), sid = (await cookies()).get(cfg.cookieName)?.value;
  return <main className="reports-shell"><ProductHeader active="templates" />
    {!cfg.enabled ? <section className="reports-empty"><h1>{"\u6a21\u677f\u7ba1\u7406\u5c1a\u672a\u5f00\u653e"}</h1><p>{"\u5b8c\u6210\u5e73\u53f0\u63a5\u5165\u5e76\u6388\u4e88\u6a21\u677f\u7ba1\u7406\u6743\u9650\u540e\u53ef\u7528\u3002"}</p></section>
      : !sid ? <section className="reports-empty"><h1>{"\u767b\u5f55\u540e\u7ba1\u7406\u6a21\u677f"}</h1><a href="/auth/login?returnTo=%2Fsettings%2Ftemplates">{"\u4f7f\u7528\u5e73\u53f0\u8d26\u53f7\u767b\u5f55"}</a></section> : <TemplateWorkspace />}
  </main>;
}
