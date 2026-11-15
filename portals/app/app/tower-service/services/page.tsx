import {pageReadModel,publishedPageRead} from "../../domains/tower-service/page-read-model";
import { demoDataEnabled } from "../../lib/demo-mode";
import {cookies} from 'next/headers';
import ProductFrame from '../../portal/header';
import PageHeading from '../../portal/page-heading';
import ResetButton from '../../portal/reset-button';
import {PanelCard} from '@vxture/design-system';
import {rememberedRegionInput} from '../../portal/region-preference';
import {PREVIEW_COOKIE} from '../../domains/tower-service/preview';
import {servicesModel} from './model';
import Workspace from './workspace';
import EvidenceWorkspace from '../evidence/workspace';
import {evidenceModel} from '../evidence/model';
import {isEvidenceView,serviceReturnHref} from '../service-navigation';
import {readTowerPreview,extendHistoryCatalog,historyServiceTrend} from '../../domains/tower-service/history-reader';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const params=await searchParams,{returnTo:rawReturn,...query}=params,returnTo=serviceReturnHref(rawReturn);
 if(!demoDataEnabled())return <ProductFrame active="customer-use"><div className="product-page-inset"><PageHeading title={"\u670d\u52a1\u91cf\u5316"} icon="users"/><PanelCard title={isEvidenceView(query.view)?'\u8ba1\u91cf\u5feb\u7167\u5f85\u63a5\u5165':'\u670d\u52a1\u5feb\u7167\u5c1a\u672a\u63a5\u5165'} icon="database"><p>{'\u5b8c\u6210\u6765\u6e90\u53ca\u6743\u9650\u63a5\u5165\u540e\u5c55\u793a\u6388\u6743\u5feb\u7167\u3002'}</p></PanelCard></div></ProductFrame>;
 try{if(rawReturn!==undefined&&!returnTo)throw Error('invalid_service_return');const input=await rememberedRegionInput(query);const ready=await publishedPageRead<ReturnType<typeof servicesModel>>('services',input);if(ready)return <ProductFrame active="customer-use"><Workspace model={ready}/></ProductFrame>;const session=(await cookies()).get(PREVIEW_COOKIE)?.value,result=await readTowerPreview(input,session);if(isEvidenceView(result.input.view))return <ProductFrame active="customer-use" preview><EvidenceWorkspace model={extendHistoryCatalog(evidenceModel(result.input,result.versions,result.access.operators),result)} returnTo={returnTo}/></ProductFrame>;const model=extendHistoryCatalog(await pageReadModel('services',result,()=>servicesModel(result.input,result.versions,result.access.operators)),result,true);if(model.view==='periods'&&model.metric)model.trend=historyServiceTrend(result,model.metric.id,model.context.city,model.context.county,model.context.operator)??model.trend;return <ProductFrame active="customer-use" preview><Workspace model={model}/></ProductFrame>;}catch(error){if(!(error instanceof Error&&/^(invalid_|query_too_large)/.test(error.message)))throw error;return <ProductFrame active="customer-use"><div className="product-page-inset" role="alert"><PageHeading title={"\u5feb\u7167\u67e5\u8be2\u6761\u4ef6\u65e0\u6548"} icon="users"/><ResetButton href="/tower-service/services" label={"\u91cd\u7f6e\u5feb\u7167\u67e5\u8be2"} variant="outline"/></div></ProductFrame>;}
}
