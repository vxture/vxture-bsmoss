import {notFound} from 'next/navigation';
import {Button,PanelCard,ShellPageContainer} from '@vxture/design-system';
import ProductFrame from '../portal/header';
import PageHeading from '../portal/page-heading';
import {rememberedRegionInput} from '../portal/region-preference';
import {reviewDemo} from '../domains/usage-verification/demo';
import {validSession} from '../domains/usage-verification/indexeddb-store';
import ReviewHistory from './workspace';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 if(process.env.BSMOSS_PRODUCT_PREVIEW!=='on')notFound();
 let model,session:string|undefined;
 try{const {recordSession,...input}=await searchParams;if(recordSession!==undefined&&(typeof recordSession!=='string'||!validSession(recordSession)))throw Error('invalid_review_query');session=recordSession as string|undefined;model=reviewDemo(await rememberedRegionInput({period:'month',...input}));}
 catch(e){if(!(e instanceof Error&&/^(invalid_|query_too_large)/.test(e.message)))throw e;return <ProductFrame active="review-history" preview><ShellPageContainer className="product-page-inset"><PageHeading title={'\u6838\u9a8c\u8bb0\u5f55'}/><PanelCard title={'\u7b5b\u9009\u6761\u4ef6\u65e0\u6548'} icon="search"><Button asChild><a href="/review-history">{'\u91cd\u7f6e\u7b5b\u9009'}</a></Button></PanelCard></ShellPageContainer></ProductFrame>;}
 return <ProductFrame active="review-history" preview><ReviewHistory key={JSON.stringify([model.inputQuery,session])} model={model} initialSession={session}/></ProductFrame>;
}
