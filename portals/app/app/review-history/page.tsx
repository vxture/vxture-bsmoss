import {notFound,redirect} from 'next/navigation';
import {reviewRecordsDestination} from '../usage-review/view';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 if(process.env.BSMOSS_PRODUCT_PREVIEW!=='on')notFound();
 redirect(reviewRecordsDestination(await searchParams));
}
