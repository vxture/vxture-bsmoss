"use client";
import {useState} from 'react';
import {DataTable,Icon,PanelCard,Pagination,SegmentedControl} from '@vxture/design-system';
import AnalysisOverview from '../site-analysis/overview';
import AnalysisHourlyChart from '../site-analysis/hourly-chart';
import AnalysisSummary from '../site-analysis/summary';
import {OperatorLogo} from '../portal/operator-identity';
import {compactUsage,compactUsageValue,usageNames,usageShortNames,usageIcons,usageNumber,usageUnits} from '../operator-usage/labels';
import {usageMetrics,type UsageMetric} from '../domains/business-usage/rules';
import {n,pct} from '../sites/labels';
import type {ReportFiles} from './local-rules';
import type {BusinessReport} from './business-snapshot';
import '../site-analysis/site-analysis.css';
import '../portal/pagination.css';
import ReportAnalysisView from './analysis-view';
export default function ReportFileView({files}:{files:ReportFiles}){
 if(files.kind!=='business')return <PanelCard title={"\u62a5\u544a\u6b63\u6587"} description={"\u4fdd\u5b58\u7248\u672c \u00b7 \u5185\u5bb9\u4fdd\u6301\u539f\u6837"} icon="file-text"><iframe title={"\u5386\u53f2\u62a5\u544a\u6b63\u6587"} sandbox="" referrerPolicy="no-referrer" className="site-analysis-report-preview" srcDoc={files.html.replace('<head>','<head><meta http-equiv="Content-Security-Policy" content="default-src &apos;none&apos;; style-src &apos;unsafe-inline&apos;; img-src data:; font-src data:; form-action &apos;none&apos;; base-uri &apos;none&apos;">')}/></PanelCard>;
 return <BusinessReportView report={JSON.parse(files.json) as BusinessReport}/>;
}
function BusinessReportView({report:r}:{report:BusinessReport}){
 const [metric,setMetric]=useState<UsageMetric>('bytes'),[page,setPage]=useState(1),[size,setSize]=useState(20);
 const pages=Math.max(1,Math.ceil(r.stations.length/size)),current=Math.min(page,pages);
 const selector=<SegmentedControl size="md" ariaLabel={"\u62a5\u544a\u7528\u91cf\u6307\u6807"} className="site-analysis-occupancy site-analysis-occupancy-auto [--analysis-facet-columns:4]" value={metric} onChange={setMetric} items={usageMetrics.map(value=>({value,ariaLabel:usageNames[value],label:<span className="site-analysis-occupancy-label"><Icon name={usageIcons[value]} size="sm"/>{usageShortNames[value]}</span>}))}/>;
 const max=Math.max(1,...r.regions.map(row=>Number(row[metric])));
 return <div className="flex min-w-0 flex-col gap-lg" data-business-report={r.id}>
 <ReportAnalysisView report={r} summary/>
 <section className="site-analysis-toolbar"><div className="site-analysis-filters site-analysis-action-row"><AnalysisSummary items={usageMetrics.map(key=>({key,icon:usageIcons[key],label:usageNames[key],...compactUsage(r.total[key],key)}))} note={"\u8986\u76d6 "+n(r.sites)+" \u7ad9 \u00b7 \u6709\u6548 "+r.coverage.observed+"/"+r.coverage.expected+(r.coverage.daily?" \u5929":" \u5c0f\u65f6")}/></div></section>
 <AnalysisOverview title={"\u8fd0\u8425\u5546\u7528\u91cf"} description={r.coverage.label} icon="chart-pie" action={selector} items={r.operators.map(row=>({key:row.code,label:row.code,labelContent:r.operatorNames[row.code]??row.code,icon:<OperatorLogo code={row.code} size="large"/>,value:<span className="inline-flex items-baseline gap-sm whitespace-nowrap"><span>{compactUsageValue(row[metric],metric)}</span><span className="text-body-small text-muted-foreground">{pct(Number(r.total[metric])?Number(row[metric])/Number(r.total[metric]):null)}</span></span>,progress:Number(r.total[metric])?Number(row[metric])/Number(r.total[metric])*100:0}))}
 regionTitle={"\u533a\u57df\u7528\u91cf"} regionDescription={usageNames[metric]+" \u00b7 "+usageUnits[metric]} regionClassName="sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2"
 regions={r.regions.map(row=>({key:row.id,label:row.name,value:<span>{"| \u5171 "+n(row.sites)+" \u7ad9"}</span>,meta:<span>{compactUsageValue(row[metric],metric)}</span>,progress:Number(row[metric])/max*100}))}/>
 <PanelCard title={r.coverage.daily?"\u6bcf\u65e5\u53d8\u5316":"\u5c0f\u65f6\u53d8\u5316"} description={r.coverage.label} icon="chart-line-up"><AnalysisHourlyChart hideAxis key={metric} metricLabel={usageNames[metric]} data={r.series.map(row=>({key:row.key,label:row.label,value:usageNumber(row[metric],metric)}))} formatLabel={label=>r.coverage.daily?label:label+':00'} labelEvery={r.series.length>12?4:1} formatValue={value=>n(value,2)+' '+usageUnits[metric]}/></PanelCard>
 <ReportAnalysisView report={r}/>
 <PanelCard title={"\u62a5\u544a\u7ad9\u5740\u660e\u7ec6"} description={"\u5b8c\u6574\u62a5\u544a\u8303\u56f4 \u00b7 \u6d41\u91cf\u964d\u5e8f"} icon="building" className="site-analysis-table-panel">
 <div className="site-analysis-table"><DataTable indexStart={(current-1)*size+1} rows={r.stations.slice((current-1)*size,current*size)} rowKey={row=>row.id} columns={[{id:'site',header:'\u7ad9\u5740',cell:row=><span className="flex min-w-0 flex-col"><span>{row.name}</span><span className="text-body-small text-muted-foreground">{row.id}</span></span>},{id:'region',header:'\u533a\u57df',cell:row=>row.cityName+' / '+row.countyName},...usageMetrics.map(key=>({id:key,header:usageNames[key],cell:(row:BusinessReport['stations'][number])=>compactUsageValue(row[key],key)}))]}/></div>
 <Pagination className="product-pagination site-analysis-pagination site-analysis-action-row" countLabel={"\u5171\u8ba1\uff1a"+r.stations.length+" \u4e2a\u7ad9\u5740"} page={current} pageCount={pages} total={r.stations.length} pageSize={size} pageSizeOptions={[10,20,50,100]} pageSizeLabel={"\u6bcf\u9875\u663e\u793a\u6570\u91cf"} pageSizeOptionTemplate={"\u6bcf\u9875 {size} \u6761"} onPageSizeChange={value=>{setSize(value);setPage(1);}} onPageChange={setPage} firstLabel={"\u9996\u9875"} previousLabel={"\u4e0a\u4e00\u9875"} nextLabel={"\u4e0b\u4e00\u9875"} lastLabel={"\u672b\u9875"}/>
 </PanelCard></div>;
}
