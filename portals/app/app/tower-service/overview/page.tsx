import DashboardPage from '../dashboard/server';
export const dynamic='force-dynamic';
export default function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){return <DashboardPage kind="overview" searchParams={searchParams}/>;}
