import { demoDataEnabled } from "../lib/demo-mode";
import Link from 'next/link';
import {PanelCard} from '@vxture/design-system';
import ProductFrame from '../portal/header';
import PageHeading from '../portal/page-heading';
import ResetButton from '../portal/reset-button';
import {efficiencyIcon} from '../portal/business-icons';
import {rememberedRegionInput} from '../portal/region-preference';
import {readInvestigation} from '../portal/investigation-server';
import {InvestigationProvider,InvestigationReturn} from '../portal/investigation';
import {loadMonitoringConfiguration} from '../domains/monitoring/parameter-http';
import BusinessPage from '../business-analysis/page-view';
import EfficiencyWorkspace from './workspace';
import {efficiencyModel} from './model';
import {energyTitle} from './labels';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const input=await searchParams;
 if(input.history==='1'||input.selection!==undefined||input.topic==='power')return <BusinessPage kind="efficiency" searchParams={Promise.resolve(input)}/>;
 if(!demoDataEnabled())return <ProductFrame active="efficiency" preview={false}><div className="product-page-inset flex flex-col gap-lg"><PageHeading icon={efficiencyIcon} title={energyTitle}/><PanelCard title={'\u80fd\u8017\u6570\u636e\u5c1a\u672a\u63a5\u5165'} icon={efficiencyIcon}><p>{'\u63a5\u5165\u6388\u6743\u7535\u91cf\u3001\u6d41\u91cf\u53ca\u8ba1\u91cf\u5bf9\u5e94\u5173\u7cfb\u540e\u5c55\u793a\u80fd\u6548\u5206\u6790\u3002'}</p></PanelCard></div></ProductFrame>;
 let data,journey;try{const extracted=readInvestigation(input);journey=extracted.journey;data=efficiencyModel(await rememberedRegionInput(extracted.input),await loadMonitoringConfiguration());}catch(error){
  if(error instanceof Error&&error.message==='monitoring_configuration_unavailable')return <ProductFrame active="efficiency"><div className="product-page-inset flex flex-col gap-lg"><PageHeading icon={efficiencyIcon} title={energyTitle}/><PanelCard title={'\u80fd\u6548\u53c2\u6570\u6682\u4e0d\u53ef\u7528'} icon="faders"><p>{'\u8bf7\u68c0\u67e5\u5171\u7528\u5206\u6790\u53c2\u6570\u4e0e\u8bbf\u95ee\u6743\u9650\u3002'}</p><Link className="text-primary" href="/settings/rules#monitoring-parameters">{'\u53c2\u6570\u914d\u7f6e'}</Link></PanelCard></div></ProductFrame>;
  if(!(error instanceof Error&&/^(invalid_|query_too_large)/.test(error.message)))throw error;
  return <ProductFrame active="efficiency"><div className="product-page-inset" role="alert"><PageHeading icon={efficiencyIcon} title={'\u5206\u6790\u6761\u4ef6\u65e0\u6548'}/><ResetButton href="/efficiency" variant="outline"/></div></ProductFrame>;
 }
 return <ProductFrame active="efficiency" preview><InvestigationProvider journey={journey}><InvestigationReturn source="snapshot"/><EfficiencyWorkspace data={data}/></InvestigationProvider></ProductFrame>;
}
