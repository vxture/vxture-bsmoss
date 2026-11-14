'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {usePathname,useSearchParams} from 'next/navigation';
import {Button,Icon,Popover,PopoverTrigger,ShellPanelContent,ShellPanelSection} from '@vxture/design-system';
import {moduleFunctions,businessModuleForPath,activeModuleFunction,moduleFunctionHref} from './business-modules';
import {towerNavigation} from './tower-navigation';

// The same secondary destinations are reachable from the new and original pages.
export default function ModuleFunctionMenu(){
 const path=usePathname(),query=useSearchParams().toString(),module=businessModuleForPath(path);
 const [open,setOpen]=useState(false);
 useEffect(()=>setOpen(false),[path,query]);
 if(!module||moduleFunctions[module].length<2)return null;
 const parent=towerNavigation.find(item=>item.id===module)!;
 const active=activeModuleFunction(module,path,query),params=new URLSearchParams(query);
 const city=params.getAll('city'),county=params.getAll('county');
 const region=city.length===1&&county.length===1?{cityId:city[0],countyId:county[0]}:undefined;
 return <Popover open={open} onOpenChange={setOpen}>
  <PopoverTrigger asChild><Button size="icon-xl" variant="ghost" className="shrink-0" title={'\u66f4\u591a\u529f\u80fd'} aria-label={parent.label+'\u4e8c\u7ea7\u529f\u80fd'}><Icon name="more-vertical" size="md"/></Button></PopoverTrigger>
  <ShellPanelContent align="end" aria-label={parent.label+'\u4e8c\u7ea7\u529f\u80fd'} className="max-h-[var(--radix-popover-content-available-height)] overflow-y-auto">
   <p className="px-sm text-body-small text-muted-foreground">{parent.label}</p>
   <ShellPanelSection divided={false}>{moduleFunctions[module].map(item=><Button key={item.id} asChild size="xl" variant={active===item.id?'secondary':'ghost'} className="w-full justify-start gap-sm"><Link href={moduleFunctionHref(item.href,path,query,region)} aria-current={active===item.id?'page':undefined} onClick={()=>setOpen(false)}><Icon name={item.icon} size="sm"/>{item.label}</Link></Button>)}</ShellPanelSection>
  </ShellPanelContent>
 </Popover>;
}
