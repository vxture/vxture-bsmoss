"use client";
import {useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {Button,DataTable,EmptyState,NativeSelect,Pagination,StatusBadge,TableTitleCell} from '@vxture/design-system';
import PageHeading from '../portal/page-heading';
import type {ReviewListModel} from '../domains/usage-verification/demo';
import {reviewRows} from '../domains/usage-verification/list-rules';
import {reviewHref,reviewParams} from '../domains/usage-verification/links';
import {useReviewRecords} from '../usage-review/use-records';
import RecordSession from '../usage-review/record-session';
import {causeNames,actionNames} from '../usage-review/record-labels';
import {metricNames,statusNames,timeLabel} from '../usage-review/labels';
import {operatorNames} from '../sites/labels';
import type {ReviewQuery} from '../domains/usage-verification/query';
import '../usage-review/review.css';
export default function ReviewHistory({model,initialSession}:{model:ReviewListModel;initialSession?:string}){
 const r=useReviewRecords(model.dataset,initialSession),[reason,setReason]=useState('all'),[pending,start]=useTransition(),router=useRouter();
 const list=reviewRows(model.cases,model.inputQuery,r.data?.logs??[],true,reason),q={...model.inputQuery,page:list.page};
 const navigate=(patch:Partial<ReviewQuery>)=>{const p=reviewParams({...q,...patch});if(r.selected)p.set('recordSession',r.selected);start(()=>router.push('/review-history?'+p,{scroll:false}));};
 return <div data-review-history className="product-page-inset flex min-h-0 w-full flex-col gap-lg overflow-auto">
  <PageHeading title={'\u6838\u9a8c\u8bb0\u5f55'} description={'\u539f\u56e0\u786e\u8ba4\u3001\u590d\u6838\u4e0e\u5386\u53f2\u4f9d\u636e'} context={<span>{'\u6570\u636e\u622a\u81f3 '+timeLabel(model.cutoff)}</span>}
   actions={<Button asChild variant="outline"><a href={reviewHref(q)+(r.selected?"&recordSession="+r.selected:"")}>{'\u7528\u91cf\u6838\u9a8c'}</a></Button>}
   toolbar={<div className="flex flex-col gap-md"><RecordSession records={r}/><div className="flex flex-wrap items-center gap-md">
    <NativeSelect aria-label={'\u8bb0\u5f55\u72b6\u6001'} wrapperClassName="w-auto" value={q.status} disabled={pending} onChange={e=>navigate({status:e.target.value as ReviewQuery['status'],page:1})}>{Object.entries(statusNames).map(([k,v])=><option key={k} value={k}>{v}</option>)}</NativeSelect>
    <NativeSelect aria-label={'\u8bb0\u5f55\u539f\u56e0'} wrapperClassName="w-auto" value={reason} onChange={e=>setReason(e.target.value)}><option value="all">{'\u5168\u90e8\u539f\u56e0'}</option>{Object.entries(causeNames).map(([k,v])=><option key={k} value={k}>{v}</option>)}</NativeSelect>
    <NativeSelect aria-label={'\u8bb0\u5f55\u5468\u671f'} wrapperClassName="w-auto" value={q.period} disabled={pending} onChange={e=>navigate({period:e.target.value as ReviewQuery['period'],page:1})}>{[['day','\u65e5'],['week','\u5468'],['month','\u6708']].map(([k,v])=><option key={k} value={k}>{v}</option>)}</NativeSelect>
    <NativeSelect aria-label={'\u8bb0\u5f55\u6307\u6807'} wrapperClassName="w-auto" value={q.metric} disabled={pending} onChange={e=>navigate({metric:e.target.value as ReviewQuery['metric'],page:1})}>{Object.entries(metricNames).map(([k,v])=><option key={k} value={k}>{v}</option>)}</NativeSelect>
    <NativeSelect aria-label={'\u8bb0\u5f55\u8fd0\u8425\u5546'} wrapperClassName="w-auto" value={q.scope.operator} disabled={pending} onChange={e=>navigate({scope:{...q.scope,operator:e.target.value as ReviewQuery['scope']['operator']},page:1})}>{Object.entries(operatorNames).map(([k,v])=><option key={k} value={k}>{v}</option>)}</NativeSelect>
   </div></div>}/>
  {r.error?<EmptyState title={'\u8bb0\u5f55\u6682\u4e0d\u53ef\u8bfb'} description={'\u8bf7\u68c0\u67e5\u672c\u673a\u5b58\u50a8\u6216\u5207\u6362\u4f1a\u8bdd\uff0c\u539f\u8bb0\u5f55\u672a\u88ab\u91cd\u5efa\u6216\u5220\u9664\u3002'}/>:!r.data?<EmptyState title={'\u6b63\u5728\u8bfb\u53d6\u8bb0\u5f55'}/>:<DataTable rows={list.rows} rowKey={c=>c.id} columns={[
   {id:'site',header:'\u6838\u9a8c\u5bf9\u8c61',cell:c=><TableTitleCell title={c.site.name} description={operatorNames[c.operator]+' \u00b7 '+metricNames[c.metric]} onTitleClick={()=>router.push(reviewHref(q,c.id)+'&recordSession='+(r.selected??r.data!.active)+'&event='+c.review.revision+'#review-event-'+c.review.revision)}/>},
   {id:'action',header:'\u6700\u8fd1\u64cd\u4f5c',cell:c=>c.review.last?actionNames[c.review.last.command.action]:'\u2014'},
   {id:'reason',header:'\u786e\u8ba4\u539f\u56e0',cell:c=>c.review.reason?causeNames[c.review.reason]:'\u2014'},
   {id:'state',header:'\u6838\u9a8c\u72b6\u6001',cell:c=><StatusBadge tone={c.review.state==='closed'?'success':'neutral'} size="sm">{statusNames[c.review.state]}</StatusBadge>},
   {id:'actor',header:'\u8bb0\u5f55\u4eba / \u65f6\u95f4',cell:c=><TableTitleCell title={'\u6f14\u793a\u8bbf\u5ba2'} description={timeLabel(c.review.last!.recordedAt)}/>},
   {id:'evidence',header:'\u4f9d\u636e\u72b6\u6001',cell:c=>c.review.changed?'\u5df2\u53d8\u5316\uff0c\u9700\u91cd\u6838':'\u4e0e\u5f53\u524d\u4f9d\u636e\u4e00\u81f4'},
  ]} empty={<EmptyState title={'\u5f53\u524d\u8303\u56f4\u6682\u65e0\u4eba\u5de5\u8bb0\u5f55'} description={'\u8fdb\u5165\u7528\u91cf\u6838\u9a8c\u67e5\u770b\u8bc1\u636e\u5e76\u8bb0\u5f55\u539f\u56e0\u540e\uff0c\u8fd9\u91cc\u5c06\u663e\u793a\u771f\u5b9e\u53d1\u751f\u7684\u64cd\u4f5c\u3002'} action={<Button asChild variant="outline"><a href={reviewHref(q)+(r.selected?"&recordSession="+r.selected:"")}>{'\u67e5\u770b\u7528\u91cf\u6838\u9a8c'}</a></Button>}/>}/>}
  {r.data&&list.total>20&&<Pagination page={list.page} pageCount={list.pages} total={list.total} countLabel={'\u5171 '+list.total+' \u6761\u8bb0\u5f55'} onPageChange={page=>navigate({page})} firstLabel={'\u9996\u9875'} previousLabel={'\u4e0a\u4e00\u9875'} nextLabel={'\u4e0b\u4e00\u9875'} lastLabel={'\u672b\u9875'}/>}
 </div>;
}
