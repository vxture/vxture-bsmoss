import {previewAvailability} from '../../domains/data-updates/preview';
import {UPDATE_FAMILIES} from '../../domains/data-updates/rules';
import SourceAvailability from './source-availability';
import { demoDataEnabled } from "../../lib/demo-mode";
import Link from "next/link";
import {Button,PanelCard,ShellPageContainer} from "@vxture/design-system";
import {cookies} from "next/headers";
import ProductFrame from "../../portal/header";
import PageHeading from "../../portal/page-heading";
import {getOidcConfig} from "../../auth/lib/config";
import {assetSource} from "../../domains/site-registry/asset-model";
import AssetSyncStatus from "./source-status";
import UpdateTasksWorkspace from "./workspace";
export const dynamic="force-dynamic";
export default async function UpdateTasksPage(){
 const cfg=getOidcConfig(),sid=(await cookies()).get(cfg.cookieName)?.value;
 const source=demoDataEnabled()?assetSource():null;
 const availability=source?UPDATE_FAMILIES.map(previewAvailability):[];
 return <ProductFrame active="data-updates">{cfg.enabled&&sid?<UpdateTasksWorkspace source={source} availability={availability}/>:<ShellPageContainer className="product-page-inset gap-lg">
  <PageHeading icon="database" title={"\u6570\u636e\u66f4\u65b0"} actions={<Button asChild variant="outline"><Link href="/tower-service/sync">{"\u5feb\u7167\u540c\u6b65\u5e95\u5ea7"}</Link></Button>} description={"\u7edf\u4e00\u67e5\u770b\u4e3b\u6570\u636e\u540c\u6b65\u4e0e\u6307\u6807\u5904\u7406\u4efb\u52a1"}/>
  <AssetSyncStatus source={source}/>{demoDataEnabled()&&<SourceAvailability availability={availability}/>}
  <PanelCard title={"\u6307\u6807\u66f4\u65b0"} icon="database"><div className="flex flex-col items-start gap-md">
   <p className="text-body text-muted-foreground">{cfg.enabled?"\u767b\u5f55\u540e\u67e5\u770b\u6388\u6743\u8303\u56f4\u5185\u7684\u5904\u7406\u4efb\u52a1\u3002":"\u4efb\u52a1\u5de5\u4f5c\u53f0\u5f85\u5e73\u53f0\u63a5\u5165\u3002"}</p>
   {cfg.enabled&&<Button asChild><a href="/auth/login?returnTo=%2Foperations%2Fdata-updates">{"\u4f7f\u7528\u5e73\u53f0\u8d26\u53f7\u767b\u5f55"}</a></Button>}
  </div></PanelCard>
 </ShellPageContainer>}</ProductFrame>;
}
