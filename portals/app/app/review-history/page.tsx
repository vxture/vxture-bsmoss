import { demoDataEnabled } from "../lib/demo-mode";
import {notFound,redirect} from 'next/navigation';
import {reviewRecordsDestination} from '../usage-review/view';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 if(!demoDataEnabled())notFound();
 redirect(reviewRecordsDestination(await searchParams));
}
