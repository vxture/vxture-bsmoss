import ProductFrame from "../portal/header";
import WorkspaceAvailability from "../portal/availability";
import { cookies } from "next/headers";
import { getOidcConfig } from "../auth/lib/config";
import AnalysisWorkspace from "./workspace";
import "../reports/reports.css";
import "./analysis.css";

export const dynamic = "force-dynamic";
export default async function AnalysisPage() {
  const cfg = getOidcConfig(), sid = (await cookies()).get(cfg.cookieName)?.value;
  return <ProductFrame active="analysis">
    {!cfg.enabled ? <WorkspaceAvailability title={"\u5468\u671f\u5206\u6790"} description={"\u6307\u6807\u5468\u671f\u8d8b\u52bf\u4e0e\u8ba1\u91cf\u4f9d\u636e"} stateTitle={"\u6b63\u5f0f\u5206\u6790\u5c1a\u672a\u5f00\u653e"} message={"\u5b8c\u6210\u5e73\u53f0\u63a5\u5165\u540e\uff0c\u53ef\u67e5\u770b\u6388\u6743\u8303\u56f4\u5185\u7684\u5468\u671f\u6307\u6807\u3002"} />
      : !sid ? <WorkspaceAvailability title={"\u5468\u671f\u5206\u6790"} description={"\u6307\u6807\u5468\u671f\u8d8b\u52bf\u4e0e\u8ba1\u91cf\u4f9d\u636e"} stateTitle={"\u767b\u5f55\u540e\u67e5\u770b\u5206\u6790"} loginHref="/auth/login?returnTo=%2Fanalysis" /> : <div className="reports-shell analysis-shell"><AnalysisWorkspace /></div>}
  </ProductFrame>;
}
