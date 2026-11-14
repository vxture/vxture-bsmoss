'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {Button,EmptyState,Icon,ShellPageContainer} from '@vxture/design-system';
import PageHeading from '../../portal/page-heading';
import {configurationTime} from '../../settings/configuration-layout';
import RuleComparison,{type RuleComparisonData} from '../rule-comparison';
import {ruleComparisonHref} from '../rule-links';
import type {FoundationView} from '../admin';
import '../../site-analysis/site-analysis.css';

export default function ConfigurationComparison({frozen,preview,error:initialError}:{frozen?:RuleComparisonData;preview:boolean;error?:string}){
 const [data,setData]=useState<RuleComparisonData|undefined>(frozen),[busy,setBusy]=useState(preview&&!frozen&&!initialError),[error,setError]=useState(initialError??'');
 useEffect(()=>{
  if(frozen||!preview||initialError)return;
  const controller=new AbortController();
  void (async()=>{try{
   const response=await fetch('/api/product-preview/tower-foundation',{cache:'no-store',signal:controller.signal});
   if(!response.ok)throw Error();const result:FoundationView=await response.json();
   setData({rules:result.rules.filter(r=>r.kind!=='judgment'),ruleCustomers:Object.fromEntries(result.directory.filter(entry=>entry.kind==='customer').map(entry=>[entry.id,entry.name]))});
  }catch{if(!controller.signal.aborted)setError('\u89c4\u5219\u8bfb\u53d6\u5931\u8d25\uff0c\u8bf7\u8fd4\u56de\u534f\u8bae\u6e05\u5355\u540e\u91cd\u8bd5\u3002');}finally{if(!controller.signal.aborted)setBusy(false);}})();
  return ()=>controller.abort();
 },[frozen,preview,initialError]);
 return <ShellPageContainer className="site-analysis-page product-page-inset gap-lg">
  <PageHeading title={'\u8ba1\u91cf\u534f\u8bae\u4e0e\u53e3\u5f84'} icon="file-text" description={'\u53e3\u5f84\u5bf9\u7167\uff1a\u67e5\u770b\u9002\u7528\u6761\u4ef6\u4e0e\u89c4\u5219\u7248\u672c\u5dee\u5f02'} context={data?.snapshot?<span className="text-body-small text-muted-foreground">{'\u6570\u636e\u622a\u81f3 '+configurationTime(data.snapshot.dataThrough)}</span>:undefined} actions={<Button asChild variant="outline"><Link href="/tower-service/rules?view=agreements"><Icon name="chevron-left" size="sm"/>{'\u8fd4\u56de\u8ba1\u91cf\u534f\u8bae'}</Link></Button>}/>
  <div className="flex min-w-0 flex-col gap-lg" aria-busy={busy}>
   <div className="flex flex-wrap items-center justify-between gap-sm"><p className="text-body-small text-muted-foreground">{data?.snapshot?'\u5f53\u524d\u67e5\u770b\u539f\u5feb\u7167\u5f15\u7528\u7684\u5386\u53f2\u51bb\u7ed3\u53e3\u5f84\u3002':'\u5bf9\u7167\u5df2\u914d\u7f6e\u7684\u8ba1\u91cf\u4e0e\u5171\u4eab\u89c4\u5219\u3002'}</p>{preview&&<Button asChild variant="ghost"><Link href={ruleComparisonHref({},!data?.snapshot&&!initialError)}>{data?.snapshot||initialError?'\u67e5\u770b\u5df2\u914d\u7f6e\u53e3\u5f84':'\u67e5\u770b\u5feb\u7167\u51bb\u7ed3\u53e3\u5f84'}</Link></Button>}</div>
   {busy&&<span className="analysis-loading" role="status"><Icon name="refresh" className="animate-spin" size="md"/>{'\u6570\u636e\u52a0\u8f7d\u4e2d\u2026'}</span>}
   {error?<p role="alert" className="text-danger-text">{error}</p>:!preview?<EmptyState title={'\u6b63\u5f0f\u89c4\u5219\u6765\u6e90\u5f85\u63a5\u5165'}/>:data?<RuleComparison data={data}/>:null}
  </div>
 </ShellPageContainer>;
}
