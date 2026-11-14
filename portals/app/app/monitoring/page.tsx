import {loadMonitoringConfiguration} from "../domains/monitoring/parameter-http";
import Link from "next/link";
import {PanelCard} from "@vxture/design-system";
import ProductFrame from "../portal/header";
import PageHeading from "../portal/page-heading";
import ResetButton from "../portal/reset-button";
import {monitoringIcon} from "../portal/business-icons";
import {rememberedRegionInput} from "../portal/region-preference";
import MonitoringWorkspace from "./workspace";
import {monitoringModel} from "./model";
export const dynamic="force-dynamic";
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
 if(process.env.BSMOSS_PRODUCT_PREVIEW!=="on")return <ProductFrame active="monitoring" preview={false}><div className="product-page-inset flex flex-col gap-lg"><PageHeading icon={monitoringIcon} title={"\u8fd0\u884c\u76d1\u6d4b"}/><PanelCard title={"\u76d1\u6d4b\u6570\u636e\u5c1a\u672a\u63a5\u5165"} icon={monitoringIcon}><p>{"\u5b8c\u6210\u76d1\u6d4b\u8bb0\u5f55\u3001\u6307\u6807\u9002\u7528\u8303\u56f4\u4e0e\u63a5\u5165\u72b6\u6001\u7684\u6388\u6743\u6570\u636e\u63a5\u5165\u540e\uff0c\u5c55\u793a\u6743\u9650\u8303\u56f4\u5185\u7684\u8fd0\u884c\u76d1\u6d4b\u3002"}</p></PanelCard></div></ProductFrame>;
 let data;try{data=monitoringModel(await rememberedRegionInput(await searchParams),await loadMonitoringConfiguration());}catch(error){
  if(error instanceof Error&&error.message==="monitoring_configuration_unavailable")return <ProductFrame active="monitoring"><div className="product-page-inset flex flex-col gap-lg"><PageHeading icon={monitoringIcon} title={"\u8fd0\u884c\u76d1\u6d4b"}/><PanelCard title={"\u76d1\u6d4b\u53c2\u6570\u6682\u4e0d\u53ef\u7528"} icon="faders"><p>{"\u8bf7\u68c0\u67e5\u5206\u6790\u53c2\u6570\u914d\u7f6e\u4e0e\u8bbf\u95ee\u6743\u9650\u3002"}</p><Link className="text-primary" href="/settings/rules">{"\u53c2\u6570\u914d\u7f6e"}</Link></PanelCard></div></ProductFrame>;
  if(!(error instanceof Error&&/^(invalid_|query_too_large)/.test(error.message)))throw error;
  return <ProductFrame active="monitoring"><div className="product-page-inset" role="alert"><PageHeading icon={monitoringIcon} title={"\u5206\u6790\u6761\u4ef6\u65e0\u6548"}/><ResetButton href="/monitoring" label={"\u91cd\u7f6e\u5206\u6790\u6761\u4ef6"} variant="outline"/></div></ProductFrame>;
 }
 return <ProductFrame active="monitoring" preview><MonitoringWorkspace data={data}/></ProductFrame>;
}
