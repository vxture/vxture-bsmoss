import {redirect} from 'next/navigation';
import BusinessPage from '../business-analysis/page-view';
import {customerUseDestination} from '../customer-use/links';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const input=await searchParams;
 if(input.selection!==undefined||input.history==='1')return <BusinessPage kind="operator-usage" searchParams={Promise.resolve(input)}/>;
 redirect(customerUseDestination(input));
}
