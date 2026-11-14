import {readInvestigation} from '../../portal/investigation-server';
import {InvestigationProvider} from '../../portal/investigation';
import {keepInvestigation} from '../../portal/investigation-links';
import {notFound,redirect} from "next/navigation";
import {Button,PanelCard,ShellPageContainer} from "@vxture/design-system";
import ProductFrame from "../../portal/header";
import PageHeading from "../../portal/page-heading";
import {rememberedRegionInput} from "../../portal/region-preference";
import {buildHistoryReport,assertHistorySnapshot} from "../history-report-service";
import HistoryReportView from "./view";
export const dynamic="force-dynamic";
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 if(process.env.BSMOSS_PRODUCT_PREVIEW!=="on")notFound();
 let report,pinned=false,journey;
 try{
  const extracted=readInvestigation(await searchParams);journey=extracted.journey;const {snapshot,...input}=extracted.input;report=buildHistoryReport(await rememberedRegionInput(input));
  if(snapshot!==undefined){if(typeof snapshot!=="string")throw Error('invalid_history_snapshot');assertHistorySnapshot(snapshot,report.digest);pinned=true;}
 }catch(error){
  if(!(error instanceof Error&&/^(invalid_|conflicting_|missing_|outside_history|history_site_not_in_scope|history_snapshot_changed)/.test(error.message)))throw error;
  return <ProductFrame active="analysis" preview><ShellPageContainer className="product-page-inset max-w-none"><PageHeading title={"\u5386\u53f2\u7ecf\u8425\u62a5\u544a"}/><div role="alert"><PanelCard title={"\u62a5\u544a\u6761\u4ef6\u6216\u7248\u672c\u5df2\u53d8\u5316"} icon="search"><Button size="xl" asChild><a href="/analysis">{"\u8fd4\u56de\u7ecf\u8425\u5206\u6790\u91cd\u65b0\u9009\u62e9"}</a></Button></PanelCard></div></ShellPageContainer></ProductFrame>;
 }
 if(!pinned)redirect(keepInvestigation(report.pageHref,journey));
 return <ProductFrame active="analysis" preview><InvestigationProvider journey={journey}><HistoryReportView report={report}/></InvestigationProvider></ProductFrame>;
}
