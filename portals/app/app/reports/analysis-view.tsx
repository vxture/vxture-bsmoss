"use client";
import {DataTable,PanelCard} from '@vxture/design-system';
import {analysisSections,reportSummary} from './analysis-content';
import type {BusinessReport} from './business-snapshot';
export default function ReportAnalysisView({report,summary=false}:{report:BusinessReport;summary?:boolean}){
 if(!report.analysis)return null;
 if(summary)return <PanelCard title={"\u62a5\u544a\u6458\u8981"} icon="file-text"><p className="text-body" data-report-summary>{reportSummary(report)}</p></PanelCard>;
 return <>{analysisSections(report).map(s=><PanelCard key={s.id} title={s.title} description={s.description} icon="file-text"><div className="min-w-0 overflow-x-auto" data-report-chapter={s.id}><DataTable<{values:string[];id:string}> rows={s.rows.map((values,id)=>({values,id:String(id)}))} rowKey={r=>r.id} columns={s.headers.map((header,i)=>({id:String(i),header,cell:r=><span className="whitespace-nowrap tabular-nums">{r.values[i]}</span>}))}/></div></PanelCard>)}</>;
}
