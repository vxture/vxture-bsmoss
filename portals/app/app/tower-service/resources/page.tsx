import {pageReadModel,publishedPageRead} from "../../domains/tower-service/page-read-model";
import { demoDataEnabled } from "../../lib/demo-mode";
import ProductFrame from '../../portal/header';
import {CellTowerIcon} from '@phosphor-icons/react/dist/ssr';
import PageHeading from '../../portal/page-heading';
import ResetButton from '../../portal/reset-button';
import {PanelCard} from '@vxture/design-system';
import {rememberedRegionInput} from '../../portal/region-preference';
import {baselineModel} from './baseline-model';
import Workspace from './baseline-workspace';
import {readTowerPreview,extendHistoryCatalog} from '../../domains/tower-service/history-reader';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {sharingDestination} from '../judgment/analysis-links';
import {PREVIEW_COOKIE,previewFoundation,previewSeed,validPreviewSession} from '../../domains/tower-service/preview';

export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 if(!demoDataEnabled())return <ProductFrame active="customer-use"><div className="product-page-inset"><PageHeading title={"\u8d44\u6e90\u5e95\u6570"} iconVisual={<CellTowerIcon className="size-icon-2xl"/>}/><PanelCard title={"\u8d44\u6e90\u5feb\u7167\u5c1a\u672a\u63a5\u5165"} icon="database"><p>{'\u5b8c\u6210\u6765\u6e90\u53ca\u6743\u9650\u63a5\u5165\u540e\u5c55\u793a\u6388\u6743\u5feb\u7167\u3002'}</p></PanelCard></div></ProductFrame>;
 try{const input=await rememberedRegionInput(await searchParams);if(input.view==='sharing')redirect(sharingDestination(input));const ready=await publishedPageRead<ReturnType<typeof baselineModel>>('resources',input);if(ready)return <ProductFrame active="customer-use"><Workspace model={ready}/></ProductFrame>;const session=(await cookies()).get(PREVIEW_COOKIE)?.value,result=await readTowerPreview(input,session);const model=extendHistoryCatalog(await pageReadModel('resources',result,()=>baselineModel({view:'composition',...result.input},result.versions)),result);return <ProductFrame active="customer-use" preview><Workspace model={model}/></ProductFrame>;}catch(error){if(!(error instanceof Error&&/^(invalid_|query_too_large)/.test(error.message)))throw error;return <ProductFrame active="customer-use"><div className="product-page-inset" role="alert"><PageHeading title={"\u5feb\u7167\u67e5\u8be2\u6761\u4ef6\u65e0\u6548"} icon="building"/><ResetButton href="/tower-service/resources" label={"\u91cd\u7f6e\u5feb\u7167\u67e5\u8be2"} variant="outline"/></div></ProductFrame>;}
}
