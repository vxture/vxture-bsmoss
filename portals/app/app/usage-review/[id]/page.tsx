import PageHeading from "../../portal/page-heading";
import { notFound } from "next/navigation";
import ProductFrame from "../../portal/header";
import { Button, PanelCard, ShellPageContainer } from "@vxture/design-system";
import { reviewDemoDetail } from "../../domains/usage-verification/demo";
import ReviewDetail from "../detail";
import {validSession} from '../../domains/usage-verification/indexeddb-store';
export const dynamic = "force-dynamic";
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.BSMOSS_PRODUCT_PREVIEW !== "on") notFound();
  const { id } = await params;
  let model,recordSession:string|undefined,eventNumber:number|undefined;
  try { const {recordSession:session,event,...input}=await searchParams;
    if(session!==undefined&&(typeof session!=='string'||!validSession(session))||event!==undefined&&(typeof event!=='string'||!/^\d{1,6}$/.test(event)||Number(event)<1))throw Error('invalid_review_query');
    recordSession=session as string|undefined;eventNumber=event===undefined?undefined:Number(event);model = reviewDemoDetail(id,input); }
  catch (error) { if (!(error instanceof Error && /^(invalid_|query_too_large)/.test(error.message))) throw error; return <ProductFrame active="usage-review"><ShellPageContainer className="product-page-inset max-w-none"><PageHeading title={"\u7528\u91cf\u6838\u9a8c"} /><div role="alert"><PanelCard title={"\u6838\u9a8c\u7b5b\u9009\u65e0\u6548"} icon="search"><Button asChild><a href="/usage-review">{"\u91cd\u7f6e\u6838\u9a8c\u8303\u56f4"}</a></Button></PanelCard></div></ShellPageContainer></ProductFrame>; }
  if (!model) notFound();
  return <ProductFrame active="usage-review" preview><ReviewDetail model={model} recordSession={recordSession} eventNumber={eventNumber}/></ProductFrame>;
}
