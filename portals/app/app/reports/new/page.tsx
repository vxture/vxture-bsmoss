import ProductFrame from '../../portal/header';
import PageHeading from '../../portal/page-heading';
import {PanelCard} from '@vxture/design-system';
import {rememberedRegionInput} from '../../portal/region-preference';
import {readInvestigation} from '../../portal/investigation-server';
import {InvestigationProvider} from '../../portal/investigation';
import {generationQuery} from '../generation-rules';
import ReportGenerationWorkspace from './workspace';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 if(process.env.BSMOSS_PRODUCT_PREVIEW!=='on')return <ProductFrame active="reports" preview={false}><div className="product-page-inset flex flex-col gap-lg"><PageHeading icon="newspaper" title={"\u62a5\u544a\u751f\u6210"}/><PanelCard title={"\u6b63\u5f0f\u62a5\u544a\u751f\u6210\u5c1a\u672a\u5f00\u653e"} icon="file-text"><p>{"\u5b8c\u6210\u6388\u6743\u6765\u6e90\u4e0e\u62a5\u544a\u5b58\u50a8\u63a5\u5165\u540e\u5f00\u653e\u3002"}</p></PanelCard></div></ProductFrame>;
 try{const extracted=readInvestigation(await searchParams),query=generationQuery(await rememberedRegionInput(extracted.input));return <ProductFrame active="reports" preview><InvestigationProvider journey={extracted.journey}><ReportGenerationWorkspace query={query}/></InvestigationProvider></ProductFrame>;}
 catch(error){if(!(error instanceof Error&&/^(invalid_|outside_history)/.test(error.message)))throw error;return <ProductFrame active="reports"><div className="product-page-inset" role="alert"><PageHeading icon="newspaper" title={"\u62a5\u544a\u6761\u4ef6\u65e0\u6548"} description={"\u8bf7\u68c0\u67e5\u533a\u57df\u3001\u8fd0\u8425\u5546\u3001\u5468\u671f\u4e0e\u65e5\u671f\u3002"}/></div></ProductFrame>;}
}
