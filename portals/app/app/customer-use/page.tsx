import { demoDataEnabled } from "../lib/demo-mode";
import {customerUseIcon} from "../portal/business-icons";
import ResetButton from "../portal/reset-button";
import ProductFrame from "../portal/header";
import PageHeading from "../portal/page-heading";
import { PanelCard} from "@vxture/design-system";
import { rememberedRegionInput } from "../portal/region-preference";
import { customerUseModel } from "./model";
import Workspace from "./workspace";
import ResourceWorkspace from "./resource-workspace";
import {serviceResourceModel} from "./resource-model";
import {readCustomerMode} from "./mode";
import PerformanceWorkspace from "./performance-workspace";
import {servicePerformanceModel} from "./performance-model";
import {readInvestigation} from "../portal/investigation-server";
import {InvestigationProvider,InvestigationReturn} from "../portal/investigation";
export const dynamic="force-dynamic";
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
 const preview=demoDataEnabled();
 if(!preview)return <ProductFrame active="customer-use"><div className="product-page-inset"><PageHeading icon={customerUseIcon} title={"\u5ba2\u6237\u4f7f\u7528"}/><PanelCard title={"\u5ba2\u6237\u4f7f\u7528\u6570\u636e\u5c1a\u672a\u63a5\u5165"} icon={customerUseIcon}><p>{"\u5b8c\u6210\u7ad9\u5740\u4e0e\u8fd0\u8425\u5546\u670d\u52a1\u5173\u7cfb\u6570\u636e\u6388\u6743\u63a5\u5165\u540e\uff0c\u5c55\u793a\u6743\u9650\u8303\u56f4\u5185\u7684\u4f7f\u7528\u5206\u6790\u3002"}</p></PanelCard></div></ProductFrame>;
 let content,journey;try{const extracted=readInvestigation(await searchParams);journey=extracted.journey;const mode=readCustomerMode(extracted.input),input=await rememberedRegionInput(mode.input);content=mode.mode==='legacy'?<Workspace data={customerUseModel(input)}/>:mode.mode==='performance'?<PerformanceWorkspace data={servicePerformanceModel(input)}/>:<ResourceWorkspace data={serviceResourceModel(input)} explicit={mode.explicit}/>;}catch(error){if(!(error instanceof Error&&/^(invalid_|query_too_large)/.test(error.message)))throw error;return <ProductFrame active="customer-use"><div className="product-page-inset" role="alert"><PageHeading icon={customerUseIcon} title={"\u5206\u6790\u6761\u4ef6\u65e0\u6548"}/><ResetButton href="/customer-use" label={"\u91cd\u7f6e\u5206\u6790\u6761\u4ef6"} variant="outline"/></div></ProductFrame>;}
 return <ProductFrame active="customer-use" preview><InvestigationProvider journey={journey}><InvestigationReturn source="snapshot"/>{content}</InvestigationProvider></ProductFrame>;
}
