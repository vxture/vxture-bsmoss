import { demoDataEnabled } from "../../lib/demo-mode";
import ProductFrame from '../../portal/header';
import FoundationAdmin from '../admin';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){const input=await searchParams,view=Object.keys(input).every(k=>k==='view')&&typeof input.view==='string'&&['plans','snapshots','logs'].includes(input.view)?input.view:'plans';return <ProductFrame active="data-updates"><FoundationAdmin area="sync" view={view} preview={demoDataEnabled()}/></ProductFrame>;}
