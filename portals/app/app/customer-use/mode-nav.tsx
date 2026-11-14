"use client";
import {useEffect} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {Button,SegmentedControl} from '@vxture/design-system';
import type {AnalysisHref} from '../site-analysis/workspace';
import {resourceSliceHref,serviceSliceHref,evidenceSliceHref} from '../tower-service/links';
export default function CustomerModeNav({mode,href,explicit=true}:{mode:'resources'|'performance'|'legacy';href:AnalysisHref;explicit?:boolean}){
 const router=useRouter();
 useEffect(()=>{if(!explicit&&mode==='resources'&&['#occupancy','#sharing','#usage'].includes(window.location.hash)){const url=new URL(window.location.href);url.searchParams.set('section','legacy');router.replace(url.pathname+url.search+url.hash);}},[explicit,mode,router]);
 const destination=(section:'resources'|'performance'|'legacy')=>{const url=new URL(href({section,page:1}),'http://local');if(section!=='legacy')for(const key of ['usageSort','compare','tenancy','sharing'])url.searchParams.delete(key);if(section!=='performance')url.searchParams.delete('supplyFilter');else for(const key of ['operator','operatorCount','status'])url.searchParams.set(key,'all');return url.pathname+url.search;};
 return <nav aria-label={'\u5ba2\u6237\u4f7f\u7528\u5185\u5bb9'} className="flex flex-wrap items-center gap-sm"><SegmentedControl ariaLabel="客户使用内容" value={mode} items={[{value:'resources',label:'服务资源'},{value:'performance',label:'服务履行'},{value:'legacy',label:'原分析（待迁移）'}]} onChange={section=>router.push(destination(section))}/>{mode==='resources'&&<Button asChild size="sm" variant="outline"><Link href={resourceSliceHref(href())}>{"\u7edf\u4e00\u5feb\u7167\u67e5\u8be2"}</Link></Button>}<Button asChild size="sm" variant="ghost"><Link href={serviceSliceHref(href())}>{"\u670d\u52a1\u91cf\u5316"}</Link></Button><Button asChild size="sm" variant="ghost"><Link href={evidenceSliceHref(href())}>{"\u8ba1\u91cf\u4f9d\u636e"}</Link></Button></nav>;
}
