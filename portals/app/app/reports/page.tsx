import { Button } from "@vxture/design-system";
import {readInvestigation} from "../portal/investigation-server";
import {InvestigationProvider} from "../portal/investigation";
import {rememberedRegionInput} from "../portal/region-preference";
import {parseMapQuery} from "../domains/map-demo/service";
import {localReportQuery} from "./local-rules";
import LocalReportWorkspace from "./local-workspace";
import ProductFrame from "../portal/header";
import WorkspaceAvailability from "../portal/availability";
import { cookies } from "next/headers";
import { getOidcConfig } from "../auth/lib/config";
import ReportWorkspace from "./workspace";
import { reportSelection } from "./navigation";
import "./reports.css";
import ReportTaskCentre from "./tasks/centre";
import CentreSwitch from "./centre-switch";
import TowerReportWorkspace from './tower-workspace';
import {PREVIEW_COOKIE} from '../domains/tower-service/preview';
import {readTowerPreview,extendHistoryCatalog} from '../domains/tower-service/history-reader';
import {judgmentModel} from '../tower-service/judgment/model';
import "../site-analysis/site-analysis.css";

export const dynamic = "force-dynamic";
export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params=await searchParams;
  if(params.view==='tower'){
    const preview=process.env.BSMOSS_PRODUCT_PREVIEW==='on';
    if(preview){try{
      const input=await rememberedRegionInput({...params,view:'reports'}),session=(await cookies()).get(PREVIEW_COOKIE)?.value;
      const result=await readTowerPreview(input,session),m=extendHistoryCatalog(judgmentModel(result.input,result.versions,result.access.operators),result);
      return <ProductFrame active="reports" preview><TowerReportWorkspace context={m.context} snapshot={m.snapshot} snapshots={m.snapshots} operators={m.allowedOperators} reportId={m.filters.report}/></ProductFrame>;
    }catch(error){if(!(error instanceof Error&&/^(invalid_|query_too_large)/.test(error.message)))throw error;}}
    return <ProductFrame active="reports" preview={preview}><WorkspaceAvailability title={'\u62a5\u544a\u4e2d\u5fc3'} stateTitle={preview?'\u62a5\u544a\u6761\u4ef6\u65e0\u6548':'\u7814\u5224\u62a5\u544a\u5c1a\u672a\u5f00\u653e'} message={preview?'\u8bf7\u68c0\u67e5\u5feb\u7167\u548c\u67e5\u8be2\u8303\u56f4\u3002':'\u6b63\u5f0f\u6570\u636e\u6765\u6e90\u5f85\u63a5\u5165\u3002'} actions={<Button asChild variant="outline"><a href="/reports">{'\u8fd4\u56de\u62a5\u544a\u4e2d\u5fc3'}</a></Button>}/></ProductFrame>;
  }
  if(params.view==="tasks")return <ProductFrame active="reports"><ReportTaskCentre params={params}/></ProductFrame>;
  // Platform result links always resolve the exact server report revision,
  // including when the browser-local preview library is enabled.
  const platformResult=params.report!==undefined||params.revision!==undefined;
  if(process.env.BSMOSS_PRODUCT_PREVIEW==='on'&&!platformResult){
    let query,journey;
    try{const extracted=readInvestigation(await searchParams);journey=extracted.journey;query=localReportQuery(await rememberedRegionInput(extracted.input));parseMapQuery(new URLSearchParams({cityId:query.city,countyId:query.county,operator:query.operator}));}
    catch{return <ProductFrame active="reports" preview><div role="alert"><WorkspaceAvailability actions={<Button asChild variant="outline"><a href="/reports">{"\u62a5\u544a\u4e2d\u5fc3"}</a></Button>} title={"\u62a5\u544a\u4e2d\u5fc3"} stateTitle={"\u62a5\u544a\u6761\u4ef6\u65e0\u6548"} message={"\u8bf7\u68c0\u67e5\u533a\u57df\u3001\u8fd0\u8425\u5546\u6216\u6587\u4ef6\u7248\u672c\u6761\u4ef6\u3002"}/></div></ProductFrame>;}
    return <ProductFrame active="reports" preview><InvestigationProvider journey={journey}><LocalReportWorkspace query={query}/></InvestigationProvider></ProductFrame>;
  }
  const cfg = getOidcConfig(), sid = (await cookies()).get(cfg.cookieName)?.value;
  const link = reportSelection(await searchParams), returnTo = "/reports" + (link.selection ? "?report=" + encodeURIComponent(link.selection.id) + "&revision=" + link.selection.revision : "");
  return <ProductFrame active="reports"><div className="site-analysis-page"><div className="product-page-inset"><div className="site-analysis-action-row"><CentreSwitch/></div></div>
    {!cfg.enabled ? <WorkspaceAvailability actions={<Button asChild variant="outline"><a href="/reports?view=tasks">{"\u62a5\u544a\u4efb\u52a1"}</a></Button>} title={"\u5468\u671f\u62a5\u544a"} description={"\u5468\u671f\u62a5\u544a\u5f52\u6863\u4e0e\u7248\u672c\u6838\u9a8c"} stateTitle={"\u6b63\u5f0f\u62a5\u544a\u5c1a\u672a\u5f00\u653e"} message={"\u5b8c\u6210\u5e73\u53f0\u63a5\u5165\u540e\uff0c\u53ef\u67e5\u770b\u6388\u6743\u8303\u56f4\u5185\u7684\u5468\u671f\u6570\u636e\u4e0e\u53d1\u5e03\u8bb0\u5f55\u3002"} />
      : !sid ? <WorkspaceAvailability actions={<Button asChild variant="outline"><a href="/reports?view=tasks">{"\u62a5\u544a\u4efb\u52a1"}</a></Button>} title={"\u5468\u671f\u62a5\u544a"} description={"\u5468\u671f\u62a5\u544a\u5f52\u6863\u4e0e\u7248\u672c\u6838\u9a8c"} stateTitle={"\u767b\u5f55\u540e\u67e5\u770b\u62a5\u544a"} loginHref={"/auth/login?returnTo=" + encodeURIComponent(returnTo)} />
      : <div className="reports-shell"><ReportWorkspace initialSelection={link.selection} invalidLink={link.invalid} /></div>}
  </div></ProductFrame>;
}
