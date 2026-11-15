"use client";
import {useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {Button,Icon,Input,PanelCard,SegmentedControl,Select,SelectTrigger,SelectValue,SelectContent,SelectItem,EmptyState} from '@vxture/design-system';
import PageHeading from '../../portal/page-heading';
import ResetButton from '../../portal/reset-button';
import OperatorIdentity from '../../portal/operator-identity';
import {useOperatorNames} from '../../portal/operator-identities';
import {useInvestigationLinks,InvestigationReturn} from '../../portal/investigation';
import {DEMO_DATE} from '../../domains/map-demo/rules';
import {HISTORY_START,HISTORY_END} from '../../domains/map-demo/history-calendar';
import {generationHref,type GenerationQuery} from '../generation-rules';
import {checkArtifact,type ReportArtifact,type ReportFiles} from '../local-rules';
import {localReportStore} from '../local-store';
import ReportFileView from '../file-view';
import '../../site-analysis/site-analysis.css';
export default function ReportGenerationWorkspace({query:q}:{query:GenerationQuery}){
 const router=useRouter(),names=useOperatorNames(),[busy,setBusy]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState(''),[preview,setPreview]=useState<{artifact:ReportArtifact;files:ReportFiles}|null>(null),[saved,setSaved]=useState<string|null>(null);
 const controller=useRef<AbortController|null>(null),timeInput=useRef<HTMLInputElement>(null),{keep}=useInvestigationLinks(generationHref(q));
 useEffect(()=>{controller.current?.abort();setPreview(null);setSaved(null);setError('');setBusy(false);},[q]);
 useEffect(()=>()=>controller.current?.abort(),[]);
 const navigate=(patch:Partial<GenerationQuery>)=>router.replace(keep(generationHref({...q,...patch})),{scroll:false});
 const generate=async()=>{if(busy||saving)return;controller.current?.abort();const c=new AbortController();controller.current=c;setBusy(true);setError('');setSaved(null);setPreview(null);
 try{const response=await fetch('/api/product-preview/business-report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(q),signal:c.signal});if(!response.ok)throw Error('generation_failed');const checked=await checkArtifact(await response.json());if(!c.signal.aborted)setPreview(checked);}
 catch{if(!c.signal.aborted)setError('\u751f\u6210\u672a\u5b8c\u6210\uff0c\u8bf7\u91cd\u8bd5\u3002');}finally{if(!c.signal.aborted)setBusy(false);}
 };
 const save=async()=>{if(!preview||saving)return;setSaving(true);setError('');let store;
 try{store=await localReportStore();const result=await store.save(preview.artifact);setSaved(result.digest);try{const c=new BroadcastChannel('bsmoss-local-reports');c.postMessage('saved');c.close();}catch{}}
 catch(error){setError(error instanceof Error&&error.message==='report_storage_full'?'\u62a5\u544a\u5e93\u5bb9\u91cf\u4e0d\u8db3\uff0c\u672a\u4fdd\u5b58\uff0c\u8bf7\u4e0b\u8f7d\u6587\u4ef6\u6216\u68c0\u67e5\u672c\u673a\u5b58\u50a8\u3002':'\u5165\u5e93\u672a\u5b8c\u6210\uff0c\u9884\u89c8\u4ecd\u4fdd\u7559\uff0c\u8bf7\u68c0\u67e5\u672c\u673a\u5b58\u50a8\u540e\u91cd\u8bd5\u3002');}finally{store?.close();setSaving(false);}
 };
 const download=(format:'html'|'json')=>{if(!preview)return;const url=URL.createObjectURL(new Blob([preview.files[format]],{type:format==='html'?'text/html;charset=utf-8':'application/json;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=preview.files.reportId+'.'+format;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 return <div data-report-generation className="site-analysis-page product-page-inset flex min-w-0 flex-col gap-lg">
 <PageHeading icon="newspaper" title={"\u62a5\u544a\u751f\u6210"} description={"\u9009\u62e9\u8303\u56f4 \u2192 \u751f\u6210\u9884\u89c8 \u2192 \u786e\u8ba4\u5165\u5e93"} context={<span>{"\u6f14\u793a \u00b7 \u672c\u673a\u62a5\u544a\u5e93"}</span>} actions={<Button asChild variant="ghost" size="xl"><Link href={keep('/reports?'+new URLSearchParams({city:q.city,county:q.county}))}><Icon name="arrow-left" size="sm"/>{"\u62a5\u544a\u4e2d\u5fc3"}</Link></Button>}/>
 <InvestigationReturn source="history"/>
 <section className="site-analysis-toolbar"><div className="site-analysis-filters site-analysis-action-row">
 <span className="inline-flex items-center gap-xs"><Icon name="file-text" size="sm"/>{"\u7efc\u5408\u8fd0\u8425\u62a5\u544a"}</span>
 <div className="site-analysis-time-tools">
 <Select value={q.operator} disabled={busy||saving} onValueChange={operator=>navigate({operator:operator as GenerationQuery['operator']})}><SelectTrigger aria-label={"\u8fd0\u8425\u5546"} className="site-analysis-operator-select w-auto"><SelectValue/></SelectTrigger><SelectContent className="site-analysis-operator-options">{Object.entries(names).map(([code,name])=><SelectItem key={code} value={code}>{code==='all'?name:<OperatorIdentity code={code}/>}</SelectItem>)}</SelectContent></Select>
 <div className="site-analysis-control-group"><div className="site-analysis-datetime relative flex items-center"><Button className="site-analysis-time-icon" variant="ghost" size="icon-sm" disabled={busy||saving} aria-label={"\u9009\u62e9\u62a5\u544a\u65e5\u671f"} onClick={()=>timeInput.current?.showPicker()}><Icon name="calendar" size="sm"/></Button><Input ref={timeInput} aria-label={"\u62a5\u544a\u65e5\u671f"} type="date" min={HISTORY_START} max={new Date(Date.parse(HISTORY_END+'T00:00:00Z')-86400000).toISOString().slice(0,10)} value={q.date} disabled={busy||saving} onChange={e=>{if(e.target.value)navigate({date:e.target.value});}}/></div>
 <SegmentedControl className="h-control-xl" size="md" ariaLabel={"\u62a5\u544a\u5468\u671f"} value={q.period} onChange={period=>{if(!busy&&!saving)navigate({period:period as GenerationQuery['period']});}} items={[{value:'day',label:'\u65e5',disabled:busy||saving},{value:'week',label:'\u5468',disabled:busy||saving},{value:'month',label:'\u6708',disabled:busy||saving}]}/></div>
 <ResetButton label={"\u91cd\u7f6e\u62a5\u544a\u6761\u4ef6"} disabled={busy||saving} onClick={()=>navigate({operator:'all',period:'day',date:DEMO_DATE})}/>
 <Button size="xl" disabled={busy||saving} onClick={()=>void generate()}><Icon name="newspaper" size="sm"/>{busy?'\u6b63\u5728\u751f\u6210\u2026':preview?'\u91cd\u65b0\u751f\u6210':'\u751f\u6210\u9884\u89c8'}</Button>
 </div></div></section>
 {error&&<p role="alert" className="text-body-small text-destructive">{error}</p>}
 {!preview?<PanelCard title={"\u62a5\u544a\u9884\u89c8"} icon="file-text"><EmptyState title={busy?"\u6b63\u5728\u751f\u6210\u62a5\u544a":"\u8bf7\u9009\u62e9\u6761\u4ef6\u540e\u751f\u6210\u9884\u89c8"} description={busy?"\u6b63\u5728\u6c47\u603b\u5f53\u524d\u8303\u56f4\u7684\u7528\u91cf\u4e0e\u660e\u7ec6\u3002":"\u5305\u542b\u7ecf\u8425\u7528\u91cf\u3001\u540c\u73af\u6bd4\u3001\u5fd9\u65f6\u5cf0\u503c\u3001\u8fd0\u8425\u72b6\u6001\u3001\u8fd0\u884c\u53c2\u6570\u3001\u91cd\u70b9\u7ad9\u5740\u4e0e\u590d\u6838\u4f9d\u636e\u3002"}/></PanelCard>:<>
 <div className="site-analysis-table-tools site-analysis-action-row"><span className="text-body-small text-muted-foreground">{preview.files.scopeLabel+' \u00b7 '+preview.files.start.slice(0,10)+' \u2014 '+preview.files.end.slice(0,10)+'\uff08\u4e0d\u542b\uff09'}</span><div className="site-analysis-control-group">
 <Button size="xl" variant="ghost" onClick={()=>download('html')}>{"\u4e0b\u8f7d HTML"}</Button><Button size="xl" variant="ghost" onClick={()=>download('json')}>{"\u4e0b\u8f7d JSON"}</Button>
 {saved?<Button asChild size="xl"><Link href={keep('/reports?'+new URLSearchParams({city:'all',county:'all',saved}))}>{"\u67e5\u770b\u5df2\u5165\u5e93\u62a5\u544a"}</Link></Button>:<Button size="xl" disabled={saving} onClick={()=>void save()}>{saving?'\u6b63\u5728\u5165\u5e93\u2026':'\u786e\u8ba4\u5165\u5e93'}</Button>}</div></div>
 {saved&&<p role="status" className="text-body-small text-muted-foreground">{"\u5df2\u5165\u5e93\uff0c\u76f8\u540c\u5185\u5bb9\u4fdd\u7559\u539f\u4fdd\u5b58\u65f6\u95f4\u3002"}</p>}
 <ReportFileView key={preview.artifact.digest} files={preview.files}/>
 </>}
 </div>;
}
