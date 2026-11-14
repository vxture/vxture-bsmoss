import {redirect} from "next/navigation";
import {siteListHref} from "../domains/site-registry/rules";
import {keepInvestigation} from "../portal/investigation-links";
import {readInvestigation} from "../portal/investigation-server";
import {InvestigationProvider} from "../portal/investigation";
import {rememberedRegionInput} from "../portal/region-preference";
import PageHeading from "../portal/page-heading";
import ProductFrame from "../portal/header";
import {Button,PanelCard} from "@vxture/design-system";
import {assetRegistry} from "../domains/site-registry/asset-model";
import {registryMaintenanceStore} from "../domains/site-registry/maintenance-store";
import {canMaintainAssets} from "../domains/site-registry/maintenance-access";
import SiteRegistry from "./registry";
export const dynamic="force-dynamic";
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 if(process.env.BSMOSS_PRODUCT_PREVIEW!=="on")return <ProductFrame active="sites" preview={false}><div className="product-page-inset flex flex-col gap-lg"><PageHeading icon="building" title={"\u7ad9\u5740\u7ba1\u7406"}/><PanelCard title={"\u6b63\u5f0f\u53f0\u8d26\u5c1a\u672a\u5f00\u653e"} icon="building"><p className="text-body text-muted-foreground">{"\u7ad9\u5740\u3001\u8bbe\u5907\u6765\u6e90\u4e0e\u6743\u9650\u5f85\u63a5\u5165"}</p></PanelCard></div></ProductFrame>;
 const input=await searchParams;
 const catalog=await registryMaintenanceStore().read();
 let data,journey;
 try{const extracted=readInvestigation(input);journey=extracted.journey;data=assetRegistry(await rememberedRegionInput(extracted.input),catalog,canMaintainAssets());}
 catch{return <ProductFrame active="sites"><div className="product-page-inset" role="alert"><PageHeading title={"\u53f0\u8d26\u7b5b\u9009\u65e0\u6548"}/><Button asChild><a href="/sites">{"\u8fd4\u56de\u53f0\u8d26"}</a></Button></div></ProductFrame>;}
 if(input.view==="devices")redirect(keepInvestigation(siteListHref(data.query),journey));
 return <ProductFrame active="sites" preview><InvestigationProvider journey={journey}><SiteRegistry data={data}/></InvestigationProvider></ProductFrame>;
}
