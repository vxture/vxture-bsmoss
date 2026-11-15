import { demoDataEnabled } from "../../lib/demo-mode";
import {readInvestigation} from "../../portal/investigation-server";
import {InvestigationProvider} from "../../portal/investigation";
import PageHeading from "../../portal/page-heading";
import {notFound} from "next/navigation";
import ProductFrame from "../../portal/header";
import {Button,PanelCard} from "@vxture/design-system";
import {assetDetail} from "../../domains/site-registry/asset-model";
import {parseSiteQuery} from "../../domains/site-registry/rules";
import {DEMO_REGION} from "../../domains/map-demo/resources";
import {registryMaintenanceStore} from "../../domains/site-registry/maintenance-store";
import {canMaintainAssets} from "../../domains/site-registry/maintenance-access";
import SiteDossier from "../dossier";
export const dynamic="force-dynamic";
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
 if(!demoDataEnabled())return <ProductFrame active="sites" preview={false}><div className="product-page-inset flex flex-col gap-lg"><PageHeading title={"\u7ad9\u5740\u6863\u6848"}/><PanelCard title={"\u6b63\u5f0f\u6863\u6848\u5c1a\u672a\u5f00\u653e"} icon="building"><p className="text-body text-muted-foreground">{"\u7ad9\u5740\u3001\u8bbe\u5907\u6765\u6e90\u4e0e\u6743\u9650\u5f85\u63a5\u5165"}</p></PanelCard></div></ProductFrame>;
 let query,journey;
 try{const extracted=readInvestigation(await searchParams);journey=extracted.journey;query=parseSiteQuery(extracted.input,DEMO_REGION);}
 catch{return <ProductFrame active="sites"><div className="product-page-inset" role="alert"><PageHeading title={"\u6863\u6848\u53c2\u6570\u65e0\u6548"}/><Button asChild><a href="/sites">{"\u8fd4\u56de\u53f0\u8d26"}</a></Button></div></ProductFrame>;}
 const data=assetDetail((await params).id,await registryMaintenanceStore().read(),canMaintainAssets());if(!data)notFound();
 return <ProductFrame active="sites" preview><InvestigationProvider journey={journey}><SiteDossier data={data} query={query}/></InvestigationProvider></ProductFrame>;
}
