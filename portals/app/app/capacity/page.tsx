import {loadCapacityConfiguration} from "../domains/capacity/parameter-http";
import Link from "next/link";
import {PanelCard} from "@vxture/design-system";
import ProductFrame from "../portal/header";
import PageHeading from "../portal/page-heading";
import ResetButton from "../portal/reset-button";
import {capacityIcon} from "../portal/business-icons";
import {rememberedRegionInput} from "../portal/region-preference";
import {readInvestigation} from "../portal/investigation-server";
import {InvestigationProvider,InvestigationReturn} from "../portal/investigation";
import BusinessPage from "../business-analysis/page-view";
import CapacityWorkspace from "./workspace";
import {capacityModel} from "./model";
import {capacityTitle} from "./labels";
export const dynamic="force-dynamic";
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
 const input=await searchParams;
 // Preserve existing historical investigation and map-selection workflows.
 if(input.history==="1"||input.selection!==undefined)return <BusinessPage kind="capacity" searchParams={Promise.resolve(input)}/>;
 if(process.env.BSMOSS_PRODUCT_PREVIEW!=="on")return <ProductFrame active="capacity" preview={false}><div className="product-page-inset flex flex-col gap-lg"><PageHeading icon={capacityIcon} title={capacityTitle}/><PanelCard title={"\u627f\u8f7d\u6570\u636e\u5c1a\u672a\u63a5\u5165"} icon={capacityIcon}><p>{"\u5b8c\u6210\u6388\u6743\u6765\u6e90\u548c\u5bb9\u91cf\u8bfb\u6a21\u578b\u63a5\u5165\u540e\uff0c\u5c55\u793a\u6743\u9650\u8303\u56f4\u5185\u7684\u627f\u8f7d\u5206\u6790\u3002"}</p></PanelCard></div></ProductFrame>;
 let data,journey;try{const extracted=readInvestigation(input);journey=extracted.journey;data=capacityModel(await rememberedRegionInput(extracted.input),await loadCapacityConfiguration());}catch(error){
  if(error instanceof Error&&error.message==="capacity_configuration_unavailable")return <ProductFrame active="capacity"><div className="product-page-inset flex flex-col gap-lg"><PageHeading icon={capacityIcon} title={capacityTitle}/><PanelCard title={"\u627f\u8f7d\u53c2\u6570\u6682\u4e0d\u53ef\u7528"} icon="faders"><p>{"\u8bf7\u68c0\u67e5\u5206\u6790\u53c2\u6570\u914d\u7f6e\u4e0e\u8bbf\u95ee\u6743\u9650\u3002"}</p><Link className="text-primary" href="/settings/rules#capacity-parameters">{"\u53c2\u6570\u914d\u7f6e"}</Link></PanelCard></div></ProductFrame>;
  if(!(error instanceof Error&&/^(invalid_|query_too_large)/.test(error.message)))throw error;
  return <ProductFrame active="capacity"><div className="product-page-inset" role="alert"><PageHeading icon={capacityIcon} title={"\u5206\u6790\u6761\u4ef6\u65e0\u6548"}/><ResetButton href="/capacity" variant="outline"/></div></ProductFrame>;
 }
 return <ProductFrame active="capacity" preview><InvestigationProvider journey={journey}><InvestigationReturn source="snapshot"/><CapacityWorkspace data={data}/></InvestigationProvider></ProductFrame>;
}
