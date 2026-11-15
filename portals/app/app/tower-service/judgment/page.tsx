import {pageReadModel,publishedPageRead} from "../../domains/tower-service/page-read-model";
import { demoDataEnabled } from "../../lib/demo-mode";
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {PanelCard} from '@vxture/design-system';
import ProductFrame from '../../portal/header';
import PageHeading from '../../portal/page-heading';
import ResetButton from '../../portal/reset-button';
import {rememberedRegionInput} from '../../portal/region-preference';
import {PREVIEW_COOKIE,previewFoundation,previewSeed,validPreviewSession} from '../../domains/tower-service/preview';
import {judgmentModel} from './model';
import Workspace from './workspace';
import {readTowerPreview,extendHistoryCatalog} from '../../domains/tower-service/history-reader';
import {towerReportCentreHref} from '../../reports/centre-links';
import {snapshotQuery} from '../../domains/tower-service/query';
import {energyModel} from './energy-model';
import EnergyWorkspace from './energy-workspace';
import {sharingModel} from './sharing-model';
import SharingWorkspace from './sharing-workspace';
import {occupancyModel} from './occupancy-model';
import OccupancyWorkspace from './occupancy-workspace';
import {sharingGrain,sharingMonth} from './analysis-links';
import {DEFAULT_HISTORY_ID} from '../../domains/tower-service/history-calendar';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 if(!demoDataEnabled())return <ProductFrame active="board"><div className="product-page-inset"><PageHeading title={'\u667a\u80fd\u7814\u5224'} icon="list-checks"/><PanelCard title={'\u7814\u5224\u5feb\u7167\u5f85\u63a5\u5165'}><p>{'\u5b8c\u6210\u6765\u6e90\u53ca\u6743\u9650\u63a5\u5165\u540e\u5c55\u793a\u6388\u6743\u6570\u636e\u3002'}</p></PanelCard></div></ProductFrame>;
 try{const input=await rememberedRegionInput(await searchParams),token=(await cookies()).get(PREVIEW_COOKIE)?.value;
  if(input.view==='sharing'||input.view==='occupancy'){
   if(input.snapshotId!==undefined&&typeof input.snapshotId!=='string')throw Error('invalid_sharing_query');
   const query={...input,snapshotId:sharingMonth(input.snapshotId??DEFAULT_HISTORY_ID,sharingGrain(input.grain))};
   const result=await readTowerPreview(query,token);return <ProductFrame active="board" preview>{input.view==='occupancy'?<OccupancyWorkspace model={occupancyModel(result.input,result)}/>:<SharingWorkspace model={sharingModel(result.input,result)}/>}</ProductFrame>;
  }
  if((!input.view||input.view==='energy')&&!input.report){const ready=await publishedPageRead<ReturnType<typeof energyModel>>('energy',input);if(ready)return <ProductFrame active="board"><EnergyWorkspace model={ready}/></ProductFrame>;const result=await readTowerPreview(input,token);return <ProductFrame active="board" preview><EnergyWorkspace model={extendHistoryCatalog(await pageReadModel('energy',result,()=>energyModel(result.input,result)),result)}/></ProductFrame>;}
  const result=await readTowerPreview(input,token,{comparison:input.view!=='reports'}),model=extendHistoryCatalog(judgmentModel(result.input,result.versions,result.access.operators),result);
  if(model.view==='reports'||model.filters.report)redirect(towerReportCentreHref({...snapshotQuery(model.context),report:model.filters.report}));
  return <ProductFrame active="board" preview><Workspace model={model}/></ProductFrame>;
 }catch(error){if(!(error instanceof Error&&/^(invalid_|query_too_large)/.test(error.message)))throw error;return <ProductFrame active="board"><div className="product-page-inset" role="alert"><PageHeading title={'\u5feb\u7167\u67e5\u8be2\u6761\u4ef6\u65e0\u6548'} icon="list-checks"/><ResetButton href="/tower-service/judgment" label={'\u91cd\u7f6e\u5feb\u7167\u67e5\u8be2'} variant="outline"/></div></ProductFrame>;}
}
