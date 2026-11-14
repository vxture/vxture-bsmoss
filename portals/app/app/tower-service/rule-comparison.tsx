'use client';
import {useState} from 'react';
import {Button,DataTable,EmptyState,Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@vxture/design-system';
import {ConfigurationDetail} from '../settings/configuration-layout';
import type {RuleVersion} from '../domains/tower-service/foundation';
import {name,customerName,ruleFields,serviceName,operatorNames} from './rule-format';
import './rule-comparison.css';
export interface RuleComparisonData {rules:RuleVersion[];ruleCustomers:Record<string,string>;ruleA?:string;ruleB?:string;service?:string;snapshot?:{id:string;dataThrough:string}}
export default function RuleComparison({data}:{data:RuleComparisonData}){
 const [ruleDetail,setRuleDetail]=useState<RuleVersion|null>(null);
 const [filters,setFilters]=useState(()=>{const first=data.rules.find(r=>r.id===data.ruleA)??data.rules[0];return {service:data.rules.some(r=>r.service===data.service)?data.service!:'all',ruleA:first?.id??'none',ruleB:data.rules.find(r=>r.id===data.ruleB)?.id??data.rules.find(r=>r.id!==first?.id&&r.service===first?.service&&r.kind===first?.kind)?.id??'none'};});
 const m={rules:data.rules,ruleCustomers:data.ruleCustomers,filters};
 const change=(patch:Record<string,string|number>)=>setFilters(current=>({...current,...Object.fromEntries(Object.entries(patch).map(([k,v])=>[k,String(v)]))}));
 const select=(label:string,value:string,items:{value:string;label:string}[],onChange:(s:string)=>void)=><Select value={value} onValueChange={onChange}><SelectTrigger className="w-auto max-w-full" aria-label={label}><SelectValue/></SelectTrigger><SelectContent>{items.map(r=><SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent></Select>;
 const a=m.rules.find(r=>r.id===m.filters.ruleA)??null,b=m.rules.find(r=>r.id===m.filters.ruleB)??null;
 const ruleLabel=(r:RuleVersion)=>[operatorNames[r.operator]??r.operator,serviceName(r.service),r.reference,'v'+r.revision+' \u00b7 '+r.from].join(' / ');
 const ruleRows=(r:RuleVersion|null):[string,string][]=>[['\u8fd0\u8425\u5546',r?operatorNames[r.operator]??r.operator:'--'],...ruleFields(r).map(([label,value]):[string,string]=>[label,label==='\u670d\u52a1'&&r?serviceName(r.service):label==='\u5ba2\u6237'&&r?customerName(m.ruleCustomers[r.customerId]??value):value])];
 const af=ruleRows(a),bf=ruleRows(b),incompatible=!!(a&&b&&(a.service!==b.service||a.unit!==b.unit||a.boundary!==b.boundary));
 const rulePanel=<section className="evidence-rules-open site-analysis-section" aria-label={'\u51bb\u7ed3\u53e3\u5f84\u5bf9\u7167'}>
 {m.rules.length?<><div className="evidence-rule-pickers">
  <label className="flex min-w-0 flex-col gap-xs"><span className="text-body-small text-muted-foreground">{'\u670d\u52a1\u8303\u56f4'}</span>{select('\u5bf9\u7167\u670d\u52a1',m.filters.service,['all',...new Set(m.rules.map(r=>r.service))].map(value=>({value,label:serviceName(value)})),service=>{const first=m.rules.find(r=>service==='all'||r.service===service);change({service,ruleA:first?.id??'none',ruleB:m.rules.find(r=>r.id!==first?.id&&r.service===first?.service&&r.kind===first?.kind)?.id??'none'});})}</label>
  {[['A',m.filters.ruleA],['B',m.filters.ruleB]].map(([side,value])=><label key={side} className="flex min-w-0 flex-col gap-xs"><span className="text-body-small text-muted-foreground">{'\u53e3\u5f84 '+side}</span>{select('\u5bf9\u7167\u89c4\u5219'+side,value,[{value:'none',label:'\u9009\u62e9\u534f\u8bae\u7248\u672c'},...m.rules.filter(r=>m.filters.service==='all'||r.service===m.filters.service).map(r=>({value:r.id,label:ruleLabel(r)}))],id=>change({[side==='A'?'ruleA':'ruleB']:id}))}</label>)}
 </div>{!b&&<p role="status" className="text-body-small text-muted-foreground">{'\u8bf7\u9009\u62e9\u53e6\u4e00\u5957\u51bb\u7ed3\u53e3\u5f84\uff1b\u4e0d\u4f1a\u81ea\u52a8\u7528\u65e0\u5173\u670d\u52a1\u51d1\u6210\u5bf9\u7167\u3002'}</p>}
 {incompatible&&<p role="status" className="text-warning-text text-body-small">{'\u670d\u52a1\u3001\u5355\u4f4d\u6216\u8ba1\u91cf\u8fb9\u754c\u4e0d\u4e00\u81f4\uff0c\u4ec5\u53ef\u5bf9\u7167\u53e3\u5f84\uff0c\u4e0d\u53ef\u76f4\u63a5\u6bd4\u8f83\u6570\u91cf\u3002'}</p>}
 <div className="evidence-rule-table"><DataTable rows={af.map(([label,value],i)=>({id:label,label,a:value,b:bf[i][1]}))} rowKey={r=>r.id} columns={[
  {id:'field',header:'\u53e3\u5f84\u9879',cell:r=>r.label},
  {id:'a',header:<Button variant="ghost" disabled={!a} onClick={()=>setRuleDetail(a)}>{'\u53e3\u5f84 A \u00b7 \u67e5\u770b\u539f\u89c4\u5219'}</Button>,cell:r=><span className={a&&b&&r.a!==r.b?'evidence-rule-difference':undefined}>{r.a}</span>},
  {id:'b',header:<Button variant="ghost" disabled={!b} onClick={()=>setRuleDetail(b)}>{'\u53e3\u5f84 B \u00b7 \u67e5\u770b\u539f\u89c4\u5219'}</Button>,cell:r=><span className={a&&b&&r.a!==r.b?'evidence-rule-difference':undefined}>{r.b}</span>}
 ]}/></div></>:<EmptyState title={'\u6682\u65e0\u5df2\u5173\u8054\u7684\u534f\u8bae\u53e3\u5f84'} description={'\u5ba2\u6237\u5f52\u5c5e\u53ca\u9002\u7528\u534f\u8bae\u6765\u6e90\u5f85\u63a5\u5165\uff1b\u5e7f\u7535\u3001\u5176\u4ed6\u4e0d\u501f\u7528\u9ed8\u8ba4\u89c4\u5219\u3002'}/>}
 </section>;

 return <>{rulePanel}<ConfigurationDetail open={!!ruleDetail} onClose={()=>setRuleDetail(null)} title={'\u53e3\u5f84\u8be6\u60c5'} description={ruleDetail?.id}>{ruleDetail&&<dl className="flex min-w-0 flex-col gap-md">{ruleRows(ruleDetail).map(([label,value])=><div key={label}><dt className="text-body-small text-muted-foreground">{label}</dt><dd className="break-words">{value}</dd></div>)}</dl>}</ConfigurationDetail></>;
}
