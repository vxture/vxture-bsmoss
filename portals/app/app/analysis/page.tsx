import {readInvestigation} from '../portal/investigation-server';
import {InvestigationProvider} from '../portal/investigation';
import ProductFrame from "../portal/header";
import WorkspaceAvailability from "../portal/availability";
import { cookies } from "next/headers";
import { getOidcConfig } from "../auth/lib/config";
import AnalysisWorkspace from "./workspace";
import HistoryWorkspace from "./history-workspace";
import { historyModel } from "./history-model";
import { rememberedRegionInput } from "../portal/region-preference";
import PageHeading from "../portal/page-heading";
import { Button, PanelCard, ShellPageContainer } from "@vxture/design-system";
import "../reports/reports.css";
import "./analysis.css";

export const dynamic = "force-dynamic";
export default async function AnalysisPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.BSMOSS_PRODUCT_PREVIEW === "on") {
    let data,journey;
    try { const extracted=readInvestigation(await searchParams);journey=extracted.journey;data = historyModel(await rememberedRegionInput(extracted.input)); }
    catch {
      return <ProductFrame active="analysis" preview><ShellPageContainer className="product-page-inset max-w-none">
        <PageHeading title={"\u7ecf\u8425\u5206\u6790"} description={"\u670d\u52a1\u4ea7\u51fa\u3001\u533a\u57df\u5dee\u5f02\u4e0e\u540c\u671f\u53d8\u5316"} />
        <div role="alert"><PanelCard title={"\u5206\u6790\u6761\u4ef6\u65e0\u6548"} icon="search">
          <p className="pb-md text-body-small text-muted-foreground">{"\u8bf7\u68c0\u67e5\u65e5\u671f\u8303\u56f4\u3001\u533a\u57df\u5f52\u5c5e\u53ca\u7ad9\u5740\u6761\u4ef6\uff0c\u5355\u6b21\u5206\u6790\u533a\u95f4\u6700\u591a366\u5929\u3002"}</p>
          <Button asChild><a href="/analysis">{"\u91cd\u7f6e\u5206\u6790\u6761\u4ef6"}</a></Button>
        </PanelCard></div>
      </ShellPageContainer></ProductFrame>;
    }
    return <ProductFrame active="analysis" preview><InvestigationProvider journey={journey}><HistoryWorkspace key={JSON.stringify(data.scope)} data={data}/></InvestigationProvider></ProductFrame>;
  }
  const cfg = getOidcConfig(), sid = (await cookies()).get(cfg.cookieName)?.value;
  return <ProductFrame active="analysis">
    {!cfg.enabled ? <WorkspaceAvailability title={"\u5468\u671f\u5206\u6790"} description={"\u6307\u6807\u5468\u671f\u8d8b\u52bf\u4e0e\u8ba1\u91cf\u4f9d\u636e"} stateTitle={"\u6b63\u5f0f\u5206\u6790\u5c1a\u672a\u5f00\u653e"} message={"\u5b8c\u6210\u5e73\u53f0\u63a5\u5165\u540e\uff0c\u53ef\u67e5\u770b\u6388\u6743\u8303\u56f4\u5185\u7684\u5468\u671f\u6307\u6807\u3002"} />
      : !sid ? <WorkspaceAvailability title={"\u5468\u671f\u5206\u6790"} description={"\u6307\u6807\u5468\u671f\u8d8b\u52bf\u4e0e\u8ba1\u91cf\u4f9d\u636e"} stateTitle={"\u767b\u5f55\u540e\u67e5\u770b\u5206\u6790"} loginHref="/auth/login?returnTo=%2Fanalysis" /> : <div className="reports-shell analysis-shell"><AnalysisWorkspace /></div>}
  </ProductFrame>;
}
