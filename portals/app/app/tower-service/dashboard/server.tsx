import {cookies} from 'next/headers';
import {PanelCard} from '@vxture/design-system';
import ProductFrame from '../../portal/header';
import PageHeading from '../../portal/page-heading';
import ResetButton from '../../portal/reset-button';
import {rememberedRegionInput} from '../../portal/region-preference';
import {PREVIEW_COOKIE,previewFoundation,previewSeed,validPreviewSession} from '../../domains/tower-service/preview';
import {dashboardModel,networkModel} from './model';
import {networkGeography} from './geography';
import Overview from './overview';
import Network from './network';
import {readTowerPreview,extendHistoryCatalog} from '../../domains/tower-service/history-reader';
export default async function DashboardPage({searchParams,kind}:{searchParams:Promise<Record<string,string|string[]|undefined>>;kind:'overview'|'network'}){
 const title=kind==='overview'?'\u7ecf\u8425\u603b\u89c8':'\u533a\u57df\u5bf9\u6bd4',active=kind==='overview'?'home':'board',icon=kind==='overview'?'house-line':'chart-line-up';
 if(process.env.BSMOSS_PRODUCT_PREVIEW!=='on')return <ProductFrame active={active}><div className="product-page-inset"><PageHeading title={title} icon={icon}/><PanelCard title={'\u4e1a\u52a1\u5feb\u7167\u5f85\u63a5\u5165'}><p>{'\u5b8c\u6210\u6765\u6e90\u53ca\u6743\u9650\u63a5\u5165\u540e\u5c55\u793a\u6388\u6743\u6570\u636e'}</p></PanelCard></div></ProductFrame>;
 try{const input=await rememberedRegionInput(await searchParams),token=(await cookies()).get(PREVIEW_COOKIE)?.value,result=await readTowerPreview(input,token),versions=result.versions;
  if(kind==='overview')return <ProductFrame active={active} preview><Overview model={extendHistoryCatalog(dashboardModel(result.input,versions,result.access.operators,result.access.cityIds),result)}/></ProductFrame>;
  const model=extendHistoryCatalog(networkModel(result.input,versions,result.access.operators,result.access.cityIds),result);return <ProductFrame active={active} preview><Network model={model} geography={await networkGeography(model)}/></ProductFrame>;
 }catch(error){if(!(error instanceof Error&&/^(invalid_|query_too_large)/.test(error.message)))throw error;return <ProductFrame active={active}><div className="product-page-inset" role="alert"><PageHeading title={'\u5feb\u7167\u67e5\u8be2\u6761\u4ef6\u65e0\u6548'} icon={icon}/><ResetButton href={'/tower-service/'+kind} label={'\u91cd\u7f6e\u5feb\u7167\u67e5\u8be2'} variant="outline"/></div></ProductFrame>;}
}
