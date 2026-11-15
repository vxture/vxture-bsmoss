import { demoDataEnabled } from "../../lib/demo-mode";
import {readInvestigation} from '../../portal/investigation-server';
import {InvestigationProvider} from '../../portal/investigation';
import {notFound} from "next/navigation";
import ProductFrame from "../../portal/header";
import PageHeading from "../../portal/page-heading";
import {Button,PanelCard,ShellPageContainer} from "@vxture/design-system";
import {parseHistoryQuery} from "../../domains/map-demo/history-service";
import {stationEvidence} from "../../domains/map-demo/station-history-service";
import HistoryEvidenceDetail from "./detail";
import {rememberedRegionInput} from "../../portal/region-preference";
export const dynamic="force-dynamic";
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  if(!demoDataEnabled())notFound();
  let scope,data,journey;
  try {const extracted=readInvestigation(await searchParams);journey=extracted.journey;scope=parseHistoryQuery(await rememberedRegionInput(extracted.input));data=stationEvidence(scope);}
  catch(error) {
    if(!(error instanceof Error&&/^(invalid_|history_site_not_in_scope|outside_history)/.test(error.message)))throw error;
    return <ProductFrame active="usage-review" preview><ShellPageContainer className="product-page-inset max-w-none"><PageHeading title={"\u5355\u7ad9\u6838\u9a8c\u4f9d\u636e"}/><div role="alert"><PanelCard title={"\u6838\u9a8c\u6761\u4ef6\u65e0\u6548"} icon="search"><Button asChild><a href="/analysis">{"\u8fd4\u56de\u7ecf\u8425\u5206\u6790"}</a></Button></PanelCard></div></ShellPageContainer></ProductFrame>;
  }
  if(!data)notFound();
  return <ProductFrame active="usage-review" preview><InvestigationProvider journey={journey}><HistoryEvidenceDetail key={JSON.stringify(scope)} data={data} scope={scope}/></InvestigationProvider></ProductFrame>;
}
