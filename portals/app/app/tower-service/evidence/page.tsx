import {redirect} from 'next/navigation';
import {ruleComparisonHref} from '../rule-links';
import {legacyEvidenceHref} from '../service-navigation';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const legacy=await searchParams;
 if(legacy.view==='rules')redirect(ruleComparisonHref(legacy,true));
 redirect(legacyEvidenceHref(legacy));
}
