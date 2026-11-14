import {redirect} from 'next/navigation';
import BusinessPage from '../business-analysis/page-view';
import {parseBusinessQuery} from '../business-analysis/model';
import {readInvestigation} from '../portal/investigation-server';
import {keepInvestigation} from '../portal/investigation-links';
import {rememberedRegionInput} from '../portal/region-preference';
import {generationHref} from '../reports/generation-rules';
import {DEMO_DATE} from '../domains/map-demo/rules';
export const dynamic='force-dynamic';
export default async function Page(props:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const raw=await props.searchParams;
 if(process.env.BSMOSS_PRODUCT_PREVIEW==='on'&&!raw.selection&&!raw.search){
  let target:string|undefined;
  try{const extracted=readInvestigation(raw),{scope:q}=parseBusinessQuery('usage-reports',await rememberedRegionInput(extracted.input));target=keepInvestigation(generationHref({city:q.cityId,county:q.countyId,operator:q.operator,period:q.period as 'day'|'week'|'month',date:DEMO_DATE}),extracted.journey);}catch{}
  if(target)redirect(target);
 }
 return <BusinessPage kind="usage-reports" searchParams={Promise.resolve(raw)}/>;
}
