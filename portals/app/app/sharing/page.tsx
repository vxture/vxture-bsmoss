import {redirect} from 'next/navigation';
import {sharingDestination} from '../tower-service/judgment/analysis-links';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){redirect(sharingDestination(await searchParams));}
